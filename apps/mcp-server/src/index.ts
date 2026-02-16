import path from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { z } from "@modelcontextprotocol/sdk/shared/zod.js";

import { FeatureBrief, GateName } from "@m2d/schemas";
import { FsRunStore, newRunId, nowIso } from "@m2d/core";

// ⚠️ IMPORTANT: for stdio servers, never log to stdout.
// Use stderr only.
function log(...args: any[]) {
    console.error("[m2d-mcp-server]", ...args);
}

const RUNS_DIR = process.env.RUNS_DIR ?? path.join(process.cwd(), "runs");
const store = new FsRunStore(RUNS_DIR);

const server = new Server(
    { name: "meeting-to-demo-orchestrator", version: "0.0.1" },
    { capabilities: { tools: {} } }
);

/**
 * Tool: start_run
 * Input: FeatureBrief
 * Output: RunPacket
 */
server.tool(
    "start_run",
    {
        feature: z.object({
            id: z.string(),
            title: z.string(),
            problem_statement: z.string(),
            proposed_solution: z.string(),
            persona: z.string().optional(),
            meeting_context: z.string().optional(),
            supporting_quotes: z.array(z.string()).optional(),
            scope_in: z.array(z.string()).optional(),
            scope_out: z.array(z.string()).optional(),
            constraints: z.array(z.string()).optional(),
            open_questions: z.array(z.string()).optional(),
            acceptance_criteria_draft: z.array(z.string()).optional(),
            confidence: z.enum(["low", "med", "high"]).optional(),
            ambiguity_notes: z.array(z.string()).optional()
        })
    },
    async ({ feature }) => {
        const run_id = newRunId();
        const packet = {
            run_id,
            created_at: nowIso(),
            stage: "awaiting_gate1" as const,
            version: 1,
            feature_brief: feature as FeatureBrief,
            approvals: []
        };

        store.save(packet);
        log("Created run", run_id);

        return {
            content: [{ type: "text", text: JSON.stringify(packet, null, 2) }]
        };
    }
);

/**
 * Tool: approve_gate
 * Input: run_id, gate, notes
 * Output: updated RunPacket
 */
server.tool(
    "approve_gate",
    {
        run_id: z.string(),
        gate: z.enum([
            "gate0_consent",
            "gate1_feature_select",
            "gate2_context_packet",
            "gate3_prd",
            "gate4_demo_review",
            "gate5_asana_push"
        ]),
        notes: z.string().optional()
    },
    async ({ run_id, gate, notes }) => {
        const packet = store.load(run_id);

        // Minimal stage transitions for now (we’ll tighten later)
        const nextStage = (() => {
            if (gate === "gate1_feature_select") return "awaiting_gate2";
            if (gate === "gate2_context_packet") return "awaiting_gate3";
            if (gate === "gate3_prd") return "generating_v0";
            if (gate === "gate4_demo_review") return "awaiting_gate5";
            if (gate === "gate5_asana_push") return "done";
            return packet.stage;
        })();

        const updated = {
            ...packet,
            stage: nextStage,
            approvals: [
                ...packet.approvals,
                { gate: gate as GateName, approved_at: nowIso(), notes }
            ]
        };

        store.save(updated);
        log("Approved gate", gate, "for", run_id);

        return {
            content: [{ type: "text", text: JSON.stringify(updated, null, 2) }]
        };
    }
);

/**
 * Tool: get_status
 * Input: run_id
 * Output: RunPacket
 */
server.tool(
    "get_status",
    { run_id: z.string() },
    async ({ run_id }) => {
        const packet = store.load(run_id);
        return {
            content: [{ type: "text", text: JSON.stringify(packet, null, 2) }]
        };
    }
);

/**
 * Tool: export_run_packet
 * Input: run_id
 * Output: path + RunPacket json
 */
server.tool(
    "export_run_packet",
    { run_id: z.string() },
    async ({ run_id }) => {
        const packet = store.load(run_id);
        const exportPath = store.packetPath(run_id);
        return {
            content: [
                { type: "text", text: JSON.stringify({ exportPath, packet }, null, 2) }
            ]
        };
    }
);

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log("MCP server running via stdio. RUNS_DIR =", RUNS_DIR);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
