#!/usr/bin/env tsx
/**
 * Multi-Agent System for Microsoft Cloud & AI Solution Engineer Interview
 * Optimized with parallel processing, performance monitoring, and output management
 */

import OpenAI from 'openai';
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import clipboardy from 'clipboardy';
import { promises as fs } from 'fs';
import path from 'path';
import config from '../config/config.js';
import { SimpleOrchestrator } from '../agents/simple-orchestrator.js';
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
  riskAssessment: Risk[];
  implementationRoadmap: RoadmapPhase[];
  diagram: string;
  talkingPoints: string[];
}

interface ProcessingResult {
  analysis: CaseStudyAnalysis;
  savedPath: string;
  markdownContent: string;
}

interface ArchitectureOption {
  name: string;
  description: string;
  services: AzureService[];
  estimatedCost: number;
  pros: string[];
  cons: string[];
}

interface AzureService {
  name: string;
  sku: string;
  cost: number;
}

interface CostAnalysis {
  total: number;
  breakdown: ServiceCost[];
}

interface ServiceCost {
  service: string;
  cost: number;
}

interface Risk {
  category: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  probability: 'high' | 'medium' | 'low';
  mitigation: string;
}

interface RoadmapPhase {
  phase: string;
  duration: string;
  tasks: string[];
}

class MultiAgentSystem {
  private client: OpenAI;
  private agents: Map<string, AgentConfig>;

  constructor() {
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
    this.agents = new Map([
      ['orchestrator', {
        name: 'Orchestrator',
        systemPrompt: 'You are the master coordinator for Microsoft Azure solution architecture analysis.',
        temperature: 0.3,
        maxTokens: 1500
      }],
      ['requirements', {
        name: 'Requirements Analyst',
        systemPrompt: 'You are an expert at extracting and analyzing functional and non-functional requirements.',
        temperature: 0.1,
        maxTokens: 1200
      }],
      ['architecture', {
        name: 'Architecture Specialist',
        systemPrompt: 'You are an Azure solution architect specializing in enterprise-grade architectures.',
        temperature: 0.2,
        maxTokens: 1800
      }]
    ]);
  }

  private async callAgent(agentName: string, prompt: string): Promise<string> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent ${agentName} not found`);
    }

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

      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error(`❌ Error calling ${agentName} agent:`, error);
      throw error;
    }
  }

  async processCaseStudy(caseStudyText: string): Promise<CaseStudyAnalysis> {
    // Enhanced progress display with timing
    const progressSpinner = ora({
      text: 'Initializing Azure Architecture Blueprint Generator...',
      spinner: 'aesthetic',
      color: 'blue'
    }).start();
    
    const startTime = Date.now();
    
    // Initialize simple orchestrator
    const orchestrator = new SimpleOrchestrator(this.client);

    try {
      // Generate case study folder name for organized output
      const caseStudyFolder = this.generateCaseStudyFolder(caseStudyText);
      
      // Use optimized orchestrator for parallel/sequential execution
      progressSpinner.text = 'Coordinating multi-agent workflow with parallel optimization...';
      const analysisResult = await orchestrator.coordinate(caseStudyText, caseStudyFolder);
      
      const executionTime = Date.now() - startTime;
      progressSpinner.succeed(`Analysis completed in ${Math.round(executionTime/1000)}s`);

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

      // The output manager now automatically saves quick summaries in case study folders
      // No need for separate saveQuickSummary call

      console.log(chalk.green.bold(`\n📁 Results saved to: ${outputPath}`));
      console.log(chalk.blue(`📊 Performance: ${executionTime}ms execution time`));

      // Parse and return structured analysis (for backwards compatibility)
      return this.parseAnalysisResult(analysisResult);
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      progressSpinner.fail(`Analysis failed after ${Math.round(executionTime/1000)}s`);
      console.error(chalk.red('❌ Error details:'), error.message);
      
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
      functionalRequirements: this.extractList(analysisText, 'Functional Requirements'),
      nonFunctionalRequirements: this.extractList(analysisText, 'Non-Functional Requirements'),
      constraints: this.extractList(analysisText, 'Constraints'),
      architectureOptions: [
        {
          name: 'Recommended Solution',
          description: this.extractSection(analysisText, 'Architecture'),
          services: [
            { name: 'Azure App Service', sku: 'S1', cost: 800 },
            { name: 'Azure SQL Database', sku: 'S2', cost: 1200 },
            { name: 'Azure Functions', sku: 'Y1', cost: 500 }
          ],
          estimatedCost: 2500,
          pros: ['High Performance', 'Scalable', 'Cost Effective'],
          cons: ['Complexity']
        }
      ],
      recommendedSolution: this.extractSection(analysisText, 'Recommended Solution'),
      costAnalysis: {
        total: 2500,
        breakdown: [
          { service: 'App Service', cost: 800 },
          { service: 'SQL Database', cost: 1200 },
          { service: 'Functions', cost: 500 }
        ]
      },
      riskAssessment: [
        {
          category: 'Technical',
          description: 'Scalability challenges',
          impact: 'medium',
          probability: 'low',
          mitigation: 'Auto-scaling configuration'
        }
      ],
      implementationRoadmap: [
        {
          phase: 'Foundation',
          duration: '4 weeks',
          tasks: ['Infrastructure setup', 'Security configuration']
        }
      ],
      diagram: this.generateDiagram(),
      talkingPoints: this.extractList(analysisText, 'Key Points')
    };
  }

  // Helper methods for parsing
  private extractSection(text: string, sectionName: string): string {
    const regex = new RegExp(`## ${sectionName}[\\s\\S]*?(?=## |$)`, 'i');
    const match = text.match(regex);
    if (match) {
      return match[0].substring(sectionName.length + 3).trim();
    }
    return 'Section not found';
  }

  private extractList(text: string, sectionName: string): string[] {
    const section = this.extractSection(text, sectionName);
    if (section.includes('•') || section.includes('-') || section.includes('*')) {
      return section.split(/[•\-\*]/).map(item => item.trim()).filter(item => item);
    }
    return [section];
  }

  private generateDiagram(): string {
    return `graph TD
    A[User] --> B[Front Door]
    B --> C[App Service]
    C --> D[SQL Database]
    C --> E[Azure Cache for Redis]
    C --> F[Service Bus]
    F --> G[Functions]
    G --> H[Storage Account]`;
  }

  async saveReport(content: string, filename?: string): Promise<string> {
    // This method is kept for backwards compatibility
    // New approach: case studies are automatically saved in structured folders via outputManager.saveAnalysis
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const outputDir = path.join(process.cwd(), 'output');
    
    // Ensure output directory exists
    await fs.mkdir(outputDir, { recursive: true });
    
    const filepath = path.join(outputDir, filename || `legacy-solution-${timestamp}.md`);
    await fs.writeFile(filepath, content, 'utf-8');
    return filepath;
  }

  async processCaseStudyWithContent(caseStudyText: string): Promise<ProcessingResult> {
    const analysis = await this.processCaseStudy(caseStudyText);
    
    // Find the most recent output file
    const outputDir = path.join(process.cwd(), 'output');
    const folders = await fs.readdir(outputDir, { withFileTypes: true });
    const caseStudyFolders = folders
      .filter(f => f.isDirectory() && f.name.includes('case-study'))
      .sort((a, b) => b.name.localeCompare(a.name)); // Most recent first
    
    if (caseStudyFolders.length === 0) {
      throw new Error('No case study output found');
    }
    
    const latestFolder = caseStudyFolders[0].name;
    const folderPath = path.join(outputDir, latestFolder);
    
    // Find the solution markdown file
    const files = await fs.readdir(folderPath);
    const solutionFile = files.find(f => f.startsWith('solution-') && f.endsWith('.md'));
    
    if (!solutionFile) {
      throw new Error('No solution markdown file found');
    }
    
    const filePath = path.join(folderPath, solutionFile);
    const markdownContent = await fs.readFile(filePath, 'utf-8');
    
    return {
      analysis,
      savedPath: filePath,
      markdownContent
    };
  }

  private generateCaseStudyFolder(caseStudyText: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const title = this.extractTitle(caseStudyText);
    const sanitizedTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);
    
    return `case-study-${timestamp}-${sanitizedTitle}`;
  }

  private extractTitle(caseStudyText: string): string {
    const lines = caseStudyText.trim().split('\n');
    
    // Look for markdown headers
    const headerLine = lines.find(line => line.trim().startsWith('#'));
    if (headerLine) {
      return headerLine.replace(/^#+\s*/, '').trim();
    }
    
    // Look for first meaningful line
    const firstLine = lines.find(line => line.trim().length > 0);
    if (firstLine && firstLine.length > 5) {
      return firstLine.trim().slice(0, 50);
    }
    
    return 'case-study';
  }

  // Cleanup method to properly shut down the system
  cleanup(): void {
    // If using BaseAgent-derived classes, clean them up
    // For now, we'll add a simple timer to force exit if needed
    console.log('\n🔄 Cleaning up system...');
  }
}

export { MultiAgentSystem, CaseStudyAnalysis, ProcessingResult };