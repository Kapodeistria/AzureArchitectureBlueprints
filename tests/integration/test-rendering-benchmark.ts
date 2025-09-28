#!/usr/bin/env tsx
/**
 * Benchmark test for Structurizr rendering methods
 */

import OpenAI from 'openai';
import { StructurizrRendererAgent } from './src/agents/structurizr-renderer-agent.js';
import config from './src/config/config.js';
import path from 'path';

async function benchmarkRendering() {
  console.log('🏁 Starting Structurizr Rendering Benchmark...\n');

  try {
    // Initialize OpenAI client
    const azureConfig = config.getAzureConfig();
    const client = new OpenAI({
      apiKey: azureConfig.openai.apiKey,
      baseURL: `${azureConfig.openai.endpoint}/openai/deployments/${azureConfig.foundry.modelDeploymentName}`,
      defaultQuery: { 'api-version': '2025-01-01-preview' },
      defaultHeaders: {
        'api-key': azureConfig.openai.apiKey,
      }
    });

    // Create renderer agent
    const renderer = new StructurizrRendererAgent(client);

    // Sample DSL content for testing
    const sampleDSL = `workspace "EcommercePlatform" {

    model {
        user = person "Customer" "A user of the e-commerce platform."
        
        ecommercePlatform = softwareSystem "EcommercePlatform" "A scalable e-commerce platform with user authentication and payment processing."
        
        webApp = container "Web App" "Azure App Service" "Allows customers to browse products, manage their cart, and place orders."
        apiGateway = container "API Gateway" "Azure App Service" "Handles API requests, authentication, and routes requests to backend services."
        database = container "Database" "Azure SQL Database" "Stores product, order, and user data."
        storage = container "Storage" "Azure Blob Storage" "Stores product images and other media files."
        
        user -> webApp "Browses and shops using"
        webApp -> apiGateway "Sends API requests via"
        apiGateway -> database "Reads from and writes to"
        apiGateway -> storage "Stores and retrieves media files from"
        webApp -> storage "Retrieves product images from"
    }
    
    views {
        systemContext ecommercePlatform "System Context" {
            include *
            autolayout lr
            title "EcommercePlatform - System Context"
        }
        
        container ecommercePlatform "Container Diagram" {
            include *
            autolayout lr
            title "EcommercePlatform - Container Diagram"
        }
        
        styles {
            element "Person" {
                background #FFB900
                color #000000
                shape person
            }
            element "Software System" {
                background #0078D4
                color #ffffff
                shape roundedbox
            }
            element "Container" {
                background #106EBE
                color #ffffff
                shape roundedbox
            }
        }
    }
}`;

    // Create benchmark task
    const renderTask = {
      id: 'benchmark-test',
      type: 'structurizr-render',
      priority: 'high' as const,
      payload: {
        dslContent: sampleDSL,
        outputDir: path.join(process.cwd(), 'output', 'render-benchmark'),
        systemName: 'EcommercePlatform',
        formats: ['svg', 'png'] as const,
        caseStudyFolder: 'benchmark-test'
      }
    };

    console.log('🚀 Starting benchmark with 6 rendering methods...\n');
    const startTime = Date.now();
    
    const results = await renderer.execute(renderTask);
    
    const endTime = Date.now();
    console.log(`\n⏱️ Total benchmark time: ${endTime - startTime}ms\n`);

    // Display results
    console.log('📊 BENCHMARK RESULTS:');
    console.log('='.repeat(60));
    
    console.log(`🏆 Best Overall Method: ${results.bestMethod}`);
    console.log(`⚡ Fastest: ${results.summary.fastest}`);
    console.log(`🎨 Highest Quality: ${results.summary.highestQuality}`);
    console.log(`📦 Smallest File: ${results.summary.smallestFile}`);
    console.log(`🔧 Most Reliable: ${results.summary.mostReliable}`);
    
    console.log('\n📈 METHOD PERFORMANCE:');
    console.log('-'.repeat(60));
    
    results.methods.forEach(method => {
      const status = method.success ? '✅' : '❌';
      const time = method.success ? `${method.executionTime}ms` : 'Failed';
      const quality = method.success ? `${method.quality}/100` : 'N/A';
      const size = method.fileSize ? `${Math.round(method.fileSize / 1024)}KB` : 'N/A';
      const deps = method.metadata.dependencies.length > 0 ? 
        method.metadata.dependencies.join(', ') : 'None';
      
      console.log(`${status} ${method.method}`);
      console.log(`   Time: ${time} | Quality: ${quality} | Size: ${size}`);
      console.log(`   Dependencies: ${deps}`);
      if (!method.success) {
        console.log(`   Error: ${method.error}`);
      }
      console.log('');
    });

    console.log('💡 RECOMMENDATIONS:');
    console.log('-'.repeat(60));
    results.recommendations.forEach((rec, index) => {
      console.log(`${index + 1}. ${rec}`);
    });

    console.log('\n🛠️ DEPENDENCY STATUS:');
    console.log('-'.repeat(60));
    const allDeps = new Set();
    results.methods.forEach(m => m.metadata.dependencies.forEach(d => allDeps.add(d)));
    
    for (const dep of allDeps) {
      const methodsUsingDep = results.methods.filter(m => 
        m.metadata.dependencies.includes(dep));
      const workingMethods = methodsUsingDep.filter(m => m.success).length;
      const totalMethods = methodsUsingDep.length;
      
      const status = workingMethods === totalMethods ? '✅' : 
                    workingMethods > 0 ? '⚠️' : '❌';
      
      console.log(`${status} ${dep}: ${workingMethods}/${totalMethods} methods working`);
    }

    console.log('\n🎯 INSTALLATION GUIDE:');
    console.log('-'.repeat(60));
    console.log('To enable all rendering methods:');
    console.log('');
    console.log('1. Structurizr CLI:');
    console.log('   Download from: https://github.com/structurizr/cli');
    console.log('   Add to PATH');
    console.log('');
    console.log('2. PlantUML:');
    console.log('   brew install plantuml');
    console.log('   or download from: https://plantuml.com/download');
    console.log('');
    console.log('3. Mermaid CLI:');
    console.log('   npm install -g @mermaid-js/mermaid-cli');
    console.log('');
    console.log('4. Puppeteer (for web rendering):');
    console.log('   npm install puppeteer');

  } catch (error) {
    console.error('💥 Benchmark failed:', error.message);
  }
}

benchmarkRendering();