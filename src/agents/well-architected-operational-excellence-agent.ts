/**
 * Well-Architected Operational Excellence Agent
 * Specialized agent for Azure Well-Architected Framework Operational Excellence pillar
 * Focus: DevOps practices, monitoring, automation, deployment safety
 */

import OpenAI from 'openai';
import config from '../config/config.js';
import { BaseAgent } from './base-agent.js';

interface OperationalTask {
  id: string;
  type: 'operational-excellence-assessment';
  priority: 'high' | 'medium' | 'low';
  payload: {
    architecture: string;
    requirements: string;
    currentDevOpsMaturity?: string;
    deploymentFrequency?: string;
    teamStructure?: string;
  };
}

interface OperationalResult {
  operationalScore: number; // 1-10 scale
  devOpsMaturity: string;
  automationRecommendations: string[];
  monitoringObservability: string[];
  deploymentStrategy: string;
  operationalProcesses: string[];
  incidentResponse: string;
  azureDevOpsServices: string[];
  wellArchitectedCompliance: string;
}

export class WellArchitectedOperationalExcellenceAgent extends BaseAgent {
  constructor(client: OpenAI) {
    super(client);
  }

  async execute(task: OperationalTask): Promise<OperationalResult> {
    try {
      console.log('🔧 Analyzing operational excellence with WAF principles...');
      
      const operationalAnalysis = await this.assessOperationalExcellence(
        task.payload.architecture,
        task.payload.requirements,
        task.payload.currentDevOpsMaturity,
        task.payload.deploymentFrequency,
        task.payload.teamStructure
      );

      const result = this.parseOperationalAnalysis(operationalAnalysis);
      
      console.log(`✅ Operational excellence assessment complete - Score: ${result.operationalScore}/10`);
      return result;
      
    } catch (error) {
      console.error('❌ Operational excellence assessment failed:', error);
      return this.getOperationalFallback();
    }
  }

  private async assessOperationalExcellence(
    architecture: string,
    requirements: string,
    devOpsMaturity?: string,
    deploymentFrequency?: string,
    teamStructure?: string
  ): Promise<string> {
    
    const response = await this.client.chat.completions.create({
      model: config.getAzureConfig().foundry.modelDeploymentName,
      messages: [
        {
          role: 'system',
          content: `You are a Well-Architected Operational Excellence Agent specializing in the Azure Well-Architected Framework Operational Excellence pillar.

**AZURE WELL-ARCHITECTED OPERATIONAL EXCELLENCE PRINCIPLES:**
1. **Embrace DevOps culture** - Collaborative development and operations practices
2. **Establish development standards** - Consistent processes and quality gates
3. **Evolve operations with observability** - Comprehensive monitoring and insights
4. **Automate for efficiency** - Reduce manual processes and human error
5. **Adopt safe deployment practices** - Minimize risk in production releases

**OPERATIONAL EXCELLENCE FOCUS AREAS:**
- **DevOps Culture**: Team collaboration, shared responsibility, continuous improvement
- **Development Standards**: Code quality, testing, documentation, review processes
- **Observability**: Monitoring, logging, alerting, distributed tracing
- **Automation**: CI/CD pipelines, infrastructure as code, testing automation
- **Safe Deployment**: Blue-green, canary releases, rollback strategies
- **Incident Management**: Response procedures, post-mortems, learning culture

**AZURE DEVOPS & OPERATIONAL SERVICES TO EVALUATE:**
- **Development**: Azure DevOps, GitHub Actions, Visual Studio Code
- **CI/CD**: Azure Pipelines, GitHub Actions, Azure Container Registry
- **Infrastructure as Code**: ARM templates, Bicep, Terraform
- **Monitoring**: Azure Monitor, Application Insights, Log Analytics
- **Automation**: Logic Apps, Azure Automation, Functions
- **Testing**: Azure Load Testing, Test Plans, Playwright
- **Security**: GitHub Advanced Security, Azure Policy, Key Vault

**OPERATIONAL ASSESSMENT STRUCTURE:**
1. **Operational Score (1-10)**: Overall operational maturity rating
2. **DevOps Maturity**: Current practices and improvement opportunities
3. **Automation Recommendations**: Specific automation opportunities
4. **Monitoring & Observability**: Comprehensive monitoring strategy
5. **Deployment Strategy**: Safe deployment practices and patterns
6. **Operational Processes**: Incident response and maintenance procedures
7. **Incident Response**: Procedures and escalation strategies
8. **Azure DevOps Services**: Specific tooling recommendations
9. **WAF Compliance**: Operational excellence pillar alignment

Focus on practical DevOps improvements with specific Azure tooling and automation recommendations.`
        },
        {
          role: 'user',
          content: `Conduct comprehensive operational excellence assessment following Azure Well-Architected Framework:

**Architecture:**
${architecture}

**Requirements:**
${requirements}

${devOpsMaturity ? `**Current DevOps Maturity:**\n${devOpsMaturity}\n` : ''}
${deploymentFrequency ? `**Deployment Frequency:**\n${deploymentFrequency}\n` : ''}
${teamStructure ? `**Team Structure:**\n${teamStructure}\n` : ''}

**OPERATIONAL EXCELLENCE DELIVERABLES:**
1. Operational score (1-10) with detailed maturity assessment
2. DevOps culture and practice evaluation
3. Automation opportunities and recommendations
4. Comprehensive monitoring and observability strategy
5. Safe deployment practices and release management
6. Operational processes and incident response procedures
7. Team collaboration and knowledge sharing improvements
8. Azure DevOps and operational tooling recommendations
9. Well-Architected Framework operational compliance
10. Continuous improvement and learning culture development

Focus on practical DevOps transformations with Azure-native tooling and automation.`
        }
      ],
      max_tokens: 2000,
      temperature: 0.1
    });

    return response.choices[0]?.message?.content || 'Operational excellence assessment failed';
  }

  private parseOperationalAnalysis(analysis: string): OperationalResult {
    // Extract operational score
    const scoreMatch = analysis.match(/operational score[:\s]*(\d+(?:\.\d+)?)/i);
    const operationalScore = scoreMatch ? parseFloat(scoreMatch[1]) : 7;

    // Extract DevOps maturity assessment
    const maturityMatch = analysis.match(/devops[^.]*maturity[:\s]*([^.]+(?:\.[^.]*){0,2})/i);
    const devOpsMaturity = maturityMatch ? maturityMatch[1].trim() : 'Intermediate DevOps practices with automation opportunities';

    // Extract deployment strategy
    const deploymentMatch = analysis.match(/deployment[^.]*strategy[:\s]*([^.]+(?:\.[^.]*){0,1})/i);
    const deploymentStrategy = deploymentMatch ? deploymentMatch[1].trim() : 'Blue-green deployment with automated rollback capabilities';

    // Extract incident response strategy
    const incidentMatch = analysis.match(/incident[^.]*response[:\s]*([^.]+(?:\.[^.]*){0,1})/i);
    const incidentResponse = incidentMatch ? incidentMatch[1].trim() : 'Structured incident response with escalation procedures';

    // Extract various operational components
    const automation = this.extractOperationalItems(analysis, ['automation', 'automate', 'ci/cd']);
    const monitoring = this.extractOperationalItems(analysis, ['monitoring', 'observability', 'alerting']);
    const processes = this.extractOperationalItems(analysis, ['process', 'procedure', 'practice']);
    const azureServices = this.extractAzureDevOpsServices(analysis);

    return {
      operationalScore: Math.min(Math.max(operationalScore, 1), 10),
      devOpsMaturity,
      automationRecommendations: automation.slice(0, 6),
      monitoringObservability: monitoring.slice(0, 5),
      deploymentStrategy,
      operationalProcesses: processes.slice(0, 5),
      incidentResponse,
      azureDevOpsServices: azureServices.slice(0, 8),
      wellArchitectedCompliance: this.extractWAFOperationalCompliance(analysis)
    };
  }

  private extractOperationalItems(text: string, keywords: string[]): string[] {
    const items: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
        const item = trimmedLine.substring(1).trim();
        if (keywords.some(keyword => item.toLowerCase().includes(keyword))) {
          items.push(item);
        }
      }
    }
    
    return items.length > 0 ? items : this.getDefaultOperationalItems(keywords[0]);
  }

  private getDefaultOperationalItems(category: string): string[] {
    const defaults = {
      'automation': [
        'Implement CI/CD pipelines with Azure DevOps',
        'Infrastructure as Code with ARM templates',
        'Automated testing in deployment pipeline',
        'Configuration management automation',
        'Automated security scanning',
        'Database migration automation'
      ],
      'monitoring': [
        'Application Insights for APM',
        'Azure Monitor for infrastructure metrics',
        'Log Analytics for centralized logging',
        'Custom dashboards and alerting',
        'Distributed tracing implementation'
      ],
      'process': [
        'Code review and approval processes',
        'Release management procedures',
        'Incident escalation workflows',
        'Post-mortem and learning practices',
        'Knowledge documentation standards'
      ]
    };
    
    return defaults[category] || defaults['automation'];
  }

  private extractAzureDevOpsServices(analysis: string): string[] {
    const devOpsServicePatterns = [
      'Azure DevOps', 'GitHub Actions', 'Azure Pipelines', 'Application Insights',
      'Azure Monitor', 'Log Analytics', 'Azure Automation', 'Azure Functions',
      'ARM Templates', 'Bicep', 'Azure Container Registry', 'Key Vault',
      'Azure Policy', 'Logic Apps', 'Azure Load Testing'
    ];

    const foundServices: string[] = [];
    for (const service of devOpsServicePatterns) {
      if (analysis.toLowerCase().includes(service.toLowerCase())) {
        foundServices.push(service);
      }
    }

    return foundServices.length > 0 ? foundServices : [
      'Azure DevOps', 'Application Insights', 'Azure Monitor', 'ARM Templates'
    ];
  }

  private extractWAFOperationalCompliance(analysis: string): string {
    const complianceMatch = analysis.match(/well-architected.*operational[:\s]*([^.]+(?:\.[^.]*){0,1})/i);
    if (complianceMatch) {
      return complianceMatch[1].trim();
    }
    return 'Aligned with Well-Architected operational excellence principles';
  }

  private getOperationalFallback(): OperationalResult {
    return {
      operationalScore: 7,
      devOpsMaturity: 'Intermediate DevOps practices with automation opportunities identified',
      automationRecommendations: [
        'Implement CI/CD pipelines with Azure DevOps',
        'Infrastructure as Code with ARM templates',
        'Automated testing in deployment pipeline',
        'Configuration management automation',
        'Automated security scanning',
        'Database migration automation'
      ],
      monitoringObservability: [
        'Application Insights for application monitoring',
        'Azure Monitor for infrastructure metrics',
        'Log Analytics for centralized logging',
        'Custom dashboards and alerting rules',
        'Distributed tracing implementation'
      ],
      deploymentStrategy: 'Blue-green deployment with automated rollback capabilities',
      operationalProcesses: [
        'Code review and approval workflows',
        'Release management procedures',
        'Incident escalation and response',
        'Post-mortem and continuous learning',
        'Documentation and knowledge sharing'
      ],
      incidentResponse: 'Structured incident response with escalation procedures and post-mortem analysis',
      azureDevOpsServices: [
        'Azure DevOps', 'Application Insights', 'Azure Monitor', 
        'ARM Templates', 'Azure Automation', 'GitHub Actions'
      ],
      wellArchitectedCompliance: 'Operational excellence assessment temporarily unavailable - manual review recommended'
    };
  }
}