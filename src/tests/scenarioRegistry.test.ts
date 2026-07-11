import { describe, expect, it } from "vitest";
import { getAvailableScenarios, getScenario } from "../simulator/scenarios/registry";

describe("scenario registry", () => {
  it("contains only implemented scenarios", () => {
    const ids = getAvailableScenarios().map((scenario) => scenario.id);

    expect(ids).toContain("basic-leader-election");
    expect(ids).toContain("leader-failure");
    expect(ids).toContain("split-vote");
    expect(ids).toContain("network-partition");
    expect(ids).toContain("conflicting-logs");
    expect(ids).toHaveLength(5);
  });

  it("creates independent initial state objects", () => {
    const scenario = getScenario("leader-failure");
    const first = scenario.createInitialState();
    const second = scenario.createInitialState();

    first.nodes.A.currentTerm = 99;

    expect(second.nodes.A.currentTerm).toBe(0);
  });
});
