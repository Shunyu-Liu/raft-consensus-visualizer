import { describe, expect, it } from "vitest";
import { RaftSimulator } from "../simulator/core/RaftSimulator";
import { createInitialClusterState } from "../simulator/createInitialState";
import type { ActionHandler } from "../simulator/transitions/types";
import type { ClusterState, RaftMessage, ScheduledAction } from "../simulator/types";

function makeMessage(id: string): RaftMessage {
  return {
    id,
    type: "append_entries",
    from: "A",
    to: "B",
    term: 0,
    status: "queued",
    payload: {
      term: 0,
      leaderId: "A",
      prevLogIndex: 0,
      prevLogTerm: 0,
      entries: [],
      leaderCommit: 0,
      purpose: "heartbeat",
    },
  };
}

describe("RaftSimulator", () => {
  it("reads state after construction", () => {
    const simulator = new RaftSimulator(createInitialClusterState());

    expect(Object.keys(simulator.getState().nodes)).toHaveLength(5);
  });

  it("returns deep snapshots from getState", () => {
    const simulator = new RaftSimulator(createInitialClusterState());
    const snapshot = simulator.getState();

    snapshot.nodes.A.currentTerm = 999;

    expect(simulator.getState().nodes.A.currentTerm).toBe(0);
  });

  it("protects internal initial state from external constructor mutations", () => {
    const initialState = createInitialClusterState();
    const simulator = new RaftSimulator(initialState);

    initialState.nodes.A.currentTerm = 999;
    simulator.reset();

    expect(simulator.getState().nodes.A.currentTerm).toBe(0);
  });

  it("executes at most one scheduled action per step", () => {
    const simulator = new RaftSimulator(createInitialClusterState());
    simulator.schedule({ id: "a", type: "engine_demo_tick", scheduledTime: 100, sequence: 1, payload: {} });
    simulator.schedule({ id: "b", type: "engine_demo_tick", scheduledTime: 200, sequence: 2, payload: {} });

    simulator.step();

    expect(simulator.getPendingActions()).toHaveLength(1);
    expect(simulator.getState().events).toHaveLength(1);
  });

  it("does not increment currentStep when stepping an empty queue", () => {
    const simulator = new RaftSimulator(createInitialClusterState());

    const result = simulator.step();

    expect(result.executed).toBe(false);
    expect(simulator.getState().currentStep).toBe(0);
  });

  it("increments currentStep and advances logicalTime after a successful step", () => {
    const simulator = new RaftSimulator(createInitialClusterState());
    simulator.schedule({ id: "a", type: "engine_demo_tick", scheduledTime: 500, sequence: 1, payload: {} });

    const result = simulator.step();

    expect(result.executed).toBe(true);
    expect(simulator.getState().currentStep).toBe(1);
    expect(simulator.getState().logicalTime).toBe(500);
  });

  it("rejects actions scheduled before current logicalTime", () => {
    const simulator = new RaftSimulator(createInitialClusterState());
    simulator.schedule({ id: "a", type: "engine_demo_tick", scheduledTime: 500, sequence: 1, payload: {} });
    simulator.step();

    expect(() => {
      simulator.schedule({ id: "late", type: "engine_demo_tick", scheduledTime: 300, sequence: 2, payload: {} });
    }).toThrow(/logical time/);
  });

  it("adds teaching events produced by transitions", () => {
    const simulator = new RaftSimulator(createInitialClusterState());
    simulator.schedule({ id: "a", type: "engine_demo_tick", scheduledTime: 100, sequence: 1, payload: {} });

    const result = simulator.step();

    expect(result.emittedEvents).toHaveLength(1);
    expect(simulator.getState().events[0].title).toBe("Phase 2 Engine Event");
  });

  it("adds outgoing messages produced by transitions", () => {
    const simulator = new RaftSimulator(createInitialClusterState());
    const handler: ActionHandler = (state, _action, context) => ({
      nextState: state,
      emittedEvents: [],
      outgoingMessages: [makeMessage(context.createMessageId())],
    });

    simulator.registerHandler("emit_message", handler);
    simulator.schedule({ id: "a", type: "emit_message", scheduledTime: 100, sequence: 1, payload: {} });
    simulator.step();

    expect(simulator.getState().messages).toHaveLength(1);
    expect(simulator.getState().messages[0].status).toBe("queued");
  });

  it("enqueues scheduled actions produced by transitions", () => {
    const simulator = new RaftSimulator(createInitialClusterState());
    const handler: ActionHandler = (state, _action, context) => ({
      nextState: state,
      emittedEvents: [],
      scheduledActions: [
        {
          id: context.createActionId(),
          type: "engine_demo_tick",
          scheduledTime: state.logicalTime + 100,
          sequence: 10,
          payload: {},
        },
      ],
    });

    simulator.registerHandler("schedule_more", handler);
    simulator.schedule({ id: "a", type: "schedule_more", scheduledTime: 100, sequence: 1, payload: {} });
    simulator.step();

    expect(simulator.getPendingActions()).toHaveLength(1);
    expect(simulator.getPendingActions()[0].type).toBe("engine_demo_tick");
  });

  it("resets state, logicalTime, currentStep, and runtime changes", () => {
    const simulator = new RaftSimulator(createInitialClusterState());
    simulator.schedule({ id: "a", type: "engine_demo_tick", scheduledTime: 500, sequence: 1, payload: {} });
    simulator.step();

    simulator.reset();
    const state = simulator.getState();

    expect(state.currentStep).toBe(0);
    expect(state.logicalTime).toBe(0);
    expect(state.events).toEqual([]);
    expect(simulator.hasPendingActions()).toBe(false);
  });

  it("restores deterministic ID generation after reset", () => {
    const simulator = new RaftSimulator(createInitialClusterState());

    const first = simulator.createAction("engine_demo_tick", 100, {});
    simulator.schedule(first);
    simulator.step();
    simulator.reset();
    const second = simulator.createAction("engine_demo_tick", 100, {});

    expect(second.id).toBe(first.id);
    expect(second.sequence).toBe(first.sequence);
  });

  it("allows a transition to return a modified nextState without mutating the previous snapshot", () => {
    const simulator = new RaftSimulator(createInitialClusterState());
    const handler: ActionHandler = (state: ClusterState) => ({
      nextState: {
        ...state,
        nodes: {
          ...state.nodes,
          A: { ...state.nodes.A, electionElapsed: 100 },
        },
      },
      emittedEvents: [],
    });

    simulator.registerHandler("advance_elapsed_for_test", handler);
    simulator.schedule({
      id: "a",
      type: "advance_elapsed_for_test",
      scheduledTime: 100,
      sequence: 1,
      payload: {},
    } satisfies ScheduledAction);
    simulator.step();

    expect(simulator.getState().nodes.A.electionElapsed).toBe(100);
  });
});
