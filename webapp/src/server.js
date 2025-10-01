require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { ServiceBusClient } = require('@azure/service-bus');
const {
  BlobServiceClient,
  StorageSharedKeyCredential,
  generateBlobSASQueryParameters,
  BlobSASPermissions
} = require('@azure/storage-blob');
const { DefaultAzureCredential } = require('@azure/identity');

const app = express();
const PORT = process.env.PORT || 8080;

// Job tracking storage (in-memory, use Redis for production)
const jobs = new Map();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Configuration from environment variables
const config = {
  openAiEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  openAiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  mlWorkspaceName: process.env.AZURE_ML_WORKSPACE_NAME,
  storageAccountName: process.env.STORAGE_ACCOUNT_NAME,
  artifactContainerUrl: process.env.ARTIFACT_CONTAINER_URL,
  serviceBusConnection: process.env.SERVICE_BUS_CONNECTION,
  jobQueueName: process.env.SERVICE_BUS_JOB_QUEUE || 'casestudy-jobs',
  statusQueueName: process.env.SERVICE_BUS_STATUS_QUEUE || 'casestudy-status',
  commandQueueName: process.env.SERVICE_BUS_COMMAND_QUEUE || 'casestudy-commands',
  artifactsConnectionString: process.env.ARTIFACTS_STORAGE_CONNECTION || process.env.AZURE_STORAGE_CONNECTION_STRING,
  storageSasToken: process.env.ARTIFACTS_STORAGE_SAS,
  artifactContainer: process.env.ARTIFACTS_CONTAINER || null
};

if (!config.artifactContainer && config.artifactContainerUrl) {
  try {
    const parsed = new URL(config.artifactContainerUrl);
    const parts = parsed.pathname.replace(/^\/+/, '').split('/');
    if (parts[0]) {
      config.artifactContainer = parts[0];
    }
  } catch (error) {
    console.warn('⚠️  Unable to derive artifact container from URL:', error.message);
  }
}

if (!config.artifactContainer) {
  config.artifactContainer = 'final-artifacts';
}

// Initialize Service Bus Client
let serviceBusClient = null;
let jobSender = null;
let statusReceiver = null;
let commandSender = null;
let blobContainerClient = null;

const storageState = {
  authType: 'none',
  sharedKeyCredential: null,
  sasToken: null,
  serviceClient: null,
  userDelegationKey: null
};

function parseConnectionString(connectionString = '') {
  return connectionString.split(';').reduce((acc, segment) => {
    const [key, value] = segment.split('=');
    if (key && value) {
      acc[key.trim().toLowerCase()] = value.trim();
    }
    return acc;
  }, {});
}

async function initializeStorage() {
  try {
    if (!config.storageAccountName && !config.artifactsConnectionString) {
      console.log('ℹ️  Storage not fully configured – download API disabled.');
      return;
    }

    if (config.artifactsConnectionString) {
      const serviceClient = BlobServiceClient.fromConnectionString(config.artifactsConnectionString);
      blobContainerClient = serviceClient.getContainerClient(config.artifactContainer);

      const parsed = parseConnectionString(config.artifactsConnectionString);
      if (parsed.accountname && parsed.accountkey) {
        storageState.sharedKeyCredential = new StorageSharedKeyCredential(parsed.accountname, parsed.accountkey);
        storageState.authType = 'sharedKey';
      } else if (parsed.sharedaccesssignature) {
        storageState.sasToken = parsed.sharedaccesssignature.startsWith('?')
          ? parsed.sharedaccesssignature
          : `?${parsed.sharedaccesssignature}`;
        storageState.authType = 'sas';
      }

      await blobContainerClient.getProperties();
      console.log(`✅ Storage initialized via connection string (container: ${blobContainerClient.containerName})`);
      return;
    }

    if (config.storageSasToken && config.storageAccountName) {
      const sas = config.storageSasToken.startsWith('?') ? config.storageSasToken : `?${config.storageSasToken}`;
      const url = `https://${config.storageAccountName}.blob.core.windows.net${sas}`;
      const serviceClient = new BlobServiceClient(url);
      blobContainerClient = serviceClient.getContainerClient(config.artifactContainer);
      storageState.sasToken = sas;
      storageState.authType = 'sas';
      await blobContainerClient.getProperties();
      console.log(`✅ Storage initialized via SAS token (container: ${blobContainerClient.containerName})`);
      return;
    }

    if (config.storageAccountName) {
      const credential = new DefaultAzureCredential();
      const url = `https://${config.storageAccountName}.blob.core.windows.net`;
      const serviceClient = new BlobServiceClient(url, credential);
      blobContainerClient = serviceClient.getContainerClient(config.artifactContainer);
      storageState.authType = 'managedIdentity';
      storageState.serviceClient = serviceClient;
      await blobContainerClient.getProperties();
      console.log(`✅ Storage initialized via managed identity (container: ${blobContainerClient.containerName})`);
      return;
    }

    console.log('ℹ️  No storage credentials available – download API disabled.');
  } catch (error) {
    blobContainerClient = null;
    storageState.authType = 'none';
    console.error('❌ Failed to initialize storage client:', error.message);
  }
}

function isUserDelegationKeyValid(key) {
  if (!key?.signedExpiresOn) return false;
  const expiry = new Date(key.signedExpiresOn).getTime();
  return expiry - Date.now() > 5 * 60 * 1000; // renew when less than 5 minutes remaining
}

async function getUserDelegationKey() {
  if (storageState.authType !== 'managedIdentity' || !storageState.serviceClient) {
    return null;
  }

  if (isUserDelegationKeyValid(storageState.userDelegationKey)) {
    return storageState.userDelegationKey;
  }

  const now = new Date();
  const expiresOn = new Date(now.getTime() + 60 * 60 * 1000);
  storageState.userDelegationKey = await storageState.serviceClient.getUserDelegationKey(now, expiresOn);
  return storageState.userDelegationKey;
}

async function buildBlobSasUrl(blobName) {
  if (!blobContainerClient) {
    return null;
  }

  const blobClient = blobContainerClient.getBlockBlobClient(blobName);

  if (storageState.authType === 'sas') {
    return blobClient.url;
  }

  const startsOn = new Date(Date.now() - 5 * 60 * 1000);
  const expiresOn = new Date(Date.now() + 60 * 60 * 1000);
  const permissions = BlobSASPermissions.parse('r');

  if (storageState.authType === 'sharedKey' && storageState.sharedKeyCredential) {
    const sas = generateBlobSASQueryParameters({
      containerName: blobContainerClient.containerName,
      blobName,
      permissions,
      startsOn,
      expiresOn
    }, storageState.sharedKeyCredential).toString();
    return `${blobClient.url}?${sas}`;
  }

  if (storageState.authType === 'managedIdentity' && config.storageAccountName) {
    const delegationKey = await getUserDelegationKey();
    if (delegationKey) {
      const sas = generateBlobSASQueryParameters({
        containerName: blobContainerClient.containerName,
        blobName,
        permissions,
        startsOn,
        expiresOn
      }, delegationKey, config.storageAccountName).toString();
      return `${blobClient.url}?${sas}`;
    }
  }

  return blobClient.url;
}

async function listFilesForSession(sessionId) {
  if (!blobContainerClient) {
    console.error(`[Storage] Cannot list files for ${sessionId}: blobContainerClient not initialized`);
    throw new Error('Storage not configured');
  }

  const prefix = `${sessionId}/`;
  const files = [];

  console.log(`[Storage] Listing blobs in container '${blobContainerClient.containerName}' with prefix '${prefix}'`);

  try {
    for await (const blob of blobContainerClient.listBlobsFlat({ prefix })) {
      // Skip if explicitly marked as not a blob (blob.kind would be 'prefix' for virtual directories)
      // But if kind is undefined (which it usually is), include it
      if (blob.kind && blob.kind !== 'blob') continue;

      const downloadUrl = await buildBlobSasUrl(blob.name);
      const relativeName = blob.name.startsWith(prefix) ? blob.name.slice(prefix.length) : blob.name;
      files.push({
        name: relativeName || blob.name,
        url: downloadUrl,
        contentType: blob.properties?.contentType || null,
        size: blob.properties?.contentLength || null,
        timestamp: blob.properties?.lastModified ? new Date(blob.properties.lastModified).toISOString() : new Date().toISOString()
      });
    }

    console.log(`[Storage] Found ${files.length} file(s) for session ${sessionId}`);
  } catch (error) {
    console.error(`[Storage] Error listing blobs for ${sessionId}:`, error.message);
    throw error;
  }

  files.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return files;
}

async function initializeServiceBus() {
  if (config.serviceBusConnection) {
    try {
      serviceBusClient = new ServiceBusClient(config.serviceBusConnection);
      jobSender = serviceBusClient.createSender(config.jobQueueName);
      statusReceiver = serviceBusClient.createReceiver(config.statusQueueName);
      commandSender = serviceBusClient.createSender(config.commandQueueName);

      // Start listening for status updates
      statusReceiver.subscribe({
        processMessage: async (message) => {
          const statusUpdate = message.body;
          const job = jobs.get(statusUpdate.sessionId);
          if (job) {
            const snapshot = {
              timestamp: statusUpdate.timestamp || new Date().toISOString(),
              status: statusUpdate.status,
              progress: statusUpdate.progress,
              currentAgent: statusUpdate.currentAgent,
              completedAgents: statusUpdate.completedAgents,
              error: statusUpdate.error,
              raw: statusUpdate
            };
            job.telemetry.push(snapshot);
            if (job.telemetry.length > 50) {
              job.telemetry.splice(0, job.telemetry.length - 50);
            }
            // Preserve quickMode and other job-specific fields
            const quickMode = job.quickMode;
            const caseStudyInput = job.caseStudyInput;
            const startTime = job.startTime;
            const previousFiles = job.files;
            const previousResult = job.result;

            Object.assign(job, statusUpdate);

            // Restore preserved fields
            job.quickMode = quickMode;
            job.caseStudyInput = caseStudyInput;
            job.startTime = startTime;

            // Preserve files/result history
            if (Array.isArray(statusUpdate.files)) {
              job.files = statusUpdate.files;
            } else {
              job.files = previousFiles;
            }
            if (statusUpdate.result) {
              job.result = {
                ...job.result,
                ...statusUpdate.result
              };
            } else {
              job.result = previousResult;
            }

            if (statusUpdate.commands) {
              job.commands = statusUpdate.commands;
            }
          }
          await statusReceiver.completeMessage(message);
        },
        processError: async (err) => {
          console.error('Status queue error:', err);
        }
      });

      console.log('✅ Service Bus initialized');
    } catch (error) {
      console.error('❌ Service Bus initialization failed:', error.message);
    }
  }
}

initializeServiceBus();
initializeStorage();

// Job status class
class Job {
  constructor(sessionId, caseStudyInput, quickMode) {
    this.sessionId = sessionId;
    this.caseStudyInput = caseStudyInput;
    this.quickMode = quickMode;
    this.status = 'queued';
    this.progress = 0;
    this.currentAgent = null;
    this.completedAgents = [];
    this.files = [];
    this.logs = [];
    this.error = null;
    this.result = null;
    this.startTime = Date.now();
    this.endTime = null;
    this.commands = [];
    this.telemetry = [];
  }

  log(level, message, data = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      elapsed: Date.now() - this.startTime
    };
    this.logs.push(entry);
    console.log(`[${entry.timestamp}] [${level}] [${this.sessionId}] ${message}`, data);
  }

  updateStatus(status, progress = null) {
    this.status = status;
    if (progress !== null) this.progress = progress;
    this.log('INFO', `Status updated: ${status}`, { progress: this.progress });
  }

  setAgent(agentName) {
    this.currentAgent = agentName;
    this.log('INFO', `🤖 Running agent: ${agentName}`);
  }

  completeAgent(agentName) {
    this.completedAgents.push(agentName);
    this.currentAgent = null;
    this.progress = Math.round((this.completedAgents.length / (this.quickMode ? 3 : 9)) * 100);
    this.log('INFO', `✓ Agent completed: ${agentName}`, { progress: this.progress });
  }

  setError(error) {
    this.status = 'failed';
    this.error = error.message || error;
    this.endTime = Date.now();
    this.log('ERROR', `Job failed: ${this.error}`);
  }

  setResult(result) {
    this.status = 'completed';
    this.result = result;
    this.progress = 100;
    this.endTime = Date.now();
    this.log('INFO', '✅ Job completed successfully');
  }

  toJSON() {
    return {
      sessionId: this.sessionId,
      status: this.status,
      progress: this.progress,
      currentAgent: this.currentAgent,
      completedAgents: this.completedAgents,
      files: this.files,
      logs: this.logs,
      error: this.error,
      result: this.result,
      commands: this.commands,
      telemetry: this.telemetry,
      elapsed: this.endTime ? (this.endTime - this.startTime) : (Date.now() - this.startTime)
    };
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    config: {
      hasOpenAI: !!config.openAiEndpoint,
      hasWorkspace: !!config.mlWorkspaceName,
      hasStorage: !!config.storageAccountName
    }
  });
});

// Get configuration endpoint
app.get('/api/config', (req, res) => {
  res.json({
    openAiDeploymentName: config.openAiDeploymentName,
    mlWorkspaceName: config.mlWorkspaceName,
    artifactContainerUrl: config.artifactContainerUrl
  });
});

// Version endpoint for deployment verification
app.get('/api/version', (req, res) => {
  const pkg = require('../package.json');
  res.json({
    version: pkg.version,
    name: pkg.name,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint for storage configuration
app.get('/api/debug/storage', async (req, res) => {
  const testSessionId = req.query.testSession || 'web-1759326032686';
  let listTestResult = null;

  try {
    if (blobContainerClient) {
      const prefix = `${testSessionId}/`;
      const blobs = [];
      const blobDetails = [];
      for await (const blob of blobContainerClient.listBlobsFlat({ prefix })) {
        blobs.push(blob.name);
        blobDetails.push({ name: blob.name, kind: blob.kind, hasKind: 'kind' in blob });
      }
      listTestResult = { success: true, count: blobs.length, blobs, blobDetails };
    }
  } catch (error) {
    listTestResult = { success: false, error: error.message, stack: error.stack };
  }

  res.json({
    blobContainerClientInitialized: !!blobContainerClient,
    containerName: blobContainerClient?.containerName || null,
    storageAuthType: storageState.authType,
    config: {
      storageAccountName: config.storageAccountName || null,
      hasConnectionString: !!config.artifactsConnectionString,
      hasSasToken: !!config.storageSasToken,
      artifactContainer: config.artifactContainer
    },
    listTest: listTestResult
  });
});

// Submit case study endpoint
app.post('/api/case-study/submit', async (req, res) => {
  try {
    const { caseStudyInput, quickMode } = req.body;

    if (!caseStudyInput) {
      return res.status(400).json({
        error: 'Case study input is required'
      });
    }

    // Validate configuration
    const missingConfig = [];
    if (!config.openAiEndpoint) missingConfig.push('AZURE_OPENAI_ENDPOINT');
    if (!config.openAiDeploymentName) missingConfig.push('AZURE_OPENAI_DEPLOYMENT_NAME');
    if (!config.mlWorkspaceName) missingConfig.push('AZURE_ML_WORKSPACE_NAME');

    if (missingConfig.length > 0) {
      return res.status(500).json({
        error: 'Server configuration incomplete',
        message: `Missing environment variables: ${missingConfig.join(', ')}`,
        missingConfig
      });
    }

    // Generate unique session ID
    const sessionId = `web-${Date.now()}`;

    // Create job
    const job = new Job(sessionId, caseStudyInput, quickMode);
    jobs.set(sessionId, job);

    job.log('INFO', '📝 Received case study submission', {
      inputLength: caseStudyInput.length,
      quickMode
    });

    job.log('INFO', '✅ Configuration validated', {
      endpoint: config.openAiEndpoint,
      deployment: config.openAiDeploymentName,
      workspace: config.mlWorkspaceName
    });

    // Return immediately with session ID
    res.json({
      sessionId,
      status: 'queued',
      message: 'Case study submitted successfully. Use the status endpoint to track progress.',
      statusUrl: `/api/case-study/status/${sessionId}`,
      streamUrl: `/api/case-study/stream/${sessionId}`
    });

    // Submit job to Service Bus queue
    submitJobToQueue(job, caseStudyInput, quickMode).catch(err => {
      console.error(`Job ${sessionId} failed:`, err);
      job.setError(err);
    });

  } catch (error) {
    console.error('Error submitting case study:', error);
    res.status(500).json({
      error: 'Failed to submit case study',
      message: error.message
    });
  }
});

// Live command interface for in-flight jobs
app.post('/api/case-study/command', async (req, res) => {
  try {
    const { sessionId, command } = req.body || {};

    if (!sessionId || !command || !command.trim()) {
      return res.status(400).json({ error: 'sessionId and command are required' });
    }

    const job = jobs.get(sessionId);
    if (!job) {
      return res.status(404).json({ error: 'Job not found', sessionId });
    }

    const sanitizedCommand = command.trim();
    const entry = {
      command: sanitizedCommand,
      issuedAt: new Date().toISOString(),
      source: 'webapp'
    };

    job.commands.push(entry);
    job.log('INFO', '💬 Received live command feedback', { command: sanitizedCommand });

    if (!commandSender) {
      job.log('WARN', 'Service Bus command sender unavailable');
      return res.status(202).json({ ok: false, message: 'Command accepted locally but Service Bus unavailable' });
    }

    await commandSender.sendMessages({
      body: {
        sessionId,
        command: sanitizedCommand,
        issuedAt: entry.issuedAt,
        source: entry.source
      },
      sessionId,
      messageId: `${sessionId}-cmd-${Date.now()}`
    });

    res.json({ ok: true });
  } catch (error) {
    console.error('Command publish failed:', error);
    res.status(500).json({ error: 'Failed to publish command', message: error.message });
  }
});

// Submit job to Service Bus queue
async function submitJobToQueue(job, caseStudyInput, quickMode) {
  try {
    if (!jobSender) {
      job.log('ERROR', '❌ Service Bus not available');
      job.setError(new Error('Service Bus not configured. Please check SERVICE_BUS_CONNECTION environment variable.'));
      return;
    }

    job.log('INFO', '📤 Submitting job to processing queue');

    const message = {
      body: {
        sessionId: job.sessionId,
        caseStudyInput,
        quickMode,
        timestamp: new Date().toISOString()
      },
      messageId: job.sessionId,
      sessionId: job.sessionId
    };

    await jobSender.sendMessages(message);

    job.updateStatus('queued', 5);
    job.log('INFO', '✅ Job submitted to queue successfully');

  } catch (error) {
    job.log('ERROR', `❌ Failed to submit job: ${error.message}`);
    job.setError(error);
  }
}

// Get job status endpoint
app.get('/api/case-study/status/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const job = jobs.get(sessionId);

  if (job) {
    return res.json(job.toJSON());
  }

  // Fallback: try to reconstruct session from blob storage
  console.log(`[Fallback] Attempting to reconstruct session ${sessionId} from blob storage`);
  try {
    const files = await listFilesForSession(sessionId);
    console.log(`[Fallback] Found ${files.length} file(s) for session ${sessionId}`);
    if (files.length > 0) {
      // Session exists in blob storage, reconstruct a minimal job object
      console.log(`[Fallback] Reconstructing session ${sessionId} with files:`, files.map(f => f.name));
      return res.json({
        sessionId,
        status: 'completed',
        progress: 100,
        currentAgent: null,
        completedAgents: [],
        files,
        logs: [],
        error: null,
        result: {
          message: 'Case study completed (reconstructed from storage)',
          directory: sessionId
        },
        commands: [],
        telemetry: [],
        elapsed: null
      });
    }
  } catch (error) {
    console.error(`[Fallback] Failed to check blob storage for session ${sessionId}:`, error.message, error.stack);
  }

  // Session not found in memory or storage
  console.log(`[Fallback] Session ${sessionId} not found in memory or storage`);
  return res.status(404).json({
    error: 'Job not found',
    sessionId
  });
});

// Server-Sent Events endpoint for real-time updates
app.get('/api/case-study/stream/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const job = jobs.get(sessionId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial state
  res.write(`data: ${JSON.stringify(job.toJSON())}\n\n`);

  // Poll for updates every second
  const intervalId = setInterval(() => {
    if (job.status === 'completed' || job.status === 'failed') {
      res.write(`data: ${JSON.stringify(job.toJSON())}\n\n`);
      clearInterval(intervalId);
      res.end();
    } else {
      res.write(`data: ${JSON.stringify(job.toJSON())}\n\n`);
    }
  }, 1000);

  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(intervalId);
    res.end();
  });
});

// List recent outputs
app.get('/api/outputs', async (req, res) => {
  try {
    const outputDir = path.join(__dirname, '../../output');
    const fs = require('fs').promises;

    const entries = await fs.readdir(outputDir);
    const outputs = entries
      .filter(name => name.startsWith('case-study-'))
      .map(name => ({
        name,
        url: `${config.artifactContainerUrl}/${name}`,
        timestamp: name.split('-')[2] + 'T' + name.split('-')[3]
      }))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 10);

    res.json({ outputs });
  } catch (error) {
    console.error('Error listing outputs:', error);
    res.status(500).json({ error: 'Failed to list outputs' });
  }
});

app.get('/api/case-study/files/:sessionId', async (req, res) => {
  if (!blobContainerClient) {
    return res.status(503).json({
      error: 'Artifact storage not configured',
      message: 'Server is missing storage configuration for artifact downloads.'
    });
  }

  const { sessionId } = req.params;
  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  try {
    const files = await listFilesForSession(sessionId);
    res.json({ files });
  } catch (error) {
    console.error(`Failed to list files for ${sessionId}:`, error);
    res.status(500).json({ error: 'Failed to list files', message: error.message });
  }
});

// Demo route - loads demo automatically
app.get('/demo', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Agentic WAF Web App running on port ${PORT}`);
  console.log(`📍 OpenAI Endpoint: ${config.openAiEndpoint || 'Not configured'}`);
  console.log(`📍 ML Workspace: ${config.mlWorkspaceName || 'Not configured'}`);
  console.log(`📍 Artifact Storage: ${config.artifactContainerUrl || 'Not configured'}`);
});
