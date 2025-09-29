/**
 * WAF Research Orchestrator Agent
 * Coordinates 6 specialized WAF research agents for comprehensive Microsoft Well-Architected Framework intelligence
 */

import OpenAI from 'openai';
import config from '../config/config.js';

interface ResearchTask {
  id: string;
  agentName: string;
  prompt: string;
  timeLimit: number; // in milliseconds
  priority: 'high' | 'medium' | 'low';
}

interface ResearchResult {
  agentName: string;
  findings: string;
  executionTime: number;
  status: 'completed' | 'timeout' | 'error';
  keyInsights: string[];
  caseStudies: string[];
}

export class ResearchOrchestratorAgent {
  private client: OpenAI;
  private researchAgents: Map<string, ResearchTask>;

  constructor(client: OpenAI) {
    this.client = client;
    this.initializeResearchAgents();
  }

  private initializeResearchAgents() {
    this.researchAgents = new Map([
      ['waf-infrastructure-regional', {
        id: 'waf-infra-001',
        agentName: 'Infrastructure & Regional WAF Compliance Agent',
        prompt: this.getWAFInfrastructureResearchPrompt(),
        timeLimit: 45000, // 45 seconds
        priority: 'high'
      }],
      ['waf-ai-ml-innovation', {
        id: 'waf-ai-002',
        agentName: 'AI/ML Well-Architected Patterns Agent', 
        prompt: this.getWAFAIMLResearchPrompt(),
        timeLimit: 45000, // 45 seconds
        priority: 'high'
      }],
      ['waf-enterprise-cases', {
        id: 'waf-ent-003',
        agentName: 'Enterprise WAF Case Studies Agent',
        prompt: this.getWAFEnterpriseResearchPrompt(),
        timeLimit: 50000, // 50 seconds
        priority: 'high'
      }],
      ['waf-compliance-sovereignty', {
        id: 'waf-comp-004',
        agentName: 'Compliance & Data Sovereignty WAF Agent',
        prompt: this.getWAFComplianceResearchPrompt(),
        timeLimit: 40000, // 40 seconds
        priority: 'medium'
      }],
      ['waf-industry-verticals', {
        id: 'waf-ind-005',
        agentName: 'Industry Vertical WAF Solutions Agent',
        prompt: this.getWAFIndustryResearchPrompt(),
        timeLimit: 40000, // 40 seconds
        priority: 'medium'
      }],
      ['waf-architecture-migration', {
        id: 'waf-arch-006',
        agentName: 'Architecture & Migration WAF Patterns Agent',
        prompt: this.getWAFArchitectureResearchPrompt(),
        timeLimit: 45000, // 45 seconds
        priority: 'high'
      }]
    ]);
  }

  /**
   * Execute all research agents in parallel with time limits
   */
  async executeResearch(caseStudyContext?: string): Promise<ResearchResult[]> {
    console.log('🔍 Starting parallel research with 6 specialized agents...');
    const startTime = Date.now();

    const researchPromises = Array.from(this.researchAgents.values()).map(task => 
      this.executeTimeLimitedResearch(task, caseStudyContext)
    );

    const results = await Promise.allSettled(researchPromises);
    const totalTime = Date.now() - startTime;

    console.log(`✅ Research completed in ${Math.round(totalTime / 1000)}s`);
    
    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        const task = Array.from(this.researchAgents.values())[index];
        return {
          agentName: task.agentName,
          findings: `Research failed: ${result.reason}`,
          executionTime: task.timeLimit,
          status: 'error' as const,
          keyInsights: [],
          caseStudies: []
        };
      }
    });
  }

  private async executeTimeLimitedResearch(
    task: ResearchTask, 
    caseStudyContext?: string
  ): Promise<ResearchResult> {
    const startTime = Date.now();
    
    try {
      // Create timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Research timeout')), task.timeLimit);
      });

      // Create research promise
      const researchPromise = this.conductResearch(task, caseStudyContext);

      // Race between research and timeout
      const findings = await Promise.race([researchPromise, timeoutPromise]);
      const executionTime = Date.now() - startTime;

      // Extract key insights and case studies
      const keyInsights = this.extractKeyInsights(findings);
      const caseStudies = this.extractCaseStudies(findings);

      return {
        agentName: task.agentName,
        findings,
        executionTime,
        status: 'completed',
        keyInsights,
        caseStudies
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const isTimeout = error.message === 'Research timeout';
      
      return {
        agentName: task.agentName,
        findings: isTimeout ? 'Research timed out - partial results may be available' : `Research error: ${error.message}`,
        executionTime,
        status: isTimeout ? 'timeout' : 'error',
        keyInsights: [],
        caseStudies: []
      };
    }
  }

  private async conductResearch(task: ResearchTask, caseStudyContext?: string): Promise<string> {
    const contextPrompt = caseStudyContext ? 
      `\n\nCONTEXT: Focus research to support this case study context: ${caseStudyContext}` : '';

    const response = await this.client.chat.completions.create({
      model: config.getAzureConfig().foundry.modelDeploymentName,
      messages: [
        {
          role: 'system',
          content: `You are ${task.agentName}. Conduct focused research based on your specialization. Provide specific, actionable findings with concrete examples, technical details, and measurable outcomes.`
        },
        {
          role: 'user',
          content: task.prompt + contextPrompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    return response.choices[0]?.message?.content || 'No research findings available';
  }

  private extractKeyInsights(findings: string): string[] {
    // Extract key insights using pattern matching
    const insights = [];
    const lines = findings.split('\n');
    
    for (const line of lines) {
      if (line.includes('Key insight:') || line.includes('Important:') || line.includes('Critical:')) {
        insights.push(line.trim());
      }
    }
    
    return insights.slice(0, 5); // Limit to top 5 insights
  }

  private extractCaseStudies(findings: string): string[] {
    // Extract case study references
    const caseStudies = [];
    const lines = findings.split('\n');
    
    for (const line of lines) {
      if (line.includes('Case study:') || line.includes('Example:') || line.includes('Implementation:')) {
        caseStudies.push(line.trim());
      }
    }
    
    return caseStudies.slice(0, 3); // Limit to top 3 case studies
  }

  // WAF Research prompt generators for each specialized agent
  private getWAFInfrastructureResearchPrompt(): string {
    return `Research Azure infrastructure and regional expansion with Well-Architected Framework compliance from 2024-2025:

WAF INFRASTRUCTURE FOCUS AREAS:
1. New Azure regions with WAF Reliability pillar compliance (availability zones, disaster recovery)
2. Infrastructure investments supporting WAF Performance Efficiency (network latency, bandwidth)
3. Edge computing and Azure Arc deployments for WAF Operational Excellence
4. Regional expansion supporting WAF Security requirements (data sovereignty, compliance)
5. Cost optimization through WAF-aligned infrastructure planning

WAF-ALIGNED DELIVERABLES:
- Region names with WAF Reliability capabilities (availability zones, SLA improvements)
- Infrastructure specifications supporting WAF Performance Efficiency targets
- Security and compliance features aligned with WAF Security pillar
- Cost optimization opportunities through regional WAF planning
- Operational excellence improvements through infrastructure automation

FORMAT: Focus on how infrastructure developments support Microsoft Well-Architected Framework principles and compliance.`;
  }

  private getWAFAIMLResearchPrompt(): string {
    return `Research Azure AI/ML Well-Architected patterns and implementations from 2024-2025:

WAF AI/ML FOCUS AREAS:
1. Azure OpenAI Service WAF compliance patterns (Security, Performance, Cost optimization)
2. Microsoft Copilot enterprise implementations following WAF principles
3. AI infrastructure projects with WAF Reliability and Performance Efficiency
4. Azure AI/ML services supporting WAF Operational Excellence (monitoring, automation)
5. Industry-specific AI solutions demonstrating WAF Security and Compliance
6. AI cost optimization strategies aligned with WAF Cost Optimization pillar

WAF-ALIGNED AI/ML DELIVERABLES:
- AI/ML service implementations with WAF pillar compliance analysis
- Performance and scalability patterns supporting WAF Performance Efficiency
- Security and governance patterns for AI/ML following WAF Security pillar
- Cost optimization strategies for AI workloads aligned with WAF principles
- Operational excellence patterns for AI/ML monitoring and automation

FORMAT: Focus on how AI/ML implementations demonstrate Microsoft Well-Architected Framework compliance across all 5 pillars.`;
  }

  private getWAFEnterpriseResearchPrompt(): string {
    return `Research major enterprise WAF implementations and Well-Architected success stories from 2024-2025:

WAF ENTERPRISE FOCUS AREAS:
1. Fortune 500 companies implementing complete WAF assessments and compliance
2. Multi-billion dollar Azure contracts with WAF methodology requirements
3. Complex enterprise WAF transformations across all 5 pillars
4. Mission-critical workload migrations following WAF principles
5. Industry-leading WAF compliance achievements and case studies
6. Enterprise WAF maturity improvements with measurable outcomes

WAF-ALIGNED DELIVERABLES:
- Company WAF assessment scores and pillar improvements over time
- Technical WAF compliance implementations and architecture decisions
- Specific Azure services chosen for WAF pillar compliance
- Quantifiable WAF business outcomes (reliability, security, performance, cost)
- WAF implementation timelines and methodology adoption

FORMAT: Focus on how enterprises achieved WAF compliance across all 5 pillars with specific Azure services and measurable improvements.`;
  }

  private getWAFComplianceResearchPrompt(): string {
    return `Research Azure compliance and data sovereignty through WAF Security pillar from 2024-2025:

WAF COMPLIANCE FOCUS AREAS:
1. Data residency implementations supporting WAF Security pillar compliance
2. Industry-specific WAF Security patterns (FINRA, PCI, SOX, HIPAA, GDPR)
3. Financial services WAF Security and Compliance implementations
4. Healthcare WAF Security and regulatory compliance patterns
5. Government WAF Security implementations and public sector compliance
6. Cross-border data transfer solutions following WAF Security principles

WAF SECURITY DELIVERABLES:
- Compliance frameworks aligned with WAF Security pillar requirements
- Data sovereignty architecture patterns supporting WAF principles
- WAF Security pillar implementation details for regulatory compliance
- Technical WAF Security controls and audit requirements
- Multi-jurisdictional WAF compliance strategies and patterns

FORMAT: Focus on how WAF Security pillar principles address regulatory requirements with specific Azure security services.`;
  }

  private getWAFIndustryResearchPrompt(): string {
    return `Research Azure industry-specific WAF implementations and vertical solutions from 2024-2025:

WAF INDUSTRY FOCUS AREAS:
1. Financial services WAF implementations (banking, insurance, capital markets)
2. Healthcare WAF compliance patterns (hospitals, pharmaceutical, medical devices)
3. Retail WAF optimization (e-commerce, supply chain, customer analytics)
4. Manufacturing WAF excellence (IoT, predictive maintenance, digital twins)
5. Government WAF standards (public cloud, citizen services, digital government)
6. Energy WAF transformations (smart grid, renewable energy, oil & gas)

WAF INDUSTRY DELIVERABLES:
- Industry-specific WAF compliance patterns and reference architectures
- Vertical-focused WAF case studies with pillar-specific implementations
- Regulatory WAF requirements and compliance considerations by industry
- WAF performance metrics and business outcomes by vertical
- Industry-standard system integration following WAF principles

FORMAT: Focus on how each industry vertical implements WAF compliance with specific Azure services and pillar-focused outcomes.`;
  }

  private getWAFArchitectureResearchPrompt(): string {
    return `Research complex Azure architecture patterns following WAF methodology from 2024-2025:

WAF ARCHITECTURE FOCUS AREAS:
1. Large-scale WAF-compliant migration methodologies and frameworks
2. Hybrid and multi-cloud WAF architecture patterns across all 5 pillars
3. Microservices and container orchestration with WAF Operational Excellence
4. Event-driven and serverless WAF Performance Efficiency patterns
5. Data architecture and analytics platforms following WAF principles
6. Zero-trust security architectures aligned with WAF Security pillar

WAF ARCHITECTURE DELIVERABLES:
- Detailed WAF-compliant architecture patterns with pillar analysis
- Migration strategies incorporating WAF assessment and compliance
- WAF Performance Efficiency optimization techniques and results
- WAF Cost Optimization patterns and savings achieved through compliance
- Integration patterns following WAF Operational Excellence principles
- Scalability and resilience decisions based on WAF Reliability pillar

FORMAT: Focus on technical architecture depth with WAF pillar alignment, decision rationale based on WAF principles, and quantifiable WAF compliance outcomes.`;
  }

  /**
   * Combine research results into comprehensive intelligence report
   */
  generateResearchReport(results: ResearchResult[]): string {
    const report = `# Microsoft Well-Architected Framework Intelligence Report
Generated: ${new Date().toISOString()}

## Executive Summary
${this.generateWAFExecutiveSummary(results)}

## WAF Research Findings by Specialization

${results.map(result => `
### ${result.agentName}
**Status:** ${result.status} (${Math.round(result.executionTime / 1000)}s)

**Key Insights:**
${result.keyInsights.map(insight => `• ${insight}`).join('\n')}

**Case Studies Identified:**
${result.caseStudies.map(study => `• ${study}`).join('\n')}

**Detailed Findings:**
${result.findings}

---
`).join('')}

## WAF Research Methodology
- **Parallel WAF Intelligence:** 6 specialized WAF research agents running simultaneously
- **Time Limits:** 40-50 second focused WAF research per agent
- **Total WAF Research Time:** ${Math.round(results.reduce((sum, r) => Math.max(sum, r.executionTime), 0) / 1000)}s
- **Success Rate:** ${results.filter(r => r.status === 'completed').length}/${results.length} WAF agents completed successfully

## WAF-Aligned Recommendations for Architecture Development
${this.generateWAFCaseStudyRecommendations(results)}
`;

    return report;
  }

  private generateWAFExecutiveSummary(results: ResearchResult[]): string {
    const completedResults = results.filter(r => r.status === 'completed');
    const totalInsights = completedResults.reduce((sum, r) => sum + r.keyInsights.length, 0);
    const totalCaseStudies = completedResults.reduce((sum, r) => sum + r.caseStudies.length, 0);

    return `WAF research completed across ${completedResults.length} specialized domains, identifying ${totalInsights} key insights and ${totalCaseStudies} potential WAF case studies. Focus areas covered include WAF infrastructure compliance, AI/ML innovation with WAF principles, enterprise WAF implementations, compliance frameworks, industry-specific WAF solutions, and WAF architecture patterns.`;
  }

  private generateWAFCaseStudyRecommendations(results: ResearchResult[]): string {
    return `Based on WAF research findings, recommended case study focus areas:

1. **High-Impact WAF Implementations:** Focus on large-scale enterprise WAF assessments with measurable compliance improvements
2. **WAF Security-First Architectures:** Leverage data sovereignty and regulatory compliance through WAF Security pillar
3. **Industry-Specific WAF Solutions:** Develop vertical-focused WAF case studies for target sectors
4. **WAF Technical Innovation:** Highlight cutting-edge AI/ML implementations following WAF Performance and Operational Excellence pillars
5. **Multi-Pillar WAF Scenarios:** Include complex WAF assessments spanning all 5 pillars with stakeholder alignment

These WAF findings provide foundation for developing realistic, interview-ready case studies with technical depth, business context, and Well-Architected Framework compliance methodology.`;
  }
}