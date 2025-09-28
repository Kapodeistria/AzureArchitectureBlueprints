/**
 * Azure Services Research Agent
 * Researches latest Azure services, pricing, and capabilities relevant to case study
 */

import { BaseAgent } from './base-agent.js';

export class AzureServicesResearchAgent extends BaseAgent {
  constructor() {
    super('azure-services-research');
  }

  async research(caseStudyText: string, requirements: string): Promise<string> {
    const researchPrompt = `As an Azure services research specialist, analyze this case study and requirements to identify the most relevant and up-to-date Azure services.

CASE STUDY:
${caseStudyText}

REQUIREMENTS:
${requirements}

Research and provide:

## Relevant Azure Services

### Compute Services
- Recommended services with current pricing tiers
- Performance characteristics
- Scaling capabilities
- Latest features (2024-2025)

### Data Services  
- Database options with pros/cons
- Data lake/warehouse solutions
- Backup and disaster recovery options
- Current pricing models

### Networking Services
- CDN and edge solutions
- Load balancing options
- Security networking features
- Global connectivity options

### AI/ML Services (if applicable)
- Cognitive Services updates
- OpenAI integration options
- Machine learning platforms
- Current pricing and limits

### Security & Compliance Services
- Identity and access management
- Encryption and key management
- Compliance frameworks supported
- Security monitoring tools

### Monitoring & Management
- Application insights options
- Infrastructure monitoring
- Cost management tools
- DevOps integration

## Service Recommendations Matrix

| Requirement | Primary Service | Alternative | Rationale |
|-------------|----------------|-------------|-----------|
| [Auto-generate based on requirements] |

## Latest Updates & Considerations
- New service announcements (2024-2025)
- Deprecated services to avoid
- Regional availability considerations
- Integration capabilities

## Estimated Service Costs Range
- Low-end configuration: $X/month
- Mid-tier configuration: $X/month  
- High-end configuration: $X/month

Focus on services that are production-ready, cost-effective, and align with the specific requirements identified.`;

    try {
      return await this.callOpenAI([
        { role: 'system', content: 'You are an expert Azure services researcher with up-to-date knowledge of Azure services, pricing, and capabilities. Provide thorough, accurate research.' },
        { role: 'user', content: researchPrompt }
      ]);
    } catch (error) {
      return `Research failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}