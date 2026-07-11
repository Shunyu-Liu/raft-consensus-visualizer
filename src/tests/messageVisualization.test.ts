import { describe, expect, it } from "vitest";
import { getVisibleMessageIds } from "../components/cluster/messageVisibility";
import { buildMessageActivityFrames, getMessageActivity } from "../components/cluster/messageActivity";
import { assignDirectionalLanes, createRoute } from "../components/cluster/messageRouting";
import type { ClusterState, RaftMessage } from "../simulator/types";

const message = (id: string, from = "A", to = "B"): RaftMessage => ({
  id, type: "request_vote", from, to, term: 1, status: "queued",
  payload: { term: 1, candidateId: from, lastLogIndex: 0, lastLogTerm: 0 },
});
const state = (messages: RaftMessage[]): ClusterState => ({ nodes: {}, messages, events: [], currentStep: 0, logicalTime: 0 });

describe("message focus and deterministic routing", () => {
  it("classifies created and delivered activity without object identity", () => {
    const first = message("m1");
    const second = { ...first, status: "delivered" as const, deliveredAtLogicalTime: 10 };
    expect(getMessageActivity(state([]), state([first]), 1)[0].kind).toBe("created");
    expect(getMessageActivity(state([first]), state([second]), 2)[0].kind).toBe("delivered");
  });

  it("keeps focus to the current frame and context to three frames", () => {
    const frames = [1, 2, 3, 4].map((actionStep) => ({ actionStep, messageIds: [`m${actionStep}`], activityByMessageId: { [`m${actionStep}`]: "created" as const } }));
    const messages = frames.map((frame) => message(frame.messageIds[0]));
    expect([...getVisibleMessageIds(messages, "focus", 4, frames, null)]).toEqual(["m4"]);
    expect([...getVisibleMessageIds(messages, "context", 4, frames, null)]).toEqual(["m2", "m3", "m4"]);
    expect([...getVisibleMessageIds(messages, "all", 4, frames, null)]).toHaveLength(4);
  });

  it("does not expose future frames in historical mode and supports one pin", () => {
    const frames = [1, 2, 3].map((actionStep) => ({ actionStep, messageIds: [`m${actionStep}`], activityByMessageId: { [`m${actionStep}`]: "created" as const } }));
    const messages = frames.map((frame) => message(frame.messageIds[0]));
    expect([...getVisibleMessageIds(messages, "all", 2, frames, null)]).toEqual(["m1", "m2", "m3"]);
    expect([...getVisibleMessageIds(messages.slice(0, 2), "focus", 2, frames, "m1")].sort()).toEqual(["m1", "m2"]);
  });

  it("assigns stable opposite lanes and avoids the unrelated node when possible", () => {
    const messages = [message("m1", "A", "B"), message("m2", "A", "B"), message("m3", "B", "A")];
    const lanes = assignDirectionalLanes(messages);
    expect(lanes.get("m1")).not.toBe(lanes.get("m2"));
    expect(Math.sign(lanes.get("m1") ?? 0)).toBe(-Math.sign(lanes.get("m3") ?? 0));
    const route = createRoute(messages[0], { centerX: 0, centerY: 0, width: 100, height: 60 }, { centerX: 300, centerY: 0, width: 100, height: 60 }, lanes.get("m1") ?? 1, [{ centerX: 150, centerY: 160, width: 80, height: 50 }]);
    expect(route.path).toContain("M");
    expect(route.samplePoints).toHaveLength(22);
    expect(route.labelWidth).toBeGreaterThanOrEqual(72);
    expect(route.labelRect).toMatchObject({ height: 28 });
    expect(route.labelX).toBeCloseTo(route.labelRect.x + route.labelWidth / 2);
  });

  it("builds one activity frame per action snapshot", () => {
    const first = message("m1");
    const history = [{ stateAfter: state([first]) } as never];
    expect(buildMessageActivityFrames(state([]), history)[0].messageIds).toEqual(["m1"]);
  });
});
