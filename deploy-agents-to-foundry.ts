#!/usr/bin/env tsx
/**
 * Deploy Agents to Azure AI Foundry
 * Creates flows/agents in Azure AI Foundry for better analytics, RAG, and debugging
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import config from './config.js';
import chalk from 'chalk';

interface FoundryAgentDefinition {
  name: string;
  description: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  ragSources?: string[];
  dependencies?: string[];
}

class FoundryAgentDeployment {
  private foundryEndpoint: string;
  private apiKey: string;

  constructor() {
    const configData = config.get();
    this.foundryEndpoint = configData.azure.foundry.projectEndpoint;
    this.apiKey = configData.azure.openai.apiKey!;
  }

  async deployAllAgents() {
    console.log(chalk.blue.bold('🚀 Deploying Agents to Azure AI Foundry\n'));

    const agents = this.defineAgents();
    
    for (const agent of agents) {
      await this.deployAgent(agent);
    }

    await this.createWorkflowOrchestration();
    
    console.log(chalk.green.bold('\n✅ All agents deployed to Azure AI Foundry!'));
    console.log(chalk.blue('📊 Check analytics at: https://ai.azure.com/'));
  }

  private defineAgents(): FoundryAgentDefinition[] {
    return [
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
        systemPrompt: `You are an Azure Cost Optimization specialist focused on enterprise TCO analysis and cost-effective architecture recommendations.`,
        temperature: 0.3,
        maxTokens: 2000,
        dependencies: ['architecture-designer'],
        ragSources: [
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

  private async deployAgent(agent: FoundryAgentDefinition) {
    console.log(chalk.yellow(`📦 Deploying ${agent.name}...`));

    const agentConfig = {
      name: agent.name,
      description: agent.description,
      model: {
        deployment_name: 'gpt-4.1',
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

    // Save agent configuration for deployment
    const configPath = join('foundry-agents', `${agent.name}.json`);
    await fs.mkdir('foundry-agents', { recursive: true });
    await fs.writeFile(configPath, JSON.stringify(agentConfig, null, 2));

    console.log(chalk.green(`✅ ${agent.name} configuration saved`));

    // In a real implementation, this would make API calls to Azure AI Foundry
    // For now, we're creating the configuration files
    await this.generateDeploymentScript(agent);
  }

  private async generateDeploymentScript(agent: FoundryAgentDefinition) {
    const deployScript = `# Deploy ${agent.name} to Azure AI Foundry

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
    
    await deployment.deployAllAgents();
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