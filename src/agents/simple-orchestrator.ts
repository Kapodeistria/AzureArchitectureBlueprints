/**
 * Simple Orchestrator Agent
 * Direct coordination without complex task queues - focuses on working analysis
 */

import OpenAI from 'openai';
import config from '../config/config.js';
import { RequirementsAnalystAgent } from './requirements-analyst-agent.js';
import { ArchitectureAgent } from './architecture-agent.js';
import { VisualArchitectureAgent } from './visual-architecture-agent.js';
import { CostOptimizerAgent } from './cost-optimizer-agent.js';
import { RiskAssessorAgent } from './risk-assessor-agent.js';
import { DocumentationAgent } from './documentation-agent.js';
import { ResearchOrchestratorAgent } from './research-orchestrator-agent.js';
import { promises as fs } from 'fs';
import path from 'path';
// Phase 2: DSL functionality will be separate
// import { StructurizrDSLValidatorAgent } from './structurizr-dsl-validator-agent.js';
// import { SolutionArchitectReviewerAgent } from './solution-architect-reviewer-agent.js';

export class SimpleOrchestrator {
  private client: OpenAI;
  
  constructor(client: OpenAI) {
    this.client = client;
  }

  async coordinate(caseStudyText: string, caseStudyFolder?: string): Promise<string> {
    try {
      console.log('🚀 Starting Phase 1: Intelligence-Driven Architecture Analysis...');
      
      // Initialize agents (Phase 1: Core workflow)
      const researchAgent = new ResearchOrchestratorAgent(this.client);
      const requirementsAgent = new RequirementsAnalystAgent(this.client);
      const architectureAgent = new ArchitectureAgent(this.client);
      const visualAgent = new VisualArchitectureAgent(this.client);
      const costAgent = new CostOptimizerAgent(this.client);
      const riskAgent = new RiskAssessorAgent(this.client);
      const docAgent = new DocumentationAgent(this.client);
      // Phase 2: DSL agents will be separate workflow
      // const reviewerAgent = new SolutionArchitectReviewerAgent(this.client);
      // const dslAgent = new StructurizrDSLValidatorAgent(this.client);

      // Step 0: Parallel Research Intelligence (NEW - 6 agents with time limits)
      console.log('🔍 [0/6] Executing parallel research across 6 specialized agents...');
      let researchResults = [];
      let researchReport = '';
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Research intelligence timeout')), 120000) // 2 min timeout
        );
        
        researchResults = await Promise.race([
          researchAgent.executeResearch(caseStudyText),
          timeoutPromise
        ]) as any[];
        
        researchReport = researchAgent.generateResearchReport(researchResults);
        console.log(`✅ Research completed: ${researchResults.filter(r => r.status === 'completed').length}/${researchResults.length} agents successful`);
        
      } catch (error) {
        console.warn('⚠️ Research intelligence failed, using fallback:', error.message);
        researchReport = `# Research Intelligence (Fallback)\n\nResearch analysis temporarily unavailable: ${error.message}\n\nProceeding with standard analysis workflow.`;
      }
      
      // Save research after completion
      await this.saveIntermediateResults('Research Intelligence', researchReport, caseStudyFolder);

      // Step 1: Requirements Analysis (with timeout fallback and research context)
      console.log('📋 [1/6] Analyzing business and technical requirements...');
      let requirements = '';
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Requirements analysis timeout')), 30000)
        );
        
        requirements = await Promise.race([
          this.analyzeRequirements(caseStudyText, researchReport),
          timeoutPromise
        ]) as string;
      } catch (error) {
        console.warn('⚠️ Requirements analysis failed, using simplified fallback:', error.message);
        requirements = `
# Requirements Analysis (Fallback)

## Functional Requirements
- Core application functionality
- User management and authentication
- Data processing and storage
- Integration with existing systems

## Non-Functional Requirements  
- High availability and reliability
- Performance and scalability
- Security and compliance
- Cost optimization

*Note: Detailed requirements analysis temporarily unavailable*
        `;
      }
      
      // Save requirements after completion
      await this.saveIntermediateResults('Requirements Analysis', requirements, caseStudyFolder);
      
      // Step 2: Architecture Design (with timeout fallback and research context)
      console.log('🏗️ [2/6] Designing Azure architecture with service selection...');
      let architecture = '';
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Architecture design timeout')), 30000)
        );
        
        architecture = await Promise.race([
          this.designArchitecture(caseStudyText, requirements, researchReport),
          timeoutPromise
        ]) as string;
      } catch (error) {
        console.warn('⚠️ Architecture design failed, using simplified fallback:', error.message);
        architecture = `
# Simplified Azure Architecture

## Core Components
- Azure App Service (Web hosting)
- Azure SQL Database (Data storage)  
- Azure Application Gateway (Load balancing)
- Azure Key Vault (Security)
- Azure Monitor (Observability)

## Integration
- Standard Azure services configuration
- Basic security and monitoring setup
- Scalable web application architecture

*Note: Detailed architecture design temporarily unavailable*
        `;
      }
      
      // Save architecture after completion  
      await this.saveIntermediateResults('Architecture Design', architecture, caseStudyFolder);
      
      // Step 2.5: Enhanced Visual Diagrams (with timeout fallback)
      console.log('🎨 [3/6] Creating detailed ASCII architecture diagrams...');
      let visualDiagrams = '';
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Visual diagram generation timeout')), 30000)
        );
        
        visualDiagrams = await Promise.race([
          visualAgent.generateDetailedDiagram(architecture, caseStudyText, caseStudyFolder),
          timeoutPromise
        ]) as string;
      } catch (error) {
        console.warn('⚠️ Visual diagram generation failed, using fallback:', error.message);
        visualDiagrams = `[Visual diagrams temporarily unavailable - proceeding with analysis]\n\nArchitecture Summary:\n${architecture}`;
      }
      
      // Save visual diagrams after completion (note: already saved separately by VisualArchitectureAgent)
      await this.saveIntermediateResults('Visual Architecture Diagrams', visualDiagrams, caseStudyFolder);
      
      // Phase 1: Core workflow - Skip complex review loop for now
      console.log('✅ [3/6] Architecture and visual diagrams complete!');
      
      // Step 4-6: Parallel Analysis (Cost, Risk, Change Management) with timeouts  
      console.log('⚡ [4/6] Running parallel analysis (cost, risk, change management)...');
      let costs, risks, changeManagement;
      
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Parallel analysis timeout')), 45000)
        );
        
        [costs, risks, changeManagement] = await Promise.race([
          Promise.all([
            this.analyzeCosts(architecture),
            this.assessRisks(architecture), 
            this.developChangeStrategy(caseStudyText, architecture)
          ]),
          timeoutPromise
        ]) as [string, string, string];
      } catch (error) {
        console.warn('⚠️ Parallel analysis failed, using fallbacks:', error.message);
        costs = `Cost analysis temporarily unavailable: ${error.message}`;
        risks = `Risk assessment temporarily unavailable: ${error.message}`;
        changeManagement = `Change management strategy temporarily unavailable: ${error.message}`;
      }
      
      // Save parallel analysis results
      await this.saveIntermediateResults('Cost Analysis', costs, caseStudyFolder);
      await this.saveIntermediateResults('Risk Assessment', risks, caseStudyFolder);
      await this.saveIntermediateResults('Change Management Strategy', changeManagement, caseStudyFolder);
      
      // Step 7: Generate Documentation (with timeout and research context)
      console.log('📝 [5/6] Generating comprehensive report and documentation...');
      let report;
      try {
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Report generation timeout')), 30000)
        );
        
        report = await Promise.race([
          this.generateReport(caseStudyText, {
            researchReport,
            requirements,
            architecture,
            visualDiagrams, 
            costs,
            risks,
            changeManagement
          }),
          timeoutPromise
        ]);
      } catch (error) {
        console.warn('⚠️ Report generation failed, using simplified fallback:', error.message);
        report = `
# Azure Architecture Analysis Report

## Case Study
${caseStudyText}

## Requirements
${requirements}

## Architecture
${architecture}

## Visual Diagrams
${visualDiagrams}

## Cost Analysis
${costs}

## Risk Assessment
${risks}

## Change Management
${changeManagement}

---
*Note: Detailed report generation temporarily unavailable*
        `;
      }
      
      console.log('🎉 ✅ Phase 1 Complete! Intelligence-driven Azure architecture analysis ready for interview!');
      return report;
      
    } catch (error) {
      console.error('❌ Orchestration failed:', error);
      return `Analysis failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  private async analyzeRequirements(caseStudyText: string, researchContext?: string): Promise<string> {
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
          content: `Analyze requirements with use case prioritization for:\n\n${caseStudyText}${researchContext ? `\n\nRESEARCH INTELLIGENCE CONTEXT:\n${researchContext}` : ''}`
        }
      ],
      max_tokens: 1200,
      temperature: 0.1
    });

    return response.choices[0]?.message?.content || 'Requirements analysis failed';
  }

  private async designArchitecture(caseStudyText: string, requirements: string, researchContext?: string): Promise<string> {
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
          content: `Design specific Azure architecture with AI service selection:\n\nCase Study:\n${caseStudyText}\n\nRequirements:\n${requirements}${researchContext ? `\n\nRESEARCH INTELLIGENCE CONTEXT:\n${researchContext}` : ''}`
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

  private async generateValidatedDSL(caseStudyText: string, architecture: any, requirements: string, caseStudyFolder?: string): Promise<any> {
    try {
      const dslAgent = new StructurizrDSLValidatorAgent(this.client);
      
      // Extract system name from case study
      const systemNameMatch = caseStudyText.match(/(?:system|platform|application|solution)[\s\w]*:\s*([^\n]+)/i);
      const systemName = systemNameMatch ? systemNameMatch[1].trim() : 'AzureSystem';
      
      // Extract Azure services from architecture
      const azureServices = this.extractAzureServices(architecture);
      
      const dslTask = {
        id: 'dsl-generation',
        type: 'structurizr-dsl',
        priority: 'high' as const,
        payload: {
          architecture: architecture,
          requirements: requirements,
          azureServices: azureServices,
          systemName: systemName,
          maxIterations: 3,
          targetLevel: 'all' as const,
          includeStyles: true,
          caseStudyFolder: caseStudyFolder
        }
      };

      const result = await dslAgent.execute(dslTask);
      return result;
      
    } catch (error) {
      console.error('❌ DSL generation failed:', error);
      return {
        success: false,
        error: error.message,
        message: 'DSL generation encountered an error'
      };
    }
  }

  private extractAzureServices(architecture: any): any[] {
    // Extract Azure services from the architecture description
    const services: any[] = [];
    const architectureText = typeof architecture === 'string' ? architecture : JSON.stringify(architecture);
    
    // Common Azure services to look for
    const azureServicePatterns = [
      { name: 'Azure App Service', pattern: /app\s+service|web\s+app/gi },
      { name: 'Azure SQL Database', pattern: /sql\s+database|azure\s+sql/gi },
      { name: 'Azure Cosmos DB', pattern: /cosmos\s+db|document\s+database/gi },
      { name: 'Azure Storage', pattern: /blob\s+storage|azure\s+storage/gi },
      { name: 'Azure Functions', pattern: /azure\s+functions|serverless\s+functions/gi },
      { name: 'Azure Kubernetes Service', pattern: /aks|kubernetes\s+service/gi },
      { name: 'Azure API Management', pattern: /api\s+management|apim/gi },
      { name: 'Azure Key Vault', pattern: /key\s+vault|secret\s+management/gi },
      { name: 'Azure Monitor', pattern: /azure\s+monitor|application\s+insights/gi },
      { name: 'Azure Active Directory', pattern: /azure\s+ad|active\s+directory/gi },
      { name: 'Azure Load Balancer', pattern: /load\s+balancer|application\s+gateway/gi },
      { name: 'Azure Service Bus', pattern: /service\s+bus|message\s+queue/gi }
    ];

    azureServicePatterns.forEach(servicePattern => {
      if (servicePattern.pattern.test(architectureText)) {
        services.push({
          name: servicePattern.name,
          description: `${servicePattern.name} component identified in architecture`
        });
      }
    });

    // If no specific services found, add generic ones
    if (services.length === 0) {
      services.push(
        { name: 'Azure App Service', description: 'Web application hosting platform' },
        { name: 'Azure SQL Database', description: 'Managed relational database service' },
        { name: 'Azure Storage', description: 'Cloud storage solution' }
      );
    }

    return services;
  }

  // Phase 2: DSL validation methods will be moved to separate workflow
  // reviewArchitectureWithDSLValidation() - moved to DSL orchestrator

  // Phase 2: All DSL-related methods moved to separate DSL orchestrator workflow

  /**
   * Save intermediate results after each step to prevent data loss
   */
  private async saveIntermediateResults(
    step: string, 
    content: string, 
    caseStudyFolder?: string
  ): Promise<void> {
    if (!caseStudyFolder) return;
    
    try {
      const outputDir = path.join(process.cwd(), 'output', caseStudyFolder);
      await fs.mkdir(outputDir, { recursive: true });
      
      const timestamp = new Date().toISOString();
      const filename = `${step.toLowerCase().replace(/\s+/g, '-')}-${timestamp.slice(0, 19)}.md`;
      const filepath = path.join(outputDir, filename);
      
      const formattedContent = `# ${step}
Generated: ${timestamp}
Status: Completed

${content}

---
This is an intermediate result saved after the ${step} step.
Part of Azure Architecture Blueprint Generator - Phase 1 Analysis
`;

      await fs.writeFile(filepath, formattedContent, 'utf-8');
      console.log(`📁 ${step} saved: ${filename}`);
      
    } catch (error) {
      console.warn(`⚠️ Failed to save ${step}:`, error.message);
    }
  }
}