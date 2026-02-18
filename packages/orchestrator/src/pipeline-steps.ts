import { RunPacket } from "@meeting-to-demo/schemas";
import { PipelineStep } from "./pipeline-runner.js";
import {
    IChatPRDAdapter,
    IVercelAdapter,
} from "@meeting-to-demo/adapters";
import { v4 as uuidv4 } from 'uuid';

/**
 * Step 1: Generate a PRD and UIContract from the feature brief using ChatPRD.
 */
export class ChatPRDStep implements PipelineStep {
    name = "ChatPRD: Generate PRD";
    private adapter: IChatPRDAdapter;

    constructor(adapter: IChatPRDAdapter) {
        this.adapter = adapter;
    }

    async execute(run: RunPacket): Promise<RunPacket> {
        if (!run.contextPacket && !run.featureBrief) {
            throw new Error("No feature brief or context packet to generate PRD from.");
        }

        // Build a ContextPacket from featureBrief if one doesn't exist yet
        const context = run.contextPacket || {
            accountId: uuidv4(),
            projectContext: run.featureBrief.context || 'Feature request',
            scope: run.featureBrief.features.map(f => f.title).join(', '),
            assumptions: [],
            openQuestions: []
        };

        const { prd, uiContract } = await this.adapter.generatePRD(context);

        return {
            ...run,
            contextPacket: context,
            prd,
            uiContract,
        };
    }
}

/**
 * Step 2: Generate a prototype using Vercel v0 from the UIContract.
 */
export class V0Step implements PipelineStep {
    name = "Vercel v0: Generate Prototype";
    private adapter: IVercelAdapter;

    constructor(adapter: IVercelAdapter) {
        this.adapter = adapter;
    }

    async execute(run: RunPacket): Promise<RunPacket> {
        if (!run.uiContract) {
            throw new Error("No UI contract to generate prototype from. Run ChatPRD step first.");
        }

        const fixtures = run.fixtures || "export const fixtures = {};";
        const v0Output = await this.adapter.generatePrototype(run.uiContract, fixtures);

        return {
            ...run,
            fixtures,
            v0Output,
        };
    }
}

/**
 * Step 3: Antigravity adaptation — returns the run to the IDE for review.
 * In the future, this could call Antigravity APIs to auto-edit UI.
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { IAntigravityAdapter } from "@meeting-to-demo/adapters";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class AntigravityStep implements PipelineStep {
    name = "Antigravity: Prepare for IDE Review";
    private adapter: IAntigravityAdapter;

    constructor(adapter: IAntigravityAdapter) {
        this.adapter = adapter;
    }

    async execute(run: RunPacket): Promise<RunPacket> {
        if (!run.v0Output) {
            throw new Error("No v0 output to adapt. Run V0 step first.");
        }

        console.log(`[AntigravityStep] Adapting prototype for run ${run.runId}...`);
        const adaptedCode = await this.adapter.adaptPrototype(run.v0Output);

        // Save to review directory
        const reviewDir = path.resolve(__dirname, '../../../review');
        if (!fs.existsSync(reviewDir)) {
            fs.mkdirSync(reviewDir, { recursive: true });
        }

        const filename = `Ampliwork-${run.runId.substring(0, 8)}.tsx`;
        const filePath = path.join(reviewDir, filename);

        fs.writeFileSync(filePath, adaptedCode);
        console.log(`[AntigravityStep] Saved adapted prototype to ${filePath}`);

        return {
            ...run,
            adaptedOutput: filePath,
        };
    }
}
