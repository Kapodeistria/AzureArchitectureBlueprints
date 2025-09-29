/**
 * Token Optimizer
 * Dynamic token allocation based on task complexity to reduce costs by 20-30%
 */

export interface TaskComplexity {
  level: 'simple' | 'moderate' | 'complex';
  estimatedTokens: number;
  justification?: string;
}

export interface TokenAllocationConfig {
  simple: { min: number; max: number; default: number };
  moderate: { min: number; max: number; default: number };
  complex: { min: number; max: number; default: number };
}

export class TokenOptimizer {
  private config: TokenAllocationConfig = {
    simple: { min: 500, max: 1000, default: 800 },
    moderate: { min: 1000, max: 2000, default: 1500 },
    complex: { min: 2000, max: 4000, default: 3000 }
  };

  /**
   * Analyze task complexity based on input and task type
   */
  analyzeComplexity(
    taskType: string,
    inputText: string,
    agentType?: string
  ): TaskComplexity {
    const inputLength = inputText.length;
    const wordCount = inputText.split(/\s+/).length;

    // Simple tasks: requirements extraction, cost summaries, risk lists
    if (this.isSimpleTask(taskType, agentType)) {
      return {
        level: 'simple',
        estimatedTokens: this.config.simple.default,
        justification: 'Straightforward analysis with structured output'
      };
    }

    // Complex tasks: architecture design, WAF assessment, comprehensive reports
    if (this.isComplexTask(taskType, agentType)) {
      // Further analyze input size
      if (wordCount > 1000) {
        return {
          level: 'complex',
          estimatedTokens: this.config.complex.max,
          justification: 'Large input requiring comprehensive analysis'
        };
      }
      return {
        level: 'complex',
        estimatedTokens: this.config.complex.default,
        justification: 'Architecture or comprehensive analysis required'
      };
    }

    // Moderate complexity by default
    const adjustedTokens = Math.min(
      this.config.moderate.max,
      Math.max(
        this.config.moderate.min,
        Math.floor(wordCount * 2) // Rough estimate: 2 output tokens per input word
      )
    );

    return {
      level: 'moderate',
      estimatedTokens: adjustedTokens,
      justification: 'Standard analysis task'
    };
  }

  /**
   * Get optimal token allocation for a task
   */
  getOptimalTokens(taskType: string, inputText: string, agentType?: string): number {
    const complexity = this.analyzeComplexity(taskType, inputText, agentType);
    return complexity.estimatedTokens;
  }

  /**
   * Calculate potential cost savings
   */
  calculateSavings(
    originalTokens: number,
    optimizedTokens: number,
    costPerToken: number = 0.00003 // GPT-4 approximate cost
  ): { savedTokens: number; savedCost: number; savingsPercent: number } {
    const savedTokens = originalTokens - optimizedTokens;
    const savedCost = savedTokens * costPerToken;
    const savingsPercent = (savedTokens / originalTokens) * 100;

    return {
      savedTokens,
      savedCost,
      savingsPercent
    };
  }

  private isSimpleTask(taskType: string, agentType?: string): boolean {
    const simpleTasks = [
      'requirements',
      'cost-analysis',
      'risk-analysis',
      'list',
      'extract',
      'summary'
    ];

    const simpleAgents = [
      'cost',
      'risk',
      'requirements'
    ];

    return (
      simpleTasks.some(task => taskType.toLowerCase().includes(task)) ||
      (agentType && simpleAgents.some(agent => agentType.toLowerCase().includes(agent)))
    );
  }

  private isComplexTask(taskType: string, agentType?: string): boolean {
    const complexTasks = [
      'architecture',
      'design',
      'waf',
      'well-architected',
      'comprehensive',
      'report',
      'documentation',
      'review'
    ];

    const complexAgents = [
      'architecture',
      'orchestrator',
      'documentation',
      'waf',
      'visual',
      'reviewer'
    ];

    return (
      complexTasks.some(task => taskType.toLowerCase().includes(task)) ||
      (agentType && complexAgents.some(agent => agentType.toLowerCase().includes(agent)))
    );
  }

  /**
   * Get recommended configuration for an agent
   */
  getAgentConfig(agentType: string) {
    if (this.isSimpleTask('', '', agentType)) {
      return {
        maxTokens: this.config.simple.default,
        temperature: 0.1, // Lower temperature for simple, factual tasks
        costTier: 'low'
      };
    }

    if (this.isComplexTask('', '', agentType)) {
      return {
        maxTokens: this.config.complex.default,
        temperature: 0.2, // Slightly higher for creative architecture work
        costTier: 'high'
      };
    }

    return {
      maxTokens: this.config.moderate.default,
      temperature: 0.15,
      costTier: 'medium'
    };
  }
}

// Export singleton instance
export const tokenOptimizer = new TokenOptimizer();