#!/usr/bin/env tsx
/**
 * Azure OpenAI + Foundry Integration
 * Uses your existing Azure OpenAI deployment
 */

import { AzureOpenAI } from '@azure/openai';
import { DefaultAzureCredential } from '@azure/identity';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface FoundryAIConfig {
  endpoint: string;
  deploymentName: string;
  apiKey?: string;
  apiVersion: string;
}

class FoundryAIIntegration {
  private client: AzureOpenAI;
  private deploymentName: string;

  constructor(config: FoundryAIConfig) {
    this.deploymentName = config.deploymentName;
    
    // Initialize Azure OpenAI client
    this.client = new AzureOpenAI({
      endpoint: config.endpoint,
      apiKey: config.apiKey,
      apiVersion: config.apiVersion,
      deployment: config.deploymentName
    });
  }

  async analyzeContract(contractCode: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.deploymentName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert Solidity smart contract auditor. Analyze the provided contract for security vulnerabilities, gas optimizations, and best practices.'
          },
          {
            role: 'user',
            content: `Please analyze this Solidity contract:\n\n${contractCode}`
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      });

      return response.choices[0]?.message?.content || 'No analysis available';
    } catch (error) {
      console.error('❌ Error analyzing contract:', error);
      throw error;
    }
  }

  async generateTests(contractCode: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create({
        model: this.deploymentName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert in writing comprehensive Foundry tests for Solidity contracts. Generate thorough test cases using Foundry\'s testing framework.'
          },
          {
            role: 'user',
            content: `Generate Foundry test cases for this contract:\n\n${contractCode}`
          }
        ],
        max_tokens: 1500,
        temperature: 0.2
      });

      return response.choices[0]?.message?.content || 'No tests generated';
    } catch (error) {
      console.error('❌ Error generating tests:', error);
      throw error;
    }
  }

  async checkAnvilStatus(): Promise<boolean> {
    try {
      const { stdout } = await execAsync('curl -s -X POST -H "Content-Type: application/json" --data \'{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}\' http://127.0.0.1:8545');
      return stdout.includes('result');
    } catch {
      return false;
    }
  }
}

async function main() {
  console.log('🚀 Azure OpenAI + Foundry Integration');

  // Configuration using your endpoint
  const config: FoundryAIConfig = {
    endpoint: 'https://kapodeistria-1337-resource.cognitiveservices.azure.com',
    deploymentName: 'gpt-4.1', // Your deployment name
    apiVersion: '2025-01-01-preview',
    // Add your API key here or use environment variable
    apiKey: process.env.AZURE_OPENAI_API_KEY
  };

  const foundryAI = new FoundryAIIntegration(config);

  // Check if Anvil is running
  const isAnvilRunning = await foundryAI.checkAnvilStatus();
  console.log(`🔗 Anvil Status: ${isAnvilRunning ? '✅ Running' : '❌ Not Running'}`);

  // Example contract for analysis
  const exampleContract = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleStorage {
    uint256 private storedData;
    
    function set(uint256 x) public {
        storedData = x;
    }
    
    function get() public view returns (uint256) {
        return storedData;
    }
}`;

  try {
    console.log('\n🔍 Analyzing contract...');
    const analysis = await foundryAI.analyzeContract(exampleContract);
    console.log('📋 Analysis Result:\n', analysis);

    console.log('\n🧪 Generating tests...');
    const tests = await foundryAI.generateTests(exampleContract);
    console.log('🧪 Generated Tests:\n', tests);

  } catch (error) {
    console.error('❌ Error:', error);
    console.log('\n💡 Make sure to set AZURE_OPENAI_API_KEY environment variable');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { FoundryAIIntegration };