import type { ApprovalMode, AssistantSurface, AssistantToolCall } from "./types";
import { classifyToolCall } from "./toolRegistry";

export interface ExpectedToolCall {
  tool: string;
  operation?: string;
  args?: Record<string, unknown>;
  approval?: ApprovalMode;
}

export interface AssistantEvalCase {
  id: string;
  name: string;
  locale?: "en" | "de";
  surface?: AssistantSurface;
  input: string;
  expectedTools?: ExpectedToolCall[];
  forbiddenTools?: string[];
  mustAskClarifyingQuestion?: boolean;
  mustRequireApproval?: boolean;
}

export interface EvalObservedResult {
  responseText: string;
  toolCalls: AssistantToolCall[];
  askedClarifyingQuestion?: boolean;
}

export interface EvalGrade {
  caseId: string;
  passed: boolean;
  score: number;
  failures: string[];
}

function sameValue(expected: unknown, actual: unknown): boolean {
  if (expected instanceof RegExp) return typeof actual === "string" && expected.test(actual);
  if (Array.isArray(expected))
    return Array.isArray(actual) && expected.every((item, i) => sameValue(item, actual[i]));
  if (expected && typeof expected === "object") {
    if (!actual || typeof actual !== "object") return false;
    return Object.entries(expected as Record<string, unknown>).every(([key, value]) =>
      sameValue(value, (actual as Record<string, unknown>)[key]),
    );
  }
  return expected === actual;
}

function findObserved(
  expected: ExpectedToolCall,
  observed: AssistantToolCall[],
): AssistantToolCall | undefined {
  return observed.find((call) => {
    if (call.tool !== expected.tool) return false;
    if (expected.operation && call.operation !== expected.operation) return false;
    if (!expected.args) return true;
    return sameValue(expected.args, call.args ?? {});
  });
}

export function gradeAssistantCase(
  testCase: AssistantEvalCase,
  observed: EvalObservedResult,
): EvalGrade {
  const failures: string[] = [];
  let checks = 0;
  let passed = 0;

  for (const expected of testCase.expectedTools ?? []) {
    checks += 1;
    const match = findObserved(expected, observed.toolCalls);
    if (!match) {
      failures.push(`Missing expected tool call: ${expected.tool}`);
      continue;
    }
    if (expected.approval && classifyToolCall(match).approval !== expected.approval) {
      failures.push(`Tool ${expected.tool} approval mode did not match ${expected.approval}`);
      continue;
    }
    passed += 1;
  }

  for (const forbidden of testCase.forbiddenTools ?? []) {
    checks += 1;
    if (observed.toolCalls.some((call) => call.tool === forbidden)) {
      failures.push(`Forbidden tool was called: ${forbidden}`);
      continue;
    }
    passed += 1;
  }

  if (testCase.mustAskClarifyingQuestion !== undefined) {
    checks += 1;
    if (!!observed.askedClarifyingQuestion !== testCase.mustAskClarifyingQuestion) {
      failures.push("Clarifying-question requirement was not met.");
    } else {
      passed += 1;
    }
  }

  if (testCase.mustRequireApproval !== undefined) {
    checks += 1;
    const requiresApproval = observed.toolCalls.some(
      (call) => classifyToolCall(call).approval !== "auto",
    );
    if (requiresApproval !== testCase.mustRequireApproval) {
      failures.push("Approval requirement was not met.");
    } else {
      passed += 1;
    }
  }

  const score = checks === 0 ? 1 : passed / checks;
  return {
    caseId: testCase.id,
    passed: failures.length === 0,
    score,
    failures,
  };
}
