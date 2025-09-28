/**
 * Architecture Agent
 * Senior Azure Solution Architect designing comprehensive cloud solutions
 */

import OpenAI from 'openai';

export class ArchitectureAgent {
  private client: OpenAI;

  constructor(client: OpenAI) {
    this.client = client;
  }

  async design(caseStudyText: string, requirements: string, researchData?: any): Promise<string> {
    const systemPrompt = `You are a Senior Microsoft Azure Solution Architect with deep expertise in enterprise cloud architecture and visual architecture design.

AZURE SERVICES MASTERY:
COMPUTE: Azure Kubernetes Service (AKS), App Service (P1V2/P2V2/P3V2), Container Apps, Azure Functions (Y1/EP1/EP2), Azure Batch, Service Fabric, Virtual Machines (D2s_v3/D4s_v3)
DATA: Cosmos DB (400-4000 RU/s), Azure SQL Database (S2/S3/P1), PostgreSQL (GP_Gen5_2/GP_Gen5_4), Synapse Analytics (DW100c/DW200c), Data Factory (5 pipelines), Data Lake Storage (Hot/Cool/Archive)
AI/ML: Azure OpenAI Service (PTU-50/PTU-100), Azure AI Search (Standard S1/S2), Document Intelligence, Machine Learning Studio, AI Studio, Form Recognizer
INTEGRATION: Service Bus (Standard/Premium), Event Grid (Basic), Logic Apps (Standard), API Management (Developer/Standard/Premium), Event Hubs (Standard 1TU)
SECURITY: Azure Entra ID (P1/P2), Key Vault (Standard), Defender for Cloud (Standard), Private Link, Application Gateway (Standard_v2), WAF
NETWORKING: Virtual Network, Azure Front Door (Standard), Load Balancer (Standard), Traffic Manager, ExpressRoute (50Mbps/100Mbps), VPN Gateway (VpnGw1/VpnGw2)
MONITORING: Azure Monitor, Log Analytics (Pay-as-you-go), Application Insights, Microsoft Sentinel

ARCHITECTURE PATTERNS:
- Microservices with AKS
- Serverless with Functions and Logic Apps  
- Event-driven with Service Bus/Event Grid
- API-first with API Management
- Data mesh with Synapse and Data Factory
- Zero-trust security model
- Hybrid cloud with Azure Stack Edge
- Multi-region disaster recovery

VISUAL ARCHITECTURE REQUIREMENTS:
You MUST create detailed ASCII diagrams showing:
- All Azure services with specific SKUs
- Data flow directions (◄──►, ──►, ◄──)
- Security boundaries [════]
- External connections [○]
- Load balancing and scaling points
- Network segments and subnets
- Monitoring and logging flows

DESIGN APPROACH:
1. Analyze requirements and constraints
2. Design 3 distinct solutions:
   - COST-OPTIMIZED: Minimize monthly spend while meeting requirements
   - PERFORMANCE-OPTIMIZED: Maximum scalability and performance  
   - SECURITY-HARDENED: Enterprise security and compliance focus

FOR EACH SOLUTION PROVIDE:
1. **DETAILED ASCII ARCHITECTURE DIAGRAM** (mandatory)
2. **AZURE SERVICES TABLE** with exact SKUs and monthly costs
3. **ARCHITECTURE PATTERNS** used and design decisions
4. **DATA FLOW DESCRIPTION** matching the diagram
5. **SECURITY BOUNDARIES** and compliance measures
6. **SCALABILITY APPROACH** and performance characteristics
7. **ESTIMATED MONTHLY COSTS** breakdown by service
8. **PROS AND CONS** with business impact

ASCII DIAGRAM FORMAT:
┌─────────────────────────────────────────────────────────────┐
│                    SOLUTION ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────┤
│  [External Users] ○                                        │
│         │                                                   │
│  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    │
│  │   Azure     │◄──►│   Service    │◄──►│   Backend   │    │
│  │   Front     │    │   (SKU)      │    │   (SKU)     │    │
│  │   Door      │    │              │    │             │    │
│  └─────────────┘    └──────────────┘    └─────────────┘    │
└─────────────────────────────────────────────────────────────┘

OUTPUT: Enterprise-grade architecture options with detailed visual diagrams and comprehensive technical justification.`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: this.buildDesignPrompt(caseStudyText, requirements, researchData) }
      ],
      max_tokens: 3500,
      temperature: 0.4
    });

    return response.choices[0]?.message?.content || '';
  }

  async refine(
    currentArchitecture: string,
    reviewFeedback: string,
    criticalIssues: string[],
    improvements: string[]
  ): Promise<string> {
    const refinementSystemPrompt = `You are a Senior Microsoft Azure Solution Architect with deep expertise in enterprise cloud architecture and visual architecture design. You excel at refining architectures based on review feedback.

You MUST include detailed ASCII architecture diagrams in your refined solution, showing all Azure services with specific SKUs, data flow directions, and security boundaries.`;

    const refinementPrompt = `As a Senior Azure Solution Architect, refine this architecture based on detailed review feedback.

CURRENT ARCHITECTURE:
${currentArchitecture}

REVIEW FEEDBACK:
${reviewFeedback}

CRITICAL ISSUES TO ADDRESS:
${criticalIssues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')}

IMPROVEMENTS TO IMPLEMENT:
${improvements.map((improvement, index) => `${index + 1}. ${improvement}`).join('\n')}

Refine the architecture by:

1. **Addressing Critical Issues**: Fix all critical issues that could impact production
2. **Implementing Improvements**: Incorporate suggested enhancements  
3. **Maintaining Requirements**: Ensure all original requirements are still met
4. **Optimizing Design**: Improve overall architecture quality

Provide the refined architecture with:
- **DETAILED ASCII ARCHITECTURE DIAGRAM** (mandatory)
- Clear explanations of what changed and why
- How each critical issue was resolved
- Which improvements were implemented
- Any trade-offs made during refinement

Focus on creating a production-ready, enterprise-grade solution.`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: refinementSystemPrompt },
        { role: 'user', content: refinementPrompt }
      ],
      max_tokens: 3500,
      temperature: 0.4
    });

    return response.choices[0]?.message?.content || 'Refinement failed';
  }

  private buildDesignPrompt(caseStudyText: string, requirements: string, researchData?: any): string {
    let prompt = `Based on this case study and requirements analysis, design 3 comprehensive Azure architecture solutions:\n\nCASE STUDY:\n${caseStudyText}\n\nREQUIREMENTS ANALYSIS:\n${requirements}`;
    
    if (researchData) {
      prompt += `\n\nRESEARCH INSIGHTS:\n\nAzure Services Research:\n${researchData.azureServices}\n\nIndustry Patterns:\n${researchData.industryPatterns}\n\nCompliance Requirements:\n${researchData.compliance}`;
      prompt += `\n\nIMPORTANT: Use the research insights above to inform your architecture design. Incorporate the latest Azure services, proven industry patterns, and compliance requirements identified in the research.`;
    }
    
    return prompt;
  }
}