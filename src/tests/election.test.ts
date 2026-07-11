import { describe, expect, it } from "vitest";
import { RaftSimulator } from "../simulator/core/RaftSimulator";
import { createInitialClusterState } from "../simulator/createInitialState";
import {
  DELIVER_REQUEST_VOTE_RESPONSE,
  handleRequestVoteDelivery,
  handleRequestVoteResponseDelivery,
  isCandidateLogUpToDate,
  majorityFor,
} from "../simulator/transitions/election";
import {
  basicLeaderElectionScenario,
  createBasicLeaderElectionSimulator,
} from "../simulator/scenarios/basicLeaderElection";
import type { ClusterState, RaftMessage, RaftNode } from "../simulator/types";

function runAll(simulator: RaftSimulator): void {
  while (simulator.hasPendingActions()) {
    simulator.step();
  }
}

function requestVoteMessage(overrides: Partial<RaftMessage> = {}): RaftMessage {
  return {
    id: "message-1",
    type: "request_vote",
    from: "B",
    to: "A",
    term: 1,
    status: "queued",
    payload: {
      term: 1,
      candidateId: "B",
      lastLogIndex: 0,
      lastLogTerm: 0,
    },
    ...overrides,
  };
}

function responseMessage(
  voteGranted: boolean,
  overrides: Partial<RaftMessage> = {},
): RaftMessage {
  return {
    id: "message-1",
    type: "request_vote_response",
    from: "A",
    to: "B",
    term: 1,
    status: "queued",
    payload: {
      term: 1,
      voteGranted,
      voterId: "A",
    },
    ...overrides,
  };
}

function candidateNode(overrides: Partial<RaftNode> = {}): RaftNode {
  return {
    id: "B",
    role: "candidate",
    status: "running",
    currentTerm: 1,
    votedFor: "B",
    log: [],
    commitIndex: 0,
    lastApplied: 0,
    electionElapsed: 0,
    electionTimeout: 0,
    heartbeatElapsed: 0,
    partitionId: null,
    votesReceived: ["B"],
    ...overrides,
  };
}

describe("Basic leader election", () => {
  it("turns Node B into a candidate after election timeout", () => {
    const simulator = createBasicLeaderElectionSimulator();

    simulator.step();
    const state = simulator.getState();

    expect(state.nodes.B.role).toBe("candidate");
    expect(state.nodes.B.currentTerm).toBe(1);
    expect(state.nodes.B.votedFor).toBe("B");
    expect(state.nodes.B.votesReceived).toEqual(["B"]);
  });

  it("creates RequestVote messages for every peer except itself", () => {
    const simulator = createBasicLeaderElectionSimulator();

    simulator.step();
    const messages = simulator.getState().messages;

    expect(messages).toHaveLength(4);
    expect(messages.map((message) => message.to)).toEqual(["A", "C", "D", "E"]);
    expect(messages.some((message) => message.to === "B")).toBe(false);
  });

  it("uses the correct RequestVote payload for an empty log", () => {
    const simulator = createBasicLeaderElectionSimulator();

    simulator.step();
    const message = simulator.getState().messages[0];

    expect(message.type).toBe("request_vote");
    expect(message.payload).toMatchObject({
      term: 1,
      candidateId: "B",
      lastLogIndex: 0,
      lastLogTerm: 0,
    });
  });

  it("rejects lower-term RequestVote messages", () => {
    const state = createInitialClusterState(["A", "B"]);
    state.nodes.A.currentTerm = 2;
    state.messages = [requestVoteMessage({ term: 1 })];

    const result = handleRequestVoteDelivery(
      state,
      { id: "action", type: "deliver_request_vote", scheduledTime: 10, sequence: 1, payload: { messageId: "message-1" } },
      testContext(),
    );

    expect(result.outgoingMessages?.[0].payload).toMatchObject({ voteGranted: false });
    expect(result.nextState.nodes.A.currentTerm).toBe(2);
  });

  it("updates term and remains follower for higher-term RequestVote messages", () => {
    const state = createInitialClusterState(["A", "B"]);
    state.nodes.A.role = "candidate";
    state.nodes.A.currentTerm = 1;
    state.nodes.A.votedFor = "A";
    state.nodes.A.votesReceived = ["A"];
    state.messages = [requestVoteMessage({ term: 2, payload: { term: 2, candidateId: "B", lastLogIndex: 0, lastLogTerm: 0 } })];

    const result = handleRequestVoteDelivery(
      state,
      { id: "action", type: "deliver_request_vote", scheduledTime: 10, sequence: 1, payload: { messageId: "message-1" } },
      testContext(),
    );

    expect(result.nextState.nodes.A.currentTerm).toBe(2);
    expect(result.nextState.nodes.A.role).toBe("follower");
    expect(result.outgoingMessages?.[0].payload).toMatchObject({ voteGranted: true });
  });

  it("allows voting once per term and allows repeat requests from the same candidate", () => {
    const state = createInitialClusterState(["A", "B", "D"]);
    state.nodes.A.currentTerm = 1;
    state.nodes.A.votedFor = "B";
    state.messages = [requestVoteMessage()];

    const repeat = handleRequestVoteDelivery(
      state,
      { id: "action", type: "deliver_request_vote", scheduledTime: 10, sequence: 1, payload: { messageId: "message-1" } },
      testContext(),
    );
    expect(repeat.outgoingMessages?.[0].payload).toMatchObject({ voteGranted: true });

    state.messages = [
      requestVoteMessage({
        id: "message-2",
        from: "D",
        payload: { term: 1, candidateId: "D", lastLogIndex: 0, lastLogTerm: 0 },
      }),
    ];
    const otherCandidate = handleRequestVoteDelivery(
      state,
      { id: "action", type: "deliver_request_vote", scheduledTime: 10, sequence: 1, payload: { messageId: "message-2" } },
      testContext(),
    );
    expect(otherCandidate.outgoingMessages?.[0].payload).toMatchObject({ voteGranted: false });
  });

  it("compares candidate logs by term first and index second", () => {
    const voterLog = [
      { index: 1, term: 1, command: "SET x=1", committed: false, applied: false },
      { index: 2, term: 2, command: "SET y=1", committed: false, applied: false },
    ];

    expect(isCandidateLogUpToDate(1, 3, voterLog)).toBe(true);
    expect(isCandidateLogUpToDate(10, 1, voterLog)).toBe(false);
    expect(isCandidateLogUpToDate(2, 2, voterLog)).toBe(true);
    expect(isCandidateLogUpToDate(1, 2, voterLog)).toBe(false);
  });

  it("does not count rejected, duplicate, lower-term, or higher-term responses incorrectly", () => {
    const rejected = runResponse(responseMessage(false));
    expect(rejected.nextState.nodes.B.votesReceived).toEqual(["B"]);

    const duplicateState = createInitialClusterState(["A", "B", "C"]);
    duplicateState.nodes.B = candidateNode({ votesReceived: ["B", "A"] });
    duplicateState.messages = [responseMessage(true)];
    const duplicate = handleRequestVoteResponseDelivery(
      duplicateState,
      { id: "action", type: DELIVER_REQUEST_VOTE_RESPONSE, scheduledTime: 10, sequence: 1, payload: { messageId: "message-1" } },
      testContext(),
    );
    expect(duplicate.nextState.nodes.B.votesReceived).toEqual(["B", "A"]);

    const lower = runResponse(responseMessage(true, { term: 0, payload: { term: 0, voteGranted: true, voterId: "A" } }));
    expect(lower.nextState.nodes.B.votesReceived).toEqual(["B"]);

    const higher = runResponse(responseMessage(true, { term: 2, payload: { term: 2, voteGranted: true, voterId: "A" } }));
    expect(higher.nextState.nodes.B.role).toBe("follower");
    expect(higher.nextState.nodes.B.currentTerm).toBe(2);
  });

  it("computes majority generically", () => {
    expect(majorityFor(5)).toBe(3);
    expect(majorityFor(3)).toBe(2);
    expect(majorityFor(1)).toBe(1);
  });

  it("keeps Node B candidate with two votes and leader with three votes", () => {
    const twoVotes = runResponse(responseMessage(true));
    expect(twoVotes.nextState.nodes.B.role).toBe("candidate");
    expect(twoVotes.nextState.nodes.B.votesReceived).toEqual(["B", "A"]);

    const state = createInitialClusterState(["A", "B", "C", "D", "E"]);
    state.nodes.B = candidateNode({ votesReceived: ["B", "A"] });
    state.messages = [responseMessage(true, { from: "C", payload: { term: 1, voteGranted: true, voterId: "C" } })];
    const threeVotes = handleRequestVoteResponseDelivery(
      state,
      { id: "action", type: DELIVER_REQUEST_VOTE_RESPONSE, scheduledTime: 10, sequence: 1, payload: { messageId: "message-1" } },
      testContext(),
    );

    expect(threeVotes.nextState.nodes.B.role).toBe("leader");
    expect(threeVotes.nextState.nodes.B.currentTerm).toBe(1);
    expect(threeVotes.nextState.nodes.B.nextIndex).toEqual({ A: 1, B: 1, C: 1, D: 1, E: 1 });
    expect(threeVotes.nextState.nodes.B.matchIndex).toEqual({ A: 0, B: 0, C: 0, D: 0, E: 0 });
  });

  it("runs the deterministic scenario to one unique leader and then heartbeats", () => {
    const simulator = createBasicLeaderElectionSimulator();

    runAll(simulator);
    const state = simulator.getState();
    const leaders = Object.values(state.nodes).filter((node) => node.role === "leader");

    expect(leaders.map((node) => node.id)).toEqual(["B"]);
    expect(state.nodes.B.currentTerm).toBe(1);
    expect(["A", "C", "D", "E"].every((nodeId) => state.nodes[nodeId].role === "follower")).toBe(true);
    expect(state.messages.filter((message) => message.type === "append_entries")).toHaveLength(8);
    expect(state.events.filter((event) => event.type === "leader_elected")).toHaveLength(1);
  });

  it("is deterministic across reset and rerun", () => {
    const simulator = createBasicLeaderElectionSimulator();

    runAll(simulator);
    const first = summarize(simulator.getState());
    simulator.reset();
    runAll(simulator);
    const second = summarize(simulator.getState());

    expect(second).toEqual(first);
  });

  it("starts from the Basic Leader Election initial state", () => {
    const state = basicLeaderElectionScenario.initialState;

    expect(Object.values(state.nodes).every((node) => node.role === "follower")).toBe(true);
    expect(Object.values(state.nodes).every((node) => node.currentTerm === 0)).toBe(true);
    expect(Object.values(state.nodes).some((node) => node.role === "leader")).toBe(false);
  });

  it("restores initial scenario actions on reset", () => {
    const simulator = createBasicLeaderElectionSimulator();

    simulator.step();
    simulator.reset();

    expect(simulator.getPendingActions()).toEqual(basicLeaderElectionScenario.initialActions);
  });
});

function runResponse(message: RaftMessage) {
  const state = createInitialClusterState(["A", "B", "C", "D", "E"]);
  state.nodes.B = candidateNode();
  state.messages = [message];

  return handleRequestVoteResponseDelivery(
    state,
    { id: "action", type: DELIVER_REQUEST_VOTE_RESPONSE, scheduledTime: 10, sequence: 1, payload: { messageId: message.id } },
    testContext(),
  );
}

function summarize(state: ClusterState) {
  return {
    nodes: state.nodes,
    messages: state.messages.map((message) => ({
      id: message.id,
      type: message.type,
      from: message.from,
      to: message.to,
      status: message.status,
    })),
    events: state.events.map((event) => ({
      step: event.step,
      type: event.type,
      logicalTime: event.logicalTime,
      title: event.title,
    })),
    logicalTime: state.logicalTime,
  };
}

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
