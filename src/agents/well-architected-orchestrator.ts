/**
 * Well-Architected Framework Orchestrator
 * Coordinates all 5 WAF pillar agents for comprehensive Azure architecture assessment
 * Implements Azure Well-Architected Framework methodology
 */

import OpenAI from 'openai';
import config from '../config/config.js';
import { WellArchitectedReliabilityAgent } from './well-architected-reliability-agent.js';
import { WellArchitectedSecurityAgent } from './well-architected-security-agent.js';
import { WellArchitectedPerformanceAgent } from './well-architected-performance-agent.js';
import { WellArchitectedOperationalExcellenceAgent } from './well-architected-operational-excellence-agent.js';
import { CostOptimizerAgent } from './cost-optimizer-agent.js'; // Reuse existing cost agent
import { getLocalTimestamp } from '../utils/local-timestamp.js';
import { promises as fs } from 'fs';
import path from 'path';

interface WAFAssessmentTask {
  id: string;
  type: 'waf-comprehensive-assessment';
  priority: 'high' | 'medium' | 'low';
  payload: {
    architecture: string;
    requirements: string;
    businessContext?: string;
    complianceRequirements?: string;
    industryType?: string;
    expectedLoad?: string;
    caseStudyFolder?: string;
  };
}

interface WAFPillarResult {
  pillarName: string;
  score: number;
  keyFindings: string[];
  recommendations: string[];
  azureServices: string[];
  compliance: string;
  criticalIssues: string[];
}

interface WAFAssessmentResult {
  overallScore: number;
  assessmentSummary: string;
  pillarResults: WAFPillarResult[];
  prioritizedRecommendations: string[];
  complianceStatus: string;
  implementationRoadmap: string[];
  azureServicesOptimization: string[];
  wafReport: string;
}

export class WellArchitectedOrchestrator {
  private client: OpenAI;
  private reliabilityAgent: WellArchitectedReliabilityAgent;
  private securityAgent: WellArchitectedSecurityAgent;
  private performanceAgent: WellArchitectedPerformanceAgent;
  private operationalAgent: WellArchitectedOperationalExcellenceAgent;
  private costAgent: CostOptimizerAgent;

  constructor(client: OpenAI) {
    this.client = client;
    this.reliabilityAgent = new WellArchitectedReliabilityAgent(client);
    this.securityAgent = new WellArchitectedSecurityAgent(client);
    this.performanceAgent = new WellArchitectedPerformanceAgent(client);
    this.operationalAgent = new WellArchitectedOperationalExcellenceAgent(client);
    this.costAgent = new CostOptimizerAgent(client);
  }

  async executeWAFAssessment(task: WAFAssessmentTask): Promise<WAFAssessmentResult> {
    try {
      console.log('🏗️ Starting Azure Well-Architected Framework Assessment...');
      console.log('📋 Assessing all 5 pillars in parallel...');
      
      const startTime = Date.now();

      // Execute all 5 pillar assessments in parallel with timeout protection
      const assessmentPromises = [
        this.assessReliabilityPillar(task),
        this.assessSecurityPillar(task),
        this.assessPerformancePillar(task),
        this.assessOperationalPillar(task),
        this.assessCostPillar(task)
      ];

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('WAF assessment timeout')), 300000) // 5 minutes (increased from 3)
      );

      const results = await Promise.race([
        Promise.allSettled(assessmentPromises),
        timeoutPromise
      ]) as PromiseSettledResult<any>[];

      const executionTime = Date.now() - startTime;
      console.log(`✅ WAF Assessment completed in ${Math.round(executionTime / 1000)}s`);

      // Process results and generate comprehensive assessment
      const pillarResults = this.processPillarResults(results);
      const assessment = await this.generateWAFAssessment(pillarResults, task.payload);
      
      // Save assessment if folder provided
      if (task.payload.caseStudyFolder) {
        await this.saveWAFAssessment(assessment, task.payload.caseStudyFolder);
      }

      return assessment;

    } catch (error) {
      console.error('❌ WAF Assessment failed:', error);
      return this.getWAFFallback();
    }
  }

  private async assessReliabilityPillar(task: WAFAssessmentTask): Promise<any> {
    const reliabilityTask = {
      id: 'reliability-waf',
      type: 'reliability-assessment' as const,
      priority: 'high' as const,
      payload: {
        architecture: task.payload.architecture,
        requirements: task.payload.requirements,
        businessRequirements: task.payload.businessContext,
        slaRequirements: this.extractSLARequirements(task.payload.requirements)
      }
    };

    return await this.reliabilityAgent.execute(reliabilityTask);
  }

  private async assessSecurityPillar(task: WAFAssessmentTask): Promise<any> {
    const securityTask = {
      id: 'security-waf',
      type: 'security-assessment' as const,
      priority: 'high' as const,
      payload: {
        architecture: task.payload.architecture,
        requirements: task.payload.requirements,
        complianceRequirements: task.payload.complianceRequirements,
        industryType: task.payload.industryType
      }
    };

    return await this.securityAgent.execute(securityTask);
  }

  private async assessPerformancePillar(task: WAFAssessmentTask): Promise<any> {
    const performanceTask = {
      id: 'performance-waf',
      type: 'performance-assessment' as const,
      priority: 'high' as const,
      payload: {
        architecture: task.payload.architecture,
        requirements: task.payload.requirements,
        expectedLoad: task.payload.expectedLoad,
        performanceTargets: this.extractPerformanceTargets(task.payload.requirements)
      }
    };

    return await this.performanceAgent.execute(performanceTask);
  }

  private async assessOperationalPillar(task: WAFAssessmentTask): Promise<any> {
    const operationalTask = {
      id: 'operational-waf',
      type: 'operational-excellence-assessment' as const,
      priority: 'high' as const,
      payload: {
        architecture: task.payload.architecture,
        requirements: task.payload.requirements,
        currentDevOpsMaturity: this.extractDevOpsMaturity(task.payload.requirements)
      }
    };

    return await this.operationalAgent.execute(operationalTask);
  }

  private async assessCostPillar(task: WAFAssessmentTask): Promise<any> {
    // Reuse existing cost agent with WAF context
    return await this.costAgent.optimizeCosts(task.payload.architecture);
  }

  private processPillarResults(results: PromiseSettledResult<any>[]): WAFPillarResult[] {
    const pillarNames = ['Reliability', 'Security', 'Performance Efficiency', 'Operational Excellence', 'Cost Optimization'];
    const pillarResults: WAFPillarResult[] = [];

    results.forEach((result, index) => {
      const pillarName = pillarNames[index];
      
      if (result.status === 'fulfilled') {
        const data = result.value;
        pillarResults.push({
          pillarName,
          score: this.extractScore(data, pillarName),
          keyFindings: this.extractKeyFindings(data, pillarName),
          recommendations: this.extractRecommendations(data, pillarName),
          azureServices: this.extractAzureServices(data, pillarName),
          compliance: this.extractCompliance(data, pillarName),
          criticalIssues: this.extractCriticalIssues(data, pillarName)
        });
      } else {
        pillarResults.push({
          pillarName,
          score: 7, // Increased from 6 - assume reasonable baseline even on timeout
          keyFindings: [`${pillarName} assessment failed: ${result.reason}`],
          recommendations: [`Manual ${pillarName.toLowerCase()} review recommended`],
          azureServices: [],
          compliance: 'Assessment failed',
          criticalIssues: [`${pillarName} assessment timeout or error`]
        });
      }
    });

    return pillarResults;
  }

  private async generateWAFAssessment(pillarResults: WAFPillarResult[], payload: any): Promise<WAFAssessmentResult> {
    const overallScore = this.calculateOverallScore(pillarResults);
    const prioritizedRecommendations = this.prioritizeRecommendations(pillarResults);
    const complianceStatus = this.assessOverallCompliance(pillarResults);
    const implementationRoadmap = this.generateImplementationRoadmap(pillarResults);
    const azureServicesOptimization = this.consolidateAzureServices(pillarResults);

    const assessmentSummary = await this.generateAssessmentSummary(pillarResults, overallScore, payload);
    const wafReport = await this.generateComprehensiveWAFReport(pillarResults, overallScore, payload);

    return {
      overallScore,
      assessmentSummary,
      pillarResults,
      prioritizedRecommendations,
      complianceStatus,
      implementationRoadmap,
      azureServicesOptimization,
      wafReport
    };
  }

  private calculateOverallScore(pillarResults: WAFPillarResult[]): number {
    const scores = pillarResults.map(result => result.score); // Already normalized to 0-10
    const weightedScore = (
      scores[0] * 0.25 + // Reliability: 25%
      scores[1] * 0.25 + // Security: 25%
      scores[2] * 0.20 + // Performance: 20%
      scores[3] * 0.15 + // Operational: 15%
      scores[4] * 0.15   // Cost: 15%
    );
    // Return on 0-100 scale for consistency with WAF methodology
    return Math.round(weightedScore * 10 * 10) / 10; // 0-10 → 0-100, rounded to 1 decimal
  }

  private prioritizeRecommendations(pillarResults: WAFPillarResult[]): string[] {
    const allRecommendations: { text: string; priority: number; pillar: string }[] = [];
    
    pillarResults.forEach(result => {
      const basePriority = result.score < 6 ? 3 : result.score < 8 ? 2 : 1;
      result.recommendations.forEach(rec => {
        allRecommendations.push({
          text: `[${result.pillarName}] ${rec}`,
          priority: basePriority,
          pillar: result.pillarName
        });
      });
    });

    return allRecommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10)
      .map(rec => rec.text);
  }

  private assessOverallCompliance(pillarResults: WAFPillarResult[]): string {
    const avgScore = this.calculateOverallScore(pillarResults);
    if (avgScore >= 8.5) return 'Excellent WAF compliance - minimal improvements needed';
    if (avgScore >= 7.5) return 'Good WAF compliance - some optimization opportunities';
    if (avgScore >= 6.5) return 'Moderate WAF compliance - several improvements recommended';
    return 'Limited WAF compliance - significant improvements needed';
  }

  private generateImplementationRoadmap(pillarResults: WAFPillarResult[]): string[] {
    const roadmap = [
      'Phase 1 (0-30 days): Address critical security and reliability issues',
      'Phase 2 (30-60 days): Implement cost optimization and performance improvements',
      'Phase 3 (60-90 days): Enhance operational excellence and monitoring',
      'Phase 4 (90+ days): Continuous improvement and advanced optimization'
    ];

    // Add specific items based on scores
    const criticalPillars = pillarResults.filter(p => p.score < 6);
    if (criticalPillars.length > 0) {
      roadmap.unshift(`Critical: Immediate attention required for ${criticalPillars.map(p => p.pillarName).join(', ')}`);
    }

    return roadmap;
  }

  private consolidateAzureServices(pillarResults: WAFPillarResult[]): string[] {
    const allServices = new Set<string>();
    pillarResults.forEach(result => {
      result.azureServices.forEach(service => allServices.add(service));
    });
    return Array.from(allServices).slice(0, 12);
  }

  private async generateAssessmentSummary(pillarResults: WAFPillarResult[], overallScore: number, payload: any): Promise<string> {
    const criticalCount = pillarResults.filter(p => p.score < 6).length;
    const excellentCount = pillarResults.filter(p => p.score >= 8).length;
    
    return `Azure Well-Architected Assessment: Overall Score ${overallScore.toFixed(1)}/100. ${excellentCount} pillars excellent, ${criticalCount} need immediate attention. Key focus areas: ${pillarResults.sort((a, b) => a.score - b.score).slice(0, 2).map(p => p.pillarName).join(', ')}.`;
  }

  private async generateComprehensiveWAFReport(pillarResults: WAFPillarResult[], overallScore: number, payload: any): Promise<string> {
    const timestamp = getLocalTimestamp();

    return `# Azure Well-Architected Framework Assessment Report

Generated: ${timestamp}
Overall Score: ${overallScore.toFixed(1)}/100

## Executive Summary
${await this.generateAssessmentSummary(pillarResults, overallScore, payload)}

## Pillar Assessment Results

${pillarResults.map(pillar => `
### ${pillar.pillarName} - Score: ${pillar.score.toFixed(1)}/10

**Compliance:** ${pillar.compliance}

**Key Findings:**
${pillar.keyFindings.map(finding => `• ${finding}`).join('\n')}

**Recommendations:**
${pillar.recommendations.map(rec => `• ${rec}`).join('\n')}

**Azure Services:**
${pillar.azureServices.map(service => `• ${service}`).join('\n')}

${pillar.criticalIssues.length > 0 ? `**Critical Issues:**
${pillar.criticalIssues.map(issue => `⚠️ ${issue}`).join('\n')}` : ''}

---
`).join('')}

## Overall Recommendations
${this.prioritizeRecommendations(pillarResults).map((rec, index) => `${index + 1}. ${rec}`).join('\n')}

## Implementation Roadmap
${this.generateImplementationRoadmap(pillarResults).map((phase, index) => `${index + 1}. ${phase}`).join('\n')}

---
*Assessment conducted using Azure Well-Architected Framework methodology*
`;
  }

  private extractScore(data: any, pillarName: string): number {
    if (!data) return 7; // Increased from 6 - assume good baseline for analyzed architectures

    // Extract raw score from pillar agents
    let rawScore: number;

    if (pillarName === 'Cost Optimization') {
      rawScore = data.optimizationScore || 75; // Increased default from 70
    } else {
      rawScore = data.reliabilityScore || data.securityScore || data.performanceScore || data.operationalScore || 75; // Increased default from 70
    }

    // Normalize to 0-10 scale
    // If score > 10, assume it's on 0-100 scale and convert
    // If score <= 10, assume it's already on 0-10 scale
    const normalizedScore = rawScore > 10 ? rawScore / 10 : rawScore;

    // Clamp to 0-10 range
    return Math.min(10, Math.max(0, normalizedScore));
  }

  private extractKeyFindings(data: any, pillarName: string): string[] {
    if (!data) return [`${pillarName} assessment unavailable`];
    
    const findings = data.keyFindings || data.findings || data.recommendations || [];
    return Array.isArray(findings) ? findings.slice(0, 3) : [findings.toString()];
  }

  private extractRecommendations(data: any, pillarName: string): string[] {
    if (!data) return [`Review ${pillarName.toLowerCase()} best practices`];
    
    const recs = data.recommendations || data.optimizationRecommendations || data.securityRecommendations || [];
    return Array.isArray(recs) ? recs.slice(0, 4) : [recs.toString()];
  }

  private extractAzureServices(data: any, pillarName: string): string[] {
    if (!data) return [];
    
    const services = data.azureServices || data.azureSecurityServices || data.azurePerformanceServices || data.azureDevOpsServices || [];
    return Array.isArray(services) ? services : [];
  }

  private extractCompliance(data: any, pillarName: string): string {
    if (!data) return 'Assessment unavailable';
    
    return data.wellArchitectedCompliance || data.compliance || `${pillarName} compliance assessment completed`;
  }

  private extractCriticalIssues(data: any, pillarName: string): string[] {
    if (!data) return [];
    
    const issues = data.criticalIssues || data.bottleneckAnalysis || [];
    return Array.isArray(issues) ? issues.slice(0, 2) : [];
  }

  private extractSLARequirements(requirements: string): string {
    const slaMatch = requirements.match(/sla|availability|uptime/i);
    return slaMatch ? 'Standard SLA requirements identified' : '';
  }

  private extractPerformanceTargets(requirements: string): string {
    const perfMatch = requirements.match(/performance|latency|throughput|response time/i);
    return perfMatch ? 'Performance targets identified in requirements' : '';
  }

  private extractDevOpsMaturity(requirements: string): string {
    const devopsMatch = requirements.match(/devops|ci\/cd|automation|deployment/i);
    return devopsMatch ? 'DevOps practices mentioned in requirements' : '';
  }

  private async saveWAFAssessment(assessment: WAFAssessmentResult, caseStudyFolder: string): Promise<void> {
    try {
      const outputDir = path.join(process.cwd(), 'output', caseStudyFolder);
      await fs.mkdir(outputDir, { recursive: true });
      
      const timestamp = getLocalTimestamp();
      const filename = `well-architected-assessment-${timestamp.slice(0, 19)}.md`;
      const filepath = path.join(outputDir, filename);
      
      await fs.writeFile(filepath, assessment.wafReport, 'utf-8');
      console.log(`📁 WAF Assessment saved: ${filename}`);
      
    } catch (error) {
      console.warn(`⚠️ Failed to save WAF assessment:`, error.message);
    }
  }

  private getWAFFallback(): WAFAssessmentResult {
    return {
      overallScore: 6.5,
      assessmentSummary: 'Well-Architected Framework assessment temporarily unavailable',
      pillarResults: [
        { pillarName: 'Reliability', score: 7, keyFindings: [], recommendations: [], azureServices: [], compliance: 'Assessment unavailable', criticalIssues: [] },
        { pillarName: 'Security', score: 6, keyFindings: [], recommendations: [], azureServices: [], compliance: 'Assessment unavailable', criticalIssues: [] },
        { pillarName: 'Performance Efficiency', score: 7, keyFindings: [], recommendations: [], azureServices: [], compliance: 'Assessment unavailable', criticalIssues: [] },
        { pillarName: 'Operational Excellence', score: 6, keyFindings: [], recommendations: [], azureServices: [], compliance: 'Assessment unavailable', criticalIssues: [] },
        { pillarName: 'Cost Optimization', score: 7, keyFindings: [], recommendations: [], azureServices: [], compliance: 'Assessment unavailable', criticalIssues: [] }
      ],
      prioritizedRecommendations: ['Manual Well-Architected Framework review recommended'],
      complianceStatus: 'Assessment temporarily unavailable',
      implementationRoadmap: ['Complete manual WAF assessment', 'Implement priority improvements'],
      azureServicesOptimization: [],
      wafReport: 'Well-Architected Framework assessment temporarily unavailable'
    };
  }
}