import { describe, expect, it } from "vitest";
import { isAppendEntriesResponseMessage } from "../simulator/messageTypes";
import { getScenario } from "../simulator/scenarios/registry";
import {
  DELIVER_APPEND_ENTRIES_RESPONSE,
  handleAppendEntriesResponseDelivery,
} from "../simulator/transitions/heartbeat";
import type { RaftSimulator } from "../simulator/core/RaftSimulator";

function runAll(simulator: RaftSimulator): void {
  while (simulator.hasPendingActions()) {
    simulator.step();
  }
}

describe("log reconciliation", () => {
  it("converges Node B to the leader log without changing the committed prefix", () => {
    const simulator = getScenario("conflicting-logs").createSimulator();

    runAll(simulator);
    const state = simulator.getState();
    const leaderLog = state.nodes.C.log;
    const repairedLog = state.nodes.B.log;

    expect(repairedLog).toEqual(leaderLog);
    expect(repairedLog.slice(0, 2).map((entry) => entry.command)).toEqual([
      "SET x = 1",
      "SET y = 2",
    ]);
    expect(repairedLog.slice(2).map((entry) => entry.command)).toEqual([
      "SET x = 5",
      "SET z = 8",
    ]);
    expect(state.nodes.B.commitIndex).toBe(2);
    expect(state.nodes.B.lastApplied).toBe(2);
    expect(repairedLog[2]).toMatchObject({ committed: false, applied: false });
    expect(repairedLog[3]).toMatchObject({ committed: false, applied: false });
  });

  it("records rejection, backtracking, truncation, and convergence teaching events", () => {
    const simulator = getScenario("conflicting-logs").createSimulator();

    runAll(simulator);
    const eventTypes = simulator.getState().events.map((event) => event.type);

    expect(eventTypes.filter((type) => type === "append_entries_rejected")).toHaveLength(2);
    expect(eventTypes.filter((type) => type === "append_entries_backtracked")).toHaveLength(2);
    expect(eventTypes).toContain("conflict_truncation");
    expect(eventTypes).toContain("append_entries_response_received");
  });

  it("ignores a stale failure response after a newer retry already advanced nextIndex", () => {
    const simulator = getScenario("conflicting-logs").createSimulator();

    simulator.step();
    simulator.step();
    simulator.step();
    const nextIndexAfterFirstFailure = simulator.getState().nodes.C.nextIndex?.B;
    simulator.step();
    simulator.step();
    simulator.step();

    expect(nextIndexAfterFirstFailure).toBe(4);
    expect(simulator.getState().nodes.C.nextIndex?.B).toBe(3);

    const staleFailure = simulator
      .getState()
      .messages.find(
        (message) =>
          isAppendEntriesResponseMessage(message) &&
          message.from === "B" &&
          message.payload.success === false &&
          message.payload.rejectedNextIndex === 5,
      );

    expect(staleFailure).toBeDefined();
    if (!staleFailure) {
      return;
    }

    const state = simulator.getState();
    state.messages = [{ ...staleFailure, id: "stale-failure", status: "queued" }];

    const result = handleAppendEntriesResponseDelivery(
      state,
      {
        id: "action",
        type: DELIVER_APPEND_ENTRIES_RESPONSE,
        scheduledTime: state.logicalTime + 1,
        sequence: 1,
        payload: { messageId: "stale-failure" },
      },
      testContext(),
    );

    expect(result.nextState.nodes.C.nextIndex?.B).toBe(3);
    expect(result.scheduledActions).toBeUndefined();
    expect(result.emittedEvents[0].type).toBe("stale_append_entries_failure_ignored");
  });
});

function testContext() {
  let event = 1;
  let message = 1;
  let action = 1;

  return {
    createEventId: () => `event-${event++}`,
    createMessageId: () => `message-${message++}`,
    createActionId: () => `action-${action++}`,
  };
}
