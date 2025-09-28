/**
 * Enhanced Progress Tracker for Multi-Agent Analysis
 * Provides real-time progress updates with beautiful animations
 */

import ora from 'ora';
import chalk from 'chalk';

export class ProgressTracker {
  private currentStep = 0;
  private totalSteps = 5;
  private spinner: any;
  private startTime: number;
  
  private steps = [
    { name: 'Requirements Analysis', icon: '📋', color: 'blue' },
    { name: 'Architecture Design', icon: '🏗️', color: 'cyan' },
    { name: 'Visual Diagrams', icon: '🎨', color: 'magenta' },
    { name: 'Parallel Analysis', icon: '⚡', color: 'yellow' },
    { name: 'Report Generation', icon: '📝', color: 'green' }
  ];

  constructor() {
    this.startTime = Date.now();
  }

  start(message: string = 'Initializing Azure Architecture Blueprint Generator...') {
    this.spinner = ora({
      text: message,
      spinner: 'aesthetic',
      color: 'blue'
    }).start();
  }

  nextStep(stepMessage?: string) {
    this.currentStep++;
    const step = this.steps[this.currentStep - 1];
    
    if (step) {
      const progress = `[${this.currentStep}/${this.totalSteps}]`;
      const message = stepMessage || step.name;
      
      this.spinner.text = `${step.icon} ${chalk.cyan(progress)} ${message}...`;
      this.spinner.color = step.color as any;
    }
  }

  updateStep(message: string) {
    if (this.spinner) {
      const step = this.steps[this.currentStep - 1];
      const progress = `[${this.currentStep}/${this.totalSteps}]`;
      this.spinner.text = `${step?.icon || '⚙️'} ${chalk.cyan(progress)} ${message}...`;
    }
  }

  succeed(message?: string) {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const finalMessage = message || `Analysis completed successfully in ${elapsed}s`;
    
    if (this.spinner) {
      this.spinner.succeed(chalk.green(`🎉 ${finalMessage}`));
    }
  }

  fail(message?: string) {
    const elapsed = Math.round((Date.now() - this.startTime) / 1000);
    const finalMessage = message || `Analysis failed after ${elapsed}s`;
    
    if (this.spinner) {
      this.spinner.fail(chalk.red(`❌ ${finalMessage}`));
    }
  }

  warn(message: string) {
    if (this.spinner) {
      this.spinner.warn(chalk.yellow(`⚠️ ${message}`));
    }
  }

  getElapsedTime(): number {
    return Date.now() - this.startTime;
  }

  getProgressPercentage(): number {
    return Math.round((this.currentStep / this.totalSteps) * 100);
  }

  getCurrentStep(): string {
    const step = this.steps[this.currentStep - 1];
    return step ? step.name : 'Unknown';
  }
}