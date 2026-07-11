import { validateClusterInvariants, validateScheduledActions } from "../invariants/validateClusterInvariants";
import { getAvailableScenarios } from "../scenarios/registry";
import type { ClusterState, ScheduledAction } from "../types";
import type { SimulationTrace, TraceActionRecord } from "./types";
import type { InvariantViolation } from "../invariants/types";

export type TraceValidationErrorCode =
  | "invalid-json"
  | "unsupported-format"
  | "unsupported-version"
  | "missing-field"
  | "unavailable-scenario"
  | "invalid-state";

export interface TraceValidationResult {
  valid: boolean;
  trace?: SimulationTrace;
  code?: TraceValidationErrorCode;
  message?: string;
}

export function validateTrace(value: unknown): TraceValidationResult {
  if (!isRecord(value)) return failure("missing-field", "Trace data must be an object.");
  if (value.format !== "raft-explorer-trace") return failure("unsupported-format", "Unsupported trace format.");
  if (value.version !== 1) return failure("unsupported-version", "Unsupported trace version.");
  if (!isRecord(value.scenario) || typeof value.scenario.id !== "string" || typeof value.scenario.name !== "string") return failure("missing-field", "Trace scenario is missing or invalid.");
  const scenarioId = value.scenario.id;
  const scenarioName = value.scenario.name;
  if (!getAvailableScenarios().some((scenario) => scenario.id === scenarioId)) return failure("unavailable-scenario", "The trace references an unavailable scenario.");
  if (!isRecord(value.createdBy) || value.createdBy.application !== "Raft Explorer" || typeof value.createdBy.applicationVersion !== "string") return failure("missing-field", "Trace creator metadata is missing or invalid.");
  if (!isClusterState(value.initialState) || !isClusterState(value.finalState)) return failure("invalid-state", "Trace state validation failed.");
  if (!Array.isArray(value.initialActions) || !value.initialActions.every(isScheduledAction)) return failure("missing-field", "Trace initialActions are missing or invalid.");
  if (!Array.isArray(value.executedActions) || !value.executedActions.every(isTraceActionRecord)) return failure("missing-field", "Trace executedActions are missing or invalid.");
  if (!isRecord(value.invariantSummary) || typeof value.invariantSummary.valid !== "boolean" || !Array.isArray(value.invariantSummary.violations) || !value.invariantSummary.violations.every(isInvariantViolation)) return failure("missing-field", "Trace invariant summary is missing or invalid.");

  const trace: SimulationTrace = {
    format: value.format,
    version: value.version,
    createdBy: {
      application: "Raft Explorer",
      applicationVersion: value.createdBy.applicationVersion,
    },
    scenario: { id: scenarioId, name: scenarioName },
    initialState: value.initialState,
    initialActions: value.initialActions,
    executedActions: value.executedActions,
    finalState: value.finalState,
    invariantSummary: {
      valid: value.invariantSummary.valid,
      violations: value.invariantSummary.violations,
    },
  };
  const stateResults = [trace.initialState, trace.finalState, ...trace.executedActions.flatMap((record) => [record.stateBefore, record.stateAfter])]
    .map(validateClusterInvariants);
  if (stateResults.some((result) => !result.valid) || !validateScheduledActions(trace.initialActions).valid) return failure("invalid-state", "Trace state validation failed.");
  const actionIds = new Set<string>();
  for (const [index, record] of trace.executedActions.entries()) {
    if (actionIds.has(record.action.id)) return failure("invalid-state", "Trace action IDs must be unique.");
    actionIds.add(record.action.id);
    if (record.order !== index + 1 || record.stateBefore.currentStep !== index || record.stateAfter.currentStep !== index + 1) return failure("invalid-state", "Trace action order or state step is invalid.");
    if (record.logicalTimeBefore !== record.stateBefore.logicalTime || record.logicalTimeAfter !== record.stateAfter.logicalTime || record.logicalTimeAfter < record.logicalTimeBefore) return failure("invalid-state", "Trace logical time is invalid.");
    const previousState = index === 0 ? trace.initialState : trace.executedActions[index - 1].stateAfter;
    if (!deepEqual(previousState, record.stateBefore)) return failure("invalid-state", "Trace state snapshots are not contiguous.");
    const eventIds = new Set(record.stateAfter.events.map((event) => event.id));
    const messageIds = new Set(record.stateAfter.messages.map((message) => message.id));
    if (!record.emittedEventIds.every((id) => eventIds.has(id)) || !record.affectedMessageIds.every((id) => messageIds.has(id))) return failure("invalid-state", "Trace event or message references are invalid.");
  }
  const expectedFinal = trace.executedActions.length === 0 ? trace.initialState : trace.executedActions[trace.executedActions.length - 1].stateAfter;
  if (!deepEqual(expectedFinal, trace.finalState)) return failure("invalid-state", "Trace final state does not match its final action snapshot.");
  return { valid: true, trace };
}

function isClusterState(value: unknown): value is ClusterState {
  if (!isRecord(value) || !isRecord(value.nodes) || !Array.isArray(value.messages) || !Array.isArray(value.events)) return false;
  if (typeof value.currentStep !== "number" || typeof value.logicalTime !== "number") return false;
  return Object.values(value.nodes).every((node) =>
    isRecord(node) && typeof node.id === "string" && typeof node.role === "string" &&
    typeof node.status === "string" && typeof node.currentTerm === "number" &&
    Array.isArray(node.log) && typeof node.commitIndex === "number" && typeof node.lastApplied === "number",
  );
}

function isScheduledAction(value: unknown): value is ScheduledAction {
  return isRecord(value) && typeof value.id === "string" && typeof value.type === "string" &&
    typeof value.scheduledTime === "number" && typeof value.sequence === "number" && "payload" in value;
}

function isTraceActionRecord(value: unknown): value is TraceActionRecord {
  return isRecord(value) && typeof value.order === "number" && isScheduledAction(value.action) &&
    typeof value.logicalTimeBefore === "number" && typeof value.logicalTimeAfter === "number" &&
    isClusterState(value.stateBefore) && isClusterState(value.stateAfter) &&
    Array.isArray(value.emittedEventIds) && value.emittedEventIds.every((id) => typeof id === "string") &&
    Array.isArray(value.affectedMessageIds) && value.affectedMessageIds.every((id) => typeof id === "string");
}

function isInvariantViolation(value: unknown): value is InvariantViolation {
  return isRecord(value) && typeof value.id === "string" &&
    (value.severity === "error" || value.severity === "warning") &&
    typeof value.title === "string" && typeof value.description === "string" &&
    (value.nodeIds === undefined || (Array.isArray(value.nodeIds) && value.nodeIds.every((id) => typeof id === "string"))) &&
    (value.term === undefined || typeof value.term === "number") &&
    (value.logIndex === undefined || typeof value.logIndex === "number");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function failure(code: TraceValidationErrorCode, message: string): TraceValidationResult {
  return { valid: false, code, message };
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
