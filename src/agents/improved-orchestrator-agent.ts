/**
 * Improved Orchestrator Agent with Research and Review Loops
 * Implements iterative architecture development with feedback loops
 */

import { BaseAgent } from './base-agent.js';
import OpenAI from 'openai';
import config from '../config/config.js';
import { AzureServicesResearchAgent } from './azure-services-research-agent.js';
import { IndustryPatternsResearchAgent } from './industry-patterns-research-agent.js';
import { RequirementsAnalystAgent } from './requirements-analyst-agent.js';
import { ArchitectureAgent } from './architecture-agent.js';
import { SolutionArchitectReviewerAgent, ReviewFeedback } from './solution-architect-reviewer-agent.js';
import { CostOptimizerAgent } from './cost-optimizer-agent.js';
import { RiskAssessorAgent } from './risk-assessor-agent.js';
import { SecurityComplianceAgent } from './security-compliance-agent.js';
import chalk from 'chalk';

export interface IterativeWorkflowResult {
  requirements: string;
  researchData: {
    azureServices: string;
    industryPatterns: string;
    compliance: string;
  };
  architectureEvolution: {
    version: number;
    architecture: string;
    reviewFeedback: ReviewFeedback;
  }[];
  finalArchitecture: string;
  costAnalysis: string;
  riskAssessment: string;
  workflowMetrics: {
    iterationsRequired: number;
    totalExecutionTime: number;
    researchTime: number;
    designTime: number;
    reviewTime: number;
  };
}

export class ImprovedOrchestratorAgent extends BaseAgent {
  private azureServicesAgent: AzureServicesResearchAgent;
  private industryPatternsAgent: IndustryPatternsResearchAgent;
  private requirementsAgent: RequirementsAnalystAgent;
  private architectureAgent: ArchitectureAgent;
  private reviewerAgent: SolutionArchitectReviewerAgent;
  private costOptimizerAgent: CostOptimizerAgent;
  private riskAgent: RiskAssessorAgent;
  private complianceAgent: SecurityComplianceAgent;
  private client: OpenAI;

  private maxIterations = 3; // Prevent infinite loops

  constructor() {
    super('improved-orchestrator');
    
    // Initialize OpenAI client (same config as MultiAgentSystem)
    const configData = config.get();
    this.client = new OpenAI({
      apiKey: configData.azure.openai.apiKey,
      baseURL: `${configData.azure.openai.endpoint}/openai/deployments/${configData.azure.foundry.modelDeploymentName}`,
      defaultQuery: { 'api-version': '2025-01-01-preview' },
      defaultHeaders: {
        'api-key': configData.azure.openai.apiKey,
      },
    });
    
    this.azureServicesAgent = new AzureServicesResearchAgent();
    this.industryPatternsAgent = new IndustryPatternsResearchAgent();
    this.requirementsAgent = new RequirementsAnalystAgent(this.client);
    this.architectureAgent = new ArchitectureAgent(this.client);
    this.reviewerAgent = new SolutionArchitectReviewerAgent();
    this.costOptimizerAgent = new CostOptimizerAgent(this.client);
    this.riskAgent = new RiskAssessorAgent(this.client);
    this.complianceAgent = new SecurityComplianceAgent();
  }

  async coordinateIterativeWorkflow(caseStudyText: string): Promise<IterativeWorkflowResult> {
    const workflowStart = Date.now();
    console.log(chalk.blue.bold('🚀 Starting Iterative Architecture Workflow...\n'));

    try {
      // Phase 1: Research Phase (Parallel)
      console.log(chalk.yellow('📚 Phase 1: Research Phase (Parallel Execution)'));
      const researchStart = Date.now();
      
      const [requirements, azureServices, industryPatterns, compliance] = await Promise.all([
        this.executeWithLogging('Requirements Analysis', () => 
          this.requirementsAgent.analyze(caseStudyText)
        ),
        this.executeWithLogging('Azure Services Research', () => 
          this.azureServicesAgent.research(caseStudyText, 'initial-requirements')
        ),
        this.executeWithLogging('Industry Patterns Research', () => 
          this.industryPatternsAgent.research(caseStudyText, this.extractIndustry(caseStudyText))
        ),
        this.executeWithLogging('Compliance Research', () => 
          this.complianceAgent.analyze(caseStudyText)
        )
      ]);

      const researchTime = Date.now() - researchStart;
      console.log(chalk.green(`✅ Research Phase completed in ${researchTime}ms\n`));

      const researchData = { azureServices, industryPatterns, compliance };

      // Phase 2: Iterative Architecture Design & Review
      console.log(chalk.yellow('🏗️ Phase 2: Iterative Architecture Design & Review'));
      const designStart = Date.now();

      const architectureEvolution = await this.iterativeArchitectureDesign(
        caseStudyText,
        requirements,
        researchData
      );

      const designTime = Date.now() - designStart;
      const finalArchitecture = architectureEvolution[architectureEvolution.length - 1].architecture;

      // Phase 3: Cost Optimization with Review
      console.log(chalk.yellow('💰 Phase 3: Cost Optimization & Final Review'));
      const costStart = Date.now();

      const costAnalysis = await this.executeWithLogging('Cost Optimization', () =>
        this.costOptimizerAgent.optimize(finalArchitecture)
      );

      // Review cost optimization
      const costReview = await this.reviewerAgent.reviewCostOptimization(
        finalArchitecture,
        costAnalysis,
        'Cost analysis'
      );

      if (!costReview.approved && costReview.overallScore < 7) {
        console.log(chalk.yellow('🔄 Cost optimization needs refinement...'));
        // Could add cost refinement loop here
      }

      const reviewTime = Date.now() - costStart;

      // Phase 4: Final Risk Assessment
      console.log(chalk.yellow('⚠️ Phase 4: Risk Assessment'));
      const riskAssessment = await this.executeWithLogging('Risk Assessment', () =>
        this.riskAgent.assess(finalArchitecture, requirements)
      );

      const totalExecutionTime = Date.now() - workflowStart;

      console.log(chalk.green.bold(`\n🎉 Iterative Workflow Complete!`));
      console.log(chalk.green(`📊 Total time: ${totalExecutionTime}ms`));
      console.log(chalk.green(`🔄 Architecture iterations: ${architectureEvolution.length}`));

      return {
        requirements,
        researchData,
        architectureEvolution,
        finalArchitecture,
        costAnalysis,
        riskAssessment,
        workflowMetrics: {
          iterationsRequired: architectureEvolution.length,
          totalExecutionTime,
          researchTime,
          designTime,
          reviewTime
        }
      };

    } catch (error) {
      console.error(chalk.red('❌ Workflow failed:'), error);
      throw error;
    }
  }

  private async iterativeArchitectureDesign(
    caseStudyText: string,
    requirements: string,
    researchData: { azureServices: string; industryPatterns: string; compliance: string }
  ): Promise<{ version: number; architecture: string; reviewFeedback: ReviewFeedback }[]> {
    const architectureEvolution: { version: number; architecture: string; reviewFeedback: ReviewFeedback }[] = [];
    
    let currentArchitecture = '';
    let iteration = 1;

    while (iteration <= this.maxIterations) {
      console.log(chalk.cyan(`  🔄 Architecture Design Iteration ${iteration}`));

      // Design/refine architecture
      if (iteration === 1) {
        // Initial design
        currentArchitecture = await this.executeWithLogging(`Architecture Design V${iteration}`, () =>
          this.architectureAgent.design(caseStudyText, requirements, researchData)
        );
      } else {
        // Refinement based on previous feedback
        const previousFeedback = architectureEvolution[architectureEvolution.length - 1].reviewFeedback;
        currentArchitecture = await this.executeWithLogging(`Architecture Refinement V${iteration}`, () =>
          this.architectureAgent.refine(
            currentArchitecture,
            previousFeedback.detailedFeedback,
            previousFeedback.criticalIssues,
            previousFeedback.improvements
          )
        );
      }

      // Review the architecture
      const reviewFeedback = await this.executeWithLogging(`Architecture Review V${iteration}`, () =>
        this.reviewerAgent.review(caseStudyText, requirements, currentArchitecture, researchData)
      );

      architectureEvolution.push({
        version: iteration,
        architecture: currentArchitecture,
        reviewFeedback
      });

      console.log(chalk.blue(`    📊 Review Score: ${reviewFeedback.overallScore}/10`));
      console.log(chalk.blue(`    ✅ Approved: ${reviewFeedback.approved ? 'Yes' : 'No'}`));
      
      if (reviewFeedback.criticalIssues.length > 0) {
        console.log(chalk.red(`    🚨 Critical Issues: ${reviewFeedback.criticalIssues.length}`));
      }
      
      if (reviewFeedback.improvements.length > 0) {
        console.log(chalk.yellow(`    💡 Improvements: ${reviewFeedback.improvements.length}`));
      }

      // Check if we should continue iterating
      if (reviewFeedback.approved && reviewFeedback.overallScore >= 8) {
        console.log(chalk.green(`    ✅ Architecture approved! (Score: ${reviewFeedback.overallScore}/10)\n`));
        break;
      }

      if (iteration >= this.maxIterations) {
        console.log(chalk.orange(`    ⚠️ Max iterations reached. Using best version available.\n`));
        break;
      }

      if (reviewFeedback.criticalIssues.length === 0 && reviewFeedback.overallScore >= 7) {
        console.log(chalk.yellow(`    📋 Architecture is acceptable but could be improved. Continuing...\n`));
      } else {
        console.log(chalk.red(`    🔄 Critical issues found. Refining architecture...\n`));
      }

      iteration++;
    }

    return architectureEvolution;
  }

  private async executeWithLogging<T>(taskName: string, task: () => Promise<T>): Promise<T> {
    const start = Date.now();
    console.log(chalk.gray(`  ⏳ ${taskName}...`));
    
    try {
      const result = await task();
      const duration = Date.now() - start;
      console.log(chalk.green(`  ✅ ${taskName} completed (${duration}ms)`));
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      console.log(chalk.red(`  ❌ ${taskName} failed (${duration}ms): ${error}`));
      throw error;
    }
  }

  private extractIndustry(caseStudyText: string): string {
    const text = caseStudyText.toLowerCase();
    
    if (text.includes('retail') || text.includes('e-commerce') || text.includes('shopping')) {
      return 'retail';
    } else if (text.includes('healthcare') || text.includes('medical') || text.includes('hospital')) {
      return 'healthcare';
    } else if (text.includes('financial') || text.includes('banking') || text.includes('fintech')) {
      return 'financial';
    } else if (text.includes('manufacturing') || text.includes('factory') || text.includes('production')) {
      return 'manufacturing';
    } else if (text.includes('education') || text.includes('university') || text.includes('school')) {
      return 'education';
    } else if (text.includes('government') || text.includes('public sector')) {
      return 'government';
    }
    
    return 'enterprise';
  }

  // Backward compatibility method
  async coordinate(caseStudyText: string): Promise<string> {
    const result = await this.coordinateIterativeWorkflow(caseStudyText);
    
    // Format as traditional output for compatibility
    return `# Architecture Analysis Results

## Requirements Analysis
${result.requirements}

## Research Insights

### Azure Services Research
${result.researchData.azureServices}

### Industry Patterns Research  
${result.researchData.industryPatterns}

### Compliance Research
${result.researchData.compliance}

## Architecture Evolution

${result.architectureEvolution.map((evolution, index) => `
### Version ${evolution.version} (Score: ${evolution.reviewFeedback.overallScore}/10)
${evolution.architecture}

**Review Feedback:**
- Approved: ${evolution.reviewFeedback.approved ? 'Yes' : 'No'}
- Critical Issues: ${evolution.reviewFeedback.criticalIssues.length}
- Improvements Suggested: ${evolution.reviewFeedback.improvements.length}
`).join('\n')}

## Final Architecture
${result.finalArchitecture}

## Cost Analysis
${result.costAnalysis}

## Risk Assessment
${result.riskAssessment}

## Workflow Metrics
- Architecture Iterations: ${result.workflowMetrics.iterationsRequired}
- Total Execution Time: ${result.workflowMetrics.totalExecutionTime}ms
- Research Phase: ${result.workflowMetrics.researchTime}ms
- Design Phase: ${result.workflowMetrics.designTime}ms
- Review Phase: ${result.workflowMetrics.reviewTime}ms
`;
  }
}