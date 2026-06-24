export type AssistantSurface =
  | "web"
  | "mobile"
  | "voice"
  | "tg_private"
  | "tg_family"
  | "tg_workspace"
  | "cron"
  | "email"
  | "api";

export type AssistantRisk = "low" | "medium" | "high" | "critical";

export type AssistantSensitivity =
  | "public"
  | "personal"
  | "private"
  | "financial"
  | "medical"
  | "credential"
  | "family";

export type ToolOperation =
  | "read"
  | "search"
  | "create"
  | "update"
  | "delete"
  | "send"
  | "external"
  | "memory_write"
  | "medical"
  | "financial";

export type ApprovalMode = "auto" | "confirm" | "dry_run";

export interface EvidenceRef {
  kind: "user_message" | "email" | "calendar_event" | "task" | "memory" | "system";
  id?: string;
  excerpt?: string;
}

export interface AssistantTraceContext {
  userId: string;
  surface: AssistantSurface;
  conversationId?: string;
  workspaceId?: string | null;
  locale?: string | null;
  timezone?: string | null;
}

export interface AssistantToolCall {
  tool: string;
  operation?: string | null;
  args?: Record<string, unknown>;
  surface?: AssistantSurface;
}
