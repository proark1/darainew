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

  // De-duplicate identical tool messages. A model that emits the same tool
  // (e.g. manage_event list) across several agent rounds would otherwise render
  // the same block two or three times in one reply.
  const seen = new Set<string>();
  const executedText = executed
    .map((t) => (t.message || "").trim())
    .filter((m) => {
      if (!m || seen.has(m)) return false;
      seen.add(m);
      return true;
    })
    .join("\n");
  if (executedText) parts.push(executedText);

  const mainReply = parts.join("\n\n").trim();
  if (mainReply) return mainReply;
  return hasQueuedActions ? "" : fallbackWhenNoQueued;
}
