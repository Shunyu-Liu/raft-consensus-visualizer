import type { RaftSimulator } from "../core/RaftSimulator";
import type { ActionHandler, TransitionContext, TransitionResult } from "./types";
import { getMessageDeliveryBlock } from "../network/topology";
import type {
  ClusterState,
  LogEntry,
  NodeId,
  RaftMessage,
  RaftNode,
  RequestVoteResponse,
  ScheduledAction,
  SimulationEvent,
  StateChange,
} from "../types";

export const ELECTION_TIMEOUT = "election_timeout";
export const DELIVER_REQUEST_VOTE = "deliver_request_vote";
export const DELIVER_REQUEST_VOTE_RESPONSE = "deliver_request_vote_response";

interface ElectionTimeoutPayload {
  nodeId: NodeId;
}

interface MessageDeliveryPayload {
  messageId: string;
}

export function registerElectionHandlers(simulator: RaftSimulator): void {
  simulator.registerHandler(ELECTION_TIMEOUT, handleElectionTimeout);
  simulator.registerHandler(DELIVER_REQUEST_VOTE, handleRequestVoteDelivery);
  simulator.registerHandler(
    DELIVER_REQUEST_VOTE_RESPONSE,
    handleRequestVoteResponseDelivery,
  );
}

export function majorityFor(nodeCount: number): number {
  return Math.floor(nodeCount / 2) + 1;
}

export function isCandidateLogUpToDate(
  candidateLastLogIndex: number,
  candidateLastLogTerm: number,
  voterLog: LogEntry[],
): boolean {
  const voterLast = getLastLogPosition(voterLog);

  if (candidateLastLogTerm !== voterLast.term) {
    return candidateLastLogTerm > voterLast.term;
  }

  return candidateLastLogIndex >= voterLast.index;
}

export const handleElectionTimeout: ActionHandler = (
  state,
  action,
  context,
) => {
  const payload = readElectionTimeoutPayload(action.payload);
  const candidate = state.nodes[payload.nodeId];

  if (!candidate || candidate.status !== "running") {
    return { nextState: state, emittedEvents: [] };
  }

  const previousRole = candidate.role;
  const previousTerm = candidate.currentTerm;
  const previousVote = candidate.votedFor;
  const nextTerm = previousTerm + 1;
  const nextCandidate: RaftNode = {
    ...candidate,
    role: "candidate",
    currentTerm: nextTerm,
    votedFor: candidate.id,
    votesReceived: [candidate.id],
  };
  const nextState: ClusterState = {
    ...state,
    nodes: {
      ...state.nodes,
      [candidate.id]: nextCandidate,
    },
  };
  const peers = Object.keys(state.nodes).filter((nodeId) => nodeId !== candidate.id);
  const requestVoteMessages = peers.map((peerId) =>
    createRequestVoteMessage(context, nextCandidate, peerId, action.scheduledTime),
  );
  const deliveryActions = requestVoteMessages.map((message, index) =>
    createDeliveryAction(
      context,
      DELIVER_REQUEST_VOTE,
      action.scheduledTime + 100 * (index + 1),
      message.id,
    ),
  );

  return {
    nextState,
    emittedEvents: [
      createEvent(context, action.scheduledTime, {
        type: "election_timeout",
        title: `Node ${candidate.id} election timeout expired`,
        description: `Node ${candidate.id} did not receive a valid leader heartbeat before its election timeout expired.`,
        explanation:
          "A follower starts a new election when it waits past its election timeout without hearing from a valid leader.",
        raftRule:
          "Election timeouts are the trigger that lets Raft make progress when no leader is known.",
        sourceNode: candidate.id,
        term: nextTerm,
        paperSection: "Section 5.2 — Leader Election",
      }),
      createEvent(context, action.scheduledTime, {
        type: "role_changed",
        title: `Node ${candidate.id} became a candidate`,
        description: `Node ${candidate.id} changed from ${previousRole} to candidate.`,
        explanation:
          "A timed-out follower becomes a candidate so it can ask the cluster for leadership votes.",
        raftRule: "A server starts an election by becoming a candidate.",
        sourceNode: candidate.id,
        term: nextTerm,
        paperSection: "Section 5.2 — Leader Election",
        stateChanges: [change(candidate.id, "role", previousRole, "candidate")],
      }),
      createEvent(context, action.scheduledTime, {
        type: "term_incremented",
        title: `Node ${candidate.id} started Term ${nextTerm}`,
        description: `Node ${candidate.id} increased its current term from ${previousTerm} to ${nextTerm}.`,
        explanation:
          "Terms act like logical election rounds. Starting an election always moves the candidate into a new term.",
        raftRule: "A candidate increments its current term before requesting votes.",
        sourceNode: candidate.id,
        term: nextTerm,
        paperSection: "Section 5.2 — Leader Election",
        stateChanges: [change(candidate.id, "currentTerm", previousTerm, nextTerm)],
      }),
      createEvent(context, action.scheduledTime, {
        type: "self_vote",
        title: `Node ${candidate.id} voted for itself`,
        description: `Node ${candidate.id} recorded its own vote for Term ${nextTerm}.`,
        explanation:
          "A candidate votes for itself immediately, so it starts the election with one vote.",
        raftRule: "A candidate votes for itself when starting an election.",
        sourceNode: candidate.id,
        term: nextTerm,
        paperSection: "Section 5.2 — Leader Election",
        stateChanges: [
          change(candidate.id, "votedFor", previousVote, candidate.id),
          change(candidate.id, "votesReceived", undefined, [candidate.id]),
        ],
      }),
      createEvent(context, action.scheduledTime, {
        type: "request_vote_sent",
        title: `Node ${candidate.id} sent RequestVote RPCs`,
        description: `Node ${candidate.id} sent RequestVote RPCs to ${peers.map((peer) => `Node ${peer}`).join(", ")}.`,
        explanation:
          "Each RequestVote includes the candidate term, candidate id, and the candidate's last log position.",
        raftRule:
          "A candidate requests votes from every other server in the cluster.",
        sourceNode: candidate.id,
        term: nextTerm,
        paperSection: "Section 5.2 — Leader Election",
      }),
    ],
    outgoingMessages: requestVoteMessages,
    scheduledActions: deliveryActions,
  };
};

export const handleRequestVoteDelivery: ActionHandler = (
  state,
  action,
  context,
) => {
  const payload = readMessageDeliveryPayload(action.payload);
  const message = state.messages.find((candidate) => candidate.id === payload.messageId);

  if (!message || message.type !== "request_vote" || !isRequestVoteRPC(message.payload)) {
    return { nextState: state, emittedEvents: [] };
  }

  const candidateId = message.payload.candidateId;
  const deliveryBlock = getMessageDeliveryBlock(state, message);
  if (deliveryBlock) {
    return {
      nextState: state,
      emittedEvents: [],
      messageStatusUpdates: [
        {
          messageId: message.id,
          status: "dropped",
          logicalTime: action.scheduledTime,
          reason: deliveryBlock.reason,
        },
      ],
    };
  }

  const voter = state.nodes[message.to];
  const voteDecision = decideVote(voter, message.payload);
  const nextVoter = voteDecision.node;
  const nextState: ClusterState = {
    ...state,
    nodes: {
      ...state.nodes,
      [nextVoter.id]: nextVoter,
    },
  };
  const response = createRequestVoteResponseMessage(
    context,
    nextVoter,
    message.from,
    voteDecision.voteGranted,
    action.scheduledTime,
  );

  return {
    nextState,
    emittedEvents: [
      createEvent(context, action.scheduledTime, {
        type: voteDecision.voteGranted ? "vote_granted" : "vote_rejected",
        title: voteDecision.voteGranted
          ? `Node ${nextVoter.id} granted its vote to Node ${candidateId}`
          : `Node ${nextVoter.id} rejected Node ${candidateId}'s vote request`,
        description: voteDecision.reason,
        explanation: voteDecision.voteGranted
          ? `Node ${nextVoter.id} had not voted for a different candidate in Term ${nextVoter.currentTerm}, and Node ${candidateId}'s log was at least as up-to-date.`
          : voteDecision.reason,
        raftRule:
          "A voter grants at most one vote per term and only to candidates with sufficiently up-to-date logs.",
        sourceNode: message.from,
        targetNode: nextVoter.id,
        term: nextVoter.currentTerm,
        paperSection: "Section 5.2 — Leader Election",
        stateChanges: voteDecision.stateChanges,
      }),
    ],
    messageStatusUpdates: [
      { messageId: message.id, status: "delivered", logicalTime: action.scheduledTime },
    ],
    outgoingMessages: [response],
    scheduledActions: [
      createDeliveryAction(
        context,
        DELIVER_REQUEST_VOTE_RESPONSE,
        action.scheduledTime + 50,
        response.id,
      ),
    ],
  };
};

export const handleRequestVoteResponseDelivery: ActionHandler = (
  state,
  action,
  context,
) => {
  const payload = readMessageDeliveryPayload(action.payload);
  const message = state.messages.find((candidate) => candidate.id === payload.messageId);

  if (
    !message ||
    message.type !== "request_vote_response" ||
    !isRequestVoteResponse(message.payload)
  ) {
    return { nextState: state, emittedEvents: [] };
  }

  const deliveryBlock = getMessageDeliveryBlock(state, message);
  if (deliveryBlock) {
    return {
      nextState: state,
      emittedEvents: [],
      messageStatusUpdates: [
        {
          messageId: message.id,
          status: "dropped",
          logicalTime: action.scheduledTime,
          reason: deliveryBlock.reason,
        },
      ],
    };
  }

  const candidate = state.nodes[message.to];
  const result = applyVoteResponse(state, candidate, message.payload, context, action.scheduledTime);

  return {
    ...result,
    messageStatusUpdates: [
      ...(result.messageStatusUpdates ?? []),
      { messageId: message.id, status: "delivered", logicalTime: action.scheduledTime },
    ],
  };
};

function applyVoteResponse(
  state: ClusterState,
  candidate: RaftNode,
  response: RequestVoteResponse,
  context: TransitionContext,
  logicalTime: number,
): TransitionResult {
  if (response.term < candidate.currentTerm) {
    return {
      nextState: state,
      emittedEvents: [
        createEvent(context, logicalTime, {
          type: "stale_vote_response",
          title: `Node ${candidate.id} ignored a stale vote response`,
          description: `Node ${response.voterId}'s response was for Term ${response.term}, but Node ${candidate.id} is already in Term ${candidate.currentTerm}.`,
          explanation:
            "Raft ignores responses from older terms because they cannot affect the current election.",
          raftRule: "Messages from older terms are stale.",
          sourceNode: response.voterId,
          targetNode: candidate.id,
          term: candidate.currentTerm,
          paperSection: "Section 5.2 — Leader Election",
        }),
      ],
    };
  }

  if (response.term > candidate.currentTerm) {
    const demoted: RaftNode = {
      ...candidate,
      role: "follower",
      currentTerm: response.term,
      votedFor: null,
      votesReceived: undefined,
    };

    return {
      nextState: {
        ...state,
        nodes: {
          ...state.nodes,
          [candidate.id]: demoted,
        },
      },
      emittedEvents: [
        createEvent(context, logicalTime, {
          type: "higher_term_seen",
          title: `Node ${candidate.id} stepped down for Term ${response.term}`,
          description: `Node ${candidate.id} saw a higher term in a vote response and returned to follower state.`,
          explanation:
            "Any server that sees a higher term recognizes that its local term is stale and becomes a follower.",
          raftRule: "Servers update their term and step down when they observe a higher term.",
          sourceNode: response.voterId,
          targetNode: candidate.id,
          term: response.term,
          paperSection: "Section 5.1 — Raft Basics",
          stateChanges: [
            change(candidate.id, "currentTerm", candidate.currentTerm, response.term),
            change(candidate.id, "role", candidate.role, "follower"),
            change(candidate.id, "votedFor", candidate.votedFor, null),
          ],
        }),
      ],
    };
  }

  if (candidate.role !== "candidate") {
    return {
      nextState: state,
      emittedEvents: [
        createEvent(context, logicalTime, {
          type: "late_vote_response",
          title: `Node ${candidate.id} received a late vote response`,
          description: `Node ${response.voterId}'s response arrived after Node ${candidate.id} was no longer a candidate.`,
          explanation:
            "Late responses can still be delivered, but they do not restart or repeat the election result.",
          raftRule: "Only candidates count granted votes for the current election.",
          sourceNode: response.voterId,
          targetNode: candidate.id,
          term: candidate.currentTerm,
          paperSection: "Section 5.2 — Leader Election",
        }),
      ],
    };
  }

  if (!response.voteGranted) {
    return {
      nextState: state,
      emittedEvents: [
        createEvent(context, logicalTime, {
          type: "vote_response_rejected",
          title: `Node ${candidate.id} received a rejected vote from Node ${response.voterId}`,
          description: `Node ${response.voterId} did not grant its vote to Node ${candidate.id}.`,
          explanation:
            "Rejected votes do not increase the candidate's vote count.",
          raftRule: "Only granted votes count toward the majority.",
          sourceNode: response.voterId,
          targetNode: candidate.id,
          term: candidate.currentTerm,
          paperSection: "Section 5.2 — Leader Election",
        }),
      ],
    };
  }

  const previousVotes = candidate.votesReceived ?? [];
  const nextVotes = addUniqueVote(previousVotes, response.voterId);
  const requiredVotes = majorityFor(Object.keys(state.nodes).length);
  const updatedCandidate: RaftNode = {
    ...candidate,
    votesReceived: nextVotes,
  };
  const voteEvent = createEvent(context, logicalTime, {
    type: "vote_received",
    title: `Node ${candidate.id} received a vote from Node ${response.voterId}`,
    description: `Votes: ${nextVotes.length} / ${requiredVotes} required.`,
    explanation:
      "The candidate records granted votes for the current term and checks whether it has a majority.",
    raftRule: "A candidate becomes leader after receiving votes from a majority of servers.",
    sourceNode: response.voterId,
    targetNode: candidate.id,
    term: candidate.currentTerm,
    paperSection: "Section 5.2 — Leader Election",
    stateChanges: [
      change(candidate.id, "votesReceived", previousVotes, nextVotes),
    ],
  });

  if (nextVotes.length < requiredVotes) {
    return {
      nextState: {
        ...state,
        nodes: {
          ...state.nodes,
          [candidate.id]: updatedCandidate,
        },
      },
      emittedEvents: [voteEvent],
    };
  }

  const peers = Object.keys(state.nodes);
  const leader: RaftNode = {
    ...updatedCandidate,
    role: "leader",
    nextIndex: Object.fromEntries(peers.map((peer) => [peer, candidate.log.length + 1])),
    matchIndex: Object.fromEntries(peers.map((peer) => [peer, 0])),
  };

  return {
    nextState: {
      ...state,
      nodes: {
        ...state.nodes,
        [candidate.id]: leader,
      },
    },
    emittedEvents: [
      voteEvent,
      createEvent(context, logicalTime, {
        type: "majority_reached",
        title: `Node ${candidate.id} received a majority of votes`,
        description: `Node ${candidate.id} has ${nextVotes.length} / ${peers.length} votes.`,
        explanation:
          "A majority means more than half the cluster agrees on the candidate for this term.",
        raftRule: "Majority voting prevents two leaders from being elected in the same term.",
        sourceNode: candidate.id,
        term: candidate.currentTerm,
        paperSection: "Section 5.2 — Leader Election",
      }),
      createEvent(context, logicalTime, {
        type: "leader_elected",
        title: `Node ${candidate.id} became the leader of Term ${candidate.currentTerm}`,
        description: `Node ${candidate.id} changed from candidate to leader after receiving a majority.`,
        explanation:
          "A candidate becomes leader after receiving votes from a majority of the cluster.",
        raftRule: "A candidate that receives votes from a majority becomes leader.",
        sourceNode: candidate.id,
        term: candidate.currentTerm,
        paperSection: "Section 5.2 — Leader Election",
        stateChanges: [change(candidate.id, "role", "candidate", "leader")],
      }),
    ],
  };
}

function decideVote(
  voter: RaftNode,
  request: {
    term: number;
    candidateId: NodeId;
    lastLogIndex: number;
    lastLogTerm: number;
  },
): {
  node: RaftNode;
  voteGranted: boolean;
  reason: string;
  stateChanges: StateChange[];
} {
  if (request.term < voter.currentTerm) {
    return {
      node: voter,
      voteGranted: false,
      reason: `Node ${voter.id} is already in Term ${voter.currentTerm}, which is newer than the request's Term ${request.term}.`,
      stateChanges: [],
    };
  }

  let nextVoter = voter;
  const stateChanges: StateChange[] = [];
  if (request.term > voter.currentTerm) {
    nextVoter = {
      ...voter,
      role: "follower",
      currentTerm: request.term,
      votedFor: null,
      votesReceived: undefined,
    };
    stateChanges.push(
      change(voter.id, "currentTerm", voter.currentTerm, request.term),
      change(voter.id, "role", voter.role, "follower"),
      change(voter.id, "votedFor", voter.votedFor, null),
    );
  }

  const canVote =
    nextVoter.votedFor === null || nextVoter.votedFor === request.candidateId;
  const logIsUpToDate = isCandidateLogUpToDate(
    request.lastLogIndex,
    request.lastLogTerm,
    nextVoter.log,
  );

  if (canVote && logIsUpToDate) {
    const beforeVote = nextVoter.votedFor;
    nextVoter = {
      ...nextVoter,
      votedFor: request.candidateId,
    };
    stateChanges.push(change(voter.id, "votedFor", beforeVote, request.candidateId));

    return {
      node: nextVoter,
      voteGranted: true,
      reason: `Node ${voter.id} had not voted for another candidate in Term ${request.term}, and the candidate log was up-to-date.`,
      stateChanges,
    };
  }

  return {
    node: nextVoter,
    voteGranted: false,
    reason: !canVote
      ? `Node ${voter.id} already voted for Node ${nextVoter.votedFor} in Term ${request.term}.`
      : `Node ${request.candidateId}'s log is not at least as up-to-date as Node ${voter.id}'s log.`,
    stateChanges,
  };
}

function createRequestVoteMessage(
  context: TransitionContext,
  candidate: RaftNode,
  targetNode: NodeId,
  logicalTime: number,
): RaftMessage {
  const lastLog = getLastLogPosition(candidate.log);

  return {
    id: context.createMessageId(),
    type: "request_vote",
    from: candidate.id,
    to: targetNode,
    term: candidate.currentTerm,
    status: "queued",
    createdAtLogicalTime: logicalTime,
    payload: {
      term: candidate.currentTerm,
      candidateId: candidate.id,
      lastLogIndex: lastLog.index,
      lastLogTerm: lastLog.term,
    },
  };
}

function createRequestVoteResponseMessage(
  context: TransitionContext,
  voter: RaftNode,
  candidateId: NodeId,
  voteGranted: boolean,
  logicalTime: number,
): RaftMessage {
  return {
    id: context.createMessageId(),
    type: "request_vote_response",
    from: voter.id,
    to: candidateId,
    term: voter.currentTerm,
    status: "queued",
    createdAtLogicalTime: logicalTime,
    payload: {
      term: voter.currentTerm,
      voteGranted,
      voterId: voter.id,
    },
  };
}

function createDeliveryAction(
  context: TransitionContext,
  type: typeof DELIVER_REQUEST_VOTE | typeof DELIVER_REQUEST_VOTE_RESPONSE,
  scheduledTime: number,
  messageId: string,
): ScheduledAction<MessageDeliveryPayload> {
  return {
    id: context.createActionId(),
    type,
    scheduledTime,
    sequence: 0,
    payload: { messageId },
  };
}

function createEvent(
  context: TransitionContext,
  logicalTime: number,
  event: Omit<SimulationEvent, "id" | "step" | "logicalTime">,
): SimulationEvent {
  return {
    id: context.createEventId(),
    step: 0,
    logicalTime,
    ...event,
  };
}

function change(
  nodeId: NodeId,
  field: string,
  before: unknown,
  after: unknown,
): StateChange {
  return { nodeId, field, before, after };
}

function addUniqueVote(votes: NodeId[], voterId: NodeId): NodeId[] {
  return votes.includes(voterId) ? votes : [...votes, voterId];
}

function getLastLogPosition(log: LogEntry[]): { index: number; term: number } {
  const lastEntry = log[log.length - 1];
  return lastEntry ? { index: lastEntry.index, term: lastEntry.term } : { index: 0, term: 0 };
}

function readElectionTimeoutPayload(payload: unknown): ElectionTimeoutPayload {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "nodeId" in payload &&
    typeof payload.nodeId === "string"
  ) {
    return { nodeId: payload.nodeId };
  }

  throw new Error("Invalid election timeout payload.");
}

function readMessageDeliveryPayload(payload: unknown): MessageDeliveryPayload {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "messageId" in payload &&
    typeof payload.messageId === "string"
  ) {
    return { messageId: payload.messageId };
  }

  throw new Error("Invalid message delivery payload.");
}

function isRequestVoteRPC(payload: unknown): payload is {
  term: number;
  candidateId: NodeId;
  lastLogIndex: number;
  lastLogTerm: number;
} {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "term" in payload &&
    typeof payload.term === "number" &&
    "candidateId" in payload &&
    typeof payload.candidateId === "string" &&
    "lastLogIndex" in payload &&
    typeof payload.lastLogIndex === "number" &&
    "lastLogTerm" in payload &&
    typeof payload.lastLogTerm === "number"
  );
}

function isRequestVoteResponse(payload: unknown): payload is RequestVoteResponse {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "term" in payload &&
    typeof payload.term === "number" &&
    "voteGranted" in payload &&
    typeof payload.voteGranted === "boolean" &&
    "voterId" in payload &&
    typeof payload.voterId === "string"
  );
}
