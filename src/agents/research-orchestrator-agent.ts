/**
 * Research Orchestrator Agent
 * Coordinates 6 specialized research agents for comprehensive Azure project intelligence
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
      ['infrastructure-regional', {
        id: 'infra-001',
        agentName: 'Azure Infrastructure & Regional Expansion Agent',
        prompt: this.getInfrastructureResearchPrompt(),
        timeLimit: 45000, // 45 seconds
        priority: 'high'
      }],
      ['ai-ml-innovation', {
        id: 'ai-002',
        agentName: 'Azure AI/ML & Technical Innovation Agent', 
        prompt: this.getAIMLResearchPrompt(),
        timeLimit: 45000, // 45 seconds
        priority: 'high'
      }],
      ['enterprise-cases', {
        id: 'ent-003',
        agentName: 'Enterprise Case Studies & Customer Success Agent',
        prompt: this.getEnterpriseResearchPrompt(),
        timeLimit: 50000, // 50 seconds
        priority: 'high'
      }],
      ['compliance-sovereignty', {
        id: 'comp-004',
        agentName: 'Compliance & Data Sovereignty Agent',
        prompt: this.getComplianceResearchPrompt(),
        timeLimit: 40000, // 40 seconds
        priority: 'medium'
      }],
      ['industry-verticals', {
        id: 'ind-005',
        agentName: 'Industry Verticals & Sector-Specific Agent',
        prompt: this.getIndustryResearchPrompt(),
        timeLimit: 40000, // 40 seconds
        priority: 'medium'
      }],
      ['architecture-migration', {
        id: 'arch-006',
        agentName: 'Architecture & Migration Patterns Agent',
        prompt: this.getArchitectureResearchPrompt(),
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

  // Research prompt generators for each specialized agent
  private getInfrastructureResearchPrompt(): string {
    return `Research Azure infrastructure and regional expansion projects from 2024-2025:

FOCUS AREAS:
1. New Azure regions launched or announced in 2024-2025
2. Major datacenter expansions and infrastructure investments
3. Edge computing and Azure Arc deployments
4. Availability zone expansions and disaster recovery capabilities
5. Network infrastructure improvements (ExpressRoute, global connectivity)

DELIVERABLES:
- Specific region names, locations, and launch dates
- Infrastructure specifications and capabilities
- Business impact and customer benefits
- Technical architecture details
- Investment amounts and scale metrics

FORMAT: Provide concrete examples with specific details, technical specifications, and measurable outcomes suitable for enterprise case studies.`;
  }

  private getAIMLResearchPrompt(): string {
    return `Research Azure AI/ML and technical innovation projects from 2024-2025:

FOCUS AREAS:
1. Azure OpenAI Service expansions and new model deployments
2. Azure AI/ML platform enhancements and new services
3. Microsoft Copilot enterprise implementations
4. Azure Cognitive Services updates and capabilities
5. AI infrastructure projects (GPU clusters, specialized hardware)
6. Industry-specific AI solutions and partnerships

DELIVERABLES:
- Specific AI/ML service launches with technical specs
- Large-scale enterprise AI implementations
- Performance metrics and scalability achievements
- Integration patterns and architectural decisions
- Cost optimization and ROI examples

FORMAT: Focus on enterprise-grade implementations with technical depth, specific Azure SKUs, and quantifiable business outcomes.`;
  }

  private getEnterpriseResearchPrompt(): string {
    return `Research major enterprise Azure implementations and customer success stories from 2024-2025:

FOCUS AREAS:
1. Large-scale cloud migration projects (Fortune 500 companies)
2. Multi-billion dollar Azure contracts and partnerships
3. Complex hybrid and multi-cloud implementations
4. Digital transformation case studies with specific outcomes
5. Mission-critical workload migrations
6. Industry-leading performance and scale achievements

DELIVERABLES:
- Company names, project scope, and implementation details
- Technical challenges overcome and solutions implemented
- Specific Azure services used and architecture patterns
- Quantifiable business outcomes (cost savings, performance gains)
- Timeline and implementation methodology

FORMAT: Provide detailed case studies suitable for technical interviews, including architecture decisions, stakeholder management, and measurable results.`;
  }

  private getComplianceResearchPrompt(): string {
    return `Research Azure compliance, data sovereignty, and regulatory projects from 2024-2025:

FOCUS AREAS:
1. Data residency and sovereignty implementations (EU, UK, Asia-Pacific)
2. Industry-specific compliance certifications and solutions
3. Financial services regulatory compliance (FINRA, PCI, SOX)
4. Healthcare compliance implementations (HIPAA, GDPR)
5. Government and public sector compliance projects
6. Cross-border data transfer solutions and regulatory approvals

DELIVERABLES:
- Specific compliance frameworks and certifications achieved
- Data sovereignty architecture patterns and controls
- Regulatory approval processes and outcomes
- Technical implementation details for compliance requirements
- Multi-jurisdictional compliance strategies

FORMAT: Focus on regulatory complexity, technical controls, audit requirements, and compliance architecture patterns.`;
  }

  private getIndustryResearchPrompt(): string {
    return `Research Azure industry-specific and vertical solutions from 2024-2025:

FOCUS AREAS:
1. Financial services: Banking, insurance, capital markets implementations
2. Healthcare: Hospital systems, pharmaceutical, medical device companies
3. Retail: E-commerce platforms, supply chain, customer analytics
4. Manufacturing: IoT, predictive maintenance, digital twin implementations
5. Government: Public cloud, citizen services, digital government initiatives
6. Energy: Smart grid, renewable energy, oil & gas digital transformation

DELIVERABLES:
- Industry-specific Azure solutions and reference architectures
- Vertical-focused case studies with technical specifications
- Regulatory and compliance considerations by industry
- Performance metrics and business outcomes
- Integration patterns with industry-standard systems

FORMAT: Provide industry-specific technical depth, regulatory context, and measurable business impact suitable for sector-focused case studies.`;
  }

  private getArchitectureResearchPrompt(): string {
    return `Research complex Azure architecture patterns and migration strategies from 2024-2025:

FOCUS AREAS:
1. Large-scale cloud migration methodologies and frameworks
2. Hybrid and multi-cloud architecture patterns
3. Microservices and container orchestration implementations
4. Event-driven and serverless architecture examples
5. Data architecture and analytics platform implementations
6. Security architecture and zero-trust implementations

DELIVERABLES:
- Detailed architecture patterns with technical specifications
- Migration strategies for complex enterprise environments
- Performance optimization techniques and results
- Cost optimization patterns and savings achieved
- Integration patterns and API management strategies
- Scalability and resilience architecture decisions

FORMAT: Focus on technical architecture depth, decision rationale, trade-offs considered, and quantifiable outcomes suitable for solution architect interviews.`;
  }

  /**
   * Combine research results into comprehensive intelligence report
   */
  generateResearchReport(results: ResearchResult[]): string {
    const report = `# Azure Research Intelligence Report
Generated: ${new Date().toISOString()}

## Executive Summary
${this.generateExecutiveSummary(results)}

## Research Findings by Specialization

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

## Research Methodology
- **Parallel Execution:** 6 specialized agents running simultaneously
- **Time Limits:** 40-50 second focused research per agent
- **Total Research Time:** ${Math.round(results.reduce((sum, r) => Math.max(sum, r.executionTime), 0) / 1000)}s
- **Success Rate:** ${results.filter(r => r.status === 'completed').length}/${results.length} agents completed successfully

## Recommendations for Case Study Development
${this.generateCaseStudyRecommendations(results)}
`;

    return report;
  }

  private generateExecutiveSummary(results: ResearchResult[]): string {
    const completedResults = results.filter(r => r.status === 'completed');
    const totalInsights = completedResults.reduce((sum, r) => sum + r.keyInsights.length, 0);
    const totalCaseStudies = completedResults.reduce((sum, r) => sum + r.caseStudies.length, 0);

    return `Research completed across ${completedResults.length} specialized domains, identifying ${totalInsights} key insights and ${totalCaseStudies} potential case studies. Focus areas covered include infrastructure expansion, AI/ML innovation, enterprise implementations, compliance frameworks, industry verticals, and architecture patterns.`;
  }

  private generateCaseStudyRecommendations(results: ResearchResult[]): string {
    return `Based on research findings, recommended case study focus areas:

1. **High-Impact Implementations:** Focus on large-scale enterprise migrations with measurable ROI
2. **Compliance-First Architectures:** Leverage data sovereignty and regulatory compliance examples  
3. **Industry-Specific Solutions:** Develop vertical-focused case studies for target sectors
4. **Technical Innovation:** Highlight cutting-edge AI/ML and architecture pattern implementations
5. **Multi-Stakeholder Scenarios:** Include complex organizational change and stakeholder management elements

These findings provide foundation for developing realistic, interview-ready case studies with technical depth and business context.`;
  }
}