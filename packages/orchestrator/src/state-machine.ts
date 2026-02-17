import { z } from 'zod';
import { RunPacketSchema, TimestampSchema } from '@meeting-to-demo/schemas';

// Define the core states of the pipeline
export const PipelineState = z.enum([
    'idle',
    'gate0', // Consent
    'gate1', // Select feature
    'clean_room',
    'enrichment', // ChatGPT
    'gate2', // Context Approval
    'prd_generation', // ChatPRD
    'gate3', // PRD Approval
    'data_mock_engine',
    'v0_prototype',
    'adaptation', // Antigravity
    'gate4', // Demo Review
    'push_asana',
    'gate5', // Final Push Approval
    'completed',
    'failed'
]);

export type PipelineState = z.infer<typeof PipelineState>;

export interface StateContext {
    state: PipelineState;
    data: z.infer<typeof RunPacketSchema>;
}

export class PipelineStateMachine {
    private currentState: PipelineState = 'idle';
    // Simplified for now until linking works perfectly
    private runPacket: any;

    constructor(runPacket: any) {
        this.runPacket = runPacket;
    }

    /* Transition Logic (Placeholder) */
    async transition(nextState: PipelineState) {
        if (this.currentState === nextState) return;

        // TODO: Validate transition rules
        console.log(`Transitioning from ${this.currentState} to ${nextState}`);
        this.currentState = nextState;
    }

    get state() {
        return this.currentState;
    }
}
