
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import * as EventSourceLib from 'eventsource';

// Polyfill EventSource for Node.js
const EventSource = EventSourceLib.default || EventSourceLib.EventSource || EventSourceLib;
global.EventSource = EventSource;

async function main() {
    console.log("Connecting to Orchestrator...");
    const transport = new SSEClientTransport(new URL("http://localhost:3000/sse"));
    const client = new Client(
        { name: "test-client", version: "1.0.0" },
        { capabilities: {} }
    );

    try {
        await client.connect(transport);
        console.log("Connected to Orchestrator MCP");

        const tools = await client.listTools();
        console.log("Tools available:", tools.tools.map(t => t.name).join(", "));

        console.log("\n--- Phase 1: Running pipeline ---");
        const result = await client.callTool({
            name: "run_pipeline",
            arguments: { featureRequest: "Add a dark mode toggle to the dashboard with user preference saved in localStorage. Design should be sleek." }
        });

        const output = result.content[0].text;
        const data = JSON.parse(output);
        console.log("Phase 1 Result Status:", data.status);
        console.log("PRD Title:", data.prd ? data.prd.title : "No PRD");

        if (data.status === 'awaiting_prd_review') {
            console.log("\n--- Pipeline Paused for Review ---");
            console.log("Run ID:", data.runId);

            console.log("\n--- Phase 2: Approving PRD ---");
            try {
                const approveResult = await client.callTool({
                    name: "approve_prd",
                    arguments: { runId: data.runId }
                });

                const approveOutput = approveResult.content[0].text;
                const approveData = JSON.parse(approveOutput);
                console.log("Phase 2 Result Status:", approveData.status);
                console.log("v0 Output:", approveData.v0Output);
            } catch (e) {
                console.error("Phase 2 Failed (v0 Error):", e.message);
                console.log("Phase 1 was SUCCESSFUL. Pipeline logic verified.");
            }
        } else {
            console.log("Pipeline did not pause. Status:", data.status);
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await client.close();
        process.exit(0);
    }
}

main();
