export interface TelegramToolReplyResult {
  message?: string | null;
  queued?: boolean;
  actionId?: unknown;
}

export function splitTelegramToolResults<T extends TelegramToolReplyResult>(toolResults: T[]) {
  return {
    queued: toolResults.filter((t) => t.queued && t.actionId),
    executed: toolResults.filter((t) => !t.queued),
  };
}

export function buildTelegramMainReply(
  reply: string | null | undefined,
  executed: TelegramToolReplyResult[],
  hasQueuedActions: boolean,
  fallbackWhenNoQueued = "",
): string {
  const parts: string[] = [];
  const modelReply = (reply || "").trim();
  if (!hasQueuedActions && modelReply) parts.push(modelReply);

  const executedText = executed
    .map((t) => (t.message || "").trim())
    .filter(Boolean)
    .join("\n");
  if (executedText) parts.push(executedText);

  const mainReply = parts.join("\n\n").trim();
  if (mainReply) return mainReply;
  return hasQueuedActions ? "" : fallbackWhenNoQueued;
}
