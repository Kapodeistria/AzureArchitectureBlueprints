require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { ServiceBusClient } = require('@azure/service-bus');

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
  statusQueueName: process.env.SERVICE_BUS_STATUS_QUEUE || 'casestudy-status'
};

// Initialize Service Bus Client
let serviceBusClient = null;
let jobSender = null;
let statusReceiver = null;

async function initializeServiceBus() {
  if (config.serviceBusConnection) {
    try {
      serviceBusClient = new ServiceBusClient(config.serviceBusConnection);
      jobSender = serviceBusClient.createSender(config.jobQueueName);
      statusReceiver = serviceBusClient.createReceiver(config.statusQueueName);

      // Start listening for status updates
      statusReceiver.subscribe({
        processMessage: async (message) => {
          const statusUpdate = message.body;
          const job = jobs.get(statusUpdate.sessionId);
          if (job) {
            Object.assign(job, statusUpdate);
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
      logs: this.logs,
      error: this.error,
      result: this.result,
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
app.get('/api/case-study/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const job = jobs.get(sessionId);

  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
      sessionId
    });
  }

  res.json(job.toJSON());
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