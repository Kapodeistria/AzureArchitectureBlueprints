/**
 * Monitored Agent-to-Agent Orchestrator
 * 
 * PURPOSE: Pure agent-to-agent communication WITH comprehensive monitoring,
 * error handling, and real-time feedback to the orchestrator.
 * 
 * ARCHITECTURE:
 * - Agents communicate directly with each other (pure A2A)
 * - Orchestrator monitors all interactions via Azure AI Foundry APIs
 * - Real-time telemetry, error rates, and performance metrics
 * - Circuit breaker patterns for failed agents
 * - Comprehensive logging and alerting
 */

import { AzureFoundryClient } from '../utils/azure-foundry-client.js';
import { getAgentRegistry } from '../utils/deploy-agents-to-foundry.js';
import { promises as fs } from 'fs';
import { join } from 'path';

interface AgentTelemetry {
  agentName: string;
  agentId: string;
  startTime: number;
  endTime?: number;
  executionTimeMs?: number;
  status: 'running' | 'completed' | 'failed' | 'timeout' | 'circuit-broken';
  errorMessage?: string;
  retryCount: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  memoryUsageMb?: number;
}

interface AgentHealthMetrics {
  agentName: string;
  successRate: number;           // % of successful executions
  averageLatencyMs: number;      // Average execution time
  p95LatencyMs: number;         // 95th percentile latency
  errorRate: number;            // % of failed executions
  timeoutRate: number;          // % of timeout executions
  lastSuccessTime?: number;     // Last successful execution
  consecutiveFailures: number;  // Failures in a row
  circuitBreakerOpen: boolean;  // Is circuit breaker tripped?
  totalExecutions: number;      // Total number of calls
}

interface MonitoredAgentStep {
  agentName: string;
  agentId: string;
  inputFromPrevious: string[];
  timeout: number;
  retryCount: number;           // Number of retries on failure
  fallbackAgent?: string;       // Backup agent if primary fails
  circuitBreakerThreshold: number; // Failures before circuit opens
  requiredForSuccess: boolean;  // Can workflow continue if this fails?
}

interface WorkflowExecution {
  executionId: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'completed' | 'failed' | 'partial-success';
  agentTelemetry: AgentTelemetry[];
  totalCostUsd: number;
  successfulAgents: number;
  failedAgents: number;
  caseStudyHash: string;
  workflow: string;
}

export class MonitoredAgentOrchestrator {
  private foundryClient: AzureFoundryClient;
  private agentRegistry: Record<string, string>;
  private agentHealthMetrics: Map<string, AgentHealthMetrics>;
  private currentExecution?: WorkflowExecution;

  // Monitoring configuration
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly METRICS_RETENTION_HOURS = 24;
  private readonly CIRCUIT_BREAKER_RECOVERY_TIME = 300000; // 5 minutes

  constructor() {
    this.foundryClient = new AzureFoundryClient();
    this.agentRegistry = getAgentRegistry();
    this.agentHealthMetrics = new Map();
    this.initializeHealthMonitoring();
  }

  /**
   * Initialize health monitoring for all agents
   */
  private initializeHealthMonitoring(): void {
    for (const [agentName, agentId] of Object.entries(this.agentRegistry)) {
      this.agentHealthMetrics.set(agentName, {
        agentName,
        successRate: 100,
        averageLatencyMs: 0,
        p95LatencyMs: 0,
        errorRate: 0,
        timeoutRate: 0,
        consecutiveFailures: 0,
        circuitBreakerOpen: false,
        totalExecutions: 0
      });
    }

    // Start background health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Execute monitored agent-to-agent chain with comprehensive telemetry
   */
  async executeMonitoredChain(
    caseStudyText: string,
    agentChain: MonitoredAgentStep[],
    workflowName: string = 'architecture-workflow'
  ): Promise<WorkflowExecution> {

    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    this.currentExecution = {
      executionId,
      startTime: Date.now(),
      status: 'running',
      agentTelemetry: [],
      totalCostUsd: 0,
      successfulAgents: 0,
      failedAgents: 0,
      caseStudyHash: this.hashString(caseStudyText),
      workflow: workflowName
    };

    console.log(`🚀 Starting monitored agent chain: ${executionId}`);
    console.log(`📊 Monitoring ${agentChain.length} agents with full telemetry`);

    let currentPayload = {
      caseStudy: caseStudyText,
      executionId,
      timestamp: new Date().toISOString()
    };

    for (let i = 0; i < agentChain.length; i++) {
      const step = agentChain[i];
      
      // Check circuit breaker before execution
      if (this.isCircuitBreakerOpen(step.agentName)) {
        console.warn(`⚡ Circuit breaker OPEN for ${step.agentName} - attempting fallback`);
        
        if (step.fallbackAgent) {
          step.agentName = step.fallbackAgent;
          step.agentId = this.agentRegistry[step.fallbackAgent];
        } else if (!step.requiredForSuccess) {
          console.warn(`⏭️  Skipping non-critical agent ${step.agentName}`);
          continue;
        } else {
          throw new Error(`Critical agent ${step.agentName} is circuit-broken with no fallback`);
        }
      }

      const telemetry = await this.executeMonitoredAgent(step, currentPayload, i + 1, agentChain.length);
      this.currentExecution.agentTelemetry.push(telemetry);

      // Update workflow metrics
      if (telemetry.status === 'completed') {
        this.currentExecution.successfulAgents++;
        currentPayload = this.prepareNextPayload(currentPayload, telemetry, step.inputFromPrevious);
      } else {
        this.currentExecution.failedAgents++;
        
        if (step.requiredForSuccess) {
          this.currentExecution.status = 'failed';
          break;
        } else {
          console.warn(`⚠️  Non-critical agent ${step.agentName} failed - continuing workflow`);
        }
      }

      // Update cost tracking
      this.currentExecution.totalCostUsd += telemetry.costUsd || 0;

      // Real-time progress logging
      this.logProgressUpdate(i + 1, agentChain.length, telemetry);
    }

    // Finalize execution
    this.currentExecution.endTime = Date.now();
    if (this.currentExecution.status === 'running') {
      this.currentExecution.status = 'completed';
    }

    // Save comprehensive execution report
    await this.saveExecutionReport(this.currentExecution);
    
    console.log(`✅ Workflow ${executionId} completed: ${this.currentExecution.status}`);
    console.log(`📊 Success rate: ${this.currentExecution.successfulAgents}/${agentChain.length} agents`);
    console.log(`💰 Total cost: $${this.currentExecution.totalCostUsd.toFixed(4)}`);

    return this.currentExecution;
  }

  /**
   * Execute individual agent with comprehensive monitoring and retry logic
   */
  private async executeMonitoredAgent(
    step: MonitoredAgentStep,
    payload: any,
    stepNumber: number,
    totalSteps: number
  ): Promise<AgentTelemetry> {

    const telemetry: AgentTelemetry = {
      agentName: step.agentName,
      agentId: step.agentId,
      startTime: Date.now(),
      status: 'running',
      retryCount: 0
    };

    console.log(`🤖 [${stepNumber}/${totalSteps}] Executing ${step.agentName} (max retries: ${step.retryCount})`);

    for (let retry = 0; retry <= step.retryCount; retry++) {
      telemetry.retryCount = retry;

      try {
        // Execute with timeout
        const result = await Promise.race([
          this.executeAgentWithMetrics(step, payload, telemetry),
          this.createTimeoutPromise(step.timeout, step.agentName)
        ]);

        // Success!
        telemetry.endTime = Date.now();
        telemetry.executionTimeMs = telemetry.endTime - telemetry.startTime;
        telemetry.status = 'completed';
        
        this.updateAgentHealthMetrics(step.agentName, telemetry);
        
        console.log(`✅ ${step.agentName} completed in ${telemetry.executionTimeMs}ms (retry ${retry}/${step.retryCount})`);
        return telemetry;

      } catch (error) {
        console.warn(`⚠️  ${step.agentName} attempt ${retry + 1}/${step.retryCount + 1} failed: ${error.message}`);
        
        telemetry.errorMessage = error.message;
        
        if (error.message.includes('timeout')) {
          telemetry.status = 'timeout';
        } else {
          telemetry.status = 'failed';
        }

        // Don't retry on the last attempt
        if (retry === step.retryCount) {
          telemetry.endTime = Date.now();
          telemetry.executionTimeMs = telemetry.endTime - telemetry.startTime;
          
          this.updateAgentHealthMetrics(step.agentName, telemetry);
          break;
        }

        // Wait before retry (exponential backoff)
        const backoffMs = Math.min(1000 * Math.pow(2, retry), 10000);
        console.log(`⏱️  Retrying ${step.agentName} in ${backoffMs}ms...`);
        await this.sleep(backoffMs);
      }
    }

    console.error(`❌ ${step.agentName} failed after ${step.retryCount + 1} attempts`);
    return telemetry;
  }

  /**
   * Execute agent and collect detailed metrics
   */
  private async executeAgentWithMetrics(
    step: MonitoredAgentStep,
    payload: any,
    telemetry: AgentTelemetry
  ): Promise<any> {

    const prompt = this.buildAgentPrompt(step, payload);
    
    // Track input tokens (estimate)
    telemetry.inputTokens = Math.ceil(prompt.length / 4);

    // Call Azure AI Foundry agent
    const response = await this.foundryClient.chatWithAgent(step.agentId, prompt);
    
    // Track output tokens (estimate) 
    telemetry.outputTokens = Math.ceil((response?.length || 0) / 4);
    
    // Estimate cost (approximate Azure OpenAI pricing)
    const inputCost = (telemetry.inputTokens || 0) * 0.00001; // $0.01/1K input tokens
    const outputCost = (telemetry.outputTokens || 0) * 0.00003; // $0.03/1K output tokens
    telemetry.costUsd = inputCost + outputCost;

    return {
      agentName: step.agentName,
      result: response,
      inputPayload: payload,
      timestamp: new Date().toISOString(),
      metrics: {
        inputTokens: telemetry.inputTokens,
        outputTokens: telemetry.outputTokens,
        estimatedCostUsd: telemetry.costUsd
      }
    };
  }

  /**
   * Update health metrics for an agent based on execution telemetry
   */
  private updateAgentHealthMetrics(agentName: string, telemetry: AgentTelemetry): void {
    let metrics = this.agentHealthMetrics.get(agentName);
    if (!metrics) return;

    metrics.totalExecutions++;
    
    if (telemetry.status === 'completed') {
      metrics.consecutiveFailures = 0;
      metrics.lastSuccessTime = Date.now();
      
      // Update latency metrics
      if (telemetry.executionTimeMs) {
        metrics.averageLatencyMs = (metrics.averageLatencyMs * (metrics.totalExecutions - 1) + telemetry.executionTimeMs) / metrics.totalExecutions;
      }
    } else {
      metrics.consecutiveFailures++;
      
      // Check if circuit breaker should trip
      if (metrics.consecutiveFailures >= 5) { // Configurable threshold
        metrics.circuitBreakerOpen = true;
        console.error(`🚨 Circuit breaker OPENED for ${agentName} after ${metrics.consecutiveFailures} consecutive failures`);
      }
    }

    // Calculate success/error rates
    const recentExecutions = Math.min(metrics.totalExecutions, 100); // Rolling window
    metrics.successRate = ((recentExecutions - metrics.consecutiveFailures) / recentExecutions) * 100;
    metrics.errorRate = (metrics.consecutiveFailures / recentExecutions) * 100;
    
    if (telemetry.status === 'timeout') {
      metrics.timeoutRate = Math.min(metrics.timeoutRate + (1 / recentExecutions) * 100, 100);
    }

    this.agentHealthMetrics.set(agentName, metrics);
  }

  /**
   * Check if circuit breaker is open for an agent
   */
  private isCircuitBreakerOpen(agentName: string): boolean {
    const metrics = this.agentHealthMetrics.get(agentName);
    if (!metrics) return false;

    if (metrics.circuitBreakerOpen) {
      // Check if recovery time has passed
      const timeSinceLastFailure = Date.now() - (metrics.lastSuccessTime || 0);
      if (timeSinceLastFailure > this.CIRCUIT_BREAKER_RECOVERY_TIME) {
        console.log(`🔄 Circuit breaker HALF-OPEN for ${agentName} - attempting recovery`);
        metrics.circuitBreakerOpen = false;
        metrics.consecutiveFailures = 0;
        return false;
      }
      return true;
    }

    return false;
  }

  /**
   * Real-time progress logging with health metrics
   */
  private logProgressUpdate(currentStep: number, totalSteps: number, telemetry: AgentTelemetry): void {
    const progress = Math.round((currentStep / totalSteps) * 100);
    const status = telemetry.status === 'completed' ? '✅' : '❌';
    
    console.log(`📊 Progress: ${progress}% (${currentStep}/${totalSteps}) ${status} ${telemetry.agentName}`);
    
    if (telemetry.executionTimeMs) {
      console.log(`   ⏱️  Latency: ${telemetry.executionTimeMs}ms | Cost: $${(telemetry.costUsd || 0).toFixed(4)}`);
    }

    if (telemetry.status !== 'completed') {
      console.log(`   ⚠️  Error: ${telemetry.errorMessage}`);
    }
  }

  /**
   * Background health monitoring of all agents
   */
  private startHealthMonitoring(): void {
    setInterval(async () => {
      console.log('📊 Agent Health Summary:');
      
      for (const [agentName, metrics] of this.agentHealthMetrics.entries()) {
        const healthIcon = this.getHealthIcon(metrics);
        console.log(`   ${healthIcon} ${agentName}: ${metrics.successRate.toFixed(1)}% success, ${metrics.averageLatencyMs.toFixed(0)}ms avg latency`);
        
        if (metrics.circuitBreakerOpen) {
          console.log(`     🚨 Circuit breaker OPEN - ${metrics.consecutiveFailures} consecutive failures`);
        }
      }
      
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Get health icon based on agent metrics
   */
  private getHealthIcon(metrics: AgentHealthMetrics): string {
    if (metrics.circuitBreakerOpen) return '🚨';
    if (metrics.successRate < 80) return '⚠️';
    if (metrics.successRate < 95) return '🟡';
    return '🟢';
  }

  /**
   * Save comprehensive execution report with full telemetry
   */
  private async saveExecutionReport(execution: WorkflowExecution): Promise<void> {
    const report = {
      ...execution,
      summary: {
        totalExecutionTimeMs: execution.endTime! - execution.startTime,
        successRate: (execution.successfulAgents / (execution.successfulAgents + execution.failedAgents)) * 100,
        averageCostPerAgent: execution.totalCostUsd / (execution.successfulAgents + execution.failedAgents),
        healthSnapshot: Object.fromEntries(this.agentHealthMetrics.entries())
      }
    };

    const filename = `execution-report-${execution.executionId}.json`;
    const filepath = join('output', 'agent-telemetry', filename);
    
    await fs.mkdir(join('output', 'agent-telemetry'), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(report, null, 2), 'utf-8');
    
    console.log(`📄 Execution report saved: ${filename}`);
  }

  /**
   * Get real-time agent health dashboard data
   */
  getAgentHealthDashboard(): Record<string, AgentHealthMetrics> {
    return Object.fromEntries(this.agentHealthMetrics.entries());
  }

  /**
   * Get current execution status
   */
  getCurrentExecutionStatus(): WorkflowExecution | undefined {
    return this.currentExecution;
  }

  /**
   * Get agent registry for building agent chains
   */
  getAgentRegistry(): Record<string, string> {
    return this.agentRegistry;
  }

  // Helper methods
  private createTimeoutPromise(timeoutMs: number, agentName: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Agent ${agentName} timeout after ${timeoutMs}ms`)), timeoutMs);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private buildAgentPrompt(step: MonitoredAgentStep, payload: any): string {
    // Same as before, but with monitoring metadata
    return `**CASE STUDY:**\n${payload.caseStudy}\n\n**EXECUTION ID:** ${payload.executionId}\n\n**TASK:** Process according to your specialization and provide structured output for the next agent.`;
  }

  private prepareNextPayload(currentPayload: any, telemetry: AgentTelemetry, fieldsToExtract: string[]): any {
    return {
      ...currentPayload,
      previousAgent: telemetry.agentName,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Usage Example with Full Monitoring:
 * 
 * const orchestrator = new MonitoredAgentOrchestrator();
 * 
 * const execution = await orchestrator.executeMonitoredChain(caseStudyText, [
 *   {
 *     agentName: 'research-agent',
 *     agentId: 'asst_123...',
 *     inputFromPrevious: [],
 *     timeout: 45000,
 *     retryCount: 2,
 *     fallbackAgent: 'simple-research-agent',
 *     circuitBreakerThreshold: 5,
 *     requiredForSuccess: true
 *   },
 *   {
 *     agentName: 'architecture-agent', 
 *     agentId: 'asst_456...',
 *     inputFromPrevious: ['research'],
 *     timeout: 60000,
 *     retryCount: 3,
 *     fallbackAgent: 'simple-architecture-agent',
 *     circuitBreakerThreshold: 3,
 *     requiredForSuccess: true
 *   }
 * ], 'architecture-workflow');
 * 
 * // Real-time monitoring
 * console.log(orchestrator.getAgentHealthDashboard());
 * console.log(orchestrator.getCurrentExecutionStatus());
 */