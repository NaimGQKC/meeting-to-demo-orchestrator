import {
    FeatureBrief,
    ContextPacket,
    PRD,
    UIContract,
    RunPacket
} from '@meeting-to-demo/schemas';
import { v4 as uuidv4 } from 'uuid';
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import OpenAI from "openai";
import { EventSource } from 'eventsource';
(global as any).EventSource = EventSource;

export interface ICirclebackAdapter {
    getFeatureBrief(meetingId: string): Promise<FeatureBrief>;
}

export interface IChatGPTAdapter {
    enrichContext(brief: FeatureBrief): Promise<ContextPacket>;
    formatFeatureBrief(rawText: string): Promise<FeatureBrief>;
}

export class CirclebackMCPAdapter implements ICirclebackAdapter {
    private url: string;

    constructor(url: string = "https://app.circleback.ai/api/mcp") {
        this.url = url;
    }

    async getFeatureBrief(meetingId: string): Promise<FeatureBrief> {
        const transport = new SSEClientTransport(new URL(this.url));
        const client = new Client(
            { name: "meeting-to-demo-orchestrator", version: "1.0.0" },
            { capabilities: {} }
        );

        try {
            await client.connect(transport);

            // In a real scenario, we might need to authenticate or handle OAuth here.
            // For now, we assume the server provides a tool to get features.

            // List tools to see what's available (helpful for debugging if we had a log)
            // const tools = await client.listTools();

            // We'll call a hypothetical 'get_features' tool. 
            // The exact tool name and arguments would depend on Circleback's implementation.
            // Based on the product strategy, we'll assume it takes a meetingId.
            const result = await client.callTool({
                name: "get_meeting_features",
                arguments: { meetingId }
            });

            // Parse result into FeatureBrief
            // This is a placeholder for actual parsing logic
            if (result.isError) {
                throw new Error(`Circleback MCP Error: ${JSON.stringify(result.content)}`);
            }

            // Assume the response is JSON that matches our FeatureBrief partially
            const content = (result.content as any[])[0];
            if (content.type === 'text') {
                const data = JSON.parse(content.text);
                return {
                    meetingId,
                    meetingDate: data.date || new Date().toISOString(),
                    features: data.features.map((f: any) => ({
                        id: uuidv4(),
                        title: f.title,
                        description: f.description,
                        priority: f.priority || 'medium'
                    })),
                    context: data.summary || 'Summary from Circleback'
                };
            }

            throw new Error("Unexpected response type from Circleback MCP");
        } finally {
            await client.close();
        }
    }
}

export interface IChatGPTAdapter {
    enrichContext(brief: FeatureBrief): Promise<ContextPacket>;
    formatFeatureBrief(rawText: string): Promise<FeatureBrief>;
}

export interface IChatPRDAdapter {
    generatePRD(context: ContextPacket): Promise<{ prd: PRD; uiContract: UIContract }>;
}

export interface IVercelAdapter {
    generatePrototype(uiContract: UIContract, fixtures: string): Promise<string>;
}

export interface IAntigravityAdapter {
    adaptPrototype(v0Output: string): Promise<string>;
}

export interface IIntegrationAdapter {
    pushToAsana(run: RunPacket): Promise<void>;
}

// Mock Implementations for now
export class MockCirclebackAdapter implements ICirclebackAdapter {
    async getFeatureBrief(meetingId: string): Promise<FeatureBrief> {
        return {
            meetingId,
            meetingDate: new Date().toISOString(),
            features: [
                {
                    id: uuidv4(),
                    title: 'Mock Feature Request',
                    description: 'A mock feature request from a meeting.',
                    priority: 'medium'
                }
            ],
            context: 'Initial mock context'
        };
    }
}

// Real Implementations
export class ChatGPTAdapter implements IChatGPTAdapter {
    private openai: OpenAI;

    constructor(apiKey: string) {
        this.openai = new OpenAI({ apiKey });
    }

    async formatFeatureBrief(rawText: string): Promise<FeatureBrief> {
        const response = await this.openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `You are an expert product manager. Extract feature requests from the provided text into a JSON object.
                    The output must match this schema:
                    {
                        "title": "Overall feature set title",
                        "description": "High level context",
                        "features": [
                            { "title": "...", "description": "...", "priority": "high|medium|low" }
                        ]
                    }`
                },
                { role: "user", content: rawText }
            ]
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No content from OpenAI");

        const data = JSON.parse(content);
        return {
            meetingId: 'manual-text',
            meetingDate: new Date().toISOString(),
            context: data.description,
            features: data.features.map((f: any) => ({
                id: uuidv4(),
                title: f.title,
                description: f.description,
                priority: f.priority
            }))
        };
    }

    async enrichContext(brief: FeatureBrief): Promise<ContextPacket> {
        const response = await this.openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `You are a Senior Solutions Architect. Enrich the following feature brief with technical context, assumptions, and scope definition.
                    Output JSON schema:
                    {
                        "projectContext": "...",
                        "scope": "...",
                        "assumptions": ["..."],
                        "openQuestions": ["..."]
                    }`
                },
                { role: "user", content: JSON.stringify(brief) }
            ]
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No content from OpenAI");

        const data = JSON.parse(content);
        return {
            accountId: uuidv4(),
            projectContext: data.projectContext,
            scope: data.scope,
            assumptions: data.assumptions,
            openQuestions: data.openQuestions
        };
    }
}

export class ChatPRDAdapter implements IChatPRDAdapter {
    private openai: OpenAI;

    constructor(apiKey: string) {
        this.openai = new OpenAI({ apiKey });
    }

    async generatePRD(context: ContextPacket): Promise<{ prd: PRD; uiContract: UIContract }> {
        const response = await this.openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `You are ChatPRD, a world-class Product Manager. 
                    Based on the enriched context provided, generate a detailed PRD and a UI Contract for v0.
                    Output JSON schema:
                    {
                        "prd": {
                            "title": "...",
                            "overview": "...",
                            "requirements": ["Requirement 1", "Requirement 2"],
                            "acceptanceCriteria": ["AC 1", "AC 2"],
                        },
                        "uiContract": {
                            "screens": [
                                {
                                    "name": "Screen Name",
                                    "route": "/route",
                                    "description": "What this screen does",
                                    "components": ["Header", "Toggle", "List"]
                                }
                            ]
                        }
                    }`
                },
                { role: "user", content: JSON.stringify(context) }
            ]
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No content from OpenAI");

        const data = JSON.parse(content);
        const prdId = uuidv4();

        return {
            prd: {
                id: prdId,
                title: data.prd.title,
                overview: data.prd.overview,
                requirements: data.prd.requirements,
                acceptanceCriteria: data.prd.acceptanceCriteria,
                uiContract: data.uiContract
            },
            uiContract: {
                screens: data.uiContract.screens.map((s: any) => ({
                    id: uuidv4(),
                    ...s
                }))
            }
        };
    }
}

export class MockChatGPTAdapter implements IChatGPTAdapter {
    async enrichContext(brief: FeatureBrief): Promise<ContextPacket> {
        return {
            accountId: uuidv4(),
            projectContext: 'Mock project context',
            scope: 'Mock scope based on ' + brief.features[0].title,
            assumptions: ['Assumption 1', 'Assumption 2'],
            openQuestions: ['Question 1?']
        };
    }

    async formatFeatureBrief(rawText: string): Promise<FeatureBrief> {
        return {
            meetingId: 'mock-text',
            meetingDate: new Date().toISOString(),
            context: 'Mock formatted context',
            features: [{
                id: uuidv4(),
                title: 'Mock derived feature',
                description: 'Derived from: ' + rawText.substring(0, 20),
                priority: 'medium'
            }]
        };
    }
}

export class MockChatPRDAdapter implements IChatPRDAdapter {
    async generatePRD(context: ContextPacket): Promise<{ prd: PRD; uiContract: UIContract }> {
        // Generate a meaningful PRD from the user's input rather than empty placeholders
        const featureDesc = context.scope || context.projectContext || 'Feature';
        return {
            prd: {
                id: uuidv4(),
                title: `PRD: ${featureDesc}`,
                overview: `Product Requirements Document for: ${featureDesc}\n\nContext: ${context.projectContext || 'User feature request'}`,
                requirements: [
                    { id: uuidv4(), description: `Implement the core feature: ${featureDesc}`, priority: 'must' as const },
                    { id: uuidv4(), description: 'Ensure responsive design across desktop and mobile', priority: 'must' as const },
                    { id: uuidv4(), description: 'Add smooth animations and visual polish', priority: 'should' as const },
                    { id: uuidv4(), description: 'Include accessibility support', priority: 'should' as const }
                ],
                acceptanceCriteria: [
                    `The feature "${featureDesc}" works as described`,
                    'UI is responsive and visually polished',
                    'No console errors or warnings'
                ],
                uiContract: { screens: [] }
            },
            uiContract: {
                screens: [
                    {
                        id: uuidv4(),
                        name: featureDesc,
                        route: '/',
                        components: [
                            { name: 'FeatureComponent', props: { feature: featureDesc }, state: {} }
                        ],
                        description: `Main screen implementing: ${featureDesc}`
                    }
                ]
            }
        };
    }
}

/**
 * Real ChatPRD adapter that connects to ChatPRD's MCP server.
 * Sends the context and gets back a structured PRD + UIContract.
 */
export class ChatPRDMCPAdapter implements IChatPRDAdapter {
    private mcpUrl: string;
    private apiKey?: string;

    constructor(mcpUrl: string, apiKey?: string) {
        this.mcpUrl = mcpUrl;
        this.apiKey = apiKey;
    }

    async generatePRD(context: ContextPacket): Promise<{ prd: PRD; uiContract: UIContract }> {
        // Use mcp-remote as a bridge to handle ChatPRD's OAuth authentication
        // This is the same approach used by Windsurf and Claude Desktop
        console.log(`[ChatPRDMCPAdapter] Connecting to ChatPRD via mcp-remote at ${this.mcpUrl}...`);
        const transport = new StdioClientTransport({
            command: 'npx',
            args: ['-y', 'mcp-remote', this.mcpUrl],
            stderr: 'inherit'
        });
        const client = new Client(
            { name: "meeting-to-demo-orchestrator", version: "1.0.0" },
            { capabilities: {} }
        );

        try {
            await client.connect(transport);
            console.log('[ChatPRDMCPAdapter] Connected to ChatPRD MCP server');

            // Discover available tools
            const tools = await client.listTools();
            console.log('[ChatPRDMCPAdapter] Available tools:', tools.tools.map(t => t.name).join(', '));

            // Build the prompt from context
            const prompt = `Create a detailed PRD for the following project:
Project Context: ${context.projectContext}
Scope: ${context.scope}
Assumptions: ${context.assumptions.join(', ')}
Open Questions: ${context.openQuestions.join(', ')}

Please include:
1. Title and overview
2. Detailed requirements with priorities (must/should/could)
3. Acceptance criteria
4. UI screens with components, routes, and descriptions
5. User stories`;

            // Find the right tool — ChatPRD may expose different tool names
            const prdTool = tools.tools.find(t =>
                t.name.toLowerCase().includes('prd') ||
                t.name.toLowerCase().includes('generate') ||
                t.name.toLowerCase().includes('create') ||
                t.name.toLowerCase().includes('write')
            ) || tools.tools[0]; // fallback to first tool

            if (!prdTool) {
                throw new Error('No tools found on ChatPRD MCP server');
            }

            console.log(`[ChatPRDMCPAdapter] Using tool: ${prdTool.name}`);

            const result = await client.callTool({
                name: prdTool.name,
                arguments: { prompt }
            });

            if (result.isError) {
                throw new Error(`ChatPRD Error: ${JSON.stringify(result.content)}`);
            }

            const content = (result.content as any[])[0];
            const responseText = content?.type === 'text' ? content.text : JSON.stringify(result.content);

            console.log('[ChatPRDMCPAdapter] PRD generated, parsing response...');

            // Try to parse structured JSON, otherwise create a PRD from the text
            try {
                const data = JSON.parse(responseText);
                return this.parseStructuredPRD(data);
            } catch {
                return this.parseTextPRD(responseText, context);
            }
        } finally {
            await client.close();
        }
    }

    private parseStructuredPRD(data: any): { prd: PRD; uiContract: UIContract } {
        const prdId = uuidv4();
        return {
            prd: {
                id: prdId,
                title: data.title || data.prd?.title || 'Generated PRD',
                overview: data.overview || data.prd?.overview || '',
                requirements: (data.requirements || data.prd?.requirements || []).map((r: any) => ({
                    id: uuidv4(),
                    description: typeof r === 'string' ? r : r.description,
                    priority: r.priority || 'should'
                })),
                acceptanceCriteria: data.acceptanceCriteria || data.prd?.acceptanceCriteria || [],
                uiContract: data.uiContract || { screens: [] },
                userStories: data.userStories || []
            },
            uiContract: {
                screens: (data.uiContract?.screens || data.screens || []).map((s: any) => ({
                    id: uuidv4(),
                    name: s.name,
                    route: s.route || '/',
                    components: (s.components || []).map((c: any) => ({
                        name: typeof c === 'string' ? c : c.name,
                        props: c.props || {},
                        state: c.state || {}
                    })),
                    description: s.description || ''
                }))
            }
        };
    }

    private parseTextPRD(text: string, context: ContextPacket): { prd: PRD; uiContract: UIContract } {
        const prdId = uuidv4();
        return {
            prd: {
                id: prdId,
                title: `PRD: ${context.scope}`,
                overview: text,
                requirements: [{ id: uuidv4(), description: context.scope, priority: 'must' as const }],
                acceptanceCriteria: ['Generated from ChatPRD'],
                uiContract: { screens: [] }
            },
            uiContract: {
                screens: [{
                    id: uuidv4(),
                    name: 'Main',
                    route: '/',
                    components: [{ name: 'App' }],
                    description: context.scope
                }]
            }
        };
    }
}

export class MockVercelAdapter implements IVercelAdapter {
    async generatePrototype(uiContract: UIContract, fixtures: string): Promise<string> {
        return 'https://v0.dev/mock-prototype-url';
    }
}

/**
 * Real Vercel v0 adapter.
 * USES v0 API directly (https://api.v0.dev/v1) as there is no public persistent MCP server for v0.
 * Sends the approved PRD/UIContract as a prompt to v0, which generates the prototype.
 */
export class V0MCPAdapter implements IVercelAdapter {
    private apiKey: string;
    private apiUrl: string;

    constructor(apiKey: string, apiUrl: string = "https://api.v0.dev/v1") {
        this.apiKey = apiKey;
        this.apiUrl = apiUrl;
    }

    async generatePrototype(uiContract: UIContract, fixtures: string): Promise<string> {
        // Build a v0-optimized prompt from the UIContract
        const screenDescriptions = uiContract.screens.map(s =>
            `Feature: ${s.name}\n  Description: ${s.description}\n  Components: ${s.components.map(c => c.name).join(', ')}`
        ).join('\n\n');

        const prompt = `Build exactly this feature as a single, self-contained React + Tailwind CSS component:\n\n${screenDescriptions}\n\nData fixtures:\n${fixtures}\n\nIMPORTANT:\n- Focus on implementing EXACTLY the described feature with high visual quality\n- Use modern, polished UI with smooth animations and transitions\n- Make it a SINGLE self-contained component that demonstrates the feature\n- Do NOT generate boilerplate apps, multi-page routing, or generic templates\n- Return only the TSX code for the component`;

        console.log('[V0Adapter] Connecting to v0 API...');

        // Use OpenAI client to talk to v0 API (it's compatible)
        const openai = new OpenAI({
            apiKey: this.apiKey,
            baseURL: this.apiUrl
        });

        try {
            const completion = await openai.chat.completions.create({
                model: 'v0-1.5-md', // Latest v0 model for UI generation
                messages: [
                    { role: 'system', content: 'You are v0, an expert UI engineer. Generate high-quality React code using Tailwind CSS.' },
                    { role: 'user', content: prompt }
                ],
                stream: false
            });

            const content = completion.choices[0].message.content;
            console.log('[V0Adapter] Prototype generated successfully via API');
            return content || 'No content returned from v0';

        } catch (error: any) {
            console.error('[V0Adapter] API Error:', error);
            throw new Error(`v0 API creation failed: ${error.message}`);
        }
    }
}

export class MockAntigravityAdapter implements IAntigravityAdapter {
    async adaptPrototype(v0Output: string): Promise<string> {
        return 'Mock Adapted Prototype based on ' + v0Output;
    }
}

export class MockIntegrationAdapter implements IIntegrationAdapter {
    async pushToAsana(run: RunPacket): Promise<void> {
        console.log('Pushing to Asana mock: ', run.runId);
    }
}

