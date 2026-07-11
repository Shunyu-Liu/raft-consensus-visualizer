import { describe, expect, it } from "vitest";
import { createInitialClusterState } from "../simulator/createInitialState";

describe("createInitialClusterState", () => {
  it("creates five follower nodes by default", () => {
    const state = createInitialClusterState();

    expect(Object.keys(state.nodes)).toEqual(["A", "B", "C", "D", "E"]);
    expect(Object.values(state.nodes).every((node) => node.role === "follower")).toBe(true);
  });

  it("creates running nodes with term zero and empty logs", () => {
    const state = createInitialClusterState();

    for (const node of Object.values(state.nodes)) {
      expect(node.status).toBe("running");
      expect(node.currentTerm).toBe(0);
      expect(node.votedFor).toBeNull();
      expect(node.log).toEqual([]);
    }
  });

  it("does not create a global cluster currentTerm or leader", () => {
    const state = createInitialClusterState();

    expect("currentTerm" in state).toBe(false);
    expect(Object.values(state.nodes).some((node) => node.role === "leader")).toBe(false);
  });
});
