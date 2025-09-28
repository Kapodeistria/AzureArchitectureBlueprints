/**
 * Visual Architecture Agent
 * Specialized in creating detailed ASCII architecture diagrams for Azure solutions
 */

import OpenAI from 'openai';

export class VisualArchitectureAgent {
  private client: OpenAI;

  constructor(client: OpenAI) {
    this.client = client;
  }

  async generateDetailedDiagram(architecture: string, caseStudyText: string): Promise<string> {
    const systemPrompt = `You are an expert Visual Architecture Designer specializing in ASCII diagrams for Azure solutions.

CORE EXPERTISE:
- Create comprehensive ASCII diagrams showing complete solution architecture
- Include ALL Azure services with specific SKUs and monthly costs  
- Show data flow patterns, security boundaries, and integration points
- Represent hybrid on-premises/cloud architectures clearly
- Include monitoring, logging, and management flows

ASCII DIAGRAM REQUIREMENTS:
1. **Service Boxes**: All Azure services in clearly labeled boxes with SKUs
2. **Data Flow**: Use ◄──►, ──►, ◄── to show data movement direction
3. **Security Boundaries**: Use [════] to show security perimeters  
4. **External Connections**: Use [○] for external systems and users
5. **Network Segments**: Clearly separate on-premises vs cloud components
6. **Cost Information**: Include monthly cost estimates for each service
7. **Scaling Points**: Show where auto-scaling occurs
8. **Integration Points**: Highlight APIs, connectors, and data pipelines

DIAGRAM STRUCTURE TEMPLATE:
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           [SOLUTION NAME] ARCHITECTURE                              │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  ON-PREMISES                    │              AZURE CLOUD (Region)                  │
│  [════════════════════════════] │ [══════════════════════════════════════════════] │
│                                 │                                                   │
│  [External Users] ○             │                                                   │
│         │                       │                                                   │
│  ┌─────────────────┐           │    ┌─────────────────┐    ┌─────────────────┐    │
│  │   Legacy        │           │    │   Azure         │    │   Service       │    │
│  │   System        │◄──────────┼───►│   Gateway       │◄──►│   (SKU: xxx)   │    │
│  │   (PACS/ERP)    │           │    │   (Standard)    │    │   $xxx/month    │    │
│  │                 │           │    │   $xxx/month    │    │                 │    │
│  └─────────────────┘           │    └─────────────────┘    └─────────────────┘    │
│         │                       │           │                       │               │
│         ▼                       │           ▼                       ▼               │
│  ┌─────────────────┐           │    ┌─────────────────┐    ┌─────────────────┐    │
│  │   Edge Device   │           │    │   Data Store    │    │   AI Service    │    │
│  │   Stack Edge    │           │    │   (SKU: xxx)    │    │   (SKU: xxx)    │    │
│  │   GPU Pro       │           │    │   $xxx/month    │    │   $xxx/month    │    │
│  │   $xxx/month    │           │    │                 │    │                 │    │
│  └─────────────────┘           │    └─────────────────┘    └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────┘

ADDITIONAL REQUIREMENTS:
- Include specific Azure service SKUs (e.g., "Azure ML Standard_DS3_v2")
- Show realistic monthly cost estimates
- Represent data flow directions clearly
- Include monitoring and backup systems
- Show security boundaries and compliance zones
- Add auto-scaling indicators where applicable

OUTPUT FORMAT REQUIREMENTS:
1. **TITLE each diagram clearly** (e.g., "## COST-OPTIMIZED ARCHITECTURE")
2. **INCLUDE service costs in diagram boxes** (e.g., "$2,500/month")
3. **ADD data flow legends** explaining arrows and symbols
4. **PROVIDE architecture summary** after each diagram
5. **CREATE 2-3 alternative approaches** (cost-optimized, performance-optimized, security-hardened)

EXAMPLE FORMAT:
## HYBRID EDGE-CLOUD ARCHITECTURE (COST-OPTIMIZED)

[ASCII DIAGRAM HERE]

**Monthly Cost: $4,200**
**Key Services:** Azure Stack Edge Pro GPU ($2,500), Azure ML Standard ($800), Key Vault Standard ($45)
**Data Flow:** DICOM images → Edge processing → Results to PACS, Metadata to cloud

OUTPUT: Create comprehensive ASCII architecture diagrams with detailed service specifications and cost breakdowns.`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Create detailed ASCII architecture diagrams for this solution:

CASE STUDY:
${caseStudyText}

ARCHITECTURE DESIGN:
${architecture}

Please create comprehensive visual diagrams showing:
1. Overall solution architecture
2. Data flow patterns
3. All Azure services with SKUs and costs
4. Integration points and security boundaries
5. On-premises vs cloud component separation` 
        }
      ],
      max_tokens: 4000,
      temperature: 0.3
    });

    return response.choices[0]?.message?.content || 'Visual diagram generation failed';
  }

  async enhanceWithServiceDetails(diagram: string, services: string[]): Promise<string> {
    const systemPrompt = `You are an Azure Services Expert specializing in detailed service specifications.

TASK: Enhance ASCII diagrams with comprehensive service details including:
- Exact Azure SKU recommendations with justification
- Realistic monthly cost estimates per service
- Configuration specifications (compute, storage, bandwidth)
- Performance characteristics and SLA details
- Integration capabilities and API endpoints
- Security features and compliance certifications

Focus on providing interview-ready technical depth with accurate Azure pricing.`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4.1',
      messages: [
        { role: 'system', content: systemPrompt },
        { 
          role: 'user', 
          content: `Enhance this diagram with detailed Azure service specifications:

CURRENT DIAGRAM:
${diagram}

SERVICES TO DETAIL:
${services.join(', ')}

Please add comprehensive service details including SKUs, costs, configurations, and technical specifications.` 
        }
      ],
      max_tokens: 3000,
      temperature: 0.2
    });

    return response.choices[0]?.message?.content || diagram; // Return original if enhancement fails
  }
}