import type { RaftSimulator } from "../core/RaftSimulator";
import {
  type NetworkOperationResult,
  type NetworkPartitionGroup,
  validatePartitionGroups,
} from "../network/topology";
import type { ActionHandler, TransitionContext } from "./types";
import type {
  NodeId,
  PartitionId,
  RaftNode,
  ScheduledAction,
  SimulationEvent,
  StateChange,
} from "../types";

export const CREATE_NETWORK_PARTITION = "create_network_partition";
export const HEAL_NETWORK_PARTITION = "heal_network_partition";

interface CreatePartitionPayload {
  groups: NetworkPartitionGroup[];
}

type HealPartitionPayload = Record<string, never>;

export function registerPartitionHandlers(simulator: RaftSimulator): void {
  simulator.registerHandler(CREATE_NETWORK_PARTITION, handleCreateNetworkPartition);
  simulator.registerHandler(HEAL_NETWORK_PARTITION, handleHealNetworkPartition);
}

export function createNetworkPartition(
  simulator: RaftSimulator,
  groups: NetworkPartitionGroup[],
): NetworkOperationResult {
  const state = simulator.getState();
  const validation = validatePartitionGroups(state, groups);
  if (!validation.valid) {
    return { accepted: false, reason: validation.reason };
  }

  const action = simulator.createAction(CREATE_NETWORK_PARTITION, state.logicalTime + 1, {
    groups,
  });
  simulator.schedule(action);

  return { accepted: true, actionId: action.id };
}

export function healNetworkPartition(simulator: RaftSimulator): NetworkOperationResult {
  const state = simulator.getState();
  if (!Object.values(state.nodes).some((node) => node.partitionId !== null)) {
    return { accepted: false, reason: "Network is already fully connected." };
  }

  const action = simulator.createAction<HealPartitionPayload>(
    HEAL_NETWORK_PARTITION,
    state.logicalTime + 1,
    {},
  );
  simulator.schedule(action);

  return { accepted: true, actionId: action.id };
}

export const handleCreateNetworkPartition: ActionHandler = (
  state,
  action,
  context,
) => {
  const payload = readCreatePartitionPayload(action.payload);
  const validation = validatePartitionGroups(state, payload.groups);
  if (!validation.valid) {
    return {
      nextState: state,
      emittedEvents: [
        createEvent(context, action.scheduledTime, {
          type: "network_partition_rejected",
          title: "Network partition request was rejected",
          description: validation.reason ?? "The requested partition was invalid.",
          explanation:
            "A partition operation must assign every configured node to exactly one non-empty group.",
          raftRule:
            "Network topology changes in this simulator do not change Raft membership.",
        }),
      ],
    };
  }

  const groupByNode = new Map<NodeId, PartitionId>();
  for (const group of payload.groups) {
    for (const nodeId of group.nodeIds) {
      groupByNode.set(nodeId, group.id);
    }
  }

  const nextNodes: Record<NodeId, RaftNode> = {};
  const stateChanges: StateChange[] = [];
  for (const node of Object.values(state.nodes)) {
    const nextPartitionId = groupByNode.get(node.id) ?? null;
    nextNodes[node.id] = {
      ...node,
      partitionId: nextPartitionId,
    };
    stateChanges.push(change(node.id, "partitionId", node.partitionId, nextPartitionId));
  }

  const groupSummary = payload.groups
    .map((group) => `${group.label}: ${group.nodeIds.map((nodeId) => `Node ${nodeId}`).join(", ")}`)
    .join("; ");

  return {
    nextState: {
      ...state,
      nodes: nextNodes,
    },
    emittedEvents: [
      createEvent(context, action.scheduledTime, {
        type: "network_partition_created",
        title: "Network partition created",
        description: groupSummary,
        explanation:
          "Nodes remain running, but messages can now be delivered only within the same network group.",
        raftRule:
          "Raft safety is based on majorities of the configured cluster, not on currently reachable nodes.",
        paperSection: "Section 5.2-5.3 — Leader Election and Log Replication",
        stateChanges,
      }),
      createEvent(context, action.scheduledTime, {
        type: "minority_leader_retained",
        title: "Node B remained leader in the minority",
        description:
          "Creating a network partition does not immediately change Node B's role.",
        explanation:
          "A leader does not step down just because some messages stop receiving responses. It steps down after observing a higher term.",
        raftRule:
          "Servers update term and role through normal Raft messages, not through network topology changes.",
        sourceNode: "B",
        paperSection: "Section 5.1 — Raft Basics",
      }),
    ],
  };
};

export const handleHealNetworkPartition: ActionHandler = (
  state,
  action,
  context,
) => {
  const active = Object.values(state.nodes).some((node) => node.partitionId !== null);
  if (!active) {
    return { nextState: state, emittedEvents: [] };
  }

  const nextNodes: Record<NodeId, RaftNode> = {};
  const stateChanges: StateChange[] = [];
  for (const node of Object.values(state.nodes)) {
    nextNodes[node.id] = {
      ...node,
      partitionId: null,
    };
    stateChanges.push(change(node.id, "partitionId", node.partitionId, null));
  }

  return {
    nextState: {
      ...state,
      nodes: nextNodes,
    },
    emittedEvents: [
      createEvent(context, action.scheduledTime, {
        type: "network_partition_healed",
        title: "Network partition healed",
        description: "All five nodes can communicate again.",
        explanation:
          "Restoring connectivity does not directly synchronize terms, roles, or logs. Nodes reconcile through later Raft messages.",
        raftRule:
          "Network healing restores communication only; Raft state changes still happen through RequestVote or AppendEntries.",
        paperSection: "Section 5.1 — Raft Basics",
        stateChanges,
      }),
    ],
  };
};

function readCreatePartitionPayload(payload: unknown): CreatePartitionPayload {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "groups" in payload &&
    Array.isArray(payload.groups)
  ) {
    return { groups: payload.groups as NetworkPartitionGroup[] };
  }

  throw new Error("Invalid create network partition payload.");
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

export function createPartitionAction(
  id: string,
  scheduledTime: number,
  sequence: number,
  groups: NetworkPartitionGroup[],
): ScheduledAction<CreatePartitionPayload> {
  return {
    id,
    type: CREATE_NETWORK_PARTITION,
    scheduledTime,
    sequence,
    payload: { groups },
  };
}

export function createHealPartitionAction(
  id: string,
  scheduledTime: number,
  sequence: number,
): ScheduledAction<HealPartitionPayload> {
  return {
    id,
    type: HEAL_NETWORK_PARTITION,
    scheduledTime,
    sequence,
    payload: {},
  };
}
