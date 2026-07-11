import { getScenario } from "../scenarios/registry";
import type { RaftSimulator } from "../core/RaftSimulator";
import type { ClusterState } from "../types";
import type { SimulationTrace } from "./types";

export interface TraceReplayResult {
  valid: boolean;
  finalState: ClusterState;
  errors: string[];
}

export function replayTrace(trace: SimulationTrace, stepCount = trace.executedActions.length): TraceReplayResult {
  const { simulator, errors } = createSimulatorFromTrace(trace, stepCount);
  const finalState = simulator.getState();
  if (stepCount === trace.executedActions.length && !deepEqual(finalState, trace.finalState)) errors.push("Replay final state does not match the trace final state.");
  return { valid: errors.length === 0, finalState, errors };
}

export function createSimulatorFromTrace(trace: SimulationTrace, stepCount = trace.executedActions.length): { simulator: RaftSimulator; errors: string[] } {
  const scenario = getScenario(trace.scenario.id);
  const simulator = scenario.createSimulator();
  const errors: string[] = [];

  if (!deepEqual(simulator.getState(), trace.initialState)) errors.push("Replay initial state does not match the trace initial state.");
  if (!deepEqual(simulator.getPendingActions(), trace.initialActions)) errors.push("Replay initial actions do not match the trace initial actions.");
  for (const expected of trace.executedActions.slice(0, stepCount)) {
    const pending = simulator.getPendingActions();
    if (!pending.some((action) => action.id === expected.action.id)) simulator.schedule(expected.action);
    const actual = simulator.step();
    if (!actual.executed || !deepEqual(actual.action, expected.action)) {
      errors.push(`Replay action ${expected.order} does not match the recorded action.`);
      break;
    }
    if (!deepEqual(actual.state, expected.stateAfter)) errors.push(`Replay state after action ${expected.order} does not match.`);
    if (!deepEqual(actual.emittedEvents.map((event) => event.id), expected.emittedEventIds)) errors.push(`Replay event IDs after action ${expected.order} do not match.`);
    const invariantResult = simulator.validateInvariants();
    if (!invariantResult.valid) errors.push(`Replay invariants failed after action ${expected.order}.`);
  }

  return { simulator, errors };
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}
