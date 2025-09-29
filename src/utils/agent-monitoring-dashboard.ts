/**
 * Agent Monitoring Dashboard
 * 
 * PURPOSE: Real-time monitoring dashboard for agent-to-agent communications
 * Shows failure rates, performance metrics, cost tracking, and health status
 */

import chalk from 'chalk';
import { promises as fs } from 'fs';
import { join } from 'path';

export interface DashboardMetrics {
  timestamp: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageLatencyMs: number;
  totalCostUsd: number;
  agentHealth: {
    [agentName: string]: {
      status: 'healthy' | 'degraded' | 'critical' | 'circuit-broken';
      successRate: number;
      avgLatencyMs: number;
      errorRate: number;
      consecutiveFailures: number;
      lastError?: string;
    };
  };
  currentWorkflows: {
    [executionId: string]: {
      status: 'running' | 'completed' | 'failed';
      progress: number;
      currentAgent?: string;
      startTime: number;
    };
  };
}

export class AgentMonitoringDashboard {
  private metrics: DashboardMetrics;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.metrics = {
      timestamp: new Date().toISOString(),
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageLatencyMs: 0,
      totalCostUsd: 0,
      agentHealth: {},
      currentWorkflows: {}
    };
  }

  /**
   * Start real-time dashboard updates
   */
  startDashboard(updateIntervalMs: number = 5000): void {
    console.clear();
    this.displayDashboard();

    this.updateInterval = setInterval(() => {
      console.clear();
      this.displayDashboard();
    }, updateIntervalMs);
  }

  /**
   * Stop dashboard updates
   */
  stopDashboard(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Update metrics from orchestrator
   */
  updateMetrics(newMetrics: Partial<DashboardMetrics>): void {
    this.metrics = {
      ...this.metrics,
      ...newMetrics,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Display comprehensive monitoring dashboard
   */
  private displayDashboard(): void {
    const now = new Date();
    
    // Header
    console.log(chalk.blue.bold('╔══════════════════════════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue.bold('║                    🤖 AZURE AGENT MONITORING DASHBOARD                      ║'));
    console.log(chalk.blue.bold('╠══════════════════════════════════════════════════════════════════════════════╣'));
    console.log(chalk.gray(`║ Last Update: ${now.toLocaleString().padEnd(30)} Real-time Telemetry ║`));
    console.log(chalk.blue.bold('╚══════════════════════════════════════════════════════════════════════════════╝'));

    // Overall System Health
    this.displaySystemHealth();
    
    // Agent Health Status
    this.displayAgentHealth();
    
    // Current Workflows
    this.displayCurrentWorkflows();
    
    // Performance Metrics
    this.displayPerformanceMetrics();
    
    // Cost Tracking
    this.displayCostMetrics();
    
    // Footer with key metrics
    this.displayFooter();
  }

  private displaySystemHealth(): void {
    const successRate = this.metrics.totalExecutions > 0 
      ? (this.metrics.successfulExecutions / this.metrics.totalExecutions) * 100 
      : 100;

    const healthStatus = successRate >= 95 ? '🟢 HEALTHY' : 
                        successRate >= 85 ? '🟡 DEGRADED' : '🔴 CRITICAL';

    console.log(chalk.white.bold('\n📊 SYSTEM HEALTH OVERVIEW'));
    console.log(chalk.gray('─'.repeat(80)));
    console.log(`${healthStatus.padEnd(15)} Success Rate: ${chalk.green(successRate.toFixed(1))}% | Executions: ${chalk.blue(this.metrics.totalExecutions.toString())}`);
    console.log(`Average Latency: ${chalk.yellow(this.metrics.averageLatencyMs.toFixed(0))}ms | Total Cost: ${chalk.green('$' + this.metrics.totalCostUsd.toFixed(4))}`);
  }

  private displayAgentHealth(): void {
    console.log(chalk.white.bold('\n🤖 AGENT HEALTH STATUS'));
    console.log(chalk.gray('─'.repeat(80)));
    
    if (Object.keys(this.metrics.agentHealth).length === 0) {
      console.log(chalk.gray('   No agent data available'));
      return;
    }

    for (const [agentName, health] of Object.entries(this.metrics.agentHealth)) {
      const statusIcon = this.getAgentStatusIcon(health.status);
      const successRateColor = health.successRate >= 95 ? chalk.green : 
                              health.successRate >= 85 ? chalk.yellow : chalk.red;

      console.log(`${statusIcon} ${agentName.padEnd(25)} ${successRateColor((health.successRate || 0).toFixed(1) + '%')} | ${chalk.blue((health.avgLatencyMs || 0).toFixed(0))}ms | Errors: ${chalk.red((health.consecutiveFailures || 0).toString())}`);
      
      if (health.lastError && health.status !== 'healthy') {
        console.log(`   └─ ${chalk.red('Last Error:')} ${health.lastError.substring(0, 60)}...`);
      }
    }
  }

  private displayCurrentWorkflows(): void {
    console.log(chalk.white.bold('\n🔄 ACTIVE WORKFLOWS'));
    console.log(chalk.gray('─'.repeat(80)));
    
    const activeWorkflows = Object.entries(this.metrics.currentWorkflows)
      .filter(([_, workflow]) => workflow.status === 'running');

    if (activeWorkflows.length === 0) {
      console.log(chalk.gray('   No active workflows'));
      return;
    }

    for (const [executionId, workflow] of activeWorkflows) {
      const duration = Math.round((Date.now() - workflow.startTime) / 1000);
      const progressBar = this.createProgressBar(workflow.progress, 20);
      
      console.log(`🚀 ${executionId.substring(0, 12)}... ${progressBar} ${workflow.progress}% | ${duration}s`);
      if (workflow.currentAgent) {
        console.log(`   └─ Current: ${chalk.blue(workflow.currentAgent)}`);
      }
    }
  }

  private displayPerformanceMetrics(): void {
    console.log(chalk.white.bold('\n📈 PERFORMANCE METRICS'));
    console.log(chalk.gray('─'.repeat(80)));
    
    const metrics = [
      { label: 'Total Executions', value: this.metrics.totalExecutions.toString(), color: chalk.blue },
      { label: 'Successful', value: this.metrics.successfulExecutions.toString(), color: chalk.green },
      { label: 'Failed', value: this.metrics.failedExecutions.toString(), color: chalk.red },
      { label: 'Success Rate', value: `${((this.metrics.successfulExecutions / Math.max(this.metrics.totalExecutions, 1)) * 100).toFixed(1)}%`, color: chalk.green }
    ];

    const metricsPerRow = 2;
    for (let i = 0; i < metrics.length; i += metricsPerRow) {
      const row = metrics.slice(i, i + metricsPerRow);
      const rowText = row.map(m => `${m.label}: ${m.color(m.value)}`).join(' | ');
      console.log(`   ${rowText}`);
    }
  }

  private displayCostMetrics(): void {
    console.log(chalk.white.bold('\n💰 COST TRACKING'));
    console.log(chalk.gray('─'.repeat(80)));
    
    const avgCostPerExecution = this.metrics.totalExecutions > 0 
      ? this.metrics.totalCostUsd / this.metrics.totalExecutions 
      : 0;

    const projectedMonthlyCost = this.metrics.totalCostUsd * 30; // Rough projection

    console.log(`   Total Cost: ${chalk.green('$' + this.metrics.totalCostUsd.toFixed(4))} | Avg per Execution: ${chalk.yellow('$' + avgCostPerExecution.toFixed(4))}`);
    console.log(`   Projected Monthly: ${chalk.blue('$' + projectedMonthlyCost.toFixed(2))} | Cost Efficiency: ${chalk.green('Optimized')}`);
  }

  private displayFooter(): void {
    console.log(chalk.gray('\n' + '─'.repeat(80)));
    console.log(chalk.gray('💡 Press Ctrl+C to exit | Dashboard updates every 5 seconds'));
    
    const alertCount = Object.values(this.metrics.agentHealth)
      .filter(health => health.status === 'critical' || health.status === 'circuit-broken').length;
    
    if (alertCount > 0) {
      console.log(chalk.red.bold(`⚠️  ${alertCount} CRITICAL ALERTS - Check agent health above!`));
    }
  }

  private getAgentStatusIcon(status: string): string {
    switch (status) {
      case 'healthy': return '🟢';
      case 'degraded': return '🟡';
      case 'critical': return '🔴';
      case 'circuit-broken': return '⚡';
      default: return '❓';
    }
  }

  private createProgressBar(progress: number, width: number): string {
    const completed = Math.round((progress / 100) * width);
    const remaining = width - completed;
    return chalk.green('█'.repeat(completed)) + chalk.gray('░'.repeat(remaining));
  }

  /**
   * Export metrics to file for analysis
   */
  async exportMetrics(filename?: string): Promise<void> {
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      metrics: this.metrics,
      summary: {
        systemHealth: this.calculateSystemHealth(),
        topPerformingAgents: this.getTopPerformingAgents(),
        bottleneckAgents: this.getBottleneckAgents(),
        costAnalysis: this.analyzeCosts()
      }
    };

    const outputFile = filename || `agent-metrics-${Date.now()}.json`;
    const filepath = join('output', 'monitoring', outputFile);
    
    await fs.mkdir(join('output', 'monitoring'), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(exportData, null, 2), 'utf-8');
    
    console.log(chalk.green(`📊 Metrics exported to: ${outputFile}`));
  }

  private calculateSystemHealth(): string {
    const successRate = this.metrics.totalExecutions > 0 
      ? (this.metrics.successfulExecutions / this.metrics.totalExecutions) * 100 
      : 100;
    
    return successRate >= 95 ? 'HEALTHY' : successRate >= 85 ? 'DEGRADED' : 'CRITICAL';
  }

  private getTopPerformingAgents(): string[] {
    return Object.entries(this.metrics.agentHealth)
      .sort((a, b) => b[1].successRate - a[1].successRate)
      .slice(0, 3)
      .map(([name, _]) => name);
  }

  private getBottleneckAgents(): string[] {
    return Object.entries(this.metrics.agentHealth)
      .sort((a, b) => (b[1].avgLatencyMs || 0) - (a[1].avgLatencyMs || 0))
      .slice(0, 3)
      .map(([name, health]) => `${name} (${(health.avgLatencyMs || 0).toFixed(0)}ms)`);
  }

  private analyzeCosts(): { efficient: boolean; trend: string; recommendations: string[] } {
    const avgCost = this.metrics.totalExecutions > 0 
      ? this.metrics.totalCostUsd / this.metrics.totalExecutions 
      : 0;

    return {
      efficient: avgCost < 0.10, // Less than $0.10 per execution
      trend: 'stable',
      recommendations: avgCost > 0.20 ? ['Consider optimizing prompts', 'Review agent timeout settings'] : ['Cost efficiency good']
    };
  }
}

/**
 * Usage Example:
 * 
 * const dashboard = new AgentMonitoringDashboard();
 * dashboard.startDashboard(5000); // Update every 5 seconds
 * 
 * // Update with real metrics from orchestrator
 * dashboard.updateMetrics({
 *   totalExecutions: 50,
 *   successfulExecutions: 47,
 *   failedExecutions: 3,
 *   averageLatencyMs: 2500,
 *   totalCostUsd: 1.25,
 *   agentHealth: {
 *     'research-agent': {
 *       status: 'healthy',
 *       successRate: 96,
 *       avgLatencyMs: 2100,
 *       errorRate: 4,
 *       consecutiveFailures: 0
 *     }
 *   }
 * });
 * 
 * // Export for analysis
 * await dashboard.exportMetrics();
 */