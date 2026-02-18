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
        await client.connect(transport, { timeout: 900000 });
        console.log("✅ Connected!");

        const request = await rl.question("\nEnter your Feature Request (or 'exit'): ");
        if (request.toLowerCase() === 'exit') process.exit(0);

        // ── Phase 0: Agent-in-the-Loop Prompt Refinement ──
        console.log(`\n🤖 handing off to Antigravity for refinement...`);

        const requestPath = path.join('.agent', 'refinement', 'request.md');
        const historyPath = path.join('.agent', 'refinement', 'refinement_history.md');
        const questionPath = path.join('.agent', 'refinement', 'agent_question.md');
        const answerPath = path.join('.agent', 'refinement', 'user_answer.md');
        const finalPath = path.join('.agent', 'refinement', 'final_prompt.md');

        // Ensure directory exists
        if (!fs.existsSync(path.dirname(requestPath))) {
            fs.mkdirSync(path.dirname(requestPath), { recursive: true });
        }

        // Clean up old session files
        [requestPath, questionPath, answerPath, finalPath].forEach(p => {
            if (fs.existsSync(p)) fs.unlinkSync(p);
        });

        // Write the initial request
        fs.writeFileSync(requestPath, `# Feature Request\n\n${request}`);

        // Initialize history
        fs.writeFileSync(historyPath, `# Refinement History\n\n## Initial Request\n${request}\n\n`);

        console.log(`\n✨ I've saved your request to: ${requestPath}`);
        console.log(`👉 Please ask Antigravity (me!) to check for questions.`);
        console.log(`   (I'll wait for questions in ${questionPath} or final prompt in ${finalPath})`);

        console.log(`\n... Waiting for Antigravity ...`);

        let refinedPrompt = request;

        // Interactive Loop
        while (true) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Poll every 2s

            // Check for FINAL PROMPT
            if (fs.existsSync(finalPath)) {
                console.log(`\n✅ Antigravity finalized the prompt!`);
                const finalContent = fs.readFileSync(finalPath, 'utf8');
                console.log(`📝 Refined Prompt:\n${finalContent}\n`);

                const confirm = await rl.question("Proceed with this prompt? (yes/edit): ");
                // TODO: Implement edit logic if needed
                refinedPrompt = finalContent;
                break;
            }

            // Check for QUESTION (State: WAITING_FOR_USER)
            if (fs.existsSync(questionPath)) {
                // Read the question
                const question = fs.readFileSync(questionPath, 'utf8');
                console.log(`\n🤖 Antigravity asks: ${question}`);

                // Get user answer (Blocking input)
                const answer = await rl.question("> ");

                // Write answer for Agent
                fs.writeFileSync(answerPath, answer);

                // Append to history for context
                fs.appendFileSync(historyPath, `\n## Agent Question\n${question}\n\n## User Answer\n${answer}\n\n`);

                // CRITICAL: Remove question file to signal "turn complete" to the loop state
                // The Agent will now see 'answerPath' exists and 'questionPath' is gone (if it checks)
                // But mainly Agent checks for 'answerPath'.
                try {
                    fs.unlinkSync(questionPath);
                } catch (e) {
                    // Ignore if already deleted, but it shouldn't be
                }

                console.log(`\n✨ Answer sent! Waiting for Antigravity...`);
                // Loop continues, now waiting for next Question or Final Prompt
            }
        }

        // ── Phase 1: ChatPRD ──
        console.log(`🚀 Starting Pipeline (Phase 1: ChatPRD)...`);
        const runFeatures = await client.callTool({
            name: "run_pipeline",
            arguments: { featureRequest: refinedPrompt }
        }, undefined, { timeout: 900000 }); // 15 minute timeout

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
                    console.log("\n🚀 Phase 2: Generating Prototype (v0 + Antigravity)...");
                    console.log("   (This involves AI generation and local branding, please wait ~1-2 mins)\n");

                    const approveResult = await client.callTool({
                        name: "approve_prd",
                        arguments: { runId }
                    }, undefined, { timeout: 900000 }); // 15 minute timeout

                    const approveData = JSON.parse(approveResult.content[0].text);
                    console.log("✅ Prototype Generation Complete!");

                    // The orchestrator already saved the branded code to the file at approveData.adaptedOutput
                    const protoPath = approveData.adaptedOutput;
                    console.log(`👉 Branded Prototype ready at: ${protoPath}`);
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
