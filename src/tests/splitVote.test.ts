import { describe, expect, it } from "vitest";
import { getScenario } from "../simulator/scenarios/registry";

describe("split vote scenario", () => {
  it("shows a split vote in Term 1 and Node A winning Term 2", () => {
    const simulator = getScenario("split-vote").createSimulator();

    simulator.step();
    let state = simulator.getState();
    expect(state.nodes.A.role).toBe("candidate");
    expect(state.nodes.D.role).toBe("candidate");
    expect(state.nodes.A.votesReceived).toEqual(["A", "B"]);
    expect(state.nodes.D.votesReceived).toEqual(["D", "E"]);
    expect(Object.values(state.nodes).some((node) => node.role === "leader")).toBe(false);

    simulator.step();
    state = simulator.getState();
    expect(state.nodes.A.role).toBe("leader");
    expect(state.nodes.A.currentTerm).toBe(2);
    expect(state.nodes.D.role).toBe("follower");
    expect(state.nodes.D.currentTerm).toBe(2);
    expect(state.nodes.D.votesReceived).toBeUndefined();
    expect(simulator.hasPendingActions()).toBe(false);
  });

  it("is deterministic across reruns", () => {
    const first = getScenario("split-vote").createSimulator();
    const second = getScenario("split-vote").createSimulator();
    while (first.hasPendingActions()) first.step();
    while (second.hasPendingActions()) second.step();

    expect(second.getState()).toEqual(first.getState());
  });
});
