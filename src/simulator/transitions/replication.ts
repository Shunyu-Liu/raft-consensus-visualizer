import type { RaftSimulator } from "../core/RaftSimulator";
import { DELIVER_APPEND_ENTRIES } from "./heartbeat";
import { getLastLogIndex, getLogTermAtIndex } from "../log/logUtils";
import type { ActionHandler, TransitionContext } from "./types";
import type {
  ClusterState,
  LogEntry,
  NodeId,
  RaftMessage,
  RaftNode,
  SimulationEvent,
  StateChange,
} from "../types";

export const CLIENT_COMMAND_RECEIVED = "client_command_received";
export const SEND_LOG_REPLICATION = "send_log_replication";
export const BROADCAST_COMMIT_INDEX = "broadcast_commit_index";
export const EVALUATE_REPLICATION_PROGRESS = "evaluate_replication_progress";

export interface ClientCommandSubmissionResult {
  accepted: boolean;
  reason?: string;
  actionId?: string;
}

interface ClientCommandPayload {
  command: string;
}

interface LeaderPayload {
  leaderId: NodeId;
}

interface ReplicationProgressPayload {
  leaderId: NodeId;
  entryIndex: number;
}

export function registerReplicationHandlers(simulator: RaftSimulator): void {
  simulator.registerHandler(CLIENT_COMMAND_RECEIVED, handleClientCommandReceived);
  simulator.registerHandler(SEND_LOG_REPLICATION, handleSendLogReplication);
  simulator.registerHandler(BROADCAST_COMMIT_INDEX, handleBroadcastCommitIndex);
  simulator.registerHandler(EVALUATE_REPLICATION_PROGRESS, handleEvaluateReplicationProgress);
}

export function submitClientCommand(
  simulator: RaftSimulator,
  command: string,
): ClientCommandSubmissionResult {
  const trimmedCommand = command.trim();
  if (trimmedCommand.length === 0) {
    return { accepted: false, reason: "Command cannot be empty." };
  }

  if (trimmedCommand.length > 100) {
    return { accepted: false, reason: "Command must be 100 characters or fewer." };
  }

  const state = simulator.getState();
  const leaders = Object.values(state.nodes).filter(
    (node) => node.role === "leader" && node.status === "running",
  );

  if (leaders.length === 0) {
    return { accepted: false, reason: "No leader is currently available." };
  }

  if (leaders.length > 1) {
    return { accepted: false, reason: "The simulator found more than one leader." };
  }

  const existingClientAction = simulator
    .getPendingActions()
    .some((action) =>
      [CLIENT_COMMAND_RECEIVED, SEND_LOG_REPLICATION, BROADCAST_COMMIT_INDEX].includes(action.type),
    );
  if (existingClientAction) {
    return { accepted: false, reason: "A client command is already in progress." };
  }

  const action = simulator.createAction(CLIENT_COMMAND_RECEIVED, state.logicalTime + 100, {
    command: trimmedCommand,
  });
  simulator.schedule(action);

  return { accepted: true, actionId: action.id };
}

export const handleClientCommandReceived: ActionHandler = (state, action, context) => {
  const payload = readClientCommandPayload(action.payload);
  const leader = findRunningLeader(state);

  if (!leader) {
    return {
      nextState: state,
      emittedEvents: [
        createEvent(context, action.scheduledTime, {
          type: "client_command_rejected",
          title: "Client command was rejected",
          description: "No running leader was available to receive the command.",
          explanation:
            "In Raft, clients send commands to the leader. Followers cannot order new commands.",
          raftRule: "Only the leader accepts client commands for the replicated log.",
          paperSection: "Section 5.3 — Log Replication",
        }),
      ],
    };
  }

  const entry: LogEntry = {
    index: getLastLogIndex(leader.log) + 1,
    term: leader.currentTerm,
    command: payload.command,
    committed: false,
    applied: false,
  };
  const nextLeader: RaftNode = {
    ...leader,
    log: [...leader.log, entry],
    matchIndex: {
      ...(leader.matchIndex ?? {}),
      [leader.id]: entry.index,
    },
    nextIndex: {
      ...(leader.nextIndex ?? {}),
      [leader.id]: entry.index + 1,
    },
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
        type: "client_command_received",
        title: `Client sent a command to Node ${leader.id}`,
        description: `The client submitted "${payload.command}" to the current leader.`,
        explanation:
          "Clients normally send commands to the leader. The leader first appends the command to its own log.",
        raftRule: "The leader is responsible for ordering client commands in the replicated log.",
        sourceNode: leader.id,
        term: leader.currentTerm,
        paperSection: "Section 5.3 — Log Replication",
      }),
      createEvent(context, action.scheduledTime, {
        type: "leader_appended_log",
        title: `Node ${leader.id} appended log entry ${entry.index}`,
        description: `Index ${entry.index}, Term ${entry.term}, Command "${entry.command}", Uncommitted.`,
        explanation:
          "The leader stores the command locally before sending it to followers.",
        raftRule: "A leader appends a client command to its own log before replication.",
        sourceNode: leader.id,
        term: leader.currentTerm,
        paperSection: "Section 5.3 — Log Replication",
        stateChanges: [change(leader.id, "log", leader.log, nextLeader.log)],
      }),
    ],
    scheduledActions: [
      {
        id: context.createActionId(),
        type: SEND_LOG_REPLICATION,
        scheduledTime: action.scheduledTime + 100,
        sequence: 0,
        payload: { leaderId: leader.id },
      },
    ],
  };
};

export const handleSendLogReplication: ActionHandler = (state, action, context) => {
  const payload = readLeaderPayload(action.payload);
  const leader = state.nodes[payload.leaderId];
  if (!leader || leader.role !== "leader" || leader.status !== "running") {
    return { nextState: state, emittedEvents: [] };
  }

  const peers = Object.keys(state.nodes).filter((nodeId) => nodeId !== leader.id);
  const messages = peers.map((peerId) =>
    createLogReplicationMessage(context, leader, peerId, action.scheduledTime),
  );

  return {
    nextState: state,
    emittedEvents: [
      createEvent(context, action.scheduledTime, {
        type: "log_replication_sent",
        title: `Node ${leader.id} sent AppendEntries with log entries`,
        description: `Node ${leader.id} sent non-empty AppendEntries RPCs to ${peers.map((peer) => `Node ${peer}`).join(", ")}.`,
        explanation:
          "Followers store the entry first. The entry becomes committed only after the leader confirms a majority.",
        raftRule: "The leader replicates log entries using AppendEntries RPCs.",
        sourceNode: leader.id,
        term: leader.currentTerm,
        paperSection: "Section 5.3 — Log Replication",
      }),
    ],
    outgoingMessages: messages,
    scheduledActions: messages.map((message, index) => ({
      id: context.createActionId(),
      type: DELIVER_APPEND_ENTRIES,
      scheduledTime: action.scheduledTime + 100 * (index + 1),
      sequence: 0,
      payload: { messageId: message.id },
    })),
  };
};

export const handleBroadcastCommitIndex: ActionHandler = (state, action, context) => {
  const payload = readLeaderPayload(action.payload);
  const leader = state.nodes[payload.leaderId];
  if (!leader || leader.role !== "leader" || leader.status !== "running") {
    return { nextState: state, emittedEvents: [] };
  }

  const peers = Object.keys(state.nodes).filter((nodeId) => nodeId !== leader.id);
  const messages = peers.map((peerId) =>
    createCommitUpdateMessage(context, leader, peerId, action.scheduledTime),
  );

  return {
    nextState: state,
    emittedEvents: [
      createEvent(context, action.scheduledTime, {
        type: "commit_update_sent",
        title: `Node ${leader.id} broadcast commit index ${leader.commitIndex}`,
        description:
          "The leader sent empty AppendEntries RPCs carrying the new leaderCommit value.",
        explanation:
          "Followers learn that an entry is committed from the leaderCommit field in later AppendEntries messages.",
        raftRule: "AppendEntries carries the leader's commit index to followers.",
        sourceNode: leader.id,
        term: leader.currentTerm,
        paperSection: "Section 5.3 — Log Replication",
      }),
    ],
    outgoingMessages: messages,
    scheduledActions: messages.map((message, index) => ({
      id: context.createActionId(),
      type: DELIVER_APPEND_ENTRIES,
      scheduledTime: action.scheduledTime + 80 * (index + 1),
      sequence: 0,
      payload: { messageId: message.id },
    })),
  };
};

export const handleEvaluateReplicationProgress: ActionHandler = (
  state,
  action,
  context,
) => {
  const payload = readReplicationProgressPayload(action.payload);
  const leader = state.nodes[payload.leaderId];
  if (!leader || leader.status !== "running") {
    return { nextState: state, emittedEvents: [] };
  }

  const entry = leader.log.find((candidate) => candidate.index === payload.entryIndex);
  if (!entry) {
    return { nextState: state, emittedEvents: [] };
  }

  const replicaCount = Object.values(state.nodes).filter((node) =>
    node.log.some(
      (candidate) =>
        candidate.index === entry.index &&
        candidate.term === entry.term &&
        candidate.command === entry.command,
    ),
  ).length;
  const required = Math.floor(Object.keys(state.nodes).length / 2) + 1;
  const committed = leader.commitIndex >= entry.index;

  return {
    nextState: state,
    emittedEvents: [
      createEvent(context, action.scheduledTime, {
        type: committed
          ? "replication_reached_majority"
          : "minority_commit_blocked",
        title: committed
          ? `Replication reached a majority for entry ${entry.index}`
          : `Minority could not commit Entry ${entry.index}`,
        description: `${replicaCount} / ${Object.keys(state.nodes).length} replicas have Entry ${entry.index}; ${required} are required for a majority.`,
        explanation: committed
          ? "The leader can commit a current-term entry once it is stored on a majority of the configured cluster."
          : "The entry exists in the minority partition, but two replicas are not a majority of the five-node cluster.",
        raftRule:
          "Commit decisions use the full configured cluster membership, not only currently reachable servers.",
        sourceNode: leader.id,
        term: leader.currentTerm,
        paperSection: "Section 5.3 — Log Replication",
      }),
    ],
  };
};

function createLogReplicationMessage(
  context: TransitionContext,
  leader: RaftNode,
  targetNode: NodeId,
  logicalTime: number,
): RaftMessage {
  const nextIndex = leader.nextIndex?.[targetNode] ?? 1;
  const prevLogIndex = nextIndex - 1;

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
      purpose: "log_replication",
    },
  };
}

function createCommitUpdateMessage(
  context: TransitionContext,
  leader: RaftNode,
  targetNode: NodeId,
  logicalTime: number,
): RaftMessage {
  const nextIndex = leader.nextIndex?.[targetNode] ?? 1;
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
      entries: [],
      leaderCommit: leader.commitIndex,
      purpose: "commit_update",
    },
  };
}

function findRunningLeader(state: ClusterState): RaftNode | null {
  const leaders = Object.values(state.nodes).filter(
    (node) => node.role === "leader" && node.status === "running",
  );
  return leaders.length === 1 ? leaders[0] : null;
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

function readClientCommandPayload(payload: unknown): ClientCommandPayload {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "command" in payload &&
    typeof payload.command === "string"
  ) {
    return { command: payload.command };
  }
  throw new Error("Invalid client command payload.");
}

function readLeaderPayload(payload: unknown): LeaderPayload {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "leaderId" in payload &&
    typeof payload.leaderId === "string"
  ) {
    return { leaderId: payload.leaderId };
  }
  throw new Error("Invalid leader payload.");
}

function readReplicationProgressPayload(payload: unknown): ReplicationProgressPayload {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "leaderId" in payload &&
    typeof payload.leaderId === "string" &&
    "entryIndex" in payload &&
    typeof payload.entryIndex === "number"
  ) {
    return { leaderId: payload.leaderId, entryIndex: payload.entryIndex };
  }
  throw new Error("Invalid replication progress payload.");
}
