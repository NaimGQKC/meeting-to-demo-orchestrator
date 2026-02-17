import express from 'express';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import { OrchestratorService } from './service.js';
import { v4 as uuidv4 } from 'uuid';

export function setupWebhooks(app: express.Application, orchestrator: OrchestratorService) {
    const jsonParser = bodyParser.json();

    // Basic home page for health check/verification
    app.get('/', (req, res) => {
        res.send(`
            <h1>Meeting-to-Demo Orchestrator</h1>
            <p>Status: 🟢 Running</p>
            <p>Webhook Endpoint: <code>POST /webhooks/circleback</code></p>
            <p>To test Circleback, paste this URL into your browser (if it's a GET) or use it as the Webhook Endpoint in Circleback configuration.</p>
        `);
    });

    app.post('/webhooks/circleback', jsonParser, async (req, res) => {
        const signature = req.headers['x-signature'] as string;
        const secret = process.env.CIRCLEBACK_WEBHOOK_SECRET;

        // Verify signature if secret is provided
        if (secret && signature) {
            const hmac = crypto.createHmac('sha256', secret);
            const body = JSON.stringify(req.body);
            const expectedSignature = hmac.update(body).digest('hex');

            if (signature !== expectedSignature) {
                console.error('Invalid Circleback webhook signature');
                return res.status(401).send('Invalid signature');
            }
        }

        const data = req.body;
        console.log('Received Circleback webhook header x-signature:', signature);
        console.log('Received Circleback webhook body:', JSON.stringify(data, null, 2));

        try {
            // Map Circleback data to our FeatureBrief
            // Circleback sends 'featureRecos' (as seen in UI) or 'featureReco'
            const rawFeatures = data.featureReco || data.featureRecos || data.actionItems || [];

            console.log(`Mapping ${rawFeatures.length} raw features from Circleback...`);

            const features = rawFeatures.map((item: any) => ({
                id: uuidv4(),
                title: item.title || item.name || 'Untitled Feature',
                description: item.description || item.reason || 'Feature recommendation from Circleback',
                priority: item.priority?.toLowerCase() === 'high' ? 'high' : (item.priority?.toLowerCase() === 'low' ? 'low' : 'medium')
            }));

            if (features.length === 0 && data.name) {
                features.push({
                    id: uuidv4(),
                    title: `Meeting: ${data.name}`,
                    description: 'No specific features or action items found, but meeting processed.',
                    priority: 'low'
                });
            }

            const run = await orchestrator.startManualRun(
                data.name || 'Circleback Meeting',
                data.summary || data.overview || 'Processed from Circleback webhook'
            );

            // Directly inject the features we parsed
            run.featureBrief.features = features;
            run.featureBrief.meetingId = String(data.id || 'unknown');

            await (orchestrator as any).runManager.saveRun(run);

            console.log(`Run ${run.runId} created with ${features.length} features.`);
            res.status(200).json({
                runId: run.runId,
                featureCount: features.length,
                message: 'Automatic run started from webhook'
            });
        } catch (error) {
            console.error('Error processing Circleback webhook:', error);
            res.status(500).send('Internal Server Error');
        }
    });
}
