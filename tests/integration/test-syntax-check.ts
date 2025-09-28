#!/usr/bin/env tsx
/**
 * Quick syntax validation test
 */

import { StructurizrDSLValidatorAgent } from './src/agents/structurizr-dsl-validator-agent.js';

// Test the syntax checker directly
const dslWithError = `workspace "EcommercePlatform" {

    model {
        user = person "Customer" "A user of the e-commerce platform."

        ecommercePlatform = softwareSystem "EcommercePlatform" "A scalable e-commerce platform."

        webApp = container ecommercePlatform "Web App" "Azure App Service" "Description"
        database = container ecommercePlatform "Database" "Azure SQL Database" "Description"

        user -> webApp "Uses"
    }

    views {
        systemContext ecommercePlatform "System Context" {
            include *
        }
    }
}`;

console.log('🔍 Testing syntax validation...\n');

// Create a temporary instance to access the private method
class TestValidator extends StructurizrDSLValidatorAgent {
  public testSyntax(dsl: string) {
    return (this as any).checkBasicSyntax(dsl);
  }
}

const validator = new TestValidator(null as any);
const errors = validator.testSyntax(dslWithError);

console.log('📄 Test DSL:');
console.log(dslWithError);
console.log('\n🚨 Detected Errors:');
if (errors.length > 0) {
  errors.forEach((error, index) => {
    console.log(`${index + 1}. ${error}`);
  });
} else {
  console.log('✅ No syntax errors detected');
}

console.log('\n🏗️ Expected Error: Invalid container syntax');
console.log('The DSL should fail because containers reference the parent system incorrectly.');