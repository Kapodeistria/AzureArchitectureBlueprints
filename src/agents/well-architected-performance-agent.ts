/**
 * Well-Architected Performance Efficiency Agent
 * Specialized agent for Azure Well-Architected Framework Performance Efficiency pillar
 * Focus: Scalability, optimization, capacity planning, performance targets
 */

import OpenAI from 'openai';
import config from '../config/config.js';
import { BaseAgent } from './base-agent.js';

interface PerformanceTask {
  id: string;
  type: 'performance-assessment';
  priority: 'high' | 'medium' | 'low';
  payload: {
    architecture: string;
    requirements: string;
    expectedLoad?: string;
    performanceTargets?: string;
    criticalFlows?: string;
  };
}

interface PerformanceResult {
  performanceScore: number; // 1-10 scale
  scalabilityAssessment: string;
  performanceTargets: string[];
  optimizationRecommendations: string[];
  scalingPatterns: string[];
  monitoringStrategy: string;
  bottleneckAnalysis: string[];
  azurePerformanceServices: string[];
  wellArchitectedCompliance: string;
}

export class WellArchitectedPerformanceAgent extends BaseAgent {
  constructor(client: OpenAI) {
    super(client);
  }

  async execute(task: PerformanceTask): Promise<PerformanceResult> {
    try {
      console.log('⚡ Analyzing architecture performance efficiency with WAF principles...');
      
      const performanceAnalysis = await this.assessPerformance(
        task.payload.architecture,
        task.payload.requirements,
        task.payload.expectedLoad,
        task.payload.performanceTargets,
        task.payload.criticalFlows
      );

      const result = this.parsePerformanceAnalysis(performanceAnalysis);
      
      console.log(`✅ Performance assessment complete - Score: ${result.performanceScore}/10`);
      return result;
      
    } catch (error) {
      console.error('❌ Performance assessment failed:', error);
      return this.getPerformanceFallback();
    }
  }

  private async assessPerformance(
    architecture: string,
    requirements: string,
    expectedLoad?: string,
    performanceTargets?: string,
    criticalFlows?: string
  ): Promise<string> {
    
    const response = await this.client.chat.completions.create({
      model: config.getAzureConfig().foundry.modelDeploymentName,
      messages: [
        {
          role: 'system',
          content: `You are a Well-Architected Performance Efficiency Agent specializing in the Azure Well-Architected Framework Performance Efficiency pillar.

**AZURE WELL-ARCHITECTED PERFORMANCE PRINCIPLES:**
1. **Negotiate realistic performance targets** - Set achievable SLAs and KPIs
2. **Design to meet capacity requirements** - Right-size resources and plan for growth
3. **Achieve and sustain performance** - Optimize continuously across all layers
4. **Improve efficiency through optimization** - Eliminate waste and enhance utilization

**PERFORMANCE EFFICIENCY FOCUS AREAS:**
- **Performance Targets**: Response time, throughput, latency SLAs
- **Capacity Planning**: Resource sizing, auto-scaling, growth planning
- **Optimization**: Code, database, network, storage performance
- **Scaling Patterns**: Horizontal vs vertical, microservices, partitioning
- **Monitoring & Testing**: Performance testing, APM, load testing
- **Resource Efficiency**: Cost-performance optimization

**AZURE PERFORMANCE SERVICES TO EVALUATE:**
- **Compute**: VM sizes, App Service plans, Container instances
- **Storage**: Premium SSD, Ultra Disk, Blob tiers, caching
- **Database**: Azure SQL tiers, Cosmos DB RU optimization
- **Networking**: ExpressRoute, CDN, Traffic Manager, Load Balancer
- **Monitoring**: Application Insights, Azure Monitor, Load Testing
- **Caching**: Redis Cache, CDN, Application Gateway caching
- **Auto-scaling**: VMSS, App Service auto-scale, AKS HPA

**PERFORMANCE ASSESSMENT STRUCTURE:**
1. **Performance Score (1-10)**: Overall performance efficiency rating
2. **Scalability Assessment**: Horizontal/vertical scaling capabilities
3. **Performance Targets**: Specific SLAs and KPIs achievable
4. **Optimization Recommendations**: Layer-specific improvements
5. **Scaling Patterns**: Architecture patterns for growth
6. **Monitoring Strategy**: Performance tracking and alerting
7. **Bottleneck Analysis**: Potential performance constraints
8. **Azure Services**: Specific performance-optimized services
9. **WAF Compliance**: Performance efficiency pillar alignment

Focus on measurable performance improvements with specific Azure SKUs and configurations.`
        },
        {
          role: 'user',
          content: `Conduct comprehensive performance efficiency assessment following Azure Well-Architected Framework:

**Architecture:**
${architecture}

**Requirements:**
${requirements}

${expectedLoad ? `**Expected Load:**\n${expectedLoad}\n` : ''}
${performanceTargets ? `**Performance Targets:**\n${performanceTargets}\n` : ''}
${criticalFlows ? `**Critical Performance Flows:**\n${criticalFlows}\n` : ''}

**PERFORMANCE DELIVERABLES:**
1. Performance score (1-10) with detailed justification
2. Scalability assessment and capacity planning analysis
3. Realistic performance targets and SLA recommendations
4. Layer-specific optimization recommendations (compute, storage, network, database)
5. Scaling patterns and auto-scaling strategies
6. Comprehensive monitoring and testing strategy
7. Bottleneck analysis and performance constraints identification
8. Azure performance services with specific SKU recommendations
9. Well-Architected Framework performance compliance assessment
10. Performance testing and validation approach

Focus on measurable performance improvements and cost-performance optimization.`
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    return response.choices[0]?.message?.content || 'Performance assessment failed';
  }

  private parsePerformanceAnalysis(analysis: string): PerformanceResult {
    // Extract performance score
    const scoreMatch = analysis.match(/performance score[:\s]*(\d+(?:\.\d+)?)/i);
    const performanceScore = scoreMatch ? parseFloat(scoreMatch[1]) : 7;

    // Extract scalability assessment
    const scalabilityMatch = analysis.match(/scalability[^.]*assessment[:\s]*([^.]+(?:\.[^.]*){0,2})/i);
    const scalabilityAssessment = scalabilityMatch ? scalabilityMatch[1].trim() : 'Horizontal scaling supported with auto-scaling capabilities';

    // Extract monitoring strategy
    const monitoringMatch = analysis.match(/monitoring[^.]*strategy[:\s]*([^.]+(?:\.[^.]*){0,1})/i);
    const monitoringStrategy = monitoringMatch ? monitoringMatch[1].trim() : 'Application Insights with custom metrics and alerting';

    // Extract various performance components
    const performanceTargets = this.extractPerformanceItems(analysis, ['target', 'sla', 'latency', 'throughput']);
    const optimizations = this.extractPerformanceItems(analysis, ['optimization', 'improve', 'enhance']);
    const scalingPatterns = this.extractPerformanceItems(analysis, ['scaling', 'scale', 'pattern']);
    const bottlenecks = this.extractPerformanceItems(analysis, ['bottleneck', 'constraint', 'limitation']);
    const azureServices = this.extractAzurePerformanceServices(analysis);

    return {
      performanceScore: Math.min(Math.max(performanceScore, 1), 10),
      scalabilityAssessment,
      performanceTargets: performanceTargets.slice(0, 5),
      optimizationRecommendations: optimizations.slice(0, 6),
      scalingPatterns: scalingPatterns.slice(0, 4),
      monitoringStrategy,
      bottleneckAnalysis: bottlenecks.slice(0, 4),
      azurePerformanceServices: azureServices.slice(0, 8),
      wellArchitectedCompliance: this.extractWAFPerformanceCompliance(analysis)
    };
  }

  private extractPerformanceItems(text: string, keywords: string[]): string[] {
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
    
    return items.length > 0 ? items : this.getDefaultPerformanceItems(keywords[0]);
  }

  private getDefaultPerformanceItems(category: string): string[] {
    const defaults = {
      'target': [
        'Response time < 200ms for web requests',
        'Database query latency < 50ms',
        'API throughput > 1000 req/sec',
        '99.9% availability SLA'
      ],
      'optimization': [
        'Implement Azure CDN for static content',
        'Configure database connection pooling',
        'Enable Application Gateway caching',
        'Optimize storage access patterns'
      ],
      'scaling': [
        'Horizontal auto-scaling for web tier',
        'Database read replicas for query scaling', 
        'Microservices decomposition pattern',
        'Load balancing across availability zones'
      ],
      'bottleneck': [
        'Database connection limits',
        'Network bandwidth constraints',
        'Storage IOPS limitations',
        'Memory allocation inefficiencies'
      ]
    };
    
    return defaults[category] || defaults['optimization'];
  }

  private extractAzurePerformanceServices(analysis: string): string[] {
    const performanceServicePatterns = [
      'Application Insights', 'Azure Monitor', 'Load Balancer', 'Application Gateway',
      'Azure CDN', 'Redis Cache', 'Premium SSD', 'Ultra Disk',
      'Azure SQL Database', 'Cosmos DB', 'Auto-scaling', 'Traffic Manager',
      'ExpressRoute', 'Azure Load Testing', 'Container Instances'
    ];

    const foundServices: string[] = [];
    for (const service of performanceServicePatterns) {
      if (analysis.toLowerCase().includes(service.toLowerCase())) {
        foundServices.push(service);
      }
    }

    return foundServices.length > 0 ? foundServices : [
      'Application Insights', 'Azure CDN', 'Load Balancer', 'Premium SSD'
    ];
  }

  private extractWAFPerformanceCompliance(analysis: string): string {
    const complianceMatch = analysis.match(/well-architected.*performance[:\s]*([^.]+(?:\.[^.]*){0,1})/i);
    if (complianceMatch) {
      return complianceMatch[1].trim();
    }
    return 'Aligned with Well-Architected performance efficiency principles';
  }

  private getPerformanceFallback(): PerformanceResult {
    return {
      performanceScore: 7,
      scalabilityAssessment: 'Horizontal scaling supported with auto-scaling capabilities',
      performanceTargets: [
        'Web response time < 200ms',
        'Database latency < 50ms',
        'API throughput > 1000 req/sec',
        '99.9% availability target'
      ],
      optimizationRecommendations: [
        'Implement Azure CDN for static content delivery',
        'Configure database connection pooling',
        'Enable Application Gateway caching',
        'Optimize storage access patterns',
        'Configure auto-scaling policies'
      ],
      scalingPatterns: [
        'Horizontal auto-scaling for web tier',
        'Database read replicas for scaling',
        'Load balancing across zones',
        'Microservices decomposition'
      ],
      monitoringStrategy: 'Application Insights with custom metrics and performance alerting',
      bottleneckAnalysis: [
        'Database connection pool limits',
        'Network bandwidth constraints',
        'Storage IOPS limitations',
        'Memory allocation efficiency'
      ],
      azurePerformanceServices: [
        'Application Insights', 'Azure CDN', 'Load Balancer', 
        'Premium SSD', 'Auto-scaling', 'Redis Cache'
      ],
      wellArchitectedCompliance: 'Performance assessment temporarily unavailable - manual review recommended'
    };
  }
}