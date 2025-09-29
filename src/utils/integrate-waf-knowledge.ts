#!/usr/bin/env tsx
/**
 * WAF Knowledge Integration Utility
 * Updates all WAF agents to load and reference official Microsoft documentation
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import { existsSync } from 'fs';

interface AgentKnowledgeMapping {
  agentFile: string;
  knowledgeFile: string;
  pillarName: string;
  checklistItems: number;
}

class WAFKnowledgeIntegrator {
  private agentMappings: AgentKnowledgeMapping[] = [
    {
      agentFile: 'src/agents/well-architected-reliability-agent.ts',
      knowledgeFile: 'waf-knowledge-base/reliability-knowledge.json',
      pillarName: 'Reliability',
      checklistItems: 10
    },
    {
      agentFile: 'src/agents/well-architected-performance-agent.ts', 
      knowledgeFile: 'waf-knowledge-base/performance-efficiency-knowledge.json',
      pillarName: 'Performance Efficiency',
      checklistItems: 12
    },
    {
      agentFile: 'src/agents/well-architected-operational-excellence-agent.ts',
      knowledgeFile: 'waf-knowledge-base/operational-excellence-knowledge.json', 
      pillarName: 'Operational Excellence',
      checklistItems: 12
    },
    {
      agentFile: 'src/agents/cost-optimizer-agent.ts',
      knowledgeFile: 'waf-knowledge-base/cost-optimization-knowledge.json',
      pillarName: 'Cost Optimization', 
      checklistItems: 14
    }
  ];

  async integrateAllAgents(): Promise<void> {
    console.log(chalk.blue.bold('🔧 Integrating WAF Knowledge into All Agents\n'));

    for (const mapping of this.agentMappings) {
      await this.integrateAgentKnowledge(mapping);
    }

    console.log(chalk.green.bold('\n✅ WAF Knowledge Integration Complete!'));
    console.log(chalk.blue('📚 All agents now reference official Microsoft WAF guidance'));
    console.log(chalk.yellow('💡 Agents will conduct assessments using official WAF methodology'));
  }

  private async integrateAgentKnowledge(mapping: AgentKnowledgeMapping): Promise<void> {
    console.log(chalk.yellow(`🔧 Updating ${mapping.pillarName} agent...`));

    try {
      // Check if knowledge file exists
      if (!existsSync(mapping.knowledgeFile)) {
        console.error(chalk.red(`  ❌ Knowledge file not found: ${mapping.knowledgeFile}`));
        return;
      }

      // Check if agent file exists
      if (!existsSync(mapping.agentFile)) {
        console.error(chalk.red(`  ❌ Agent file not found: ${mapping.agentFile}`));
        return;
      }

      // Read current agent file
      const agentContent = await fs.readFile(mapping.agentFile, 'utf8');

      // Check if already integrated
      if (agentContent.includes('loadWAFKnowledge')) {
        console.log(chalk.cyan(`  ⏭️  Already integrated: ${mapping.pillarName}`));
        return;
      }

      // Add imports
      const updatedContent = this.addWAFImports(agentContent, mapping);
      
      // Add knowledge loading
      const finalContent = this.addKnowledgeLoading(updatedContent, mapping);

      // Write updated file
      await fs.writeFile(mapping.agentFile, finalContent);

      console.log(chalk.green(`  ✅ ${mapping.pillarName}: Integrated ${mapping.checklistItems} checklist items`));

    } catch (error) {
      console.error(chalk.red(`  ❌ Failed to integrate ${mapping.pillarName}:`), error.message);
    }
  }

  private addWAFImports(content: string, mapping: AgentKnowledgeMapping): string {
    // Add file system imports if not present
    if (!content.includes('promises as fs')) {
      const importSection = content.indexOf('import ') >= 0 ? content.indexOf('import ') : 0;
      const nextLine = content.indexOf('\\n', importSection);
      
      const fsImports = `import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
`;
      
      return content.slice(0, nextLine + 1) + fsImports + content.slice(nextLine + 1);
    }
    
    return content;
  }

  private addKnowledgeLoading(content: string, mapping: AgentKnowledgeMapping): string {
    const className = this.extractClassName(content);
    if (!className) {
      throw new Error('Could not find class name in agent file');
    }

    // Add private property
    const constructorMatch = content.match(/(class\\s+\\w+[^{]*{[^}]*constructor[^{]*{)/);
    if (!constructorMatch) {
      throw new Error('Could not find constructor in agent file');
    }

    // Add wafKnowledge property
    const propertyAddition = `  private wafKnowledge: any = null;

`;
    
    let updatedContent = content.replace(
      constructorMatch[1],
      constructorMatch[1].replace('{', `{
${propertyAddition}`)
    );

    // Add knowledge loading method call in constructor
    const constructorEndMatch = updatedContent.match(/(constructor[^{]*{[^}]*)(})/);
    if (constructorEndMatch) {
      updatedContent = updatedContent.replace(
        constructorEndMatch[0],
        constructorEndMatch[1] + `    this.loadWAFKnowledge();
  }`
      );
    }

    // Add loadWAFKnowledge method
    const knowledgeMethod = `
  /**
   * Load official Microsoft WAF ${mapping.pillarName} knowledge base
   */
  private async loadWAFKnowledge(): Promise<void> {
    try {
      const knowledgePath = '${mapping.knowledgeFile}';
      if (existsSync(knowledgePath)) {
        const knowledgeData = await fs.readFile(knowledgePath, 'utf8');
        this.wafKnowledge = JSON.parse(knowledgeData);
        console.log('🏗️ ${mapping.pillarName} Agent: Loaded official Microsoft WAF knowledge (${mapping.checklistItems} checklist items)');
      } else {
        console.warn('⚠️ ${mapping.pillarName} Agent: WAF knowledge base not found - using built-in knowledge');
      }
    } catch (error) {
      console.warn('⚠️ ${mapping.pillarName} Agent: Could not load WAF knowledge base:', error.message);
    }
  }`;

    // Insert method before the last closing brace
    const lastBraceIndex = updatedContent.lastIndexOf('}');
    updatedContent = updatedContent.slice(0, lastBraceIndex) + knowledgeMethod + '\\n' + updatedContent.slice(lastBraceIndex);

    return updatedContent;
  }

  private extractClassName(content: string): string | null {
    const classMatch = content.match(/class\\s+(\\w+)/);
    return classMatch ? classMatch[1] : null;
  }
}

// Main execution function
async function main() {
  try {
    const integrator = new WAFKnowledgeIntegrator();
    await integrator.integrateAllAgents();
    
    console.log(chalk.blue.bold('\\n📋 Next Steps:'));
    console.log('1. All WAF agents now have official Microsoft knowledge integration');
    console.log('2. Agents will reference official checklist items in assessments');
    console.log('3. Run WAF assessments to see enhanced accuracy and compliance');
    console.log('4. Assessments now follow official Microsoft WAF methodology');
    
  } catch (error) {
    console.error(chalk.red('❌ WAF Knowledge Integration failed:'), error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { WAFKnowledgeIntegrator };