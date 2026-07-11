import type { RaftSimulator } from "../core/RaftSimulator";
import {
  isAppendEntriesMessage,
  isAppendEntriesResponseMessage,
} from "../messageTypes";
import {
  getLastLogIndex,
  getLogTermAtIndex,
  logMatchesAt,
  mergeLeaderEntries,
} from "../log/logUtils";
import { getMessageDeliveryBlock } from "../network/topology";
import type { ActionHandler, TransitionContext, TransitionResult } from "./types";
import type { AppendEntriesMessage } from "../messageTypes";
import type {
  AppendEntriesResponse,
  ClusterState,
  LogEntry,
  NodeId,
  RaftMessage,
  RaftNode,
  ScheduledAction,
  SimulationEvent,
  StateChange,
} from "../types";

export const SEND_HEARTBEAT_ROUND = "send_heartbeat_round";
export const DELIVER_APPEND_ENTRIES = "deliver_append_entries";
export const DELIVER_APPEND_ENTRIES_RESPONSE = "deliver_append_entries_response";
export const RETRY_APPEND_ENTRIES = "retry_append_entries";
const BROADCAST_COMMIT_INDEX = "broadcast_commit_index";

export { logMatchesAt };

interface HeartbeatRoundPayload {
  leaderId: NodeId;
  round: number;
  totalRounds: number;
}

interface MessageDeliveryPayload {
  messageId: string;
}

interface RetryAppendEntriesPayload {
  leaderId: NodeId;
  targetNodeId: NodeId;
  attempt: number;
}

export function registerHeartbeatHandlers(simulator: RaftSimulator): void {
  simulator.registerHandler(SEND_HEARTBEAT_ROUND, handleHeartbeatRound);
  simulator.registerHandler(DELIVER_APPEND_ENTRIES, handleAppendEntriesDelivery);
  simulator.registerHandler(
    DELIVER_APPEND_ENTRIES_RESPONSE,
    handleAppendEntriesResponseDelivery,
  );
  simulator.registerHandler(RETRY_APPEND_ENTRIES, handleRetryAppendEntries);
}

export const handleHeartbeatRound: ActionHandler = (state, action, context) => {
  const payload = readHeartbeatRoundPayload(action.payload);
  const leader = state.nodes[payload.leaderId];

  if (!leader || leader.role !== "leader" || leader.status !== "running") {
    return { nextState: state, emittedEvents: [] };
  }

  const peers = Object.keys(state.nodes).filter((nodeId) => nodeId !== leader.id);
  const heartbeatMessages = peers.map((peerId) =>
    createHeartbeatMessage(context, leader, peerId, action.scheduledTime),
  );
  const deliveryActions = heartbeatMessages.map((message, index) =>
    createDeliveryAction(
      context,
      DELIVER_APPEND_ENTRIES,
      action.scheduledTime + 60 * (index + 1),
      message.id,
    ),
  );
  const nextLeader: RaftNode = {
    ...leader,
    heartbeatRoundsSent: payload.round,
  };

  return {
    nextState: {
      ...state,
      nodes: {
        ...state.nodes,
        [leader.id]: nextLeader,
      },
    },
    emittedEvents: [
      createEvent(context, action.scheduledTime, {
        type: "heartbeat_round_sent",
        title: `Node ${leader.id} sent heartbeat round ${payload.round}`,
        description: `Node ${leader.id} sent empty AppendEntries RPCs to ${peers.map((peer) => `Node ${peer}`).join(", ")}.`,
        explanation:
          "A Raft heartbeat is an AppendEntries RPC whose entries list is empty.",
        raftRule:
          "Leaders send repeated AppendEntries RPCs, including empty ones used as heartbeats.",
        sourceNode: leader.id,
        term: leader.currentTerm,
        paperSection: "Section 5.2 — Leader Election",
        stateChanges: [
          change(leader.id, "heartbeatRoundsSent", leader.heartbeatRoundsSent ?? 0, payload.round),
        ],
      }),
    ],
    outgoingMessages: heartbeatMessages,
    scheduledActions: deliveryActions,
  };
};

export const handleAppendEntriesDelivery: ActionHandler = (state, action, context) => {
  const payload = readMessageDeliveryPayload(action.payload);
  const message = state.messages.find((candidate) => candidate.id === payload.messageId);

  if (!message || !isAppendEntriesMessage(message)) {
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

  const receiver = state.nodes[message.to];
  const appendEntriesMessage = message;
  const result = applyAppendEntries(state, receiver, appendEntriesMessage, context, action.scheduledTime);

  return {
    ...result,
    messageStatusUpdates: [
      ...(result.messageStatusUpdates ?? []),
      { messageId: message.id, status: "delivered", logicalTime: action.scheduledTime },
    ],
  };
};

export const handleAppendEntriesResponseDelivery: ActionHandler = (
  state,
  action,
  context,
) => {
  const payload = readMessageDeliveryPayload(action.payload);
  const message = state.messages.find((candidate) => candidate.id === payload.messageId);

  if (!message || !isAppendEntriesResponseMessage(message)) {
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

  const leader = state.nodes[message.to];
  const result = applyAppendEntriesResponse(
    state,
    leader,
    message.payload,
    context,
    action.scheduledTime,
  );

  return {
    ...result,
    messageStatusUpdates: [
      ...(result.messageStatusUpdates ?? []),
      { messageId: message.id, status: "delivered", logicalTime: action.scheduledTime },
    ],
  };
};

export const handleRetryAppendEntries: ActionHandler = (state, action, context) => {
  const payload = readRetryAppendEntriesPayload(action.payload);
  const leader = state.nodes[payload.leaderId];
  const target = state.nodes[payload.targetNodeId];

  if (
    !leader ||
    !target ||
    leader.role !== "leader" ||
    leader.status !== "running"
  ) {
    return { nextState: state, emittedEvents: [] };
  }

  const message = createRetryAppendEntriesMessage(
    context,
    leader,
    target.id,
    action.scheduledTime,
    payload.attempt,
  );

  return {
    nextState: state,
    emittedEvents: [
      createEvent(context, action.scheduledTime, {
        type: "append_entries_retry_sent",
        title: `Node ${leader.id} retried AppendEntries to Node ${target.id}`,
        description: `Attempt ${payload.attempt}: prevLogIndex ${message.payload.prevLogIndex}, prevLogTerm ${message.payload.prevLogTerm}, entries ${message.payload.entries.length}.`,
        explanation:
          "The leader uses the backed-up nextIndex to test an earlier previous log position.",
        raftRule: "AppendEntries retry continues until the follower and leader find a matching prefix.",
        sourceNode: leader.id,
        targetNode: target.id,
        term: leader.currentTerm,
        paperSection: "Section 5.3 — Log Replication",
      }),
    ],
    outgoingMessages: [message],
    scheduledActions: [
      createDeliveryAction(
        context,
        DELIVER_APPEND_ENTRIES,
        action.scheduledTime + 60,
        message.id,
      ),
    ],
  };
};

function applyAppendEntries(
  state: ClusterState,
  receiver: RaftNode,
  message: RaftMessage & {
    type: "append_entries";
    payload: {
      term: number;
      leaderId: NodeId;
      prevLogIndex: number;
      prevLogTerm: number;
      entries: unknown[];
      leaderCommit: number;
      purpose: "heartbeat" | "log_replication" | "commit_update" | "log_reconciliation";
      attempt?: number;
    };
  },
  context: TransitionContext,
  logicalTime: number,
): TransitionResult {
  const request = message.payload;
  const stateChanges: StateChange[] = [];

  if (request.term < receiver.currentTerm) {
    const response = createAppendEntriesResponseMessage(
      context,
      receiver,
      request.leaderId,
      false,
      receiver.log.length,
      logicalTime,
      {
        rejectedNextIndex: request.prevLogIndex + 1,
        conflictIndex: request.prevLogIndex,
        conflictTerm: getLogTermAtIndex(receiver.log, request.prevLogIndex),
        attempt: request.attempt,
      },
    );

    return {
      nextState: state,
      emittedEvents: [
        createEvent(context, logicalTime, {
          type: "append_entries_rejected",
          title: `Node ${receiver.id} rejected AppendEntries from Node ${request.leaderId}`,
          description: `Node ${receiver.id} is in Term ${receiver.currentTerm}, newer than the request's Term ${request.term}.`,
          explanation:
            "Followers reject AppendEntries requests from older terms because those leaders are stale.",
          raftRule: "AppendEntries with a lower term is rejected.",
          sourceNode: request.leaderId,
          targetNode: receiver.id,
          term: receiver.currentTerm,
          paperSection: "Section 5.3 — Log Replication",
        }),
      ],
      outgoingMessages: [response],
      scheduledActions: [
        createDeliveryAction(
          context,
          DELIVER_APPEND_ENTRIES_RESPONSE,
          logicalTime + 40,
          response.id,
        ),
      ],
    };
  }

  let nextReceiver = receiver;
  if (request.term > receiver.currentTerm || receiver.role !== "follower") {
    nextReceiver = {
      ...nextReceiver,
      role: "follower",
      currentTerm: request.term,
      votedFor: request.term > receiver.currentTerm ? null : nextReceiver.votedFor,
      votesReceived: undefined,
      heartbeatRoundsSent: undefined,
      nextIndex: undefined,
      matchIndex: undefined,
    };
    stateChanges.push(
      change(receiver.id, "currentTerm", receiver.currentTerm, request.term),
      change(receiver.id, "role", receiver.role, "follower"),
    );
  }

  const logMatches = logMatchesAt(
    nextReceiver.log,
    request.prevLogIndex,
    request.prevLogTerm,
  );

  if (!logMatches) {
    const response = createAppendEntriesResponseMessage(
      context,
      nextReceiver,
      request.leaderId,
      false,
      nextReceiver.log.length,
      logicalTime,
      {
        rejectedNextIndex: request.prevLogIndex + 1,
        conflictIndex: request.prevLogIndex,
        conflictTerm: getLogTermAtIndex(nextReceiver.log, request.prevLogIndex),
        attempt: request.attempt,
      },
    );

    return {
      nextState: {
        ...state,
        nodes: {
          ...state.nodes,
          [nextReceiver.id]: nextReceiver,
        },
      },
      emittedEvents: [
        createEvent(context, logicalTime, {
          type: "append_entries_rejected",
          title: `Node ${nextReceiver.id} rejected Node ${request.leaderId}'s AppendEntries`,
          description:
            "The request's prevLogIndex or prevLogTerm did not match the follower log.",
          explanation:
            "AppendEntries requests check the previous log position before accepting new entries or commit updates.",
          raftRule: "AppendEntries succeeds only when the previous log position matches.",
          sourceNode: request.leaderId,
          targetNode: nextReceiver.id,
          term: nextReceiver.currentTerm,
          paperSection: "Section 5.3 — Log Replication",
          stateChanges,
        }),
      ],
      outgoingMessages: [response],
      scheduledActions: [
        createDeliveryAction(
          context,
          DELIVER_APPEND_ENTRIES_RESPONSE,
          logicalTime + 40,
          response.id,
        ),
      ],
    };
  }

  const beforeElapsed = nextReceiver.electionElapsed;
  const beforeLog = nextReceiver.log;
  const beforeCommitIndex = nextReceiver.commitIndex;
  const beforeLastApplied = nextReceiver.lastApplied;
  const mergeResult =
    request.purpose === "log_replication" || request.purpose === "log_reconciliation"
      ? mergeLeaderEntries(nextReceiver.log, request.entries as LogEntry[], nextReceiver.commitIndex)
      : { log: nextReceiver.log, rejected: false };
  if (mergeResult.rejected) {
    const response = createAppendEntriesResponseMessage(
      context,
      nextReceiver,
      request.leaderId,
      false,
      getLastLogIndex(nextReceiver.log),
      logicalTime,
      {
        rejectedNextIndex: request.prevLogIndex + 1,
        conflictIndex: mergeResult.conflictIndex,
        attempt: request.attempt,
      },
    );

    return {
      nextState: state,
      emittedEvents: [
        createEvent(context, logicalTime, {
          type: "committed_log_conflict_rejected",
          title: "Committed log conflict detected - reconciliation rejected",
          description: mergeResult.reason ?? "AppendEntries would overwrite a committed entry.",
          explanation:
            "The simulator protects committed entries from being truncated during log repair.",
          raftRule: "Committed entries are never intentionally removed.",
          sourceNode: request.leaderId,
          targetNode: nextReceiver.id,
          term: nextReceiver.currentTerm,
          paperSection: "Section 5.3 — Log Replication",
        }),
      ],
      outgoingMessages: [response],
      scheduledActions: [
        createDeliveryAction(
          context,
          DELIVER_APPEND_ENTRIES_RESPONSE,
          logicalTime + 40,
          response.id,
        ),
      ],
    };
  }

  const logAfterEntries = mergeResult.log;
  const commitIndex = Math.min(request.leaderCommit, getLastLogIndex(logAfterEntries));
  const committedLog =
    commitIndex > nextReceiver.commitIndex
      ? markCommittedAndApplied(logAfterEntries, commitIndex)
      : logAfterEntries;
  nextReceiver = {
    ...nextReceiver,
    log: committedLog,
    commitIndex: Math.max(nextReceiver.commitIndex, commitIndex),
    lastApplied: Math.max(nextReceiver.lastApplied, commitIndex),
    electionElapsed: 0,
    lastHeartbeatReceivedAt: logicalTime,
  };
  stateChanges.push(
    change(nextReceiver.id, "electionElapsed", beforeElapsed, 0),
    change(nextReceiver.id, "lastHeartbeatReceivedAt", receiver.lastHeartbeatReceivedAt, logicalTime),
  );
  if (request.purpose === "log_replication" || request.purpose === "log_reconciliation") {
    stateChanges.push(change(nextReceiver.id, "log", beforeLog, nextReceiver.log));
  }
  if (nextReceiver.commitIndex !== beforeCommitIndex) {
    stateChanges.push(
      change(nextReceiver.id, "commitIndex", beforeCommitIndex, nextReceiver.commitIndex),
      change(nextReceiver.id, "lastApplied", beforeLastApplied, nextReceiver.lastApplied),
    );
  }
  const response = createAppendEntriesResponseMessage(
    context,
    nextReceiver,
    request.leaderId,
    true,
    request.entries.length > 0 ? getLastLogIndex(nextReceiver.log) : request.prevLogIndex,
    logicalTime,
    { attempt: request.attempt },
  );

  return {
    nextState: {
      ...state,
      nodes: {
        ...state.nodes,
        [nextReceiver.id]: nextReceiver,
      },
    },
    emittedEvents: [
      createEvent(context, logicalTime, {
        type: "append_entries_delivered",
        title: `Node ${nextReceiver.id} received ${getAppendEntriesDisplayName(request.purpose)} from Node ${request.leaderId}`,
        description: `Term ${request.term}, prevLogIndex ${request.prevLogIndex}, prevLogTerm ${request.prevLogTerm}, entries ${request.entries.length}.`,
        explanation:
          "Heartbeat, log replication, and commit updates are all represented by AppendEntries RPCs.",
        raftRule: "AppendEntries carries heartbeats, log entries, and the leader's commit index.",
        sourceNode: request.leaderId,
        targetNode: nextReceiver.id,
        term: request.term,
        paperSection: "Section 5.2 — Leader Election",
      }),
      createEvent(context, logicalTime, {
        type: "append_entries_accepted",
        title: `Node ${nextReceiver.id} accepted Node ${request.leaderId}'s AppendEntries`,
        description:
          "The request came from the current leader and matched the follower's previous log position.",
        explanation:
          "A valid AppendEntries confirms the leader's authority and may carry log entries or commit information.",
        raftRule: "Followers accept AppendEntries when the term and previous log position match.",
        sourceNode: request.leaderId,
        targetNode: nextReceiver.id,
        term: request.term,
        paperSection: "Section 5.3 — Log Replication",
      }),
      ...(mergeResult.conflictIndex !== undefined
        ? [
            createEvent(context, logicalTime, {
              type: "conflict_truncation",
              title: `Node ${nextReceiver.id} replaced conflicting log suffix`,
              description: `Conflict began at index ${mergeResult.conflictIndex}; entries before it were preserved.`,
              explanation:
                "After the previous log position matches, the follower deletes the first conflicting entry and everything after it, then appends the leader's suffix.",
              raftRule:
                "If an existing entry conflicts with a new one, delete the existing entry and all that follow it.",
              sourceNode: request.leaderId,
              targetNode: nextReceiver.id,
              term: request.term,
              paperSection: "Section 5.3 — Log Replication",
              stateChanges: [change(nextReceiver.id, "log", beforeLog, nextReceiver.log)],
            }),
          ]
        : []),
      createEvent(context, logicalTime, {
        type: "election_timer_reset",
        title: `Node ${nextReceiver.id} reset its election timer`,
        description:
          "Receiving a valid heartbeat prevents the follower from starting a new election.",
        explanation:
          "The follower now waits again for the next leader contact instead of timing out.",
        raftRule: "Valid AppendEntries from the leader resets the follower's election timeout.",
        sourceNode: request.leaderId,
        targetNode: nextReceiver.id,
        term: request.term,
        paperSection: "Section 5.2 — Leader Election",
        stateChanges,
      }),
      createEvent(context, logicalTime, {
        type: "append_entries_response_created",
        title: `Node ${nextReceiver.id} acknowledged AppendEntries`,
        description: `success: true, matchIndex: ${request.entries.length > 0 ? getLastLogIndex(nextReceiver.log) : request.prevLogIndex}.`,
        explanation:
          "The follower replies so the leader can learn that the heartbeat was accepted.",
        raftRule: "AppendEntries receives a success response when the follower accepts it.",
        sourceNode: nextReceiver.id,
        targetNode: request.leaderId,
        term: request.term,
        paperSection: "Section 5.3 — Log Replication",
      }),
    ],
    outgoingMessages: [response],
    scheduledActions: [
      createDeliveryAction(
        context,
        DELIVER_APPEND_ENTRIES_RESPONSE,
        logicalTime + 40,
        response.id,
      ),
    ],
  };
}

function applyAppendEntriesResponse(
  state: ClusterState,
  leader: RaftNode,
  response: AppendEntriesResponse,
  context: TransitionContext,
  logicalTime: number,
): TransitionResult {
  if (response.term < leader.currentTerm) {
    return {
      nextState: state,
      emittedEvents: [
        createEvent(context, logicalTime, {
          type: "stale_heartbeat_response",
          title: `Node ${leader.id} ignored a stale heartbeat response`,
          description: `Node ${response.followerId}'s response was for Term ${response.term}.`,
          explanation:
            "Responses from older terms cannot affect the current leader state.",
          raftRule: "Older-term responses are stale.",
          sourceNode: response.followerId,
          targetNode: leader.id,
          term: leader.currentTerm,
          paperSection: "Section 5.1 — Raft Basics",
        }),
      ],
    };
  }

  if (response.term > leader.currentTerm) {
    const steppedDown: RaftNode = {
      ...leader,
      role: "follower",
      currentTerm: response.term,
      votedFor: null,
      votesReceived: undefined,
      heartbeatRoundsSent: undefined,
      nextIndex: undefined,
      matchIndex: undefined,
    };

    return {
      nextState: {
        ...state,
        nodes: {
          ...state.nodes,
          [leader.id]: steppedDown,
        },
      },
      emittedEvents: [
        createEvent(context, logicalTime, {
          type: "higher_term_heartbeat_response",
          title: `Node ${leader.id} stepped down after a heartbeat response`,
          description: `The response carried Term ${response.term}, higher than Node ${leader.id}'s Term ${leader.currentTerm}.`,
          explanation:
            "A leader that sees a higher term must stop acting as leader and become a follower.",
          raftRule: "Servers step down when they observe a higher term.",
          sourceNode: response.followerId,
          targetNode: leader.id,
          term: response.term,
          paperSection: "Section 5.1 — Raft Basics",
          stateChanges: [
            change(leader.id, "currentTerm", leader.currentTerm, response.term),
            change(leader.id, "role", leader.role, "follower"),
          ],
        }),
      ],
    };
  }

  if (leader.role !== "leader") {
    return {
      nextState: state,
      emittedEvents: [
        createEvent(context, logicalTime, {
          type: "late_heartbeat_response",
          title: `Node ${leader.id} received a heartbeat response after stepping down`,
          description:
            "The response was delivered, but the receiver is no longer the leader.",
          explanation:
            "Only the current leader uses successful AppendEntries responses.",
          raftRule: "Heartbeat responses do not change follower state.",
          sourceNode: response.followerId,
          targetNode: leader.id,
          term: leader.currentTerm,
        }),
      ],
    };
  }

  if (!response.success) {
    const previousNextIndex = leader.nextIndex?.[response.followerId] ?? 1;
    if (
      response.rejectedNextIndex !== undefined &&
      previousNextIndex !== response.rejectedNextIndex
    ) {
      return {
        nextState: state,
        emittedEvents: [
          createEvent(context, logicalTime, {
            type: "stale_append_entries_failure_ignored",
            title: `Node ${leader.id} ignored a stale rejected AppendEntries response`,
            description: `The response was for nextIndex ${response.rejectedNextIndex}, but Node ${leader.id} now has nextIndex ${previousNextIndex} for Node ${response.followerId}.`,
            explanation:
              "Old failure responses must not backtrack nextIndex a second time after a newer attempt has already changed it.",
            raftRule: "Leaders ignore stale responses that no longer match their replication progress.",
            sourceNode: response.followerId,
            targetNode: leader.id,
            term: leader.currentTerm,
            paperSection: "Section 5.3 — Log Replication",
          }),
        ],
      };
    }

    if (previousNextIndex <= 1) {
      return {
        nextState: state,
        emittedEvents: [
          createEvent(context, logicalTime, {
            type: "append_entries_backtracking_stopped",
            title: `Node ${leader.id} stopped AppendEntries backtracking for Node ${response.followerId}`,
            description: "nextIndex is already 1, so the simulator will not schedule another retry.",
            explanation:
              "The teaching simulator prevents infinite retry loops when a follower still rejects at the beginning of the log.",
            raftRule: "nextIndex cannot go below 1.",
            sourceNode: response.followerId,
            targetNode: leader.id,
            term: leader.currentTerm,
            paperSection: "Section 5.3 — Log Replication",
          }),
        ],
      };
    }

    const nextNextIndex = Math.max(1, previousNextIndex - 1);
    const updatedLeader: RaftNode = {
      ...leader,
      nextIndex: {
        ...(leader.nextIndex ?? {}),
        [response.followerId]: nextNextIndex,
      },
    };

    return {
      nextState: {
        ...state,
        nodes: {
          ...state.nodes,
          [leader.id]: updatedLeader,
        },
      },
      emittedEvents: [
        createEvent(context, logicalTime, {
          type: "append_entries_backtracked",
          title: `Node ${leader.id} backed up nextIndex for Node ${response.followerId}`,
          description: `success: false, nextIndex ${previousNextIndex} -> ${nextNextIndex}.`,
          explanation:
            "A rejection means the leader has not yet found the last log position it shares with this follower, so it backs up and retries.",
          raftRule: "Leaders decrement nextIndex after failed AppendEntries and retry.",
          sourceNode: response.followerId,
          targetNode: leader.id,
          term: leader.currentTerm,
          paperSection: "Section 5.3 — Log Replication",
          stateChanges: [
            change(leader.id, `nextIndex.${response.followerId}`, previousNextIndex, nextNextIndex),
          ],
        }),
      ],
      scheduledActions: [
        {
          id: context.createActionId(),
          type: RETRY_APPEND_ENTRIES,
          scheduledTime: logicalTime + 80,
          sequence: 0,
          payload: {
            leaderId: leader.id,
            targetNodeId: response.followerId,
            attempt: (response.attempt ?? 1) + 1,
          },
        },
      ],
    };
  }

  const previousMatchIndex = leader.matchIndex?.[response.followerId] ?? 0;
  const previousNextIndex = leader.nextIndex?.[response.followerId] ?? 1;
  const nextMatchIndex = Math.max(previousMatchIndex, response.matchIndex);
  const nextNextIndex = Math.max(previousNextIndex, response.matchIndex + 1);
  const updatedLeader: RaftNode = {
    ...leader,
    matchIndex: {
      ...(leader.matchIndex ?? {}),
      [response.followerId]: nextMatchIndex,
    },
    nextIndex: {
      ...(leader.nextIndex ?? {}),
      [response.followerId]: nextNextIndex,
    },
  };
  const committedLeader = maybeCommitLeader(updatedLeader, Object.keys(state.nodes).length);
  const commitAdvanced = committedLeader.commitIndex > leader.commitIndex;
  const nextState = {
    ...state,
    nodes: {
      ...state.nodes,
      [leader.id]: committedLeader,
    },
  };

  return {
    nextState,
    emittedEvents: [
      createEvent(context, logicalTime, {
        type: "append_entries_response_received",
        title: `Node ${leader.id} received a successful AppendEntries response from Node ${response.followerId}`,
        description: `success: true, matchIndex: ${response.matchIndex}.`,
        explanation:
          "The leader uses successful responses to update matchIndex and nextIndex for each follower.",
        raftRule: "Successful AppendEntries responses advance the leader's replication progress for that follower.",
        sourceNode: response.followerId,
        targetNode: leader.id,
        term: leader.currentTerm,
        paperSection: "Section 5.3 — Log Replication",
        stateChanges: [
          change(leader.id, `matchIndex.${response.followerId}`, previousMatchIndex, nextMatchIndex),
          change(leader.id, `nextIndex.${response.followerId}`, previousNextIndex, nextNextIndex),
        ],
      }),
      ...(commitAdvanced
        ? [
            createEvent(context, logicalTime, {
              type: "entry_committed",
              title: `Node ${leader.id} committed log entry ${committedLeader.commitIndex}`,
              description:
                "The entry is stored on a majority of servers, including the leader itself.",
              explanation:
                "Replicated means copies exist. Committed means the leader has confirmed a majority for a current-term entry.",
              raftRule: "A leader commits a current-term entry once it is replicated on a majority of servers.",
              sourceNode: leader.id,
              term: leader.currentTerm,
              paperSection: "Section 5.3 — Log Replication",
              stateChanges: [
                change(leader.id, "commitIndex", leader.commitIndex, committedLeader.commitIndex),
                change(leader.id, "lastApplied", leader.lastApplied, committedLeader.lastApplied),
              ],
            }),
          ]
        : []),
    ],
    scheduledActions: commitAdvanced
      ? [
          {
            id: context.createActionId(),
            type: BROADCAST_COMMIT_INDEX,
            scheduledTime: logicalTime + 100,
            sequence: 0,
            payload: { leaderId: leader.id },
          },
        ]
      : undefined,
  };
}

function createHeartbeatMessage(
  context: TransitionContext,
  leader: RaftNode,
  targetNode: NodeId,
  logicalTime: number,
): RaftMessage {
  return {
    id: context.createMessageId(),
    type: "append_entries",
    from: leader.id,
    to: targetNode,
    term: leader.currentTerm,
    status: "queued",
    createdAtLogicalTime: logicalTime,
    payload: {
      term: leader.currentTerm,
      leaderId: leader.id,
      prevLogIndex: 0,
      prevLogTerm: 0,
      entries: [],
      leaderCommit: leader.commitIndex,
      purpose: "heartbeat",
    },
  };
}

function createRetryAppendEntriesMessage(
  context: TransitionContext,
  leader: RaftNode,
  targetNode: NodeId,
  logicalTime: number,
  attempt: number,
): AppendEntriesMessage {
  const nextIndex = leader.nextIndex?.[targetNode] ?? getLastLogIndex(leader.log) + 1;
  const prevLogIndex = Math.max(0, nextIndex - 1);

  return {
    id: context.createMessageId(),
    type: "append_entries",
    from: leader.id,
    to: targetNode,
    term: leader.currentTerm,
    status: "queued",
    createdAtLogicalTime: logicalTime,
    payload: {
      term: leader.currentTerm,
      leaderId: leader.id,
      prevLogIndex,
      prevLogTerm: getLogTermAtIndex(leader.log, prevLogIndex),
      entries: leader.log
        .filter((entry) => entry.index >= nextIndex)
        .map((entry) => structuredClone(entry)),
      leaderCommit: leader.commitIndex,
      purpose: "log_reconciliation",
      attempt,
    },
  };
}

function markCommittedAndApplied(log: LogEntry[], commitIndex: number): LogEntry[] {
  return log.map((entry) =>
    entry.index <= commitIndex
      ? { ...entry, committed: true, applied: true }
      : entry,
  );
}

function maybeCommitLeader(leader: RaftNode, clusterSize: number): RaftNode {
  const majority = Math.floor(clusterSize / 2) + 1;
  let nextCommitIndex = leader.commitIndex;

  for (const entry of leader.log) {
    if (entry.index <= leader.commitIndex || entry.term !== leader.currentTerm) {
      continue;
    }

    const replicatedCount = Object.values(leader.matchIndex ?? {}).filter(
      (matchIndex) => matchIndex >= entry.index,
    ).length;

    if (replicatedCount >= majority) {
      nextCommitIndex = Math.max(nextCommitIndex, entry.index);
    }
  }

  if (nextCommitIndex === leader.commitIndex) {
    return leader;
  }

  return {
    ...leader,
    commitIndex: nextCommitIndex,
    lastApplied: Math.max(leader.lastApplied, nextCommitIndex),
    log: markCommittedAndApplied(leader.log, nextCommitIndex),
  };
}

function getAppendEntriesDisplayName(
  purpose: "heartbeat" | "log_replication" | "commit_update" | "log_reconciliation",
): string {
  if (purpose === "heartbeat") {
    return "a heartbeat";
  }

  if (purpose === "commit_update") {
    return "a commit update";
  }

  if (purpose === "log_reconciliation") {
    return "a log reconciliation retry";
  }

  return "log replication entries";
}

function createAppendEntriesResponseMessage(
  context: TransitionContext,
  follower: RaftNode,
  leaderId: NodeId,
  success: boolean,
  matchIndex: number,
  logicalTime: number,
  options: {
    rejectedNextIndex?: number;
    conflictIndex?: number;
    conflictTerm?: number;
    attempt?: number;
  } = {},
): RaftMessage {
  const payload: AppendEntriesResponse = {
    term: follower.currentTerm,
    success,
    followerId: follower.id,
    matchIndex,
  };
  if (options.rejectedNextIndex !== undefined) {
    payload.rejectedNextIndex = options.rejectedNextIndex;
  }
  if (options.conflictIndex !== undefined) {
    payload.conflictIndex = options.conflictIndex;
  }
  if (options.conflictTerm !== undefined) {
    payload.conflictTerm = options.conflictTerm;
  }
  if (options.attempt !== undefined) {
    payload.attempt = options.attempt;
  }

  return {
    id: context.createMessageId(),
    type: "append_entries_response",
    from: follower.id,
    to: leaderId,
    term: follower.currentTerm,
    status: "queued",
    createdAtLogicalTime: logicalTime,
    payload,
  };
}

function createDeliveryAction(
  context: TransitionContext,
  type: typeof DELIVER_APPEND_ENTRIES | typeof DELIVER_APPEND_ENTRIES_RESPONSE,
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

function readHeartbeatRoundPayload(payload: unknown): HeartbeatRoundPayload {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "leaderId" in payload &&
    typeof payload.leaderId === "string" &&
    "round" in payload &&
    typeof payload.round === "number" &&
    "totalRounds" in payload &&
    typeof payload.totalRounds === "number"
  ) {
    return {
      leaderId: payload.leaderId,
      round: payload.round,
      totalRounds: payload.totalRounds,
    };
  }

  throw new Error("Invalid heartbeat round payload.");
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

function readRetryAppendEntriesPayload(payload: unknown): RetryAppendEntriesPayload {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "leaderId" in payload &&
    typeof payload.leaderId === "string" &&
    "targetNodeId" in payload &&
    typeof payload.targetNodeId === "string" &&
    "attempt" in payload &&
    typeof payload.attempt === "number"
  ) {
    return {
      leaderId: payload.leaderId,
      targetNodeId: payload.targetNodeId,
      attempt: payload.attempt,
    };
  }

  throw new Error("Invalid retry AppendEntries payload.");
}
