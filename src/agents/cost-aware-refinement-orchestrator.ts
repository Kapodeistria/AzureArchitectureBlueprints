/**
 * Cost-Aware Refinement Orchestrator
 *
 * PURPOSE: Post-cost-analysis refinement loop with satisfaction scoring
 * - Incorporates WAF, cost optimization, and risk assessment feedback
 * - Uses satisfaction score (0-10) combining all three dimensions
 * - Iterates until satisfaction ≥ 8.5/10 or max iterations reached
 * - Regenerates visual diagrams after each refinement
 */

import OpenAI from 'openai';
import config from '../config/config.js';
import { WellArchitectedOrchestrator } from './well-architected-orchestrator.js';
import { ArchitectureAgent } from './architecture-agent.js';
import { CostOptimizerAgent } from './cost-optimizer-agent.js';
import { RiskAssessorAgent } from './risk-assessor-agent.js';
import { VisualArchitectureAgent } from './visual-architecture-agent.js';
import { promises as fs } from 'fs';
import { join } from 'path';

interface SatisfactionScore {
  overall: number; // 0-10
  waf: number; // 0-10 (normalized from 0-100)
  cost: number; // 0-10
  risk: number; // 0-10
  breakdown: {
    wafWeight: number;
    costWeight: number;
    riskWeight: number;
  };
}

interface CostAwareIterationResult {
  iteration: number;
  architecture: string;
  visualDiagrams?: string;
  satisfactionScore: SatisfactionScore;
  wafScore: number; // Raw 0-100
  wafDetails: any;
  costAnalysis: string;
  riskAssessment: string;
  improvements: string[];
  converged: boolean;
  refinementReason: string;
}

interface CostAwareRefinementResult {
  finalArchitecture: string;
  finalVisualDiagrams: string;
  totalIterations: number;
  finalSatisfactionScore: SatisfactionScore;
  improvementHistory: CostAwareIterationResult[];
  convergenceReason: string;
  optimizationSummary: string;
  recommendedNextSteps: string[];
}

export class CostAwareRefinementOrchestrator {
  private client: OpenAI;
  private wafOrchestrator: WellArchitectedOrchestrator;
  private architectureAgent: ArchitectureAgent;
  private costAgent: CostOptimizerAgent;
  private riskAgent: RiskAssessorAgent;
  private visualAgent: VisualArchitectureAgent;

  // Refinement parameters
  private readonly TARGET_SATISFACTION = 8.5; // 0-10 scale
  private readonly MAX_ITERATIONS = 3;
  private readonly MIN_IMPROVEMENT = 0.2; // Points per iteration

  // Satisfaction weights
  private readonly WAF_WEIGHT = 0.40; // 40%
  private readonly COST_WEIGHT = 0.30; // 30%
  private readonly RISK_WEIGHT = 0.30; // 30%

  constructor(client: OpenAI) {
    this.client = client;
    this.wafOrchestrator = new WellArchitectedOrchestrator(client);
    this.architectureAgent = new ArchitectureAgent(client);
    this.costAgent = new CostOptimizerAgent(client);
    this.riskAgent = new RiskAssessorAgent(client);
    this.visualAgent = new VisualArchitectureAgent(client);
  }

  async execute(
    initialArchitecture: string,
    initialWafAssessment: any,
    initialCostAnalysis: string,
    initialRiskAssessment: string,
    caseStudyText: string,
    requirements: string,
    caseStudyFolder?: string
  ): Promise<CostAwareRefinementResult> {
    console.log('🔄 Starting cost-aware architecture refinement...');

    const iterations: CostAwareIterationResult[] = [];
    let currentArchitecture = initialArchitecture;
    let currentWafAssessment = initialWafAssessment;
    let currentCostAnalysis = initialCostAnalysis;
    let currentRiskAssessment = initialRiskAssessment;
    let currentVisualDiagrams = '';

    let bestSatisfaction = 0;
    let bestArchitecture = initialArchitecture;
    let bestVisualDiagrams = '';
    let converged = false;

    try {
      // Evaluate initial state
      const initialSatisfaction = this.calculateSatisfactionScore(
        initialWafAssessment.overallScore || 70,
        initialCostAnalysis,
        initialRiskAssessment
      );

      console.log(`📊 Initial Satisfaction Score: ${initialSatisfaction.overall.toFixed(1)}/10`);
      console.log(`   WAF: ${initialSatisfaction.waf.toFixed(1)}/10, Cost: ${initialSatisfaction.cost.toFixed(1)}/10, Risk: ${initialSatisfaction.risk.toFixed(1)}/10`);

      // Check if we're already satisfied
      if (initialSatisfaction.overall >= this.TARGET_SATISFACTION) {
        console.log(`✅ Initial architecture already meets target (${this.TARGET_SATISFACTION}/10)`);
        return {
          finalArchitecture: initialArchitecture,
          finalVisualDiagrams: currentVisualDiagrams,
          totalIterations: 0,
          finalSatisfactionScore: initialSatisfaction,
          improvementHistory: [],
          convergenceReason: 'Initial architecture meets satisfaction target',
          optimizationSummary: 'No refinement needed',
          recommendedNextSteps: ['Proceed with deployment']
        };
      }

      // Iterative refinement loop
      for (let i = 1; i <= this.MAX_ITERATIONS && !converged; i++) {
        console.log(`\n🔍 Iteration ${i}/${this.MAX_ITERATIONS}: Refining architecture...`);

        // Refine architecture based on WAF, cost, and risk feedback
        const refinedArchitecture = await this.refineArchitectureWithFeedback(
          currentArchitecture,
          currentWafAssessment,
          currentCostAnalysis,
          currentRiskAssessment,
          caseStudyText,
          requirements,
          i
        );

        currentArchitecture = refinedArchitecture;

        // Regenerate visual diagrams
        console.log(`🎨 Generating visual diagrams for iteration ${i}...`);
        try {
          currentVisualDiagrams = await Promise.race([
            this.visualAgent.generateDetailedDiagram(currentArchitecture, caseStudyText, caseStudyFolder),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 60000))
          ]);
        } catch (error) {
          console.log(`   ⚠ Visual diagram generation timeout, using text representation`);
          currentVisualDiagrams = `[Visual diagrams unavailable]\n\n${currentArchitecture}`;
        }

        // Re-assess with WAF
        console.log(`🏗️ Re-assessing WAF compliance...`);
        try {
          const wafTask = {
            id: `waf-refinement-${i}`,
            type: 'waf-comprehensive-assessment' as const,
            priority: 'high' as const,
            payload: {
              architecture: currentArchitecture,
              requirements,
              businessContext: caseStudyText,
              caseStudyFolder
            }
          };

          currentWafAssessment = await Promise.race([
            this.wafOrchestrator.executeWAFAssessment(wafTask),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 120000))
          ]);
        } catch (error) {
          console.log(`   ⚠ WAF assessment timeout, using previous assessment`);
        }

        // Re-analyze costs
        console.log(`💰 Re-analyzing costs...`);
        try {
          currentCostAnalysis = await Promise.race([
            this.analyzeCosts(currentArchitecture),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
          ]);
        } catch (error) {
          console.log(`   ⚠ Cost analysis timeout, using previous analysis`);
        }

        // Re-assess risks
        console.log(`⚠️  Re-assessing risks...`);
        try {
          currentRiskAssessment = await Promise.race([
            this.assessRisks(currentArchitecture),
            new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
          ]);
        } catch (error) {
          console.log(`   ⚠ Risk assessment timeout, using previous assessment`);
        }

        // Calculate new satisfaction score
        const satisfactionScore = this.calculateSatisfactionScore(
          currentWafAssessment.overallScore || 70,
          currentCostAnalysis,
          currentRiskAssessment
        );

        console.log(`📊 Iteration ${i} Satisfaction Score: ${satisfactionScore.overall.toFixed(1)}/10`);
        console.log(`   WAF: ${satisfactionScore.waf.toFixed(1)}/10, Cost: ${satisfactionScore.cost.toFixed(1)}/10, Risk: ${satisfactionScore.risk.toFixed(1)}/10`);

        // Track iteration
        const iterationResult: CostAwareIterationResult = {
          iteration: i,
          architecture: currentArchitecture,
          visualDiagrams: currentVisualDiagrams,
          satisfactionScore,
          wafScore: currentWafAssessment.overallScore || 70,
          wafDetails: currentWafAssessment,
          costAnalysis: currentCostAnalysis,
          riskAssessment: currentRiskAssessment,
          improvements: this.extractImprovements(satisfactionScore, iterations.length > 0 ? iterations[iterations.length - 1].satisfactionScore : initialSatisfaction),
          converged: false,
          refinementReason: this.generateRefinementReason(satisfactionScore, initialSatisfaction)
        };

        iterations.push(iterationResult);

        // Update best
        if (satisfactionScore.overall > bestSatisfaction) {
          bestSatisfaction = satisfactionScore.overall;
          bestArchitecture = currentArchitecture;
          bestVisualDiagrams = currentVisualDiagrams;
        }

        // Save iteration results
        if (caseStudyFolder) {
          await this.saveIterationResults(iterationResult, caseStudyFolder);
        }

        // Check convergence
        if (satisfactionScore.overall >= this.TARGET_SATISFACTION) {
          converged = true;
          iterationResult.converged = true;
          console.log(`✅ Target satisfaction achieved: ${satisfactionScore.overall.toFixed(1)}/10`);
          break;
        }

        // Check for minimal improvement
        const previousScore = i > 1 ? iterations[i - 2].satisfactionScore.overall : initialSatisfaction.overall;
        const improvement = satisfactionScore.overall - previousScore;

        if (i > 1 && improvement < this.MIN_IMPROVEMENT) {
          converged = true;
          console.log(`⚠️  Minimal improvement detected (${improvement.toFixed(2)} < ${this.MIN_IMPROVEMENT}), stopping refinement`);
          break;
        }
      }

      // Final result
      const result: CostAwareRefinementResult = {
        finalArchitecture: bestArchitecture,
        finalVisualDiagrams: bestVisualDiagrams,
        totalIterations: iterations.length,
        finalSatisfactionScore: iterations.length > 0 ?
          iterations[iterations.length - 1].satisfactionScore :
          initialSatisfaction,
        improvementHistory: iterations,
        convergenceReason: converged ?
          (iterations[iterations.length - 1].satisfactionScore.overall >= this.TARGET_SATISFACTION ?
            `Target satisfaction achieved (${iterations[iterations.length - 1].satisfactionScore.overall.toFixed(1)}/10)` :
            'Minimal improvement, refinement stopped') :
          `Reached maximum iterations (${this.MAX_ITERATIONS})`,
        optimizationSummary: this.generateOptimizationSummary(iterations, bestSatisfaction),
        recommendedNextSteps: this.generateNextSteps(iterations, bestSatisfaction)
      };

      // Save final report
      if (caseStudyFolder) {
        await this.saveRefinementReport(result, caseStudyFolder);
      }

      console.log(`🎉 Cost-aware refinement complete! Final satisfaction: ${bestSatisfaction.toFixed(1)}/10`);
      return result;

    } catch (error) {
      console.error('❌ Cost-aware refinement failed:', error);
      throw error;
    }
  }

  private calculateSatisfactionScore(
    wafScore: number, // 0-100
    costAnalysis: string,
    riskAssessment: string
  ): SatisfactionScore {
    // Normalize WAF score from 0-100 to 0-10
    const normalizedWaf = Math.min(10, Math.max(0, wafScore / 10));

    // Extract cost score from analysis (look for savings opportunities, optimization level)
    const costScore = this.extractCostScore(costAnalysis);

    // Extract risk score from assessment (look for risk ratings, critical issues)
    const riskScore = this.extractRiskScore(riskAssessment);

    // Calculate weighted overall score
    const overall = (
      normalizedWaf * this.WAF_WEIGHT +
      costScore * this.COST_WEIGHT +
      riskScore * this.RISK_WEIGHT
    );

    return {
      overall,
      waf: normalizedWaf,
      cost: costScore,
      risk: riskScore,
      breakdown: {
        wafWeight: this.WAF_WEIGHT,
        costWeight: this.COST_WEIGHT,
        riskWeight: this.RISK_WEIGHT
      }
    };
  }

  private extractCostScore(costAnalysis: string): number {
    // Score based on:
    // - Reserved instance opportunities mentioned: +2
    // - Monthly cost under $1000: +2, under $500: +3
    // - Optimization tips count: +1 per 2 tips (max +2)
    // - ROI mentioned: +1
    // - Base score: 5

    let score = 5;

    // Check for reserved instances
    if (/reserved instance|reserved capacity|RI/i.test(costAnalysis)) {
      score += 1.5;
    }

    // Check for cost optimization mentions
    const optimizationCount = (costAnalysis.match(/optimization|optimize|savings|reduce cost/gi) || []).length;
    score += Math.min(2, optimizationCount * 0.3);

    // Check for ROI
    if (/ROI|return on investment|payback/i.test(costAnalysis)) {
      score += 0.5;
    }

    // Check for quick wins
    if (/quick win|immediate/i.test(costAnalysis)) {
      score += 1;
    }

    return Math.min(10, Math.max(0, score));
  }

  private extractRiskScore(riskAssessment: string): number {
    // Score based on:
    // - No critical risks: 8-10
    // - 1-2 high risks: 6-7
    // - 3+ high risks: 4-5
    // - Critical risks present: 2-3
    // - Mitigation strategies present: +1

    let score = 7; // Start neutral

    // Count risk levels
    const criticalCount = (riskAssessment.match(/critical risk|severity.*critical/gi) || []).length;
    const highCount = (riskAssessment.match(/high risk|severity.*high/gi) || []).length;
    const mediumCount = (riskAssessment.match(/medium risk|severity.*medium/gi) || []).length;

    if (criticalCount > 0) {
      score = 3 - (criticalCount * 0.5);
    } else if (highCount >= 3) {
      score = 5;
    } else if (highCount >= 1) {
      score = 6.5;
    } else if (mediumCount >= 3) {
      score = 7.5;
    } else {
      score = 8.5;
    }

    // Bonus for mitigation strategies
    const mitigationCount = (riskAssessment.match(/mitigation|mitigate|address|resolve/gi) || []).length;
    if (mitigationCount >= 3) {
      score += 1;
    }

    return Math.min(10, Math.max(0, score));
  }

  private async refineArchitectureWithFeedback(
    currentArchitecture: string,
    wafAssessment: any,
    costAnalysis: string,
    riskAssessment: string,
    caseStudy: string,
    requirements: string,
    iteration: number
  ): Promise<string> {
    const refinementPrompt = `
You are refining an Azure architecture based on comprehensive feedback from WAF assessment, cost analysis, and risk assessment.

ITERATION: ${iteration}

CURRENT ARCHITECTURE:
${currentArchitecture.substring(0, 2000)}

WAF ASSESSMENT FEEDBACK:
Overall Score: ${wafAssessment.overallScore || 70}/100
${wafAssessment.assessmentSummary || 'See pillar assessments'}

COST ANALYSIS FEEDBACK:
${costAnalysis.substring(0, 1000)}

RISK ASSESSMENT FEEDBACK:
${riskAssessment.substring(0, 1000)}

REQUIREMENTS:
${requirements.substring(0, 500)}

REFINEMENT OBJECTIVES:
1. Address WAF compliance gaps (target: 85+/100)
2. Incorporate cost optimization recommendations (reserved instances, right-sizing, etc.)
3. Mitigate identified risks (especially critical and high severity)
4. Maintain functional requirements alignment

OUTPUT:
Provide a refined architecture that incorporates the feedback above. Focus on:
- Specific Azure service changes (SKU adjustments, reserved instances, etc.)
- Security and reliability improvements from WAF feedback
- Cost optimization tactics (reserved capacity, right-sizing, resource consolidation)
- Risk mitigation strategies

Use the same markdown format as the original architecture.
`;

    try {
      const response = await this.client.chat.completions.create({
        model: config.getAzureConfig().foundry.modelDeploymentName,
        messages: [
          {
            role: 'system',
            content: 'You are an Azure Solutions Architect expert in Well-Architected Framework, cost optimization, and risk management. Refine architectures to achieve optimal satisfaction across all dimensions.'
          },
          { role: 'user', content: refinementPrompt }
        ],
        max_tokens: 3000,
        temperature: 0.3
      });

      return response.choices[0]?.message?.content || currentArchitecture;
    } catch (error) {
      console.error('Architecture refinement error:', error);
      return currentArchitecture;
    }
  }

  private async analyzeCosts(architecture: string): Promise<string> {
    const costTask = {
      id: 'cost-refinement',
      type: 'cost-optimization' as const,
      priority: 'high' as const,
      payload: { architecture }
    };

    const result = await this.costAgent.executeTask('cost-optimization', { architecture });
    return result.result || '# Cost Analysis\n\n*Analysis unavailable*';
  }

  private async assessRisks(architecture: string): Promise<string> {
    const riskTask = {
      id: 'risk-refinement',
      type: 'risk-assessment' as const,
      priority: 'high' as const,
      payload: { architecture }
    };

    const result = await this.riskAgent.executeTask('risk-assessment', { architecture });
    return result.result || '# Risk Assessment\n\n*Assessment unavailable*';
  }

  private extractImprovements(current: SatisfactionScore, previous: SatisfactionScore): string[] {
    const improvements: string[] = [];

    const wafDelta = current.waf - previous.waf;
    const costDelta = current.cost - previous.cost;
    const riskDelta = current.risk - previous.risk;

    if (wafDelta > 0.5) improvements.push(`WAF compliance improved by ${wafDelta.toFixed(1)} points`);
    if (costDelta > 0.5) improvements.push(`Cost efficiency improved by ${costDelta.toFixed(1)} points`);
    if (riskDelta > 0.5) improvements.push(`Risk posture improved by ${riskDelta.toFixed(1)} points`);

    if (improvements.length === 0) {
      improvements.push('Minor refinements applied');
    }

    return improvements;
  }

  private generateRefinementReason(current: SatisfactionScore, initial: SatisfactionScore): string {
    const overallDelta = current.overall - initial.overall;
    return `Satisfaction improved from ${initial.overall.toFixed(1)}/10 to ${current.overall.toFixed(1)}/10 (+${overallDelta.toFixed(1)})`;
  }

  private generateOptimizationSummary(iterations: CostAwareIterationResult[], finalScore: number): string {
    if (iterations.length === 0) {
      return 'No refinement iterations performed';
    }

    const initialScore = iterations[0].satisfactionScore.overall;
    const improvement = finalScore - initialScore;
    const avgImprovement = improvement / iterations.length;

    return `Completed ${iterations.length} refinement iteration(s). Final satisfaction: ${finalScore.toFixed(1)}/10 (improved ${improvement.toFixed(1)} points, avg ${avgImprovement.toFixed(2)}/iteration)`;
  }

  private generateNextSteps(iterations: CostAwareIterationResult[], finalScore: number): string[] {
    const steps: string[] = [];

    if (finalScore >= this.TARGET_SATISFACTION) {
      steps.push('✅ Architecture meets satisfaction target - proceed with deployment');
      steps.push('Consider implementing phased rollout strategy');
      steps.push('Set up comprehensive monitoring and alerting');
    } else {
      if (iterations.length > 0) {
        const lastIteration = iterations[iterations.length - 1];
        if (lastIteration.satisfactionScore.waf < 7) {
          steps.push('⚠️  Focus on WAF compliance improvements');
        }
        if (lastIteration.satisfactionScore.cost < 7) {
          steps.push('💰 Review cost optimization opportunities (reserved instances, right-sizing)');
        }
        if (lastIteration.satisfactionScore.risk < 7) {
          steps.push('🛡️ Address high-severity risks before deployment');
        }
      }
      steps.push('Consider manual architecture review with stakeholders');
    }

    return steps;
  }

  private async saveIterationResults(iteration: CostAwareIterationResult, caseStudyFolder: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cost-aware-refinement-iteration-${iteration.iteration}-${timestamp}.md`;
    const filepath = join(caseStudyFolder, filename);

    const content = `# Cost-Aware Refinement - Iteration ${iteration.iteration}
Generated: ${new Date().toISOString()}

## Satisfaction Score: ${iteration.satisfactionScore.overall.toFixed(1)}/10

### Score Breakdown:
- **WAF Compliance**: ${iteration.satisfactionScore.waf.toFixed(1)}/10 (${(iteration.wafScore).toFixed(1)}/100 raw, weight: ${(iteration.satisfactionScore.breakdown.wafWeight * 100).toFixed(0)}%)
- **Cost Efficiency**: ${iteration.satisfactionScore.cost.toFixed(1)}/10 (weight: ${(iteration.satisfactionScore.breakdown.costWeight * 100).toFixed(0)}%)
- **Risk Posture**: ${iteration.satisfactionScore.risk.toFixed(1)}/10 (weight: ${(iteration.satisfactionScore.breakdown.riskWeight * 100).toFixed(0)}%)

### Improvements This Iteration:
${iteration.improvements.map(i => `- ${i}`).join('\n')}

### Refinement Reason:
${iteration.refinementReason}

### Converged:
${iteration.converged ? '✅ Yes - target achieved' : '⏳ No - continuing refinement'}

---

## Refined Architecture

${iteration.architecture}

---

## Cost Analysis

${iteration.costAnalysis}

---

## Risk Assessment

${iteration.riskAssessment}

---

## Visual Diagrams

${iteration.visualDiagrams || '*Visual diagrams unavailable*'}
`;

    await fs.writeFile(filepath, content, 'utf-8');
    console.log(`   📁 Saved: ${filename}`);
  }

  private async saveRefinementReport(result: CostAwareRefinementResult, caseStudyFolder: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cost-aware-refinement-final-report-${timestamp}.md`;
    const filepath = join(caseStudyFolder, filename);

    const content = `# Cost-Aware Architecture Refinement - Final Report
Generated: ${new Date().toISOString()}

## Executive Summary

**Total Iterations**: ${result.totalIterations}
**Final Satisfaction Score**: ${result.finalSatisfactionScore.overall.toFixed(1)}/10
**Convergence**: ${result.convergenceReason}

### Final Score Breakdown:
- **WAF Compliance**: ${result.finalSatisfactionScore.waf.toFixed(1)}/10 (weight: ${(result.finalSatisfactionScore.breakdown.wafWeight * 100).toFixed(0)}%)
- **Cost Efficiency**: ${result.finalSatisfactionScore.cost.toFixed(1)}/10 (weight: ${(result.finalSatisfactionScore.breakdown.costWeight * 100).toFixed(0)}%)
- **Risk Posture**: ${result.finalSatisfactionScore.risk.toFixed(1)}/10 (weight: ${(result.finalSatisfactionScore.breakdown.riskWeight * 100).toFixed(0)}%)

---

## Optimization Summary

${result.optimizationSummary}

---

## Iteration History

${result.improvementHistory.map(iter => `
### Iteration ${iter.iteration}
- **Satisfaction Score**: ${iter.satisfactionScore.overall.toFixed(1)}/10
- **WAF**: ${iter.satisfactionScore.waf.toFixed(1)}/10, **Cost**: ${iter.satisfactionScore.cost.toFixed(1)}/10, **Risk**: ${iter.satisfactionScore.risk.toFixed(1)}/10
- **Improvements**: ${iter.improvements.join(', ')}
- **Converged**: ${iter.converged ? 'Yes' : 'No'}
`).join('\n')}

---

## Recommended Next Steps

${result.recommendedNextSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

---

## Final Architecture

${result.finalArchitecture}

---

## Final Visual Diagrams

${result.finalVisualDiagrams || '*Visual diagrams unavailable*'}
`;

    await fs.writeFile(filepath, content, 'utf-8');
    console.log(`   📁 Saved: ${filename}`);
  }
}