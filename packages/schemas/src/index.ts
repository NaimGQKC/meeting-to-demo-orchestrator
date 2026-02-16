export type ISODateTime = string;

export type FeatureBrief = {
  id: string; // stable within the meeting (e.g., "feat-1")
  title: string;
  problem_statement: string;
  proposed_solution: string;
  persona?: string;
  meeting_context?: string;
  supporting_quotes?: string[];
  scope_in?: string[];
  scope_out?: string[];
  constraints?: string[];
  open_questions?: string[];
  acceptance_criteria_draft?: string[];
  confidence?: "low" | "med" | "high";
  ambiguity_notes?: string[];
};

export type ContextPacket = {
  run_id: string;
  feature_id: string;
  account_context?: string;
  current_workflow?: string;
  requested_change: string;
  success_definition?: string;
  in_scope?: string[];
  out_of_scope?: string[];
  data_assumptions?: string[];
  ui_constraints?: string[];
  dependencies?: string[];
  open_questions?: { question: string; priority: "must" | "nice" }[];
  demo_mode?: {
    client_safe: boolean;
    watermark?: "concept" | "ready";
    fake_data: boolean;
  };
};

export type UIContract = {
  screens: Array<{
    name: string;
    route?: string;
    purpose?: string;
    components?: string[];
    states?: Array<"loading" | "empty" | "error" | "default">;
  }>;
  entities?: Array<{
    name: string;
    fields: Array<{ name: string; type: "string" | "number" | "boolean" | "date" }>;
  }>;
};

export type PRD = {
  title: string;
  background?: string;
  goals?: string[];
  non_goals?: string[];
  user_stories?: string[];
  requirements?: string[];
  acceptance_criteria?: string[];
  edge_cases?: string[];
  open_questions?: string[];
  ui_contract: UIContract;
};

export type GateName =
  | "gate0_consent"
  | "gate1_feature_select"
  | "gate2_context_packet"
  | "gate3_prd"
  | "gate4_demo_review"
  | "gate5_asana_push";

export type RunStage =
  | "created"
  | "awaiting_gate1"
  | "awaiting_gate2"
  | "awaiting_gate3"
  | "generating_v0"
  | "adapting_ui"
  | "awaiting_gate4"
  | "awaiting_gate5"
  | "done";

export type RunPacket = {
  run_id: string;
  created_at: ISODateTime;
  stage: RunStage;

  version: number;

  feature_brief?: FeatureBrief;
  context_packet?: ContextPacket;
  prd?: PRD;

  fixtures_path?: string;
  v0_preview_url?: string;
  adapted_preview_url?: string;

  approvals: Array<{
    gate: GateName;
    approved_at: ISODateTime;
    notes?: string;
  }>;
};
