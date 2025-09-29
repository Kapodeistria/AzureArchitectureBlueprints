const { BlobServiceClient } = require('@azure/storage-blob');

module.exports = async function (context, jobMessage) {
    const { sessionId, caseStudyInput, quickMode } = jobMessage;

    context.log(`Processing job: ${sessionId}`);
    context.log(`Case study: ${caseStudyInput.substring(0, 50)}...`);
    context.log(`Quick mode: ${quickMode}`);

    // Initialize blob storage client (use artifacts storage, not function storage)
    const storageConnectionString = process.env.ARTIFACTS_STORAGE_CONNECTION || process.env.AzureWebJobsStorage;
    const blobServiceClient = BlobServiceClient.fromConnectionString(storageConnectionString);
    const containerClient = blobServiceClient.getContainerClient('final-artifacts');

    // Ensure container exists
    await containerClient.createIfNotExists({ access: 'blob' });

    const generatedFiles = [];

    // Helper to upload file to blob storage
    const uploadFile = async (fileName, content) => {
        const blobName = `${sessionId}/${fileName}`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        const contentType = fileName.endsWith('.json') ? 'application/json' :
                           fileName.endsWith('.md') ? 'text/markdown' : 'text/plain';

        await blockBlobClient.upload(content, Buffer.byteLength(content), {
            blobHTTPHeaders: { blobContentType: contentType }
        });

        const fileUrl = blockBlobClient.url;
        generatedFiles.push({ name: fileName, url: fileUrl, timestamp: new Date().toISOString() });
        context.log(`✅ Uploaded: ${fileName}`);

        return fileUrl;
    };

    // Helper to send status updates
    const sendStatus = (status, progress, currentAgent = null, completedAgents = [], result = null, error = null, files = null) => {
        const statusUpdate = {
            sessionId,
            status,
            progress,
            currentAgent,
            completedAgents,
            result,
            error,
            files: files || generatedFiles,
            timestamp: new Date().toISOString()
        };
        context.bindings.statusMessage = statusUpdate;
        context.log(`Status update: ${status} - ${progress}%`);
    };

    try {
        // Send initial processing status
        sendStatus('processing', 10);

        // Define agents based on mode
        const agents = quickMode
            ? ['requirements-analysis', 'architecture-design', 'waf-security']
            : ['research-orchestrator', 'requirements-analysis', 'architecture-design',
               'waf-security', 'waf-reliability', 'waf-performance', 'waf-cost',
               'cost-estimation', 'risk-assessment'];

        // Process each agent with simulated delay and file generation
        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            const progress = Math.round(((i + 1) / agents.length) * 85) + 10;

            context.log(`Running agent: ${agent}`);
            sendStatus('running', progress, agent, agents.slice(0, i));

            // Simulate agent processing time
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Generate agent output file
            const agentOutput = {
                agent: agent,
                timestamp: new Date().toISOString(),
                caseStudy: caseStudyInput,
                analysis: `## ${agent.toUpperCase()} Analysis\n\n` +
                          `**Case Study:** ${caseStudyInput}\n\n` +
                          `### Key Findings\n\n` +
                          `- Analysis completed for ${agent}\n` +
                          `- Processed in context of Azure Well-Architected Framework\n` +
                          `- Generated recommendations and best practices\n\n` +
                          `### Recommendations\n\n` +
                          `1. Follow Azure best practices for ${agent}\n` +
                          `2. Implement monitoring and observability\n` +
                          `3. Ensure security compliance\n` +
                          `4. Optimize for cost and performance\n\n` +
                          `_Generated at: ${new Date().toISOString()}_`,
                metadata: {
                    sessionId: sessionId,
                    agentIndex: i + 1,
                    totalAgents: agents.length
                }
            };

            // Upload agent output as markdown
            await uploadFile(`${agent}.md`, agentOutput.analysis);

            // Send status update with file progress
            sendStatus('running', progress, agent, agents.slice(0, i + 1));
        }

        // Generate final summary report
        context.log('Generating final summary report...');
        const summaryReport = {
            sessionId: sessionId,
            caseStudy: caseStudyInput,
            mode: quickMode ? 'quick' : 'full',
            agentsExecuted: agents,
            timestamp: new Date().toISOString(),
            summary: `# Case Study Analysis Summary\n\n` +
                     `**Case Study:** ${caseStudyInput}\n\n` +
                     `**Analysis Mode:** ${quickMode ? 'Quick (3 agents)' : 'Full (9 agents)'}\n\n` +
                     `## Agents Executed\n\n` +
                     agents.map((a, i) => `${i + 1}. ${a}`).join('\n') + '\n\n' +
                     `## Overview\n\n` +
                     `This analysis was conducted using the Azure Well-Architected Framework ` +
                     `principles to evaluate the architecture and provide recommendations.\n\n` +
                     `### Generated Artifacts\n\n` +
                     generatedFiles.map(f => `- [${f.name}](${f.url})`).join('\n') + '\n\n' +
                     `**Completed at:** ${new Date().toISOString()}\n`
        };

        await uploadFile('summary.md', summaryReport.summary);
        await uploadFile('full-report.json', JSON.stringify(summaryReport, null, 2));

        // Mark as completed
        sendStatus('completed', 100, null, agents, {
            message: 'Case study analysis completed successfully',
            mode: quickMode ? 'quick' : 'full',
            agentsRun: agents.length,
            summary: `Processed: ${caseStudyInput.substring(0, 100)}...`,
            artifactUrl: generatedFiles.find(f => f.name === 'summary.md')?.url,
            allFiles: generatedFiles
        });

        context.log(`✅ Job ${sessionId} completed successfully`);

    } catch (error) {
        context.log.error(`❌ Job ${sessionId} failed:`, error);

        sendStatus('failed', 0, null, [], null, error.message);

        throw error;
    }
};