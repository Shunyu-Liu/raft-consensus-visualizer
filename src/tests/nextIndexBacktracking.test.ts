import { describe, expect, it } from "vitest";
import { isAppendEntriesMessage } from "../simulator/messageTypes";
import { getScenario } from "../simulator/scenarios/registry";
import type { RaftSimulator } from "../simulator/core/RaftSimulator";

function stepTypes(simulator: RaftSimulator, count: number): string[] {
  const types: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const result = simulator.step();
    if (result.action) {
      types.push(result.action.type);
    }
  }
  return types;
}

describe("nextIndex backtracking", () => {
  it("backs up Node B from nextIndex 5 to 4 and then 3 before success", () => {
    const simulator = getScenario("conflicting-logs").createSimulator();

    expect(simulator.getState().nodes.C.nextIndex?.B).toBe(5);

    stepTypes(simulator, 3);
    expect(simulator.getState().nodes.C.nextIndex?.B).toBe(4);

    stepTypes(simulator, 3);
    expect(simulator.getState().nodes.C.nextIndex?.B).toBe(3);

    stepTypes(simulator, 3);
    expect(simulator.getState().nodes.C.matchIndex?.B).toBe(4);
    expect(simulator.getState().nodes.C.nextIndex?.B).toBe(5);
  });

  it("emits deterministic retry attempts with the expected prevLog positions", () => {
    const simulator = getScenario("conflicting-logs").createSimulator();

    while (simulator.hasPendingActions()) {
      simulator.step();
    }

    const attempts = simulator
      .getState()
      .messages.filter(isAppendEntriesMessage)
      .filter((message) => message.to === "B")
      .map((message) => ({
        attempt: message.payload.attempt,
        prevLogIndex: message.payload.prevLogIndex,
        prevLogTerm: message.payload.prevLogTerm,
        entries: message.payload.entries.length,
      }));

    expect(attempts).toEqual([
      { attempt: 1, prevLogIndex: 4, prevLogTerm: 4, entries: 0 },
      { attempt: 2, prevLogIndex: 3, prevLogTerm: 3, entries: 1 },
      { attempt: 3, prevLogIndex: 2, prevLogTerm: 1, entries: 2 },
    ]);
  });
});
