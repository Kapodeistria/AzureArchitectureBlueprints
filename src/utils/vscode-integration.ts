#!/usr/bin/env tsx
/**
 * VS Code Integration for Multi-Agent Interview System
 * Provides real-time preview and workspace integration
 */

import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import chalk from 'chalk';
import { MultiAgentSystem } from './multi-agent-system.js';

const execAsync = promisify(exec);

interface VSCodeWorkspace {
  folders: { path: string }[];
  settings: Record<string, any>;
  extensions: {
    recommendations: string[];
  };
}

class VSCodeIntegration {
  private system: MultiAgentSystem;
  private workspaceDir: string;
  private outputDir: string;

  constructor() {
    this.system = new MultiAgentSystem();
    this.workspaceDir = process.cwd();
    this.outputDir = path.join(this.workspaceDir, 'interview-output');
  }

  async setupWorkspace(): Promise<void> {
    console.log(chalk.blue('🔧 Setting up VS Code workspace for interview...'));

    // Create output directory
    await fs.mkdir(this.outputDir, { recursive: true });

    // Create VS Code workspace configuration
    const workspaceConfig: VSCodeWorkspace = {
      folders: [
        { path: "." }
      ],
      settings: {
        "files.associations": {
          "*.md": "markdown"
        },
        "markdown.preview.doubleClickToSwitchToEditor": false,
        "markdown.preview.markEditorSelection": true,
        "workbench.editor.enablePreview": false,
        "explorer.confirmDelete": false,
        "files.autoSave": "onWindowChange",
        "markdown.extension.toc.updateOnSave": true,
        "markdown.extension.preview.autoShowPreviewToSide": true
      },
      extensions: {
        recommendations: [
          "ms-vscode.vscode-json",
          "yzhang.markdown-all-in-one",
          "bierner.markdown-mermaid",
          "ms-vscode.vscode-typescript-next",
          "bradlc.vscode-tailwindcss",
          "esbenp.prettier-vscode"
        ]
      }
    };

    const workspaceFile = path.join(this.workspaceDir, 'interview-assistant.code-workspace');
    await fs.writeFile(workspaceFile, JSON.stringify(workspaceConfig, null, 2));

    // Create keybindings configuration
    const keybindings = [
      {
        "key": "ctrl+shift+i",
        "command": "workbench.action.terminal.sendSequence",
        "args": {
          "text": "npm run quick\n"
        },
        "when": "terminalFocus"
      },
      {
        "key": "ctrl+shift+a",
        "command": "workbench.action.terminal.sendSequence",
        "args": {
          "text": "npm run analyze -- --clipboard --copy\n"
        }
      },
      {
        "key": "ctrl+shift+t",
        "command": "workbench.action.terminal.sendSequence",
        "args": {
          "text": "npm test\n"
        }
      }
    ];

    const vscodeDir = path.join(this.workspaceDir, '.vscode');
    await fs.mkdir(vscodeDir, { recursive: true });
    await fs.writeFile(
      path.join(vscodeDir, 'keybindings.json'),
      JSON.stringify(keybindings, null, 2)
    );

    // Create tasks configuration
    const tasks = {
      "version": "2.0.0",
      "tasks": [
        {
          "label": "Quick Analysis",
          "type": "shell",
          "command": "npm run quick",
          "group": "build",
          "presentation": {
            "echo": true,
            "reveal": "always",
            "focus": false,
            "panel": "shared"
          },
          "problemMatcher": []
        },
        {
          "label": "Analyze from Clipboard",
          "type": "shell",
          "command": "npm run analyze -- --clipboard --copy",
          "group": "build",
          "presentation": {
            "echo": true,
            "reveal": "always",
            "focus": false,
            "panel": "shared"
          }
        },
        {
          "label": "Interactive Mode",
          "type": "shell",
          "command": "npm run interactive",
          "group": "build",
          "presentation": {
            "echo": true,
            "reveal": "always",
            "focus": true,
            "panel": "shared"
          }
        },
        {
          "label": "Test System",
          "type": "shell",
          "command": "npm run test-system",
          "group": "test",
          "presentation": {
            "echo": true,
            "reveal": "always",
            "focus": false,
            "panel": "shared"
          }
        }
      ]
    };

    await fs.writeFile(
      path.join(vscodeDir, 'tasks.json'),
      JSON.stringify(tasks, null, 2)
    );

    // Create launch configuration for debugging
    const launch = {
      "version": "0.2.0",
      "configurations": [
        {
          "name": "Debug Multi-Agent System",
          "type": "node",
          "request": "launch",
          "program": "${workspaceFolder}/multi-agent-system.ts",
          "outFiles": ["${workspaceFolder}/**/*.js"],
          "runtimeArgs": ["-r", "tsx/cjs"],
          "env": {
            "NODE_ENV": "development"
          }
        },
        {
          "name": "Debug CLI",
          "type": "node",
          "request": "launch",
          "program": "${workspaceFolder}/interview-cli.ts",
          "args": ["quick"],
          "outFiles": ["${workspaceFolder}/**/*.js"],
          "runtimeArgs": ["-r", "tsx/cjs"],
          "env": {
            "NODE_ENV": "development"
          }
        }
      ]
    };

    await fs.writeFile(
      path.join(vscodeDir, 'launch.json'),
      JSON.stringify(launch, null, 2)
    );

    console.log(chalk.green('✅ VS Code workspace configured'));
    console.log(chalk.blue('📁 Created files:'));
    console.log('  - interview-assistant.code-workspace');
    console.log('  - .vscode/keybindings.json');
    console.log('  - .vscode/tasks.json');
    console.log('  - .vscode/launch.json');
  }

  async createInterviewTemplate(): Promise<void> {
    const template = `# Interview Case Study Analysis

## Case Study Input
<!-- Paste your case study here -->


## Analysis Status
- [ ] Requirements extracted
- [ ] Architecture designed
- [ ] Cost calculated
- [ ] Risks assessed
- [ ] Implementation planned

## Notes
<!-- Your interview notes -->


## Generated Solution
<!-- Multi-agent system output will be inserted here -->


## Presentation Points
<!-- Key talking points for interview -->

---
*Use Ctrl+Shift+I for quick analysis*
*Use Ctrl+Shift+A to analyze from clipboard*
`;

    const templateFile = path.join(this.outputDir, 'interview-template.md');
    await fs.writeFile(templateFile, template);

    console.log(chalk.green(`✅ Interview template created: ${templateFile}`));
  }

  async createLivePreview(): Promise<void> {
    const previewScript = `#!/usr/bin/env tsx
/**
 * Live Preview Server for Interview Analysis
 * Auto-refreshes when analysis files change
 */

import { promises as fs } from 'fs';
import { watch } from 'chokidar';
import path from 'path';
import { marked } from 'marked';
import { exec } from 'child_process';

const PORT = 3000;
const OUTPUT_DIR = './interview-output';

class LivePreviewServer {
  private watchers: Map<string, any> = new Map();

  async start() {
    console.log('🔴 Starting live preview server...');
    
    // Watch for markdown files
    const watcher = watch(path.join(OUTPUT_DIR, '*.md'), {
      persistent: true,
      ignoreInitial: false
    });

    watcher.on('change', async (filePath) => {
      console.log(\`📝 File changed: \${filePath}\`);
      await this.generatePreview(filePath);
    });

    watcher.on('add', async (filePath) => {
      console.log(\`✨ New file: \${filePath}\`);
      await this.generatePreview(filePath);
    });

    console.log(\`🌐 Preview server running on http://localhost:\${PORT}\`);
    console.log('📁 Watching:', OUTPUT_DIR);
  }

  private async generatePreview(markdownPath: string) {
    try {
      const content = await fs.readFile(markdownPath, 'utf-8');
      const html = marked(content);
      
      const htmlTemplate = \`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Interview Analysis Preview</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1, h2, h3 { color: #0078d4; }
        code { background: #f5f5f5; padding: 2px 4px; border-radius: 3px; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 5px; overflow-x: auto; }
        table { border-collapse: collapse; width: 100%; margin: 15px 0; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #0078d4; color: white; }
        .mermaid { text-align: center; margin: 20px 0; }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>mermaid.initialize({startOnLoad:true});</script>
</head>
<body>
    <div id="content">\${html}</div>
    <script>
        // Auto-refresh every 2 seconds
        setTimeout(() => location.reload(), 2000);
    </script>
</body>
</html>\`;
      
      const htmlPath = markdownPath.replace('.md', '.html');
      await fs.writeFile(htmlPath, htmlTemplate);
      
      // Open in browser if it's a new analysis
      if (path.basename(markdownPath).startsWith('solution-') || 
          path.basename(markdownPath).startsWith('quick-solution-')) {
        exec(\`open "\${htmlPath}"\`);
      }
      
    } catch (error) {
      console.error('Error generating preview:', error);
    }
  }
}

const server = new LivePreviewServer();
server.start();
`;

    const previewFile = path.join(this.workspaceDir, 'live-preview.ts');
    await fs.writeFile(previewFile, previewScript);

    console.log(chalk.green('✅ Live preview server created'));
  }

  async openWorkspace(): Promise<void> {
    try {
      const workspaceFile = path.join(this.workspaceDir, 'interview-assistant.code-workspace');
      await execAsync(`code "${workspaceFile}"`);
      console.log(chalk.green('🚀 Opening VS Code workspace...'));
    } catch (error) {
      console.log(chalk.yellow('⚠️ Could not auto-open VS Code. Please manually open:'));
      console.log(chalk.gray('  interview-assistant.code-workspace'));
    }
  }

  async createQuickStartGuide(): Promise<void> {
    const guide = `# VS Code Interview Assistant - Quick Start Guide

## 🚀 Getting Started

### 1. Open Workspace
Open \`interview-assistant.code-workspace\` in VS Code

### 2. Quick Analysis (Fastest Method)
1. Copy case study to clipboard
2. Press \`Ctrl+Shift+I\` or run task "Quick Analysis"
3. Get instant solution ready for interview!

### 3. Advanced Analysis
- Press \`Ctrl+Shift+A\` for clipboard analysis with options
- Use Command Palette: \`Tasks: Run Task\` → Select analysis type

## 📁 File Structure
\`\`\`
interview-output/
├── interview-template.md    # Template for manual analysis
├── solution-*.md           # Generated solutions
├── quick-solution-*.md     # Quick analysis results
└── *.html                  # Auto-generated previews
\`\`\`

## ⌨️ Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| \`Ctrl+Shift+I\` | Quick analysis |
| \`Ctrl+Shift+A\` | Advanced analysis |
| \`Ctrl+Shift+T\` | Test system |

## 🎯 Interview Workflow
1. **Preparation**: Use test mode to validate system
2. **Case Study**: Copy provided case study to clipboard
3. **Quick Analysis**: Press \`Ctrl+Shift+I\`
4. **Present**: Use generated talking points and diagrams
5. **Questions**: Refer to risk assessment and alternatives

## 📊 Generated Outputs
Each analysis includes:
- ✅ Requirements extraction
- 🏗️ 3 architecture alternatives
- 💰 Cost analysis with optimizations
- ⚠️ Risk assessment with mitigations
- 📋 Implementation roadmap
- 🎯 Presentation talking points
- 📐 Mermaid architecture diagrams

## 🔧 Troubleshooting
- **No Azure response**: Check \`AZURE_OPENAI_API_KEY\` environment variable
- **Clipboard issues**: Use "Type now" option instead
- **File not found**: Ensure you're in the correct workspace directory

## 💡 Pro Tips
- Keep case study in clipboard for fastest processing
- Use split view: case study on left, analysis on right
- Generated HTML files auto-open in browser
- All outputs auto-copy to clipboard for easy pasting

---
*Ready for your Microsoft Cloud & AI Solution Engineer interview!*
`;

    const guideFile = path.join(this.outputDir, 'QUICK-START.md');
    await fs.writeFile(guideFile, guide);

    console.log(chalk.green(`✅ Quick start guide created: ${guideFile}`));
  }

  async setupComplete(): Promise<void> {
    await this.setupWorkspace();
    await this.createInterviewTemplate();
    await this.createLivePreview();
    await this.createQuickStartGuide();

    console.log(chalk.green.bold('\n🎉 VS Code Integration Complete!\n'));
    console.log(chalk.blue('📋 What was created:'));
    console.log('  ✅ VS Code workspace configuration');
    console.log('  ✅ Keyboard shortcuts for quick analysis');
    console.log('  ✅ Tasks and launch configurations');
    console.log('  ✅ Interview template');
    console.log('  ✅ Live preview server');
    console.log('  ✅ Quick start guide');

    console.log(chalk.blue('\n⚡ Quick Commands:'));
    console.log('  npm run setup-vscode    - Run this setup');
    console.log('  npm run quick           - Quick analysis');
    console.log('  npm run interactive     - Interactive mode');
    console.log('  npm run preview         - Start live preview');

    await this.openWorkspace();
  }
}

// Run if called directly
if (require.main === module) {
  const integration = new VSCodeIntegration();
  integration.setupComplete();
}

export { VSCodeIntegration };