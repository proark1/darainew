import { classifyToolCall } from "./assistantCore/toolRegistry";

export type ActionTier = "auto" | "confirm";

/**
 * Classify a Dori tool call into a confirmation tier.
 *
 * @param tool   The tool name (e.g. "manage_contract", "send_email").
 * @param operation Optional operation/verb from the tool's arguments
 *   (e.g. "delete", "cancel", "create"). Many CRUD tools are only high-stakes
 *   for destructive operations.
 */
export function classifyActionRisk(tool: string, operation?: string | null): ActionTier {
  return classifyToolCall({ tool, operation }).approval === "auto" ? "auto" : "confirm";
}

/** Convenience: does this action need an explicit user confirmation first? */
export function requiresConfirmation(tool: string, operation?: string | null): boolean {
  return classifyActionRisk(tool, operation) === "confirm";
}
