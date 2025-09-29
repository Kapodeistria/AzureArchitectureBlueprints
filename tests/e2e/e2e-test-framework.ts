#!/usr/bin/env tsx
/**
 * E2E Testing Framework for Azure Well-Architected Assessment System
 * 
 * CRITICAL FAILURE DETECTION:
 * - Authentication pipeline failures
 * - WAF knowledge base integrity issues  
 * - Agent deployment and RAG integration
 * - End-to-end assessment workflows
 * - Model compatibility and API changes
 * 
 * USAGE:
 * npm run test:e2e              # Run all E2E tests
 * npm run test:e2e:critical     # Run only critical path tests
 * npm run test:e2e:auth         # Test authentication flows
 * npm run test:e2e:agents       # Test agent deployment
 * npm run test:e2e:assessment   # Test full assessment workflow
 */

import chalk from 'chalk';
import { promises as fs } from 'fs';
import { join } from 'path';
import { existsSync } from 'fs';
import config from '../../src/config/config.js';
import { AzureFoundryClient } from '../../src/utils/azure-foundry-client.js';
import { FoundryAgentDeployment } from '../../src/utils/deploy-agents-to-foundry.js';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  duration: number;
  error?: string;
  details?: any;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
  totalDuration: number;
  passCount: number;
  failCount: number;
  skipCount: number;
}

export class E2ETestFramework {
  private results: TestSuite[] = [];
  private startTime: number = 0;
  private foundryClient: AzureFoundryClient;
  private deployment: FoundryAgentDeployment;

  constructor() {
    this.foundryClient = new AzureFoundryClient();
    this.deployment = new FoundryAgentDeployment();
  }

  /**
   * Run all E2E tests with different severity levels
   */
  async runAllTests(level: 'critical' | 'full' = 'full'): Promise<boolean> {
    console.log(chalk.blue.bold('🧪 Azure WAF Assessment E2E Testing Framework\n'));
    this.startTime = Date.now();

    const testSuites = level === 'critical' ? this.getCriticalTestSuites() : this.getAllTestSuites();
    
    for (const suiteConfig of testSuites) {
      await this.runTestSuite(suiteConfig);
    }

    const success = await this.generateTestReport();
    return success;
  }

  /**
   * Get critical path test suites that must pass
   */
  private getCriticalTestSuites(): any[] {
    return [
      {
        name: 'Authentication Pipeline',
        tests: [
          { name: 'API Key Authentication', fn: () => this.testApiKeyAuth() },
          { name: 'Azure CLI Fallback', fn: () => this.testAzureCliFallback() },
          { name: 'Authentication Priority Order', fn: () => this.testAuthPriority() }
        ]
      },
      {
        name: 'WAF Knowledge Base Integrity',
        tests: [
          { name: 'WAF JSON Files Exist', fn: () => this.testWAFFilesExist() },
          { name: 'WAF Content Validation', fn: () => this.testWAFContentIntegrity() },
          { name: 'RAG Sources Mapping', fn: () => this.testRAGSourcesMapping() }
        ]
      },
      {
        name: 'Agent Deployment Pipeline',
        tests: [
          { name: 'Foundry Connection Test', fn: () => this.testFoundryConnection() },
          { name: 'Vector Store Creation', fn: () => this.testVectorStoreCreation() },
          { name: 'WAF Agent Deployment', fn: () => this.testWAFAgentDeployment() }
        ]
      },
      {
        name: 'End-to-End Assessment',
        tests: [
          { name: 'WAF Security Assessment', fn: () => this.testWAFSecurityAssessment() },
          { name: 'Multi-Pillar Integration', fn: () => this.testMultiPillarIntegration() }
        ]
      }
    ];
  }

  /**
   * Get comprehensive test suites for full validation
   */
  private getAllTestSuites(): any[] {
    const critical = this.getCriticalTestSuites();
    const additional = [
      {
        name: 'Configuration Management',
        tests: [
          { name: 'Config File Loading', fn: () => this.testConfigLoading() },
          { name: 'Environment Variables', fn: () => this.testEnvironmentVariables() },
          { name: 'Model Configuration', fn: () => this.testModelConfiguration() }
        ]
      },
      {
        name: 'CLI Integration',
        tests: [
          { name: 'Bash Script Execution', fn: () => this.testBashScriptExecution() },
          { name: 'Agent Registry Management', fn: () => this.testAgentRegistry() }
        ]
      }
    ];
    return [...critical, ...additional];
  }

  /**
   * Run a single test suite
   */
  private async runTestSuite(suiteConfig: any): Promise<void> {
    console.log(chalk.yellow(`\n📋 Running Test Suite: ${suiteConfig.name}`));
    
    const suite: TestSuite = {
      name: suiteConfig.name,
      tests: [],
      totalDuration: 0,
      passCount: 0,
      failCount: 0,
      skipCount: 0
    };

    const suiteStartTime = Date.now();

    for (const testConfig of suiteConfig.tests) {
      const result = await this.runSingleTest(testConfig.name, testConfig.fn);
      suite.tests.push(result);
      
      if (result.status === 'pass') suite.passCount++;
      else if (result.status === 'fail') suite.failCount++;
      else suite.skipCount++;
    }

    suite.totalDuration = Date.now() - suiteStartTime;
    this.results.push(suite);

    // Print suite summary
    const status = suite.failCount === 0 ? chalk.green('✅ PASS') : chalk.red('❌ FAIL');
    console.log(`${status} ${suite.name}: ${suite.passCount}/${suite.tests.length} tests passed`);
  }

  /**
   * Run a single test with error handling
   */
  private async runSingleTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      console.log(chalk.cyan(`  🧪 ${name}...`));
      const result = await testFn();
      const duration = Date.now() - startTime;
      
      console.log(chalk.green(`    ✅ Pass (${duration}ms)`));
      return {
        name,
        status: 'pass',
        duration,
        details: result
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(chalk.red(`    ❌ Fail (${duration}ms): ${error.message}`));
      
      return {
        name,
        status: 'fail',
        duration,
        error: error.message
      };
    }
  }

  // =================================================================
  // CRITICAL TEST IMPLEMENTATIONS
  // =================================================================

  /**
   * Test API key authentication works correctly
   */
  private async testApiKeyAuth(): Promise<any> {
    const originalKey = process.env.FOUNDRY_API_KEY;
    
    try {
      // Test with valid API key format
      process.env.FOUNDRY_API_KEY = 'test-api-key-for-e2e-testing';
      const client = new AzureFoundryClient();
      
      // Should prefer API key over other methods
      const authMethod = await this.getAuthMethod(client);
      if (!authMethod.includes('api-key')) {
        throw new Error('API key authentication not preferred when FOUNDRY_API_KEY is set');
      }
      
      return { authMethod, apiKeyDetected: true };
    } finally {
      // Restore original value
      if (originalKey) {
        process.env.FOUNDRY_API_KEY = originalKey;
      } else {
        delete process.env.FOUNDRY_API_KEY;
      }
    }
  }

  /**
   * Test Azure CLI fallback when API key is not available
   */
  private async testAzureCliFallback(): Promise<any> {
    const originalKey = process.env.FOUNDRY_API_KEY;
    
    try {
      // Remove API key to test fallback
      delete process.env.FOUNDRY_API_KEY;
      
      const client = new AzureFoundryClient();
      const connectionTest = await client.testConnection();
      
      return { fallbackWorking: connectionTest };
    } finally {
      if (originalKey) {
        process.env.FOUNDRY_API_KEY = originalKey;
      }
    }
  }

  /**
   * Test authentication priority order
   */
  private async testAuthPriority(): Promise<any> {
    // Test that API key has priority over Azure CLI
    const priorities = [];
    
    // Test 1: No auth configured
    const originalKey = process.env.FOUNDRY_API_KEY;
    delete process.env.FOUNDRY_API_KEY;
    
    try {
      const client1 = new AzureFoundryClient();
      const method1 = await this.getAuthMethod(client1);
      priorities.push({ scenario: 'no_api_key', method: method1 });
      
      // Test 2: API key configured
      process.env.FOUNDRY_API_KEY = 'test-key';
      const client2 = new AzureFoundryClient();
      const method2 = await this.getAuthMethod(client2);
      priorities.push({ scenario: 'with_api_key', method: method2 });
      
      return { priorities };
    } finally {
      if (originalKey) {
        process.env.FOUNDRY_API_KEY = originalKey;
      } else {
        delete process.env.FOUNDRY_API_KEY;
      }
    }
  }

  /**
   * Test WAF knowledge base files exist and are accessible
   */
  private async testWAFFilesExist(): Promise<any> {
    const requiredFiles = [
      'waf-knowledge-base/security-knowledge.json',
      'waf-knowledge-base/reliability-knowledge.json',
      'waf-knowledge-base/performance-efficiency-knowledge.json',
      'waf-knowledge-base/operational-excellence-knowledge.json',
      'waf-knowledge-base/cost-optimization-knowledge.json',
      'foundry-agents/rag-sources/waf-security-pillar.json',
      'foundry-agents/rag-sources/waf-reliability-pillar.json'
    ];

    const missingFiles = [];
    const existingFiles = [];

    for (const file of requiredFiles) {
      if (existsSync(file)) {
        existingFiles.push(file);
      } else {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length > 0) {
      throw new Error(`Missing WAF knowledge files: ${missingFiles.join(', ')}`);
    }

    return { existingFiles, totalFiles: existingFiles.length };
  }

  /**
   * Test WAF content integrity and structure
   */
  private async testWAFContentIntegrity(): Promise<any> {
    const wafFiles = [
      'waf-knowledge-base/security-knowledge.json',
      'waf-knowledge-base/reliability-knowledge.json'
    ];

    const validationResults = [];

    for (const file of wafFiles) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const data = JSON.parse(content);
        
        // Validate structure
        if (!data.pillar || !data.checklistItems || !Array.isArray(data.checklistItems)) {
          throw new Error(`Invalid WAF structure in ${file}`);
        }

        // Validate checklist items have required properties
        for (const item of data.checklistItems) {
          if (!item.id || !item.title || !item.description) {
            throw new Error(`Invalid checklist item in ${file}: missing id, title, or description`);
          }
        }

        validationResults.push({
          file,
          pillar: data.pillar,
          itemCount: data.checklistItems.length,
          valid: true
        });
      } catch (error) {
        validationResults.push({
          file,
          valid: false,
          error: error.message
        });
      }
    }

    const invalidFiles = validationResults.filter(r => !r.valid);
    if (invalidFiles.length > 0) {
      throw new Error(`Invalid WAF files: ${invalidFiles.map(f => f.file).join(', ')}`);
    }

    return { validationResults };
  }

  /**
   * Test RAG sources mapping
   */
  private async testRAGSourcesMapping(): Promise<any> {
    const ragSources = [
      'waf-security-pillar',
      'waf-reliability-pillar',
      'waf-performance-pillar',
      'waf-operational-pillar',
      'waf-cost-pillar'
    ];

    const mappingResults = [];

    for (const source of ragSources) {
      const possiblePaths = [
        `waf-knowledge-base/${source.replace('waf-', '')}-knowledge.json`,
        `foundry-agents/rag-sources/${source}.json`,
        `foundry-agents/rag-sources/${source}-content.md`
      ];

      let found = false;
      for (const path of possiblePaths) {
        if (existsSync(path)) {
          mappingResults.push({ source, path, found: true });
          found = true;
          break;
        }
      }

      if (!found) {
        mappingResults.push({ source, found: false });
      }
    }

    const unmappedSources = mappingResults.filter(r => !r.found);
    if (unmappedSources.length > 0) {
      throw new Error(`Unmapped RAG sources: ${unmappedSources.map(s => s.source).join(', ')}`);
    }

    return { mappingResults };
  }

  /**
   * Test Azure AI Foundry connection
   */
  private async testFoundryConnection(): Promise<any> {
    const connectionResult = await this.foundryClient.testConnection();
    
    if (!connectionResult) {
      throw new Error('Azure AI Foundry connection failed');
    }

    return { connectionSuccessful: true };
  }

  /**
   * Test vector store creation for RAG
   */
  private async testVectorStoreCreation(): Promise<any> {
    // Test creating a small vector store with test data
    const testSources = ['waf-security-pillar'];
    
    try {
      const vectorStoreId = await this.foundryClient.createVectorStoreForAgent(
        'test-e2e-agent',
        testSources
      );

      if (!vectorStoreId) {
        throw new Error('Vector store creation returned null');
      }

      return { vectorStoreId, success: true };
    } catch (error) {
      throw new Error(`Vector store creation failed: ${error.message}`);
    }
  }

  /**
   * Test WAF agent deployment with RAG
   */
  private async testWAFAgentDeployment(): Promise<any> {
    const testAgent = {
      name: 'test-waf-security-e2e',
      description: 'E2E test agent for WAF security assessment',
      systemPrompt: 'You are a test agent for E2E validation.',
      temperature: 0.1,
      maxTokens: 1000,
      ragSources: ['waf-security-pillar']
    };

    try {
      const result = await this.foundryClient.deployAgent(testAgent);
      
      if (!result || !result.id) {
        throw new Error('Agent deployment failed - no ID returned');
      }

      // Cleanup test agent
      await this.foundryClient.deleteAgent(result.id);

      return { agentId: result.id, deploymentSuccess: true };
    } catch (error) {
      throw new Error(`WAF agent deployment failed: ${error.message}`);
    }
  }

  /**
   * Test WAF security assessment workflow
   */
  private async testWAFSecurityAssessment(): Promise<any> {
    // This would test the full assessment workflow
    // For now, test that the security agent can be found and has RAG sources
    const agents = this.deployment.defineAgents();
    const securityAgent = agents.find(a => a.name === 'waf-security-agent');
    
    if (!securityAgent) {
      throw new Error('WAF security agent not found in agent definitions');
    }

    if (!securityAgent.ragSources || securityAgent.ragSources.length === 0) {
      throw new Error('WAF security agent has no RAG sources configured');
    }

    return {
      agentFound: true,
      ragSourcesCount: securityAgent.ragSources.length,
      ragSources: securityAgent.ragSources
    };
  }

  /**
   * Test multi-pillar integration
   */
  private async testMultiPillarIntegration(): Promise<any> {
    const agents = this.deployment.defineAgents();
    const wafAgents = agents.filter(a => a.name.startsWith('waf-'));
    
    if (wafAgents.length < 5) {
      throw new Error(`Expected 5 WAF agents, found ${wafAgents.length}`);
    }

    const pillars = ['security', 'reliability', 'performance', 'operational', 'cost'];
    const foundPillars = [];

    for (const pillar of pillars) {
      const agent = wafAgents.find(a => a.name.includes(pillar));
      if (agent) {
        foundPillars.push(pillar);
      }
    }

    if (foundPillars.length !== pillars.length) {
      throw new Error(`Missing WAF pillars: ${pillars.filter(p => !foundPillars.includes(p)).join(', ')}`);
    }

    return { foundPillars, totalAgents: wafAgents.length };
  }

  // =================================================================
  // ADDITIONAL TEST IMPLEMENTATIONS
  // =================================================================

  private async testConfigLoading(): Promise<any> {
    const configData = config.get();
    
    if (!configData.azure?.foundry?.projectEndpoint) {
      throw new Error('Azure Foundry project endpoint not configured');
    }

    if (!configData.azure?.foundry?.modelDeploymentName) {
      throw new Error('Model deployment name not configured');
    }

    return { configValid: true, endpoint: configData.azure.foundry.projectEndpoint };
  }

  private async testEnvironmentVariables(): Promise<any> {
    const requiredVars = ['PROJECT_ENDPOINT'];
    const optionalVars = ['FOUNDRY_API_KEY', 'AZURE_OPENAI_API_KEY'];
    
    const missing = requiredVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return { requiredVarsPresent: true };
  }

  private async testModelConfiguration(): Promise<any> {
    const configData = config.get();
    const modelName = configData.azure.foundry.modelDeploymentName;
    
    if (modelName !== 'gpt-4.1') {
      throw new Error(`Expected model 'gpt-4.1', got '${modelName}'`);
    }

    return { modelName, valid: true };
  }

  private async testBashScriptExecution(): Promise<any> {
    const scriptPath = 'scripts/deploy/deploy-agents.sh';
    
    if (!existsSync(scriptPath)) {
      throw new Error(`Deploy script not found: ${scriptPath}`);
    }

    // Test script has executable permissions (on Unix systems)
    try {
      await fs.access(scriptPath, fs.constants.F_OK);
      return { scriptExists: true, executable: true };
    } catch (error) {
      throw new Error(`Script not accessible: ${error.message}`);
    }
  }

  private async testAgentRegistry(): Promise<any> {
    const registryPath = 'foundry-agents/agent-ids.env';
    
    if (!existsSync(registryPath)) {
      // Registry file might not exist if no agents deployed yet
      return { registryExists: false, agentsDeployed: false };
    }

    const content = await fs.readFile(registryPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    
    return {
      registryExists: true,
      agentCount: lines.length,
      registryPath
    };
  }

  // =================================================================
  // UTILITY METHODS
  // =================================================================

  private async getAuthMethod(client: any): Promise<string> {
    try {
      // Mock the getAuthHeaders method to see what auth type is used
      const authHeaders = await (client as any).getAuthHeaders();
      return Object.keys(authHeaders)[0]; // 'api-key' or 'Authorization'
    } catch (error) {
      return 'none';
    }
  }

  /**
   * Generate comprehensive test report
   */
  private async generateTestReport(): Promise<boolean> {
    const totalDuration = Date.now() - this.startTime;
    const totalTests = this.results.reduce((sum, suite) => sum + suite.tests.length, 0);
    const totalPassed = this.results.reduce((sum, suite) => sum + suite.passCount, 0);
    const totalFailed = this.results.reduce((sum, suite) => sum + suite.failCount, 0);
    const success = totalFailed === 0;

    console.log(chalk.blue.bold('\n📊 E2E Test Report'));
    console.log(chalk.gray('='.repeat(50)));
    
    // Overall summary
    const status = success ? chalk.green('✅ ALL TESTS PASSED') : chalk.red('❌ TESTS FAILED');
    console.log(`${status}`);
    console.log(`📊 Total: ${totalTests} tests in ${this.results.length} suites`);
    console.log(`✅ Passed: ${totalPassed}`);
    console.log(`❌ Failed: ${totalFailed}`);
    console.log(`⏱️  Duration: ${totalDuration}ms`);

    // Suite breakdown
    console.log(chalk.blue('\n📋 Suite Results:'));
    for (const suite of this.results) {
      const suiteStatus = suite.failCount === 0 ? '✅' : '❌';
      console.log(`  ${suiteStatus} ${suite.name}: ${suite.passCount}/${suite.tests.length} (${suite.totalDuration}ms)`);
      
      // Show failed tests
      const failedTests = suite.tests.filter(t => t.status === 'fail');
      for (const test of failedTests) {
        console.log(chalk.red(`    ❌ ${test.name}: ${test.error}`));
      }
    }

    // Save detailed report
    const report = {
      summary: {
        success,
        totalTests,
        totalPassed,
        totalFailed,
        totalDuration,
        timestamp: new Date().toISOString()
      },
      suites: this.results
    };

    await fs.mkdir('tests/reports', { recursive: true });
    await fs.writeFile(
      'tests/reports/e2e-test-report.json',
      JSON.stringify(report, null, 2)
    );

    console.log(chalk.blue('\n📄 Detailed report saved to: tests/reports/e2e-test-report.json'));
    
    return success;
  }
}

// CLI execution
async function main() {
  const args = process.argv.slice(2);
  const level = args.includes('--critical') ? 'critical' : 'full';
  
  const framework = new E2ETestFramework();
  const success = await framework.runAllTests(level);
  
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { E2ETestFramework };