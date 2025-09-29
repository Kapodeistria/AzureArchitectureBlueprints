/**
 * Base Agent Interface - Optimized for Performance & Modularity
 * Implements standardized interface for all agents with monitoring and async support
 */

import OpenAI from 'openai';
import config from '../config/config.js';

export interface AgentTask {
  id: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
  payload: any;
  dependencies?: string[];
  timeout?: number;
  retries?: number;
}

export interface AgentResponse {
  taskId: string;
  status: 'completed' | 'failed' | 'in_progress';
  result?: any;
  error?: string;
  metrics: {
    executionTime: number;
    tokensUsed: number;
    apiCalls: number;
  };
  timestamp: number;
}

export interface AgentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  tasksCompleted: number;
  errorRate: number;
  averageResponseTime: number;
}

export abstract class BaseAgent {
  protected client: OpenAI;
  protected agentName: string;
  protected config: any;
  private metrics: Map<string, any>;
  private taskQueue: AgentTask[];
  private isProcessing: boolean;
  private healthData: AgentHealth;
  private taskProcessorInterval?: NodeJS.Timeout;

  constructor(clientOrAgentName: OpenAI | string, agentName?: string) {
    // Handle both old signature (client, agentName) and new signature (agentName)
    if (typeof clientOrAgentName === 'string') {
      this.agentName = clientOrAgentName;
      this.client = null as any; // Will be set later
    } else {
      this.client = clientOrAgentName;
      this.agentName = agentName!;
    }

    this.config = config.getAgentConfig(this.agentName as any) || {};
    this.metrics = new Map();
    this.taskQueue = [];
    this.isProcessing = false;

    this.healthData = {
      status: 'healthy',
      uptime: Date.now(),
      tasksCompleted: 0,
      errorRate: 0,
      averageResponseTime: 0
    };

    // Start background task processing only if we have a proper client
    if (this.client) {
      this.startTaskProcessor();
    }

    // Register cleanup on process exit to prevent memory leaks
    this.registerCleanupHandlers();
  }

  /**
   * Register cleanup handlers for process exit
   */
  private registerCleanupHandlers(): void {
    // Store bound cleanup function for proper removal
    const boundCleanup = this.cleanup.bind(this);

    // Register for different exit scenarios
    process.once('exit', boundCleanup);
    process.once('SIGINT', boundCleanup);
    process.once('SIGTERM', boundCleanup);
    process.once('uncaughtException', (error) => {
      console.error('Uncaught exception in agent:', error);
      boundCleanup();
    });
  }

  // Abstract method for agent-specific processing
  protected abstract processTask(task: AgentTask): Promise<any>;

  // Abstract method for system prompt
  protected abstract getSystemPrompt(): string;

  // Public API for task submission
  async submitTask(task: AgentTask): Promise<string> {
    // Add to priority queue
    this.addToQueue(task);
    
    // Return task ID for tracking
    return task.id;
  }

  // Synchronous execution for simple tasks
  async executeTask(taskType: string, payload: any, options: Partial<AgentTask> = {}): Promise<AgentResponse> {
    const task: AgentTask = {
      id: `${this.agentName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: taskType,
      priority: options.priority || 'medium',
      payload,
      dependencies: options.dependencies || [],
      timeout: options.timeout || this.config.timeout || 30000,
      retries: options.retries || 2
    };

    const startTime = Date.now();
    let apiCalls = 0;
    let tokensUsed = 0;

    try {
      // Check if agent is healthy
      if (this.healthData.status === 'unhealthy') {
        throw new Error(`Agent ${this.agentName} is unhealthy`);
      }

      const result = await this.processTask(task);
      
      const executionTime = Date.now() - startTime;
      
      // Update metrics
      this.updateMetrics(task.id, {
        executionTime,
        tokensUsed,
        apiCalls,
        success: true
      });

      this.healthData.tasksCompleted++;
      this.updateAverageResponseTime(executionTime);

      return {
        taskId: task.id,
        status: 'completed',
        result,
        metrics: { executionTime, tokensUsed, apiCalls },
        timestamp: Date.now()
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Update error metrics
      this.updateMetrics(task.id, {
        executionTime,
        tokensUsed,
        apiCalls,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });

      this.updateErrorRate();

      return {
        taskId: task.id,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        metrics: { executionTime, tokensUsed, apiCalls },
        timestamp: Date.now()
      };
    }
  }

  // Optimized OpenAI API call with retries and monitoring
  protected async callOpenAI(messages: any[], options: any = {}): Promise<any> {
    const agentConfig = this.config;
    const maxRetries = options.retries || 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const response = await this.client.chat.completions.create({
          model: config.getAzureConfig().foundry.modelDeploymentName,
          messages,
          max_tokens: options.maxTokens || agentConfig.maxTokens || 1500,
          temperature: options.temperature ?? agentConfig.temperature ?? 0.3,
          timeout: options.timeout || 30000,
          ...options
        });

        return response;
      } catch (error) {
        attempt++;
        if (attempt > maxRetries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Priority queue management
  private addToQueue(task: AgentTask): void {
    const priorityOrder = { 'high': 0, 'medium': 1, 'low': 2 };
    
    const insertIndex = this.taskQueue.findIndex(
      queuedTask => priorityOrder[queuedTask.priority] > priorityOrder[task.priority]
    );
    
    if (insertIndex === -1) {
      this.taskQueue.push(task);
    } else {
      this.taskQueue.splice(insertIndex, 0, task);
    }
  }

  // Background task processor
  private async startTaskProcessor(): Promise<void> {
    this.taskProcessorInterval = setInterval(async () => {
      if (this.isProcessing || this.taskQueue.length === 0) {
        return;
      }

      this.isProcessing = true;
      
      try {
        const task = this.taskQueue.shift();
        if (task) {
          await this.executeTask(task.type, task.payload, task);
        }
      } catch (error) {
        console.error(`Task processing error in ${this.agentName}:`, error);
      } finally {
        this.isProcessing = false;
      }
    }, 100); // Check every 100ms
  }

  // Cleanup method to stop background processes and prevent memory leaks
  cleanup(): void {
    if (this.taskProcessorInterval) {
      clearInterval(this.taskProcessorInterval);
      this.taskProcessorInterval = undefined;
    }

    // Clear task queue to prevent memory retention
    this.taskQueue = [];

    // Clear metrics map
    this.metrics.clear();

    // Remove event listeners to prevent memory leaks
    process.removeAllListeners('exit');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');

    console.log(`🧹 Cleaned up agent: ${this.agentName}`);
  }

  // Health monitoring
  getHealth(): AgentHealth {
    this.healthData.uptime = Date.now() - this.healthData.uptime;
    return { ...this.healthData };
  }

  // Performance metrics
  getMetrics(): Record<string, any> {
    return Object.fromEntries(this.metrics);
  }

  // Private metric update methods
  private updateMetrics(taskId: string, data: any): void {
    this.metrics.set(taskId, {
      ...data,
      timestamp: Date.now(),
      agent: this.agentName
    });
  }

  private updateAverageResponseTime(executionTime: number): void {
    const current = this.healthData.averageResponseTime;
    const count = this.healthData.tasksCompleted;
    this.healthData.averageResponseTime = ((current * (count - 1)) + executionTime) / count;
  }

  private updateErrorRate(): void {
    const totalTasks = this.metrics.size;
    const errorTasks = Array.from(this.metrics.values()).filter(m => !m.success).length;
    this.healthData.errorRate = totalTasks > 0 ? errorTasks / totalTasks : 0;
    
    // Update health status
    if (this.healthData.errorRate > 0.3) {
      this.healthData.status = 'unhealthy';
    } else if (this.healthData.errorRate > 0.1) {
      this.healthData.status = 'degraded';
    } else {
      this.healthData.status = 'healthy';
    }
  }
}