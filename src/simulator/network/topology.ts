import type {
  ClusterState,
  MessageDropReason,
  NodeId,
  PartitionId,
  RaftMessage,
} from "../types";

export interface NetworkPartitionGroup {
  id: PartitionId;
  label: string;
  nodeIds: NodeId[];
}

export interface NetworkOperationResult {
  accepted: boolean;
  reason?: string;
  actionId?: string;
}

export interface PartitionValidationResult {
  valid: boolean;
  reason?: string;
}

export interface MessageDeliveryBlock {
  reason: MessageDropReason;
}

export function isNetworkPartitionActive(state: ClusterState): boolean {
  return Object.values(state.nodes).some((node) => node.partitionId !== null);
}

export function areNodesConnected(
  state: ClusterState,
  fromNodeId: NodeId,
  toNodeId: NodeId,
): boolean {
  const from = state.nodes[fromNodeId];
  const to = state.nodes[toNodeId];

  if (!from || !to) {
    return false;
  }

  if (!isNetworkPartitionActive(state)) {
    return true;
  }

  return from.partitionId !== null && from.partitionId === to.partitionId;
}

export function getMessageDeliveryBlock(
  state: ClusterState,
  message: Pick<RaftMessage, "from" | "to">,
): MessageDeliveryBlock | null {
  const target = state.nodes[message.to];
  if (!target || target.status === "crashed") {
    return { reason: "target_crashed" };
  }

  if (!areNodesConnected(state, message.from, message.to)) {
    return { reason: "network_partition" };
  }

  return null;
}

export function validatePartitionGroups(
  state: ClusterState,
  groups: NetworkPartitionGroup[],
): PartitionValidationResult {
  if (isNetworkPartitionActive(state)) {
    return { valid: false, reason: "Network partition is already active." };
  }

  if (groups.length < 2) {
    return { valid: false, reason: "At least two partition groups are required." };
  }

  const configuredNodeIds = Object.keys(state.nodes).sort();
  const configuredSet = new Set(configuredNodeIds);
  const groupIds = new Set<PartitionId>();
  const assigned = new Set<NodeId>();

  for (const group of groups) {
    if (groupIds.has(group.id)) {
      return { valid: false, reason: `Duplicate group id "${group.id}".` };
    }
    groupIds.add(group.id);

    if (group.nodeIds.length === 0) {
      return { valid: false, reason: `Group "${group.id}" cannot be empty.` };
    }

    for (const nodeId of group.nodeIds) {
      if (!configuredSet.has(nodeId)) {
        return { valid: false, reason: `Unknown node "${nodeId}".` };
      }
      if (assigned.has(nodeId)) {
        return { valid: false, reason: `Node "${nodeId}" appears in more than one group.` };
      }
      assigned.add(nodeId);
    }
  }

  const missing = configuredNodeIds.filter((nodeId) => !assigned.has(nodeId));
  if (missing.length > 0) {
    return { valid: false, reason: `Missing node(s): ${missing.join(", ")}.` };
  }

  return { valid: true };
}

export function getPartitionGroups(state: ClusterState): NetworkPartitionGroup[] {
  const groups = new Map<PartitionId, NodeId[]>();

  for (const node of Object.values(state.nodes)) {
    if (node.partitionId === null) {
      continue;
    }

    groups.set(node.partitionId, [...(groups.get(node.partitionId) ?? []), node.id]);
  }

  return Array.from(groups.entries()).map(([id, nodeIds]) => ({
    id,
    label: formatPartitionLabel(id),
    nodeIds,
  }));
}

export function formatPartitionLabel(partitionId: PartitionId | null): string {
  if (partitionId === null) {
    return "Connected";
  }

  return partitionId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatDropReason(reason: MessageDropReason | undefined): string {
  if (reason === "network_partition") {
    return "Network partition prevented delivery.";
  }

  if (reason === "target_crashed") {
    return "Target node was crashed.";
  }

  return "None";
}
