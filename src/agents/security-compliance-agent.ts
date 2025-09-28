/**
 * Security & Compliance Research Agent
 * Researches security requirements, compliance frameworks, and regulatory standards
 */

import { BaseAgent } from './base-agent.js';

export class SecurityComplianceAgent extends BaseAgent {
  constructor() {
    super('security-compliance');
  }

  async analyze(caseStudyText: string): Promise<string> {
    const analysisPrompt = `As a cybersecurity and compliance expert, analyze this case study to identify security and compliance requirements.

CASE STUDY:
${caseStudyText}

Analyze and provide:

## Security Requirements Analysis

### Data Classification & Protection
- Identify sensitive data types (PII, PHI, financial, etc.)
- Data residency requirements
- Encryption requirements (at-rest, in-transit)
- Data retention and disposal policies

### Identity & Access Management
- Authentication requirements
- Authorization models needed
- Privileged access management
- Multi-factor authentication requirements

### Network Security
- Network segmentation requirements
- Firewall and WAF needs
- VPN and private connectivity
- DDoS protection requirements

### Monitoring & Logging
- Security monitoring requirements
- Audit logging needs
- SIEM integration requirements
- Compliance reporting needs

## Compliance Framework Analysis

### Regulatory Compliance (if applicable)
- GDPR (EU data protection)
- CCPA (California privacy)
- HIPAA (Healthcare)
- PCI DSS (Payment card)
- SOC 2 (Service organization controls)
- SOX (Financial reporting)
- Industry-specific regulations

### Azure Compliance Services
- Azure Policy recommendations
- Azure Security Center configurations
- Compliance Manager settings
- Azure Sentinel setup requirements

### Compliance Controls Mapping
- Technical controls required
- Administrative controls needed
- Physical controls considerations
- Compensating controls available

## Security Architecture Recommendations

### Azure Security Services
- Azure AD/Entra ID configuration
- Key Vault for secret management
- Azure Security Center/Defender
- Azure Sentinel for SIEM
- Application Gateway with WAF
- Private Link and Private Endpoints
- Network Security Groups (NSGs)

### Best Practices Implementation
- Zero Trust architecture principles
- Least privilege access model
- Defense in depth strategy
- Security by design approach

## Risk Assessment

### Security Risks
- Data breach risks
- Insider threat risks
- Cloud misconfiguration risks
- Third-party integration risks

### Compliance Risks
- Regulatory penalties
- Audit failures
- Data sovereignty issues
- Privacy violations

## Implementation Priorities

### Phase 1 - Foundation (Critical)
- Identity and access management
- Network security baseline
- Data encryption setup
- Basic monitoring

### Phase 2 - Enhanced (Important)
- Advanced threat protection
- Compliance automation
- Enhanced monitoring/SIEM
- Security training

### Phase 3 - Optimization (Recommended)
- Security optimization
- Advanced compliance features
- Threat intelligence integration
- Continuous compliance monitoring

Focus on practical, implementable security and compliance measures that align with the business requirements and industry standards.`;

    try {
      return await this.callOpenAI([
        { role: 'system', content: 'You are a cybersecurity and compliance expert with deep knowledge of Azure security services, regulatory frameworks, and industry best practices.' },
        { role: 'user', content: analysisPrompt }
      ]);
    } catch (error) {
      return `Security compliance analysis failed: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}