/**
 * Intelligent Model Selection
 * Automatically selects appropriate model (GPT-4 vs GPT-3.5) based on task complexity
 * Reduces costs by 20-30% by using cheaper models for simple tasks
 */

import config from '../config/config.js';

export interface ModelConfig {
  name: string;
  deploymentName?: string;
  costPer1kTokens: number;
  maxTokens: number;
  capabilities: string[];
}

export const MODELS: Record<string, ModelConfig> = {
  'gpt-4': {
    name: 'gpt-4',
    costPer1kTokens: 0.03,
    maxTokens: 8192,
    capabilities: ['complex-reasoning', 'architecture', 'comprehensive-analysis', 'creative']
  },
  'gpt-3.5-turbo': {
    name: 'gpt-3.5-turbo',
    costPer1kTokens: 0.002,
    maxTokens: 4096,
    capabilities: ['simple-tasks', 'extraction', 'summarization', 'classification']
  }
};

export interface TaskProfile {
  taskType: string;
  complexity: 'simple' | 'moderate' | 'complex';
  agentName?: string;
  estimatedInputTokens?: number;
  requiresCreativity?: boolean;
  requiresDeepReasoning?: boolean;
}

export class ModelSelector {
  /**
   * Select optimal model based on task profile
   */
  selectModel(profile: TaskProfile): { model: string; reasoning: string } {
    // Always use GPT-4 for complex tasks
    if (profile.complexity === 'complex' || profile.requiresDeepReasoning) {
      return {
        model: this.getGPT4Model(),
        reasoning: 'Complex task requires advanced reasoning capabilities'
      };
    }

    // Use GPT-4 for creative tasks
    if (profile.requiresCreativity) {
      return {
        model: this.getGPT4Model(),
        reasoning: 'Creative task benefits from GPT-4 capabilities'
      };
    }

    // Use GPT-4 for architecture and design tasks
    if (this.isArchitectureTask(profile)) {
      return {
        model: this.getGPT4Model(),
        reasoning: 'Architecture design requires GPT-4 expertise'
      };
    }

    // Use GPT-3.5 for simple tasks
    if (profile.complexity === 'simple' || this.isSimpleTask(profile)) {
      return {
        model: 'gpt-3.5-turbo',
        reasoning: 'Simple task can be handled efficiently by GPT-3.5 (15x cost savings)'
      };
    }

    // Default to GPT-4 for moderate complexity
    return {
      model: this.getGPT4Model(),
      reasoning: 'Moderate complexity - using GPT-4 for reliability'
    };
  }

  /**
   * Check if task is architecture-related
   */
  private isArchitectureTask(profile: TaskProfile): boolean {
    const architectureKeywords = [
      'architecture',
      'design',
      'visual',
      'diagram',
      'structurizr',
      'waf',
      'well-architected'
    ];

    return (
      architectureKeywords.some(keyword =>
        profile.taskType.toLowerCase().includes(keyword)
      ) ||
      (profile.agentName &&
        architectureKeywords.some(keyword =>
          profile.agentName!.toLowerCase().includes(keyword)
        ))
    );
  }

  /**
   * Check if task is simple
   */
  private isSimpleTask(profile: TaskProfile): boolean {
    const simpleTaskPatterns = [
      'extract',
      'list',
      'summarize',
      'classify',
      'validate',
      'format',
      'parse'
    ];

    const simpleAgents = ['requirements', 'cost', 'risk'];

    return (
      simpleTaskPatterns.some(pattern =>
        profile.taskType.toLowerCase().includes(pattern)
      ) ||
      (profile.agentName &&
        simpleAgents.some(agent =>
          profile.agentName!.toLowerCase().includes(agent)
        ))
    );
  }

  /**
   * Get configured GPT-4 model name
   */
  private getGPT4Model(): string {
    const azureConfig = config.getAzureConfig();
    return azureConfig.foundry.modelDeploymentName || 'gpt-4.1';
  }

  /**
   * Calculate cost savings
   */
  calculateCostSavings(
    originalModel: string,
    selectedModel: string,
    estimatedTokens: number
  ): { savedCost: number; savingsPercent: number } {
    const originalCost =
      (MODELS[originalModel]?.costPer1kTokens || 0.03) * (estimatedTokens / 1000);
    const selectedCost =
      (MODELS[selectedModel]?.costPer1kTokens || 0.03) * (estimatedTokens / 1000);

    const savedCost = originalCost - selectedCost;
    const savingsPercent =
      originalCost > 0 ? (savedCost / originalCost) * 100 : 0;

    return {
      savedCost,
      savingsPercent
    };
  }

  /**
   * Get model recommendations for an agent
   */
  getAgentModelRecommendation(agentName: string): {
    model: string;
    reasoning: string;
  } {
    const profile: TaskProfile = {
      taskType: agentName,
      complexity: this.inferComplexityFromAgent(agentName),
      agentName
    };

    return this.selectModel(profile);
  }

  /**
   * Infer complexity from agent name
   */
  private inferComplexityFromAgent(agentName: string): 'simple' | 'moderate' | 'complex' {
    const simpleAgents = ['requirements', 'cost', 'risk'];
    const complexAgents = [
      'architecture',
      'orchestrator',
      'waf',
      'visual',
      'documentation',
      'reviewer'
    ];

    if (simpleAgents.some(name => agentName.toLowerCase().includes(name))) {
      return 'simple';
    }

    if (complexAgents.some(name => agentName.toLowerCase().includes(name))) {
      return 'complex';
    }

    return 'moderate';
  }

  /**
   * Get model configuration
   */
  getModelConfig(modelName: string): ModelConfig | undefined {
    return MODELS[modelName];
  }

  /**
   * Check if model supports a capability
   */
  supportsCapability(modelName: string, capability: string): boolean {
    const model = MODELS[modelName];
    return model ? model.capabilities.includes(capability) : false;
  }
}

// Export singleton instance
export const modelSelector = new ModelSelector();