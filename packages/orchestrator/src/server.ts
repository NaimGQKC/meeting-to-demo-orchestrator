import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import * as dotenv from "dotenv";
import express from "express";
import { OrchestratorService } from "./service.js";
import { setupWebhooks } from "./webhooks.js";

dotenv.config();

const server = new Server(
    {
        name: "meeting-to-demo-orchestrator",
        version: "0.0.1",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

const orchestrator = new OrchestratorService();

const StartRunTool: Tool = {
    name: "start_run",
    description: "Start a new Meeting-to-Demo run from a Circleback meeting ID.",
    inputSchema: {
        type: "object",
        properties: {
            meetingId: { type: "string", description: "The ID of the meeting in Circleback" },
        },
        required: ["meetingId"],
    },
};

const StartManualRunTool: Tool = {
    name: "start_manual_run",
    description: "Start a new Meeting-to-Demo run by manually describing the feature.",
    inputSchema: {
        type: "object",
        properties: {
            title: { type: "string", description: "Title of the feature" },
            description: { type: "string", description: "Detailed description of the feature" },
        },
        required: ["title", "description"],
    },
};

const StartRunFromJsonTool: Tool = {
    name: "start_run_from_json",
    description: "Start a new run by pasting a JSON object containing 'features' or 'actionItems'.",
    inputSchema: {
        type: "object",
        properties: {
            jsonInput: { type: "string", description: "Raw JSON string from Circleback or ChatGPT" }
        },
        required: ["jsonInput"]
    }
};

const StartRunFromTextTool: Tool = {
    name: "start_run_from_text",
    description: "Start a new run by directly providing a raw text description of features.",
    inputSchema: {
        type: "object",
        properties: {
            rawText: { type: "string", description: "The raw text description of the feature request or meeting notes." }
        },
        required: ["rawText"]
    }
};

const RunPipelineTool: Tool = {
    name: "run_pipeline",
    description: "Start the pipeline: generates a PRD via ChatPRD, then PAUSES for your review. Returns the PRD so you can review/modify it. Call approve_prd to send it to v0.",
    inputSchema: {
        type: "object",
        properties: {
            featureRequest: { type: "string", description: "The feature request or description to generate a PRD for." }
        },
        required: ["featureRequest"]
    }
};

const ApprovePRDTool: Tool = {
    name: "approve_prd",
    description: "Approve the PRD after reviewing it. This sends the PRD to v0 to generate the prototype, which then goes to GitHub.",
    inputSchema: {
        type: "object",
        properties: {
            runId: { type: "string", description: "The run ID from run_pipeline." }
        },
        required: ["runId"]
    }
};


const GetRunTool: Tool = {
    name: "get_run",
    description: "Get the full details of a run by ID.",
    inputSchema: {
        type: "object",
        properties: {
            runId: { type: "string" },
        },
        required: ["runId"],
    },
};

const UpdateRunDataTool: Tool = {
    name: "update_run_data",
    description: "Update the data of an existing run (e.g., featureBrief, contextPacket, prd).",
    inputSchema: {
        type: "object",
        properties: {
            runId: { type: "string" },
            data: { type: "object", description: "Partial RunPacket data to merge" }
        },
        required: ["runId", "data"]
    }
};

const ListRunsTool: Tool = {
    name: "list_runs",
    description: "List all runs.",
    inputSchema: {
        type: "object",
        properties: {},
    },
};

const ApproveGate1Tool: Tool = {
    name: "approve_gate_1",
    description: "Approve Gate 1: Select features and enrich context.",
    inputSchema: {
        type: "object",
        properties: {
            runId: { type: "string" },
            featureIndices: {
                type: "array",
                items: { type: "number" },
                description: "Indices of features to include"
            },
        },
        required: ["runId", "featureIndices"],
    },
};

const ApproveGate2Tool: Tool = {
    name: "approve_gate_2",
    description: "Approve Gate 2: Context Packet approved -> Generate PRD.",
    inputSchema: {
        type: "object",
        properties: {
            runId: { type: "string" }
        },
        required: ["runId"]
    }
};

const ApproveGate3Tool: Tool = {
    name: "approve_gate_3",
    description: "Approve Gate 3: PRD approved -> Generate Prototype.",
    inputSchema: {
        type: "object",
        properties: {
            runId: { type: "string" }
        },
        required: ["runId"]
    }
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        StartRunTool,
        StartManualRunTool,
        StartRunFromJsonTool,
        StartRunFromTextTool,
        RunPipelineTool,
        ApprovePRDTool,
        GetRunTool,
        UpdateRunDataTool,
        ListRunsTool,
        ApproveGate1Tool,
        ApproveGate2Tool,
        ApproveGate3Tool
    ],
}));

async function handleToolCall(request: any) {
    const { name, arguments: args } = request.params;

    try {
        if (name === "start_run") {
            const { meetingId } = args as { meetingId: string };
            const run = await orchestrator.startRun(meetingId);
            return {
                content: [{ type: "text", text: `Run started: ${run.runId}` }],
            };
        } else if (name === "start_manual_run") {
            const { title, description } = args as { title: string; description: string };
            const run = await orchestrator.startManualRun(title, description);
            return {
                content: [{ type: "text", text: `Manual run started: ${run.runId}` }],
            };
        } else if (name === "start_run_from_json") {
            const { jsonInput } = args as { jsonInput: string };
            const run = await orchestrator.startRunFromJson(jsonInput);
            return {
                content: [{ type: "text", text: `Run started from JSON: ${run.runId}` }]
            };
        } else if (name === "start_run_from_text") {
            const { rawText } = args as { rawText: string };
            const run = await orchestrator.startRunFromText(rawText);
            return {
                content: [{ type: "text", text: `Run started from text: ${run.runId}` }]
            };
        } else if (name === "run_pipeline") {
            const { featureRequest } = args as { featureRequest: string };
            const run = await orchestrator.runPipeline(featureRequest);
            return {
                content: [{
                    type: "text", text: JSON.stringify({
                        runId: run.runId,
                        status: run.status,
                        message: "PRD generated. Review it below, then call approve_prd with the runId to send to v0.",
                        prd: run.prd ? {
                            title: run.prd.title,
                            overview: run.prd.overview,
                            requirements: run.prd.requirements,
                            acceptanceCriteria: run.prd.acceptanceCriteria
                        } : null,
                        uiContract: run.uiContract,
                    }, null, 2)
                }]
            };
        } else if (name === "approve_prd") {
            const { runId } = args as { runId: string };
            const run = await orchestrator.approvePRD(runId);
            return {
                content: [{
                    type: "text", text: JSON.stringify({
                        runId: run.runId,
                        status: run.status,
                        message: "PRD approved and sent to v0. Prototype generated.",
                        v0Output: run.v0Output,
                        adaptedOutput: run.adaptedOutput,
                    }, null, 2)
                }]
            };
        } else if (name === "get_run") {
            const { runId } = args as { runId: string };
            const run = await orchestrator.getRun(runId);
            return {
                content: [{ type: "text", text: JSON.stringify(run, null, 2) }]
            };
        } else if (name === "update_run_data") {
            const { runId, data } = args as { runId: string; data: any };
            const run = await orchestrator.updateRunData(runId, data);
            return {
                content: [{ type: "text", text: `Run ${runId} updated successfully.` }]
            };
        } else if (name === "list_runs") {
            const runs = await orchestrator.listRuns();
            return {
                content: [{ type: "text", text: JSON.stringify(runs.map(r => ({ id: r.runId, status: r.status })), null, 2) }]
            };
        } else if (name === "approve_gate_1") {
            const { runId, featureIndices } = args as { runId: string; featureIndices: number[] };
            const run = await orchestrator.approveGate1(runId, featureIndices);
            return {
                content: [{ type: "text", text: `Gate 1 Approved. Run status: ${run.status}. Context generated.` }]
            };
        } else if (name === "approve_gate_2") {
            const { runId } = args as { runId: string };
            const run = await orchestrator.approveGate2(runId);
            return {
                content: [{ type: "text", text: `Gate 2 Approved. PRD Generated.` }]
            };
        } else if (name === "approve_gate_3") {
            const { runId } = args as { runId: string };
            const run = await orchestrator.approveGate3(runId);
            return {
                content: [{ type: "text", text: `Gate 3 Approved. Prototype Generated.` }]
            };
        }
    } catch (error: any) {
        return {
            content: [{ type: "text", text: `Error: ${error.message}` }],
            isError: true,
        };
    }

    throw new Error(`Unknown tool: ${name}`);
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return handleToolCall(request);
});


async function main() {
    const app = express();
    const port = process.env.PORT || 3000;

    // Setup Webhooks
    setupWebhooks(app, orchestrator);

    // ─── SSE Transport (for ChatGPT / remote MCP clients) ───
    // We need a separate Server instance for SSE since each Server
    // can only have one transport connected at a time.
    let sseTransport: SSEServerTransport | null = null;

    app.get("/sse", async (req, res) => {
        console.error("[SSE] New client connected");
        sseTransport = new SSEServerTransport("/messages", res);

        // Create a new MCP server for this SSE session
        const sseServer = new Server(
            { name: "meeting-to-demo-orchestrator", version: "0.0.1" },
            { capabilities: { tools: {} } }
        );

        // Re-register the same tool handlers on the SSE server
        sseServer.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                StartRunTool,
                StartManualRunTool,
                StartRunFromJsonTool,
                StartRunFromTextTool,
                RunPipelineTool,
                GetRunTool,
                UpdateRunDataTool,
                ListRunsTool,
                ApproveGate1Tool,
                ApproveGate2Tool,
                ApproveGate3Tool
            ],
        }));

        sseServer.setRequestHandler(CallToolRequestSchema, async (request) => {
            return handleToolCall(request);
        });

        await sseServer.connect(sseTransport);
    });

    app.post("/messages", async (req, res) => {
        if (!sseTransport) {
            res.status(400).json({ error: "No SSE connection established. Connect to /sse first." });
            return;
        }
        await sseTransport.handlePostMessage(req, res);
    });

    app.listen(port, () => {
        console.error(`Webhook + SSE server listening on port ${port}`);
        console.error(`  SSE endpoint: http://localhost:${port}/sse`);
        console.error(`  Messages endpoint: http://localhost:${port}/messages`);
    });

    // ─── Stdio Transport (for local IDE use) ───
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Orchestrator MCP Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main loop:", error);
    process.exit(1);
});
