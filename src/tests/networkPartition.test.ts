import { describe, expect, it } from "vitest";
import type { RaftSimulator } from "../simulator/core/RaftSimulator";
import { getScenario } from "../simulator/scenarios/registry";

function runAll(simulator: RaftSimulator): void {
  while (simulator.hasPendingActions()) simulator.step();
}

function runUntil(simulator: RaftSimulator, logicalTime: number): void {
  while (
    simulator.hasPendingActions() &&
    Math.min(...simulator.getPendingActions().map((action) => action.scheduledTime)) <= logicalTime
  ) {
    simulator.step();
  }
}

describe("network partition scenario", () => {
  it("keeps the old leader in the minority while the majority elects a higher-term leader", () => {
    const simulator = getScenario("network-partition").createSimulator();

    runUntil(simulator, 4700);
    const state = simulator.getState();

    expect(state.nodes.B.role).toBe("leader");
    expect(state.nodes.B.currentTerm).toBe(1);
    expect(state.nodes.B.partitionId).toBe("minority");
    expect(state.nodes.C.role).toBe("leader");
    expect(state.nodes.C.currentTerm).toBe(2);
    expect(state.nodes.C.partitionId).toBe("majority");
    expect(
      Object.values(state.nodes).filter((node) => node.role === "leader" && node.currentTerm === 1),
    ).toHaveLength(1);
    expect(
      Object.values(state.nodes).filter((node) => node.role === "leader" && node.currentTerm === 2),
    ).toHaveLength(1);
  });

  it("does not let the minority leader commit a client command", () => {
    const simulator = getScenario("network-partition").createSimulator();

    runUntil(simulator, 3820);
    const state = simulator.getState();

    expect(state.nodes.B.log[0]).toMatchObject({
      index: 1,
      term: 1,
      command: "SET x = 10",
      committed: false,
      applied: false,
    });
    expect(state.nodes.A.log[0]).toMatchObject({
      index: 1,
      term: 1,
      command: "SET x = 10",
      committed: false,
      applied: false,
    });
    expect(state.nodes.C.log).toHaveLength(0);
    expect(state.nodes.D.log).toHaveLength(0);
    expect(state.nodes.E.log).toHaveLength(0);
    expect(state.nodes.B.commitIndex).toBe(0);
    expect(state.nodes.B.lastApplied).toBe(0);
    expect(state.events.some((event) => event.type === "minority_commit_blocked")).toBe(true);
  });

  it("drops cross-partition messages and distinguishes them from crashed targets", () => {
    const simulator = getScenario("network-partition").createSimulator();

    runUntil(simulator, 3820);
    const state = simulator.getState();

    expect(
      state.messages.some(
        (message) =>
          message.from === "B" &&
          ["C", "D", "E"].includes(message.to) &&
          message.status === "dropped" &&
          message.dropReason === "network_partition",
      ),
    ).toBe(true);
    expect(
      state.messages.every((message) => message.dropReason !== "target_crashed"),
    ).toBe(true);
  });

  it("heals connectivity and repairs the minority's old uncommitted log", () => {
    const simulator = getScenario("network-partition").createSimulator();

    runAll(simulator);
    const state = simulator.getState();

    expect(Object.values(state.nodes).every((node) => node.partitionId === null)).toBe(true);
    expect(state.nodes.C.role).toBe("leader");
    expect(state.nodes.C.currentTerm).toBe(2);
    expect(state.nodes.B.role).toBe("follower");
    expect(state.nodes.B.currentTerm).toBe(2);
    expect(state.nodes.B.nextIndex).toBeUndefined();
    expect(state.nodes.B.matchIndex).toBeUndefined();
    expect(Object.values(state.nodes).every((node) => node.currentTerm === 2)).toBe(true);
    expect(Object.values(state.nodes).filter((node) => node.role === "leader")).toHaveLength(1);
    expect(Object.values(state.nodes).every((node) => node.log[0]?.command === "SET x = 20")).toBe(true);
    expect(Object.values(state.nodes).every((node) => node.log[0]?.term === 2)).toBe(true);
    expect(Object.values(state.nodes).every((node) => node.commitIndex === 1)).toBe(true);
    expect(Object.values(state.nodes).every((node) => node.lastApplied === 1)).toBe(true);
    expect(Object.values(state.nodes).some((node) => node.log.some((entry) => entry.command === "SET x = 10"))).toBe(false);
    expect(simulator.hasPendingActions()).toBe(false);
  });

  it("is deterministic across reruns", () => {
    const first = getScenario("network-partition").createSimulator();
    const second = getScenario("network-partition").createSimulator();

    runAll(first);
    runAll(second);

    expect(second.getState()).toEqual(first.getState());
  });
});
