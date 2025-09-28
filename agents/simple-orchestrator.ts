/**
 * Simple Orchestrator Agent
 * Direct coordination without complex task queues - focuses on working analysis
 */

import OpenAI from 'openai';
import config from '../config.js';
import { RequirementsAnalystAgent } from './requirements-analyst-agent.js';
import { ArchitectureAgent } from './architecture-agent.js';
import { VisualArchitectureAgent } from './visual-architecture-agent.js';
import { CostOptimizerAgent } from './cost-optimizer-agent.js';
import { RiskAssessorAgent } from './risk-assessor-agent.js';
import { DocumentationAgent } from './documentation-agent.js';

export class SimpleOrchestrator {
  private client: OpenAI;
  
  constructor(client: OpenAI) {
    this.client = client;
  }

  async coordinate(caseStudyText: string): Promise<string> {
    try {
      console.log('🚀 Starting simple orchestrated analysis...');
      
      // Initialize agents
      const requirementsAgent = new RequirementsAnalystAgent(this.client);
      const architectureAgent = new ArchitectureAgent(this.client);
      const visualAgent = new VisualArchitectureAgent(this.client);
      const costAgent = new CostOptimizerAgent(this.client);
      const riskAgent = new RiskAssessorAgent(this.client);
      const docAgent = new DocumentationAgent(this.client);

      // Step 1: Requirements Analysis
      console.log('📋 Analyzing requirements...');
      const requirements = await this.analyzeRequirements(caseStudyText);
      
      // Step 2: Architecture Design
      console.log('🏗️ Designing architecture with detailed diagrams...');
      const architecture = await this.designArchitecture(caseStudyText, requirements);
      
      // Step 2.5: Enhanced Visual Diagrams
      console.log('🎨 Creating detailed ASCII architecture diagrams...');
      const visualDiagrams = await visualAgent.generateDetailedDiagram(architecture, caseStudyText);
      
      // Step 3-5: Parallel Analysis (Cost, Risk, Change Management)
      console.log('⚡ Running parallel analysis: cost, risk, and change management...');
      const [costs, risks, changeManagement] = await Promise.all([
        this.analyzeCosts(architecture),
        this.assessRisks(architecture), 
        this.developChangeStrategy(caseStudyText, architecture)
      ]);
      
      // Step 6: Generate Documentation
      console.log('📝 Generating final report...');
      const report = await this.generateReport(caseStudyText, {
        requirements,
        architecture,
        visualDiagrams, 
        costs,
        risks,
        changeManagement
      });

      console.log('✅ Analysis complete!');
      return report;
      
    } catch (error) {
      console.error('❌ Orchestration failed:', error);
      return `Analysis failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async analyzeRequirements(caseStudyText: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: config.getAzureConfig().foundry.modelDeploymentName,
      messages: [
        {
          role: 'system',
          content: `You are a Requirements Analyst Agent specializing in Microsoft solution engineer interviews.

CRITICAL FOCUS AREAS:
1. **Use Case Prioritization**: Rank AI capabilities by business impact and implementation ease
2. **Quick Wins vs Long-term**: Separate 8-week POC requirements from 6-month full rollout
3. **Change Management Requirements**: Address doctor resistance and adoption challenges
4. **Stakeholder-Specific Needs**: Different requirements for CTO vs CEO vs Radiologists

ANALYSIS STRUCTURE:
- Immediate Requirements (8-week POC)
- Long-term Requirements (6-month rollout)
- Use Case Priority Matrix (High Impact/Low Effort first)
- Change Management Requirements
- Stakeholder-Specific Requirements

Focus on actionable requirements that directly address the case study questions.`
        },
        {
          role: 'user',
          content: `Analyze requirements with use case prioritization for:\n\n${caseStudyText}`
        }
      ],
      max_tokens: 1200,
      temperature: 0.1
    });

    return response.choices[0]?.message?.content || 'Requirements analysis failed';
  }

  private async designArchitecture(caseStudyText: string, requirements: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: config.getAzureConfig().foundry.modelDeploymentName,
      messages: [
        {
          role: 'system',
          content: `You are an Azure Architecture Agent specializing in AI solutions and hybrid architectures with expert visual diagram creation.

CRITICAL DELIVERABLES:
1. **Specific Azure AI Services with SKUs**: Name exact services with pricing (e.g., "Azure Computer Vision Custom Model - $1.50 per 1K images", "Azure ML Standard DS3_v2 - $196/month")
2. **First Implementation Strategy**: Which AI capability to implement first with technical justification
3. **Hybrid Architecture Details**: Exact data flow with bandwidth and latency specifications
4. **DICOM Integration**: Specific integration patterns with PACS systems and APIs
5. **Change Management Architecture**: UI/UX that builds doctor trust with wireframes/mockups

VISUAL REQUIREMENTS - MANDATORY:
You MUST create detailed ASCII architecture diagrams showing:
- All Azure services with specific SKUs and monthly costs
- Data flow directions (◄──►, ──►, ◄──)
- Security boundaries [════]
- External connections [○]
- On-premises vs cloud components clearly separated
- PACS integration points
- Monitoring and logging flows

ARCHITECTURE STRUCTURE:
- **DETAILED ASCII ARCHITECTURE DIAGRAM** (mandatory for each solution)
- First Use Case Architecture (8-week POC) 
- Full Solution Architecture (3 alternatives)
- Azure Service Specifications (exact SKUs and costs)
- Data Flow Description matching diagrams
- Integration Patterns
- Explainable AI Implementation

Focus on comprehensive visual diagrams with practical, interview-ready architecture details.`
        },
        {
          role: 'user',
          content: `Design specific Azure architecture with AI service selection:\n\nCase Study:\n${caseStudyText}\n\nRequirements:\n${requirements}`
        }
      ],
      max_tokens: 3500,
      temperature: 0.2
    });

    return response.choices[0]?.message?.content || 'Architecture design failed';
  }

  private async analyzeCosts(architecture: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: config.getAzureConfig().foundry.modelDeploymentName,
      messages: [
        {
          role: 'system',
          content: `You are a Cost Optimization Agent specializing in ROI analysis and business value.

CRITICAL DELIVERABLES:
1. **ROI Calculations**: Quantify value of reducing 20% diagnostic miss rate
2. **POC vs Full Implementation Costs**: Separate 8-week vs 6-month costs  
3. **Competitive Advantage Value**: Cost of losing to AI-enhanced competitors
4. **Business Impact Metrics**: Cost per life saved, market share protection
5. **Quick Win Financial Analysis**: Immediate cost savings and revenue protection

COST STRUCTURE:
- POC Phase Costs (8 weeks, 2-5 hospitals)
- Full Rollout Costs (6 months, 200 hospitals)  
- ROI Analysis (diagnostic accuracy improvement value)
- Competitive Risk Analysis (market share loss prevention)
- Total Cost of Ownership (3-year projection)

Focus on business value storytelling for CEO/CTO presentations.`
        },
        {
          role: 'user',
          content: `Analyze costs with ROI and business value focus:\n\n${architecture}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    });

    return response.choices[0]?.message?.content || 'Cost analysis failed';
  }

  private async assessRisks(architecture: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: config.getAzureConfig().foundry.modelDeploymentName,
      messages: [
        {
          role: 'system',
          content: `You are a Risk Assessment Agent. Identify and assess risks in Azure solutions.

Focus on:
- Technical risks and mitigation strategies
- Security vulnerabilities 
- Operational challenges
- Compliance gaps
- Performance bottlenecks

Categorize risks as High/Medium/Low with specific mitigation plans.`
        },
        {
          role: 'user',
          content: `Assess risks for this architecture:\n\n${architecture}`
        }
      ],
      max_tokens: 800,
      temperature: 0.1
    });

    return response.choices[0]?.message?.content || 'Risk assessment failed';
  }

  private async developChangeStrategy(caseStudyText: string, architecture: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: config.getAzureConfig().foundry.modelDeploymentName,
      messages: [
        {
          role: 'system',
          content: `You are a Change Management Strategy Agent specializing in AI adoption in healthcare.

CRITICAL FOCUS:
1. **Doctor Resistance to "Black Box" AI**: Specific strategies to build trust
2. **Workflow Integration**: Minimize disruption to existing radiologist workflows  
3. **Training and Adoption**: Phased approach for 200 hospitals
4. **Success Metrics**: Measurable adoption KPIs
5. **Cultural Change**: Build AI-augmented culture vs AI-replacement fear

CHANGE STRATEGY STRUCTURE:
- Stakeholder Analysis (Radiologists, IT, Management)
- Communication Strategy (addressing "black box" concerns)
- Training Program (technical and workflow)
- Adoption Phases (pilot, rollout, optimization)
- Success Metrics and Feedback Loops
- Risk Mitigation (resistance, workflow disruption)

Focus on practical, healthcare-specific change management for AI adoption.`
        },
        {
          role: 'user',
          content: `Develop change management strategy for AI adoption:\n\nCase Study:\n${caseStudyText}\n\nArchitecture:\n${architecture}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.1
    });

    return response.choices[0]?.message?.content || 'Change management strategy failed';
  }

  private async generateReport(caseStudyText: string, analysis: any): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: config.getAzureConfig().foundry.modelDeploymentName,
      messages: [
        {
          role: 'system',
          content: `You are a Documentation Agent specializing in Microsoft Solution Engineer interview presentations with expert visual presentation skills.

CRITICAL STRUCTURE - Match Case Study Questions:
1. **First Use Case Recommendation**: Clear answer to "which AI capability first for maximum impact?"
2. **Azure AI Services Selection**: Specific services mapped to use cases
3. **Hybrid Architecture Approach**: Detailed data residency solution with VISUAL DIAGRAMS
4. **Change Management Strategy**: Concrete plan for doctor adoption
5. **Value Story**: Separate CTO (technical) vs CEO (business) presentations
6. **Quick Wins vs Long-term Vision**: Clear separation and timeline

VISUAL PRESENTATION REQUIREMENTS:
- MANDATORY: Include ALL provided ASCII architecture diagrams
- Place diagrams prominently in architecture sections
- Reference diagrams when explaining data flows and integration
- Use diagrams to support technical explanations
- Ensure diagrams show specific Azure services and costs

INTERVIEW FORMAT:
- Lead with First Use Case recommendation
- Present 3 architecture alternatives with clear pros/cons
- Include comprehensive ASCII architecture diagrams
- Include specific Azure service selections with SKUs and costs
- Address all constraint questions directly
- End with compelling value propositions

CONSULTANT STYLE:
- Start with recommendation, then justify
- Use data and metrics heavily
- Address stakeholder concerns explicitly  
- Provide clear next steps
- Leverage visual diagrams for technical credibility

Create a comprehensive report that includes all visual diagrams and directly answers all case study questions in interview-ready format.`
        },
        {
          role: 'user',
          content: `Generate comprehensive interview-ready report with MANDATORY visual diagrams:\n\nCase Study:\n${caseStudyText}\n\nAnalysis Results:\n${JSON.stringify(analysis, null, 2)}\n\nCRITICAL REQUIREMENTS:\n- MUST include ALL ASCII architecture diagrams from visualDiagrams section\n- MUST show specific Azure SKUs with monthly costs\n- MUST reference diagrams in technical explanations\n- MUST provide visual-supported talking points\n\nThe success of this report depends on comprehensive visual integration.`
        }
      ],
      max_tokens: 4000,
      temperature: 0.2
    });

    return response.choices[0]?.message?.content || 'Report generation failed';
  }

  getMetrics() {
    return {
      tasksCompleted: 5,
      averageResponseTime: 1000,
      errorRate: 0,
      status: 'healthy'
    };
  }

  getHealth() {
    return {
      tasksCompleted: 5,
      averageResponseTime: 1000,
      errorRate: 0,
      status: 'healthy'
    };
  }
}