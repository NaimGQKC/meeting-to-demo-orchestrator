import { RunPacket } from "@meeting-to-demo/schemas";

/**
 * A single step in the pipeline.
 * Implement this interface to add new steps (e.g., ChatGPT enrichment, Asana push).
 * 
 * Usage:
 *   runner.addStep(new MyStep());       // Add at end
 *   runner.prependStep(new MyStep());   // Add at beginning
 */
export interface PipelineStep {
    name: string;
    execute(run: RunPacket): Promise<RunPacket>;
}

/**
 * Runs an ordered list of PipelineSteps against a RunPacket.
 * Designed to be extensible: just addStep() or prependStep() to grow the pipeline.
 */
export class PipelineRunner {
    private steps: PipelineStep[] = [];

    /** Append a step to the end of the pipeline. */
    addStep(step: PipelineStep): PipelineRunner {
        this.steps.push(step);
        return this;
    }

    /** Prepend a step to the beginning of the pipeline. */
    prependStep(step: PipelineStep): PipelineRunner {
        this.steps.unshift(step);
        return this;
    }

    /** Insert a step at a specific index. */
    insertStep(index: number, step: PipelineStep): PipelineRunner {
        this.steps.splice(index, 0, step);
        return this;
    }

    /** Get the list of step names (for debugging / logging). */
    getStepNames(): string[] {
        return this.steps.map(s => s.name);
    }

    /** Execute all steps in order. Each step receives the RunPacket from the previous step. */
    async run(initialRun: RunPacket): Promise<RunPacket> {
        let current = initialRun;

        for (let i = 0; i < this.steps.length; i++) {
            const step = this.steps[i];
            console.log(`▶ [${i + 1}/${this.steps.length}] Running step: ${step.name}`);

            try {
                current = await step.execute(current);
                current.updatedAt = new Date().toISOString();
                console.log(`  ✓ Step "${step.name}" completed.`);
            } catch (err: any) {
                console.error(`  ✗ Step "${step.name}" failed: ${err.message}`);
                current.status = 'failed';
                current.updatedAt = new Date().toISOString();
                throw new Error(`Pipeline failed at step "${step.name}": ${err.message}`);
            }
        }

        current.status = 'completed';
        return current;
    }
}
