#!/usr/bin/env tsx
/**
 * Test that the local command properly exits after completion
 */

import { InterviewCLI } from './src/cli/interview-cli.js';

console.log('🧪 Testing Local Command Cleanup Behavior\n');

// Mock process.argv to simulate the analyze command with file input
const originalArgv = process.argv;
process.argv = ['node', 'test-local-cleanup.ts', 'analyze', '--input', 'case-study-test.txt'];

try {
  const cli = new InterviewCLI();
  
  console.log('📋 Running analyze command with test case study...');
  console.log('🔄 This should complete and exit automatically\n');
  
  cli.run();
  
  // The process should exit automatically after analysis completes
  // If we reach here after 30 seconds, something is wrong
  setTimeout(() => {
    console.log('❌ CLEANUP TEST FAILED: Process did not exit after 30 seconds');
    console.log('This indicates the process hanging issue is still present');
    process.exit(1);
  }, 30000);
  
} catch (error) {
  console.error('❌ CLI Test failed:', error);
  process.argv = originalArgv;
  process.exit(1);
}