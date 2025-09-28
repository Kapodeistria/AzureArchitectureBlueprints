#!/usr/bin/env tsx
/**
 * Test that the app properly exits after completion
 */

import { InterviewCLI } from './src/cli/interview-cli.js';

console.log('🧪 Testing CLI Cleanup Behavior\n');

// Mock process.argv to simulate the 'status' command
const originalArgv = process.argv;
process.argv = ['node', 'test-cleanup.ts', 'status'];

try {
  const cli = new InterviewCLI();
  
  console.log('📋 Running status command to test cleanup...');
  cli.run();
  
  // The process should exit automatically after status completes
  // If we reach here after 5 seconds, the cleanup didn't work
  setTimeout(() => {
    console.log('❌ CLEANUP TEST FAILED: Process did not exit after 5 seconds');
    process.exit(1);
  }, 5000);
  
} catch (error) {
  console.error('❌ CLI Test failed:', error);
  process.argv = originalArgv;
  process.exit(1);
}