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
export class AntigravityStep implements PipelineStep {
    name = "Antigravity: Prepare for IDE Review";

    async execute(run: RunPacket): Promise<RunPacket> {
        // For now, this step just marks the run as ready for review.
        // In the future, this could invoke Antigravity IDE APIs.
        return {
            ...run,
            adaptedOutput: `Ready for IDE review. v0 output: ${run.v0Output || 'none'}`,
        };
    }
}
