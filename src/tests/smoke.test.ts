import { describe, expect, it } from "vitest";
import { demoClusterState } from "../simulator/demoState";

describe("Phase 1 project setup", () => {
  it("loads the static demo cluster with five nodes", () => {
    expect(Object.keys(demoClusterState.nodes)).toHaveLength(5);
    expect(demoClusterState.nodes.B.role).toBe("leader");
    expect(demoClusterState.logicalTime).toBe(300);
  });
});
