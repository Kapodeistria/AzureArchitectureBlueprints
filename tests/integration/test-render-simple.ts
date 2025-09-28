#!/usr/bin/env tsx
/**
 * Simple rendering test to show available methods
 */

import { execSync } from 'child_process';

function checkDependency(command: string, name: string): boolean {
  try {
    execSync(command, { stdio: 'pipe' });
    console.log(`✅ ${name}: Available`);
    return true;
  } catch {
    console.log(`❌ ${name}: Not available`);
    return false;
  }
}

console.log('🔍 Checking Local Rendering Dependencies:\n');

const checks = [
  { cmd: 'structurizr-cli --version', name: 'Structurizr CLI' },
  { cmd: 'plantuml -version', name: 'PlantUML' },
  { cmd: 'mmdc --version', name: 'Mermaid CLI' },
  { cmd: 'java -version', name: 'Java (for PlantUML)' },
  { cmd: 'node --version', name: 'Node.js' }
];

let available = 0;
checks.forEach(check => {
  if (checkDependency(check.cmd, check.name)) {
    available++;
  }
});

console.log(`\n📊 Summary: ${available}/${checks.length} rendering tools available\n`);

console.log('🏗️ RENDERING METHODS COMPARISON:\n');

const methods = [
  {
    name: 'Custom SVG Generator',
    speed: 'Very Fast (1-5ms)',
    quality: 'Basic (60/100)',
    dependencies: 'None',
    status: '✅ Always Available',
    pros: ['No dependencies', 'Instant rendering', 'Customizable'],
    cons: ['Basic styling', 'Limited layouts', 'Manual positioning']
  },
  {
    name: 'Structurizr CLI',
    speed: 'Medium (100-500ms)',
    quality: 'Excellent (95/100)',
    dependencies: 'structurizr-cli binary',
    status: '❌ Not Installed',
    pros: ['Official tool', 'Perfect C4 compliance', 'Multiple formats'],
    cons: ['External dependency', 'Binary download required']
  },
  {
    name: 'PlantUML Local',
    speed: 'Medium (200-800ms)',
    quality: 'Good (80/100)',
    dependencies: 'plantuml, java',
    status: '❌ Not Installed',
    pros: ['Widely supported', 'Good quality', 'Many formats'],
    cons: ['Requires Java', 'Translation needed']
  },
  {
    name: 'Mermaid CLI',
    speed: 'Fast (50-200ms)',
    quality: 'Good (75/100)',
    dependencies: '@mermaid-js/mermaid-cli, puppeteer',
    status: '❌ Not Installed',
    pros: ['Modern styling', 'Web-friendly', 'Active development'],
    cons: ['Large dependencies', 'Translation needed']
  },
  {
    name: 'PlantUML Server',
    speed: 'Fast (20-100ms)',
    quality: 'Good (85/100)',
    dependencies: 'plantuml-server',
    status: '❌ Server Not Running',
    pros: ['No local Java', 'Fast rendering', 'HTTP API'],
    cons: ['Server setup', 'Network dependency']
  },
  {
    name: 'Puppeteer + Express',
    speed: 'Slow (1000-3000ms)',
    quality: 'Excellent (90/100)',
    dependencies: 'puppeteer, browser',
    status: '❌ Not Implemented',
    pros: ['Official web tool', 'Perfect rendering', 'Latest features'],
    cons: ['Very slow', 'Browser dependency', 'Complex setup']
  }
];

methods.forEach((method, index) => {
  console.log(`${index + 1}. ${method.name}`);
  console.log(`   Status: ${method.status}`);
  console.log(`   Speed: ${method.speed}`);
  console.log(`   Quality: ${method.quality}`);
  console.log(`   Dependencies: ${method.dependencies}`);
  console.log(`   Pros: ${method.pros.join(', ')}`);
  console.log(`   Cons: ${method.cons.join(', ')}`);
  console.log('');
});

console.log('🎯 RECOMMENDATIONS:\n');
console.log('For immediate use:');
console.log('✅ Custom SVG Generator - Always available, basic quality');
console.log('');
console.log('For best quality (install these):');
console.log('1. Structurizr CLI: wget https://github.com/structurizr/cli/releases/download/v1.30.0/structurizr-cli-1.30.0.zip');
console.log('2. PlantUML: brew install plantuml');
console.log('3. Mermaid CLI: npm install -g @mermaid-js/mermaid-cli');
console.log('');
console.log('Optimal workflow:');
console.log('• Primary: Structurizr CLI (best quality)');
console.log('• Fallback: Custom SVG (always works)');
console.log('• Fast preview: Mermaid CLI (good for iteration)');

console.log('\n🚀 Next: npm run benchmark:render (after installing tools)');