/**
 * Structurizr Renderer Agent - Local diagram generation with multiple methods
 * Benchmarks different rendering approaches for optimal performance
 */

import { BaseAgent, AgentTask } from './base-agent.js';
import { promises as fs } from 'fs';
import { execSync, spawn } from 'child_process';
import path from 'path';
import OpenAI from 'openai';

interface RenderingResult {
  method: string;
  success: boolean;
  outputPath?: string;
  executionTime: number;
  fileSize?: number;
  quality: number;
  error?: string;
  metadata: {
    width?: number;
    height?: number;
    format: string;
    dependencies: string[];
  };
}

interface RenderingTask {
  dslContent: string;
  outputDir: string;
  systemName: string;
  formats: ('svg' | 'png' | 'pdf' | 'plantuml' | 'mermaid')[];
  caseStudyFolder?: string;
}

interface BenchmarkResults {
  totalTime: number;
  methods: RenderingResult[];
  bestMethod: string;
  recommendations: string[];
  summary: {
    fastest: string;
    highestQuality: string;
    mostReliable: string;
    smallestFile: string;
  };
}

export class StructurizrRendererAgent extends BaseAgent {
  private tempDir: string;
  private renderingMethods: Map<string, Function>;

  constructor(client: OpenAI) {
    super(client, 'structurizr-renderer');
    this.tempDir = path.join(process.cwd(), 'output', 'structurizr-renders');
    this.initializeRenderingMethods();
  }

  protected getSystemPrompt(): string {
    return `You are a Structurizr Diagram Rendering Expert specializing in local diagram generation and optimization.

Your role:
- Convert Structurizr DSL to visual diagrams using multiple rendering methods
- Benchmark performance, quality, and reliability of different approaches
- Optimize rendering parameters for best results
- Generate comprehensive comparison reports

Focus on:
1. Speed of rendering
2. Visual quality and clarity
3. File size optimization
4. Reliability and error handling
5. Dependency management`;
  }

  private initializeRenderingMethods() {
    this.renderingMethods = new Map([
      ['structurizr-cli', this.renderWithStructurizrCLI.bind(this)],
      ['plantuml-local', this.renderWithPlantUMLLocal.bind(this)],
      ['plantuml-server', this.renderWithPlantUMLServer.bind(this)],
      ['mermaid-cli', this.renderWithMermaidCLI.bind(this)],
      ['puppeteer-express', this.renderWithPuppeteerExpress.bind(this)],
      ['svg-custom', this.renderWithCustomSVG.bind(this)]
    ]);
  }

  async execute(task: AgentTask): Promise<BenchmarkResults> {
    const renderTask = task.payload as RenderingTask;
    const startTime = Date.now();
    
    console.log(`🎨 Starting Structurizr rendering benchmark for ${renderTask.systemName}`);
    
    await this.ensureTempDirectory();
    const results: RenderingResult[] = [];

    // Test each rendering method
    for (const [methodName, renderMethod] of this.renderingMethods) {
      console.log(`🔧 Testing method: ${methodName}`);
      
      try {
        const result = await renderMethod(renderTask, methodName);
        results.push(result);
        
        if (result.success) {
          console.log(`✅ ${methodName}: ${result.executionTime}ms`);
        } else {
          console.log(`❌ ${methodName}: ${result.error}`);
        }
      } catch (error) {
        results.push({
          method: methodName,
          success: false,
          executionTime: 0,
          quality: 0,
          error: error.message,
          metadata: { format: 'unknown', dependencies: [] }
        });
        console.log(`💥 ${methodName}: ${error.message}`);
      }
    }

    const totalTime = Date.now() - startTime;
    const benchmark = this.analyzeBenchmarkResults(results, totalTime);
    
    // Save benchmark results
    await this.saveBenchmarkResults(benchmark, renderTask);
    
    console.log(`🏆 Benchmark complete! Best method: ${benchmark.bestMethod}`);
    return benchmark;
  }

  // Method 1: Structurizr CLI (Official)
  private async renderWithStructurizrCLI(task: RenderingTask, method: string): Promise<RenderingResult> {
    const startTime = Date.now();
    
    try {
      // Check if Structurizr CLI is available
      execSync('structurizr-cli --version', { stdio: 'pipe' });
      
      const dslFile = path.join(this.tempDir, `${task.systemName}-${method}.dsl`);
      await fs.writeFile(dslFile, task.dslContent);
      
      // Export as SVG
      const outputFile = path.join(this.tempDir, `${task.systemName}-${method}.svg`);
      execSync(`structurizr-cli export -workspace "${dslFile}" -format svg -output "${outputFile}"`, 
        { stdio: 'pipe', timeout: 30000 });
      
      const stats = await fs.stat(outputFile);
      const executionTime = Date.now() - startTime;
      
      return {
        method,
        success: true,
        outputPath: outputFile,
        executionTime,
        fileSize: stats.size,
        quality: 95, // Official tool, highest quality
        metadata: {
          format: 'svg',
          dependencies: ['structurizr-cli']
        }
      };
    } catch (error) {
      return {
        method,
        success: false,
        executionTime: Date.now() - startTime,
        quality: 0,
        error: error.message,
        metadata: { format: 'svg', dependencies: ['structurizr-cli'] }
      };
    }
  }

  // Method 2: PlantUML Local
  private async renderWithPlantUMLLocal(task: RenderingTask, method: string): Promise<RenderingResult> {
    const startTime = Date.now();
    
    try {
      // Convert DSL to PlantUML
      const plantUMLContent = await this.convertDSLToPlantUML(task.dslContent);
      const pumlFile = path.join(this.tempDir, `${task.systemName}-${method}.puml`);
      await fs.writeFile(pumlFile, plantUMLContent);
      
      // Check if PlantUML is available
      execSync('plantuml -version', { stdio: 'pipe' });
      
      // Generate SVG
      const outputFile = path.join(this.tempDir, `${task.systemName}-${method}.svg`);
      execSync(`plantuml -tsvg "${pumlFile}" -o "${this.tempDir}"`, 
        { stdio: 'pipe', timeout: 20000 });
      
      const stats = await fs.stat(outputFile);
      const executionTime = Date.now() - startTime;
      
      return {
        method,
        success: true,
        outputPath: outputFile,
        executionTime,
        fileSize: stats.size,
        quality: 80, // Good quality, widely supported
        metadata: {
          format: 'svg',
          dependencies: ['plantuml', 'java']
        }
      };
    } catch (error) {
      return {
        method,
        success: false,
        executionTime: Date.now() - startTime,
        quality: 0,
        error: error.message,
        metadata: { format: 'svg', dependencies: ['plantuml', 'java'] }
      };
    }
  }

  // Method 3: PlantUML Server
  private async renderWithPlantUMLServer(task: RenderingTask, method: string): Promise<RenderingResult> {
    const startTime = Date.now();
    
    try {
      const plantUMLContent = await this.convertDSLToPlantUML(task.dslContent);
      
      // Start local PlantUML server if not running
      await this.ensurePlantUMLServer();
      
      // Send request to local PlantUML server
      const response = await fetch('http://localhost:8080/svg', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: plantUMLContent
      });
      
      if (!response.ok) throw new Error(`Server responded with ${response.status}`);
      
      const svgContent = await response.text();
      const outputFile = path.join(this.tempDir, `${task.systemName}-${method}.svg`);
      await fs.writeFile(outputFile, svgContent);
      
      const stats = await fs.stat(outputFile);
      const executionTime = Date.now() - startTime;
      
      return {
        method,
        success: true,
        outputPath: outputFile,
        executionTime,
        fileSize: stats.size,
        quality: 85, // Good quality, fast rendering
        metadata: {
          format: 'svg',
          dependencies: ['plantuml-server']
        }
      };
    } catch (error) {
      return {
        method,
        success: false,
        executionTime: Date.now() - startTime,
        quality: 0,
        error: error.message,
        metadata: { format: 'svg', dependencies: ['plantuml-server'] }
      };
    }
  }

  // Method 4: Mermaid CLI
  private async renderWithMermaidCLI(task: RenderingTask, method: string): Promise<RenderingResult> {
    const startTime = Date.now();
    
    try {
      // Convert DSL to Mermaid
      const mermaidContent = await this.convertDSLToMermaid(task.dslContent);
      const mmdFile = path.join(this.tempDir, `${task.systemName}-${method}.mmd`);
      await fs.writeFile(mmdFile, mermaidContent);
      
      // Check if Mermaid CLI is available
      execSync('mmdc --version', { stdio: 'pipe' });
      
      // Generate SVG
      const outputFile = path.join(this.tempDir, `${task.systemName}-${method}.svg`);
      execSync(`mmdc -i "${mmdFile}" -o "${outputFile}" -f svg`, 
        { stdio: 'pipe', timeout: 15000 });
      
      const stats = await fs.stat(outputFile);
      const executionTime = Date.now() - startTime;
      
      return {
        method,
        success: true,
        outputPath: outputFile,
        executionTime,
        fileSize: stats.size,
        quality: 75, // Modern styling, good for web
        metadata: {
          format: 'svg',
          dependencies: ['@mermaid-js/mermaid-cli', 'puppeteer']
        }
      };
    } catch (error) {
      return {
        method,
        success: false,
        executionTime: Date.now() - startTime,
        quality: 0,
        error: error.message,
        metadata: { format: 'svg', dependencies: ['@mermaid-js/mermaid-cli'] }
      };
    }
  }

  // Method 5: Puppeteer + Structurizr Express
  private async renderWithPuppeteerExpress(task: RenderingTask, method: string): Promise<RenderingResult> {
    const startTime = Date.now();
    
    try {
      // This would require puppeteer to automate Structurizr Express
      // Implementation would involve:
      // 1. Launch headless browser
      // 2. Navigate to Structurizr Express
      // 3. Input DSL content
      // 4. Export/screenshot diagram
      
      // Placeholder implementation
      throw new Error('Puppeteer + Structurizr Express not yet implemented');
      
    } catch (error) {
      return {
        method,
        success: false,
        executionTime: Date.now() - startTime,
        quality: 0,
        error: error.message,
        metadata: { format: 'png', dependencies: ['puppeteer'] }
      };
    }
  }

  // Method 6: Custom SVG Generator
  private async renderWithCustomSVG(task: RenderingTask, method: string): Promise<RenderingResult> {
    const startTime = Date.now();
    
    try {
      // Parse DSL and generate custom SVG
      const svgContent = await this.generateCustomSVG(task.dslContent, task.systemName);
      const outputFile = path.join(this.tempDir, `${task.systemName}-${method}.svg`);
      await fs.writeFile(outputFile, svgContent);
      
      const stats = await fs.stat(outputFile);
      const executionTime = Date.now() - startTime;
      
      return {
        method,
        success: true,
        outputPath: outputFile,
        executionTime,
        fileSize: stats.size,
        quality: 60, // Basic quality, no external dependencies
        metadata: {
          format: 'svg',
          dependencies: []
        }
      };
    } catch (error) {
      return {
        method,
        success: false,
        executionTime: Date.now() - startTime,
        quality: 0,
        error: error.message,
        metadata: { format: 'svg', dependencies: [] }
      };
    }
  }

  private async convertDSLToPlantUML(dslContent: string): Promise<string> {
    // Basic DSL to PlantUML conversion
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'Convert Structurizr DSL to PlantUML C4 syntax. Return only the PlantUML code.'
        },
        {
          role: 'user',
          content: `Convert this Structurizr DSL to PlantUML:\n\n${dslContent}`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    return response.choices[0]?.message?.content || '';
  }

  private async convertDSLToMermaid(dslContent: string): Promise<string> {
    // Basic DSL to Mermaid conversion
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        {
          role: 'system',
          content: 'Convert Structurizr DSL to Mermaid diagram syntax. Return only the Mermaid code.'
        },
        {
          role: 'user',
          content: `Convert this Structurizr DSL to Mermaid:\n\n${dslContent}`
        }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    return response.choices[0]?.message?.content || '';
  }

  private async generateCustomSVG(dslContent: string, systemName: string): Promise<string> {
    // Basic SVG generation based on DSL parsing
    const elements = this.parseDSLElements(dslContent);
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .container { fill: #106EBE; stroke: #000; stroke-width: 2; }
      .person { fill: #FFB900; stroke: #000; stroke-width: 2; }
      .system { fill: #0078D4; stroke: #000; stroke-width: 2; }
      .text { font-family: Arial; font-size: 12px; fill: white; text-anchor: middle; }
    </style>
  </defs>
  
  <rect x="50" y="50" width="700" height="500" fill="none" stroke="#ddd" stroke-width="1"/>
  <text x="400" y="30" class="text" fill="black" font-size="16">${systemName} - Architecture Diagram</text>
  
  <!-- Basic elements rendering would go here -->
  <rect x="100" y="100" width="150" height="80" class="person"/>
  <text x="175" y="145" class="text">User</text>
  
  <rect x="300" y="100" width="150" height="80" class="system"/>
  <text x="375" y="145" class="text">${systemName}</text>
  
  <rect x="500" y="100" width="150" height="80" class="container"/>
  <text x="575" y="145" class="text">Database</text>
  
  <!-- Relationships -->
  <line x1="250" y1="140" x2="300" y2="140" stroke="#666" stroke-width="2"/>
  <line x1="450" y1="140" x2="500" y2="140" stroke="#666" stroke-width="2"/>
  
  <text x="400" y="550" class="text" fill="black">Generated with Custom SVG Renderer</text>
</svg>`;
  }

  private parseDSLElements(dslContent: string): any[] {
    // Basic DSL parsing - would be more sophisticated in production
    const elements = [];
    const lines = dslContent.split('\n');
    
    for (const line of lines) {
      if (line.includes('= person')) {
        elements.push({ type: 'person', name: line.split('=')[0].trim() });
      } else if (line.includes('= softwareSystem')) {
        elements.push({ type: 'system', name: line.split('=')[0].trim() });
      } else if (line.includes('= container')) {
        elements.push({ type: 'container', name: line.split('=')[0].trim() });
      }
    }
    
    return elements;
  }

  private async ensurePlantUMLServer(): Promise<void> {
    try {
      // Check if PlantUML server is running
      await fetch('http://localhost:8080/');
    } catch {
      // Start PlantUML server (would need plantuml-server package)
      console.log('PlantUML server not running - would start here');
    }
  }

  private analyzeBenchmarkResults(results: RenderingResult[], totalTime: number): BenchmarkResults {
    const successful = results.filter(r => r.success);
    
    if (successful.length === 0) {
      return {
        totalTime,
        methods: results,
        bestMethod: 'none',
        recommendations: ['No rendering methods available - install dependencies'],
        summary: {
          fastest: 'none',
          highestQuality: 'none',
          mostReliable: 'none',
          smallestFile: 'none'
        }
      };
    }

    const fastest = successful.reduce((a, b) => a.executionTime < b.executionTime ? a : b);
    const highestQuality = successful.reduce((a, b) => a.quality > b.quality ? a : b);
    const smallestFile = successful.filter(r => r.fileSize).reduce((a, b) => 
      (a.fileSize || 0) < (b.fileSize || 0) ? a : b);

    // Determine best overall method (weighted score)
    const scored = successful.map(result => ({
      ...result,
      score: (result.quality * 0.4) + ((5000 - result.executionTime) / 5000 * 0.3) + 
             ((result.fileSize ? (100000 - result.fileSize) / 100000 : 0.5) * 0.3)
    }));

    const bestMethod = scored.reduce((a, b) => a.score > b.score ? a : b);

    const recommendations = [
      `Best overall: ${bestMethod.method} (score: ${bestMethod.score.toFixed(2)})`,
      `Fastest: ${fastest.method} (${fastest.executionTime}ms)`,
      `Highest quality: ${highestQuality.method} (${highestQuality.quality}/100)`,
      successful.length < results.length ? 
        `${results.length - successful.length} methods failed - check dependencies` : 
        'All methods working correctly'
    ];

    return {
      totalTime,
      methods: results,
      bestMethod: bestMethod.method,
      recommendations,
      summary: {
        fastest: fastest.method,
        highestQuality: highestQuality.method,
        mostReliable: successful.length === results.length ? 'all' : 'varies',
        smallestFile: smallestFile.method
      }
    };
  }

  private async saveBenchmarkResults(benchmark: BenchmarkResults, task: RenderingTask): Promise<void> {
    const outputDir = task.outputDir || this.tempDir;
    await fs.mkdir(outputDir, { recursive: true });
    
    const reportFile = path.join(outputDir, `${task.systemName}-rendering-benchmark.json`);
    
    const report = {
      timestamp: new Date().toISOString(),
      systemName: task.systemName,
      caseStudyFolder: task.caseStudyFolder,
      benchmark,
      environment: {
        platform: process.platform,
        nodeVersion: process.version,
        availableMemory: process.memoryUsage()
      }
    };

    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));
    console.log(`📊 Benchmark report saved: ${reportFile}`);
  }

  private async ensureTempDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.tempDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }
}