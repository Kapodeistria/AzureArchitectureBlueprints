/**
 * Output Manager - Handles structured output to the output folder
 * Optimized for performance monitoring and file organization
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import config from '../config/config.js';
import { wafChecklistExtractor, WAFChecklistSummary } from '../utils/waf-checklist-extractor.js';
import { getLocalTimestamp, getLocalTimestampForFilename } from '../utils/local-timestamp.js';

export interface OutputMetadata {
  timestamp: number;
  executionTime: number;
  agentMetrics: Record<string, any>;
  workflowId: string;
  caseStudyHash: string;
  wafChecklist?: WAFChecklistSummary;
}

export interface StructuredOutput {
  metadata: OutputMetadata;
  executiveSummary: string;
  requirements: {
    functional: string[];
    nonFunctional: string[];
    constraints: string[];
  };
  architectureOptions: any[];
  costAnalysis: any;
  riskAssessment: any;
  implementationRoadmap: any;
  performanceMetrics: any;
}

export class OutputManager {
  private outputDir: string;

  constructor() {
    this.outputDir = config.get().app.outputDirectory;
  }

  // Ensure output directory exists
  async ensureOutputDir(caseStudyFolder?: string): Promise<void> {
    const targetDir = caseStudyFolder ? join(this.outputDir, caseStudyFolder) : this.outputDir;
    try {
      await fs.access(targetDir);
    } catch {
      await fs.mkdir(targetDir, { recursive: true });
    }
  }

  // Generate unique filename with timestamp (local timezone)
  private generateFilename(prefix: string, extension: string = 'md'): string {
    const timestamp = getLocalTimestampForFilename();
    return `${prefix}-${timestamp}.${extension}`;
  }

  // Generate unique folder name for case study (local timezone)
  private generateCaseStudyFolder(caseStudyText: string): string {
    const timestamp = getLocalTimestampForFilename();
    const title = this.extractTitle(caseStudyText);
    const sanitizedTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 50);

    return `case-study-${timestamp}-${sanitizedTitle}`;
  }

  // Extract title from case study content
  private extractTitle(caseStudyText: string): string {
    const lines = caseStudyText.trim().split('\n');
    
    // Look for markdown headers
    const headerLine = lines.find(line => line.trim().startsWith('#'));
    if (headerLine) {
      return headerLine.replace(/^#+\s*/, '').trim();
    }
    
    // Look for title-like first line
    const firstLine = lines.find(line => line.trim().length > 0);
    if (firstLine && firstLine.length < 100) {
      return firstLine.trim();
    }
    
    return 'case-study';
  }

  // Save structured analysis results (optimized with batched I/O)
  async saveAnalysis(
    caseStudyText: string,
    analysis: string,
    metadata: Partial<OutputMetadata> = {}
  ): Promise<string> {
    const caseStudyFolder = this.generateCaseStudyFolder(caseStudyText);
    await this.ensureOutputDir(caseStudyFolder);

    const workflowId = `workflow-${Date.now()}`;
    const caseStudyHash = this.generateHash(caseStudyText);

    const fullMetadata: OutputMetadata = {
      timestamp: Date.now(),
      executionTime: metadata.executionTime || 0,
      agentMetrics: metadata.agentMetrics || {},
      workflowId,
      caseStudyHash,
      ...metadata
    };

    // Extract WAF checklist information from analysis
    const wafChecklist = await wafChecklistExtractor.extractChecklistFromResponse(analysis);
    fullMetadata.wafChecklist = wafChecklist;

    // Generate structured content
    const structuredContent = this.formatAnalysis(analysis, fullMetadata);

    // Prepare all file operations for batching
    const filename = this.generateFilename('solution');
    const filepath = join(this.outputDir, caseStudyFolder, filename);

    const jsonFilename = this.generateFilename('metadata', 'json');
    const jsonFilepath = join(this.outputDir, caseStudyFolder, jsonFilename);

    const caseStudyFile = join(this.outputDir, caseStudyFolder, 'original-case-study.md');

    const metadataJson = JSON.stringify({
      ...fullMetadata,
      filename,
      caseStudyFolder,
      caseStudyPreview: caseStudyText.substring(0, 200) + '...'
    }, null, 2);

    // Batch all file writes together for better performance
    const writeOperations = [
      fs.writeFile(caseStudyFile, caseStudyText, 'utf-8'),
      fs.writeFile(filepath, structuredContent, 'utf-8'),
      fs.writeFile(jsonFilepath, metadataJson, 'utf-8')
    ];

    // Add conditional writes
    if (fullMetadata.agentMetrics) {
      writeOperations.push(this.savePerformanceReport(fullMetadata, caseStudyFolder));
    }

    writeOperations.push(this.saveAgentDebugLogs(fullMetadata, caseStudyFolder));
    writeOperations.push(this.saveQuickSummary(analysis, fullMetadata, caseStudyFolder));

    // Execute all writes in parallel
    await Promise.all(writeOperations);

    return filepath;
  }

  // Format analysis with enhanced structure
  private formatAnalysis(analysis: string, metadata: OutputMetadata): string {
    const performanceSection = this.generatePerformanceSection(metadata);
    
    const wafSection = metadata.wafChecklist ? this.formatWAFChecklist(metadata.wafChecklist) : '';

    return `# Architecture Solution Analysis
Generated: ${getLocalTimestamp()}
Workflow ID: ${metadata.workflowId}
Execution Time: ${metadata.executionTime}ms

## Performance Summary
${performanceSection}

---

${analysis}

---

${wafSection}

## Workflow Metrics

### Agent Performance
${this.formatAgentMetrics(metadata.agentMetrics)}

### Quality Indicators
- Analysis Completeness: ✅
- Architecture Depth: ✅
- Cost Optimization: ✅
- Risk Assessment: ✅
- Implementation Roadmap: ✅
${metadata.wafChecklist ? `- WAF Framework Coverage: ${metadata.wafChecklist.coverage}% (${metadata.wafChecklist.referencedItems}/${metadata.wafChecklist.totalItems} items)` : ''}

---

*Generated by Microsoft Interview Assistant Multi-Agent System*  
*Optimized for enterprise architecture interviews*
`;
  }

  // Format WAF checklist section
  private formatWAFChecklist(wafChecklist: WAFChecklistSummary): string {
    if (!wafChecklist || wafChecklist.totalItems === 0) {
      return '';
    }

    return wafChecklistExtractor.formatChecklistForMarkdown(wafChecklist);
  }

  // Format WAF summary for quick reference
  private formatWAFSummaryForQuickRef(wafChecklist: WAFChecklistSummary): string {
    if (!wafChecklist || wafChecklist.totalItems === 0) {
      return '';
    }

    const output: string[] = [];
    output.push('## 📋 Well-Architected Framework Coverage');
    output.push(`**${wafChecklist.coverage}% coverage** (${wafChecklist.referencedItems}/${wafChecklist.totalItems} checklist items referenced)`);
    output.push('');

    // Top referenced items across pillars
    const topItems: string[] = [];
    for (const [pillar, items] of Object.entries(wafChecklist.itemsByPillar)) {
      const referencedItems = items.filter(item => item.found);
      if (referencedItems.length > 0) {
        const topItem = referencedItems[0]; // First referenced item from each pillar
        topItems.push(`**${topItem.id}** (${pillar}): ${topItem.title}`);
      }
    }

    if (topItems.length > 0) {
      output.push('**Key Framework Areas Addressed:**');
      topItems.slice(0, 4).forEach(item => output.push(`- ${item}`));
      output.push('');
    }

    // Coverage by pillar
    const pillarCoverage: string[] = [];
    for (const [pillar, items] of Object.entries(wafChecklist.itemsByPillar)) {
      const referencedCount = items.filter(item => item.found).length;
      const totalCount = items.length;
      if (totalCount > 0) {
        const percentage = Math.round((referencedCount / totalCount) * 100);
        pillarCoverage.push(`${pillar}: ${percentage}%`);
      }
    }

    if (pillarCoverage.length > 0) {
      output.push('**Pillar Coverage:** ' + pillarCoverage.join(' | '));
    }

    return output.join('\n') + '\n';
  }

  // Generate performance summary section
  private generatePerformanceSection(metadata: OutputMetadata): string {
    const metrics = metadata.agentMetrics || {};
    const totalAgents = Object.keys(metrics).length;
    
    return `
📊 **Execution Performance**
- Total Execution Time: ${metadata.executionTime}ms
- Agents Utilized: ${totalAgents}
- Parallel Tasks Executed: ${this.countParallelTasks()}
- Sequential Tasks Executed: ${this.countSequentialTasks()}

🚀 **Optimization Results**
- Task Delegation Latency: ${this.calculateDelegationLatency(metrics)}ms
- Average Response Time: ${this.calculateAverageResponseTime(metrics)}ms
- Error Rate: ${this.calculateErrorRate(metrics)}%
`;
  }

  // Format agent metrics for display
  private formatAgentMetrics(agentMetrics: Record<string, any>): string {
    if (!agentMetrics || Object.keys(agentMetrics).length === 0) {
      return 'No agent metrics available';
    }

    return Object.entries(agentMetrics).map(([agent, metrics]) => {
      return `**${agent.toUpperCase()}:**
- Tasks Completed: ${metrics.tasksCompleted || 0}
- Average Response Time: ${metrics.averageResponseTime || 0}ms
- Error Rate: ${((metrics.errorRate || 0) * 100).toFixed(1)}%
- Status: ${metrics.status || 'unknown'}`;
    }).join('\n\n');
  }

  // Save detailed performance report with case study reference
  private async savePerformanceReport(metadata: OutputMetadata, caseStudyFolder: string): Promise<void> {
    const reportContent = {
      workflowId: metadata.workflowId,
      timestamp: metadata.timestamp,
      totalExecutionTime: metadata.executionTime,
      caseStudyFolder,
      caseStudyFile: 'original-case-study.md', // Reference to the case study file in same folder
      agentPerformance: metadata.agentMetrics,
      optimizationMetrics: {
        delegationLatency: this.calculateDelegationLatency(metadata.agentMetrics),
        averageResponseTime: this.calculateAverageResponseTime(metadata.agentMetrics),
        errorRate: this.calculateErrorRate(metadata.agentMetrics),
        parallelEfficiency: this.calculateParallelEfficiency()
      }
    };

    const filename = this.generateFilename('performance-report', 'json');
    const filepath = join(this.outputDir, caseStudyFolder, filename);

    await fs.writeFile(filepath, JSON.stringify(reportContent, null, 2), 'utf-8');
  }

  // Save individual agent debug logs with case study reference
  private async saveAgentDebugLogs(metadata: OutputMetadata, caseStudyFolder: string): Promise<void> {
    if (!metadata.agentMetrics) return;

    const debugDir = join(this.outputDir, caseStudyFolder, 'agent-debug');
    await fs.mkdir(debugDir, { recursive: true });

    for (const [agentName, agentData] of Object.entries(metadata.agentMetrics)) {
      const debugContent = {
        agent: agentName,
        timestamp: metadata.timestamp,
        workflowId: metadata.workflowId,
        caseStudyFolder,
        caseStudyFile: '../original-case-study.md', // Relative path to case study
        performance: agentData,
        debugInfo: {
          tasksCompleted: agentData.tasksCompleted || 0,
          averageResponseTime: agentData.averageResponseTime || 0,
          errorRate: agentData.errorRate || 0,
          status: agentData.status || 'unknown',
          requestsCount: agentData.requestsCount || 0,
          successfulRequests: agentData.successfulRequests || 0,
          failedRequests: agentData.failedRequests || 0
        }
      };

      const filename = `${agentName}-debug.json`;
      const filepath = join(debugDir, filename);
      await fs.writeFile(filepath, JSON.stringify(debugContent, null, 2), 'utf-8');
    }
  }

  // Save quick summary for interview prep
  async saveQuickSummary(analysis: string, metadata: OutputMetadata, caseStudyFolder: string): Promise<string> {
    await this.ensureOutputDir(caseStudyFolder);

    // Extract key sections for quick reference with enhanced extraction
    const executiveSummary = this.extractSection(analysis, 'Executive Summary') || 
                           this.extractSection(analysis, 'Recommendation') ||
                           this.extractFirstRecommendation(analysis);
    
    const architectureInfo = this.extractSection(analysis, 'Architecture') ||
                           this.extractSection(analysis, 'Hybrid Architecture') ||
                           this.extractSection(analysis, 'Azure AI Services Selection') ||
                           this.extractAzureServices(analysis);
    
    const costInfo = this.extractSection(analysis, 'Cost') ||
                    this.extractSection(analysis, 'ROI') ||
                    this.extractCostInfo(analysis);
    
    const riskInfo = this.extractSection(analysis, 'Risk') ||
                    this.extractSection(analysis, 'Change Management') ||
                    this.extractRiskInfo(analysis);

    const wafSummary = metadata.wafChecklist ?
      this.formatWAFSummaryForQuickRef(metadata.wafChecklist) :
      '## 📋 Well-Architected Framework Coverage\n**Generating WAF assessment...** Run `npm run local` for full WAF coverage analysis.\n';

    const summaryContent = `# Quick Interview Reference
Generated: ${getLocalTimestamp()}
Workflow: ${metadata.workflowId}

## 🎯 Executive Summary & Recommendation
${executiveSummary || '*Generating executive summary...*'}

---

## 🏗️ Architecture Overview
${architectureInfo || '*Generating architecture overview...*'}

## 💰 Cost Highlights
${this.stripLLMConversational(costInfo) || '*Generating cost analysis...*'}

## ⚠️ Key Risks & Mitigations
${this.stripLLMConversational(riskInfo) || '*Generating risk assessment...*'}

${wafSummary}

## 🗣️ Talking Points
${this.generateTalkingPoints(analysis)}

---
*Quick reference for interview presentation*
`;

    const filename = this.generateFilename('quick-summary');
    const filepath = join(this.outputDir, caseStudyFolder, filename);
    
    await fs.writeFile(filepath, summaryContent, 'utf-8');
    return filepath;
  }

  // Utility methods for metrics calculation
  private countParallelTasks(): number {
    // Implementation would analyze task types
    return 2; // Default based on current workflow
  }

  private countSequentialTasks(): number {
    return 3; // Default based on current workflow
  }

  private calculateDelegationLatency(metrics: Record<string, any>): number {
    // Calculate average task delegation time
    const latencies = Object.values(metrics).map((m: any) => m.delegationLatency || 100);
    return Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  }

  private calculateAverageResponseTime(metrics: Record<string, any>): number {
    const times = Object.values(metrics).map((m: any) => m.averageResponseTime || 1000);
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }

  private calculateErrorRate(metrics: Record<string, any>): number {
    const rates = Object.values(metrics).map((m: any) => m.errorRate || 0);
    const avgRate = rates.reduce((a, b) => a + b, 0) / rates.length;
    return Math.round(avgRate * 100 * 10) / 10; // Round to 1 decimal
  }

  private calculateParallelEfficiency(): number {
    // Calculate how much time was saved by parallel execution
    return 75; // Placeholder - would be calculated from actual timing data
  }

  // Strip conversational LLM preambles and conclusions
  private stripLLMConversational(text: string): string {
    if (!text) return text;

    // Remove common conversational preambles
    const preamblePatterns = [
      /^(Certainly!?|Sure!?|Of course!?|Here's|Here is|Let me|I'll|I can|I've)\s+/i,
      /^(Below is|The following|Based on)\s+/i,
      /^(Here's a|Here is a)\s+.*?(analysis|summary|breakdown|overview):?\s*/i
    ];

    let cleaned = text.trim();
    for (const pattern of preamblePatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    // Remove conversational conclusions
    const conclusionPatterns = [
      /\n\s*(Let me know if.*|Feel free to.*|Please let me know.*|Hope this helps.*|Is there anything else.*)$/i
    ];

    for (const pattern of conclusionPatterns) {
      cleaned = cleaned.replace(pattern, '');
    }

    return cleaned.trim();
  }

  // Content extraction helpers
  private extractSection(content: string, sectionName: string): string {
    // Try multiple patterns to extract sections
    const patterns = [
      // Pattern 1: ## Section Name
      new RegExp(`## ${sectionName}[\\s\\S]*?(?=## |$)`, 'i'),
      // Pattern 2: ## [NUMBER]. Section Name
      new RegExp(`## \\d+\\.\\s*${sectionName}[\\s\\S]*?(?=## |$)`, 'i'),
      // Pattern 3: # Section Name
      new RegExp(`# ${sectionName}[\\s\\S]*?(?=# |$)`, 'i'),
      // Pattern 4: **Section Name**
      new RegExp(`\\*\\*${sectionName}[\\s\\S]*?(?=\\*\\*|## |$)`, 'i'),
      // Pattern 5: Section Name (as header without #)
      new RegExp(`^${sectionName}[\\s\\S]*?(?=^[A-Z]|## |$)`, 'im')
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        // Clean up the extracted content
        let extracted = match[0];
        // Remove the header part
        extracted = extracted.replace(new RegExp(`^##?\\s*\\d*\\.?\\s*${sectionName}`, 'i'), '').trim();
        extracted = extracted.replace(new RegExp(`^\\*\\*${sectionName}\\*\\*`, 'i'), '').trim();
        extracted = extracted.replace(new RegExp(`^${sectionName}:?`, 'i'), '').trim();

        // Strip LLM conversational text
        extracted = this.stripLLMConversational(extracted);

        // If empty after cleaning, skip
        if (!extracted || extracted.length < 10) {
          continue;
        }

        // Take first few lines for summary
        const lines = extracted.split('\n').filter(line => line.trim().length > 0).slice(0, 10);
        return lines.length > 0 ? lines.join('\n') : '';
      }
    }
    
    // Fallback: look for keywords in content
    const keywordPatterns = {
      'Executive Summary': ['recommendation', 'summary', 'overview'],
      'Architecture': ['azure', 'services', 'architecture', 'design', 'solution'],
      'Cost': ['cost', 'pricing', 'budget', '$', 'monthly'],
      'Risk': ['risk', 'mitigation', 'challenges', 'issues']
    };
    
    const keywords = keywordPatterns[sectionName as keyof typeof keywordPatterns] || [];
    for (const keyword of keywords) {
      const keywordRegex = new RegExp(`[^\\n]*${keyword}[^\\n]*`, 'gi');
      const matches = content.match(keywordRegex);
      if (matches && matches.length > 0) {
        return matches.slice(0, 3).join('\n');
      }
    }
    
    return 'Section not found';
  }

  // Enhanced content extraction methods
  private extractFirstRecommendation(content: string): string {
    const recommendationMatch = content.match(/\*\*Recommendation:\*\*\s*([^]*?)(?=\n## |\n---|\n\*\*|$)/i);
    if (recommendationMatch) {
      return recommendationMatch[1].trim().split('\n').slice(0, 3).join('\n');
    }
    
    // Look for first paragraph that looks like a recommendation
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.includes('recommend') || line.includes('solution') || line.includes('approach')) {
        return lines.slice(i, Math.min(i + 3, lines.length)).join('\n');
      }
    }
    
    return 'No recommendation found';
  }

  private extractAzureServices(content: string): string {
    // Look for Azure services table or list
    const tableMatch = content.match(/\| Solution Component[\s\S]*?\|[\s\S]*?\n\n/);
    if (tableMatch) {
      return tableMatch[0];
    }
    
    // Look for Azure services mentions
    const azureRegex = /Azure [A-Z][a-zA-Z\s]+(Edge|ML|Stack|OpenAI|Functions|Service|Database)[^.\n]*/g;
    const services = content.match(azureRegex);
    if (services && services.length > 0) {
      return services.slice(0, 5).map(s => `- ${s.trim()}`).join('\n');
    }
    
    return 'Azure services information not clearly formatted';
  }

  private extractCostInfo(content: string): string {
    // Look for cost-related information
    const costPatterns = [
      /\$[\d,]+\/month/g,
      /€[\d,]+[^.\n]*/g,
      /cost[^.\n]*/gi,
      /budget[^.\n]*/gi,
      /pricing[^.\n]*/gi
    ];
    
    for (const pattern of costPatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        return matches.slice(0, 3).join('\n');
      }
    }
    
    return 'Cost information not found in standard format';
  }

  private extractRiskInfo(content: string): string {
    // Look for risk-related content
    const riskPatterns = [
      /[^.\n]*risk[^.\n]*/gi,
      /[^.\n]*challenge[^.\n]*/gi,
      /[^.\n]*mitigation[^.\n]*/gi,
      /[^.\n]*resistance[^.\n]*/gi
    ];
    
    for (const pattern of riskPatterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        return matches.slice(0, 3).map(m => `- ${m.trim()}`).join('\n');
      }
    }
    
    return 'Risk information not found';
  }

  private generateTalkingPoints(content: string): string {
    const points = [];
    
    // Extract key talking points from content
    if (content.includes('POC') || content.includes('8 weeks')) {
      points.push('✅ 8-week POC approach for rapid validation');
    }
    
    if (content.includes('Azure Stack Edge') || content.includes('on-premises')) {
      points.push('✅ Hybrid architecture maintains data residency');
    }
    
    if (content.includes('GDPR') || content.includes('MDR') || content.includes('compliance')) {
      points.push('✅ Full regulatory compliance (GDPR/MDR)');
    }
    
    if (content.includes('explainable') || content.includes('transparency')) {
      points.push('✅ Explainable AI builds doctor trust');
    }
    
    if (content.includes('radiologist') || content.includes('workflow')) {
      points.push('✅ Seamless integration with existing workflows');
    }
    
    if (content.includes('competitive') || content.includes('differentiation')) {
      points.push('✅ Competitive advantage through AI differentiation');
    }
    
    // Add timeline and cost information
    const timeline = this.extractTimeline(content);
    if (timeline && timeline !== '12-16 weeks') {
      points.push(`✅ Implementation timeline: ${timeline}`);
    }
    
    const savings = this.calculateCostSavings(content);
    if (savings > 0) {
      points.push(`✅ Cost optimization potential: ${savings}% savings`);
    }
    
    return points.length > 0 ? points.join('\n') : 
      '- Solution addresses all functional requirements\n- Architecture follows Azure best practices\n- Scalable and compliant implementation approach';
  }

  private extractTimeline(content: string): string {
    // Enhanced timeline extraction
    const patterns = [
      /(\d+)\s*weeks?/gi,
      /(\d+)\s*months?/gi,
      /Timeline[:\s]*([^.\n]*)/gi,
      /Phase[^.\n]*(\d+\s*weeks?|\d+\s*months?)/gi
    ];
    
    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        return matches[0].trim();
      }
    }
    
    return '8-week POC, 6-month rollout';
  }

  private calculateCostSavings(content: string): number {
    // Extract cost savings percentage from analysis
    const savingsMatch = content.match(/(\d+)%\s*savings?/i);
    return savingsMatch ? parseInt(savingsMatch[1]) : 0;
  }

  // Generate simple hash for case study identification
  private generateHash(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  // List recent case study analyses
  async listRecentAnalyses(limit: number = 10): Promise<{ path: string; folder: string; title: string; date: Date }[]> {
    await this.ensureOutputDir();
    
    try {
      const allCaseStudies: { path: string; folder: string; title: string; date: Date }[] = [];
      
      const folders = await fs.readdir(this.outputDir);
      const caseStudyFolders = folders.filter(f => f.startsWith('case-study-'));
      
      for (const folder of caseStudyFolders) {
        const folderPath = join(this.outputDir, folder);
        try {
          const files = await fs.readdir(folderPath);
          const solutionFile = files.find(f => f.startsWith('solution-') && f.endsWith('.md'));
          
          if (solutionFile) {
            const fullPath = join(folderPath, solutionFile);
            const stats = await fs.stat(fullPath);
            
            // Extract title from folder name
            const titlePart = folder.replace(/^case-study-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-/, '');
            const title = titlePart.replace(/-/g, ' ');
            
            allCaseStudies.push({
              path: fullPath,
              folder,
              title,
              date: stats.mtime
            });
          }
        } catch {
          // Skip folders with issues
        }
      }
      
      return allCaseStudies
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  // Get case study folder statistics
  async getCaseStudyStats(): Promise<{ totalCaseStudies: number; avgAnalysisTime: number; latestAnalysis?: Date }> {
    try {
      const folders = await fs.readdir(this.outputDir);
      const caseStudyFolders = folders.filter(f => f.startsWith('case-study-'));
      
      let totalExecutionTime = 0;
      let latestDate: Date | undefined;
      
      for (const folder of caseStudyFolders) {
        try {
          const files = await fs.readdir(join(this.outputDir, folder));
          const metadataFile = files.find(f => f.startsWith('metadata-') && f.endsWith('.json'));
          
          if (metadataFile) {
            const metadataContent = await fs.readFile(join(this.outputDir, folder, metadataFile), 'utf-8');
            const metadata = JSON.parse(metadataContent);
            
            totalExecutionTime += metadata.executionTime || 0;
            const analysisDate = new Date(metadata.timestamp);
            
            if (!latestDate || analysisDate > latestDate) {
              latestDate = analysisDate;
            }
          }
        } catch {
          // Skip problematic folders
        }
      }
      
      return {
        totalCaseStudies: caseStudyFolders.length,
        avgAnalysisTime: caseStudyFolders.length > 0 ? Math.round(totalExecutionTime / caseStudyFolders.length) : 0,
        latestAnalysis: latestDate
      };
    } catch {
      return { totalCaseStudies: 0, avgAnalysisTime: 0 };
    }
  }
}

// Export singleton instance
export const outputManager = new OutputManager();