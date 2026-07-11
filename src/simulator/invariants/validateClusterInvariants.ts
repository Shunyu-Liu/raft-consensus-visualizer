import type { ClusterState, RaftNode, ScheduledAction } from "../types";
import type { InvariantValidationResult, InvariantViolation } from "./types";

const roles = new Set(["follower", "candidate", "leader"]);
const statuses = new Set(["running", "crashed"]);

export function validateClusterInvariants(state: ClusterState): InvariantValidationResult {
  const violations: InvariantViolation[] = [];
  const nodes = Object.entries(state.nodes);
  const nodeIds = new Set<string>();

  for (const [key, node] of nodes) {
    if (key !== node.id) {
      add(violations, "node.identity.map-key", "Node map key mismatch", `Node map key ${key} does not match node.id ${node.id}.`, node);
    }
    if (nodeIds.has(node.id)) {
      add(violations, "node.identity.duplicate", "Duplicate node identity", `Node ID ${node.id} appears more than once.`, node);
    }
    nodeIds.add(node.id);
    validateNode(node, Object.keys(state.nodes), violations);
  }

  const leadersByTerm = new Map<number, RaftNode[]>();
  for (const node of Object.values(state.nodes)) {
    if (node.status === "running" && node.role === "leader") {
      const leaders = leadersByTerm.get(node.currentTerm) ?? [];
      leaders.push(node);
      leadersByTerm.set(node.currentTerm, leaders);
    }
  }
  for (const [term, leaders] of leadersByTerm) {
    if (leaders.length > 1) {
      violations.push({
        id: "election.leader-uniqueness-per-term",
        severity: "error",
        title: "Multiple running leaders in one term",
        description: `Term ${term} has running leaders ${leaders.map((leader) => leader.id).join(", ")}.`,
        nodeIds: leaders.map((leader) => leader.id),
        term,
      });
    }
  }

  validateUnique(state.messages.map((message) => message.id), "message.identity.duplicate", "Duplicate message identity", violations);
  validateUnique(state.events.map((event) => event.id), "event.identity.duplicate", "Duplicate event identity", violations);
  state.events.forEach((event, index) => {
    if (event.step !== index + 1) {
      violations.push({
        id: "event.step.contiguous",
        severity: "error",
        title: "Event steps are not contiguous",
        description: `Event ${event.id} has step ${event.step}; expected ${index + 1}.`,
      });
    }
  });

  if (!isNonNegativeInteger(state.currentStep)) {
    violations.push(error("cluster.current-step", "Invalid current step", `currentStep must be a non-negative integer; received ${state.currentStep}.`));
  }
  if (!isNonNegativeFinite(state.logicalTime)) {
    violations.push(error("cluster.logical-time", "Invalid logical time", `logicalTime must be a non-negative finite number; received ${state.logicalTime}.`));
  }

  return result(violations);
}

export function validateScheduledActions(actions: ScheduledAction[]): InvariantValidationResult {
  const violations: InvariantViolation[] = [];
  validateUnique(actions.map((action) => action.id), "action.identity.duplicate", "Duplicate scheduled action identity", violations);
  for (const action of actions) {
    if (!isNonNegativeFinite(action.scheduledTime)) {
      violations.push(error("action.scheduled-time", "Invalid scheduled action time", `Action ${action.id} has invalid scheduledTime ${action.scheduledTime}.`));
    }
    if (!Number.isInteger(action.sequence) || action.sequence < 0) {
      violations.push(error("action.sequence", "Invalid scheduled action sequence", `Action ${action.id} has invalid sequence ${action.sequence}.`));
    }
  }
  return result(violations);
}

export function getConfiguredMajority(state: ClusterState): number {
  return Math.floor(Object.keys(state.nodes).length / 2) + 1;
}

export function formatInvariantErrors(resultValue: InvariantValidationResult, state: ClusterState): string {
  return resultValue.violations
    .filter((violation) => violation.severity === "error")
    .map((violation) => {
      const context = [
        `logicalTime=${state.logicalTime}`,
        `currentStep=${state.currentStep}`,
        violation.nodeIds?.length ? `nodes=${violation.nodeIds.join(",")}` : undefined,
        violation.term === undefined ? undefined : `term=${violation.term}`,
        violation.logIndex === undefined ? undefined : `logIndex=${violation.logIndex}`,
      ].filter(Boolean).join(" ");
      return `[${violation.id}] ${violation.title}: ${violation.description} (${context})`;
    })
    .join("\n");
}

function validateNode(node: RaftNode, configuredNodeIds: string[], violations: InvariantViolation[]): void {
  if (!isNonNegativeInteger(node.currentTerm)) add(violations, "node.term", "Invalid current term", `Node ${node.id} currentTerm must be a non-negative integer.`, node);
  if (!roles.has(node.role)) add(violations, "node.role", "Invalid node role", `Node ${node.id} has unsupported role ${String(node.role)}.`, node);
  if (!statuses.has(node.status)) add(violations, "node.status", "Invalid node status", `Node ${node.id} has unsupported status ${String(node.status)}.`, node);

  if (node.status === "running" && node.role === "candidate") {
    if (node.votedFor !== node.id) add(violations, "candidate.self-vote", "Candidate has not voted for itself", `Running candidate ${node.id} must set votedFor to itself.`, node);
    if (!node.votesReceived?.includes(node.id)) add(violations, "candidate.votes.include-self", "Candidate vote set omits itself", `Running candidate ${node.id} must include itself in votesReceived.`, node);
    if (node.votesReceived && new Set(node.votesReceived).size !== node.votesReceived.length) add(violations, "candidate.votes.duplicate", "Candidate has duplicate votes", `Candidate ${node.id} has duplicate entries in votesReceived.`, node);
  }

  let expectedIndex = 1;
  const seenIndexes = new Set<number>();
  let sawUnapplied = false;
  for (const entry of node.log) {
    if (seenIndexes.has(entry.index)) add(violations, "log.index.duplicate", "Duplicate log index", `Node ${node.id} has duplicate log index ${entry.index}.`, node, entry.index);
    seenIndexes.add(entry.index);
    if (entry.index !== expectedIndex) add(violations, "log.index.contiguous", "Log indexes are not contiguous", `Node ${node.id} expected log index ${expectedIndex} but found ${entry.index}.`, node, entry.index);
    expectedIndex += 1;
    if (!isNonNegativeInteger(entry.term)) add(violations, "log.term", "Invalid log term", `Node ${node.id} log index ${entry.index} has invalid term ${entry.term}.`, node, entry.index);
    if (entry.applied && !entry.committed) add(violations, "log.applied-requires-committed", "Applied entry is not committed", `Node ${node.id} log index ${entry.index} is applied but uncommitted.`, node, entry.index);
    if (!entry.applied) sawUnapplied = true;
    else if (sawUnapplied) add(violations, "log.applied-prefix", "Applied log has a gap", `Node ${node.id} applies index ${entry.index} after an unapplied entry.`, node, entry.index);
  }

  const lastLogIndex = node.log.length > 0 ? node.log[node.log.length - 1].index : 0;
  if (!isNonNegativeInteger(node.commitIndex) || node.commitIndex > lastLogIndex) add(violations, "replication.commit-index", "Invalid commit index", `Node ${node.id} commitIndex ${node.commitIndex} is outside 0..${lastLogIndex}.`, node, node.commitIndex);
  if (!isNonNegativeInteger(node.lastApplied) || node.lastApplied > node.commitIndex || node.lastApplied > lastLogIndex) add(violations, "replication.last-applied", "Invalid last applied index", `Node ${node.id} lastApplied ${node.lastApplied} must be within 0..commitIndex ${node.commitIndex}.`, node, node.lastApplied);
  for (const entry of node.log) {
    if (entry.index <= node.commitIndex && !entry.committed) add(violations, "log.committed-prefix", "Committed prefix has a gap", `Node ${node.id} index ${entry.index} is at or below commitIndex but is not committed.`, node, entry.index);
    if (entry.index <= node.lastApplied && !entry.applied) add(violations, "log.applied-index-prefix", "Applied prefix has a gap", `Node ${node.id} index ${entry.index} is at or below lastApplied but is not applied.`, node, entry.index);
  }

  if (node.status === "running" && node.role === "leader") {
    for (const peerId of configuredNodeIds.filter((id) => id !== node.id)) {
      if (node.nextIndex?.[peerId] === undefined || node.matchIndex?.[peerId] === undefined) add(violations, "leader.replication-state.missing", "Leader replication state is incomplete", `Leader ${node.id} is missing nextIndex or matchIndex for peer ${peerId}.`, node);
    }
    for (const [peerId, nextIndex] of Object.entries(node.nextIndex ?? {})) {
      if (!Number.isInteger(nextIndex) || nextIndex < 1) add(violations, "leader.next-index", "Invalid nextIndex", `Leader ${node.id} nextIndex[${peerId}] must be an integer >= 1.`, node, nextIndex);
      const matchIndex = node.matchIndex?.[peerId];
      if (matchIndex !== undefined && nextIndex < matchIndex + 1) add(violations, "leader.replication-progress", "nextIndex is behind matchIndex", `Leader ${node.id} nextIndex[${peerId}] is below matchIndex + 1.`, node, nextIndex);
    }
    for (const [peerId, matchIndex] of Object.entries(node.matchIndex ?? {})) {
      if (!Number.isInteger(matchIndex) || matchIndex < 0 || matchIndex > lastLogIndex) add(violations, "leader.match-index", "Invalid matchIndex", `Leader ${node.id} matchIndex[${peerId}] must be within 0..${lastLogIndex}.`, node, matchIndex);
    }
  }
}

function validateUnique(ids: string[], id: string, title: string, violations: InvariantViolation[]): void {
  const seen = new Set<string>();
  for (const value of ids) {
    if (seen.has(value)) violations.push(error(id, title, `${title}: ${value}.`));
    seen.add(value);
  }
}

function add(violations: InvariantViolation[], id: string, title: string, description: string, node: RaftNode, logIndex?: number): void {
  violations.push({ id, severity: "error", title, description, nodeIds: [node.id], term: node.currentTerm, logIndex });
}

function error(id: string, title: string, description: string): InvariantViolation {
  return { id, severity: "error", title, description };
}

function result(violations: InvariantViolation[]): InvariantValidationResult {
  return { valid: !violations.some((violation) => violation.severity === "error"), violations };
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}
