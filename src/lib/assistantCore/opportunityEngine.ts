import type { AssistantRisk, AssistantSurface, AssistantSensitivity, EvidenceRef } from "./types";

export interface OpportunityCandidate {
  id: string;
  type: string;
  title: string;
  userId: string;
  evidence?: EvidenceRef[];
  preferredChannels: AssistantSurface[];
  urgency: number;
  impact: number;
  actionability: number;
  confidence: number;
  novelty?: number;
  risk?: AssistantRisk;
  sensitivity?: AssistantSensitivity;
  expiresAt?: Date | string | null;
  createdAt?: Date | string | null;
  metadata?: Record<string, unknown>;
}

export interface OpportunityContext {
  now?: Date;
  quietHours?: { startHour: number; endHour: number };
  focusMode?: boolean;
  inMeeting?: boolean;
  allowedChannels?: AssistantSurface[];
  linkedChannels?: AssistantSurface[];
  recentCandidateKeys?: string[];
  optedOutTypes?: string[];
  acceptRateByType?: Record<string, number>;
  groupSurface?: boolean;
}

export interface OpportunityDecision {
  candidate: OpportunityCandidate;
  score: number;
  allowed: boolean;
  channel: AssistantSurface | null;
  gates: string[];
}

function clamp01(value: number | undefined, fallback = 0): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function currentHour(now: Date): number {
  return now.getHours() + now.getMinutes() / 60;
}

function inQuietHours(now: Date, quietHours?: { startHour: number; endHour: number }): boolean {
  if (!quietHours) return false;
  const hour = currentHour(now);
  const { startHour, endHour } = quietHours;
  if (startHour === endHour) return false;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

function riskPenalty(risk: AssistantRisk | undefined): number {
  if (risk === "critical") return 0.45;
  if (risk === "high") return 0.3;
  if (risk === "medium") return 0.12;
  return 0;
}

function sensitivityPenalty(sensitivity: AssistantSensitivity | undefined): number {
  if (sensitivity === "credential") return 1;
  if (sensitivity === "medical" || sensitivity === "financial") return 0.25;
  if (sensitivity === "family" || sensitivity === "private") return 0.12;
  return 0;
}

function candidateKey(candidate: OpportunityCandidate): string {
  return `${candidate.type}:${candidate.title.toLowerCase().trim()}`;
}

export function scoreOpportunity(
  candidate: OpportunityCandidate,
  context: OpportunityContext = {},
): number {
  const utility =
    0.4 * clamp01(candidate.urgency) +
    0.35 * clamp01(candidate.impact) +
    0.25 * clamp01(candidate.actionability);
  const confidence = clamp01(candidate.confidence);
  const novelty = clamp01(candidate.novelty, 0.8);
  const receptivity = clamp01(context.acceptRateByType?.[candidate.type], 0.65);
  const timingFit = context.focusMode || context.inMeeting ? 0.55 : 1;
  const duplicatePenalty = context.recentCandidateKeys?.includes(candidateKey(candidate)) ? 0.35 : 0;

  const score =
    100 * utility * confidence * novelty * receptivity * timingFit -
    100 * duplicatePenalty -
    100 * riskPenalty(candidate.risk) -
    100 * sensitivityPenalty(candidate.sensitivity);

  return Math.round(Math.max(0, score));
}

export function decideOpportunity(
  candidate: OpportunityCandidate,
  context: OpportunityContext = {},
): OpportunityDecision {
  const now = context.now ?? new Date();
  const gates: string[] = [];

  if (context.optedOutTypes?.includes(candidate.type)) gates.push("type_opted_out");

  if (candidate.expiresAt) {
    const expires = new Date(candidate.expiresAt);
    if (!Number.isNaN(expires.getTime()) && expires < now) gates.push("expired");
  }

  if (candidate.sensitivity === "credential") gates.push("credential_memory_blocked");

  if (inQuietHours(now, context.quietHours) && candidate.urgency < 0.85) {
    gates.push("quiet_hours");
  }

  if (context.inMeeting && candidate.urgency < 0.9) gates.push("in_meeting");
  if (context.focusMode && candidate.urgency < 0.8) gates.push("focus_mode");

  if (context.recentCandidateKeys?.includes(candidateKey(candidate))) gates.push("duplicate_recent");

  if (context.groupSurface && candidate.sensitivity && candidate.sensitivity !== "public") {
    gates.push("private_context_in_group");
  }

  const linked = context.linkedChannels ?? candidate.preferredChannels;
  const allowed = context.allowedChannels ?? candidate.preferredChannels;
  const channel =
    candidate.preferredChannels.find((ch) => linked.includes(ch) && allowed.includes(ch)) ?? null;

  if (!channel) gates.push("no_available_channel");

  const score = scoreOpportunity(candidate, context);
  if (score < 35) gates.push("score_too_low");

  return {
    candidate,
    score,
    allowed: gates.length === 0,
    channel,
    gates,
  };
}

export function rankOpportunities(
  candidates: OpportunityCandidate[],
  context: OpportunityContext = {},
): OpportunityDecision[] {
  return candidates
    .map((candidate) => decideOpportunity(candidate, context))
    .sort((a, b) => {
      if (a.allowed !== b.allowed) return a.allowed ? -1 : 1;
      return b.score - a.score;
    });
}
