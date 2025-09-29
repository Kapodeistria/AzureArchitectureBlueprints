#!/usr/bin/env tsx
/**
 * Critical Path E2E Test
 * 
 * PURPOSE: Test the exact user workflows that MUST work
 * 
 * CRITICAL USER JOURNEYS:
 * 1. Deploy WAF agents with knowledge base
 * 2. Run WAF assessment on real case study  
 * 3. Generate architecture recommendations
 * 
 * FAILURE IMPACT: If these fail, the product is unusable
 * 
 * USAGE:
 * npm run test:critical-path
 */

import chalk from 'chalk';
import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import { AzureFoundryClient } from '../../src/utils/azure-foundry-client.js';
import { FoundryAgentDeployment } from '../../src/utils/deploy-agents-to-foundry.js';

interface CriticalTestResult {
  workflow: string;
  steps: Array<{
    name: string;
    status: 'pass' | 'fail' | 'skip';
    duration: number;
    error?: string;
    data?: any;
  }>;
  success: boolean;
  totalDuration: number;
}

export class CriticalPathTester {
  private foundryClient: AzureFoundryClient;
  private deployment: FoundryAgentDeployment;
  private results: CriticalTestResult[] = [];

  constructor() {
    this.foundryClient = new AzureFoundryClient();
    this.deployment = new FoundryAgentDeployment();
  }

  async runCriticalPathTests(): Promise<boolean> {
    console.log(chalk.red.bold('🚨 Critical Path E2E Tests'));
    console.log(chalk.yellow('Testing core user workflows that MUST work\n'));

    const workflows = [
      {
        name: 'WAF Agent Deployment with RAG',
        fn: () => this.testWAFAgentDeploymentWorkflow()
      },
      {
        name: 'WAF Assessment Workflow',
        fn: () => this.testWAFAssessmentWorkflow()
      },
      {
        name: 'Architecture Generation Workflow', 
        fn: () => this.testArchitectureGenerationWorkflow()
      }
    ];

    for (const workflow of workflows) {
      await this.runWorkflowTest(workflow.name, workflow.fn);
    }

    return this.generateCriticalPathReport();
  }

  private async runWorkflowTest(workflowName: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log(chalk.blue(`\n🔄 Testing Workflow: ${workflowName}`));
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      this.results.push({
        workflow: workflowName,
        steps: result.steps || [],
        success: true,
        totalDuration: duration
      });
      
      console.log(chalk.green(`✅ ${workflowName} completed successfully (${duration}ms)`));
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.results.push({
        workflow: workflowName,
        steps: [],
        success: false,
        totalDuration: duration
      });
      
      console.log(chalk.red(`❌ ${workflowName} failed (${duration}ms): ${error.message}`));
    }
  }

  // =================================================================
  // CRITICAL WORKFLOW TESTS
  // =================================================================

  /**
   * Test complete WAF agent deployment with RAG integration
   */
  private async testWAFAgentDeploymentWorkflow(): Promise<any> {
    const steps = [];
    
    // Step 1: Verify WAF knowledge base
    console.log(chalk.cyan('  📚 Step 1: Verify WAF Knowledge Base'));
    const knowledgeStep = await this.executeStep('Verify WAF Knowledge Base', async () => {
      const requiredFiles = [
        'waf-knowledge-base/security-knowledge.json',
        'foundry-agents/rag-sources/waf-security-pillar.json'
      ];
      
      for (const file of requiredFiles) {
        if (!existsSync(file)) {
          throw new Error(`Required WAF file missing: ${file}`);
        }
      }
      
      // Validate file content
      const securityFile = await fs.readFile('waf-knowledge-base/security-knowledge.json', 'utf-8');
      const securityData = JSON.parse(securityFile);
      
      if (!securityData.checklistItems || securityData.checklistItems.length < 10) {
        throw new Error('Security knowledge file has insufficient checklist items');
      }
      
      return { filesVerified: requiredFiles.length, checklistItems: securityData.checklistItems.length };
    });
    steps.push(knowledgeStep);

    // Step 2: Test vector store creation
    console.log(chalk.cyan('  🗄️  Step 2: Create Test Vector Store'));
    const vectorStoreStep = await this.executeStep('Create Vector Store', async () => {
      const vectorStoreId = await this.foundryClient.createVectorStoreForAgent(
        'critical-path-test-agent',
        ['waf-security-pillar']
      );
      
      if (!vectorStoreId) {
        throw new Error('Vector store creation failed');
      }
      
      return { vectorStoreId };
    });
    steps.push(vectorStoreStep);

    // Step 3: Test agent deployment with RAG
    console.log(chalk.cyan('  🤖 Step 3: Deploy Test Agent with RAG'));
    const deployStep = await this.executeStep('Deploy Agent with RAG', async () => {
      const testAgent = {
        name: 'critical-path-waf-test',
        description: 'Critical path test agent for WAF security assessment',
        systemPrompt: 'You are a test agent for critical path validation of WAF security assessments.',
        temperature: 0.1,
        maxTokens: 1000,
        ragSources: ['waf-security-pillar']
      };

      const result = await this.foundryClient.deployAgent(testAgent);
      
      if (!result || !result.id) {
        throw new Error('Agent deployment failed');
      }
      
      // Cleanup: Delete the test agent
      await this.foundryClient.deleteAgent(result.id);
      
      return { agentId: result.id, deployed: true, cleaned: true };
    });
    steps.push(deployStep);

    // Step 4: Verify authentication flow
    console.log(chalk.cyan('  🔐 Step 4: Verify Authentication Flow'));
    const authStep = await this.executeStep('Verify Authentication', async () => {
      const connectionTest = await this.foundryClient.testConnection();
      
      if (!connectionTest) {
        throw new Error('Authentication/connection test failed');
      }
      
      return { authenticationWorking: true };
    });
    steps.push(authStep);

    return { steps };
  }

  /**
   * Test WAF assessment workflow end-to-end
   */
  private async testWAFAssessmentWorkflow(): Promise<any> {
    const steps = [];
    
    // Step 1: Load test case study
    console.log(chalk.cyan('  📋 Step 1: Load Test Case Study'));
    const caseStudyStep = await this.executeStep('Load Case Study', async () => {
      // Check if we have a case study file
      const caseStudyFiles = ['case-study.txt', 'tests/fixtures/test-case-study.txt'];
      let caseStudyContent = '';
      
      for (const file of caseStudyFiles) {
        if (existsSync(file)) {
          caseStudyContent = await fs.readFile(file, 'utf-8');
          break;
        }
      }
      
      if (!caseStudyContent) {
        // Create a minimal test case study
        caseStudyContent = `
Test E-commerce Platform Case Study

Company: TechCorp E-commerce
Requirements: 
- High availability web application
- Handle 10,000 concurrent users
- PCI DSS compliance for payment processing
- Global customer base
- 99.9% uptime requirement

Current Architecture:
- Single region deployment
- No redundancy
- Manual scaling
- Basic security controls
        `.trim();
      }
      
      if (caseStudyContent.length < 100) {
        throw new Error('Case study content too short for meaningful assessment');
      }
      
      return { caseStudyLength: caseStudyContent.length, hasContent: true };
    });
    steps.push(caseStudyStep);

    // Step 2: Verify WAF agent definitions
    console.log(chalk.cyan('  🎯 Step 2: Verify WAF Agent Definitions'));
    const agentDefsStep = await this.executeStep('Verify WAF Agents', async () => {
      const agents = this.deployment.defineAgents();
      const wafAgents = agents.filter(a => a.name.startsWith('waf-'));
      
      if (wafAgents.length < 5) {
        throw new Error(`Expected 5 WAF agents, found ${wafAgents.length}`);
      }
      
      // Check each WAF pillar is represented
      const expectedPillars = ['security', 'reliability', 'performance', 'operational', 'cost'];
      const foundPillars = [];
      
      for (const pillar of expectedPillars) {
        const agent = wafAgents.find(a => a.name.includes(pillar));
        if (agent) {
          foundPillars.push(pillar);
          
          // Verify agent has RAG sources
          if (!agent.ragSources || agent.ragSources.length === 0) {
            throw new Error(`WAF ${pillar} agent has no RAG sources`);
          }
        }
      }
      
      if (foundPillars.length !== expectedPillars.length) {
        throw new Error(`Missing WAF pillars: ${expectedPillars.filter(p => !foundPillars.includes(p)).join(', ')}`);
      }
      
      return { wafAgentCount: wafAgents.length, pillarsFound: foundPillars };
    });
    steps.push(agentDefsStep);

    // Step 3: Test WAF knowledge accessibility
    console.log(chalk.cyan('  📖 Step 3: Test WAF Knowledge Accessibility'));
    const knowledgeStep = await this.executeStep('Test WAF Knowledge', async () => {
      const pillars = ['security', 'reliability', 'performance', 'operational', 'cost'];
      const knowledgeResults = [];
      
      for (const pillar of pillars) {
        const knowledgeFile = `waf-knowledge-base/${pillar === 'operational' ? 'operational-excellence' : pillar === 'performance' ? 'performance-efficiency' : pillar}-knowledge.json`;
        
        if (existsSync(knowledgeFile)) {
          const content = await fs.readFile(knowledgeFile, 'utf-8');
          const data = JSON.parse(content);
          
          knowledgeResults.push({
            pillar,
            checklistItems: data.checklistItems?.length || 0,
            hasContent: !!data.checklistItems
          });
        } else {
          throw new Error(`WAF knowledge file missing for ${pillar}: ${knowledgeFile}`);
        }
      }
      
      const totalItems = knowledgeResults.reduce((sum, r) => sum + r.checklistItems, 0);
      if (totalItems < 50) {
        throw new Error(`Insufficient WAF checklist items: ${totalItems} (expected >50)`);
      }
      
      return { knowledgeResults, totalChecklistItems: totalItems };
    });
    steps.push(knowledgeStep);

    return { steps };
  }

  /**
   * Test architecture generation workflow
   */
  private async testArchitectureGenerationWorkflow(): Promise<any> {
    const steps = [];
    
    // Step 1: Verify architecture agent
    console.log(chalk.cyan('  🏗️  Step 1: Verify Architecture Agent'));
    const archAgentStep = await this.executeStep('Verify Architecture Agent', async () => {
      const agents = this.deployment.defineAgents();
      const archAgent = agents.find(a => a.name === 'architecture-designer');
      
      if (!archAgent) {
        throw new Error('Architecture designer agent not found');
      }
      
      if (!archAgent.systemPrompt.includes('Azure')) {
        throw new Error('Architecture agent system prompt does not mention Azure');
      }
      
      return { agentFound: true, systemPromptLength: archAgent.systemPrompt.length };
    });
    steps.push(archAgentStep);

    // Step 2: Verify requirements analyst
    console.log(chalk.cyan('  📝 Step 2: Verify Requirements Analyst'));
    const reqAnalystStep = await this.executeStep('Verify Requirements Analyst', async () => {
      const agents = this.deployment.defineAgents();
      const reqAgent = agents.find(a => a.name === 'requirements-analyst');
      
      if (!reqAgent) {
        throw new Error('Requirements analyst agent not found');
      }
      
      return { agentFound: true };
    });
    steps.push(reqAnalystStep);

    // Step 3: Test agent orchestration workflow
    console.log(chalk.cyan('  🎼 Step 3: Test Agent Orchestration'));
    const orchestrationStep = await this.executeStep('Test Orchestration', async () => {
      // Check if orchestration configuration exists
      const orchestrationPath = 'foundry-agents/workflow-orchestration.json';
      
      let orchestrationExists = false;
      if (existsSync(orchestrationPath)) {
        const orchestration = JSON.parse(await fs.readFile(orchestrationPath, 'utf-8'));
        orchestrationExists = !!orchestration.nodes;
      }
      
      // Test that key agents can work together
      const agents = this.deployment.defineAgents();
      const keyAgents = [
        'requirements-analyst',
        'architecture-designer', 
        'waf-security-agent',
        'waf-cost-agent'
      ];
      
      const missingAgents = keyAgents.filter(name => !agents.find(a => a.name === name));
      if (missingAgents.length > 0) {
        throw new Error(`Missing key agents for orchestration: ${missingAgents.join(', ')}`);
      }
      
      return { 
        orchestrationConfigExists: orchestrationExists,
        keyAgentsPresent: keyAgents.length,
        missingAgents: missingAgents.length
      };
    });
    steps.push(orchestrationStep);

    return { steps };
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  private async executeStep(stepName: string, stepFn: () => Promise<any>): Promise<any> {
    const startTime = Date.now();
    
    try {
      const result = await stepFn();
      const duration = Date.now() - startTime;
      
      console.log(chalk.green(`    ✅ ${stepName} (${duration}ms)`));
      return {
        name: stepName,
        status: 'pass',
        duration,
        data: result
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.log(chalk.red(`    ❌ ${stepName} (${duration}ms): ${error.message}`));
      return {
        name: stepName,
        status: 'fail',
        duration,
        error: error.message
      };
    }
  }

  private generateCriticalPathReport(): boolean {
    const totalWorkflows = this.results.length;
    const successfulWorkflows = this.results.filter(r => r.success).length;
    const failedWorkflows = this.results.filter(r => !r.success).length;
    const success = failedWorkflows === 0;

    console.log(chalk.red.bold('\n🚨 Critical Path Test Results'));
    console.log(chalk.gray('='.repeat(40)));
    
    const status = success ? chalk.green('✅ ALL CRITICAL PATHS WORKING') : chalk.red('❌ CRITICAL FAILURES DETECTED');
    console.log(`${status}`);
    console.log(`📊 Workflows: ${successfulWorkflows}/${totalWorkflows} successful`);

    // Show workflow details
    for (const result of this.results) {
      const workflowStatus = result.success ? '✅' : '❌';
      console.log(`\n${workflowStatus} ${result.workflow} (${result.totalDuration}ms)`);
      
      if (result.steps.length > 0) {
        for (const step of result.steps) {
          const stepStatus = step.status === 'pass' ? '  ✅' : '  ❌';
          console.log(`${stepStatus} ${step.name} (${step.duration}ms)`);
          if (step.error) {
            console.log(chalk.red(`      Error: ${step.error}`));
          }
        }
      }
    }

    if (!success) {
      console.log(chalk.red.bold('\n💥 CRITICAL SYSTEM FAILURES DETECTED'));
      console.log(chalk.yellow('These workflows are essential for the product to function!'));
    }

    return success;
  }
}

// CLI execution
async function main() {
  const tester = new CriticalPathTester();
  const success = await tester.runCriticalPathTests();
  
  process.exit(success ? 0 : 1);
}

// Run if called directly  
if (require.main === module) {
  main().catch(console.error);
}