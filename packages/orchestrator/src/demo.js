import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import * as EventSourceLib from 'eventsource';
import fs from 'fs';
import path from 'path';

// Polyfill EventSource for Node.js
const EventSource = EventSourceLib.default || EventSourceLib.EventSource || EventSourceLib;
global.EventSource = EventSource;

const REVIEW_DIR = path.resolve('review');

function formatPRD(prd) {
    if (!prd) return "No PRD Content";
    return `# ${prd.title || 'Untitled PRD'}

## Overview
${prd.overview || ''}

## Requirements
${(prd.requirements || []).map(r => `- [${r.priority}] ${r.description}`).join('\n')}

## Acceptance Criteria
${(prd.acceptanceCriteria || []).map(ac => `- ${ac}`).join('\n')}
`;
}

async function main() {
    console.log("-----------------------------------------");
    console.log("Meeting-to-Demo Orchestrator Demo");
    console.log("Living the HITL (Human-In-The-Loop) Life");
    console.log("-----------------------------------------");
    console.log(`ChatPRD Source: ${process.env.CHATPRD_MCP_CONFIG || 'Mock (if missing)'}`);
    console.log(`v0 Source: ${process.env.V0_API_KEY ? 'Real API' : 'Mock (if missing key)'}`);
    console.log("-----------------------------------------");

    const rl = createInterface({ input, output });

    console.log("Connecting to Orchestrator at http://localhost:3000/sse...");
    const transport = new SSEClientTransport(new URL("http://localhost:3000/sse"));
    const client = new Client(
        { name: "demo-client", version: "1.0.0" },
        { capabilities: {} }
    );

    try {
        await client.connect(transport);
        console.log("✅ Connected!");

        const request = await rl.question("\nEnter your Feature Request (or 'exit'): ");
        if (request.toLowerCase() === 'exit') process.exit(0);

        console.log(`\n🚀 Starting Pipeline (Phase 1: ChatPRD)...`);
        const runFeatures = await client.callTool({
            name: "run_pipeline",
            arguments: { featureRequest: request }
        });

        let runData;
        try {
            runData = JSON.parse(runFeatures.content[0].text);
        } catch (e) {
            console.error("Error/Raw Output:", runFeatures.content[0].text);
            return;
        }

        if (runData.error) {
            console.error("Error from Phase 1:", runData.error);
            return;
        }

        const runId = runData.runId;

        // Save PRD
        if (!fs.existsSync(REVIEW_DIR)) fs.mkdirSync(REVIEW_DIR, { recursive: true });

        const prdPath = path.join(REVIEW_DIR, `PRD-${runId.substring(0, 8)}.md`);
        fs.writeFileSync(prdPath, formatPRD(runData.prd));

        console.log(`\n📋 PRD Generated.`);
        console.log(`Saved to: ${prdPath}`);
        console.log(`\n--> ACTION REQUESTED: Open the file above, review/edit it, and then approve.`);

        while (true) {
            const answer = await rl.question("\nApprove PRD and generate Prototype? (yes/no): ");
            if (answer.toLowerCase() === 'no') {
                console.log("❌ Rejected.");
                break;
            }
            if (['yes', 'y'].includes(answer.toLowerCase())) {
                console.log(`\n🚀 Phase 2: Generating Prototype via v0...`);
                try {
                    const approveResult = await client.callTool({
                        name: "approve_prd",
                        arguments: { runId }
                    });

                    const approveData = JSON.parse(approveResult.content[0].text);
                    const protoPath = path.join(REVIEW_DIR, `Prototype-${runId.substring(0, 8)}.tsx`);

                    fs.writeFileSync(protoPath, approveData.v0Output);

                    console.log(`\n✅ Prototype Generated!`);
                    console.log(`Saved to: ${protoPath}`);
                } catch (e) {
                    console.error("❌ Phase 2 Failed:", e.message);
                }
                break;
            }
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await client.close();
        rl.close();
    }
}

main();
