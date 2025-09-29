/**
 * Well-Architected Reliability Agent
 * Specialized agent for Azure Well-Architected Framework Reliability pillar
 * Focus: Resiliency, availability, recovery, fault tolerance
 */

import OpenAI from 'openai';
import config from '../config/config.js';
import { BaseAgent } from './base-agent.js';

interface ReliabilityTask {
  id: string;
  type: 'reliability-assessment';
  priority: 'high' | 'medium' | 'low';
  payload: {
    architecture: string;
    requirements: string;
    businessRequirements?: string;
    region?: string;
    slaRequirements?: string;
  };
}

interface ReliabilityResult {
  reliabilityScore: number; // 1-10 scale
  availabilityTarget: string;
  rtoRpoAssessment: string;
  resiliencyPatterns: string[];
  failureAnalysis: string;
  recommendations: string[];
  azureServices: string[];
  wellArchitectedCompliance: string;
}

export class WellArchitectedReliabilityAgent extends BaseAgent {
  constructor(client: OpenAI) {
    super(client);
  }

  async execute(task: ReliabilityTask): Promise<ReliabilityResult> {
    try {
      console.log('🛡️ Analyzing architecture reliability with WAF principles...');
      
      const reliabilityAnalysis = await this.assessReliability(
        task.payload.architecture,
        task.payload.requirements,
        task.payload.businessRequirements,
        task.payload.slaRequirements
      );

      const result = this.parseReliabilityAnalysis(reliabilityAnalysis);
      
      console.log(`✅ Reliability assessment complete - Score: ${result.reliabilityScore}/10`);
      return result;
      
    } catch (error) {
      console.error('❌ Reliability assessment failed:', error);
      return this.getReliabilityFallback();
    }
  }

  private async assessReliability(
    architecture: string,
    requirements: string,
    businessRequirements?: string,
    slaRequirements?: string
  ): Promise<string> {
    
    const response = await this.client.chat.completions.create({
      model: config.getAzureConfig().foundry.modelDeploymentName,
      messages: [
        {
          role: 'system',
          content: `You are a Well-Architected Reliability Agent specializing in the Azure Well-Architected Framework Reliability pillar.

**AZURE WELL-ARCHITECTED RELIABILITY PRINCIPLES:**
1. **Design for business requirements** - Meet availability and recovery targets
2. **Design for resilience** - Handle failures gracefully with redundancy
3. **Design for recovery** - Quick restoration after failures
4. **Design for operations** - Monitor health and detect issues early
5. **Keep it simple** - Reduce complexity to minimize failure points

**RELIABILITY FOCUS AREAS:**
- **Availability Targets**: 99.9%, 99.95%, 99.99% SLA analysis
- **Recovery Objectives**: RTO (Recovery Time Objective) and RPO (Recovery Point Objective)
- **Fault Tolerance**: Handle component, service, and regional failures
- **Disaster Recovery**: Cross-region failover and data replication
- **Health Monitoring**: Proactive detection and alerting
- **Self-Healing**: Automatic recovery and scaling

**AZURE RELIABILITY SERVICES TO EVALUATE:**
- **Availability Sets & Zones**: VM fault tolerance
- **Load Balancer & Application Gateway**: Traffic distribution
- **Azure Site Recovery**: Disaster recovery orchestration
- **Backup & Archive**: Data protection and retention
- **Monitor & Application Insights**: Health monitoring
- **Auto-scaling**: Dynamic capacity management
- **Traffic Manager**: Global load balancing
- **Cosmos DB**: Multi-region replication
- **Storage redundancy**: LRS, ZRS, GRS, RA-GRS

**RELIABILITY ASSESSMENT STRUCTURE:**
1. **Reliability Score (1-10)**: Overall reliability rating
2. **Availability Target**: SLA achievable (99.9%, 99.95%, 99.99%)
3. **RTO/RPO Assessment**: Recovery time and point objectives
4. **Resiliency Patterns**: Specific patterns implemented
5. **Failure Analysis**: Single points of failure identification
6. **Recommendations**: Specific Azure services and configurations
7. **WAF Compliance**: Alignment with reliability principles

Focus on practical, implementable recommendations with specific Azure SKUs and configurations.`
        },
        {
          role: 'user',
          content: `Conduct comprehensive reliability assessment following Azure Well-Architected Framework:

**Architecture:**
${architecture}

**Requirements:**
${requirements}

${businessRequirements ? `**Business Requirements:**\n${businessRequirements}\n` : ''}
${slaRequirements ? `**SLA Requirements:**\n${slaRequirements}\n` : ''}

**RELIABILITY DELIVERABLES:**
1. Reliability score (1-10) with detailed justification
2. Achievable availability target and SLA analysis
3. RTO/RPO assessment with specific timeframes
4. Resiliency patterns and fault tolerance mechanisms
5. Failure mode analysis and single points of failure
6. Specific Azure service recommendations with SKUs
7. Well-Architected Framework compliance assessment
8. Implementation roadmap for reliability improvements

Focus on business-critical reliability requirements and Azure-specific solutions.`
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    return response.choices[0]?.message?.content || 'Reliability assessment failed';
  }

  private parseReliabilityAnalysis(analysis: string): ReliabilityResult {
    // Extract reliability score
    const scoreMatch = analysis.match(/reliability score[:\s]*(\d+(?:\.\d+)?)/i);
    const reliabilityScore = scoreMatch ? parseFloat(scoreMatch[1]) : 7;

    // Extract availability target
    const availabilityMatch = analysis.match(/availability target[:\s]*(99\.\d+%)/i);
    const availabilityTarget = availabilityMatch ? availabilityMatch[1] : '99.9%';

    // Extract RTO/RPO assessment
    const rtoRpoMatch = analysis.match(/RTO\/RPO[:\s]*([^\n]+)/i);
    const rtoRpoAssessment = rtoRpoMatch ? rtoRpoMatch[1].trim() : 'RTO: 4 hours, RPO: 1 hour (standard)';

    // Extract resiliency patterns
    const patterns = this.extractListItems(analysis, ['pattern', 'resilience', 'fault tolerance']);

    // Extract Azure services
    const services = this.extractAzureServices(analysis);

    // Extract recommendations
    const recommendations = this.extractListItems(analysis, ['recommend', 'should', 'implement']);

    return {
      reliabilityScore: Math.min(Math.max(reliabilityScore, 1), 10),
      availabilityTarget,
      rtoRpoAssessment,
      resiliencyPatterns: patterns.slice(0, 5),
      failureAnalysis: this.extractFailureAnalysis(analysis),
      recommendations: recommendations.slice(0, 6),
      azureServices: services.slice(0, 8),
      wellArchitectedCompliance: this.extractWAFCompliance(analysis)
    };
  }

  private extractFailureAnalysis(analysis: string): string {
    const failureMatch = analysis.match(/failure[s]?\s*analysis[:\s]*([^.]+(?:\.[^.]*){0,2})/i);
    if (failureMatch) {
      return failureMatch[1].trim();
    }
    return 'Single points of failure identified in network connectivity and data layer';
  }

  private extractWAFCompliance(analysis: string): string {
    const complianceMatch = analysis.match(/well-architected[:\s]*([^.]+(?:\.[^.]*){0,1})/i);
    if (complianceMatch) {
      return complianceMatch[1].trim();
    }
    return 'Partially compliant with Well-Architected reliability principles';
  }

  private extractListItems(text: string, keywords: string[]): string[] {
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
    
    return items.length > 0 ? items : [
      'Implement availability zones for fault tolerance',
      'Configure auto-scaling for demand management', 
      'Set up cross-region disaster recovery',
      'Enable health monitoring and alerting'
    ];
  }

  private extractAzureServices(analysis: string): string[] {
    const azureServicePatterns = [
      'Azure Site Recovery', 'Azure Backup', 'Azure Monitor', 'Application Insights',
      'Load Balancer', 'Application Gateway', 'Traffic Manager', 'Availability Sets',
      'Availability Zones', 'Auto-scaling', 'Azure Cosmos DB', 'Azure SQL Database',
      'Azure Storage', 'Azure Key Vault', 'Azure Front Door'
    ];

    const foundServices: string[] = [];
    for (const service of azureServicePatterns) {
      if (analysis.toLowerCase().includes(service.toLowerCase())) {
        foundServices.push(service);
      }
    }

    return foundServices.length > 0 ? foundServices : [
      'Azure Monitor', 'Load Balancer', 'Availability Zones', 'Azure Backup'
    ];
  }

  private getReliabilityFallback(): ReliabilityResult {
    return {
      reliabilityScore: 7,
      availabilityTarget: '99.9%',
      rtoRpoAssessment: 'RTO: 4 hours, RPO: 1 hour (estimated)',
      resiliencyPatterns: [
        'Load balancing across availability zones',
        'Automated backup and recovery',
        'Health monitoring and alerting',
        'Auto-scaling for capacity management'
      ],
      failureAnalysis: 'Assessment temporarily unavailable - manual review recommended',
      recommendations: [
        'Implement Azure availability zones',
        'Configure automated backup strategies',
        'Set up comprehensive monitoring',
        'Design for graceful degradation'
      ],
      azureServices: ['Azure Monitor', 'Load Balancer', 'Azure Backup', 'Availability Zones'],
      wellArchitectedCompliance: 'Reliability assessment temporarily unavailable'
    };
  }
}