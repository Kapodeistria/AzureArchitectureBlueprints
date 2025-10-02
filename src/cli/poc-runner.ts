#!/usr/bin/env tsx
/**
 * Non-interactive helper used by the PoC automation flow.
 * Runs the multi-agent analysis from a case study file and emits
 * locations for downstream publishing automation.
 */

import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { MultiAgentSystem } from '../core/multi-agent-system.js';

interface PocRunnerOptions {
  inputPath: string;
  copyTarget?: string;
  emitJson: boolean;
}

function parseArgs(argv: string[]): PocRunnerOptions {
  const options: PocRunnerOptions = {
    inputPath: 'case-study.txt',
    emitJson: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--input':
      case '-i':
        options.inputPath = argv[++i] ?? options.inputPath;
        break;
      case '--copy-to':
        options.copyTarget = argv[++i];
        break;
      case '--json':
        options.emitJson = true;
        break;
      default:
        console.warn(chalk.yellow(`⚠️  Unrecognised argument ignored: ${arg}`));
        break;
    }
  }

  return options;
}

async function ensureFileExists(filePath: string) {
  try {
    await fs.access(filePath);
  } catch (error) {
    throw new Error(`Input case study not found: ${filePath}`);
  }
}

async function copyOutputFolder(sourceFile: string, destinationRoot: string) {
  const sourceDir = path.dirname(sourceFile);
  const destinationDir = path.join(destinationRoot, path.basename(sourceDir));
  await fs.mkdir(destinationRoot, { recursive: true });
  await fs.cp(sourceDir, destinationDir, { recursive: true });
  return destinationDir;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  await ensureFileExists(options.inputPath);

  const caseStudyText = await fs.readFile(options.inputPath, 'utf-8');
  if (!caseStudyText.trim()) {
    throw new Error('Input case study file is empty.');
  }

  console.log(chalk.blue('ℹ️  Initialising multi-agent system...'));
  const system = new MultiAgentSystem();

  console.log(chalk.blue('🚀 Running case study analysis...'));
  const result = await system.processCaseStudyWithContent(caseStudyText);

  console.log(chalk.green(`✅ Analysis complete. Primary report: ${result.savedPath}`));

  let copiedFolder: string | undefined;
  if (options.copyTarget) {
    copiedFolder = await copyOutputFolder(result.savedPath, options.copyTarget);
    console.log(chalk.green(`📁 Output folder copied to: ${copiedFolder}`));
  }

  const payload = {
    savedPath: result.savedPath,
    outputFolder: path.dirname(result.savedPath),
    copiedFolder: copiedFolder ?? null
  };

  if (options.emitJson) {
    console.log(JSON.stringify(payload, null, 2));
  }
}

main().catch((error) => {
  console.error(chalk.red('❌ PoC runner failed:'), error.message ?? error);
  process.exitCode = 1;
});
