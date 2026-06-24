import type { AssistantSensitivity, EvidenceRef } from "./types";

export type MemoryType = "fact" | "preference" | "goal" | "routine" | "relationship" | "correction";
export type MemoryStatus = "accepted" | "needs_review" | "rejected";

export interface MemoryCandidate {
  type: MemoryType;
  text: string;
  source: "explicit" | "inferred" | "imported" | "tool_result" | "external";
  evidence?: EvidenceRef[];
  confidence?: number;
  importance?: number;
  sensitivity?: AssistantSensitivity;
  userConfirmed?: boolean;
  isCorrection?: boolean;
  containsSecret?: boolean;
  containsThirdPartyPrivateData?: boolean;
  expiresAt?: Date | string | null;
}

export interface MemoryDecision {
  status: MemoryStatus;
  score: number;
  sensitivity: AssistantSensitivity;
  reason: string;
  expiresAt: Date | null;
  requiresUserReview: boolean;
}

const DEFAULT_MEMORY_TTL_DAYS: Record<MemoryType, number | null> = {
  fact: null,
  preference: null,
  goal: 365,
  routine: 180,
  relationship: null,
  correction: null,
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function inferSensitivity(candidate: MemoryCandidate): AssistantSensitivity {
  if (candidate.sensitivity) return candidate.sensitivity;
  const text = candidate.text.toLowerCase();
  if (candidate.containsSecret || /\b(password|api key|secret|token|seed phrase)\b/.test(text)) {
    return "credential";
  }
  if (/\b(bank|salary|income|debt|budget|iban|credit card|tax)\b/.test(text)) return "financial";
  if (/\b(medication|diagnosis|doctor|therapy|symptom|sleep|heart rate)\b/.test(text)) {
    return "medical";
  }
  if (/\b(spouse|wife|husband|child|son|daughter|family)\b/.test(text)) return "family";
  return candidate.source === "external" ? "private" : "personal";
}

function expirationFor(candidate: MemoryCandidate): Date | null {
  if (candidate.expiresAt) {
    const parsed = new Date(candidate.expiresAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const ttl = DEFAULT_MEMORY_TTL_DAYS[candidate.type];
  return ttl ? addDays(ttl) : null;
}

export function scoreMemoryCandidate(candidate: MemoryCandidate): number {
  const confidence = clamp01(
    candidate.confidence ?? (candidate.source === "explicit" ? 0.95 : 0.65),
  );
  const importance = clamp01(candidate.importance ?? 0.5);
  const evidenceScore = clamp01((candidate.evidence?.length ?? 0) / 2);
  const explicitBoost = candidate.userConfirmed || candidate.source === "explicit" ? 0.2 : 0;
  const correctionBoost = candidate.isCorrection || candidate.type === "correction" ? 0.15 : 0;
  const riskPenalty =
    candidate.containsSecret || candidate.containsThirdPartyPrivateData
      ? 0.45
      : candidate.source === "external"
        ? 0.2
        : 0;

  return clamp01(
    0.45 * confidence +
      0.3 * importance +
      0.15 * evidenceScore +
      explicitBoost +
      correctionBoost -
      riskPenalty,
  );
}

export function decideMemory(candidate: MemoryCandidate): MemoryDecision {
  const text = candidate.text.trim();
  const sensitivity = inferSensitivity(candidate);

  if (text.length < 4) {
    return {
      status: "rejected",
      score: 0,
      sensitivity,
      reason: "Memory text is too short to be useful.",
      expiresAt: null,
      requiresUserReview: false,
    };
  }

  if (sensitivity === "credential") {
    return {
      status: "rejected",
      score: 0,
      sensitivity,
      reason: "Credentials and secrets must never be stored as assistant memory.",
      expiresAt: null,
      requiresUserReview: false,
    };
  }

  const score = scoreMemoryCandidate({ ...candidate, text });
  const sensitive =
    sensitivity === "financial" || sensitivity === "medical" || sensitivity === "family";
  const requiresUserReview =
    sensitive || candidate.containsThirdPartyPrivateData || candidate.source === "external";

  if (requiresUserReview && !candidate.userConfirmed) {
    return {
      status: "needs_review",
      score,
      sensitivity,
      reason:
        "Sensitive or third-party memory needs explicit user review before long-term storage.",
      expiresAt: expirationFor(candidate),
      requiresUserReview: true,
    };
  }

  if (score < 0.55) {
    return {
      status: "rejected",
      score,
      sensitivity,
      reason: "Memory confidence or importance is too low.",
      expiresAt: null,
      requiresUserReview: false,
    };
  }

  return {
    status: "accepted",
    score,
    sensitivity,
    reason: "Memory passed confidence, sensitivity, and provenance checks.",
    expiresAt: expirationFor(candidate),
    requiresUserReview: false,
  };
}

export function shouldUseMemory(args: {
  confidence?: number | null;
  lastVerifiedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  now?: Date;
}): boolean {
  const now = args.now ?? new Date();
  const confidence = clamp01(args.confidence ?? 0.5);
  if (confidence < 0.45) return false;
  if (args.expiresAt) {
    const expires = new Date(args.expiresAt);
    if (!Number.isNaN(expires.getTime()) && expires < now) return false;
  }
  if (!args.lastVerifiedAt) return true;
  const verified = new Date(args.lastVerifiedAt);
  if (Number.isNaN(verified.getTime())) return true;
  const ageDays = (now.getTime() - verified.getTime()) / 86_400_000;
  return ageDays < 365 || confidence >= 0.8;
}
