import type { ClusterState, NodeId } from "../types";

export interface RaftStateChange {
  nodeId?: NodeId;
  field: "role" | "term" | "votedFor" | "commitIndex" | "lastApplied" | "logLength" | "messageStatus";
  before: string | number | null;
  after: string | number | null;
}

export function compareRaftStates(before: ClusterState, after: ClusterState): RaftStateChange[] {
  const changes: RaftStateChange[] = [];
  for (const nodeId of Object.keys(after.nodes)) {
    const previous = before.nodes[nodeId];
    const current = after.nodes[nodeId];
    if (!previous || !current) continue;
    push(changes, nodeId, "role", previous.role, current.role);
    push(changes, nodeId, "term", previous.currentTerm, current.currentTerm);
    push(changes, nodeId, "votedFor", previous.votedFor, current.votedFor);
    push(changes, nodeId, "commitIndex", previous.commitIndex, current.commitIndex);
    push(changes, nodeId, "lastApplied", previous.lastApplied, current.lastApplied);
    push(changes, nodeId, "logLength", previous.log.length, current.log.length);
  }
  const previousMessages = new Map(before.messages.map((message) => [message.id, message.status]));
  for (const message of after.messages) {
    const previousStatus = previousMessages.get(message.id) ?? null;
    if (previousStatus !== message.status) changes.push({ field: "messageStatus", before: previousStatus, after: message.status });
  }
  return changes;
}

function push(changes: RaftStateChange[], nodeId: NodeId, field: RaftStateChange["field"], before: string | number | null, after: string | number | null): void {
  if (before !== after) changes.push({ nodeId, field, before, after });
}
