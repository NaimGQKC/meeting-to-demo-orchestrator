import { z } from 'zod';

// --- Shared Types ---

export const TimestampSchema = z.string().datetime();
export const IDSchema = z.string().uuid();

// --- Feature Brief ---

export const FeatureRequestSchema = z.object({
    id: IDSchema.optional(), // Generated if not present
    title: z.string(),
    description: z.string(),
    quotes: z.array(z.string()).optional(), // Direct quotes from meeting
    acDraft: z.array(z.string()).optional(), // Initial acceptance criteria ideas
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
});

export const FeatureBriefSchema = z.object({
    meetingId: z.string(),
    meetingDate: TimestampSchema,
    features: z.array(FeatureRequestSchema),
    context: z.string().optional(), // General meeting context
});

export type FeatureBrief = z.infer<typeof FeatureBriefSchema>;

// --- Context Packet ---

export const ContextPacketSchema = z.object({
    accountId: z.string(),
    projectContext: z.string(), // Existing project knowledge
    scope: z.string(),
    assumptions: z.array(z.string()),
    openQuestions: z.array(z.string()),
    constraints: z.array(z.string()).optional(),
});

export type ContextPacket = z.infer<typeof ContextPacketSchema>;

// --- UI Contract ---

export const UIComponentSchema = z.object({
    name: z.string(),
    props: z.record(z.string(), z.any()).optional(),
    state: z.record(z.string(), z.any()).optional(),
});

export const UIScreenSchema = z.object({
    id: z.string(),
    name: z.string(),
    route: z.string(),
    components: z.array(UIComponentSchema),
    description: z.string(),
});

export const UIContractSchema = z.object({
    screens: z.array(UIScreenSchema),
    entities: z.record(z.string(), z.any()).optional(), // Data entities used in UI
    globalState: z.record(z.string(), z.any()).optional(),
});

export type UIContract = z.infer<typeof UIContractSchema>;

// --- PRD ---

export const RequirementSchema = z.object({
    id: z.string(),
    description: z.string(),
    priority: z.enum(['must', 'should', 'could']),
});

export const PRDSchema = z.object({
    id: IDSchema,
    title: z.string(),
    overview: z.string(),
    requirements: z.array(RequirementSchema),
    acceptanceCriteria: z.array(z.string()),
    uiContract: UIContractSchema,
    userStories: z.array(z.string()).optional(),
});

export type PRD = z.infer<typeof PRDSchema>;

// --- Run Packet ---

export const RunApprovalSchema = z.object({
    gate: z.enum(['gate1', 'gate2', 'gate3', 'gate4', 'gate5']),
    approver: z.string(),
    timestamp: TimestampSchema,
    comments: z.string().optional(),
});

export const RunPacketSchema = z.object({
    runId: IDSchema,
    featureBrief: FeatureBriefSchema,
    contextPacket: ContextPacketSchema.optional(),
    prd: PRDSchema.optional(),
    uiContract: UIContractSchema.optional(),
    fixtures: z.string().optional(), // Content of fixtures.ts
    v0Output: z.string().optional(), // Link or content
    adaptedOutput: z.string().optional(), // Link or diff
    approvals: z.array(RunApprovalSchema),
    status: z.enum(['pending', 'in-progress', 'awaiting_prd_review', 'completed', 'failed']),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
});

export type RunPacket = z.infer<typeof RunPacketSchema>;
