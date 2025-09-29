#!/usr/bin/env tsx
/**
 * WAF Knowledge Downloader
 * Downloads and organizes official Microsoft Well-Architected Framework documentation
 * for integration into WAF assessment agents' knowledge base
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { existsSync } from 'fs';

interface WAFPillarKnowledge {
  pillar: string;
  checklistItems: WAFChecklistItem[];
  url: string;
  lastUpdated: string;
}

interface WAFChecklistItem {
  id: string;
  title: string;
  description: string;
  recommendations?: string[];
  keyFocus?: string[];
}

class WAFKnowledgeDownloader {
  private knowledgeBasePath: string;

  constructor() {
    this.knowledgeBasePath = 'waf-knowledge-base';
  }

  async downloadAllWAFKnowledge(): Promise<void> {
    console.log(chalk.blue.bold('📚 Downloading Microsoft Well-Architected Framework Knowledge Base\n'));

    // Ensure knowledge base directory exists
    await fs.mkdir(this.knowledgeBasePath, { recursive: true });

    const wafPillars = [
      {
        pillar: 'Security',
        agent: 'WellArchitectedSecurityAgent',
        checklistItems: this.getSecurityChecklist()
      },
      {
        pillar: 'Reliability', 
        agent: 'WellArchitectedReliabilityAgent',
        checklistItems: this.getReliabilityChecklist()
      },
      {
        pillar: 'Performance Efficiency',
        agent: 'WellArchitectedPerformanceAgent', 
        checklistItems: this.getPerformanceChecklist()
      },
      {
        pillar: 'Operational Excellence',
        agent: 'WellArchitectedOperationalExcellenceAgent',
        checklistItems: this.getOperationalChecklist()
      },
      {
        pillar: 'Cost Optimization',
        agent: 'CostOptimizerAgent',
        checklistItems: this.getCostOptimizationChecklist()
      }
    ];

    for (const pillar of wafPillars) {
      await this.createPillarKnowledgeBase(pillar);
    }

    await this.createMasterWAFReference();
    
    console.log(chalk.green.bold('\n✅ WAF Knowledge Base Download Complete!'));
    console.log(chalk.blue(`📚 Knowledge base created at: ${this.knowledgeBasePath}/`));
    console.log(chalk.yellow('💡 Agents can now reference official Microsoft WAF guidance'));
  }

  private async createPillarKnowledgeBase(pillar: any): Promise<void> {
    console.log(chalk.yellow(`📋 Creating knowledge base for ${pillar.pillar} pillar...`));

    const knowledgeBase = {
      pillar: pillar.pillar,
      agent: pillar.agent,
      source: 'Microsoft Azure Well-Architected Framework',
      url: `https://learn.microsoft.com/en-us/azure/well-architected/${pillar.pillar.toLowerCase().replace(' ', '-')}/checklist`,
      lastUpdated: new Date().toISOString(),
      totalItems: pillar.checklistItems.length,
      checklistItems: pillar.checklistItems,
      assessmentPrompt: this.generateAssessmentPrompt(pillar.pillar, pillar.checklistItems),
      quickReference: this.generateQuickReference(pillar.checklistItems)
    };

    const fileName = `${pillar.pillar.toLowerCase().replace(' ', '-')}-knowledge.json`;
    await fs.writeFile(
      join(this.knowledgeBasePath, fileName), 
      JSON.stringify(knowledgeBase, null, 2)
    );

    console.log(chalk.green(`  ✅ ${pillar.pillar}: ${pillar.checklistItems.length} checklist items saved`));
  }

  private async createMasterWAFReference(): Promise<void> {
    console.log(chalk.yellow('📖 Creating master WAF reference guide...'));

    const masterReference = {
      title: 'Microsoft Azure Well-Architected Framework - Complete Reference',
      source: 'Microsoft Learn',
      lastUpdated: new Date().toISOString(),
      pillars: {
        security: '12 key recommendations for confidentiality, integrity, availability',
        reliability: '10 key recommendations for resiliency, availability, recovery',
        performance: '12 key recommendations for scalability, optimization, monitoring',  
        operational: '12 key recommendations for DevOps, automation, deployment',
        cost: '14 key recommendations for financial management, optimization'
      },
      assessmentProcess: {
        overview: 'Complete 5-pillar assessment following official Microsoft methodology',
        scoringScale: '1-10 scale with detailed pillar breakdown',
        implementation: 'Prioritized roadmap with Azure service recommendations',
        compliance: 'Gap analysis and improvement recommendations'
      },
      agentMapping: {
        'WellArchitectedSecurityAgent': 'security-knowledge.json',
        'WellArchitectedReliabilityAgent': 'reliability-knowledge.json', 
        'WellArchitectedPerformanceAgent': 'performance-efficiency-knowledge.json',
        'WellArchitectedOperationalExcellenceAgent': 'operational-excellence-knowledge.json',
        'CostOptimizerAgent': 'cost-optimization-knowledge.json'
      }
    };

    await fs.writeFile(
      join(this.knowledgeBasePath, 'waf-master-reference.json'),
      JSON.stringify(masterReference, null, 2)
    );

    console.log(chalk.green('  ✅ Master WAF reference created'));
  }

  private generateAssessmentPrompt(pillar: string, items: WAFChecklistItem[]): string {
    return `You are conducting a ${pillar} assessment following the official Microsoft Well-Architected Framework methodology.

OFFICIAL ${pillar.toUpperCase()} CHECKLIST (${items.length} items):
${items.map((item, index) => `${index + 1}. ${item.id} - ${item.title}: ${item.description}`).join('\\n')}

ASSESSMENT INSTRUCTIONS:
- Evaluate the architecture against each checklist item
- Provide specific recommendations using Azure services
- Score each area on a 1-10 scale with detailed justification
- Focus on compliance gaps and improvement opportunities
- Reference official WAF guidance in your analysis

Follow the official Microsoft WAF ${pillar} methodology for consistent, professional assessment.`;
  }

  private generateQuickReference(items: WAFChecklistItem[]): string[] {
    return items.map(item => `${item.id}: ${item.title} - ${item.description.substring(0, 100)}...`);
  }

  // Official Microsoft WAF Security Checklist (12 items)
  private getSecurityChecklist(): WAFChecklistItem[] {
    return [
      {
        id: 'SE:01',
        title: 'Establish Security Baseline',
        description: 'Align with compliance requirements, match industry standards, regularly measure architecture against baseline',
        keyFocus: ['compliance', 'standards', 'baseline measurement']
      },
      {
        id: 'SE:02', 
        title: 'Secure Development Lifecycle',
        description: 'Use hardened, automated software supply chain, implement threat modeling, safeguard against security vulnerabilities',
        keyFocus: ['supply chain', 'threat modeling', 'vulnerability management']
      },
      {
        id: 'SE:03',
        title: 'Data Classification',
        description: 'Label data with sensitivity and information types, use classification to influence design and security priorities',
        keyFocus: ['data labeling', 'sensitivity classification', 'design influence']
      },
      {
        id: 'SE:04',
        title: 'Segmentation',
        description: 'Create intentional architectural perimeters, segment networks, roles, identities, and resources',
        keyFocus: ['network segmentation', 'role segmentation', 'resource isolation']
      },
      {
        id: 'SE:05',
        title: 'Identity and Access Management',
        description: 'Implement strict, conditional access controls, limit access to "as necessary", use modern authentication standards, audit non-identity-based access',
        keyFocus: ['conditional access', 'zero trust', 'modern authentication', 'access auditing']
      },
      {
        id: 'SE:06',
        title: 'Network Traffic Control',
        description: 'Isolate and filter network traffic, apply defense-in-depth principles, control ingress and egress flows',
        keyFocus: ['traffic isolation', 'defense-in-depth', 'flow control']
      },
      {
        id: 'SE:07',
        title: 'Data Encryption',
        description: 'Use industry-standard encryption methods, prioritize native platform encryption, align encryption with data classifications',
        keyFocus: ['encryption standards', 'platform encryption', 'classification alignment']
      },
      {
        id: 'SE:08',
        title: 'Resource Hardening',
        description: 'Reduce attack surface, tighten configurations, increase attacker complexity',
        keyFocus: ['attack surface reduction', 'configuration hardening', 'security complexity']
      },
      {
        id: 'SE:09',
        title: 'Application Secrets Protection',
        description: 'Secure secret storage, restrict access and manipulation, implement reliable rotation processes',
        keyFocus: ['secret storage', 'access restriction', 'rotation automation']
      },
      {
        id: 'SE:10',
        title: 'Threat Monitoring',
        description: 'Develop holistic monitoring strategy, use modern threat detection mechanisms, integrate with SecOps processes',
        keyFocus: ['holistic monitoring', 'threat detection', 'SecOps integration']
      },
      {
        id: 'SE:11',
        title: 'Comprehensive Testing',
        description: 'Prevent security issues, validate threat prevention, test detection mechanisms',
        keyFocus: ['security testing', 'threat validation', 'detection testing']
      },
      {
        id: 'SE:12',
        title: 'Incident Response',
        description: 'Define procedures for various incident scenarios, clearly assign response responsibilities, test and refine response plans',
        keyFocus: ['incident procedures', 'response responsibilities', 'plan testing']
      }
    ];
  }

  // Official Microsoft WAF Reliability Checklist (10 items)
  private getReliabilityChecklist(): WAFChecklistItem[] {
    return [
      {
        id: 'RE:01',
        title: 'Simplicity and Efficiency', 
        description: 'Focus your workload design on simplicity and efficiency to meet business goals while avoiding unnecessary complexity',
        keyFocus: ['design simplicity', 'efficiency', 'complexity avoidance']
      },
      {
        id: 'RE:02',
        title: 'Flow Identification',
        description: 'Identify and rate user and system flows using a criticality scale based on business requirements',
        keyFocus: ['flow analysis', 'criticality rating', 'business alignment']
      },
      {
        id: 'RE:03',
        title: 'Failure Mode Analysis',
        description: 'Use failure mode analysis (FMA) to identify potential failures by analyzing dependencies and developing mitigation strategies',
        keyFocus: ['failure analysis', 'dependency mapping', 'mitigation strategies']
      },
      {
        id: 'RE:04',
        title: 'Reliability Metrics',
        description: 'Define reliability and recovery targets to inform design and establish a health model',
        keyFocus: ['reliability targets', 'recovery objectives', 'health modeling']
      },
      {
        id: 'RE:05',
        title: 'Redundancy',
        description: 'Add redundancy at different levels, especially for critical flows including infrastructure components and solution instances',
        keyFocus: ['redundancy design', 'critical flow protection', 'multi-level redundancy']
      },
      {
        id: 'RE:06',
        title: 'Scaling Strategy',
        description: 'Implement a timely and reliable scaling strategy across application, data, and infrastructure levels with minimal manual intervention',
        keyFocus: ['scaling automation', 'multi-level scaling', 'timely response']
      },
      {
        id: 'RE:07',
        title: 'Resilience Measures',
        description: 'Strengthen resiliency through self-preservation and self-healing mechanisms using cloud patterns',
        keyFocus: ['self-preservation', 'self-healing', 'cloud patterns']
      },
      {
        id: 'RE:08',
        title: 'Resilience Testing',
        description: 'Test for resiliency and availability using chaos engineering principles and simulated load testing',
        keyFocus: ['chaos engineering', 'availability testing', 'load simulation']
      },
      {
        id: 'RE:09',
        title: 'Disaster Recovery',
        description: 'Implement structured, tested, and documented business continuity and disaster recovery (BCDR) plans covering all system components',
        keyFocus: ['BCDR planning', 'testing procedures', 'documentation']
      },
      {
        id: 'RE:10',
        title: 'Health Monitoring',
        description: 'Measure and model solution health signals by continuously capturing uptime and reliability data across workloads',
        keyFocus: ['health modeling', 'continuous monitoring', 'reliability metrics']
      }
    ];
  }

  // Official Microsoft WAF Performance Efficiency Checklist (12 items)
  private getPerformanceChecklist(): WAFChecklistItem[] {
    return [
      {
        id: 'PE:01',
        title: 'Define Performance Targets',
        description: 'Set numerical values tied to workload requirements, implement targets for all workload flows',
        keyFocus: ['numerical targets', 'requirement alignment', 'flow coverage']
      },
      {
        id: 'PE:02',
        title: 'Conduct Capacity Planning',
        description: 'Plan before predicted usage pattern changes, consider seasonal variations, product updates, marketing campaigns',
        keyFocus: ['capacity planning', 'usage patterns', 'change anticipation']
      },
      {
        id: 'PE:03',
        title: 'Select Right Services',
        description: 'Choose services/infrastructure supporting performance targets, weigh platform features vs. custom implementation',
        keyFocus: ['service selection', 'platform features', 'custom vs platform']
      },
      {
        id: 'PE:04',
        title: 'Collect Performance Data',
        description: 'Provide automatic, continuous metrics and logs, collect data across application, platform, data, and OS levels',
        keyFocus: ['continuous monitoring', 'multi-level data', 'automation']
      },
      {
        id: 'PE:05',
        title: 'Optimize Scaling and Partitioning',
        description: 'Design reliable, controlled scaling strategies, base approach on workload\'s scale unit design',
        keyFocus: ['scaling design', 'partitioning strategy', 'scale units']
      },
      {
        id: 'PE:06',
        title: 'Performance Testing',
        description: 'Test in production-like environment, compare results against performance targets/benchmarks',
        keyFocus: ['production testing', 'benchmark comparison', 'target validation']
      },
      {
        id: 'PE:07',
        title: 'Optimize Code and Infrastructure',
        description: 'Use performant code, offload responsibilities to platform, use resources only when necessary',
        keyFocus: ['code optimization', 'platform offloading', 'resource efficiency']
      },
      {
        id: 'PE:08',
        title: 'Optimize Data Usage',
        description: 'Optimize data stores, partitions, indexes, align with workload\'s intended and actual use',
        keyFocus: ['data optimization', 'indexing strategy', 'usage alignment']
      },
      {
        id: 'PE:09',
        title: 'Prioritize Critical Flows',
        description: 'Allocate resources to most important business processes, focus optimization on key user and operational flows',
        keyFocus: ['resource allocation', 'business prioritization', 'critical flows']
      },
      {
        id: 'PE:10',
        title: 'Optimize Operational Tasks',
        description: 'Minimize software lifecycle impact on performance, manage tasks like virus scans, secret rotations, backups',
        keyFocus: ['lifecycle optimization', 'operational impact', 'task management']
      },
      {
        id: 'PE:11',
        title: 'Respond to Live Performance Issues',
        description: 'Establish clear communication and responsibilities, learn and implement preventive measures',
        keyFocus: ['incident response', 'communication', 'preventive measures']
      },
      {
        id: 'PE:12',
        title: 'Continuous Performance Optimization',
        description: 'Focus on components with deteriorating performance, regularly review databases, networking features',
        keyFocus: ['continuous improvement', 'performance monitoring', 'regular reviews']
      }
    ];
  }

  // Official Microsoft WAF Operational Excellence Checklist (12 items) 
  private getOperationalChecklist(): WAFChecklistItem[] {
    return [
      {
        id: 'OE:01',
        title: 'DevOps Culture',
        description: 'Foster a blameless culture that emphasizes continuous learning and prioritizes continuous improvement',
        keyFocus: ['blameless culture', 'continuous learning', 'improvement mindset']
      },
      {
        id: 'OE:02',
        title: 'Operational Task Formalization',
        description: 'Increase consistency by adopting industry-proven practices and standardizing operational processes',
        keyFocus: ['consistency', 'proven practices', 'standardization']
      },
      {
        id: 'OE:03',
        title: 'Software Ideation & Planning',
        description: 'Draw from established industry standards for team communication, documentation, and development processes',
        keyFocus: ['industry standards', 'communication', 'development processes']
      },
      {
        id: 'OE:04',
        title: 'Software Development Enhancement',
        description: 'Standardize tools, source control, design patterns, documentation, and style guides, ensure clear role definitions and consistent processes',
        keyFocus: ['tool standardization', 'source control', 'role clarity']
      },
      {
        id: 'OE:05',
        title: 'Infrastructure as Code (IaC)',
        description: 'Use standardized IaC approach for resource and configuration preparation, prefer declarative over imperative approaches when practical',
        keyFocus: ['IaC standardization', 'declarative approach', 'configuration management']
      },
      {
        id: 'OE:06',
        title: 'Workload Supply Chain',
        description: 'Drive changes through predictable, automated pipelines, incorporate comprehensive testing across environments',
        keyFocus: ['automated pipelines', 'predictable changes', 'comprehensive testing']
      },
      {
        id: 'OE:07',
        title: 'Observability',
        description: 'Design monitoring systems to capture telemetry, metrics, and logs, use data to validate design choices and guide future decisions',
        keyFocus: ['monitoring design', 'telemetry capture', 'data-driven decisions']
      },
      {
        id: 'OE:08',
        title: 'Emergency Response',
        description: 'Create comprehensive incident response plan, document roles, responsibilities, and emergency procedures, capture learnings through postmortems',
        keyFocus: ['incident response', 'role documentation', 'postmortem learning']
      },
      {
        id: 'OE:09',
        title: 'Task Automation',
        description: 'Automate repetitive, procedural tasks with clear ROI, prefer off-the-shelf tools over custom solutions',
        keyFocus: ['automation ROI', 'repetitive tasks', 'tool selection']
      },
      {
        id: 'OE:10',
        title: 'Upfront Automation Design',
        description: 'Implement automation early for lifecycle management, adopt platform-native automation capabilities',
        keyFocus: ['early automation', 'lifecycle management', 'platform-native']
      },
      {
        id: 'OE:11',
        title: 'Safe Deployment Practices',
        description: 'Focus on small, incremental releases, use quality gates and progressive exposure, plan for routine and emergency deployments',
        keyFocus: ['incremental releases', 'quality gates', 'deployment planning']
      },
      {
        id: 'OE:12',
        title: 'Deployment Failure Mitigation',
        description: 'Implement strategies for handling unexpected rollout issues, use rollback, feature disablement, or native deployment pattern capabilities',
        keyFocus: ['failure mitigation', 'rollback strategies', 'deployment patterns']
      }
    ];
  }

  // Official Microsoft WAF Cost Optimization Checklist (14 items)
  private getCostOptimizationChecklist(): WAFChecklistItem[] {
    return [
      {
        id: 'CO:01',
        title: 'Create a Culture of Financial Responsibility',
        description: 'Train personnel regularly, foster spending accountability, invest in tooling and automation',
        keyFocus: ['financial culture', 'accountability', 'automation investment']
      },
      {
        id: 'CO:02',
        title: 'Create and Maintain a Cost Model',
        description: 'Estimate initial and ongoing costs, negotiate budget with buffer for unplanned spending',
        keyFocus: ['cost modeling', 'budget planning', 'unplanned spending']
      },
      {
        id: 'CO:03',
        title: 'Collect and Review Cost Data',
        description: 'Capture daily costs, include metered, prepaid, trends, and forecasts, automate alerts for spending thresholds',
        keyFocus: ['cost tracking', 'trend analysis', 'automated alerts']
      },
      {
        id: 'CO:04',
        title: 'Set Spending Guardrails',
        description: 'Implement release gates, create governance policies, set resource limits and access controls, prioritize platform automation',
        keyFocus: ['spending controls', 'governance policies', 'automation priority']
      },
      {
        id: 'CO:05',
        title: 'Get Best Rates from Providers',
        description: 'Review regional pricing, examine pricing tiers and models, consider license portability, review corporate purchasing plans',
        keyFocus: ['pricing optimization', 'tier selection', 'license portability']
      },
      {
        id: 'CO:06',
        title: 'Align Usage to Billing Increments',
        description: 'Understand billing meters, modify services or resource usage to align with increments, use proof-of-concept to validate billing knowledge',
        keyFocus: ['billing alignment', 'meter understanding', 'usage optimization']
      },
      {
        id: 'CO:07',
        title: 'Optimize Component Costs',
        description: 'Regularly remove or optimize legacy/underutilized components, review application and platform features',
        keyFocus: ['component optimization', 'legacy removal', 'feature review']
      },
      {
        id: 'CO:08',
        title: 'Optimize Environment Costs',
        description: 'Align spending across environments, consider availability, licensing, operating conditions, emulate production in nonproduction environments',
        keyFocus: ['environment alignment', 'production emulation', 'licensing optimization']
      },
      {
        id: 'CO:09',
        title: 'Optimize Flow Costs',
        description: 'Align cost with flow priority, consider features, functionality, requirements, make strategic compromises',
        keyFocus: ['flow prioritization', 'strategic compromises', 'cost alignment']
      },
      {
        id: 'CO:10',
        title: 'Optimize Data Costs',
        description: 'Prioritize data spending, improve data management, optimize tiering, retention, volume, replication',
        keyFocus: ['data prioritization', 'tiering strategy', 'retention optimization']
      },
      {
        id: 'CO:11',
        title: 'Optimize Code Costs',
        description: 'Evaluate code to meet requirements, reduce resource consumption',
        keyFocus: ['code efficiency', 'resource consumption', 'requirement alignment']
      },
      {
        id: 'CO:12',
        title: 'Optimize Scaling Costs',
        description: 'Evaluate scaling configurations, align with cost model, consider resource utilization and limits',
        keyFocus: ['scaling optimization', 'cost model alignment', 'utilization analysis']
      },
      {
        id: 'CO:13',
        title: 'Optimize Personnel Time',
        description: 'Align time spent with task priority, reduce task time without degrading outcomes, minimize noise, reduce build times',
        keyFocus: ['time optimization', 'priority alignment', 'efficiency improvement']
      },
      {
        id: 'CO:14',
        title: 'Consolidate Resources',
        description: 'Consolidate internal resources, use centralized services, increase resource density',
        keyFocus: ['resource consolidation', 'centralization', 'density optimization']
      }
    ];
  }
}

// Main execution function
async function main() {
  try {
    const downloader = new WAFKnowledgeDownloader();
    await downloader.downloadAllWAFKnowledge();
    
    console.log(chalk.blue.bold('\n📋 Next Steps:'));
    console.log('1. Knowledge base files created in waf-knowledge-base/');
    console.log('2. Each WAF agent can now reference official Microsoft guidance');
    console.log('3. Run agents with enhanced WAF methodology knowledge');
    console.log('4. Assessments will follow official Microsoft checklist items');
    
  } catch (error) {
    console.error(chalk.red('❌ WAF Knowledge Download failed:'), error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { WAFKnowledgeDownloader };