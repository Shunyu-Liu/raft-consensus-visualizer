import { describe, expect, it } from "vitest";
import { getScenario } from "../simulator/scenarios/registry";
import type { RaftSimulator } from "../simulator/core/RaftSimulator";

function runAll(simulator: RaftSimulator): void {
  while (simulator.hasPendingActions()) {
    simulator.step();
  }
}

function summarize(simulator: RaftSimulator) {
  const state = simulator.getState();
  return {
    nodes: state.nodes,
    messages: state.messages.map((message) => ({
      id: message.id,
      type: message.type,
      from: message.from,
      to: message.to,
      status: message.status,
      payload: message.payload,
    })),
    events: state.events.map((event) => ({
      type: event.type,
      title: event.title,
      logicalTime: event.logicalTime,
    })),
    pendingActions: simulator.getPendingActions(),
    logicalTime: state.logicalTime,
  };
}

describe("conflicting logs scenario", () => {
  it("starts with Node C as Term 4 leader and Node B carrying an old suffix", () => {
    const scenario = getScenario("conflicting-logs");
    const state = scenario.createInitialState();

    expect(scenario.name).toBe("Conflicting Logs and Log Reconciliation");
    expect(state.nodes.C.role).toBe("leader");
    expect(state.nodes.C.currentTerm).toBe(4);
    expect(state.nodes.C.log.map((entry) => entry.term)).toEqual([1, 1, 3, 4]);
    expect(state.nodes.B.log.map((entry) => entry.term)).toEqual([1, 1, 2, 2]);
    expect(state.nodes.B.commitIndex).toBe(2);
    expect(state.nodes.C.nextIndex?.B).toBe(5);
    expect(state.nodes.C.matchIndex?.B).toBe(0);
    expect(scenario.createInitialActions()).toMatchObject([
      { type: "retry_append_entries", payload: { leaderId: "C", targetNodeId: "B", attempt: 1 } },
    ]);
  });

  it("repairs logs deterministically and drains the event queue", () => {
    const first = getScenario("conflicting-logs").createSimulator();
    const second = getScenario("conflicting-logs").createSimulator();

    runAll(first);
    runAll(second);

    expect(first.hasPendingActions()).toBe(false);
    expect(second.hasPendingActions()).toBe(false);
    expect(summarize(second)).toEqual(summarize(first));
    expect(first.getState().nodes.B.log).toEqual(first.getState().nodes.C.log);
  });
});
