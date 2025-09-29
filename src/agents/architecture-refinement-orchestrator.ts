/**
 * Architecture Refinement Orchestrator
 * 
 * PURPOSE: Iteratively refine architecture based on WAF feedback until optimal score is achieved
 * - Implements feedback loop between architecture design and WAF assessment
 * - Uses granular 0-100 scoring system for precise optimization
 * - Converges on optimal architecture through multiple iterations
 */

import OpenAI from 'openai';
import config from '../config/config.js';
import { WellArchitectedOrchestrator } from './well-architected-orchestrator.js';
import { ArchitectureAgent } from './architecture-agent.js';
import { promises as fs } from 'fs';
import { join } from 'path';

interface RefinementTask {
  id: string;
  type: 'architecture-refinement';
  priority: 'high' | 'medium' | 'low';
  payload: {
    caseStudy: string;
    requirements: string;
    businessContext?: string;
    complianceRequirements?: string;
    industryType?: string;
    targetWAFScore?: number;
    maxIterations?: number;
    caseStudyFolder?: string;
  };
}

interface IterationResult {
  iteration: number;
  architecture: string;
  wafScore: number;
  pillarScores: Record<string, number>;
  improvements: string[];
  criticalIssues: string[];
  converged: boolean;
  refinementReason: string;
}

interface RefinementResult {
  finalArchitecture: string;
  totalIterations: number;
  finalWAFScore: number;
  improvementHistory: IterationResult[];
  convergenceReason: string;
  optimizationSummary: string;
  recommendedNextSteps: string[];
}

export class ArchitectureRefinementOrchestrator {
  private client: OpenAI;
  private wafOrchestrator: WellArchitectedOrchestrator;
  private architectureAgent: ArchitectureAgent;

  // Refinement parameters
  private readonly DEFAULT_TARGET_SCORE = 85; // Out of 100
  private readonly MAX_ITERATIONS = 5;
  private readonly CONVERGENCE_THRESHOLD = 3; // Points improvement required to continue
  private readonly MINIMUM_IMPROVEMENT = 1; // Minimum points improvement per iteration

  constructor(client: OpenAI) {
    this.client = client;
    this.wafOrchestrator = new WellArchitectedOrchestrator(client);
    this.architectureAgent = new ArchitectureAgent(client);
  }

  async execute(task: RefinementTask): Promise<RefinementResult> {
    console.log('🔄 Starting iterative architecture refinement...');
    
    const targetScore = task.payload.targetWAFScore || this.DEFAULT_TARGET_SCORE;
    const maxIterations = task.payload.maxIterations || this.MAX_ITERATIONS;
    
    const iterations: IterationResult[] = [];
    let currentArchitecture = '';
    let bestScore = 0;
    let bestArchitecture = '';
    let converged = false;

    try {
      // Initial architecture design
      console.log('🏗️ Generating initial architecture design...');
      currentArchitecture = await this.generateInitialArchitecture(task.payload);
      
      for (let i = 1; i <= maxIterations && !converged; i++) {
        console.log(`\n🔍 Iteration ${i}/${maxIterations}: Assessing architecture...`);
        
        // Assess current architecture with WAF
        const wafAssessment = await this.assessArchitectureWithWAF(
          currentArchitecture,
          task.payload
        );

        const iterationResult: IterationResult = {
          iteration: i,
          architecture: currentArchitecture,
          wafScore: wafAssessment.overallScore,
          pillarScores: this.extractPillarScores(wafAssessment.pillarResults),
          improvements: wafAssessment.prioritizedRecommendations,
          criticalIssues: this.extractCriticalIssues(wafAssessment.pillarResults),
          converged: false,
          refinementReason: ''
        };

        iterations.push(iterationResult);

        console.log(`📊 WAF Score: ${wafAssessment.overallScore}/100`);
        console.log(`🎯 Target Score: ${targetScore}/100`);

        // Track best architecture
        if (wafAssessment.overallScore > bestScore) {
          bestScore = wafAssessment.overallScore;
          bestArchitecture = currentArchitecture;
        }

        // Check convergence conditions
        const convergenceResult = this.checkConvergence(
          iterations,
          wafAssessment.overallScore,
          targetScore,
          i,
          maxIterations
        );

        if (convergenceResult.converged) {
          iterationResult.converged = true;
          iterationResult.refinementReason = convergenceResult.reason;
          converged = true;
          console.log(`✅ Convergence achieved: ${convergenceResult.reason}`);
          break;
        }

        // Generate refined architecture if not converged
        if (i < maxIterations) {
          console.log(`🔧 Refining architecture based on WAF feedback...`);
          currentArchitecture = await this.refineArchitecture(
            currentArchitecture,
            wafAssessment,
            task.payload,
            i
          );
          iterationResult.refinementReason = this.generateRefinementReason(wafAssessment);
        }

        // Save iteration results
        if (task.payload.caseStudyFolder) {
          await this.saveIterationResults(iterationResult, task.payload.caseStudyFolder);
        }
      }

      // Use best architecture found
      const finalArchitecture = bestScore > 0 ? bestArchitecture : currentArchitecture;
      const finalScore = Math.max(bestScore, iterations[iterations.length - 1]?.wafScore || 0);

      const result: RefinementResult = {
        finalArchitecture,
        totalIterations: iterations.length,
        finalWAFScore: finalScore,
        improvementHistory: iterations,
        convergenceReason: converged ? 
          iterations[iterations.length - 1]?.refinementReason || 'Target achieved' :
          `Reached maximum iterations (${maxIterations})`,
        optimizationSummary: this.generateOptimizationSummary(iterations, finalScore, targetScore),
        recommendedNextSteps: this.generateNextSteps(iterations, finalScore, targetScore)
      };

      // Save final refinement report
      if (task.payload.caseStudyFolder) {
        await this.saveRefinementReport(result, task.payload.caseStudyFolder);
      }

      console.log(`🎉 Architecture refinement complete! Final score: ${finalScore}/100`);
      return result;

    } catch (error) {
      console.error('❌ Architecture refinement failed:', error);
      throw error;
    }
  }

  private async generateInitialArchitecture(payload: any): Promise<string> {
    const architectureTask = {
      id: 'initial-architecture',
      type: 'architecture-design' as const,
      priority: 'high' as const,
      payload: {
        caseStudy: payload.caseStudy,
        requirements: payload.requirements,
        businessContext: payload.businessContext,
        industryType: payload.industryType
      }
    };

    const result = await this.architectureAgent.execute(architectureTask);
    return result.detailedArchitecture;
  }

  private async assessArchitectureWithWAF(architecture: string, payload: any): Promise<any> {
    const wafTask = {
      id: 'waf-assessment',
      type: 'waf-comprehensive-assessment' as const,
      priority: 'high' as const,
      payload: {
        architecture,
        requirements: payload.requirements,
        businessContext: payload.businessContext,
        complianceRequirements: payload.complianceRequirements,
        industryType: payload.industryType
      }
    };

    return await this.wafOrchestrator.execute(wafTask);
  }

  private async refineArchitecture(
    currentArchitecture: string,
    wafAssessment: any,
    payload: any,
    iterationNumber: number
  ): Promise<string> {
    const refinementPrompt = this.buildRefinementPrompt(
      currentArchitecture,
      wafAssessment,
      payload,
      iterationNumber
    );

    const response = await this.client.chat.completions.create({
      model: config.getAzureConfig().foundry.modelDeploymentName,
      messages: [
        {
          role: 'system',
          content: `You are an Azure Solutions Architect specializing in iterative architecture refinement based on Well-Architected Framework feedback.

**REFINEMENT OBJECTIVES:**
1. Address specific WAF deficiencies identified in the assessment
2. Improve the overall WAF score from current ${wafAssessment.overallScore}/100
3. Focus on the lowest-scoring pillars and critical issues
4. Maintain business requirements while optimizing for WAF compliance
5. Provide specific Azure service recommendations with architectural changes

**OUTPUT REQUIREMENTS:**
- Return ONLY the refined architecture description
- Include specific Azure services and configurations
- Address each critical issue mentioned in the WAF assessment
- Maintain solution feasibility and cost-effectiveness
- Keep changes focused and incremental (not complete redesign)`
        },
        {
          role: 'user',
          content: refinementPrompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.2
    });

    return response.choices[0]?.message?.content || currentArchitecture;
  }

  private buildRefinementPrompt(
    architecture: string,
    wafAssessment: any,
    payload: any,
    iteration: number
  ): string {
    const criticalIssues = this.extractCriticalIssues(wafAssessment.pillarResults);
    const lowestPillar = this.getLowestScoringPillar(wafAssessment.pillarResults);
    
    return `**ITERATION ${iteration} ARCHITECTURE REFINEMENT**

**CURRENT ARCHITECTURE:**
${architecture}

**WAF ASSESSMENT RESULTS:**
- Overall Score: ${wafAssessment.overallScore}/100
- Lowest Scoring Pillar: ${lowestPillar.name} (${lowestPillar.score}/100)

**CRITICAL ISSUES TO ADDRESS:**
${criticalIssues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

**PRIORITIZED RECOMMENDATIONS:**
${wafAssessment.prioritizedRecommendations.slice(0, 5).map((rec: string, i: number) => `${i + 1}. ${rec}`).join('\n')}

**PILLAR-SPECIFIC FEEDBACK:**
${wafAssessment.pillarResults.map((pillar: any) => 
  `- **${pillar.pillarName}** (${pillar.score}/100): ${pillar.recommendations.slice(0, 2).join(', ')}`
).join('\n')}

**BUSINESS REQUIREMENTS (MAINTAIN):**
${payload.requirements}

**REFINEMENT INSTRUCTIONS:**
1. Address the lowest-scoring pillar (${lowestPillar.name}) with specific Azure service changes
2. Resolve critical issues through architectural modifications
3. Implement top 3 prioritized recommendations
4. Ensure all changes align with business requirements
5. Provide a refined architecture that improves the WAF score by at least 5 points

Provide the refined architecture with specific Azure services, configurations, and architectural patterns.`;
  }

  private extractPillarScores(pillarResults: any[]): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const pillar of pillarResults) {
      scores[pillar.pillarName] = pillar.score;
    }
    return scores;
  }

  private extractCriticalIssues(pillarResults: any[]): string[] {
    const allIssues: string[] = [];
    for (const pillar of pillarResults) {
      if (pillar.criticalIssues && pillar.criticalIssues.length > 0) {
        allIssues.push(...pillar.criticalIssues);
      }
    }
    return allIssues.slice(0, 10); // Top 10 critical issues
  }

  private getLowestScoringPillar(pillarResults: any[]): { name: string; score: number } {
    let lowest = { name: 'Unknown', score: 100 };
    for (const pillar of pillarResults) {
      if (pillar.score < lowest.score) {
        lowest = { name: pillar.pillarName, score: pillar.score };
      }
    }
    return lowest;
  }

  private checkConvergence(
    iterations: IterationResult[],
    currentScore: number,
    targetScore: number,
    currentIteration: number,
    maxIterations: number
  ): { converged: boolean; reason: string } {
    
    // Target achieved
    if (currentScore >= targetScore) {
      return { converged: true, reason: `Target score achieved (${currentScore}/${targetScore})` };
    }

    // Maximum iterations reached
    if (currentIteration >= maxIterations) {
      return { converged: true, reason: `Maximum iterations reached (${maxIterations})` };
    }

    // Check for improvement stagnation (last 2 iterations)
    if (iterations.length >= 2) {
      const lastScore = iterations[iterations.length - 2].wafScore;
      const improvement = currentScore - lastScore;
      
      if (improvement < this.MINIMUM_IMPROVEMENT) {
        return { 
          converged: true, 
          reason: `Insufficient improvement (${improvement} points, minimum: ${this.MINIMUM_IMPROVEMENT})` 
        };
      }
    }

    // High score reached (diminishing returns)
    if (currentScore >= 90) {
      return { converged: true, reason: `Excellent score achieved (${currentScore}/100)` };
    }

    return { converged: false, reason: '' };
  }

  private generateRefinementReason(wafAssessment: any): string {
    const lowestPillar = this.getLowestScoringPillar(wafAssessment.pillarResults);
    const criticalCount = this.extractCriticalIssues(wafAssessment.pillarResults).length;
    
    return `Addressing ${lowestPillar.name} pillar (${lowestPillar.score}/100) and ${criticalCount} critical issues`;
  }

  private generateOptimizationSummary(
    iterations: IterationResult[],
    finalScore: number,
    targetScore: number
  ): string {
    if (iterations.length === 0) return 'No iterations completed';

    const initialScore = iterations[0].wafScore;
    const improvement = finalScore - initialScore;
    const targetAchieved = finalScore >= targetScore;

    return `Architecture optimization ${targetAchieved ? 'successful' : 'partially successful'}:
- Initial Score: ${initialScore}/100
- Final Score: ${finalScore}/100
- Improvement: +${improvement} points
- Target: ${targetScore}/100 ${targetAchieved ? '✅' : '❌'}
- Iterations: ${iterations.length}`;
  }

  private generateNextSteps(
    iterations: IterationResult[],
    finalScore: number,
    targetScore: number
  ): string[] {
    const nextSteps: string[] = [];

    if (finalScore < targetScore) {
      nextSteps.push(`Continue optimization to reach target score of ${targetScore}/100`);
      
      // Find remaining critical issues
      const lastIteration = iterations[iterations.length - 1];
      if (lastIteration && lastIteration.criticalIssues.length > 0) {
        nextSteps.push('Address remaining critical issues: ' + lastIteration.criticalIssues.slice(0, 3).join(', '));
      }
    }

    if (finalScore >= 85) {
      nextSteps.push('Proceed with implementation planning');
      nextSteps.push('Conduct detailed cost analysis');
      nextSteps.push('Plan proof-of-concept deployment');
    } else if (finalScore >= 70) {
      nextSteps.push('Focus on security and reliability improvements');
      nextSteps.push('Review compliance requirements');
    } else {
      nextSteps.push('Consider fundamental architecture changes');
      nextSteps.push('Engage Azure architects for design review');
    }

    return nextSteps;
  }

  private async saveIterationResults(
    iteration: IterationResult,
    caseStudyFolder: string
  ): Promise<void> {
    const filename = `iteration-${iteration.iteration}-results.json`;
    const filepath = join('output', caseStudyFolder, 'refinement', filename);
    
    await fs.mkdir(join('output', caseStudyFolder, 'refinement'), { recursive: true });
    
    await fs.writeFile(
      filepath,
      JSON.stringify(iteration, null, 2),
      'utf-8'
    );
  }

  private async saveRefinementReport(
    result: RefinementResult,
    caseStudyFolder: string
  ): Promise<void> {
    const reportContent = this.formatRefinementReport(result);
    const filename = `architecture-refinement-report-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)}.md`;
    const filepath = join('output', caseStudyFolder, filename);
    
    await fs.writeFile(filepath, reportContent, 'utf-8');
    console.log(`📄 Refinement report saved: ${filename}`);
  }

  private formatRefinementReport(result: RefinementResult): string {
    const iterationSummary = result.improvementHistory.map(iter => 
      `**Iteration ${iter.iteration}**: ${iter.wafScore}/100 - ${iter.refinementReason}`
    ).join('\n');

    return `# Architecture Refinement Report
Generated: ${new Date().toISOString()}

## Executive Summary
${result.optimizationSummary}

## Refinement Process
- **Total Iterations**: ${result.totalIterations}
- **Final WAF Score**: ${result.finalWAFScore}/100
- **Convergence Reason**: ${result.convergenceReason}

## Iteration History
${iterationSummary}

## Final Optimized Architecture
${result.finalArchitecture}

## Recommended Next Steps
${result.recommendedNextSteps.map(step => `- ${step}`).join('\n')}

## Detailed Iteration Analysis
${result.improvementHistory.map(iter => this.formatIterationDetails(iter)).join('\n\n---\n\n')}

---
*Generated by Architecture Refinement Orchestrator*
*Optimized for Azure Well-Architected Framework compliance*
`;
  }

  private formatIterationDetails(iteration: IterationResult): string {
    const pillarScoresList = Object.entries(iteration.pillarScores)
      .map(([pillar, score]) => `- ${pillar}: ${score}/100`)
      .join('\n');

    return `### Iteration ${iteration.iteration}
**WAF Score**: ${iteration.wafScore}/100
**Status**: ${iteration.converged ? 'Converged' : 'Continuing'}

**Pillar Scores**:
${pillarScoresList}

**Critical Issues** (${iteration.criticalIssues.length}):
${iteration.criticalIssues.slice(0, 5).map(issue => `- ${issue}`).join('\n')}

**Key Improvements**:
${iteration.improvements.slice(0, 3).map(imp => `- ${imp}`).join('\n')}

**Architecture** (Preview):
${iteration.architecture.substring(0, 500)}...`;
  }
}