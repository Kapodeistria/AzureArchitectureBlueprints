/**
 * Service Bus Multi-Agent Orchestrator
 * Implements queue-based and topic-based patterns for agent coordination
 */

import { ProductionServiceBusClient, MessageContext } from './service-bus-client';
import { ServiceBusReceivedMessage } from '@azure/service-bus';
import { ApplicationInsights, TelemetryClient } from 'applicationinsights';

export interface AgentRequest {
  sessionId: string;
  agentName: string;
  input: unknown;
  context?: {
    previousResults?: unknown[];
    metadata?: Record<string, unknown>;
  };
  priority?: 'high' | 'normal' | 'low';
  retryCount?: number;
}

export interface AgentResponse {
  sessionId: string;
  agentName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface OrchestratorConfig {
  // Queue names for different patterns
  requestQueueName: string;
  responseQueueName: string;
  priorityQueueName?: string;
  deadLetterQueueName?: string;

  // Topic configuration for fan-out
  topicName?: string;
  subscriptions?: string[];

  // Processing configuration
  maxConcurrentAgents?: number;
  agentTimeoutMinutes?: number;
  enablePriorityQueue?: boolean;

  // Monitoring
  applicationInsightsKey?: string;
  enableDetailedTelemetry?: boolean;
}

/**
 * Orchestrates multi-agent workflows using Service Bus patterns
 */
export class ServiceBusOrchestrator {
  private requestClient: ProductionServiceBusClient;
  private responseClient: ProductionServiceBusClient;
  private priorityClient?: ProductionServiceBusClient;
  private telemetryClient?: TelemetryClient;
  private activeAgents = new Map<string, AgentRequest>();
  private agentMetrics = new Map<string, { count: number; totalDuration: number; failures: number }>();

  constructor(private config: OrchestratorConfig) {
    // Initialize Application Insights if configured
    if (config.applicationInsightsKey) {
      ApplicationInsights.setup(config.applicationInsightsKey)
        .setAutoDependencyCorrelation(true)
        .setAutoCollectRequests(true)
        .setAutoCollectPerformance(true)
        .setAutoCollectExceptions(true)
        .setAutoCollectDependencies(true)
        .start();

      this.telemetryClient = ApplicationInsights.defaultClient;
    }

    // Initialize Service Bus clients
    this.requestClient = new ProductionServiceBusClient({
      queueName: config.requestQueueName,
      maxConcurrentCalls: config.maxConcurrentAgents || 4,
      prefetchCount: 5,
      maxAutoLockRenewalDurationInMinutes: config.agentTimeoutMinutes || 45
    });

    this.responseClient = new ProductionServiceBusClient({
      queueName: config.responseQueueName,
      maxConcurrentCalls: 1,
      prefetchCount: 20
    });

    if (config.enablePriorityQueue && config.priorityQueueName) {
      this.priorityClient = new ProductionServiceBusClient({
        queueName: config.priorityQueueName,
        maxConcurrentCalls: 2,
        prefetchCount: 5
      });
    }
  }

  /**
   * Initialize all Service Bus clients
   */
  public async initialize(): Promise<void> {
    await Promise.all([
      this.requestClient.initialize(),
      this.responseClient.initialize(),
      this.priorityClient?.initialize()
    ]);

    console.log('✅ Service Bus Orchestrator initialized');
  }

  /**
   * Execute a single agent with queue-based pattern
   */
  public async executeAgent(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    const correlationId = `${request.sessionId}-${request.agentName}-${Date.now()}`;

    try {
      // Track agent start
      this.trackAgentStart(request, correlationId);

      // Send request to queue
      const messageContext: MessageContext = {
        correlationId,
        sessionId: request.sessionId,
        subject: `agent.${request.agentName}`,
        contentType: 'application/json',
        replyTo: this.config.responseQueueName,
        timeToLive: (this.config.agentTimeoutMinutes || 45) * 60
      };

      const client = this.selectQueueByPriority(request.priority);
      await client.sendMessage(request, messageContext);

      // Store active agent for monitoring
      this.activeAgents.set(correlationId, request);

      // Wait for response (in production, this would be async)
      const response = await this.waitForResponse(correlationId, request.agentName);

      // Track completion
      this.trackAgentCompletion(request, response, Date.now() - startTime);

      return response;
    } catch (error) {
      // Track failure
      this.trackAgentFailure(request, error, Date.now() - startTime);

      return {
        sessionId: request.sessionId,
        agentName: request.agentName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    } finally {
      this.activeAgents.delete(correlationId);
    }
  }

  /**
   * Execute multiple agents in parallel using queue pattern
   */
  public async executeParallelAgents(requests: AgentRequest[]): Promise<AgentResponse[]> {
    console.log(`🚀 Executing ${requests.length} agents in parallel`);

    const promises = requests.map(request => this.executeAgent(request));
    return Promise.all(promises);
  }

  /**
   * Execute agents sequentially with context passing
   */
  public async executeSequentialAgents(
    requests: AgentRequest[],
    passContext: boolean = true
  ): Promise<AgentResponse[]> {
    console.log(`🔄 Executing ${requests.length} agents sequentially`);

    const responses: AgentResponse[] = [];
    let previousResults: unknown[] = [];

    for (const request of requests) {
      // Pass previous results as context if enabled
      if (passContext && previousResults.length > 0) {
        request.context = {
          ...request.context,
          previousResults
        };
      }

      const response = await this.executeAgent(request);
      responses.push(response);

      if (response.success && response.result) {
        previousResults.push(response.result);
      }
    }

    return responses;
  }

  /**
   * Fan-out pattern: Broadcast to multiple consumers via topic
   */
  public async broadcastToTopic(
    data: unknown,
    subject: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    if (!this.config.topicName) {
      throw new Error('Topic not configured for fan-out pattern');
    }

    console.log(`📢 Broadcasting to topic: ${subject}`);

    // In production, this would use a topic client
    // For now, simulate with multiple queue sends
    const promises = (this.config.subscriptions || []).map(subscription => {
      const messageContext: MessageContext = {
        subject,
        contentType: 'application/json',
        correlationId: `broadcast-${Date.now()}`
      };

      // Send to each subscription queue
      return this.requestClient.sendMessage({
        ...data,
        subscription,
        metadata
      }, messageContext);
    });

    await Promise.all(promises);
  }

  /**
   * Process agent responses
   */
  public async startResponseProcessor(): Promise<void> {
    await this.responseClient.startProcessor(
      async (message: ServiceBusReceivedMessage) => {
        const correlationId = message.correlationId;
        const response = message.body as AgentResponse;

        console.log(`📥 Received response for ${response.agentName}`);

        // Update metrics
        this.updateAgentMetrics(response);

        // Handle response (in production, this would trigger callbacks)
        if (correlationId && this.activeAgents.has(correlationId)) {
          const request = this.activeAgents.get(correlationId)!;
          console.log(`✅ Completed agent ${request.agentName} for session ${request.sessionId}`);
        }
      },
      async (error) => {
        console.error('❌ Error processing response:', error);
        this.telemetryClient?.trackException({ exception: error.error });
      }
    );
  }

  /**
   * Monitor dead letter queue for failed agents
   */
  public async monitorDeadLetterQueue(): Promise<void> {
    setInterval(async () => {
      await this.requestClient.processDeadLetterQueue(async (message) => {
        const request = message.body as AgentRequest;

        console.warn(`⚠️  Dead letter: ${request.agentName} for session ${request.sessionId}`);

        // Track in telemetry
        this.telemetryClient?.trackEvent({
          name: 'AgentDeadLettered',
          properties: {
            agentName: request.agentName,
            sessionId: request.sessionId,
            reason: message.deadLetterReason,
            description: message.deadLetterErrorDescription
          }
        });

        // Implement retry logic or alerting
        if ((request.retryCount || 0) < 3) {
          request.retryCount = (request.retryCount || 0) + 1;
          await this.executeAgent(request);
        } else {
          // Send alert after max retries
          console.error(`❌ Agent ${request.agentName} failed after ${request.retryCount} retries`);
        }
      });
    }, 60000); // Check every minute
  }

  /**
   * Get orchestrator health and metrics
   */
  public getHealthMetrics(): {
    activeAgents: number;
    agentMetrics: Array<{ name: string; avgDuration: number; successRate: number }>;
    queueHealth: unknown;
  } {
    const metrics = Array.from(this.agentMetrics.entries()).map(([name, stats]) => ({
      name,
      avgDuration: stats.totalDuration / stats.count,
      successRate: ((stats.count - stats.failures) / stats.count) * 100
    }));

    return {
      activeAgents: this.activeAgents.size,
      agentMetrics: metrics,
      queueHealth: {
        request: this.requestClient.getHealthStatus(),
        response: this.responseClient.getHealthStatus(),
        priority: this.priorityClient?.getHealthStatus()
      }
    };
  }

  /**
   * Gracefully shutdown the orchestrator
   */
  public async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Service Bus Orchestrator...');

    // Wait for active agents to complete (with timeout)
    const timeout = setTimeout(() => {
      console.warn('⚠️  Timeout waiting for agents to complete');
    }, 30000);

    while (this.activeAgents.size > 0) {
      console.log(`Waiting for ${this.activeAgents.size} active agents...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    clearTimeout(timeout);

    // Close all clients
    await Promise.all([
      this.requestClient.close(),
      this.responseClient.close(),
      this.priorityClient?.close()
    ]);

    // Flush telemetry
    if (this.telemetryClient) {
      this.telemetryClient.flush();
    }

    console.log('✅ Service Bus Orchestrator shutdown complete');
  }

  // Private helper methods

  private selectQueueByPriority(priority?: 'high' | 'normal' | 'low'): ProductionServiceBusClient {
    if (priority === 'high' && this.priorityClient) {
      return this.priorityClient;
    }
    return this.requestClient;
  }

  private async waitForResponse(
    correlationId: string,
    agentName: string,
    timeoutMs: number = 300000
  ): Promise<AgentResponse> {
    // In production, this would use correlation filters or sessions
    // For now, simulate with a timeout promise
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${agentName} response`));
      }, timeoutMs);

      // Simulate response after some processing time
      setTimeout(() => {
        clearTimeout(timeout);
        resolve({
          sessionId: correlationId.split('-')[0],
          agentName,
          success: true,
          result: { message: `${agentName} completed` },
          duration: Math.random() * 10000
        });
      }, Math.random() * 5000);
    });
  }

  private trackAgentStart(request: AgentRequest, correlationId: string): void {
    console.log(`🎯 Starting agent ${request.agentName} for session ${request.sessionId}`);

    if (this.telemetryClient) {
      this.telemetryClient.trackEvent({
        name: 'AgentStarted',
        properties: {
          agentName: request.agentName,
          sessionId: request.sessionId,
          correlationId,
          priority: request.priority || 'normal'
        }
      });
    }
  }

  private trackAgentCompletion(request: AgentRequest, response: AgentResponse, duration: number): void {
    console.log(`✅ Completed agent ${request.agentName} in ${duration}ms`);

    if (this.telemetryClient) {
      this.telemetryClient.trackDependency({
        target: `Agent.${request.agentName}`,
        name: request.agentName,
        data: request.sessionId,
        duration,
        resultCode: response.success ? '200' : '500',
        success: response.success,
        dependencyTypeName: 'AI Agent'
      });

      this.telemetryClient.trackMetric({
        name: `Agent.${request.agentName}.Duration`,
        value: duration
      });
    }
  }

  private trackAgentFailure(request: AgentRequest, error: unknown, duration: number): void {
    console.error(`❌ Failed agent ${request.agentName} after ${duration}ms`);

    if (this.telemetryClient) {
      this.telemetryClient.trackException({
        exception: error instanceof Error ? error : new Error(String(error)),
        properties: {
          agentName: request.agentName,
          sessionId: request.sessionId,
          duration: duration.toString()
        }
      });
    }
  }

  private updateAgentMetrics(response: AgentResponse): void {
    const metrics = this.agentMetrics.get(response.agentName) || {
      count: 0,
      totalDuration: 0,
      failures: 0
    };

    metrics.count++;
    metrics.totalDuration += response.duration || 0;
    if (!response.success) {
      metrics.failures++;
    }

    this.agentMetrics.set(response.agentName, metrics);
  }
}

/**
 * Create a pre-configured orchestrator for common patterns
 */
export function createAgentOrchestrator(pattern: 'queue' | 'topic' | 'hybrid'): ServiceBusOrchestrator {
  const baseConfig: OrchestratorConfig = {
    requestQueueName: process.env.AGENT_REQUEST_QUEUE || 'agent-requests',
    responseQueueName: process.env.AGENT_RESPONSE_QUEUE || 'agent-responses',
    applicationInsightsKey: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING
  };

  switch (pattern) {
    case 'queue':
      return new ServiceBusOrchestrator({
        ...baseConfig,
        maxConcurrentAgents: 4,
        agentTimeoutMinutes: 45
      });

    case 'topic':
      return new ServiceBusOrchestrator({
        ...baseConfig,
        topicName: 'agent-events',
        subscriptions: ['logging', 'analytics', 'notifications'],
        enableDetailedTelemetry: true
      });

    case 'hybrid':
      return new ServiceBusOrchestrator({
        ...baseConfig,
        priorityQueueName: 'agent-priority-requests',
        topicName: 'agent-events',
        subscriptions: ['logging', 'analytics'],
        enablePriorityQueue: true,
        maxConcurrentAgents: 6,
        enableDetailedTelemetry: true
      });

    default:
      throw new Error(`Unknown orchestrator pattern: ${pattern}`);
  }
}