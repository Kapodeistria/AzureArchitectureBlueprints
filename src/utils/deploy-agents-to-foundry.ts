#!/usr/bin/env tsx
/**
 * Deploy Agents to Azure AI Foundry
 * Creates flows/agents in Azure AI Foundry for better analytics, RAG, and debugging
 * 
 * AUTHENTICATION (in order of preference):
 * 1. FOUNDRY_API_KEY: Azure AI Foundry project API key (recommended)
 * 2. FOUNDRY_API_KEY in .env.local file
 * 3. Azure CLI (az login): Fallback authentication if API key not available
 * 
 * AGENT REGISTRY BEHAVIOR:
 * - Persists deployed agent IDs to avoid redeployment
 * - Checks environment variables first (FOUNDRY_AGENT_{AGENT_NAME}_ID)
 * - Falls back to registry file at foundry-agents/agent-ids.env
 * - Skips deployment when ID exists unless FORCE_REDEPLOY=true
 * - Updates registry after successful deployments
 * 
 * ENVIRONMENT VARIABLES:
 * - FOUNDRY_API_KEY: Azure AI Foundry project API key (preferred authentication method)
 * - FOUNDRY_AGENT_REGISTRY_PATH: Custom path for agent registry file (default: foundry-agents/agent-ids.env)
 * - FORCE_REDEPLOY: Set to 'true' to force redeployment of all agents
 * - FOUNDRY_AGENT_{AGENT_NAME}_ID: Individual agent IDs (e.g., FOUNDRY_AGENT_AZURE_SERVICES_RESEARCH_ID)
 * 
 * USAGE:
 * export FOUNDRY_API_KEY="your-foundry-api-key"
 * npm run deploy:agents
 * 
 * Or add to .env.local:
 * FOUNDRY_API_KEY=your-foundry-api-key
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import config from '../config/config.js';
import chalk from 'chalk';
import { existsSync } from 'fs';
import { AzureFoundryClient } from './azure-foundry-client.js';

interface FoundryAgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  ragSources?: string[];
  dependencies?: string[];
}

interface AgentRegistry {
  [agentName: string]: string; // agentName -> agentId
}

class FoundryAgentDeployment {
  private foundryEndpoint: string;
  private apiKey: string;
  private foundryApiKey?: string;
  private agentRegistry: AgentRegistry;
  private registryPath: string;
  private foundryClient: AzureFoundryClient;

  constructor() {
    const configData = config.get();
    this.foundryEndpoint = configData.azure.foundry.projectEndpoint;
    this.apiKey = configData.azure.openai.apiKey!;
    this.foundryApiKey = configData.azure.foundry.apiKey;
    this.registryPath = process.env.FOUNDRY_AGENT_REGISTRY_PATH || 'foundry-agents/agent-ids.env';
    this.agentRegistry = this.loadAgentRegistry();
    this.foundryClient = new AzureFoundryClient();
  }

  /**
   * Generate environment variable key for agent ID
   */
  private getAgentEnvKey(agentName: string): string {
    return `FOUNDRY_AGENT_${agentName.toUpperCase().replace(/-/g, '_')}_ID`;
  }

  /**
   * Load agent registry from environment variables and registry file
   */
  private loadAgentRegistry(): AgentRegistry {
    const registry: AgentRegistry = {};
    
    // First, load from registry file if it exists
    if (existsSync(this.registryPath)) {
      try {
        const fileContent = require('fs').readFileSync(this.registryPath, 'utf8');
        const lines = fileContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        
        for (const line of lines) {
          const [key, value] = line.split('=', 2);
          if (key && value && key.startsWith('FOUNDRY_AGENT_') && key.endsWith('_ID')) {
            const agentName = key
              .replace('FOUNDRY_AGENT_', '')
              .replace('_ID', '')
              .toLowerCase()
              .replace(/_/g, '-');
            registry[agentName] = value.trim().replace(/["']/g, '');
          }
        }
      } catch (error) {
        console.warn(chalk.yellow(`⚠️ Could not read registry file ${this.registryPath}: ${error.message}`));
      }
    }
    
    // Override with environment variables (higher priority)
    for (const [envKey, envValue] of Object.entries(process.env)) {
      if (envKey.startsWith('FOUNDRY_AGENT_') && envKey.endsWith('_ID') && envValue) {
        const agentName = envKey
          .replace('FOUNDRY_AGENT_', '')
          .replace('_ID', '')
          .toLowerCase()
          .replace(/_/g, '-');
        registry[agentName] = envValue;
      }
    }
    
    return registry;
  }

  /**
   * Save agent registry to file
   */
  private async saveAgentRegistry(): Promise<void> {
    try {
      await fs.mkdir(join(this.registryPath, '..'), { recursive: true });
      
      const lines = [
        '# Azure AI Foundry Agent Registry',
        '# This file contains deployed agent IDs to avoid redeployment',
        '# Set FORCE_REDEPLOY=true to force redeployment of all agents',
        ''
      ];
      
      for (const [agentName, agentId] of Object.entries(this.agentRegistry)) {
        const envKey = this.getAgentEnvKey(agentName);
        lines.push(`${envKey}=${agentId}`);
      }
      
      await fs.writeFile(this.registryPath, lines.join('\n') + '\n');
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not save registry file ${this.registryPath}: ${error.message}`));
    }
  }

  /**
   * Delete all deployed agents and clear registry
   */
  async deleteAllAgents(): Promise<void> {
    console.log(chalk.red.bold('🗑️ Deleting all deployed agents...\n'));
    
    const agents = this.defineAgents();
    let deletedCount = 0;
    const deletedAgents: string[] = [];
    
    for (const agent of agents) {
      const agentId = this.agentRegistry[agent.name];
      
      if (agentId) {
        console.log(chalk.yellow(`🗑️ Deleting ${agent.name} (ID: ${agentId})...`));
        
        try {
          // In a real implementation, this would make API calls to delete the agent
          // For now, we simulate the deletion
          await this.deleteAgent(agent.name, agentId);
          
          // Remove from registry
          delete this.agentRegistry[agent.name];
          deletedCount++;
          deletedAgents.push(agent.name);
          
          console.log(chalk.green(`✅ ${agent.name} deleted successfully`));
        } catch (error) {
          console.error(chalk.red(`❌ Failed to delete ${agent.name}:`), error);
        }
      } else {
        console.log(chalk.gray(`⏭️ Skipping ${agent.name} - not found in registry`));
      }
    }
    
    // Clear registry file
    await this.saveAgentRegistry();
    
    // Also clear any generated files
    try {
      const foundryDir = 'foundry-agents';
      if (existsSync(foundryDir)) {
        const files = await fs.readdir(foundryDir);
        for (const file of files) {
          if (file.endsWith('.json') || file.endsWith('.sh') || file.endsWith('.yaml')) {
            await fs.unlink(join(foundryDir, file));
          }
        }
        console.log(chalk.green('🧹 Cleaned up generated configuration files'));
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not clean up files: ${error.message}`));
    }
    
    console.log(chalk.green.bold(`\n✅ Agent deletion complete!`));
    console.log(chalk.blue(`📊 Summary: ${deletedCount} agents deleted`));
    
    if (deletedAgents.length > 0) {
      console.log(chalk.red(`\n🗑️ Deleted agents: ${deletedAgents.join(', ')}`));
    }
    
    console.log(chalk.blue('\n💡 Registry cleared. Next deployment will create fresh agents.'));
  }

  /**
   * Delete a specific agent
   */
  private async deleteAgent(agentName: string, agentId: string): Promise<void> {
    try {
      await this.foundryClient.deleteAgent(agentId);
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Failed to delete ${agentName} from Azure AI Foundry: ${error.message}`));
    }
  }

  async deployAllAgents(forceRedeploy: boolean = false) {
    console.log(chalk.blue.bold('🚀 Deploying Agents to Azure AI Foundry\n'));

    // Display authentication guidance
    console.log(chalk.blue('🔐 Authentication Options (in order of preference):'));
    if (this.foundryApiKey) {
      console.log(chalk.green('   ✅ FOUNDRY_API_KEY: Using API key authentication'));
    } else {
      console.log(chalk.yellow('   ⚠️  FOUNDRY_API_KEY: Not set - will fall back to Azure CLI'));
      console.log(chalk.cyan('   💡 For better security and reliability, set FOUNDRY_API_KEY:'));
      console.log(chalk.cyan('      • export FOUNDRY_API_KEY="your-api-key"'));
      console.log(chalk.cyan('      • Add FOUNDRY_API_KEY=your-api-key to .env.local file'));
      console.log(chalk.cyan('   🔄 Azure CLI: Will be used as fallback (requires az login)'));
    }
    console.log('');

    // Test Azure AI Foundry connection
    const connectionTest = await this.foundryClient.testConnection();
    if (!connectionTest) {
      console.error(chalk.red('❌ Azure AI Foundry connection failed. Check your configuration.'));
      throw new Error('Azure AI Foundry connection failed');
    }

    const agents = this.defineAgents();
    const shouldForceRedeploy = forceRedeploy || process.env.FORCE_REDEPLOY === 'true';
    
    let skippedCount = 0;
    let deployedCount = 0;
    const skippedAgents: string[] = [];
    const deployedAgents: string[] = [];
    
    for (const agent of agents) {
      const envKey = this.getAgentEnvKey(agent.name);
      const existingId = this.agentRegistry[agent.name];
      
      if (existingId && !shouldForceRedeploy) {
        console.log(chalk.cyan(`⏭️  Skipping ${agent.name} - using existing deployment (ID: ${existingId})`));
        skippedCount++;
        skippedAgents.push(agent.name);
      } else {
        if (existingId && shouldForceRedeploy) {
          console.log(chalk.yellow(`🔄 Force redeploying ${agent.name} (existing ID: ${existingId})`));
        }
        
        const agentId = await this.deployAgent(agent);
        if (agentId) {
          this.agentRegistry[agent.name] = agentId;
          deployedCount++;
          deployedAgents.push(agent.name);
        }
      }
    }
    
    // Save updated registry
    if (deployedCount > 0) {
      await this.saveAgentRegistry();
    }

    await this.createWorkflowOrchestration();
    
    // Summary output
    console.log(chalk.green.bold('\n✅ Agent deployment complete!'));
    console.log(chalk.blue(`📊 Summary: ${deployedCount} deployed, ${skippedCount} skipped`));
    
    if (deployedAgents.length > 0) {
      console.log(chalk.green(`\n🆕 Deployed agents: ${deployedAgents.join(', ')}`));
    }
    
    if (skippedAgents.length > 0) {
      console.log(chalk.cyan(`\n⏭️  Skipped agents: ${skippedAgents.join(', ')}`));
    }
    
    console.log(chalk.blue('\n📋 Registry Management:'));
    console.log(`   • Registry file: ${this.registryPath}`);
    console.log(`   • Force redeploy: ${shouldForceRedeploy ? 'enabled' : 'disabled'}`);
    console.log(`   • Set FORCE_REDEPLOY=true to redeploy all agents`);
    
    console.log(chalk.blue('\n🔧 Environment Variables:'));
    for (const agent of agents) {
      const envKey = this.getAgentEnvKey(agent.name);
      const agentId = this.agentRegistry[agent.name];
      if (agentId) {
        console.log(`   export ${envKey}=${agentId}`);
      }
    }
    
    console.log(chalk.blue('\n📊 Check analytics at: https://ai.azure.com/'));
  }

  private defineAgents(): FoundryAgentDefinition[] {
    return [
      // WAF Assessment Agents with dedicated RAG sources
      {
        name: 'waf-security-agent',
        description: 'Microsoft Well-Architected Framework Security pillar assessment agent',
        systemPrompt: `You are a Well-Architected Security Agent specializing in the Azure Well-Architected Framework Security pillar. Use the RAG knowledge base to reference official Microsoft WAF Security checklist items (SE:01 - SE:12) during assessments.`,
        temperature: 0.1,
        maxTokens: 2000,
        ragSources: [
          'waf-security-pillar',
          'waf-master-framework',
          'azure-security-documentation'
        ]
      },
      {
        name: 'waf-reliability-agent',
        description: 'Microsoft Well-Architected Framework Reliability pillar assessment agent',
        systemPrompt: `You are a Well-Architected Reliability Agent specializing in the Azure Well-Architected Framework Reliability pillar. Use the RAG knowledge base to reference official Microsoft WAF Reliability checklist items (RE:01 - RE:10) during assessments.`,
        temperature: 0.1,
        maxTokens: 2000,
        ragSources: [
          'waf-reliability-pillar',
          'waf-master-framework',
          'azure-architecture-patterns'
        ]
      },
      {
        name: 'waf-performance-agent',
        description: 'Microsoft Well-Architected Framework Performance Efficiency pillar assessment agent',
        systemPrompt: `You are a Well-Architected Performance Agent specializing in the Azure Well-Architected Framework Performance Efficiency pillar. Use the RAG knowledge base to reference official Microsoft WAF Performance checklist items (PE:01 - PE:12) during assessments.`,
        temperature: 0.1,
        maxTokens: 2000,
        ragSources: [
          'waf-performance-pillar',
          'waf-master-framework',
          'azure-architecture-patterns'
        ]
      },
      {
        name: 'waf-operational-agent',
        description: 'Microsoft Well-Architected Framework Operational Excellence pillar assessment agent',
        systemPrompt: `You are a Well-Architected Operational Excellence Agent specializing in the Azure Well-Architected Framework Operational Excellence pillar. Use the RAG knowledge base to reference official Microsoft WAF Operational checklist items (OE:01 - OE:12) during assessments.`,
        temperature: 0.1,
        maxTokens: 2000,
        ragSources: [
          'waf-operational-pillar',
          'waf-master-framework',
          'azure-architecture-patterns'
        ]
      },
      {
        name: 'waf-cost-agent',
        description: 'Microsoft Well-Architected Framework Cost Optimization pillar assessment agent',
        systemPrompt: `You are a Well-Architected Cost Optimization Agent specializing in the Azure Well-Architected Framework Cost Optimization pillar. Use the RAG knowledge base to reference official Microsoft WAF Cost checklist items (CO:01 - CO:14) during assessments.`,
        temperature: 0.1,
        maxTokens: 2000,
        ragSources: [
          'waf-cost-pillar',
          'waf-master-framework',
          'azure-pricing-database'
        ]
      },
      // Research and Analysis Agents
      {
        name: 'azure-services-research',
        description: 'Researches latest Azure services, pricing, and capabilities',
        systemPrompt: `You are an Azure services research specialist with access to the latest Azure documentation and pricing information. Research and provide comprehensive information about Azure services relevant to the given requirements.`,
        temperature: 0.2,
        maxTokens: 2000,
        ragSources: [
          'azure-services-documentation',
          'azure-pricing-calculator',
          'azure-architecture-center'
        ]
      },
      {
        name: 'industry-patterns-research',
        description: 'Researches architectural patterns and industry best practices',
        systemPrompt: `You are an enterprise architecture patterns researcher with deep knowledge of industry best practices, reference architectures, and proven design patterns.`,
        temperature: 0.3,
        maxTokens: 2000,
        ragSources: [
          'architecture-patterns-library',
          'industry-reference-architectures',
          'enterprise-best-practices'
        ]
      },
      {
        name: 'security-compliance-research',
        description: 'Analyzes security and compliance requirements',
        systemPrompt: `You are a cybersecurity and compliance expert specializing in Azure security services and regulatory frameworks.`,
        temperature: 0.1,
        maxTokens: 1800,
        ragSources: [
          'compliance-frameworks-database',
          'azure-security-documentation',
          'regulatory-requirements'
        ]
      },
      {
        name: 'requirements-analyst',
        description: 'Extracts and categorizes requirements from case studies',
        systemPrompt: `You are a Requirements Analyst Agent specialized in extracting and categorizing requirements from case studies. Be thorough and specific in identifying both explicit and implicit requirements.`,
        temperature: 0.1,
        maxTokens: 1500,
        dependencies: []
      },
      {
        name: 'architecture-designer',
        description: 'Designs comprehensive Azure architecture solutions',
        systemPrompt: `You are a Senior Azure Solution Architect with deep expertise in enterprise cloud architecture. Design comprehensive, production-ready Azure solutions.`,
        temperature: 0.4,
        maxTokens: 3000,
        dependencies: ['requirements-analyst', 'azure-services-research', 'industry-patterns-research'],
        ragSources: [
          'azure-architecture-patterns',
          'solution-templates',
          'reference-implementations'
        ]
      },
      {
        name: 'solution-architect-reviewer',
        description: 'Reviews and provides feedback on architecture proposals',
        systemPrompt: `You are a highly experienced Senior Solution Architect conducting thorough technical reviews. Provide detailed, constructive feedback with scoring.`,
        temperature: 0.2,
        maxTokens: 2000,
        dependencies: ['architecture-designer']
      },
      {
        name: 'cost-optimizer',
        description: 'Optimizes Azure costs while maintaining requirements',
        systemPrompt: `You are an Azure Cost Optimization specialist focused on enterprise TCO analysis and cost-effective architecture recommendations. Reference WAF Cost Optimization principles when available.`,
        temperature: 0.3,
        maxTokens: 2000,
        dependencies: ['architecture-designer'],
        ragSources: [
          'waf-cost-pillar',
          'azure-pricing-database',
          'cost-optimization-patterns',
          'reserved-instances-calculator'
        ]
      },
      {
        name: 'risk-assessor',
        description: 'Assesses risks and provides mitigation strategies',
        systemPrompt: `You are a Risk Assessment specialist for enterprise Azure solutions with focus on business continuity and security risk analysis.`,
        temperature: 0.2,
        maxTokens: 1800,
        dependencies: ['architecture-designer', 'security-compliance-research']
      }
    ];
  }

  private async deployAgent(agent: FoundryAgentDefinition, existingId?: string): Promise<string | null> {
    try {
      // First save local configuration for reference
      const agentConfig = {
        name: agent.name,
        description: agent.description,
        model: {
          deployment_name: config.get().azure.foundry.modelDeploymentName,
          temperature: agent.temperature,
          max_tokens: agent.maxTokens
        },
        system_message: agent.systemPrompt,
        rag_sources: agent.ragSources || [],
        dependencies: agent.dependencies || [],
        monitoring: {
          enable_analytics: true,
          track_token_usage: true,
          track_latency: true,
          track_errors: true
        }
      };

      // Save agent configuration for reference
      const configPath = join('foundry-agents', `${agent.name}.json`);
      await fs.mkdir('foundry-agents', { recursive: true });
      await fs.writeFile(configPath, JSON.stringify(agentConfig, null, 2));
      console.log(chalk.green(`✅ ${agent.name} configuration saved`));

      // Deploy to Azure AI Foundry
      const deploymentResponse = await this.foundryClient.deployAgent({
        name: agent.name,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        ragSources: agent.ragSources,
        dependencies: agent.dependencies
      });
      
      return deploymentResponse.id;
      
    } catch (error) {
      console.error(chalk.red(`❌ Failed to deploy ${agent.name}:`), error.message);
      return null;
    }
  }

  private async generateDeploymentScript(agent: FoundryAgentDefinition) {
    const authSection = `# Load environment variables from .env.local if it exists
if [ -f ".env.local" ]; then
    echo "📄 Loading environment from .env.local..."
    set -a
    source .env.local
    set +a
fi

# Function to setup authentication headers
setup_auth() {
    # Try API key first (from environment or .env.local)
    if [ -n "$FOUNDRY_API_KEY" ]; then
        echo "🔑 Using API key authentication"
        AUTH_HEADER="api-key: $FOUNDRY_API_KEY"
        return 0
    fi
    
    # Fallback to Azure CLI authentication
    echo "🔐 API key not found, falling back to Azure CLI authentication..."
    
    # Check if Azure CLI is installed
    if ! command -v az &> /dev/null; then
        echo "❌ Azure CLI not found and no API key provided"
        echo "💡 Please either:"
        echo "   1. Set FOUNDRY_API_KEY environment variable"
        echo "   2. Add FOUNDRY_API_KEY to .env.local file"
        echo "   3. Install Azure CLI: brew install azure-cli"
        exit 1
    fi
    
    # Check if user is logged in
    if ! az account show &> /dev/null; then
        echo "⚠️  Not logged into Azure. Logging in..."
        az login
    fi
    
    # Get access token for Azure AI Foundry (try multiple resource scopes)
    echo "🔐 Getting access token..."
    
    # Try different resource scopes
    AZURE_AI_AUTH_TOKEN=$(az account get-access-token --resource https://ai.azure.com --query accessToken --output tsv 2>/dev/null)
    
    if [ -z "$AZURE_AI_AUTH_TOKEN" ]; then
        echo "Trying alternative resource scope..."
        AZURE_AI_AUTH_TOKEN=$(az account get-access-token --resource https://cognitiveservices.azure.com --query accessToken --output tsv 2>/dev/null)
    fi
    
    if [ -z "$AZURE_AI_AUTH_TOKEN" ]; then
        echo "Trying management API scope..."
        AZURE_AI_AUTH_TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken --output tsv 2>/dev/null)
    fi
    
    if [ -z "$AZURE_AI_AUTH_TOKEN" ]; then
        echo "❌ Failed to get access token"
        echo "💡 Please check your Azure CLI login or use FOUNDRY_API_KEY instead"
        exit 1
    fi
    
    AUTH_HEADER="authorization: Bearer $AZURE_AI_AUTH_TOKEN"
    echo "✅ Access token obtained"
    return 0
}

# Setup authentication
setup_auth`;

    const deployScript = `#!/bin/bash
# Deploy ${agent.name} to Azure AI Foundry
# 
# Authentication options:
# 1. FOUNDRY_API_KEY environment variable (preferred)
# 2. Azure CLI (az login) - fallback

${authSection}

# Create the agent flow
az ml online-endpoint create \\
  --name "${agent.name}-endpoint" \\
  --auth-mode key \\
  --workspace-name "interview-assistant"

# Deploy the model
az ml online-deployment create \\
  --endpoint-name "${agent.name}-endpoint" \\
  --name "${agent.name}-v1" \\
  --model "azureml://registries/azureml/models/gpt-4.1/versions/1" \\
  --instance-count 1 \\
  --instance-type Standard_DS3_v2

# Create flow with RAG integration
cat > ${agent.name}-flow.yaml << EOF
display_name: "${agent.name}"
type: standard
inputs:
  case_study:
    type: string
  requirements:
    type: string
outputs:
  analysis:
    type: string
nodes:
  - name: rag_lookup
    type: python
    source:
      type: code
      path: rag_lookup.py
    inputs:
      query: \\\${inputs.case_study}
      sources: "${agent.ragSources?.join(',') || ''}"
  - name: llm_analysis
    type: llm
    source:
      type: code
      path: llm_prompt.jinja2
    inputs:
      deployment_name: gpt-4.1
      temperature: ${agent.temperature}
      max_tokens: ${agent.maxTokens}
      system_message: |
        ${agent.systemPrompt}
      user_message: |
        Case Study: \\\${inputs.case_study}
        Requirements: \\\${inputs.requirements}
        RAG Context: \\\${rag_lookup.output}
EOF

# Deploy the flow
az ml flow create --file ${agent.name}-flow.yaml
`;

    const scriptPath = join('foundry-agents', `deploy-${agent.name}.sh`);
    await fs.writeFile(scriptPath, deployScript);
    await fs.chmod(scriptPath, '755');
  }

  private async createWorkflowOrchestration() {
    console.log(chalk.yellow('🎼 Creating workflow orchestration...'));

    const orchestrationFlow = {
      display_name: 'interview-assistant-workflow',
      type: 'standard',
      inputs: {
        case_study: { type: 'string' }
      },
      outputs: {
        final_analysis: { type: 'string' },
        performance_metrics: { type: 'object' }
      },
      nodes: [
        {
          name: 'research_phase',
          type: 'parallel',
          branches: [
            { agent: 'azure-services-research' },
            { agent: 'industry-patterns-research' },
            { agent: 'security-compliance-research' },
            { agent: 'requirements-analyst' }
          ]
        },
        {
          name: 'design_phase',
          type: 'sequential',
          depends_on: ['research_phase'],
          steps: [
            { agent: 'architecture-designer' },
            { agent: 'solution-architect-reviewer' }
          ]
        },
        {
          name: 'optimization_phase',
          type: 'parallel',
          depends_on: ['design_phase'],
          branches: [
            { agent: 'cost-optimizer' },
            { agent: 'risk-assessor' }
          ]
        }
      ],
      monitoring: {
        enable_tracing: true,
        track_agent_performance: true,
        export_to_application_insights: true
      }
    };

    await fs.writeFile('foundry-agents/workflow-orchestration.json', JSON.stringify(orchestrationFlow, null, 2));
    
    console.log(chalk.green('✅ Workflow orchestration configuration created'));
  }

  async setupRAGSources() {
    console.log(chalk.yellow('📚 Setting up RAG knowledge sources...'));

    const ragSources = [
      // WAF Knowledge Sources
      {
        name: 'waf-security-pillar',
        description: 'Microsoft Well-Architected Framework Security pillar with 12 official checklist items (SE:01 - SE:12)',
        type: 'waf_knowledge',
        sources: [
          'foundry-agents/rag-sources/waf-security-pillar-content.md',
          'foundry-agents/rag-sources/waf-security-pillar.json'
        ],
        update_frequency: 'monthly'
      },
      {
        name: 'waf-reliability-pillar',
        description: 'Microsoft Well-Architected Framework Reliability pillar with 10 official checklist items (RE:01 - RE:10)',
        type: 'waf_knowledge',
        sources: [
          'foundry-agents/rag-sources/waf-reliability-pillar-content.md',
          'foundry-agents/rag-sources/waf-reliability-pillar.json'
        ],
        update_frequency: 'monthly'
      },
      {
        name: 'waf-performance-pillar',
        description: 'Microsoft Well-Architected Framework Performance Efficiency pillar with 12 official checklist items (PE:01 - PE:12)',
        type: 'waf_knowledge',
        sources: [
          'foundry-agents/rag-sources/waf-performance-pillar-content.md',
          'foundry-agents/rag-sources/waf-performance-pillar.json'
        ],
        update_frequency: 'monthly'
      },
      {
        name: 'waf-operational-pillar',
        description: 'Microsoft Well-Architected Framework Operational Excellence pillar with 12 official checklist items (OE:01 - OE:12)',
        type: 'waf_knowledge',
        sources: [
          'foundry-agents/rag-sources/waf-operational-pillar-content.md',
          'foundry-agents/rag-sources/waf-operational-pillar.json'
        ],
        update_frequency: 'monthly'
      },
      {
        name: 'waf-cost-pillar',
        description: 'Microsoft Well-Architected Framework Cost Optimization pillar with 14 official checklist items (CO:01 - CO:14)',
        type: 'waf_knowledge',
        sources: [
          'foundry-agents/rag-sources/waf-cost-pillar-content.md',
          'foundry-agents/rag-sources/waf-cost-pillar.json'
        ],
        update_frequency: 'monthly'
      },
      {
        name: 'waf-master-framework',
        description: 'Complete Microsoft Well-Architected Framework knowledge base with all 5 pillars (60 total checklist items)',
        type: 'waf_master',
        sources: [
          'foundry-agents/rag-sources/waf-master-framework-content.md',
          'foundry-agents/rag-sources/waf-master-framework.json'
        ],
        update_frequency: 'monthly'
      },
      // Azure Documentation Sources
      {
        name: 'azure-services-documentation',
        description: 'Latest Azure services documentation and capabilities',
        type: 'web_crawl',
        sources: [
          'https://docs.microsoft.com/en-us/azure/',
          'https://azure.microsoft.com/en-us/products/',
          'https://azure.microsoft.com/en-us/pricing/'
        ],
        update_frequency: 'daily'
      },
      {
        name: 'architecture-patterns-library',
        description: 'Azure Architecture Center patterns and best practices',
        type: 'web_crawl',
        sources: [
          'https://docs.microsoft.com/en-us/azure/architecture/',
          'https://github.com/mspnp/architecture-center'
        ],
        update_frequency: 'weekly'
      },
      {
        name: 'compliance-frameworks-database',
        description: 'Regulatory compliance requirements and Azure compliance mappings',
        type: 'structured_data',
        sources: [
          'compliance-frameworks.json',
          'azure-compliance-mappings.json'
        ],
        update_frequency: 'monthly'
      }
    ];

    for (const source of ragSources) {
      const sourcePath = join('foundry-agents', 'rag-sources', `${source.name}.json`);
      await fs.mkdir(join('foundry-agents', 'rag-sources'), { recursive: true });
      await fs.writeFile(sourcePath, JSON.stringify(source, null, 2));
    }

    console.log(chalk.green('✅ RAG sources configuration created'));
  }

  async generateAnalyticsDashboard() {
    console.log(chalk.yellow('📊 Generating analytics dashboard configuration...'));

    const dashboardConfig = {
      name: 'Interview Assistant Analytics',
      metrics: [
        {
          name: 'Agent Performance',
          type: 'time_series',
          queries: [
            'avg(response_time) by agent_name',
            'sum(token_usage) by agent_name',
            'rate(error_count) by agent_name'
          ]
        },
        {
          name: 'Cost Analysis',
          type: 'gauge',
          queries: [
            'sum(token_cost) by date',
            'avg(cost_per_analysis)'
          ]
        },
        {
          name: 'Quality Metrics',
          type: 'bar_chart',
          queries: [
            'avg(reviewer_score) by architecture_type',
            'count(refinement_iterations) by case_study'
          ]
        }
      ],
      alerts: [
        {
          name: 'High Error Rate',
          condition: 'error_rate > 0.05',
          action: 'notify_team'
        },
        {
          name: 'Cost Threshold',
          condition: 'daily_cost > 100',
          action: 'send_email'
        }
      ]
    };

    await fs.writeFile('foundry-agents/analytics-dashboard.json', JSON.stringify(dashboardConfig, null, 2));
    
    console.log(chalk.green('✅ Analytics dashboard configuration created'));
  }
}

// Main deployment function
async function main() {
  try {
    const deployment = new FoundryAgentDeployment();
    
    // Check command line arguments
    const args = process.argv.slice(2);
    const command = args[0];
    
    if (command === 'delete') {
      await deployment.deleteAllAgents();
      return;
    }
    
    if (command === 'redeploy') {
      console.log(chalk.blue.bold('🔄 Starting fresh deployment (delete + deploy)\n'));
      await deployment.deleteAllAgents();
      console.log('\n');
      await deployment.deployAllAgents(true);
    } else {
      await deployment.deployAllAgents();
    }
    
    await deployment.setupRAGSources();
    await deployment.generateAnalyticsDashboard();
    
    console.log(chalk.blue.bold('\n📋 Next Steps:'));
    console.log('1. Review generated configurations in ./foundry-agents/');
    console.log('2. Run deployment scripts to create Azure AI Foundry flows');
    console.log('3. Set up RAG knowledge sources with latest Azure documentation');
    console.log('4. Configure monitoring and analytics dashboard');
    console.log('5. Test end-to-end workflow in Azure AI Foundry');
    
    console.log(chalk.green.bold('\n🎉 Azure AI Foundry deployment preparation complete!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Deployment failed:'), error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { FoundryAgentDeployment };

// Export helper function to get agent registry for other modules
export function getAgentRegistry(): AgentRegistry {
  const deployment = new FoundryAgentDeployment();
  return (deployment as any).agentRegistry; // Access private property
}

// Export helper function to check if agent is deployed
export function isAgentDeployed(agentName: string): string | null {
  const registry = getAgentRegistry();
  return registry[agentName] || null;
}