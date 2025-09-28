#!/usr/bin/env tsx
/**
 * Simple DSL debug test - just generate without validation
 */

import OpenAI from 'openai';
import config from './src/config/config.js';

async function debugDSL() {
  console.log('🐛 Debug DSL Generation...\n');

  try {
    const azureConfig = config.getAzureConfig();
    const client = new OpenAI({
      apiKey: azureConfig.openai.apiKey,
      baseURL: `${azureConfig.openai.endpoint}/openai/deployments/${azureConfig.foundry.modelDeploymentName}`,
      defaultQuery: { 'api-version': '2025-01-01-preview' },
      defaultHeaders: {
        'api-key': azureConfig.openai.apiKey,
      }
    });

    const prompt = `Generate a complete Structurizr DSL for this Azure architecture:

System Name: EcommercePlatform
Requirements: Need a scalable e-commerce platform with user authentication and payment processing

Azure Services: 
- Azure App Service: Web application hosting
- Azure SQL Database: Relational database service
- Azure Blob Storage: File and media storage

Architecture Details:
{
  "description": "Simple e-commerce platform on Azure",
  "components": ["Web App", "API Gateway", "Database", "Storage"],
  "technologies": ["Azure App Service", "Azure SQL Database", "Azure Blob Storage"]
}

Target Level: container
Include Styles: true

Generate a complete, syntactically correct Structurizr DSL with:
1. Proper workspace structure
2. System context diagram
3. Container diagram (if applicable)
4. Azure-themed styling
5. All Azure services properly mapped to C4 elements

Ensure all syntax is valid and elements are properly defined before use.`;

    console.log('🚀 Calling OpenAI...');
    const response = await client.chat.completions.create({
      model: azureConfig.foundry.modelDeploymentName,
      messages: [
        { 
          role: 'system', 
          content: `You are a Structurizr DSL Expert. Generate ONLY valid Structurizr DSL syntax - no pseudo-code.
          
Use proper workspace structure: workspace "name" { model { ... } views { ... } }
Define all elements before referencing them.
Use consistent naming (no spaces in IDs, use camelCase).
Include proper relationships with meaningful descriptions.
Output format: Return ONLY the complete Structurizr DSL code in \`\`\`structurizr blocks.`
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    const content = response.choices[0]?.message?.content || '';
    console.log('📄 Raw Response:');
    console.log('='.repeat(50));
    console.log(content);
    console.log('='.repeat(50));

    // Extract DSL
    const dslMatch = content.match(/```structurizr\n([\s\S]*?)\n```/);
    if (dslMatch) {
      const dsl = dslMatch[1].trim();
      console.log('\n🏗️ Extracted DSL:');
      console.log('-'.repeat(50));
      console.log(dsl);
      console.log('-'.repeat(50));
      
      // Basic syntax check
      console.log('\n🔍 Basic Syntax Check:');
      const hasWorkspace = dsl.includes('workspace ');
      const hasModel = dsl.includes('model {');
      const hasViews = dsl.includes('views {');
      const openBraces = (dsl.match(/{/g) || []).length;
      const closeBraces = (dsl.match(/}/g) || []).length;
      
      console.log(`✓ Has workspace: ${hasWorkspace}`);
      console.log(`✓ Has model: ${hasModel}`);
      console.log(`✓ Has views: ${hasViews}`);
      console.log(`✓ Balanced braces: ${openBraces} open, ${closeBraces} close (${openBraces === closeBraces ? 'OK' : 'ERROR'})`);
      
    } else {
      console.log('❌ No DSL code blocks found in response');
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

debugDSL();