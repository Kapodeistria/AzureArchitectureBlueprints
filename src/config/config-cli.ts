#!/usr/bin/env tsx
/**
 * Configuration CLI Utility
 * Manage configuration settings easily
 */

import { writeFileSync } from 'fs';
import config from './config.js';

interface ConfigCommand {
  action: 'get' | 'set' | 'list' | 'generate' | 'validate' | 'reset';
  key?: string;
  value?: string;
}

function parseArgs(): ConfigCommand {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    return { action: 'list' };
  }

  const action = args[0] as ConfigCommand['action'];
  
  switch (action) {
    case 'get':
      return { action, key: args[1] };
    case 'set':
      return { action, key: args[1], value: args[2] };
    default:
      return { action };
  }
}

function displayValue(key: string, value: any, indent = 0): void {
  const prefix = '  '.repeat(indent);
  
  if (typeof value === 'object' && value !== null) {
    console.log(`${prefix}${key}:`);
    for (const [subKey, subValue] of Object.entries(value)) {
      displayValue(subKey, subValue, indent + 1);
    }
  } else {
    const displayVal = key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') 
      ? '***HIDDEN***' 
      : value;
    console.log(`${prefix}${key}: ${displayVal}`);
  }
}

function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

async function main() {
  const cmd = parseArgs();
  
  console.log('🔧 Microsoft Interview Assistant - Configuration Manager\n');

  try {
    switch (cmd.action) {
      case 'list':
        console.log('📋 Current Configuration:');
        console.log('=' .repeat(50));
        const cfg = config.get();
        for (const [section, values] of Object.entries(cfg)) {
          displayValue(section, values);
          console.log();
        }
        break;

      case 'get':
        if (!cmd.key) {
          console.error('❌ Key is required for get command');
          process.exit(1);
        }
        
        const value = getNestedValue(config.get(), cmd.key);
        if (value === undefined) {
          console.error(`❌ Configuration key '${cmd.key}' not found`);
          process.exit(1);
        }
        
        console.log(`📄 ${cmd.key}:`);
        displayValue('', value);
        break;

      case 'set':
        if (!cmd.key || cmd.value === undefined) {
          console.error('❌ Key and value are required for set command');
          process.exit(1);
        }
        
        config.set(cmd.key, cmd.value);
        console.log(`✅ Set ${cmd.key} = ${cmd.value}`);
        break;

      case 'generate':
        console.log('📝 Generating .env.local template...');
        const template = config.generateEnvTemplate();
        writeFileSync('.env.local', template);
        console.log('✅ Created .env.local file');
        console.log('\n💡 Edit .env.local to customize your settings');
        break;

      case 'validate':
        console.log('✅ Configuration is valid!');
        console.log('\n📊 Summary:');
        console.log(`Environment: ${config.get().app.environment}`);
        console.log(`Azure Endpoint: ${config.get().azure.foundry.projectEndpoint}`);
        console.log(`Model: ${config.get().azure.foundry.modelDeploymentName}`);
        console.log(`Output Directory: ${config.get().app.outputDirectory}`);
        break;

      case 'reset':
        console.log('🔄 Resetting configuration...');
        config.reload();
        console.log('✅ Configuration reloaded from files');
        break;

      default:
        console.log('❌ Unknown command');
        console.log('\nUsage:');
        console.log('  tsx config-cli.ts list                    # Show all configuration');
        console.log('  tsx config-cli.ts get <key>               # Get specific value');
        console.log('  tsx config-cli.ts set <key> <value>       # Set configuration value');
        console.log('  tsx config-cli.ts generate                # Generate .env.local template');
        console.log('  tsx config-cli.ts validate                # Validate current config');
        console.log('  tsx config-cli.ts reset                   # Reload configuration');
        console.log('\nExamples:');
        console.log('  tsx config-cli.ts get azure.foundry.modelDeploymentName');
        console.log('  tsx config-cli.ts set app.logLevel debug');
        process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}