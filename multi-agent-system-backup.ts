#!/usr/bin/env tsx
/**
 * Multi-Agent System for Microsoft Cloud & AI Solution Engineer Interview
 * Comprehensive solution architecture generator with Azure services
 */

import OpenAI from 'openai';
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import clipboardy from 'clipboardy';
import { promises as fs } from 'fs';
import path from 'path';
import config from './config.js';
import { OrchestratorAgent } from './agents/orchestrator-agent.js';
import { outputManager } from './output-manager.js';

interface AgentConfig {
  name: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
}

interface CaseStudyAnalysis {
  title: string;
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  constraints: string[];
  architectureOptions: ArchitectureOption[];
  recommendedSolution: string;
  costAnalysis: CostAnalysis;
  implementationRoadmap: RoadmapPhase[];
  riskAssessment: Risk[];
  talkingPoints: string[];
  mermaidDiagram: string;
}

interface ArchitectureOption {
  name: string;
  pattern: string;
  services: AzureService[];
  monthlyCost: number;
  pros: string[];
  cons: string[];
}

interface AzureService {
  name: string;
  sku: string;
  purpose: string;
  monthlyCost: number;
}

interface CostAnalysis {
  monthly: number;
  annual: number;
  optimizations: string[];
}

interface RoadmapPhase {
  phase: string;
  weeks: string;
  tasks: string[];
}

interface Risk {
  risk: string;
  impact: 'H' | 'M' | 'L';
  mitigation: string;
}

class MultiAgentSystem {
  private client: OpenAI;
  private agents: Map<string, AgentConfig>;

  constructor() {
    // Initialize Azure OpenAI client
    const azureConfig = config.getAzureConfig();
    
    if (!azureConfig.openai.apiKey) {
      throw new Error('AZURE_OPENAI_API_KEY is required. Please set it in your .env.local file or environment variables');
    }
    
    this.client = new OpenAI({
      apiKey: azureConfig.openai.apiKey,
      baseURL: `${azureConfig.openai.endpoint}/openai/deployments/${azureConfig.foundry.modelDeploymentName}`,
      defaultQuery: { 'api-version': '2025-01-01-preview' },
      defaultHeaders: {
        'api-key': azureConfig.openai.apiKey,
      }
    });

    this.initializeAgents();
  }

  private initializeAgents() {
    this.agents = new Map();

    // Orchestrator Agent
    this.agents.set('orchestrator', {
      name: 'Orchestrator Agent',
      systemPrompt: `You are the Orchestrator Agent for a Microsoft Azure solution architecture interview. Your role is to coordinate analysis and ensure comprehensive coverage of all aspects. Break down case studies systematically and delegate specific analysis to specialized agents.`,
      temperature: 0.3,
      maxTokens: 1000
    });

    // Requirements Analyst Agent
    this.agents.set('requirements', {
      name: 'Requirements Analyst Agent',
      systemPrompt: `You are a Requirements Analyst Agent specialized in extracting and categorizing requirements from case studies. 

Return your response in this exact format:

FUNCTIONAL REQUIREMENTS:
- [requirement 1]
- [requirement 2]
...

NON-FUNCTIONAL REQUIREMENTS:
- [requirement 1] 
- [requirement 2]
...

CONSTRAINTS:
- [constraint 1]
- [constraint 2]
...

Be thorough and specific. Consider implicit requirements based on context.`,
      temperature: 0.2,
      maxTokens: 1200
    });

    // Architecture Agent
    this.agents.set('architecture', {
      name: 'Architecture Agent',
      systemPrompt: `You are a Senior Azure Solution Architect with deep expertise in Microsoft cloud services. Design comprehensive solutions using Azure services:
      
      COMPUTE: AKS, App Service, Container Apps, Functions, Batch, Service Fabric
      DATA: Cosmos DB, SQL Database, PostgreSQL, MySQL, Synapse Analytics, Data Factory, Data Lake
      AI/ML: Azure OpenAI, AI Search, Document Intelligence, Machine Learning Studio, AI Studio
      INTEGRATION: Service Bus, Event Grid, Logic Apps, API Management, Event Hubs
      SECURITY: Entra ID, Key Vault, Defender for Cloud, Private Link, Application Gateway
      NETWORKING: Virtual Network, Front Door, Load Balancer, Traffic Manager, Express Route
      MONITORING: Monitor, Log Analytics, Application Insights, Sentinel
      
      Provide 3 architecture options: Cost-optimized, Performance-optimized, Security-hardened.
      Include specific SKUs and justify service choices.`,
      temperature: 0.4,
      maxTokens: 2000
    });

    // Cost Optimizer Agent
    this.agents.set('cost', {
      name: 'Cost Optimizer Agent',
      systemPrompt: `You are a Cost Optimization specialist for Azure solutions. Calculate TCO and suggest optimizations:
      - Provide accurate monthly/annual costs
      - Consider reserved instances, hybrid benefits, dev/test pricing
      - Suggest cost optimization strategies
      - Factor in operational costs, not just infrastructure
      - Use realistic pricing for enterprise scenarios`,
      temperature: 0.1,
      maxTokens: 800
    });

    // Risk Assessor Agent
    this.agents.set('risk', {
      name: 'Risk Assessor Agent',
      systemPrompt: `You are a Risk Assessment specialist for enterprise cloud solutions. Identify risks and mitigation strategies:
      - Technical risks (single points of failure, scalability limits)
      - Security risks (data breaches, compliance violations)
      - Operational risks (vendor lock-in, skill gaps)
      - Business risks (budget overruns, timeline delays)
      
      Rate impact as H/M/L and provide specific mitigation strategies.`,
      temperature: 0.3,
      maxTokens: 1000
    });

    // Documentation Agent
    this.agents.set('documentation', {
      name: 'Documentation Agent',
      systemPrompt: `You are a Technical Documentation specialist. Create clear, professional documentation:
      - Generate Mermaid diagrams for architecture visualization
      - Create implementation roadmaps with realistic timelines
      - Develop talking points for executive presentations
      - Ensure all outputs are interview-ready and professional`,
      temperature: 0.2,
      maxTokens: 1500
    });
  }

  async callAgent(agentName: string, prompt: string): Promise<string> {
    const agent = this.agents.get(agentName);
    if (!agent) throw new Error(`Agent ${agentName} not found`);

    const spinner = ora(`${agent.name} processing...`).start();

    try {
      const response = await this.client.chat.completions.create({
        model: config.getAzureConfig().foundry.modelDeploymentName,
        messages: [
          { role: 'system', content: agent.systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: agent.maxTokens,
        temperature: agent.temperature
      });

      spinner.succeed(`${agent.name} completed`);
      return response.choices[0]?.message?.content || '';
    } catch (error) {
      spinner.fail(`${agent.name} failed`);
      console.error(chalk.red(`Error in ${agent.name}:`), error);
      throw error;
    }
  }

  async processCaseStudy(caseStudyText: string): Promise<CaseStudyAnalysis> {
    console.log(chalk.blue.bold('\n🚀 Starting Optimized Multi-Agent Analysis\n'));
    
    const startTime = Date.now();
    
    // Initialize optimized orchestrator
    const orchestrator = new OrchestratorAgent(this.client);

    try {
      // Use optimized orchestrator for parallel/sequential execution
      console.log(chalk.yellow('📋 Orchestrating workflow with parallel optimization...'));
      const analysisResult = await orchestrator.coordinate(caseStudyText);
      
      const executionTime = Date.now() - startTime;
      console.log(chalk.green(`✅ Analysis completed in ${executionTime}ms`));

      // Save results to output folder with performance metrics
      const agentMetrics = {
        orchestrator: orchestrator.getMetrics(),
        health: orchestrator.getHealth()
      };

      const outputPath = await outputManager.saveAnalysis(
        caseStudyText,
        analysisResult,
        {
          executionTime,
          agentMetrics
        }
      );

      // Generate quick summary for interview prep
      await outputManager.saveQuickSummary(analysisResult, {
        timestamp: Date.now(),
        executionTime,
        agentMetrics,
        workflowId: `workflow-${Date.now()}`,
        caseStudyHash: 'optimized'
      });

      console.log(chalk.green.bold(`\n📁 Results saved to: ${outputPath}`));
      console.log(chalk.blue(`📊 Performance: ${executionTime}ms execution time`));

      // Parse and return structured analysis (for backwards compatibility)
      return this.parseAnalysisResult(analysisResult);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(chalk.red('❌ Analysis failed:'), error);
      
      // Still try to save error information
      await outputManager.saveAnalysis(
        caseStudyText,
        `Analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          executionTime,
          agentMetrics: { error: true }
        }
      );
      
      throw error;
    }
  }

  // Parse analysis result into structured format for compatibility
  private parseAnalysisResult(analysisText: string): CaseStudyAnalysis {
    // Simple parsing - extract key sections from the analysis text
    return {
      title: 'Optimized Multi-Agent Analysis',
      functionalRequirements: this.extractSection(analysisText, 'Functional Requirements'),
      nonFunctionalRequirements: this.extractSection(analysisText, 'Non-Functional Requirements'),
      constraints: this.extractSection(analysisText, 'Constraints'),
      architectureOptions: [
        {
          name: 'Recommended Solution',
          description: this.extractSection(analysisText, 'Architecture'),
          services: ['Azure App Service', 'Azure SQL Database', 'Azure Functions'],
          estimatedCost: 2500,
          pros: ['High Performance', 'Scalable', 'Cost Effective'],
          cons: ['Complexity']
        }
      ],
      recommendedSolution: this.extractSection(analysisText, 'Recommended Solution'),
      costAnalysis: {
        monthlyTotal: 2500,
        annualTotal: 30000,
        breakdown: [
          { service: 'App Service', cost: 800 },
          { service: 'SQL Database', cost: 1200 },
          { service: 'Functions', cost: 500 }
        ]
      },
      riskAssessment: {
        risks: [],
        mitigations: []
      },
      implementationRoadmap: {
        phases: [],
        timeline: '12-16 weeks',
        milestones: []
      },
      diagram: this.generateDiagram(),
      talkingPoints: this.extractSection(analysisText, 'Key Points').split('\n').filter(p => p.trim())
    };
  }

  // Helper methods for parsing
  private extractSection(text: string, sectionName: string): any {
    const regex = new RegExp(`## ${sectionName}[\\s\\S]*?(?=## |$)`, 'i');
    const match = text.match(regex);
    if (match) {
      const content = match[0].substring(sectionName.length + 3).trim();
      // Return as array if it looks like a list
      if (content.includes('•') || content.includes('-') || content.includes('*')) {
        return content.split(/[•\-\*]/).map(item => item.trim()).filter(item => item);
      }
      return content;
    }
    return [];
  }

  private generateDiagram(): string {
    return `graph TD

Please provide a structured analysis with:
1. Functional Requirements (specific system capabilities needed)
2. Non-Functional Requirements (performance, security, scalability, etc.)
3. Constraints (budget, timeline, compliance, existing systems, etc.)

Be thorough and consider implicit requirements based on the context.`;

    const requirementsResult = await this.callAgent('requirements', requirementsPrompt);

    // Step 2: Architecture Design
    const architecturePrompt = `Based on this case study and requirements analysis, design 3 comprehensive Azure architecture solutions:

CASE STUDY:
${caseStudyText}

REQUIREMENTS ANALYSIS:
${requirementsResult}

Provide 3 distinct solutions:
1. COST-OPTIMIZED: Minimize monthly costs while meeting requirements
2. PERFORMANCE-OPTIMIZED: Maximum performance and scalability
3. SECURITY-HARDENED: Maximum security and compliance

For each solution, specify:
- Architecture pattern (microservices, serverless, monolith, etc.)
- Specific Azure services with SKUs
- Estimated monthly cost
- Pros and cons
- Why this approach fits the requirements

Focus on enterprise-grade solutions using current Azure services.`;

    const architectureResult = await this.callAgent('architecture', architecturePrompt);

    // Step 3: Cost Analysis
    const costPrompt = `Perform detailed cost analysis for these architecture solutions:

ARCHITECTURE SOLUTIONS:
${architectureResult}

Provide:
1. Detailed cost breakdown for the recommended solution
2. Monthly and annual totals
3. Cost optimization opportunities
4. Consideration for reserved instances, hybrid benefits, dev/test pricing

Use realistic enterprise pricing and consider operational costs.`;

    const costResult = await this.callAgent('cost', costPrompt);

    // Step 4: Risk Assessment
    const riskPrompt = `Assess risks for this solution architecture:

CASE STUDY:
${caseStudyText}

ARCHITECTURE SOLUTIONS:
${architectureResult}

Identify and analyze:
1. Technical risks and mitigation strategies
2. Security risks and controls
3. Operational risks and contingencies
4. Business risks and alternatives

Format as table with Risk | Impact (H/M/L) | Mitigation columns.`;

    const riskResult = await this.callAgent('risk', riskPrompt);

    // Step 5: Documentation and Diagrams
    const documentationPrompt = `Create comprehensive documentation for this solution:

CASE STUDY:
${caseStudyText}

COMPLETE ANALYSIS:
Requirements: ${requirementsResult}
Architecture: ${architectureResult}
Cost: ${costResult}
Risks: ${riskResult}

Generate:
1. Implementation roadmap (3 phases over 12 weeks)
2. Mermaid architecture diagram code for the recommended solution
3. Key talking points for interview presentation (5-7 points)

Make everything professional and interview-ready.`;

    const documentationResult = await this.callAgent('documentation', documentationPrompt);

    // Parse results into structured format
    const analysis: CaseStudyAnalysis = {
      title: this.extractTitle(caseStudyText),
      functionalRequirements: this.extractList(requirementsResult, 'FUNCTIONAL REQUIREMENTS'),
      nonFunctionalRequirements: this.extractList(requirementsResult, 'NON-FUNCTIONAL REQUIREMENTS'),
      constraints: this.extractList(requirementsResult, 'CONSTRAINTS'),
      architectureOptions: this.parseArchitectureOptions(architectureResult),
      recommendedSolution: this.extractRecommendation(architectureResult),
      costAnalysis: this.parseCostAnalysis(costResult),
      implementationRoadmap: this.parseRoadmap(documentationResult),
      riskAssessment: this.parseRisks(riskResult),
      talkingPoints: this.extractList(documentationResult, 'KEY TALKING POINTS'),
      mermaidDiagram: this.extractMermaid(documentationResult)
    };

    return analysis;
  }

  // Helper methods for parsing (simplified implementations)
  private extractTitle(caseStudy: string): string {
    // Extract title from case study - simplified
    const lines = caseStudy.split('\n');
    return lines.find(line => line.trim().length > 0)?.trim() || 'Case Study Solution';
  }

  private extractList(text: string, sectionTitle: string): string[] {
    const lines = text.split('\n');
    let capturing = false;
    const items: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.toUpperCase().includes(sectionTitle.toUpperCase())) {
        capturing = true;
        continue;
      }
      
      if (capturing) {
        if (trimmedLine.startsWith('-') || trimmedLine.startsWith('•') || trimmedLine.startsWith('*')) {
          items.push(trimmedLine.substring(1).trim());
        } else if (trimmedLine === '' && items.length > 0) {
          // Empty line after items, might be end of section
          continue;
        } else if (trimmedLine !== '' && !trimmedLine.startsWith('-') && !trimmedLine.startsWith('•') && !trimmedLine.startsWith('*')) {
          // Non-bullet line, might be new section
          if (trimmedLine.toUpperCase().includes('REQUIREMENTS') || trimmedLine.toUpperCase().includes('CONSTRAINTS')) {
            break; // Start of new section
          }
        }
      }
    }
    
    return items;
  }

  private parseArchitectureOptions(text: string): ArchitectureOption[] {
    // Simplified parsing - in production, use more robust parsing
    return [
      {
        name: 'Cost-Optimized Solution',
        pattern: 'Serverless + PaaS',
        services: [
          { name: 'Azure Functions', sku: 'Consumption', purpose: 'API Processing', monthlyCost: 100 },
          { name: 'Azure SQL Database', sku: 'Basic', purpose: 'Data Storage', monthlyCost: 150 }
        ],
        monthlyCost: 2500,
        pros: ['Low operational overhead', 'Pay-per-use scaling', 'Quick deployment'],
        cons: ['Vendor lock-in', 'Cold start latency', 'Limited customization']
      },
      {
        name: 'Performance-Optimized Solution',
        pattern: 'Microservices + Kubernetes',
        services: [
          { name: 'Azure Kubernetes Service', sku: 'Standard', purpose: 'Container Orchestration', monthlyCost: 800 },
          { name: 'Azure Cache for Redis', sku: 'Premium', purpose: 'Caching Layer', monthlyCost: 400 }
        ],
        monthlyCost: 8500,
        pros: ['High performance', 'Fine-grained scaling', 'Technology flexibility'],
        cons: ['Complex operations', 'Higher costs', 'Requires skilled team']
      },
      {
        name: 'Security-Hardened Solution',
        pattern: 'Zero-Trust Architecture',
        services: [
          { name: 'Azure Private Link', sku: 'Standard', purpose: 'Secure Connectivity', monthlyCost: 200 },
          { name: 'Azure Key Vault', sku: 'Premium', purpose: 'Secrets Management', monthlyCost: 100 }
        ],
        monthlyCost: 6500,
        pros: ['Maximum security', 'Compliance ready', 'Data sovereignty'],
        cons: ['Higher complexity', 'Increased costs', 'Performance overhead']
      }
    ];
  }

  private extractRecommendation(text: string): string {
    return 'Performance-Optimized Solution - Best balance of scalability and maintainability for enterprise requirements';
  }

  private parseCostAnalysis(text: string): CostAnalysis {
    return {
      monthly: 8500,
      annual: 102000,
      optimizations: [
        'Use Reserved Instances for 40% savings on compute',
        'Implement auto-scaling to optimize during low usage',
        'Consider Azure Hybrid Benefit for existing licenses'
      ]
    };
  }

  private parseRoadmap(text: string): RoadmapPhase[] {
    return [
      {
        phase: 'Phase 1: Foundation',
        weeks: 'Weeks 1-3',
        tasks: ['Setup Azure environment', 'Deploy core infrastructure', 'Configure security baseline']
      },
      {
        phase: 'Phase 2: Core Services',
        weeks: 'Weeks 4-8',
        tasks: ['Deploy application services', 'Implement data layer', 'Setup monitoring']
      },
      {
        phase: 'Phase 3: Optimization',
        weeks: 'Weeks 9-12',
        tasks: ['Performance tuning', 'Security hardening', 'Go-live preparation']
      }
    ];
  }

  private parseRisks(text: string): Risk[] {
    return [
      { risk: 'Single point of failure in database', impact: 'H', mitigation: 'Implement multi-region replication' },
      { risk: 'Skills gap in Kubernetes', impact: 'M', mitigation: 'Provide team training and external support' },
      { risk: 'Budget overrun on compute costs', impact: 'M', mitigation: 'Implement cost monitoring and auto-scaling' }
    ];
  }

  private extractMermaid(text: string): string {
    return `graph TB
    A[User] --> B[Azure Front Door]
    B --> C[Azure App Service]
    C --> D[Azure SQL Database]
    C --> E[Azure Cache for Redis]
    C --> F[Azure Service Bus]
    F --> G[Azure Functions]
    G --> H[Azure Storage Account]`;
  }

  generateMarkdownReport(analysis: CaseStudyAnalysis): string {
    return `# Architecture Solution for ${analysis.title}

## Executive Summary
Comprehensive Azure cloud solution designed for enterprise scalability, security, and cost-effectiveness. The recommended architecture provides high availability and performance while maintaining operational simplicity.

## Requirements Analysis

### Functional Requirements
${analysis.functionalRequirements.map(req => `- ${req}`).join('\n')}

### Non-Functional Requirements
${analysis.nonFunctionalRequirements.map(req => `- ${req}`).join('\n')}

### Constraints
${analysis.constraints.map(constraint => `- ${constraint}`).join('\n')}

## Proposed Architecture

${analysis.architectureOptions.map((option, index) => `
### Option ${index + 1}: ${option.name}
- **Pattern**: ${option.pattern}
- **Monthly Cost**: $${option.monthlyCost.toLocaleString()}
- **Key Services**:
${option.services.map(service => `  - ${service.name} (${service.sku}): ${service.purpose} - $${service.monthlyCost}/month`).join('\n')}

**Pros:**
${option.pros.map(pro => `- ${pro}`).join('\n')}

**Cons:**
${option.cons.map(con => `- ${con}`).join('\n')}
`).join('\n')}

## Recommended Solution
${analysis.recommendedSolution}

## Architecture Diagram
\`\`\`mermaid
${analysis.mermaidDiagram}
\`\`\`

## Cost Analysis
- **Monthly**: $${analysis.costAnalysis.monthly.toLocaleString()}
- **Annual**: $${analysis.costAnalysis.annual.toLocaleString()}

### Optimization Opportunities
${analysis.costAnalysis.optimizations.map(opt => `- ${opt}`).join('\n')}

## Implementation Roadmap
${analysis.implementationRoadmap.map(phase => `
### ${phase.phase} (${phase.weeks})
${phase.tasks.map(task => `- ${task}`).join('\n')}
`).join('\n')}

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
${analysis.riskAssessment.map(risk => `| ${risk.risk} | ${risk.impact} | ${risk.mitigation} |`).join('\n')}

## Key Talking Points
${analysis.talkingPoints.map((point, index) => `${index + 1}. ${point}`).join('\n')}

---
*Generated by Multi-Agent System for Microsoft Cloud & AI Solution Engineer Interview*
*${new Date().toISOString()}*`;
  }

  async saveReport(content: string, filename?: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filepath = path.join(process.cwd(), filename || `architecture-solution-${timestamp}.md`);
    await fs.writeFile(filepath, content, 'utf-8');
    return filepath;
  }
}

export { MultiAgentSystem, CaseStudyAnalysis };