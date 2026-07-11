import type { RaftSimulator } from "../core/RaftSimulator";
import type { ActionHandler, TransitionContext } from "./types";
import type { NodeId, RaftNode, SimulationEvent, StateChange } from "../types";

export const CRASH_NODE = "crash_node";
export const RESTART_NODE = "restart_node";

export interface NodeOperationResult {
  accepted: boolean;
  reason?: string;
  actionId?: string;
}

interface NodeOperationPayload {
  nodeId: NodeId;
}

export function registerFailureHandlers(simulator: RaftSimulator): void {
  simulator.registerHandler(CRASH_NODE, handleCrashNode);
  simulator.registerHandler(RESTART_NODE, handleRestartNode);
}

export function crashNode(simulator: RaftSimulator, nodeId: NodeId): NodeOperationResult {
  const node = simulator.getState().nodes[nodeId];
  if (!node) {
    return { accepted: false, reason: `Node ${nodeId} does not exist.` };
  }
  if (node.status === "crashed") {
    return { accepted: false, reason: `Node ${nodeId} is already crashed.` };
  }

  const action = simulator.createAction(CRASH_NODE, simulator.getState().logicalTime + 1, { nodeId });
  simulator.schedule(action);
  return { accepted: true, actionId: action.id };
}

export function restartNode(simulator: RaftSimulator, nodeId: NodeId): NodeOperationResult {
  const node = simulator.getState().nodes[nodeId];
  if (!node) {
    return { accepted: false, reason: `Node ${nodeId} does not exist.` };
  }
  if (node.status === "running") {
    return { accepted: false, reason: `Node ${nodeId} is already running.` };
  }

  const action = simulator.createAction(RESTART_NODE, simulator.getState().logicalTime + 1, { nodeId });
  simulator.schedule(action);
  return { accepted: true, actionId: action.id };
}

export const handleCrashNode: ActionHandler = (state, action, context) => {
  const payload = readNodeOperationPayload(action.payload);
  const node = state.nodes[payload.nodeId];
  if (!node || node.status === "crashed") {
    return { nextState: state, emittedEvents: [] };
  }

  const nextNode: RaftNode = {
    ...node,
    status: "crashed",
  };

  return {
    nextState: {
      ...state,
      nodes: {
        ...state.nodes,
        [node.id]: nextNode,
      },
    },
    emittedEvents: [
      createEvent(context, action.scheduledTime, {
        type: "node_crashed",
        title: `Node ${node.id} crashed`,
        description: `Node ${node.id} stopped processing messages and stopped sending heartbeats.`,
        explanation:
          "A crashed server is temporarily unavailable. Its persistent Raft state is preserved, but it cannot participate until it restarts.",
        raftRule:
          "Server failure is modeled as loss of availability, not deletion of persistent term and log state.",
        sourceNode: node.id,
        term: node.currentTerm,
        stateChanges: [change(node.id, "status", "running", "crashed")],
      }),
    ],
  };
};

export const handleRestartNode: ActionHandler = (state, action, context) => {
  const payload = readNodeOperationPayload(action.payload);
  const node = state.nodes[payload.nodeId];
  if (!node || node.status === "running") {
    return { nextState: state, emittedEvents: [] };
  }

  const nextNode: RaftNode = {
    ...node,
    status: "running",
    role: "follower",
    votesReceived: undefined,
    nextIndex: undefined,
    matchIndex: undefined,
    heartbeatElapsed: 0,
    electionElapsed: 0,
    lastHeartbeatReceivedAt: undefined,
    heartbeatRoundsSent: undefined,
  };

  return {
    nextState: {
      ...state,
      nodes: {
        ...state.nodes,
        [node.id]: nextNode,
      },
    },
    emittedEvents: [
      createEvent(context, action.scheduledTime, {
        type: "node_restarted",
        title: `Node ${node.id} restarted as a follower`,
        description: `Node ${node.id} preserved its current term and log, then returned as a running follower.`,
        explanation:
          "A restarted server does not assume it is still leader. It learns about newer terms through Raft messages.",
        raftRule:
          "Persistent state is preserved across restart, while volatile leader and candidate state is cleared.",
        sourceNode: node.id,
        term: node.currentTerm,
        stateChanges: [
          change(node.id, "status", "crashed", "running"),
          change(node.id, "role", node.role, "follower"),
        ],
      }),
    ],
  };
};

function readNodeOperationPayload(payload: unknown): NodeOperationPayload {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "nodeId" in payload &&
    typeof payload.nodeId === "string"
  ) {
    return { nodeId: payload.nodeId };
  }
  throw new Error("Invalid node operation payload.");
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
