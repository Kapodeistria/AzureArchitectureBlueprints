/**
 * Industry Patterns Research Agent
 * Researches architectural patterns, best practices, and industry standards
 */

import { BaseAgent } from './base-agent.js';

export class IndustryPatternsResearchAgent extends BaseAgent {
  constructor() {
    super('industry-patterns-research');
  }

  async research(caseStudyText: string, industry: string): Promise<string> {
    const researchPrompt = `As an enterprise architecture patterns researcher, analyze this case study to identify relevant architectural patterns, industry best practices, and reference architectures.

CASE STUDY:
${caseStudyText}

IDENTIFIED INDUSTRY: ${industry}

Research and provide:

## Relevant Architectural Patterns

### Microservices Patterns (if applicable)
- Service decomposition strategies
- Inter-service communication patterns
- Data consistency patterns
- Resilience patterns

### Cloud-Native Patterns
- 12-Factor App principles alignment
- Event-driven architecture patterns
- CQRS and Event Sourcing (if applicable)
- Serverless patterns

### Integration Patterns
- API Gateway patterns
- Message queue patterns
- ETL/ELT patterns
- Real-time data streaming patterns

### Security Patterns
- Zero Trust architecture
- Identity and access patterns
- Data encryption patterns
- API security patterns

## Industry-Specific Best Practices

### ${industry} Industry Standards
- Regulatory compliance patterns
- Data protection requirements
- Industry-specific security standards
- Performance benchmarks

### Reference Architectures
- Microsoft recommended architectures for ${industry}
- Well-architected framework alignment
- Proven enterprise patterns
- Scalability patterns for this industry

## Anti-Patterns to Avoid
- Common mistakes in ${industry} cloud migrations
- Performance bottlenecks to avoid
- Security vulnerabilities specific to this use case
- Cost optimization anti-patterns

## Technology Stack Recommendations
- Programming languages best suited
- Database technology choices
- Message queue technologies
- Caching strategies

## Scalability Considerations
- Expected growth patterns for ${industry}
- Performance requirements typical for this use case
- Geographic distribution considerations
- Peak load handling strategies

## Compliance & Governance
- Data residency requirements
- Audit and logging requirements
- Change management processes
- Disaster recovery patterns

Focus on battle-tested patterns that have proven successful in similar enterprise environments.`;

    try {
      return await this.callOpenAI([
        { role: 'system', content: 'You are an enterprise architecture patterns expert with deep knowledge of industry best practices, reference architectures, and proven design patterns.' },
        { role: 'user', content: researchPrompt }
      ]);
    } catch (error) {
      return `Research failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}