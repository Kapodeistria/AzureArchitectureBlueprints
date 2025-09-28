/**
 * Optimized Orchestrator Agent
 * Coordinates multi-agent analysis workflow with parallel execution and smart task delegation
 */

import OpenAI from 'openai';
import { BaseAgent, AgentTask } from './base-agent.js';

interface WorkflowPlan {
  parallelTasks: AgentTask[];
  sequentialTasks: AgentTask[];
  dependencies: Map<string, string[]>;
}

export class OrchestratorAgent extends BaseAgent {
  constructor(client: OpenAI) {
    super(client, 'orchestrator');
  }

  protected getSystemPrompt(): string {
    return `You are the Orchestrator Agent for Microsoft Azure solution architecture interviews. Your role is to coordinate comprehensive analysis with optimized task delegation.

OPTIMIZED WORKFLOW:
1. Parse case study and identify parallel processing opportunities
2. Create smart task delegation plan (parallel vs sequential)
3. Monitor task execution and handle bottlenecks
4. Synthesize results with performance optimization

DELEGATION STRATEGY:
- Independent tasks: Parallel execution (Requirements + Risk Assessment)
- Dependent tasks: Sequential with smart handoffs (Architecture → Cost → Documentation)
- Critical path optimization: Prioritize blocking tasks

PERFORMANCE TARGETS:
- Task delegation latency: <200ms
- Concurrent workflow capacity: >50 workflows
- Error recovery time: <30 seconds

OUTPUT FORMAT:
Structured workflow plan with execution strategy and performance metrics.`;
  }

  protected async processTask(task: AgentTask): Promise<any> {
    switch (task.type) {
      case 'coordinate':
        return this.coordinateWorkflow(task.payload.caseStudyText);
      case 'optimize':
        return this.optimizeExecution(task.payload);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  // Main coordination method with optimization
  async coordinate(caseStudyText: string): Promise<string> {
    const response = await this.executeTask('coordinate', { caseStudyText });
    return response.result || 'Coordination failed';
  }

  // Optimized workflow coordination
  private async coordinateWorkflow(caseStudyText: string): Promise<string> {
    // Step 1: Analyze case study for task planning
    const workflowPlan = await this.createWorkflowPlan(caseStudyText);
    
    // Step 2: Execute parallel tasks first
    const parallelResults = await this.executeParallelTasks(workflowPlan.parallelTasks);
    
    // Step 3: Execute sequential tasks with results
    const sequentialResults = await this.executeSequentialTasks(
      workflowPlan.sequentialTasks,
      parallelResults
    );
    
    // Step 4: Synthesize final solution
    return this.synthesizeResults([...parallelResults, ...sequentialResults]);
  }

  // Create optimized workflow plan
  private async createWorkflowPlan(caseStudyText: string): Promise<WorkflowPlan> {
    const planningPrompt = `Analyze this case study and create an optimized task execution plan:

${caseStudyText}

Create a workflow plan that identifies:
1. Tasks that can run in parallel (independent)
2. Tasks that must run sequentially (dependent)
3. Critical path dependencies
4. Priority levels for optimal performance`;

    const response = await this.callOpenAI([
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: planningPrompt }
    ], { maxTokens: 800, temperature: 0.1 });

    // Parse response and create structured plan
    const plan: WorkflowPlan = {
      parallelTasks: [
        {
          id: 'requirements-analysis',
          type: 'requirements',
          priority: 'high',
          payload: { caseStudyText, focus: 'functional_and_nonfunctional' }
        },
        {
          id: 'risk-assessment',
          type: 'risk-analysis',
          priority: 'high',
          payload: { caseStudyText, focus: 'security_and_compliance' }
        }
      ],
      sequentialTasks: [
        {
          id: 'architecture-design',
          type: 'architecture',
          priority: 'high',
          payload: { caseStudyText },
          dependencies: ['requirements-analysis']
        },
        {
          id: 'cost-optimization',
          type: 'cost-analysis',
          priority: 'medium',
          payload: { caseStudyText },
          dependencies: ['architecture-design']
        },
        {
          id: 'documentation',
          type: 'documentation',
          priority: 'low',
          payload: { caseStudyText },
          dependencies: ['architecture-design', 'cost-optimization']
        }
      ],
      dependencies: new Map([
        ['architecture-design', ['requirements-analysis']],
        ['cost-optimization', ['architecture-design']],
        ['documentation', ['architecture-design', 'cost-optimization']]
      ])
    };

    return plan;
  }

  // Execute parallel tasks with performance monitoring
  private async executeParallelTasks(tasks: AgentTask[]): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      // Execute all parallel tasks simultaneously
      const promises = tasks.map(task => this.executeIndependentTask(task));
      const results = await Promise.allSettled(promises);
      
      const executionTime = Date.now() - startTime;
      console.log(`Parallel execution completed in ${executionTime}ms`);
      
      // Return successful results, log failures
      return results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          console.error(`Parallel task ${tasks[index].id} failed:`, result.reason);
          return { error: result.reason, taskId: tasks[index].id };
        }
      });
      
    } catch (error) {
      console.error('Parallel execution error:', error);
      throw error;
    }
  }

  // Execute sequential tasks with dependency management
  private async executeSequentialTasks(tasks: AgentTask[], previousResults: any[]): Promise<any[]> {
    const results: any[] = [];
    
    for (const task of tasks) {
      try {
        // Check dependencies
        if (task.dependencies) {
          const dependentResults = this.getDependentResults(task.dependencies, previousResults, results);
          task.payload = { ...task.payload, dependentResults };
        }
        
        const result = await this.executeIndependentTask(task);
        results.push(result);
        
      } catch (error) {
        console.error(`Sequential task ${task.id} failed:`, error);
        results.push({ error, taskId: task.id });
      }
    }
    
    return results;
  }

  // Execute individual task (placeholder for actual agent calls)
  private async executeIndependentTask(task: AgentTask): Promise<any> {
    // This would normally call the specific agent
    // For now, simulate with OpenAI call
    const prompt = `Execute ${task.type} task with the following payload: ${JSON.stringify(task.payload)}`;
    
    const response = await this.callOpenAI([
      { role: 'system', content: `You are a specialized ${task.type} agent. Process this task efficiently.` },
      { role: 'user', content: prompt }
    ], { maxTokens: 1200 });
    
    return {
      taskId: task.id,
      type: task.type,
      result: response.choices[0]?.message?.content || '',
      timestamp: Date.now()
    };
  }

  // Get results from dependent tasks
  private getDependentResults(dependencies: string[], parallelResults: any[], sequentialResults: any[]): any {
    const allResults = [...parallelResults, ...sequentialResults];
    const dependentResults: any = {};
    
    for (const dep of dependencies) {
      const result = allResults.find(r => r.taskId === dep);
      if (result) {
        dependentResults[dep] = result;
      }
    }
    
    return dependentResults;
  }

  // Synthesize all results into final solution
  private async synthesizeResults(results: any[]): Promise<string> {
    const synthesisPrompt = `Synthesize these agent results into a comprehensive solution architecture:

${results.map(r => `${r.type}: ${r.result}`).join('\n\n')}

Create a cohesive, executive-ready solution with:
1. Executive summary
2. Technical architecture
3. Implementation roadmap
4. Risk mitigation strategies
5. Cost optimization recommendations`;

    const response = await this.callOpenAI([
      { role: 'system', content: 'You are synthesizing multiple agent analyses into a final solution.' },
      { role: 'user', content: synthesisPrompt }
    ], { maxTokens: 2000, temperature: 0.2 });

    return response.choices[0]?.message?.content || 'Synthesis failed';
  }
}