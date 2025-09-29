/**
 * Well-Architected Security Agent
 * Specialized agent for Azure Well-Architected Framework Security pillar
 * Focus: Confidentiality, integrity, availability, threat protection
 */

import OpenAI from 'openai';
import config from '../config/config.js';
import { BaseAgent } from './base-agent.js';
import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';

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
  securityScore: number; // 0-100 scale for granular optimization
  threatProtection: string[];
  identityManagement: string;
  dataProtection: string[];
  networkSecurity: string[];
  complianceAlignment: string;
  securityRecommendations: string[];
  azureSecurityServices: string[];
  wellArchitectedCompliance: string;
  criticalIssues: string[];
  improvementPotential: number; // How much score could improve
}

export class WellArchitectedSecurityAgent extends BaseAgent {
  private wafKnowledge: any = null;

  constructor(client: OpenAI) {
    super(client);
    this.loadWAFKnowledge();
  }

  /**
   * Load official Microsoft WAF Security knowledge base
   */
  private async loadWAFKnowledge(): Promise<void> {
    try {
      const knowledgePath = 'waf-knowledge-base/security-knowledge.json';
      if (existsSync(knowledgePath)) {
        const knowledgeData = await fs.readFile(knowledgePath, 'utf8');
        this.wafKnowledge = JSON.parse(knowledgeData);
        console.log('🔒 Security Agent: Loaded official Microsoft WAF knowledge (12 checklist items)');
      } else {
        console.warn('⚠️ Security Agent: WAF knowledge base not found - using built-in knowledge');
      }
    } catch (error) {
      console.warn('⚠️ Security Agent: Could not load WAF knowledge base:', error.message);
    }
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

**ASSESSMENT INSTRUCTIONS:**
1. Use the RAG knowledge base to reference official Microsoft WAF Security checklist items (SE:01 - SE:12)
2. Evaluate the architecture against each of the 12 official WAF Security requirements
3. Provide specific Azure service recommendations aligned with WAF principles
4. Score overall security posture (0-100) with detailed justification based on WAF compliance
5. Focus on Zero Trust principles and defense-in-depth strategies
6. Identify critical security issues that must be addressed
7. Calculate improvement potential and specific remediation steps

**SCORING GUIDANCE:**
- 90-100: Excellent WAF compliance, industry-leading security
- 80-89: Good security with minor gaps
- 70-79: Adequate security with notable improvements needed
- 60-69: Below average, significant security concerns
- 50-59: Poor security, major vulnerabilities present
- 0-49: Critical security failures, immediate action required

**OUTPUT REQUIREMENTS:**
- Reference specific WAF Security checklist items (SE:01, SE:02, etc.) in your analysis
- Provide concrete Azure security service recommendations
- Include compliance gap analysis and improvement roadmap
- Score each security area and provide overall WAF Security pillar score (0-100)
- List critical issues requiring immediate attention
- Calculate improvement potential with specific actions

Use the RAG knowledge base for detailed WAF Security methodology and checklist items.`
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
1. Security score (0-100) with detailed justification per WAF checklist item
2. Threat protection mechanisms and detection capabilities
3. Identity and access management strategy (Zero Trust alignment)
4. Data protection and encryption recommendations
5. Network security architecture and segmentation
6. Compliance alignment assessment (GDPR, HIPAA, SOX, etc.)
7. Prioritized security recommendations with Azure services
8. Well-Architected Framework security compliance
9. Security governance and monitoring strategy
10. Critical security issues requiring immediate remediation
11. Improvement potential calculation with specific action items

**SCORING FORMAT:**
Provide a granular 0-100 score based on:
- SE:01-SE:12 checklist item compliance (8 points each)
- Architecture quality and Azure service alignment (4 points)
- Critical issue penalties (-5 points per critical issue)
- Innovation bonus for advanced security features (+1-5 points)

Focus on defense-in-depth strategy and Zero Trust principles with specific Azure security services.`
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    return response.choices[0]?.message?.content || 'Security assessment failed';
  }

  private parseSecurityAnalysis(analysis: string): SecurityResult {
    // Extract security score (0-100 scale)
    const scoreMatch = analysis.match(/security score[:\s]*(\d+(?:\.\d+)?)/i);
    const securityScore = scoreMatch ? parseFloat(scoreMatch[1]) : 70;

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

    // Extract critical issues
    const criticalIssues = this.extractCriticalIssues(analysis);

    // Calculate improvement potential
    const improvementPotential = this.calculateImprovementPotential(securityScore, criticalIssues.length);

    return {
      securityScore: Math.min(Math.max(securityScore, 0), 100),
      threatProtection: threatProtection.slice(0, 5),
      identityManagement,
      dataProtection: dataProtection.slice(0, 5),
      networkSecurity: networkSecurity.slice(0, 5),
      complianceAlignment,
      securityRecommendations: recommendations.slice(0, 6),
      azureSecurityServices: azureServices.slice(0, 8),
      wellArchitectedCompliance: this.extractWAFSecurityCompliance(analysis),
      criticalIssues: criticalIssues.slice(0, 8),
      improvementPotential
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

  private extractCriticalIssues(analysis: string): string[] {
    const issues: string[] = [];
    const criticalPatterns = [
      /critical[^.]*issue[:\s]*([^.]+)/gi,
      /immediate[^.]*attention[:\s]*([^.]+)/gi,
      /security[^.]*vulnerability[:\s]*([^.]+)/gi,
      /urgent[^.]*fix[:\s]*([^.]+)/gi,
      /high[^.]*risk[:\s]*([^.]+)/gi
    ];

    for (const pattern of criticalPatterns) {
      const matches = analysis.match(pattern);
      if (matches) {
        for (const match of matches) {
          const cleanIssue = match.replace(/^(critical|immediate|security|urgent|high)[^:]*:\s*/i, '').trim();
          if (cleanIssue.length > 10 && cleanIssue.length < 200) {
            issues.push(cleanIssue);
          }
        }
      }
    }

    // Fallback: look for bullet points with critical keywords
    const lines = analysis.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if ((trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) &&
          /critical|urgent|immediate|vulnerability|risk|expose|breach/i.test(trimmed)) {
        const issue = trimmed.substring(1).trim();
        if (issue.length > 10) {
          issues.push(issue);
        }
      }
    }

    return [...new Set(issues)]; // Remove duplicates
  }

  private calculateImprovementPotential(currentScore: number, criticalIssueCount: number): number {
    // Base improvement potential
    let potential = 100 - currentScore;

    // Add bonus potential for addressing critical issues
    const criticalBonus = Math.min(criticalIssueCount * 8, 30); // Max 30 points from critical fixes

    // Diminishing returns for high scores
    if (currentScore > 80) {
      potential *= 0.7; // Harder to improve when already good
    } else if (currentScore > 60) {
      potential *= 0.9; // Some diminishing returns
    }

    return Math.min(Math.round(potential + criticalBonus), 100 - currentScore);
  }

  private getSecurityFallback(): SecurityResult {
    return {
      securityScore: 70, // Updated to 0-100 scale
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
      wellArchitectedCompliance: 'Security assessment temporarily unavailable - manual review recommended',
      criticalIssues: [
        'Security assessment failed - manual review required',
        'Unable to validate current security posture'
      ],
      improvementPotential: 30 // Potential improvement if assessment can be completed
    };
  }
}