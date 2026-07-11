import { describe, expect, it } from "vitest";
import { createSimulationTrace } from "../simulator/trace/createSimulationTrace";
import { parseTraceJson } from "../simulator/trace/parseTrace";
import { replayTrace } from "../simulator/trace/replayTrace";
import { serializeTrace } from "../simulator/trace/serializeTrace";
import { getScenario } from "../simulator/scenarios/registry";

describe("deterministic simulation traces", () => {
  it("exports versioned JSON and round trips through validation", () => {
    const trace = runBasicTrace();
    expect(trace.format).toBe("raft-explorer-trace");
    expect(trace.version).toBe(1);
    expect(trace.scenario.id).toBe("basic-leader-election");
    expect(parseTraceJson(serializeTrace(trace))).toEqual({ valid: true, trace });
  });

  it.each([
    ["not json", "invalid-json"],
    [JSON.stringify({ format: "other", version: 1 }), "unsupported-format"],
    [JSON.stringify({ format: "raft-explorer-trace", version: 2 }), "unsupported-version"],
    [JSON.stringify({ format: "raft-explorer-trace", version: 1 }), "missing-field"],
  ])("rejects invalid trace input", (json, code) => expect(parseTraceJson(json).code).toBe(code));

  it("rejects an unavailable scenario", () => {
    const trace = runBasicTrace();
    trace.scenario.id = "missing";
    expect(parseTraceJson(serializeTrace(trace)).code).toBe("unavailable-scenario");
  });

  it("replays actions, events, IDs, logical time, and final state deterministically", () => {
    const first = runBasicTrace();
    const second = runBasicTrace();
    expect(second.executedActions).toEqual(first.executedActions);
    expect(second.finalState).toEqual(first.finalState);
    expect(replayTrace(first)).toEqual({ valid: true, finalState: first.finalState, errors: [] });
  });

  it("supports deterministic time travel to start, first action, and live state", () => {
    const trace = runBasicTrace();
    expect(replayTrace(trace, 0).finalState).toEqual(trace.initialState);
    expect(replayTrace(trace, 1).finalState).toEqual(trace.executedActions[0].stateAfter);
    expect(replayTrace(trace).finalState).toEqual(trace.finalState);
  });
});

function runBasicTrace() {
  const scenario = getScenario("basic-leader-election");
  const simulator = scenario.createSimulator();
  while (simulator.hasPendingActions()) simulator.step();
  return createSimulationTrace(simulator, scenario, "1.1.0");
}
