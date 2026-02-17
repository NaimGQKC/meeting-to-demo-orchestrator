import * as fs from 'fs';
import * as path from 'path';
import { RunPacket, RunPacketSchema } from '@meeting-to-demo/schemas';
import { z } from 'zod';

const DATA_DIR = path.resolve(process.cwd(), 'data', 'runs');

export class RunManager {
    constructor() {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
    }

    private getFilePath(runId: string): string {
        return path.join(DATA_DIR, `${runId}.json`);
    }

    async saveRun(run: RunPacket): Promise<void> {
        const filePath = this.getFilePath(run.runId);
        fs.writeFileSync(filePath, JSON.stringify(run, null, 2));
    }

    async getRun(runId: string): Promise<RunPacket | null> {
        const filePath = this.getFilePath(runId);
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const data = fs.readFileSync(filePath, 'utf-8');
        try {
            const json = JSON.parse(data);
            // Validate with schema, but allow partials if schemas evolve (for now strictly validate)
            return RunPacketSchema.parse(json);
        } catch (e) {
            console.error(`Error parsing run ${runId}:`, e);
            return null;
        }
    }

    async listRuns(): Promise<RunPacket[]> {
        const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
        const runs: RunPacket[] = [];
        for (const file of files) {
            const runId = file.replace('.json', '');
            const run = await this.getRun(runId);
            if (run) runs.push(run);
        }
        return runs; // Sort by date?
    }
}
