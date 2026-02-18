import {
    RunPacket,
    FeatureBrief,
    ContextPacket,
    PRD,
    UIContract,
    FeatureBriefSchema,
} from "@meeting-to-demo/schemas";
import { RunManager } from "./run-manager.js";
import { PipelineRunner } from "./pipeline-runner.js";
import { ChatPRDStep, V0Step, AntigravityStep } from "./pipeline-steps.js";
import {
    ICirclebackAdapter,
    IChatGPTAdapter,
    IChatPRDAdapter,
    IVercelAdapter,
    IAntigravityAdapter,
    IIntegrationAdapter,
    IPromptRefinerAdapter,
    CirclebackMCPAdapter,
    ChatGPTAdapter,
    ChatPRDAdapter,
    ChatPRDMCPAdapter,
    V0MCPAdapter,
    AntigravityAdapter,
    MockCirclebackAdapter,
    MockChatGPTAdapter,
    MockChatPRDAdapter,
    MockVercelAdapter,
    MockAntigravityAdapter,
    MockIntegrationAdapter,
    MockPromptRefinerAdapter,
} from "@meeting-to-demo/adapters";

import { v4 as uuidv4 } from 'uuid';

class ResilientChatPRDAdapter implements IChatPRDAdapter {
    private real: IChatPRDAdapter;
    private mock: IChatPRDAdapter;

    constructor(real: IChatPRDAdapter, mock: IChatPRDAdapter) {
        this.real = real;
        this.mock = mock;
    }

    async generatePRD(context: ContextPacket): Promise<{ prd: PRD; uiContract: UIContract }> {
        try {
            console.log('[ResilientChatPRD] Attempting to use REAL ChatPRD Adapter...');
            return await this.real.generatePRD(context);
        } catch (error) {
            console.error('[ResilientChatPRD] Real ChatPRD failed (likely Auth/401 or Network). Falling back to Mock.');
            console.log('[ResilientChatPRD] Using Mock PRD so pipeline can continue.');
            return await this.mock.generatePRD(context);
        }
    }
}

export class OrchestratorService {
    private runManager: RunManager;
    private circleback: ICirclebackAdapter;
    private chatGPT: IChatGPTAdapter;
    private chatPRD: IChatPRDAdapter;
    private vercel: IVercelAdapter;
    private antigravity: IAntigravityAdapter;
    private integration: IIntegrationAdapter;
    private promptRefiner: IPromptRefinerAdapter;

    constructor() {
        this.runManager = new RunManager();

        // Use real Circleback MCP if URL is provided, otherwise mock
        const circlebackUrl = process.env.CIRCLEBACK_MCP_URL || "https://app.circleback.ai/api/mcp";
        if (process.env.NODE_ENV === 'production' || process.env.USE_REAL_CIRCLEBACK === 'true') {
            this.circleback = new CirclebackMCPAdapter(circlebackUrl);
        } else {
            this.circleback = new MockCirclebackAdapter();
        }

        // Use real ChatPRD MCP if URL is provided
        this.chatGPT = new MockChatGPTAdapter();

        // Parse CHATPRD_MCP_CONFIG which can be a URL string or a JSON object
        let chatPRDConfigRaw = process.env.CHATPRD_MCP_CONFIG;
        let chatPRDUrl: string | undefined;
        let chatPRDKey: string | undefined;

        if (chatPRDConfigRaw) {
            try {
                // Try parsing as JSON first
                const parsed = JSON.parse(chatPRDConfigRaw);

                // Check standard structure: mcpServers.chatprd
                let serverConfig = parsed.mcpServers?.chatprd;

                // Check user variant: mcp.servers.ChatPRD
                if (!serverConfig) {
                    serverConfig = parsed.mcp?.servers?.ChatPRD;
                }

                if (serverConfig) {
                    chatPRDUrl = serverConfig.url;
                    // Extract token from headers if present
                    const authHeader = serverConfig.headers?.Authorization;
                    if (authHeader) {
                        chatPRDKey = authHeader.replace(/^Bearer\s+/i, '');
                    }
                }
            } catch (e) {
                // Not JSON, assume it's a direct URL string
                if (chatPRDConfigRaw.startsWith('http')) {
                    chatPRDUrl = chatPRDConfigRaw;
                }
            }
        }

        if (chatPRDUrl) {
            console.log(`[Orchestrator] Configured REAL ChatPRD Adapter at ${chatPRDUrl}`);
            const realAdapter = new (ChatPRDMCPAdapter as any)(chatPRDUrl, chatPRDKey);
            // Use Resilient wrapper to standout 401 errors
            this.chatPRD = new ResilientChatPRDAdapter(realAdapter, new MockChatPRDAdapter());
        } else {
            console.log('[Orchestrator] Using Mock ChatPRD adapter (No valid Config found)');
            this.chatPRD = new MockChatPRDAdapter();
        }

        // Use real v0 MCP adapter if V0_API_KEY is present
        const v0Key = process.env.V0_API_KEY;
        if (v0Key) {
            this.vercel = new V0MCPAdapter(v0Key);
            console.log('[Orchestrator] Using real v0 MCP adapter');
        } else {
            this.vercel = new MockVercelAdapter();
            console.log('[Orchestrator] Using mock v0 adapter');
        }

        this.antigravity = new AntigravityAdapter();
        this.integration = new MockIntegrationAdapter();

        // Prompt Refiner — placeholder, user will swap with real AI adapter
        this.promptRefiner = new MockPromptRefinerAdapter();
        console.log('[Orchestrator] Using Mock Prompt Refiner (placeholder)');
    }

    async startRun(meetingId: string): Promise<RunPacket> {
        const brief = await this.circleback.getFeatureBrief(meetingId);

        const runPacket: RunPacket = {
            runId: uuidv4(),
            featureBrief: brief,
            approvals: [],
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.runManager.saveRun(runPacket);
        return runPacket;
    }

    async startManualRun(title: string, description: string): Promise<RunPacket> {
        const runPacket: RunPacket = {
            runId: uuidv4(),
            featureBrief: {
                meetingId: 'manual',
                meetingDate: new Date().toISOString(),
                features: [
                    {
                        id: uuidv4(),
                        title,
                        description,
                        priority: 'medium'
                    }
                ],
                context: 'Manual Input'
            },
            approvals: [],
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.runManager.saveRun(runPacket);
        return runPacket;
    }

    async startRunFromText(rawText: string): Promise<RunPacket> {
        // Step 1: AI Formats the feature
        const brief = await this.chatGPT.formatFeatureBrief(rawText);

        // Step 2: AI Enriches the context (Automatic enrichment before HITL)
        const context = await this.chatGPT.enrichContext(brief);

        const runPacket: RunPacket = {
            runId: uuidv4(),
            featureBrief: brief,
            contextPacket: context,
            approvals: [],
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.runManager.saveRun(runPacket);
        return runPacket;
    }

    /**
     * Refine a raw feature request using AI.
     * May return clarifying questions; call again with answers to finalize.
     */
    async refinePrompt(rawRequest: string, previousAnswers?: Record<string, string>) {
        return this.promptRefiner.refinePrompt(rawRequest, previousAnswers);
    }

    /**
     * Phase 1: Generate PRD via ChatPRD, then PAUSE for human review.
     * The PRD is returned so the user can see and modify it in Antigravity.
     * Call approvePRD(runId) to continue to v0.
     */
    async runPipeline(rawText: string): Promise<RunPacket> {
        const brief: FeatureBrief = {
            meetingId: 'direct-input',
            meetingDate: new Date().toISOString(),
            features: [{
                id: uuidv4(),
                title: rawText.substring(0, 80),
                description: rawText,
                priority: 'high'
            }],
            context: rawText,
        };

        const initialRun: RunPacket = {
            runId: uuidv4(),
            featureBrief: brief,
            approvals: [],
            status: 'in-progress',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.runManager.saveRun(initialRun);

        // Phase 1: Only run ChatPRD
        const runner = new PipelineRunner();
        runner.addStep(new ChatPRDStep(this.chatPRD));

        console.log(`Phase 1: Generating PRD for Run ${initialRun.runId}...`);

        const startTime = Date.now();
        const afterPRD = await runner.run(initialRun);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`Phase 1: ChatPRD finished in ${duration}s.`);

        // PAUSE — mark as awaiting review
        afterPRD.status = 'awaiting_prd_review';
        afterPRD.updatedAt = new Date().toISOString();
        await this.runManager.saveRun(afterPRD);

        console.log(`PRD generated. Run ${afterPRD.runId} is awaiting review.`);
        return afterPRD;
    }

    /**
     * Phase 2: User has reviewed/modified the PRD. Send it to v0 and complete.
     * Call this after reviewing the PRD from runPipeline().
     */
    async approvePRD(runId: string): Promise<RunPacket> {
        const run = await this.runManager.getRun(runId);
        if (!run) throw new Error(`Run not found: ${runId}`);
        if (run.status !== 'awaiting_prd_review') {
            throw new Error(`Run ${runId} is not awaiting PRD review (status: ${run.status})`);
        }

        // Phase 2: v0 + Antigravity
        run.status = 'in-progress';
        const runner = new PipelineRunner();
        runner.addStep(new V0Step(this.vercel));
        runner.addStep(new AntigravityStep(this.antigravity));

        console.log(`Phase 2: [1/2] Generating v0 Prototype via API...`);
        const startTime = Date.now();
        const result = await runner.run(run);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log(`Phase 2: [2/2] Antigravity Refinement Handshake complete.`);
        console.log(`Phase 2: v0 + Antigravity total duration: ${duration}s.`);
        await this.runManager.saveRun(result);

        console.log(`Pipeline complete. Run ${result.runId} finished.`);
        return result;
    }

    async startRunFromJson(jsonInput: string): Promise<RunPacket> {
        let parsedData: any;
        try {
            parsedData = JSON.parse(jsonInput);
        } catch (e) {
            throw new Error("Invalid JSON input");
        }

        const features = (parsedData.features || parsedData.actionItems || []).map((item: any) => ({
            id: uuidv4(),
            title: item.title || item.name || 'Untitled Feature',
            description: item.description || item.reason || 'Feature recommendation',
            priority: item.priority?.toLowerCase() === 'high' ? 'high' : (item.priority?.toLowerCase() === 'low' ? 'low' : 'medium')
        }));

        if (features.length === 0) {
            features.push({
                id: uuidv4(),
                title: parsedData.title || 'Manual JSON Entry',
                description: parsedData.description || 'No specific features found in JSON',
                priority: 'medium'
            });
        }

        const runPacket: RunPacket = {
            runId: uuidv4(),
            featureBrief: {
                meetingId: 'json-import',
                meetingDate: new Date().toISOString(),
                features: features,
                context: parsedData.summary || parsedData.context || 'Imported via JSON'
            },
            approvals: [],
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await this.runManager.saveRun(runPacket);
        return runPacket;
    }

    async getRun(runId: string): Promise<RunPacket | null> {
        return this.runManager.getRun(runId);
    }

    async updateRunData(runId: string, data: Partial<RunPacket>): Promise<RunPacket> {
        const run = await this.runManager.getRun(runId);
        if (!run) throw new Error("Run not found");

        const updatedRun = {
            ...run,
            ...data,
            updatedAt: new Date().toISOString()
        };

        await this.runManager.saveRun(updatedRun);
        return updatedRun;
    }

    async listRuns(): Promise<RunPacket[]> {
        return this.runManager.listRuns();
    }

    // --- Gate logic ---

    async approveGate1(runId: string, featuresIdx: number[]): Promise<RunPacket> {
        // Gate 1: Select features and proceed to enrichment
        const run = await this.runManager.getRun(runId);
        if (!run) throw new Error("Run not found");

        // Filter features logic could be added here
        run.approvals.push({
            gate: 'gate1',
            approver: 'mock-user', // TODO: Get from context
            timestamp: new Date().toISOString(),
            comments: `Approved features keys: ${featuresIdx.join(', ')}`
        });

        // Auto-transition: Enrichment
        const enrichedContext = await this.chatGPT.enrichContext(run.featureBrief);
        run.contextPacket = enrichedContext;
        run.updatedAt = new Date().toISOString();

        await this.runManager.saveRun(run);
        return run;
    }

    async approveGate2(runId: string): Promise<RunPacket> {
        // Gate 2: Approve Context Packet -> Generate PRD
        const run = await this.runManager.getRun(runId);
        if (!run) throw new Error("Run not found");
        if (!run.contextPacket) throw new Error("Context Packet missing");

        run.approvals.push({
            gate: 'gate2',
            approver: 'mock-user',
            timestamp: new Date().toISOString()
        });

        // Auto-transition: PRD Generation
        const { prd, uiContract } = await this.chatPRD.generatePRD(run.contextPacket);
        run.prd = prd;
        run.uiContract = uiContract;
        run.updatedAt = new Date().toISOString();

        await this.runManager.saveRun(run);
        return run;
    }

    async approveGate3(runId: string): Promise<RunPacket> {
        // Gate 3: Approve PRD -> Generate Prototype
        const run = await this.runManager.getRun(runId);
        if (!run) throw new Error("Run not found");
        if (!run.uiContract) throw new Error("UI Contract missing");

        run.approvals.push({
            gate: 'gate3',
            approver: 'mock-user',
            timestamp: new Date().toISOString()
        });

        // Auto-transition: Prototype Generation
        // 1. Fixtures (Mock)
        run.fixtures = "export const fixtures = {};"; // TODO: Implement fixtures mock

        // 2. v0 Prototype
        const v0Url = await this.vercel.generatePrototype(run.uiContract, run.fixtures);
        run.v0Output = v0Url;

        // 3. Antigravity Adaptation
        const adaptedUrl = await this.antigravity.adaptPrototype(v0Url);
        run.adaptedOutput = adaptedUrl;

        run.updatedAt = new Date().toISOString();

        await this.runManager.saveRun(run);
        return run;
    }

    async approveGate4(runId: string): Promise<RunPacket> {
        // Gate 4: Approve Prototype -> Ready for push
        const run = await this.runManager.getRun(runId);
        if (!run) throw new Error("Run not found");

        run.approvals.push({
            gate: 'gate4',
            approver: 'mock-user',
            timestamp: new Date().toISOString()
        });

        run.status = 'completed'; // Mark as locally complete
        run.updatedAt = new Date().toISOString();

        await this.runManager.saveRun(run);
        return run;
    }

    async approveGate5(runId: string): Promise<RunPacket> {
        // Gate 5: Push to Asana -> Finalize
        const run = await this.runManager.getRun(runId);
        if (!run) throw new Error("Run not found");

        run.approvals.push({
            gate: 'gate5',
            approver: 'mock-user',
            timestamp: new Date().toISOString()
        });

        await this.integration.pushToAsana(run);

        run.status = 'completed';
        run.updatedAt = new Date().toISOString();

        await this.runManager.saveRun(run);
        return run;
    }
}
