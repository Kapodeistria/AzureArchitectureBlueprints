/**
 * Structurizr DSL Agent - Creates C4 Model Architecture Diagrams
 * Generates Structurizr DSL code for professional architecture visualization
 */

import { BaseAgent, AgentTask } from './base-agent.js';
import OpenAI from 'openai';

interface StructurizrTask {
  architecture: any;
  requirements: string;
  components: any[];
  relationships: any[];
  level: 'system' | 'container' | 'component' | 'code';
  includeViews?: boolean;
  styling?: boolean;
}

export class StructurizrDSLAgent extends BaseAgent {
  constructor(client: OpenAI) {
    super(client, 'structurizr-dsl');
  }

  protected getSystemPrompt(): string {
    return `You are a Structurizr DSL Expert specializing in creating C4 Model architecture diagrams.

Your role:
- Convert software architecture descriptions into valid Structurizr DSL code
- Create system context, container, component, and code diagrams
- Apply proper C4 model principles and best practices
- Generate clean, maintainable DSL with proper styling
- Ensure diagrams are deployment-ready for Structurizr

Key requirements:
1. Always use valid Structurizr DSL syntax
2. Include proper workspace structure with model and views
3. Create meaningful relationships between elements
4. Apply consistent naming conventions
5. Include styling for professional appearance
6. Generate multiple view levels when requested
7. Add documentation and descriptions for clarity

DSL Structure:
- workspace "Name" "Description" { model { ... } views { ... } }
- People, Software Systems, Containers, Components
- Relationships with descriptions
- SystemLandscape, SystemContext, Container, Component views
- Styling themes and element styling

Output format: Return only valid Structurizr DSL code wrapped in \`\`\`structurizr blocks.`;
  }

  protected async processTask(task: AgentTask): Promise<string> {
    const { architecture, requirements, components, relationships, level, includeViews, styling } = task.payload as StructurizrTask;

    const prompt = this.buildStructurizrPrompt(architecture, requirements, components, relationships, level, includeViews, styling);

    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: prompt }
    ];

    const response = await this.callOpenAI(messages, {
      maxTokens: 2000,
      temperature: 0.1 // Low temperature for consistent DSL syntax
    });

    return this.extractStructurizrDSL(response.choices[0].message.content);
  }

  private buildStructurizrPrompt(
    architecture: any,
    requirements: string,
    components: any[],
    relationships: any[],
    level: string,
    includeViews?: boolean,
    styling?: boolean
  ): string {
    return `Create a Structurizr DSL diagram for the following architecture:

**Requirements:**
${requirements}

**Architecture Overview:**
${JSON.stringify(architecture, null, 2)}

**Components:**
${components.map((comp, idx) => `${idx + 1}. ${comp.name}: ${comp.description} (${comp.type})`).join('\n')}

**Relationships:**
${relationships.map((rel, idx) => `${idx + 1}. ${rel.from} → ${rel.to}: ${rel.description}`).join('\n')}

**Diagram Level:** ${level}
**Include Views:** ${includeViews ? 'Yes' : 'No'}
**Include Styling:** ${styling ? 'Yes' : 'No'}

Generate a complete Structurizr DSL workspace that includes:
1. Proper workspace structure
2. Model with people, systems, containers, and components as appropriate
3. Relationships between all elements
4. ${includeViews ? 'Multiple views (SystemLandscape, SystemContext, Container, Component as appropriate)' : 'Basic views'}
5. ${styling ? 'Professional styling with colors and shapes' : 'Basic styling'}
6. Clear descriptions and documentation

Ensure the DSL is syntactically correct and ready for deployment to Structurizr.`;
  }

  private extractStructurizrDSL(content: string): string {
    // Extract DSL code from response
    const dslMatch = content.match(/```(?:structurizr)?\s*([\s\S]*?)```/);
    if (dslMatch) {
      return dslMatch[1].trim();
    }

    // If no code block, try to extract from content
    if (content.includes('workspace')) {
      return content.trim();
    }

    throw new Error('Failed to extract valid Structurizr DSL from response');
  }

  // Public methods for different diagram types
  async generateSystemLandscape(requirements: string, systems: any[]): Promise<string> {
    const task: AgentTask = {
      id: `structurizr-landscape-${Date.now()}`,
      type: 'system-landscape',
      priority: 'medium',
      payload: {
        architecture: { type: 'system-landscape', systems },
        requirements,
        components: systems,
        relationships: this.inferSystemRelationships(systems),
        level: 'system',
        includeViews: true,
        styling: true
      }
    };

    const response = await this.executeTask(task.type, task.payload);
    if (response.status === 'failed') {
      throw new Error(`Structurizr DSL generation failed: ${response.error}`);
    }
    return response.result;
  }

  async generateContainerDiagram(system: any, containers: any[]): Promise<string> {
    const task: AgentTask = {
      id: `structurizr-container-${Date.now()}`,
      type: 'container-diagram',
      priority: 'medium',
      payload: {
        architecture: { type: 'container', system, containers },
        requirements: `Container diagram for ${system.name}`,
        components: containers,
        relationships: this.inferContainerRelationships(containers),
        level: 'container',
        includeViews: true,
        styling: true
      }
    };

    const response = await this.executeTask(task.type, task.payload);
    if (response.status === 'failed') {
      throw new Error(`Container diagram generation failed: ${response.error}`);
    }
    return response.result;
  }

  async generateComponentDiagram(container: any, components: any[]): Promise<string> {
    const task: AgentTask = {
      id: `structurizr-component-${Date.now()}`,
      type: 'component-diagram',
      priority: 'medium',
      payload: {
        architecture: { type: 'component', container, components },
        requirements: `Component diagram for ${container.name}`,
        components,
        relationships: this.inferComponentRelationships(components),
        level: 'component',
        includeViews: true,
        styling: true
      }
    };

    const response = await this.executeTask(task.type, task.payload);
    if (response.status === 'failed') {
      throw new Error(`Component diagram generation failed: ${response.error}`);
    }
    return response.result;
  }

  async generateFullArchitecture(architecture: any, requirements: string): Promise<string> {
    const task: AgentTask = {
      id: `structurizr-full-${Date.now()}`,
      type: 'full-architecture',
      priority: 'high',
      payload: {
        architecture,
        requirements,
        components: this.extractAllComponents(architecture),
        relationships: this.extractAllRelationships(architecture),
        level: 'system',
        includeViews: true,
        styling: true
      }
    };

    const response = await this.executeTask(task.type, task.payload);
    if (response.status === 'failed') {
      throw new Error(`Full architecture generation failed: ${response.error}`);
    }
    return response.result;
  }

  // Helper methods for relationship inference
  private inferSystemRelationships(systems: any[]): any[] {
    const relationships = [];
    
    for (let i = 0; i < systems.length; i++) {
      for (let j = i + 1; j < systems.length; j++) {
        const system1 = systems[i];
        const system2 = systems[j];
        
        // Infer relationships based on system types and descriptions
        if (this.shouldHaveRelationship(system1, system2)) {
          relationships.push({
            from: system1.name,
            to: system2.name,
            description: this.inferRelationshipDescription(system1, system2)
          });
        }
      }
    }
    
    return relationships;
  }

  private inferContainerRelationships(containers: any[]): any[] {
    const relationships = [];
    
    for (const container of containers) {
      if (container.dependencies) {
        for (const dep of container.dependencies) {
          relationships.push({
            from: container.name,
            to: dep.name || dep,
            description: dep.description || 'Uses'
          });
        }
      }
    }
    
    return relationships;
  }

  private inferComponentRelationships(components: any[]): any[] {
    const relationships = [];
    
    for (const component of components) {
      if (component.uses) {
        for (const used of component.uses) {
          relationships.push({
            from: component.name,
            to: used.name || used,
            description: used.description || 'Uses'
          });
        }
      }
    }
    
    return relationships;
  }

  private shouldHaveRelationship(system1: any, system2: any): boolean {
    // Basic heuristics for system relationships
    const types1 = (system1.type || '').toLowerCase();
    const types2 = (system2.type || '').toLowerCase();
    
    // Frontend typically connects to API/Backend
    if (types1.includes('frontend') && (types2.includes('api') || types2.includes('backend'))) {
      return true;
    }
    
    // API typically connects to Database
    if (types1.includes('api') && types2.includes('database')) {
      return true;
    }
    
    // Check for explicit dependencies
    if (system1.dependencies?.includes(system2.name) || system2.dependencies?.includes(system1.name)) {
      return true;
    }
    
    return false;
  }

  private inferRelationshipDescription(system1: any, system2: any): string {
    const types1 = (system1.type || '').toLowerCase();
    const types2 = (system2.type || '').toLowerCase();
    
    if (types1.includes('frontend') && types2.includes('api')) {
      return 'Makes API calls to';
    }
    if (types1.includes('api') && types2.includes('database')) {
      return 'Reads from and writes to';
    }
    if (types1.includes('service') && types2.includes('queue')) {
      return 'Publishes messages to';
    }
    
    return 'Communicates with';
  }

  private extractAllComponents(architecture: any): any[] {
    const components = [];
    
    if (architecture.systems) {
      components.push(...architecture.systems);
    }
    if (architecture.containers) {
      components.push(...architecture.containers);
    }
    if (architecture.components) {
      components.push(...architecture.components);
    }
    
    return components;
  }

  private extractAllRelationships(architecture: any): any[] {
    const relationships = [];
    
    if (architecture.relationships) {
      relationships.push(...architecture.relationships);
    }
    
    // Extract implicit relationships from components
    const allComponents = this.extractAllComponents(architecture);
    relationships.push(...this.inferSystemRelationships(allComponents));
    
    return relationships;
  }

  // Validation method
  async validateDSL(dsl: string): Promise<{ valid: boolean; errors: string[] }> {
    const errors = [];
    
    // Basic syntax validation
    if (!dsl.includes('workspace')) {
      errors.push('Missing workspace declaration');
    }
    
    if (!dsl.includes('model')) {
      errors.push('Missing model section');
    }
    
    if (!dsl.includes('views')) {
      errors.push('Missing views section');
    }
    
    // Check for balanced braces
    const openBraces = (dsl.match(/\{/g) || []).length;
    const closeBraces = (dsl.match(/\}/g) || []).length;
    
    if (openBraces !== closeBraces) {
      errors.push(`Unmatched braces: ${openBraces} open, ${closeBraces} close`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}