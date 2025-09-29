#!/usr/bin/env tsx
/**
 * Smoke Test - Ultra-Fast Critical System Validation
 * 
 * PURPOSE: Detect system-breaking changes in < 30 seconds
 * 
 * This runs the absolute minimum tests to verify the system isn't completely broken.
 * Perfect for:
 * - Pre-commit hooks
 * - Quick development feedback  
 * - CI/CD pipeline gates
 * 
 * USAGE:
 * npm run test:smoke       # Quick smoke test (< 30s)
 * npm run test:smoke:fast  # Ultra-fast version (< 10s)
 */

import chalk from 'chalk';
import { existsSync } from 'fs';
import { promises as fs } from 'fs';
import config from '../../src/config/config.js';
import { AzureFoundryClient } from '../../src/utils/azure-foundry-client.js';

interface SmokeTestResult {
  name: string;
  status: 'pass' | 'fail';
  duration: number;
  error?: string;
}

export class SmokeTestRunner {
  private results: SmokeTestResult[] = [];
  private startTime: number = 0;

  async runSmokeTests(mode: 'fast' | 'standard' = 'standard'): Promise<boolean> {
    console.log(chalk.blue.bold('💨 Azure WAF Assessment - Smoke Test'));
    console.log(chalk.gray(`Mode: ${mode} | Target: ${mode === 'fast' ? '<10s' : '<30s'}\n`));
    
    this.startTime = Date.now();
    
    // Critical path tests only
    const tests = mode === 'fast' ? this.getFastSmokeTests() : this.getStandardSmokeTests();
    
    for (const test of tests) {
      await this.runSmokeTest(test.name, test.fn);
    }
    
    return this.generateSmokeReport();
  }

  /**
   * Ultra-fast smoke tests (< 10 seconds)
   */
  private getFastSmokeTests() {
    return [
      { name: 'Config Loading', fn: () => this.testConfigLoading() },
      { name: 'WAF Files Exist', fn: () => this.testWAFFilesExist() },
      { name: 'Deploy Scripts Present', fn: () => this.testDeployScriptsExist() }
    ];
  }

  /**
   * Standard smoke tests (< 30 seconds) 
   */
  private getStandardSmokeTests() {
    return [
      ...this.getFastSmokeTests(),
      { name: 'Agent Definitions Valid', fn: () => this.testAgentDefinitions() },
      { name: 'Authentication Setup', fn: () => this.testAuthenticationSetup() },
      { name: 'WAF Content Structure', fn: () => this.testWAFContentStructure() },
      { name: 'Foundry Client Creation', fn: () => this.testFoundryClientCreation() }
    ];
  }

  private async runSmokeTest(name: string, testFn: () => Promise<any>): Promise<void> {
    const startTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - startTime;
      
      console.log(chalk.green(`✅ ${name} (${duration}ms)`));
      this.results.push({ name, status: 'pass', duration });
    } catch (error) {
      const duration = Date.now() - startTime;
      
      console.log(chalk.red(`❌ ${name} (${duration}ms): ${error.message}`));
      this.results.push({ name, status: 'fail', duration, error: error.message });
    }
  }

  // =================================================================
  // SMOKE TEST IMPLEMENTATIONS
  // =================================================================

  private async testConfigLoading(): Promise<void> {
    const configData = config.get();
    
    if (!configData.azure?.foundry?.projectEndpoint) {
      throw new Error('Missing Azure Foundry project endpoint');
    }
    
    if (!configData.azure?.foundry?.modelDeploymentName) {
      throw new Error('Missing model deployment name');
    }

    if (configData.azure.foundry.modelDeploymentName !== 'gpt-4.1') {
      throw new Error(`Expected model 'gpt-4.1', got '${configData.azure.foundry.modelDeploymentName}'`);
    }
  }

  private async testWAFFilesExist(): Promise<void> {
    const criticalFiles = [
      'waf-knowledge-base/security-knowledge.json',
      'waf-knowledge-base/reliability-knowledge.json',
      'foundry-agents/rag-sources/waf-security-pillar.json'
    ];

    for (const file of criticalFiles) {
      if (!existsSync(file)) {
        throw new Error(`Critical WAF file missing: ${file}`);
      }
    }
  }

  private async testDeployScriptsExist(): Promise<void> {
    const scripts = [
      'scripts/deploy/deploy-agents.sh',
      'src/utils/deploy-agents-to-foundry.ts',
      'src/utils/azure-foundry-client.ts'
    ];

    for (const script of scripts) {
      if (!existsSync(script)) {
        throw new Error(`Critical deployment script missing: ${script}`);
      }
    }
  }

  private async testAgentDefinitions(): Promise<void> {
    try {
      // Import and test agent definitions
      const { FoundryAgentDeployment } = await import('../../src/utils/deploy-agents-to-foundry.js');
      const deployment = new FoundryAgentDeployment();
      const agents = (deployment as any).defineAgents();
      
      if (!agents || agents.length === 0) {
        throw new Error('No agents defined');
      }

      // Check for WAF agents
      const wafAgents = agents.filter((a: any) => a.name.startsWith('waf-'));
      if (wafAgents.length < 5) {
        throw new Error(`Expected 5 WAF agents, found ${wafAgents.length}`);
      }

      // Check critical agent properties
      for (const agent of wafAgents) {
        if (!agent.name || !agent.systemPrompt || !agent.ragSources) {
          throw new Error(`Invalid agent definition: ${agent.name}`);
        }
      }
    } catch (error) {
      throw new Error(`Agent definition test failed: ${error.message}`);
    }
  }

  private async testAuthenticationSetup(): Promise<void> {
    // Test that authentication configuration is valid
    const hasApiKey = !!process.env.FOUNDRY_API_KEY;
    const hasEnvFile = existsSync('.env.local');
    
    // Check if Azure CLI is available (don't actually test login)
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      await execAsync('which az');
      // Azure CLI is available
    } catch {
      if (!hasApiKey && !hasEnvFile) {
        throw new Error('No authentication method available (no API key, no .env.local, no Azure CLI)');
      }
    }
  }

  private async testWAFContentStructure(): Promise<void> {
    // Test one WAF file structure as representative
    const testFile = 'waf-knowledge-base/security-knowledge.json';
    
    if (!existsSync(testFile)) {
      throw new Error(`WAF test file missing: ${testFile}`);
    }

    const content = await fs.readFile(testFile, 'utf-8');
    const data = JSON.parse(content);
    
    if (!data.pillar || !data.checklistItems || !Array.isArray(data.checklistItems)) {
      throw new Error('Invalid WAF file structure');
    }

    if (data.checklistItems.length === 0) {
      throw new Error('WAF file has no checklist items');
    }

    // Check first item structure
    const firstItem = data.checklistItems[0];
    if (!firstItem.id || !firstItem.title || !firstItem.description) {
      throw new Error('Invalid WAF checklist item structure');
    }
  }

  private async testFoundryClientCreation(): Promise<void> {
    try {
      const client = new AzureFoundryClient();
      
      // Just test that client can be created without errors
      // Don't actually make API calls in smoke test
      if (!client) {
        throw new Error('Failed to create Foundry client');
      }
    } catch (error) {
      throw new Error(`Foundry client creation failed: ${error.message}`);
    }
  }

  // =================================================================
  // REPORTING
  // =================================================================

  private generateSmokeReport(): boolean {
    const totalDuration = Date.now() - this.startTime;
    const totalTests = this.results.length;
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const success = failed === 0;

    console.log(chalk.blue('\n💨 Smoke Test Results'));
    console.log(chalk.gray('='.repeat(30)));
    
    const status = success ? chalk.green('✅ SYSTEM HEALTHY') : chalk.red('❌ SYSTEM BROKEN');
    console.log(`${status}`);
    console.log(`📊 ${passed}/${totalTests} tests passed`);
    console.log(`⏱️  ${totalDuration}ms total`);

    if (failed > 0) {
      console.log(chalk.red('\n💥 Critical Failures:'));
      this.results
        .filter(r => r.status === 'fail')
        .forEach(r => console.log(chalk.red(`  ❌ ${r.name}: ${r.error}`)));
    }

    // Performance check
    const targetTime = totalTests <= 3 ? 10000 : 30000; // 10s for fast, 30s for standard
    if (totalDuration > targetTime) {
      console.log(chalk.yellow(`⚠️  Performance: ${totalDuration}ms > ${targetTime}ms target`));
    }

    return success;
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--fast') ? 'fast' : 'standard';
  
  const runner = new SmokeTestRunner();
  const success = await runner.runSmokeTests(mode);
  
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}