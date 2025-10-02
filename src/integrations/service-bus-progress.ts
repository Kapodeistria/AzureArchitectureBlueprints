/**
 * Service Bus Progress Publisher
 * Bridges local agent execution with Azure Service Bus status telemetry
 */

import { ServiceBusClient, ServiceBusSender } from '@azure/service-bus';
import { DefaultAzureCredential } from '@azure/identity';

export interface ProgressMetadata {
  displayName?: string;
  stage?: string;
  status?: 'success' | 'fallback' | 'skipped';
  details?: Record<string, unknown>;
}

export interface AgentProgressReporter {
  workflowStarted(context?: {
    expectedAgents?: string[];
    quickMode?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
  agentStarted(agentId: string, metadata?: ProgressMetadata): Promise<void>;
  agentCompleted(agentId: string, metadata?: ProgressMetadata): Promise<void>;
  agentFailed(agentId: string, error: unknown, metadata?: ProgressMetadata): Promise<void>;
  workflowCompleted(summary?: Record<string, unknown>): Promise<void>;
  workflowFailed(error: unknown): Promise<void>;
  setExpectedAgents(agentIds: string[]): void;
  getAgentCount(): number;
  close(): Promise<void>;
}

class NoopAgentProgressReporter implements AgentProgressReporter {
  async workflowStarted(_context?: { expectedAgents?: string[]; quickMode?: boolean; metadata?: Record<string, unknown>; }): Promise<void> {}
  async agentStarted(_agentId?: string, _metadata?: ProgressMetadata): Promise<void> {}
  async agentCompleted(_agentId?: string, _metadata?: ProgressMetadata): Promise<void> {}
  async agentFailed(_agentId?: string, _error?: unknown, _metadata?: ProgressMetadata): Promise<void> {}
  async workflowCompleted(_summary?: Record<string, unknown>): Promise<void> {}
  async workflowFailed(_error?: unknown): Promise<void> {}
  setExpectedAgents(_agentIds?: string[]): void {}
  getAgentCount(): number { return 0; }
  async close(): Promise<void> {}
}

interface ServiceBusProgressOptions {
  sessionId: string;
  statusQueueName?: string;
  quickMode?: boolean;
  expectedAgents?: string[];
}

class ServiceBusAgentProgressReporter implements AgentProgressReporter {
  private client: ServiceBusClient | null = null;
  private sender: ServiceBusSender | null = null;
  private isDisabled = false;
  private readonly sessionId: string;
  private readonly quickMode: boolean;
  private readonly queueName: string;
  private readonly completedAgents = new Set<string>();
  private readonly startedAgents = new Set<string>();
  private expectedAgents: Set<string>;
  private lastProgress = 5;
  private connectionString?: string;
  private fullyQualifiedNamespace?: string;

  constructor(options: ServiceBusProgressOptions) {
    this.sessionId = options.sessionId;
    this.quickMode = options.quickMode ?? false;
    this.queueName = options.statusQueueName || process.env.SERVICE_BUS_STATUS_QUEUE || 'casestudy-status';
    this.connectionString = process.env.SERVICE_BUS_CONNECTION;
    this.fullyQualifiedNamespace = process.env.SERVICE_BUS_NAMESPACE || process.env.SERVICE_BUS_FULLY_QUALIFIED_NAMESPACE;
    this.expectedAgents = new Set(options.expectedAgents || []);

    if (!this.connectionString && !this.fullyQualifiedNamespace) {
      this.isDisabled = true;
    }
  }

  setExpectedAgents(agentIds: string[]): void {
    if (agentIds && agentIds.length > 0) {
      this.expectedAgents = new Set(agentIds);
    }
  }

  async workflowStarted(context?: { expectedAgents?: string[]; quickMode?: boolean; metadata?: Record<string, unknown>; }): Promise<void> {
    if (context?.expectedAgents) {
      this.expectedAgents = new Set(context.expectedAgents);
    }

    await this.sendStatusMessage({
      status: 'processing',
      progress: 10,
      currentAgent: null,
      completedAgents: [],
      quickMode: context?.quickMode ?? this.quickMode,
      metadata: context?.metadata || {},
      message: 'Workflow started'
    });
  }

  async agentStarted(agentId: string, metadata?: ProgressMetadata): Promise<void> {
    this.startedAgents.add(agentId);
    await this.sendStatusMessage({
      status: 'processing',
      currentAgent: agentId,
      completedAgents: Array.from(this.completedAgents),
      progress: this.calculateProgress(),
      metadata: this.prepareMetadata(agentId, metadata),
      message: metadata?.displayName ? `Running agent: ${metadata.displayName}` : `Running agent: ${agentId}`
    });
  }

  async agentCompleted(agentId: string, metadata?: ProgressMetadata): Promise<void> {
    this.completedAgents.add(agentId);
    await this.sendStatusMessage({
      status: 'processing',
      currentAgent: null,
      completedAgents: Array.from(this.completedAgents),
      progress: this.calculateProgress(),
      metadata: this.prepareMetadata(agentId, metadata),
      message: metadata?.displayName ? `Completed agent: ${metadata.displayName}` : `Completed agent: ${agentId}`
    });
  }

  async agentFailed(agentId: string, error: unknown, metadata?: ProgressMetadata): Promise<void> {
    await this.sendStatusMessage({
      status: 'processing',
      currentAgent: agentId,
      completedAgents: Array.from(this.completedAgents),
      progress: this.calculateProgress(),
      error: this.serializeError(error),
      metadata: this.prepareMetadata(agentId, metadata),
      message: metadata?.displayName ? `Agent failed: ${metadata.displayName}` : `Agent failed: ${agentId}`
    });
  }

  async workflowCompleted(summary?: Record<string, unknown>): Promise<void> {
    await this.sendStatusMessage({
      status: 'completed',
      progress: 100,
      currentAgent: null,
      completedAgents: Array.from(this.completedAgents),
      result: summary || {
        message: 'Case study analysis completed successfully',
        agentsRun: this.completedAgents.size
      },
      message: 'Workflow complete'
    });
  }

  async workflowFailed(error: unknown): Promise<void> {
    await this.sendStatusMessage({
      status: 'failed',
      progress: this.calculateProgress(),
      currentAgent: null,
      completedAgents: Array.from(this.completedAgents),
      error: this.serializeError(error),
      message: 'Workflow failed'
    });
  }

  getAgentCount(): number {
    return this.startedAgents.size;
  }

  async close(): Promise<void> {
    try {
      if (this.sender) {
        await this.sender.close();
      }
      if (this.client) {
        await this.client.close();
      }
    } catch (error) {
      console.warn('⚠️  Failed to close Service Bus publisher cleanly:', error instanceof Error ? error.message : error);
    } finally {
      this.sender = null;
      this.client = null;
    }
  }

  private async sendStatusMessage(message: Record<string, unknown>): Promise<void> {
    if (this.isDisabled) {
      return;
    }

    try {
      const sender = await this.ensureSender();
      if (!sender) {
        return;
      }

      await sender.sendMessages({
        body: {
          sessionId: this.sessionId,
          timestamp: new Date().toISOString(),
          ...message
        }
      });
    } catch (error) {
      this.isDisabled = true;
      console.warn('⚠️  Disabling Service Bus progress publishing:', error instanceof Error ? error.message : error);
    }
  }

  private async ensureSender(): Promise<ServiceBusSender | null> {
    if (this.isDisabled) {
      return null;
    }

    if (this.sender) {
      return this.sender;
    }

    try {
      if (this.connectionString) {
        this.client = new ServiceBusClient(this.connectionString);
      } else if (this.fullyQualifiedNamespace) {
        const fqdn = this.fullyQualifiedNamespace.includes('.')
          ? this.fullyQualifiedNamespace
          : `${this.fullyQualifiedNamespace}.servicebus.windows.net`;
        this.client = new ServiceBusClient(fqdn, new DefaultAzureCredential());
      }

      if (!this.client) {
        this.isDisabled = true;
        return null;
      }

      this.sender = this.client.createSender(this.queueName);
      return this.sender;
    } catch (error) {
      this.isDisabled = true;
      console.warn('⚠️  Unable to initialize Service Bus progress publisher:', error instanceof Error ? error.message : error);
      return null;
    }
  }

  private calculateProgress(): number {
    const total = this.expectedAgents.size || (this.quickMode ? 3 : 15);
    const completed = this.completedAgents.size;

    if (total === 0) {
      return Math.min(95, this.lastProgress + 1);
    }

    const computed = Math.round((completed / total) * 90) + 10;
    this.lastProgress = Math.max(this.lastProgress, Math.min(computed, 95));
    return this.lastProgress;
  }

  private prepareMetadata(agentId: string, metadata?: ProgressMetadata): Record<string, unknown> {
    const base: Record<string, unknown> = {
      agentId,
      status: metadata?.status || 'success'
    };

    if (metadata?.displayName) {
      base.displayName = metadata.displayName;
    }
    if (metadata?.stage) {
      base.stage = metadata.stage;
    }
    if (metadata?.details) {
      base.details = metadata.details;
    }

    return base;
  }

  private serializeError(error: unknown): { message: string; stack?: string } {
    if (error instanceof Error) {
      return {
        message: error.message,
        stack: error.stack
      };
    }
    return {
      message: typeof error === 'string' ? error : JSON.stringify(error)
    };
  }

  isActive(): boolean {
    return !this.isDisabled;
  }
}

export async function createProgressReporter(options: ServiceBusProgressOptions): Promise<AgentProgressReporter> {
  const reporter = new ServiceBusAgentProgressReporter(options);
  if (!reporter.isActive()) {
    return new NoopAgentProgressReporter();
  }
  return reporter;
}

export function createNoopProgressReporter(): AgentProgressReporter {
  return new NoopAgentProgressReporter();
}
