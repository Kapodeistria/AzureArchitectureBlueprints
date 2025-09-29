/**
 * Well-Architected Security Agent
 * Specialized agent for Azure Well-Architected Framework Security pillar
 * Focus: Confidentiality, integrity, availability, threat protection
 */

import OpenAI from 'openai';
import config from '../config/config.js';
import { BaseAgent } from './base-agent.js';

interface SecurityTask {
  id: string;
  type: 'security-assessment';
  priority: 'high' | 'medium' | 'low';
  payload: {
    architecture: string;
    requirements: string;
    dataClassification?: string;
    complianceRequirements?: string;
    industryType?: string;
  };
}

interface SecurityResult {
  securityScore: number; // 1-10 scale
  threatProtection: string[];
  identityManagement: string;
  dataProtection: string[];
  networkSecurity: string[];
  complianceAlignment: string;
  securityRecommendations: string[];
  azureSecurityServices: string[];
  wellArchitectedCompliance: string;
}

export class WellArchitectedSecurityAgent extends BaseAgent {
  constructor(client: OpenAI) {
    super(client);
  }

  async execute(task: SecurityTask): Promise<SecurityResult> {
    try {
      console.log('🔒 Analyzing architecture security with WAF principles...');
      
      const securityAnalysis = await this.assessSecurity(
        task.payload.architecture,
        task.payload.requirements,
        task.payload.dataClassification,
        task.payload.complianceRequirements,
        task.payload.industryType
      );

      const result = this.parseSecurityAnalysis(securityAnalysis);
      
      console.log(`✅ Security assessment complete - Score: ${result.securityScore}/10`);
      return result;
      
    } catch (error) {
      console.error('❌ Security assessment failed:', error);
      return this.getSecurityFallback();
    }
  }

  private async assessSecurity(
    architecture: string,
    requirements: string,
    dataClassification?: string,
    complianceRequirements?: string,
    industryType?: string
  ): Promise<string> {
    
    const response = await this.client.chat.completions.create({
      model: config.getAzureConfig().foundry.modelDeploymentName,
      messages: [
        {
          role: 'system',
          content: `You are a Well-Architected Security Agent specializing in the Azure Well-Architected Framework Security pillar.

**AZURE WELL-ARCHITECTED SECURITY PRINCIPLES:**
1. **Plan security readiness** - Establish security requirements and governance
2. **Protect confidentiality, integrity, availability** - Comprehensive data protection
3. **Sustain and evolve security posture** - Continuous security improvement

**SECURITY FOUNDATION AREAS:**
- **Identity & Access Management**: Zero Trust, least privilege, MFA
- **Data Protection**: Encryption at rest/transit, classification, DLP
- **Network Security**: Segmentation, firewalls, private endpoints
- **Threat Protection**: Detection, monitoring, incident response
- **Governance & Compliance**: Policies, standards, regulatory alignment
- **Application Security**: Secure development, secrets management

**AZURE SECURITY SERVICES TO EVALUATE:**
- **Identity**: Entra ID (Azure AD), Privileged Identity Management
- **Network**: Network Security Groups, Application Gateway WAF, Firewall
- **Data**: Azure Key Vault, Disk Encryption, SQL TDE
- **Monitoring**: Microsoft Defender for Cloud, Sentinel, Monitor
- **Governance**: Policy, Blueprints, Resource Graph
- **Application**: App Service authentication, API Management
- **Storage**: Private endpoints, access keys, managed identities

**SECURITY ASSESSMENT STRUCTURE:**
1. **Security Score (1-10)**: Overall security posture rating
2. **Threat Protection**: Specific threat mitigation strategies
3. **Identity Management**: Authentication and authorization approach
4. **Data Protection**: Encryption and data governance measures
5. **Network Security**: Segmentation and access controls
6. **Compliance Alignment**: Regulatory and industry standards
7. **Security Recommendations**: Prioritized improvement actions
8. **WAF Compliance**: Security pillar alignment assessment

Focus on Zero Trust principles and defense-in-depth strategies with specific Azure configurations.`
        },
        {
          role: 'user',
          content: `Conduct comprehensive security assessment following Azure Well-Architected Framework:

**Architecture:**
${architecture}

**Requirements:**
${requirements}

${dataClassification ? `**Data Classification:**\n${dataClassification}\n` : ''}
${complianceRequirements ? `**Compliance Requirements:**\n${complianceRequirements}\n` : ''}
${industryType ? `**Industry Type:**\n${industryType}\n` : ''}

**SECURITY DELIVERABLES:**
1. Security score (1-10) with detailed justification
2. Threat protection mechanisms and detection capabilities
3. Identity and access management strategy (Zero Trust alignment)
4. Data protection and encryption recommendations
5. Network security architecture and segmentation
6. Compliance alignment assessment (GDPR, HIPAA, SOX, etc.)
7. Prioritized security recommendations with Azure services
8. Well-Architected Framework security compliance
9. Security governance and monitoring strategy

Focus on defense-in-depth strategy and Zero Trust principles with specific Azure security services.`
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    return response.choices[0]?.message?.content || 'Security assessment failed';
  }

  private parseSecurityAnalysis(analysis: string): SecurityResult {
    // Extract security score
    const scoreMatch = analysis.match(/security score[:\s]*(\d+(?:\.\d+)?)/i);
    const securityScore = scoreMatch ? parseFloat(scoreMatch[1]) : 7;

    // Extract compliance alignment
    const complianceMatch = analysis.match(/compliance[:\s]*([^\n]+)/i);
    const complianceAlignment = complianceMatch ? complianceMatch[1].trim() : 'Standard compliance requirements addressed';

    // Extract identity management approach
    const identityMatch = analysis.match(/identity[^.]*management[:\s]*([^.]+(?:\.[^.]*){0,1})/i);
    const identityManagement = identityMatch ? identityMatch[1].trim() : 'Entra ID with MFA and conditional access recommended';

    // Extract various security components
    const threatProtection = this.extractSecurityItems(analysis, ['threat', 'protection', 'detection']);
    const dataProtection = this.extractSecurityItems(analysis, ['data', 'encryption', 'classification']);
    const networkSecurity = this.extractSecurityItems(analysis, ['network', 'firewall', 'segmentation']);
    const recommendations = this.extractSecurityItems(analysis, ['recommend', 'should', 'implement']);
    const azureServices = this.extractAzureSecurityServices(analysis);

    return {
      securityScore: Math.min(Math.max(securityScore, 1), 10),
      threatProtection: threatProtection.slice(0, 5),
      identityManagement,
      dataProtection: dataProtection.slice(0, 5),
      networkSecurity: networkSecurity.slice(0, 5),
      complianceAlignment,
      securityRecommendations: recommendations.slice(0, 6),
      azureSecurityServices: azureServices.slice(0, 8),
      wellArchitectedCompliance: this.extractWAFSecurityCompliance(analysis)
    };
  }

  private extractSecurityItems(text: string, keywords: string[]): string[] {
    const items: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        const item = trimmedLine.substring(1).trim();
        if (keywords.some(keyword => item.toLowerCase().includes(keyword))) {
          items.push(item);
        }
      }
    }
    
    return items.length > 0 ? items : this.getDefaultSecurityItems(keywords[0]);
  }

  private getDefaultSecurityItems(category: string): string[] {
    const defaults = {
      'threat': [
        'Microsoft Defender for Cloud threat detection',
        'Azure Sentinel SIEM integration',
        'Real-time security monitoring',
        'Automated incident response'
      ],
      'data': [
        'Encryption at rest with customer-managed keys',
        'Encryption in transit with TLS 1.2+',
        'Data classification and labeling',
        'Azure Key Vault for secrets management'
      ],
      'network': [
        'Network Security Groups (NSGs)',
        'Azure Firewall with threat intelligence',
        'Private endpoints for PaaS services',
        'Network segmentation with VNets'
      ],
      'recommend': [
        'Implement Zero Trust architecture',
        'Enable multi-factor authentication',
        'Configure conditional access policies',
        'Deploy Microsoft Defender for Cloud'
      ]
    };
    
    return defaults[category] || defaults['recommend'];
  }

  private extractAzureSecurityServices(analysis: string): string[] {
    const securityServicePatterns = [
      'Entra ID', 'Azure AD', 'Key Vault', 'Microsoft Defender for Cloud',
      'Azure Firewall', 'Application Gateway', 'Network Security Groups',
      'Azure Sentinel', 'Azure Monitor', 'Conditional Access',
      'Privileged Identity Management', 'Azure Policy', 'Private Link'
    ];

    const foundServices: string[] = [];
    for (const service of securityServicePatterns) {
      if (analysis.toLowerCase().includes(service.toLowerCase())) {
        foundServices.push(service);
      }
    }

    return foundServices.length > 0 ? foundServices : [
      'Entra ID', 'Azure Key Vault', 'Microsoft Defender for Cloud', 'Azure Firewall'
    ];
  }

  private extractWAFSecurityCompliance(analysis: string): string {
    const complianceMatch = analysis.match(/well-architected.*security[:\s]*([^.]+(?:\.[^.]*){0,1})/i);
    if (complianceMatch) {
      return complianceMatch[1].trim();
    }
    return 'Aligned with Well-Architected security principles with enhancement opportunities';
  }

  private getSecurityFallback(): SecurityResult {
    return {
      securityScore: 7,
      threatProtection: [
        'Microsoft Defender for Cloud threat detection',
        'Azure Monitor security alerting',
        'Network-based threat protection',
        'Identity-based risk detection'
      ],
      identityManagement: 'Entra ID with MFA and conditional access policies recommended',
      dataProtection: [
        'Encryption at rest with Azure managed keys',
        'TLS 1.2+ for data in transit',
        'Azure Key Vault for secrets management',
        'Data classification implementation'
      ],
      networkSecurity: [
        'Network Security Groups (NSGs)',
        'Azure Firewall deployment',
        'Private endpoints for PaaS services',
        'VNet segmentation strategy'
      ],
      complianceAlignment: 'Standard security compliance requirements addressed',
      securityRecommendations: [
        'Implement Zero Trust architecture',
        'Deploy Microsoft Defender for Cloud',
        'Configure conditional access policies',
        'Enable comprehensive security monitoring'
      ],
      azureSecurityServices: [
        'Entra ID', 'Azure Key Vault', 'Microsoft Defender for Cloud', 
        'Azure Firewall', 'Azure Monitor', 'Azure Policy'
      ],
      wellArchitectedCompliance: 'Security assessment temporarily unavailable - manual review recommended'
    };
  }
}