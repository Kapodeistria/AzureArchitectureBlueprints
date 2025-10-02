require('dotenv').config();
const { ServiceBusClient } = require('@azure/service-bus');
const { BlobServiceClient } = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

const OUTPUT_ROOT = '/app/output';
const ARTIFACT_CONTAINER = 'final-artifacts';

const config = {
  serviceBusConnection: process.env.SERVICE_BUS_CONNECTION,
  serviceBusNamespace: process.env.SERVICE_BUS_NAMESPACE || process.env.SERVICE_BUS_FULLY_QUALIFIED_NAMESPACE,
  jobQueueName: process.env.SERVICE_BUS_JOB_QUEUE || 'casestudy-jobs',
  statusQueueName: process.env.SERVICE_BUS_STATUS_QUEUE || 'casestudy-status',
  commandQueueName: process.env.SERVICE_BUS_COMMAND_QUEUE || 'casestudy-commands',
  openAiApiKey: process.env.AZURE_OPENAI_API_KEY,
  openAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  openAiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  mlWorkspaceName: process.env.AZURE_ML_WORKSPACE_NAME,
  storageAccountName: process.env.STORAGE_ACCOUNT_NAME,
  artifactsConnectionString: process.env.ARTIFACTS_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING,
  artifactsContainer: process.env.ARTIFACTS_CONTAINER || ARTIFACT_CONTAINER,
  storageSasToken: process.env.ARTIFACTS_STORAGE_SAS
};

let serviceBusClient;
let jobReceiver;
let statusSender;
let commandReceiver;
let blobContainerClient;
const commandHistory = new Map();

function buildServiceBusFqdn(namespace) {
  if (!namespace) {
    return null;
  }
  return namespace.includes('.') ? namespace : `${namespace}.servicebus.windows.net`;
}

async function initializeServiceBus() {
  const fqdn = buildServiceBusFqdn(config.serviceBusNamespace);
  if (!config.serviceBusConnection && !fqdn) {
    throw new Error('Service Bus configuration missing. Provide SERVICE_BUS_CONNECTION or SERVICE_BUS_NAMESPACE.');
  }

  if (config.serviceBusConnection) {
    serviceBusClient = new ServiceBusClient(config.serviceBusConnection);
  } else {
    const credential = new DefaultAzureCredential();
    serviceBusClient = new ServiceBusClient(fqdn, credential);
  }

  jobReceiver = serviceBusClient.createReceiver(config.jobQueueName, { receiveMode: 'peekLock' });
  statusSender = serviceBusClient.createSender(config.statusQueueName);

  try {
    commandReceiver = serviceBusClient.createReceiver(config.commandQueueName, { receiveMode: 'peekLock' });
    commandReceiver.subscribe({
      processMessage: async (message) => {
        await handleCommandMessage(message);
        await commandReceiver.completeMessage(message);
      },
      processError: async (err) => {
        console.error('Command queue error:', err);
      }
    });
    console.log(`✅ Listening for commands on ${config.commandQueueName}`);
  } catch (error) {
    console.warn('⚠️  Unable to subscribe to command queue:', error.message);
  }

  console.log('✅ Connected to Service Bus');
}

function buildBlobServiceClient() {
  if (config.artifactsConnectionString) {
    const serviceClient = BlobServiceClient.fromConnectionString(config.artifactsConnectionString);
    return serviceClient.getContainerClient(config.artifactsContainer);
  }

  if (!config.storageAccountName) {
    console.warn('⚠️  STORAGE_ACCOUNT_NAME or ARTIFACTS_STORAGE_CONNECTION not provided. Skipping artifact uploads.');
    return null;
  }

  if (config.storageSasToken) {
    const sas = config.storageSasToken.startsWith('?') ? config.storageSasToken : `?${config.storageSasToken}`;
    const url = `https://${config.storageAccountName}.blob.core.windows.net${sas}`;
    const serviceClient = new BlobServiceClient(url);
    return serviceClient.getContainerClient(config.artifactsContainer);
  }

  const credential = new DefaultAzureCredential();
  const url = `https://${config.storageAccountName}.blob.core.windows.net`;
  const serviceClient = new BlobServiceClient(url, credential, {
    retryOptions: { maxTries: 5 }
  });
  return serviceClient.getContainerClient(config.artifactsContainer);
}

function buildCaseStudyWithCommands(originalInput, commands) {
  if (!commands || commands.length === 0) {
    return originalInput;
  }

  const formatted = commands
    .map((entry) => {
      const timestamp = entry.issuedAt || new Date().toISOString();
      const source = entry.source ? ` (${entry.source})` : '';
      return `- [${timestamp}]${source} ${entry.command}`;
    })
    .join('\n');

  return `${originalInput}\n\n---\n# Live Feedback Commands\n${formatted}\n`;
}

async function initializeStorage() {
  blobContainerClient = buildBlobServiceClient();
  if (blobContainerClient) {
    try {
      await blobContainerClient.createIfNotExists({ access: 'blob' });
      console.log(`✅ Artifact container ready: ${blobContainerClient.containerName}`);
    } catch (error) {
      console.warn('⚠️  Unable to create or access artifact container:', error.message);
      blobContainerClient = null;
    }
  }
}

async function sendStatusUpdate(sessionId, status) {
  if (!statusSender) return;

  await statusSender.sendMessages({
    body: {
      sessionId,
      ...status,
      commands: getCommandHistory(sessionId),
      timestamp: new Date().toISOString()
    }
  });
}

async function sendLogEntry(sessionId, type, message) {
  if (!message || !message.trim()) return;
  await sendStatusUpdate(sessionId, {
    logEntry: {
      type,
      message: message.trim(),
      issuedAt: new Date().toISOString()
    }
  });
}

function getCommandHistory(sessionId) {
  const history = commandHistory.get(sessionId) || [];
  return history.map(entry => ({ ...entry }));
}

function recordCommand(sessionId, commandPayload) {
  const history = commandHistory.get(sessionId) || [];
  history.push(commandPayload);
  if (history.length > 50) {
    history.splice(0, history.length - 50);
  }
  commandHistory.set(sessionId, history);
}

async function handleCommandMessage(message) {
  const { sessionId, command, issuedAt, source } = message.body || {};
  if (!sessionId || !command) {
    return;
  }

  const entry = {
    command,
    issuedAt: issuedAt || new Date().toISOString(),
    source: source || 'webapp'
  };

  recordCommand(sessionId, entry);
  await sendStatusUpdate(sessionId, {
    status: 'processing',
    latestCommand: entry
  });
}

async function listCaseStudyFolders() {
  try {
    const entries = await fs.readdir(OUTPUT_ROOT, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && entry.name.startsWith('case-study-')).map((entry) => entry.name);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function inferContentType(fileName) {
  if (fileName.endsWith('.md')) return 'text/markdown';
  if (fileName.endsWith('.json')) return 'application/json';
  if (fileName.endsWith('.txt')) return 'text/plain';
  if (fileName.endsWith('.png')) return 'image/png';
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

async function uploadArtifacts(sessionId, folderPath) {
  if (!blobContainerClient) {
    return [];
  }

  const entries = await fs.readdir(folderPath, { withFileTypes: true });
  const uploaded = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const filePath = path.join(folderPath, entry.name);
    const blobName = `${sessionId}/${entry.name}`;
    const client = blobContainerClient.getBlockBlobClient(blobName);
    const fileContent = await fs.readFile(filePath);

    await client.upload(fileContent, fileContent.length, {
      blobHTTPHeaders: { blobContentType: inferContentType(entry.name) }
    });

    uploaded.push({
      name: entry.name,
      url: client.url,
      timestamp: new Date().toISOString()
    });
  }

  return uploaded;
}

async function resolveOutputFolder(beforeFolders) {
  const afterFolders = await listCaseStudyFolders();
  const candidate = afterFolders.find((folder) => !beforeFolders.includes(folder));
  if (candidate) {
    return { folderName: candidate, folderPath: path.join(OUTPUT_ROOT, candidate) };
  }

  if (afterFolders.length === 0) {
    return null;
  }

  const folderStats = await Promise.all(
    afterFolders.map(async (folder) => {
      const stats = await fs.stat(path.join(OUTPUT_ROOT, folder));
      return { folder, mtime: stats.mtimeMs };
    })
  );

  folderStats.sort((a, b) => b.mtime - a.mtime);
  return { folderName: folderStats[0].folder, folderPath: path.join(OUTPUT_ROOT, folderStats[0].folder) };
}

async function collectMetadata(folderPath) {
  try {
    const entries = await fs.readdir(folderPath);
    const metadataFile = entries.find((file) => file.startsWith('metadata-') && file.endsWith('.json'));
    if (!metadataFile) return {};

    const metadata = JSON.parse(await fs.readFile(path.join(folderPath, metadataFile), 'utf-8'));
    return metadata;
  } catch (error) {
    console.warn('⚠️  Unable to read metadata file:', error.message);
    return {};
  }
}

async function runCli(caseStudyFile, quickMode, sessionId, sendProgressUpdate) {
  console.log(`⚙️  Executing CLI with real-time progress tracking`);

  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', '/app/src/cli/interview-cli.ts', 'analyze', '--input', caseStudyFile], {
      cwd: '/app',
      env: {
        ...process.env,
        AZURE_OPENAI_API_KEY: config.openAiApiKey,
        AZURE_OPENAI_ENDPOINT: config.openAiEndpoint,
        AZURE_OPENAI_DEPLOYMENT_NAME: config.openAiDeploymentName,
        AZURE_ML_WORKSPACE_NAME: config.mlWorkspaceName,
        STORAGE_ACCOUNT_NAME: config.storageAccountName,
        CASE_STUDY_SESSION_ID: sessionId,
        CASE_STUDY_SOURCE: 'container-app-worker',
        FORCE_COLOR: '0'
      }
    });

    let stdoutData = '';
    let stderrData = '';
    const completedAgents = [];
    let currentAgent = null;

    child.stdout.on('data', async (data) => {
      const chunk = data.toString();
      stdoutData += chunk;
      console.log(chunk);

      // Parse agent execution in real-time
      const lines = chunk.split('\n');
      for (const line of lines) {
        // Match patterns like "Running agent: requirements-analyst" or "✓ requirements-analyst completed"
        const runningMatch = line.match(/Running agent: ([a-zA-Z-]+)/);
        const completedMatch = line.match(/✓\s+([a-zA-Z-]+)\s+completed/i);

        if (runningMatch) {
          currentAgent = runningMatch[1];
          console.log(`📊 Agent started: ${currentAgent}`);

          // Send progress update
          await sendProgressUpdate({
            currentAgent,
            completedAgents: [...completedAgents]
          });
        }

        if (completedMatch) {
          const agent = completedMatch[1];
          if (!completedAgents.includes(agent)) {
            completedAgents.push(agent);
            console.log(`✅ Agent completed: ${agent} (${completedAgents.length} total)`);

            // Send progress update
            await sendProgressUpdate({
              currentAgent: null,
              completedAgents: [...completedAgents]
            });
          }
        }

        await sendLogEntry(sessionId, 'stdout', line);
      }
    });

    child.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrData += chunk;
      console.warn('⚠️  CLI stderr:', chunk);
      chunk.split('\n').forEach((line) => {
        sendLogEntry(sessionId, 'stderr', line);
      });
    });

    child.on('error', (error) => {
      console.error('❌ CLI process error:', error);
      reject(error);
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`📊 CLI completed successfully. ${completedAgents.length} agents executed: ${completedAgents.join(', ')}`);
        resolve({ stdout: stdoutData, stderr: stderrData, completedAgents });
      } else {
        const error = new Error(`CLI exited with code ${code}`);
        error.stderr = stderrData;
        error.code = code;
        reject(error);
      }
    });

    // Timeout after 10 minutes
    setTimeout(() => {
      child.kill();
      reject(new Error('CLI execution timeout after 10 minutes'));
    }, 600000);
  });
}

async function processJob(message) {
  const { sessionId, caseStudyInput, quickMode } = message.body;

  console.log(`\n🔄 Processing job: ${sessionId}`);
  console.log(`   Mode: ${quickMode ? 'Quick' : 'Full'}`);
  console.log(`   Input length: ${caseStudyInput.length} characters`);

  if (!commandHistory.has(sessionId)) {
    commandHistory.set(sessionId, []);
  }

  const initialFolders = await listCaseStudyFolders();
  const caseStudyFile = `/tmp/${sessionId}-input.txt`;
  const initialCommands = getCommandHistory(sessionId);
  const augmentedInput = buildCaseStudyWithCommands(caseStudyInput, initialCommands);
  await fs.writeFile(caseStudyFile, augmentedInput, 'utf-8');

  await sendStatusUpdate(sessionId, {
    status: 'processing',
    progress: 10,
    currentAgent: null,
    completedAgents: []
  });

  try {
    // Create progress callback for real-time updates
    const sendProgressUpdate = async (progress) => {
      const expectedAgents = quickMode ? 3 : 15;
      const progressPercent = Math.round((progress.completedAgents.length / expectedAgents) * 90) + 10; // 10-100%

      await sendStatusUpdate(sessionId, {
        status: 'processing',
        progress: progressPercent,
        currentAgent: progress.currentAgent,
        completedAgents: progress.completedAgents
      });
    };

    const cliOutput = await runCli(caseStudyFile, quickMode, sessionId, sendProgressUpdate);

    const outputInfo = await resolveOutputFolder(initialFolders);
    let uploadedFiles = [];
    let metadata = {};
    let agentsRun = cliOutput.completedAgents || []; // Use real-time tracked agents

    if (outputInfo) {
      metadata = await collectMetadata(outputInfo.folderPath);
      uploadedFiles = await uploadArtifacts(sessionId, outputInfo.folderPath);

      // Fallback to metadata if CLI didn't track agents
      if (agentsRun.length === 0) {
        if (Array.isArray(metadata?.agents)) {
          agentsRun = metadata.agents.map((agent) => agent.name ?? agent.id ?? agent).filter(Boolean);
        } else if (metadata?.agentMetrics) {
          agentsRun = Object.keys(metadata.agentMetrics).filter((key) => key !== 'health');
        }
      }
    } else {
      console.warn('⚠️  No output folder detected after CLI execution');
    }

    await sendStatusUpdate(sessionId, {
      status: 'completed',
      progress: 100,
      currentAgent: null,
      completedAgents: agentsRun,
      result: {
        message: 'Case study analysis completed successfully',
        directory: outputInfo?.folderName,
        summary: metadata?.summary,
        agentsRun: agentsRun.length > 0 ? agentsRun : null
      },
      files: uploadedFiles,
      error: null
    });
    await sendLogEntry(sessionId, 'info', 'Analysis completed successfully.');

    console.log(`✅ Job completed: ${sessionId}`);
  } catch (error) {
    console.error(`❌ Job failed (${sessionId}):`, error);

    // Enhanced error details for debugging
    const errorDetails = {
      message: error.message || 'Job failed',
      stack: error.stack,
      code: error.code,
      stderr: error.stderr
    };

    console.error('📋 Full error details:', JSON.stringify(errorDetails, null, 2));

    await sendStatusUpdate(sessionId, {
      status: 'failed',
      progress: 0,
      currentAgent: null,
      completedAgents: [],
      error: error.message || 'Job failed',
      errorDetails: errorDetails
    });
    await sendLogEntry(sessionId, 'error', error.message || 'Job failed');
    throw error;
  } finally {
    try {
      await fs.unlink(caseStudyFile);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') {
        console.warn('⚠️  Failed to clean up temp file:', cleanupError.message);
      }
    }
    commandHistory.delete(sessionId);
  }
}

const messageHandler = async (message) => {
  console.log(`📨 Received message ${message.messageId}`);
  try {
    await processJob(message);
    await jobReceiver.completeMessage(message);
    console.log(`✓ Message completed ${message.messageId}`);
  } catch (error) {
    console.error('✗ Message processing failed:', error.message);
    await jobReceiver.abandonMessage(message);
  }
};

const errorHandler = async (error) => {
  console.error('❌ Worker error:', error);
};

async function main() {
  await initializeServiceBus();
  await initializeStorage();

  jobReceiver.subscribe({
    processMessage: messageHandler,
    processError: errorHandler
  });

  console.log('✅ Worker initialized and ready to process jobs');
  console.log(`📥 Listening on queue: ${config.jobQueueName}`);
  console.log(`📤 Status queue: ${config.statusQueueName}`);
  console.log(`🗨️ Command queue: ${config.commandQueueName}`);
}

main().catch((error) => {
  console.error('❌ Worker initialization failed:', error);
  process.exit(1);
});

async function shutdown() {
  console.log('\n🛑 Shutdown signal received, closing connections...');
  try {
    if (jobReceiver) await jobReceiver.close();
    if (commandReceiver) await commandReceiver.close();
    if (statusSender) await statusSender.close();
    if (serviceBusClient) await serviceBusClient.close();
    console.log('✅ Shutdown complete');
  } catch (error) {
    console.error('⚠️  Error during shutdown:', error);
  } finally {
    process.exit(0);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
