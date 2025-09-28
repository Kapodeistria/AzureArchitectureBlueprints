#!/usr/bin/env tsx
/**
 * Test that Structurizr DSL files are saved in the case study folder
 */

import { promises as fs } from 'fs';
import path from 'path';

async function testOutputOrganization() {
  console.log('🧪 Testing Output Organization...\n');

  try {
    const outputDir = path.join(process.cwd(), 'output');
    
    // Check if output directory exists
    try {
      await fs.access(outputDir);
      console.log('✅ Output directory exists');
    } catch {
      console.log('❌ Output directory does not exist');
      return;
    }

    // List case study folders
    const folders = await fs.readdir(outputDir, { withFileTypes: true });
    const caseStudyFolders = folders
      .filter(f => f.isDirectory() && f.name.startsWith('case-study-'))
      .sort((a, b) => b.name.localeCompare(a.name)); // Most recent first

    console.log(`📁 Found ${caseStudyFolders.length} case study folders:`);
    
    if (caseStudyFolders.length === 0) {
      console.log('ℹ️  No case study folders found. Run npm run quick first to generate a case study.');
      return;
    }

    // Check the most recent folder
    const latestFolder = caseStudyFolders[0];
    const folderPath = path.join(outputDir, latestFolder.name);
    
    console.log(`\n🔍 Examining latest folder: ${latestFolder.name}`);
    
    const files = await fs.readdir(folderPath);
    console.log('\n📄 Files in case study folder:');
    
    let hasStructurizrFiles = false;
    
    for (const file of files) {
      const emoji = file.endsWith('.dsl') ? '🏗️' : 
                   file.endsWith('.json') ? '⚙️' : 
                   file.endsWith('.md') ? '📄' : '📝';
      console.log(`  ${emoji} ${file}`);
      
      if (file.includes('structurizr')) {
        hasStructurizrFiles = true;
      }
    }

    console.log('\n🎯 INTEGRATION STATUS:');
    if (hasStructurizrFiles) {
      console.log('✅ Structurizr DSL files are properly organized with case study');
      console.log('✅ Output structure is working correctly');
      
      // Show DSL file content preview
      const dslFile = files.find(f => f.endsWith('.dsl'));
      if (dslFile) {
        console.log(`\n🏗️ DSL File Preview (${dslFile}):`);
        const dslPath = path.join(folderPath, dslFile);
        const dslContent = await fs.readFile(dslPath, 'utf-8');
        console.log('---'.repeat(15));
        console.log(dslContent.split('\n').slice(0, 10).join('\n'));
        console.log('...');
        console.log('---'.repeat(15));
      }
      
    } else {
      console.log('⚠️  No Structurizr files found in case study folder');
      console.log('ℹ️  Run npm run quick to generate a complete analysis with DSL diagrams');
    }

    console.log('\n📊 EXPECTED OUTPUT STRUCTURE:');
    console.log('case-study-YYYY-MM-DDTHH-MM-SS-title/');
    console.log('├── original-case-study.md');
    console.log('├── solution-YYYY-MM-DDTHH-MM-SS.md');
    console.log('├── metadata-YYYY-MM-DDTHH-MM-SS.json');
    console.log('├── performance-report-YYYY-MM-DDTHH-MM-SS.json');
    console.log('├── SystemName-structurizr-diagram.dsl     🎯 NEW!');
    console.log('├── SystemName-structurizr-metadata.json  🎯 NEW!');
    console.log('└── agent-debug/');

  } catch (error) {
    console.error('💥 Test failed:', error.message);
  }
}

testOutputOrganization();