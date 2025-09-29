/**
 * Pure Agent-to-Agent Orchestrator
 * 
 * PURPOSE: Implement true agent-to-agent communication where Azure AI Foundry agents
 * communicate directly with each other, passing payloads between agents without
 * local processing bottlenecks.
 * 
 * ARCHITECTURE:
 * Agent 1 → Agent 2 → Agent 3 → Agent 4 → Final Result
 * (All communication happens in Azure, local system just monitors)
 */

import { AzureFoundryClient } from '../utils/azure-foundry-client.js';
import { getAgentRegistry } from '../utils/deploy-agents-to-foundry.js';

interface AgentChainStep {
  agentName: string;
  agentId: string;
  inputFromPrevious: string[];  // Which fields from previous agent to use
  additionalContext?: any;      // Extra context to inject
  timeout: number;             // Max execution time
}

interface AgentChainResult {
  stepResults: any[];
  finalResult: any;
  executionTimeMs: number;
  agentLatencies: Record<string, number>;
}

export class PureAgentOrchestrator {
  private foundryClient: AzureFoundryClient;
  private agentRegistry: Record<string, string>;

  constructor() {
    this.foundryClient = new AzureFoundryClient();
    this.agentRegistry = getAgentRegistry();
  }

  /**
   * Execute a chain of agents where each agent passes its output directly 
   * to the next agent via Azure AI Foundry API calls
   */
  async executeAgentChain(
    caseStudyText: string, 
    agentChain: AgentChainStep[]
  ): Promise<AgentChainResult> {
    
    console.log('🔗 Starting pure agent-to-agent execution chain...');
    const startTime = Date.now();
    
    let currentPayload = {
      caseStudy: caseStudyText,
      timestamp: new Date().toISOString()
    };
    
    const stepResults: any[] = [];
    const agentLatencies: Record<string, number> = {};

    for (let i = 0; i < agentChain.length; i++) {
      const step = agentChain[i];
      const stepStart = Date.now();
      
      console.log(`🤖 Step ${i + 1}/${agentChain.length}: Executing ${step.agentName}...`);

      try {
        // Execute agent with payload from previous step
        const stepResult = await this.executeAgentStep(
          step, 
          currentPayload, 
          i === 0 ? null : stepResults[i - 1]
        );

        stepResults.push(stepResult);
        agentLatencies[step.agentName] = Date.now() - stepStart;

        // Prepare payload for next agent
        currentPayload = this.prepareNextPayload(
          currentPayload, 
          stepResult, 
          step.inputFromPrevious
        );

        console.log(`✅ ${step.agentName} completed in ${agentLatencies[step.agentName]}ms`);

      } catch (error) {
        console.error(`❌ Agent ${step.agentName} failed:`, error);
        throw new Error(`Agent chain failed at step ${i + 1}: ${error.message}`);
      }
    }

    const totalTime = Date.now() - startTime;
    
    return {
      stepResults,
      finalResult: stepResults[stepResults.length - 1],
      executionTimeMs: totalTime,
      agentLatencies
    };
  }

  /**
   * Execute individual agent step via Azure AI Foundry API
   */
  private async executeAgentStep(
    step: AgentChainStep,
    currentPayload: any,
    previousResult: any
  ): Promise<any> {

    if (!this.agentRegistry[step.agentName]) {
      throw new Error(`Agent ${step.agentName} not found in registry`);
    }

    const agentId = this.agentRegistry[step.agentName];

    // Construct prompt for the agent including context from previous agents
    const agentPrompt = this.buildAgentPrompt(
      step, 
      currentPayload, 
      previousResult
    );

    // Call Azure AI Foundry agent directly
    const response = await this.foundryClient.chatWithAgent(agentId, agentPrompt);
    
    return {
      agentName: step.agentName,
      timestamp: new Date().toISOString(),
      result: response,
      inputPayload: currentPayload
    };
  }

  /**
   * Build prompt for next agent including context from previous agents
   */
  private buildAgentPrompt(
    step: AgentChainStep,
    currentPayload: any,
    previousResult: any
  ): string {

    let prompt = '';

    // Add case study context
    if (currentPayload.caseStudy) {
      prompt += `**CASE STUDY CONTEXT:**\n${currentPayload.caseStudy}\n\n`;
    }

    // Add previous agent results if specified
    if (previousResult && step.inputFromPrevious) {
      prompt += `**PREVIOUS AGENT OUTPUT:**\n`;
      
      for (const field of step.inputFromPrevious) {
        if (previousResult[field]) {
          prompt += `**${field}:**\n${previousResult[field]}\n\n`;
        }
      }
    }

    // Add additional context
    if (step.additionalContext) {
      prompt += `**ADDITIONAL CONTEXT:**\n${JSON.stringify(step.additionalContext, null, 2)}\n\n`;
    }

    // Add task-specific instructions
    prompt += `**TASK:**\nProcess the above information according to your specialization. `;
    prompt += `Provide structured output that can be consumed by the next agent in the chain.\n\n`;
    
    prompt += `**OUTPUT FORMAT:**\nProvide your analysis in structured format with clear sections and actionable recommendations.`;

    return prompt;
  }

  /**
   * Prepare payload for the next agent in the chain
   */
  private prepareNextPayload(
    currentPayload: any,
    stepResult: any,
    fieldsToExtract: string[]
  ): any {

    const nextPayload = {
      ...currentPayload,
      previousAgent: stepResult.agentName,
      timestamp: new Date().toISOString()
    };

    // Extract specific fields from the step result
    if (fieldsToExtract) {
      for (const field of fieldsToExtract) {
        if (stepResult.result && stepResult.result[field]) {
          nextPayload[field] = stepResult.result[field];
        } else if (stepResult[field]) {
          nextPayload[field] = stepResult[field];
        }
      }
    } else {
      // If no specific fields specified, pass entire result
      nextPayload.previousResult = stepResult.result;
    }

    return nextPayload;
  }

  /**
   * Define the architecture refinement chain using pure agent-to-agent communication
   */
  getArchitectureRefinementChain(): AgentChainStep[] {
    return [
      {
        agentName: 'azure-services-research',
        agentId: this.agentRegistry['azure-services-research'] || '',
        inputFromPrevious: [],
        timeout: 45000
      },
      {
        agentName: 'requirements-analyst', 
        agentId: this.agentRegistry['requirements-analyst'] || '',
        inputFromPrevious: ['research', 'findings'],
        timeout: 30000
      },
      {
        agentName: 'architecture-designer',
        agentId: this.agentRegistry['architecture-designer'] || '',
        inputFromPrevious: ['requirements', 'analysis', 'research'],
        timeout: 60000
      },
      {
        agentName: 'waf-security-agent',
        agentId: this.agentRegistry['waf-security-agent'] || '',
        inputFromPrevious: ['architecture', 'design'],
        timeout: 45000
      },
      {
        agentName: 'waf-reliability-agent',
        agentId: this.agentRegistry['waf-reliability-agent'] || '',
        inputFromPrevious: ['architecture', 'securityAssessment'],
        timeout: 45000
      },
      {
        agentName: 'solution-architect-reviewer',
        agentId: this.agentRegistry['solution-architect-reviewer'] || '',
        inputFromPrevious: ['architecture', 'securityAssessment', 'reliabilityAssessment'],
        additionalContext: {
          optimizationTarget: 'WAF compliance and cost efficiency'
        },
        timeout: 60000
      }
    ];
  }

  /**
   * Execute the complete architecture workflow using pure agent-to-agent communication
   */
  async executeArchitectureWorkflow(caseStudyText: string): Promise<AgentChainResult> {
    const agentChain = this.getArchitectureRefinementChain();
    
    console.log('🚀 Executing pure agent-to-agent architecture workflow...');
    console.log(`📋 Agent chain: ${agentChain.map(s => s.agentName).join(' → ')}`);
    
    return await this.executeAgentChain(caseStudyText, agentChain);
  }
}

/**
 * Usage Example:
 * 
 * const pureOrchestrator = new PureAgentOrchestrator();
 * const result = await pureOrchestrator.executeArchitectureWorkflow(caseStudyText);
 * 
 * // Result contains:
 * // - Each agent's output
 * // - Final refined architecture  
 * // - Agent-to-agent latencies
 * // - Complete execution trace
 */