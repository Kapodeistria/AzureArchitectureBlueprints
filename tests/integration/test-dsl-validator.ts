#!/usr/bin/env tsx
/**
 * Simple test for the Structurizr DSL Validator Agent
 */

import OpenAI from 'openai';
import { StructurizrDSLValidatorAgent } from './src/agents/structurizr-dsl-validator-agent.js';
import config from './src/config/config.js';

async function testDSLValidator() {
  console.log('🧪 Testing Structurizr DSL Validator Agent...\n');

  try {
    // Initialize OpenAI client with correct config structure
    const azureConfig = config.getAzureConfig();
    const client = new OpenAI({
      apiKey: azureConfig.openai.apiKey,
      baseURL: `${azureConfig.openai.endpoint}/openai/deployments/${azureConfig.foundry.modelDeploymentName}`,
      defaultQuery: { 'api-version': '2025-01-01-preview' },
      defaultHeaders: {
        'api-key': azureConfig.openai.apiKey,
      }
    });

    // Create DSL validator agent
    const dslAgent = new StructurizrDSLValidatorAgent(client);

    // Test data
    const testTask = {
      id: 'test-dsl',
      type: 'structurizr-dsl',
      priority: 'high' as const,
      payload: {
        architecture: {
          description: 'Simple e-commerce platform on Azure',
          components: ['Web App', 'API Gateway', 'Database', 'Storage'],
          technologies: ['Azure App Service', 'Azure SQL Database', 'Azure Blob Storage']
        },
        requirements: 'Need a scalable e-commerce platform with user authentication and payment processing',
        azureServices: [
          { name: 'Azure App Service', description: 'Web application hosting' },
          { name: 'Azure SQL Database', description: 'Relational database service' },
          { name: 'Azure Blob Storage', description: 'File and media storage' }
        ],
        systemName: 'EcommercePlatform',
        maxIterations: 2,
        targetLevel: 'container' as const,
        includeStyles: true
      }
    };

    console.log('🚀 Starting DSL generation and validation...');
    const startTime = Date.now();
    
    const result = await dslAgent.execute(testTask);
    
    const endTime = Date.now();
    console.log(`⏱️ Execution completed in ${endTime - startTime}ms\n`);

    // Display results
    if (result.success) {
      console.log('✅ DSL Generation SUCCESSFUL!');
      console.log(`📊 Quality Score: ${result.qualityScore}/100`);
      console.log(`🔄 Iterations: ${result.iterations}`);
      console.log(`📁 File Path: ${result.filePath}`);
      console.log(`💬 Message: ${result.message}\n`);
      
      console.log('🏗️ Generated Structurizr DSL:');
      console.log('---'.repeat(20));
      console.log(result.structurizrDSL);
      console.log('---'.repeat(20));
      
      if (result.validationResult?.warnings?.length > 0) {
        console.log('\n⚠️ Warnings:');
        result.validationResult.warnings.forEach(warning => console.log(`  - ${warning}`));
      }
      
    } else {
      console.log('❌ DSL Generation FAILED!');
      console.log(`💬 Message: ${result.message}`);
      console.log(`🔄 Iterations: ${result.iterations}`);
      
      if (result.validationResult?.errors?.length > 0) {
        console.log('\n🚨 Errors:');
        result.validationResult.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      // Show the failed DSL for debugging
      if (result.structurizrDSL) {
        console.log('\n💻 Failed DSL Code (for debugging):');
        console.log('---'.repeat(15));
        console.log(result.structurizrDSL);
        console.log('---'.repeat(15));
      }
    }

  } catch (error) {
    console.error('💥 Test failed with error:', error);
  }
}

// Run the test
testDSLValidator();