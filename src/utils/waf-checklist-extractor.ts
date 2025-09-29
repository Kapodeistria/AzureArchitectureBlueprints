/**
 * WAF Checklist Extractor
 * 
 * PURPOSE: Extract and format Well-Architected Framework checklist items from agent responses
 * Enhance result files with structured WAF checklist information
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';

export interface WAFChecklistItem {
  id: string;           // e.g., "SE:01", "RE:02"
  pillar: string;       // e.g., "Security", "Reliability" 
  title: string;
  description: string;
  recommendation: string;
  azureServices: string[];
  found: boolean;       // Whether this item was referenced in agent response
}

export interface WAFChecklistSummary {
  totalItems: number;
  referencedItems: number;
  coverage: number;     // percentage
  itemsByPillar: Record<string, WAFChecklistItem[]>;
  recommendations: string[];
}

export class WAFChecklistExtractor {
  private wafKnowledge: Record<string, any> = {};
  private initialized = false;

  constructor() {
    // Initialization is async, so we defer loading until first use
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.loadWAFKnowledge();
      this.initialized = true;
    }
  }

  /**
   * Load all WAF knowledge bases
   */
  private async loadWAFKnowledge(): Promise<void> {
    const knowledgeFiles = [
      'waf-knowledge-base/security-knowledge.json',
      'waf-knowledge-base/reliability-knowledge.json', 
      'waf-knowledge-base/cost-optimization-knowledge.json',
      'waf-knowledge-base/performance-efficiency-knowledge.json',
      'waf-knowledge-base/operational-excellence-knowledge.json'
    ];

    for (const file of knowledgeFiles) {
      try {
        if (existsSync(file)) {
          const data = await fs.readFile(file, 'utf8');
          const knowledge = JSON.parse(data);
          const pillar = file.split('/')[1].replace('-knowledge.json', '');
          this.wafKnowledge[pillar] = knowledge;
        }
      } catch (error) {
        console.warn(`⚠️ Could not load WAF knowledge: ${file}`);
      }
    }
  }

  /**
   * Extract WAF checklist items referenced in agent responses
   */
  async extractChecklistFromResponse(responseText: string): Promise<WAFChecklistSummary> {
    await this.ensureInitialized();
    const checklistItems: WAFChecklistItem[] = [];
    const referencedIds: string[] = [];

    // Extract checklist IDs from response (SE:01, RE:02, etc.)
    const checklistPattern = /([A-Z]{2}:\d{2})/g;
    const matches = responseText.match(checklistPattern) || [];
    
    for (const match of matches) {
      if (!referencedIds.includes(match)) {
        referencedIds.push(match);
      }
    }

    // Get detailed information for each referenced item
    for (const id of referencedIds) {
      const item = this.getChecklistItemDetails(id, responseText);
      if (item) {
        checklistItems.push(item);
      }
    }

    // Also get all available checklist items to show coverage
    const allItems = this.getAllChecklistItems();
    
    // Mark which items were found
    for (const item of allItems) {
      item.found = referencedIds.includes(item.id);
      if (!checklistItems.find(ci => ci.id === item.id)) {
        checklistItems.push(item);
      }
    }

    return this.generateSummary(checklistItems);
  }

  /**
   * Get detailed information for a specific checklist item
   */
  private getChecklistItemDetails(id: string, responseText: string): WAFChecklistItem | null {
    const pillarPrefix = id.split(':')[0];
    const pillarMap: Record<string, string> = {
      'SE': 'security',
      'RE': 'reliability', 
      'CO': 'cost-optimization',
      'PE': 'performance-efficiency',
      'OE': 'operational-excellence'
    };

    const pillarKey = pillarMap[pillarPrefix];
    const pillarData = this.wafKnowledge[pillarKey];

    if (!pillarData || !pillarData.checklistItems) {
      return null;
    }

    const item = pillarData.checklistItems.find((item: any) => item.id === id);
    if (!item) {
      return null;
    }

    // Extract context around the checklist ID in the response
    const recommendation = this.extractRecommendationContext(id, responseText);
    const azureServices = this.extractAzureServices(recommendation);

    return {
      id: item.id,
      pillar: this.pillarDisplayName(pillarKey),
      title: item.title || item.description?.split('.')[0] || `Checklist item ${id}`,
      description: item.description || '',
      recommendation,
      azureServices,
      found: true
    };
  }

  /**
   * Get all available checklist items from knowledge base
   */
  private getAllChecklistItems(): WAFChecklistItem[] {
    const allItems: WAFChecklistItem[] = [];

    for (const [pillarKey, pillarData] of Object.entries(this.wafKnowledge)) {
      if (pillarData.checklistItems) {
        for (const item of pillarData.checklistItems) {
          allItems.push({
            id: item.id,
            pillar: this.pillarDisplayName(pillarKey),
            title: item.title || item.description?.split('.')[0] || `Checklist item ${item.id}`,
            description: item.description || '',
            recommendation: '',
            azureServices: [],
            found: false
          });
        }
      }
    }

    return allItems;
  }

  /**
   * Extract recommendation context around a checklist ID
   */
  private extractRecommendationContext(id: string, text: string): string {
    const lines = text.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(id)) {
        // Get 2 lines before and after the match
        const start = Math.max(0, i - 2);
        const end = Math.min(lines.length, i + 3);
        const context = lines.slice(start, end).join('\n').trim();
        
        // Clean up and return meaningful recommendation
        return context.replace(/^\W+/, '').substring(0, 500);
      }
    }

    return 'Referenced in agent analysis';
  }

  /**
   * Extract Azure services from recommendation text
   */
  private extractAzureServices(text: string): string[] {
    const azureServicePatterns = [
      'Azure Active Directory', 'Entra ID', 'Azure AD',
      'Azure Key Vault', 'Key Vault',
      'Azure Monitor', 'Application Insights',
      'Azure Security Center', 'Microsoft Defender for Cloud',
      'Azure Firewall', 'Network Security Groups', 'NSG',
      'Azure Policy', 'Azure Blueprints',
      'Azure Backup', 'Azure Site Recovery',
      'Azure Load Balancer', 'Application Gateway',
      'Azure Front Door', 'Azure Traffic Manager',
      'Azure Cosmos DB', 'Azure SQL Database',
      'Azure Storage', 'Blob Storage',
      'Azure Functions', 'Azure App Service',
      'Azure Kubernetes Service', 'AKS',
      'Azure Virtual Machines', 'Azure VMs'
    ];

    const foundServices: string[] = [];
    
    for (const service of azureServicePatterns) {
      if (text.toLowerCase().includes(service.toLowerCase())) {
        foundServices.push(service);
      }
    }

    return [...new Set(foundServices)]; // Remove duplicates
  }

  /**
   * Generate WAF checklist summary
   */
  private generateSummary(items: WAFChecklistItem[]): WAFChecklistSummary {
    const referencedItems = items.filter(item => item.found);
    const totalItems = items.length;
    const coverage = totalItems > 0 ? Math.round((referencedItems.length / totalItems) * 100) : 0;

    // Group by pillar
    const itemsByPillar: Record<string, WAFChecklistItem[]> = {};
    for (const item of items) {
      if (!itemsByPillar[item.pillar]) {
        itemsByPillar[item.pillar] = [];
      }
      itemsByPillar[item.pillar].push(item);
    }

    // Generate recommendations based on coverage
    const recommendations: string[] = [];
    
    if (coverage < 30) {
      recommendations.push('Low WAF checklist coverage - enhance agent prompts to reference specific checklist items');
    } else if (coverage < 60) {
      recommendations.push('Moderate WAF checklist coverage - consider expanding analysis depth');
    } else {
      recommendations.push('Good WAF checklist coverage - analysis well-aligned with framework');
    }

    // Pillar-specific recommendations
    for (const [pillar, pillarItems] of Object.entries(itemsByPillar)) {
      const pillarCoverage = pillarItems.filter(item => item.found).length / pillarItems.length;
      if (pillarCoverage < 0.3) {
        recommendations.push(`${pillar} pillar needs more detailed analysis`);
      }
    }

    return {
      totalItems,
      referencedItems: referencedItems.length,
      coverage,
      itemsByPillar,
      recommendations
    };
  }

  /**
   * Convert pillar key to display name
   */
  private pillarDisplayName(key: string): string {
    const displayNames: Record<string, string> = {
      'security': 'Security',
      'reliability': 'Reliability',
      'cost-optimization': 'Cost Optimization',
      'performance-efficiency': 'Performance Efficiency',
      'operational-excellence': 'Operational Excellence'
    };
    
    return displayNames[key] || key;
  }

  /**
   * Format checklist for markdown output
   */
  formatChecklistForMarkdown(summary: WAFChecklistSummary): string {
    const output: string[] = [];

    output.push('## Well-Architected Framework Checklist Analysis');
    output.push('');
    output.push(`📊 **Coverage Summary**`);
    output.push(`- Referenced Items: ${summary.referencedItems}/${summary.totalItems}`);
    output.push(`- Coverage Percentage: ${summary.coverage}%`);
    output.push('');

    // Referenced items by pillar
    for (const [pillar, items] of Object.entries(summary.itemsByPillar)) {
      const referencedItems = items.filter(item => item.found);
      if (referencedItems.length > 0) {
        output.push(`### ${pillar} Pillar (${referencedItems.length}/${items.length} items)`);
        output.push('');
        
        for (const item of referencedItems) {
          output.push(`**${item.id}: ${item.title}**`);
          if (item.recommendation) {
            output.push(`- ${item.recommendation.substring(0, 200)}...`);
          }
          if (item.azureServices.length > 0) {
            output.push(`- Azure Services: ${item.azureServices.join(', ')}`);
          }
          output.push('');
        }
      }
    }

    // Recommendations
    if (summary.recommendations.length > 0) {
      output.push('### Recommendations');
      output.push('');
      for (const rec of summary.recommendations) {
        output.push(`- ${rec}`);
      }
      output.push('');
    }

    return output.join('\n');
  }
}

// Export singleton instance
export const wafChecklistExtractor = new WAFChecklistExtractor();