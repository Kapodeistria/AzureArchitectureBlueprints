#!/usr/bin/env tsx
/**
 * WAF RAG Preparator
 * Prepares WAF knowledge base for RAG integration in Azure AI Foundry
 * Converts WAF knowledge into RAG-optimized format for deployment
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { existsSync } from 'fs';

interface WAFRAGSource {
  name: string;
  description: string;
  type: 'waf_knowledge';
  pillar: string;
  checklist_items: any[];
  assessment_guidance: string;
  quick_reference: string[];
  source_url: string;
  last_updated: string;
}

class WAFRAGPreparator {
  private ragSourcesPath: string;
  private knowledgeBasePath: string;

  constructor() {
    this.ragSourcesPath = 'foundry-agents/rag-sources';
    this.knowledgeBasePath = 'waf-knowledge-base';
  }

  async prepareAllWAFRAGSources(): Promise<void> {
    console.log(chalk.blue.bold('📚 Preparing WAF Knowledge for RAG Integration\n'));

    // Ensure RAG sources directory exists
    await fs.mkdir(this.ragSourcesPath, { recursive: true });

    const wafPillars = [
      {
        knowledgeFile: 'security-knowledge.json',
        ragName: 'waf-security-pillar',
        pillar: 'Security'
      },
      {
        knowledgeFile: 'reliability-knowledge.json', 
        ragName: 'waf-reliability-pillar',
        pillar: 'Reliability'
      },
      {
        knowledgeFile: 'performance-efficiency-knowledge.json',
        ragName: 'waf-performance-pillar', 
        pillar: 'Performance Efficiency'
      },
      {
        knowledgeFile: 'operational-excellence-knowledge.json',
        ragName: 'waf-operational-pillar',
        pillar: 'Operational Excellence'
      },
      {
        knowledgeFile: 'cost-optimization-knowledge.json',
        ragName: 'waf-cost-pillar',
        pillar: 'Cost Optimization'
      }
    ];

    for (const pillar of wafPillars) {
      await this.createWAFRAGSource(pillar);
    }

    await this.createMasterWAFRAGSource();
    await this.updateRAGSourcesConfiguration();

    console.log(chalk.green.bold('\n✅ WAF RAG Sources Preparation Complete!'));
    console.log(chalk.blue(`📚 RAG sources created at: ${this.ragSourcesPath}/`));
    console.log(chalk.yellow('💡 WAF agents can now access knowledge through RAG during deployment'));
  }

  private async createWAFRAGSource(pillar: any): Promise<void> {
    console.log(chalk.yellow(`📋 Creating RAG source for ${pillar.pillar} pillar...`));

    try {
      const knowledgePath = join(this.knowledgeBasePath, pillar.knowledgeFile);
      
      if (!existsSync(knowledgePath)) {
        console.error(chalk.red(`  ❌ Knowledge file not found: ${knowledgePath}`));
        return;
      }

      // Load WAF knowledge
      const knowledgeData = JSON.parse(await fs.readFile(knowledgePath, 'utf8'));

      // Create RAG-optimized format
      const ragSource: WAFRAGSource = {
        name: pillar.ragName,
        description: `Official Microsoft Well-Architected Framework ${pillar.pillar} pillar knowledge base with ${knowledgeData.totalItems} checklist items`,
        type: 'waf_knowledge',
        pillar: pillar.pillar,
        checklist_items: knowledgeData.checklistItems,
        assessment_guidance: knowledgeData.assessmentPrompt,
        quick_reference: knowledgeData.quickReference,
        source_url: knowledgeData.url,
        last_updated: knowledgeData.lastUpdated
      };

      // Create content for RAG ingestion
      const ragContent = this.generateRAGContent(ragSource);

      // Save RAG source file
      const ragSourceFile = join(this.ragSourcesPath, `${pillar.ragName}.json`);
      await fs.writeFile(ragSourceFile, JSON.stringify(ragSource, null, 2));

      // Save content file for ingestion
      const ragContentFile = join(this.ragSourcesPath, `${pillar.ragName}-content.md`);
      await fs.writeFile(ragContentFile, ragContent);

      console.log(chalk.green(`  ✅ ${pillar.pillar}: RAG source created (${knowledgeData.totalItems} items)`));

    } catch (error) {
      console.error(chalk.red(`  ❌ Failed to create RAG source for ${pillar.pillar}:`), error.message);
    }
  }

  private generateRAGContent(ragSource: WAFRAGSource): string {
    return `# Microsoft Well-Architected Framework - ${ragSource.pillar} Pillar

## Official Microsoft Checklist Items

${ragSource.checklist_items.map((item, index) => `
### ${item.id}: ${item.title}

**Description:** ${item.description}

**Key Focus Areas:**
${item.keyFocus ? item.keyFocus.map(focus => `- ${focus}`).join('\n') : '- See description above'}

**Assessment Criteria:**
- Evaluate architecture compliance with ${item.id}
- Identify gaps and improvement opportunities
- Provide specific Azure service recommendations
- Score implementation maturity (1-10 scale)

---
`).join('')}

## Assessment Guidance

${ragSource.assessment_guidance}

## Quick Reference

${ragSource.quick_reference.map(ref => `- ${ref}`).join('\n')}

## Source Information

- **Source:** ${ragSource.source_url}
- **Last Updated:** ${ragSource.last_updated}
- **Pillar:** ${ragSource.pillar}
- **Total Items:** ${ragSource.checklist_items.length}

This knowledge base contains the official Microsoft Well-Architected Framework ${ragSource.pillar} pillar guidance for use in automated assessments.`;
  }

  private async createMasterWAFRAGSource(): Promise<void> {
    console.log(chalk.yellow('📖 Creating master WAF RAG reference...'));

    const masterRAGSource = {
      name: 'waf-master-framework',
      description: 'Complete Microsoft Well-Architected Framework knowledge base with all 5 pillars',
      type: 'waf_master',
      pillars: {
        security: 'SE:01 - SE:12 (12 items)',
        reliability: 'RE:01 - RE:10 (10 items)', 
        performance: 'PE:01 - PE:12 (12 items)',
        operational: 'OE:01 - OE:12 (12 items)',
        cost: 'CO:01 - CO:14 (14 items)'
      },
      total_items: 60,
      methodology: 'Official Microsoft Well-Architected Framework assessment methodology',
      source: 'https://learn.microsoft.com/en-us/azure/well-architected/',
      last_updated: new Date().toISOString()
    };

    const masterContent = `# Microsoft Well-Architected Framework - Complete Assessment Guide

## Overview

The Microsoft Well-Architected Framework consists of 5 pillars with 60 total checklist items for comprehensive architecture assessment.

## Assessment Process

1. **Security Pillar (SE:01 - SE:12)**: 12 items focusing on confidentiality, integrity, availability
2. **Reliability Pillar (RE:01 - RE:10)**: 10 items focusing on resiliency, availability, recovery
3. **Performance Efficiency Pillar (PE:01 - PE:12)**: 12 items focusing on scalability, optimization
4. **Operational Excellence Pillar (OE:01 - OE:12)**: 12 items focusing on DevOps, automation
5. **Cost Optimization Pillar (CO:01 - CO:14)**: 14 items focusing on financial management

## Scoring Methodology

- Each pillar scored 1-10 scale
- Overall WAF score calculated with weighted average
- Detailed recommendations for each checklist item
- Implementation roadmap with priority ranking

## Official Microsoft Sources

All content derived from official Microsoft Learn documentation and Well-Architected Framework guidance.
`;

    await fs.writeFile(
      join(this.ragSourcesPath, 'waf-master-framework.json'),
      JSON.stringify(masterRAGSource, null, 2)
    );

    await fs.writeFile(
      join(this.ragSourcesPath, 'waf-master-framework-content.md'),
      masterContent
    );

    console.log(chalk.green('  ✅ Master WAF RAG reference created'));
  }

  private async updateRAGSourcesConfiguration(): Promise<void> {
    console.log(chalk.yellow('🔧 Updating RAG sources configuration...'));

    const ragConfig = {
      waf_sources: {
        description: 'Microsoft Well-Architected Framework RAG Sources',
        total_pillars: 5,
        total_items: 60,
        sources: [
          {
            name: 'waf-security-pillar',
            file: 'waf-security-pillar.json',
            content: 'waf-security-pillar-content.md',
            pillar: 'Security',
            items: 12
          },
          {
            name: 'waf-reliability-pillar', 
            file: 'waf-reliability-pillar.json',
            content: 'waf-reliability-pillar-content.md',
            pillar: 'Reliability',
            items: 10
          },
          {
            name: 'waf-performance-pillar',
            file: 'waf-performance-pillar.json', 
            content: 'waf-performance-pillar-content.md',
            pillar: 'Performance Efficiency',
            items: 12
          },
          {
            name: 'waf-operational-pillar',
            file: 'waf-operational-pillar.json',
            content: 'waf-operational-pillar-content.md', 
            pillar: 'Operational Excellence',
            items: 12
          },
          {
            name: 'waf-cost-pillar',
            file: 'waf-cost-pillar.json',
            content: 'waf-cost-pillar-content.md',
            pillar: 'Cost Optimization', 
            items: 14
          }
        ]
      },
      deployment_integration: {
        note: 'These RAG sources should be deployed with their respective WAF agents',
        agent_mapping: {
          'WellArchitectedSecurityAgent': ['waf-security-pillar'],
          'WellArchitectedReliabilityAgent': ['waf-reliability-pillar'],
          'WellArchitectedPerformanceAgent': ['waf-performance-pillar'],
          'WellArchitectedOperationalExcellenceAgent': ['waf-operational-pillar'],
          'CostOptimizerAgent': ['waf-cost-pillar']
        }
      }
    };

    await fs.writeFile(
      join(this.ragSourcesPath, 'waf-rag-configuration.json'),
      JSON.stringify(ragConfig, null, 2)
    );

    console.log(chalk.green('  ✅ RAG configuration updated'));
  }
}

// Main execution function
async function main() {
  try {
    const preparator = new WAFRAGPreparator();
    await preparator.prepareAllWAFRAGSources();
    
    console.log(chalk.blue.bold('\n📋 Next Steps:'));
    console.log('1. WAF RAG sources prepared for Azure AI Foundry deployment');
    console.log('2. Update deployment script to include WAF RAG sources');
    console.log('3. Deploy agents with integrated WAF knowledge through RAG');
    console.log('4. Reduced prompt size with enhanced WAF assessment accuracy');
    
  } catch (error) {
    console.error(chalk.red('❌ WAF RAG Preparation failed:'), error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { WAFRAGPreparator };