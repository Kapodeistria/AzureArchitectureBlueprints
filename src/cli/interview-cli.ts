#!/usr/bin/env tsx
/**
 * CLI Interface for Multi-Agent Interview System
 * Quick and easy interface for case study processing
 */

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import clipboardy from 'clipboardy';
import { MultiAgentSystem } from '../core/multi-agent-system.js';
import { promises as fs } from 'fs';

class InterviewCLI {
  private system: MultiAgentSystem;
  private program: Command;

  constructor() {
    this.system = new MultiAgentSystem();
    this.program = new Command();
    this.setupCommands();
  }

  private setupCommands() {
    this.program
      .name('azure-architecture-blueprints')
      .description('Azure Architecture Blueprints - Professional blueprint generator with C4 models and cost optimization')
      .version('2.0.0');

    // Quick Analysis Command
    this.program
      .command('analyze')
      .alias('a')
      .description('Analyze a case study with multi-agent system')
      .option('-i, --input <file>', 'Input file path')
      .option('-c, --clipboard', 'Read from clipboard')
      .option('-o, --output <file>', 'Output file path')
      .option('--copy', 'Copy result to clipboard')
      .action(async (options) => {
        await this.handleAnalyze(options);
      });

    // Interactive Mode
    this.program
      .command('interactive')
      .alias('i')
      .description('Interactive mode with guided input')
      .action(async () => {
        await this.handleInteractive();
      });

    // Quick Start (default)
    this.program
      .command('quick')
      .alias('q')
      .description('Quick start - paste case study and get results')
      .action(async () => {
        await this.handleQuick();
      });

    // Test Mode
    this.program
      .command('test')
      .description('Test system with sample case study')
      .action(async () => {
        await this.handleTest();
      });

    // Status Check
    this.program
      .command('status')
      .description('Check system status and configuration')
      .action(async () => {
        await this.handleStatus();
      });
  }

  async handleAnalyze(options: any) {
    try {
      let caseStudyText = '';

      // Get input
      if (options.clipboard) {
        console.log(chalk.blue('📋 Reading from clipboard...'));
        caseStudyText = await clipboardy.read();
      } else if (options.input) {
        console.log(chalk.blue(`📁 Reading from ${options.input}...`));
        caseStudyText = await fs.readFile(options.input, 'utf-8');
      } else {
        const { text } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'text',
            message: 'Paste your case study (this will open your default editor):',
            default: 'Paste your case study here...'
          }
        ]);
        caseStudyText = text;
      }

      if (!caseStudyText.trim()) {
        console.log(chalk.red('❌ No case study text provided'));
        return;
      }

      console.log(chalk.green('✅ Case study loaded'));
      console.log(chalk.gray(`Length: ${caseStudyText.length} characters`));

      // Process with multi-agent system
      const result = await this.system.processCaseStudyWithContent(caseStudyText);

      console.log(chalk.green(`\n✅ Analysis complete! Report saved to: ${result.savedPath}`));

      // Copy additional file if requested with different name
      if (options.output) {
        await fs.writeFile(options.output, result.markdownContent, 'utf-8');
        console.log(chalk.green(`📁 Copy saved to: ${options.output}`));
      }

      // Copy to clipboard if requested
      if (options.copy) {
        await clipboardy.write(result.markdownContent);
        console.log(chalk.green('📋 Report copied to clipboard'));
      }

      // Show preview
      console.log(chalk.blue('\n📖 Preview:'));
      console.log(chalk.gray('-'.repeat(50)));
      console.log(result.markdownContent.split('\n').slice(0, 20).join('\n'));
      if (result.markdownContent.split('\n').length > 20) {
        console.log(chalk.gray(`... (${result.markdownContent.split('\n').length - 20} more lines)`));
      }

    } catch (error) {
      console.error(chalk.red('❌ Analysis failed:'), error);
    }
  }

  async handleInteractive() {
    console.log(chalk.blue.bold('\n🏗️ Interactive Azure Architecture Blueprints Generator\n'));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'inputMethod',
        message: 'How would you like to provide the case study?',
        choices: [
          { name: '📋 Paste from clipboard', value: 'clipboard' },
          { name: '⌨️ Type/paste directly', value: 'direct' },
          { name: '📁 Load from file', value: 'file' }
        ]
      }
    ]);

    let caseStudyText = '';

    switch (answers.inputMethod) {
      case 'clipboard':
        caseStudyText = await clipboardy.read();
        console.log(chalk.green('✅ Loaded from clipboard'));
        break;
      case 'direct':
        const { text } = await inquirer.prompt([
          {
            type: 'editor',
            name: 'text',
            message: 'Enter your case study (opens editor):'
          }
        ]);
        caseStudyText = text;
        break;
      case 'file':
        const { filepath } = await inquirer.prompt([
          {
            type: 'input',
            name: 'filepath',
            message: 'Enter file path:'
          }
        ]);
        caseStudyText = await fs.readFile(filepath, 'utf-8');
        break;
    }

    const { options } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'options',
        message: 'Select output options:',
        choices: [
          { name: '📋 Copy to clipboard', value: 'clipboard', checked: true },
          { name: '💾 Save to file', value: 'file', checked: true },
          { name: '👁️ Preview in terminal', value: 'preview' },
          { name: '🌐 Open in browser', value: 'browser' }
        ]
      }
    ]);

    // Process analysis
    const result = await this.system.processCaseStudyWithContent(caseStudyText);
    const report = result.markdownContent;

    // Handle outputs
    if (options.includes('file')) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `interview-solution-${timestamp}.md`;
      await this.system.saveReport(report, filename);
      console.log(chalk.green(`✅ Saved to ${filename}`));
    }

    if (options.includes('clipboard')) {
      await clipboardy.write(report);
      console.log(chalk.green('📋 Copied to clipboard'));
    }

    if (options.includes('preview')) {
      console.log(chalk.blue('\n📖 Report Preview:'));
      console.log(chalk.gray('='.repeat(60)));
      console.log(report);
    }

    console.log(chalk.green.bold('\n🎉 Analysis complete! Ready for your interview!'));
  }

  async handleQuick() {
    console.log(chalk.blue.bold('\n⚡ Quick Analysis Mode\n'));
    console.log(chalk.gray('Perfect for rapid case study processing during interview prep!\n'));

    // Simple workflow
    const { source } = await inquirer.prompt([
      {
        type: 'list',
        name: 'source',
        message: 'Case study source:',
        choices: [
          { name: '📋 From clipboard (fastest)', value: 'clipboard' },
          { name: '⌨️ Type now', value: 'type' }
        ]
      }
    ]);

    let caseStudyText = '';

    if (source === 'clipboard') {
      const spinner = ora('Reading clipboard...').start();
      try {
        caseStudyText = await clipboardy.read();
        spinner.succeed('Clipboard loaded');
      } catch (error) {
        spinner.fail('Clipboard read failed');
        return;
      }
    } else {
      const { text } = await inquirer.prompt([
        {
          type: 'editor',
          name: 'text',
          message: 'Enter case study:'
        }
      ]);
      caseStudyText = text;
    }

    if (!caseStudyText.trim()) {
      console.log(chalk.red('❌ No case study provided'));
      return;
    }

    console.log(chalk.blue('\n🚀 Processing with Multi-Agent System...\n'));

    // Quick processing
    const result = await this.system.processCaseStudyWithContent(caseStudyText);
    const report = result.markdownContent;

    // Auto-save and copy
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `quick-solution-${timestamp}.md`;
    
    await Promise.all([
      this.system.saveReport(report, filename),
      clipboardy.write(report)
    ]);

    console.log(chalk.green.bold('\n🎉 READY FOR INTERVIEW! 🎉'));
    console.log(chalk.green(`✅ Full report saved: ${filename}`));
    console.log(chalk.green('📋 Report copied to clipboard - ready to paste!'));
    
    // Show key points
    console.log(chalk.blue.bold('\n🎯 Key Points for Presentation:'));
    const keyPoints = report.match(/## Key Talking Points\n([\s\S]*?)(?:\n##|$)/)?.[1] || '';
    console.log(chalk.white(keyPoints.trim()));
  }

  async handleTest() {
    console.log(chalk.blue.bold('\n🧪 Testing Multi-Agent System\n'));

    const sampleCaseStudy = `
# E-Commerce Platform Migration Case Study

## Background
GlobalRetail Corp is a mid-size retailer with $500M annual revenue operating a legacy on-premises e-commerce platform. They need to migrate to Azure cloud to support:

- 10x traffic spikes during Black Friday/holiday seasons
- Global expansion into 15 new markets
- Mobile-first customer experience
- Real-time inventory management across 200 stores
- AI-powered personalization and recommendations

## Current State
- Legacy .NET Framework application on physical servers
- SQL Server 2016 database (2TB)
- Peak traffic: 50,000 concurrent users
- Current availability: 99.5%
- Response time during peak: 3-5 seconds
- Monthly IT costs: $45,000

## Requirements
- 99.9% uptime SLA
- Sub-2 second response time globally
- Support 500,000 concurrent users
- PCI DSS compliance
- GDPR compliance for EU customers
- Budget: $40,000/month maximum
- Timeline: 6 months implementation

## Constraints
- Must maintain business continuity during migration
- Limited Azure expertise on team
- Integration with existing ERP system required
- Seasonal traffic patterns (3x normal during holidays)
`;

    console.log(chalk.gray('Using sample e-commerce migration case study...'));
    
    const result = await this.system.processCaseStudyWithContent(sampleCaseStudy);
    const report = result.markdownContent;
    
    const filename = 'test-solution.md';
    await this.system.saveReport(report, filename);
    
    console.log(chalk.green(`✅ Test completed successfully!`));
    console.log(chalk.green(`📄 Report saved as: ${filename}`));
    
    console.log(chalk.blue('\n📊 Analysis Summary:'));
    console.log(`- Functional Requirements: ${result.analysis.functionalRequirements.length}`);
    console.log(`- Non-Functional Requirements: ${result.analysis.nonFunctionalRequirements.length}`);
    console.log(`- Architecture Options: ${result.analysis.architectureOptions.length}`);
    console.log(`- Risk Factors: ${result.analysis.riskAssessment.length}`);
    console.log(`- Implementation Phases: ${result.analysis.implementationRoadmap.length}`);
  }

  async handleStatus() {
    console.log(chalk.blue.bold('\n🔍 System Status Check\n'));

    const checks = [
      {
        name: 'Azure OpenAI Configuration',
        check: () => !!process.env.AZURE_OPENAI_API_KEY,
        message: process.env.AZURE_OPENAI_API_KEY ? 'Configured' : 'Missing AZURE_OPENAI_API_KEY'
      },
      {
        name: 'Clipboard Support',
        check: async () => {
          try {
            await clipboardy.read();
            return true;
          } catch {
            return false;
          }
        },
        message: 'Available'
      },
      {
        name: 'File System Access',
        check: async () => {
          try {
            await fs.access('.', fs.constants.W_OK);
            return true;
          } catch {
            return false;
          }
        },
        message: 'Available'
      }
    ];

    for (const check of checks) {
      const spinner = ora(`Checking ${check.name}...`).start();
      try {
        const result = await check.check();
        if (result) {
          spinner.succeed(`${check.name}: ${check.message}`);
        } else {
          spinner.fail(`${check.name}: ${check.message}`);
        }
      } catch (error) {
        spinner.fail(`${check.name}: Error - ${error}`);
      }
    }

    console.log(chalk.blue('\n📝 Available Commands:'));
    console.log('  interview-assistant quick    - Quick analysis mode');
    console.log('  interview-assistant analyze  - Advanced analysis with options');
    console.log('  interview-assistant interactive - Guided interactive mode');
    console.log('  interview-assistant test     - Test with sample case study');

    console.log(chalk.blue('\n💡 Quick Start:'));
    console.log('  1. Copy case study to clipboard');
    console.log('  2. Run: npm run quick');
    console.log('  3. Get instant analysis for interview!');
  }

  run() {
    // Set default command to quick mode
    if (process.argv.length === 2) {
      process.argv.push('quick');
    }

    this.program.parse();
  }
}

// Run CLI if called directly
if (require.main === module) {
  const cli = new InterviewCLI();
  cli.run();
}

export { InterviewCLI };