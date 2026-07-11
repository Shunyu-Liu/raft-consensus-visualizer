import { describe, expect, it } from "vitest";
import type { RaftSimulator } from "../simulator/core/RaftSimulator";
import { getScenario } from "../simulator/scenarios/registry";

function runAll(simulator: RaftSimulator): void {
  while (simulator.hasPendingActions()) simulator.step();
}

describe("leader failure scenario", () => {
  it("elects Node C after Node B crashes and drops messages to crashed B", () => {
    const simulator = getScenario("leader-failure").createSimulator();

    runAll(simulator);
    const state = simulator.getState();
    const leaders = Object.values(state.nodes).filter((node) => node.role === "leader" && node.status === "running");

    expect(leaders.map((node) => node.id)).toEqual(["C"]);
    expect(state.nodes.C.currentTerm).toBe(2);
    expect(state.nodes.B.status).toBe("running");
    expect(state.nodes.B.role).toBe("follower");
    expect(state.nodes.B.currentTerm).toBe(2);
    expect(state.messages.some((message) => message.to === "B" && message.status === "dropped")).toBe(true);
    expect(simulator.hasPendingActions()).toBe(false);
  });

  it("is deterministic across reruns", () => {
    const first = getScenario("leader-failure").createSimulator();
    const second = getScenario("leader-failure").createSimulator();
    runAll(first);
    runAll(second);

    expect(second.getState()).toEqual(first.getState());
  });
});
