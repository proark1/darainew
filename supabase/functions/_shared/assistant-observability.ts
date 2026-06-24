import type { DbClient, DbRow } from "./supabase-edge.ts";

export interface AssistantTraceInput {
  userId: string;
  surface: string;
  conversationId?: string | null;
  workspaceId?: string | null;
  inputExcerpt?: string | null;
  model?: string | null;
  promptVersion?: string | null;
  contextSummary?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface FinishTraceInput {
  traceId: string | null;
  responseExcerpt?: string | null;
  status: "success" | "error" | "streaming" | "queued";
  riskLevel?: string;
  metadata?: Record<string, unknown>;
  startedAt?: number;
}

export interface ToolCallTraceInput {
  traceId?: string | null;
  userId: string;
  toolName: string;
  operation?: string | null;
  args?: Record<string, unknown>;
  riskLevel?: string;
  approvalMode?: string;
  sensitivity?: string;
  status: "started" | "success" | "error" | "queued";
  resultSummary?: string | null;
  errorMessage?: string | null;
  undoId?: string | null;
  latencyMs?: number | null;
}

function excerpt(value: string | null | undefined, max = 600): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, max) : null;
}

export async function startAssistantTrace(
  supabase: DbClient,
  input: AssistantTraceInput,
): Promise<{ traceId: string | null; startedAt: number }> {
  const startedAt = Date.now();
  if (!input.userId || input.userId === "anonymous") return { traceId: null, startedAt };

  try {
    const { data, error } = await supabase
      .from("assistant_traces")
      .insert({
        user_id: input.userId,
        conversation_id: input.conversationId ?? null,
        workspace_id: input.workspaceId ?? null,
        surface: input.surface,
        input_excerpt: excerpt(input.inputExcerpt),
        model: input.model ?? null,
        prompt_version: input.promptVersion ?? null,
        status: "started",
        context_summary: input.contextSummary ?? {},
        metadata: input.metadata ?? {},
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[assistant trace] start failed", error.message);
      return { traceId: null, startedAt };
    }

    return { traceId: typeof data?.id === "string" ? data.id : null, startedAt };
  } catch (e) {
    console.warn("[assistant trace] start failed", (e as Error).message);
    return { traceId: null, startedAt };
  }
}

export async function finishAssistantTrace(
  supabase: DbClient,
  input: FinishTraceInput,
): Promise<void> {
  if (!input.traceId) return;
  try {
    const patch: DbRow = {
      status: input.status,
      response_excerpt: excerpt(input.responseExcerpt),
      risk_level: input.riskLevel ?? "low",
      completed_at: new Date().toISOString(),
      metadata: input.metadata ?? {},
    };
    if (input.startedAt) patch.latency_ms = Math.max(0, Date.now() - input.startedAt);
    const { error } = await supabase.from("assistant_traces").update(patch).eq("id", input.traceId);
    if (error) console.warn("[assistant trace] finish failed", error.message);
  } catch (e) {
    console.warn("[assistant trace] finish failed", (e as Error).message);
  }
}

export async function recordToolCallTrace(
  supabase: DbClient,
  input: ToolCallTraceInput,
): Promise<void> {
  if (!input.userId || input.userId === "anonymous") return;
  try {
    const { error } = await supabase.from("assistant_tool_calls").insert({
      trace_id: input.traceId ?? null,
      user_id: input.userId,
      tool_name: input.toolName,
      operation: input.operation ?? null,
      arguments: input.args ?? {},
      risk_level: input.riskLevel ?? "low",
      approval_mode: input.approvalMode ?? "auto",
      sensitivity: input.sensitivity ?? "personal",
      status: input.status,
      result_summary: input.resultSummary ?? null,
      error_message: input.errorMessage ?? null,
      latency_ms: input.latencyMs ?? null,
      undo_id: input.undoId ?? null,
      completed_at: input.status === "started" ? null : new Date().toISOString(),
    });
    if (error) console.warn("[assistant trace] tool call failed", error.message);
  } catch (e) {
    console.warn("[assistant trace] tool call failed", (e as Error).message);
  }
}
