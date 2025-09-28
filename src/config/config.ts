/**
 * Configuration Management System (2025 Standards)
 * Supports multiple sources: .env, environment variables, hardcoded defaults
 * Type-safe configuration with validation
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface AppConfig {
  // Azure AI Foundry Configuration
  azure: {
    foundry: {
      projectEndpoint: string;
      modelDeploymentName: string;
      apiVersion: string;
    };
    openai: {
      endpoint: string;
      apiKey?: string;
    };
    authentication: {
      clientId?: string;
      clientSecret?: string;
      tenantId?: string;
    };
  };

  // Application Settings
  app: {
    environment: 'development' | 'production' | 'test';
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    outputDirectory: string;
    maxTokens: number;
    temperature: number;
    timeout: number;
  };

  // Agent Configuration
  agents: {
    orchestrator: {
      enabled: boolean;
      maxRetries: number;
      temperature: number;
    };
    requirementsAnalyst: {
      enabled: boolean;
      maxTokens: number;
      temperature: number;
    };
    architecture: {
      enabled: boolean;
      maxTokens: number;
      temperature: number;
    };
    costOptimizer: {
      enabled: boolean;
      maxTokens: number;
      temperature: number;
    };
    riskAssessor: {
      enabled: boolean;
      maxTokens: number;
      temperature: number;
    };
    documentation: {
      enabled: boolean;
      maxTokens: number;
      temperature: number;
    };
  };

  // CLI Settings
  cli: {
    colorOutput: boolean;
    interactive: boolean;
    autoSave: boolean;
    defaultCommand: 'quick' | 'analyze' | 'interactive' | 'test';
  };
}

// Default configuration (hardcoded fallbacks)
const DEFAULT_CONFIG: AppConfig = {
  azure: {
    foundry: {
      projectEndpoint: 'https://kapodeistria-1337-resource.services.ai.azure.com/api/projects/kapodeistria-1337',
      modelDeploymentName: 'gpt-4.1',
      apiVersion: '2025-05-01',
    },
    openai: {
      endpoint: 'https://kapodeistria-1337-resource.cognitiveservices.azure.com',
    },
    authentication: {},
  },
  app: {
    environment: 'development',
    logLevel: 'info',
    outputDirectory: './output',
    maxTokens: 1500,
    temperature: 0.3,
    timeout: 30000, // 30 seconds
  },
  agents: {
    orchestrator: {
      enabled: true,
      maxRetries: 3,
      temperature: 0.3,
    },
    requirementsAnalyst: {
      enabled: true,
      maxTokens: 1000,
      temperature: 0.1,
    },
    architecture: {
      enabled: true,
      maxTokens: 1500,
      temperature: 0.2,
    },
    costOptimizer: {
      enabled: true,
      maxTokens: 1000,
      temperature: 0.1,
    },
    riskAssessor: {
      enabled: true,
      maxTokens: 1000,
      temperature: 0.2,
    },
    documentation: {
      enabled: true,
      maxTokens: 1500,
      temperature: 0.1,
    },
  },
  cli: {
    colorOutput: true,
    interactive: false,
    autoSave: true,
    defaultCommand: 'quick',
  },
};

class ConfigManager {
  private config: AppConfig;
  private configPath: string;

  constructor() {
    this.configPath = join(process.cwd(), '.env.local');
    this.config = this.loadConfiguration();
  }

  private loadConfiguration(): AppConfig {
    // Start with defaults
    let config = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as AppConfig;

    // 1. Load from .env.local (if exists)
    const envLocalPath = join(process.cwd(), '.env.local');
    if (existsSync(envLocalPath)) {
      this.loadEnvFile(envLocalPath, config);
    }

    // 2. Load from .env (if exists)
    const envPath = join(process.cwd(), '.env');
    if (existsSync(envPath)) {
      this.loadEnvFile(envPath, config);
    }

    // 3. Override with environment variables
    this.loadEnvironmentVariables(config);

    // 4. Validate configuration
    this.validateConfiguration(config);

    return config;
  }

  private loadEnvFile(filePath: string, config: AppConfig): void {
    try {
      const envContent = readFileSync(filePath, 'utf-8');
      const envVars = this.parseEnvFile(envContent);

      // Map environment variables to config structure
      if (envVars.PROJECT_ENDPOINT) config.azure.foundry.projectEndpoint = envVars.PROJECT_ENDPOINT;
      if (envVars.MODEL_DEPLOYMENT_NAME) config.azure.foundry.modelDeploymentName = envVars.MODEL_DEPLOYMENT_NAME;
      if (envVars.API_VERSION) config.azure.foundry.apiVersion = envVars.API_VERSION;
      if (envVars.AZURE_OPENAI_ENDPOINT) config.azure.openai.endpoint = envVars.AZURE_OPENAI_ENDPOINT;
      if (envVars.AZURE_OPENAI_API_KEY) config.azure.openai.apiKey = envVars.AZURE_OPENAI_API_KEY;
      if (envVars.AZURE_CLIENT_ID) config.azure.authentication.clientId = envVars.AZURE_CLIENT_ID;
      if (envVars.AZURE_CLIENT_SECRET) config.azure.authentication.clientSecret = envVars.AZURE_CLIENT_SECRET;
      if (envVars.AZURE_TENANT_ID) config.azure.authentication.tenantId = envVars.AZURE_TENANT_ID;
      if (envVars.NODE_ENV) config.app.environment = envVars.NODE_ENV as any;
      if (envVars.LOG_LEVEL) config.app.logLevel = envVars.LOG_LEVEL as any;
      if (envVars.OUTPUT_DIRECTORY) config.app.outputDirectory = envVars.OUTPUT_DIRECTORY;
      if (envVars.MAX_TOKENS) config.app.maxTokens = parseInt(envVars.MAX_TOKENS);
      if (envVars.TEMPERATURE) config.app.temperature = parseFloat(envVars.TEMPERATURE);
      if (envVars.TIMEOUT) config.app.timeout = parseInt(envVars.TIMEOUT);
    } catch (error) {
      console.warn(`Warning: Could not load ${filePath}:`, error);
    }
  }

  private parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["'](.*)["']$/, '$1');
          result[key.trim()] = value;
        }
      }
    }

    return result;
  }

  private loadEnvironmentVariables(config: AppConfig): void {
    // Override with actual environment variables (highest priority)
    if (process.env.PROJECT_ENDPOINT) config.azure.foundry.projectEndpoint = process.env.PROJECT_ENDPOINT;
    if (process.env.MODEL_DEPLOYMENT_NAME) config.azure.foundry.modelDeploymentName = process.env.MODEL_DEPLOYMENT_NAME;
    if (process.env.API_VERSION) config.azure.foundry.apiVersion = process.env.API_VERSION;
    if (process.env.AZURE_OPENAI_ENDPOINT) config.azure.openai.endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    if (process.env.AZURE_OPENAI_API_KEY) config.azure.openai.apiKey = process.env.AZURE_OPENAI_API_KEY;
    if (process.env.AZURE_CLIENT_ID) config.azure.authentication.clientId = process.env.AZURE_CLIENT_ID;
    if (process.env.AZURE_CLIENT_SECRET) config.azure.authentication.clientSecret = process.env.AZURE_CLIENT_SECRET;
    if (process.env.AZURE_TENANT_ID) config.azure.authentication.tenantId = process.env.AZURE_TENANT_ID;
    if (process.env.NODE_ENV) config.app.environment = process.env.NODE_ENV as any;
    if (process.env.LOG_LEVEL) config.app.logLevel = process.env.LOG_LEVEL as any;
    if (process.env.OUTPUT_DIRECTORY) config.app.outputDirectory = process.env.OUTPUT_DIRECTORY;
    if (process.env.MAX_TOKENS) config.app.maxTokens = parseInt(process.env.MAX_TOKENS);
    if (process.env.TEMPERATURE) config.app.temperature = parseFloat(process.env.TEMPERATURE);
    if (process.env.TIMEOUT) config.app.timeout = parseInt(process.env.TIMEOUT);
  }

  private validateConfiguration(config: AppConfig): void {
    // Required fields validation
    if (!config.azure.foundry.projectEndpoint) {
      throw new Error('PROJECT_ENDPOINT is required');
    }

    if (!config.azure.foundry.modelDeploymentName) {
      throw new Error('MODEL_DEPLOYMENT_NAME is required');
    }

    // Validate numeric ranges
    if (config.app.temperature < 0 || config.app.temperature > 2) {
      throw new Error('TEMPERATURE must be between 0 and 2');
    }

    if (config.app.maxTokens < 1 || config.app.maxTokens > 4000) {
      throw new Error('MAX_TOKENS must be between 1 and 4000');
    }

    // Validate enum values
    const validEnvironments = ['development', 'production', 'test'];
    if (!validEnvironments.includes(config.app.environment)) {
      throw new Error(`NODE_ENV must be one of: ${validEnvironments.join(', ')}`);
    }

    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(config.app.logLevel)) {
      throw new Error(`LOG_LEVEL must be one of: ${validLogLevels.join(', ')}`);
    }
  }

  // Public API
  public get(): AppConfig {
    return this.config;
  }

  public set(path: string, value: any): void {
    const keys = path.split('.');
    let current = this.config as any;

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
  }

  public reload(): AppConfig {
    this.config = this.loadConfiguration();
    return this.config;
  }

  public isProduction(): boolean {
    return this.config.app.environment === 'production';
  }

  public isDevelopment(): boolean {
    return this.config.app.environment === 'development';
  }

  public getAzureConfig() {
    return this.config.azure;
  }

  public getAgentConfig(agentName: keyof AppConfig['agents']) {
    return this.config.agents[agentName];
  }

  // Generate configuration files
  public generateEnvTemplate(): string {
    return `# Azure AI Foundry Configuration
PROJECT_ENDPOINT=${this.config.azure.foundry.projectEndpoint}
MODEL_DEPLOYMENT_NAME=${this.config.azure.foundry.modelDeploymentName}
API_VERSION=${this.config.azure.foundry.apiVersion}

# Azure OpenAI Configuration  
AZURE_OPENAI_ENDPOINT=${this.config.azure.openai.endpoint}
AZURE_OPENAI_API_KEY=your_api_key_here

# Optional: Azure Authentication (if not using Azure CLI)
# AZURE_CLIENT_ID=your_client_id
# AZURE_CLIENT_SECRET=your_client_secret  
# AZURE_TENANT_ID=your_tenant_id

# Application Settings
NODE_ENV=${this.config.app.environment}
LOG_LEVEL=${this.config.app.logLevel}
OUTPUT_DIRECTORY=${this.config.app.outputDirectory}
MAX_TOKENS=${this.config.app.maxTokens}
TEMPERATURE=${this.config.app.temperature}
TIMEOUT=${this.config.app.timeout}

# CLI Settings  
COLOR_OUTPUT=${this.config.cli.colorOutput}
INTERACTIVE=${this.config.cli.interactive}
AUTO_SAVE=${this.config.cli.autoSave}
DEFAULT_COMMAND=${this.config.cli.defaultCommand}`;
  }
}

// Singleton instance
export const config = new ConfigManager();

// Export types for external use
export type { AppConfig };
export default config;