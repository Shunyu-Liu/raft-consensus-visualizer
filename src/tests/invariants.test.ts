import { describe, expect, it } from "vitest";
import { createInitialClusterState } from "../simulator/createInitialState";
import { validateClusterInvariants } from "../simulator/invariants/validateClusterInvariants";
import { getAvailableScenarios } from "../simulator/scenarios/registry";
import { runScenarioWithInvariantChecks } from "../simulator/invariants/runScenarioWithInvariantChecks";
import type { ClusterState, RaftNode } from "../simulator/types";

describe("Raft protocol invariants", () => {
  it("accepts a valid initial state", () => expect(validateClusterInvariants(createInitialClusterState()).valid).toBe(true));

  it.each([
    ["duplicate node ID", (state: ClusterState) => { state.nodes.B.id = "A"; }, "node.identity.duplicate"],
    ["negative term", (state: ClusterState) => { state.nodes.A.currentTerm = -1; }, "node.term"],
    ["candidate without self vote", (state: ClusterState) => { Object.assign(state.nodes.A, { role: "candidate", currentTerm: 1, votedFor: "B", votesReceived: ["A"] }); }, "candidate.self-vote"],
    ["candidate missing its vote", (state: ClusterState) => { Object.assign(state.nodes.A, { role: "candidate", currentTerm: 1, votedFor: "A", votesReceived: ["B"] }); }, "candidate.votes.include-self"],
    ["duplicate votes", (state: ClusterState) => { Object.assign(state.nodes.A, { role: "candidate", currentTerm: 1, votedFor: "A", votesReceived: ["A", "A"] }); }, "candidate.votes.duplicate"],
    ["non-contiguous log", (state: ClusterState) => { state.nodes.A.log = [entry(1), entry(3)]; }, "log.index.contiguous"],
    ["duplicate log index", (state: ClusterState) => { state.nodes.A.log = [entry(1), entry(1)]; }, "log.index.duplicate"],
    ["applied but uncommitted", (state: ClusterState) => { state.nodes.A.log = [{ ...entry(1), applied: true }]; }, "log.applied-requires-committed"],
    ["commit index beyond log", (state: ClusterState) => { state.nodes.A.commitIndex = 1; }, "replication.commit-index"],
    ["lastApplied beyond commit", (state: ClusterState) => { state.nodes.A.log = [entry(1)]; state.nodes.A.lastApplied = 1; }, "replication.last-applied"],
    ["committed prefix gap", (state: ClusterState) => { state.nodes.A.log = [entry(1)]; state.nodes.A.commitIndex = 1; }, "log.committed-prefix"],
    ["applied prefix gap", (state: ClusterState) => { state.nodes.A.log = [{ ...entry(1), committed: true }]; state.nodes.A.commitIndex = 1; state.nodes.A.lastApplied = 1; }, "log.applied-index-prefix"],
    ["nextIndex below one", (state: ClusterState) => { makeLeader(state.nodes.A, ["A", "B", "C", "D", "E"]); state.nodes.A.nextIndex!.B = 0; }, "leader.next-index"],
    ["matchIndex beyond log", (state: ClusterState) => { makeLeader(state.nodes.A, ["A", "B", "C", "D", "E"]); state.nodes.A.matchIndex!.B = 1; }, "leader.match-index"],
    ["duplicate message ID", (state: ClusterState) => { const message = { id: "m", type: "request_vote" as const, from: "A", to: "B", term: 1, status: "queued" as const, payload: { term: 1, candidateId: "A", lastLogIndex: 0, lastLogTerm: 0 } }; state.messages = [message, structuredClone(message)]; }, "message.identity.duplicate"],
    ["duplicate event step", (state: ClusterState) => { state.events = [event("e1", 1), event("e2", 1)]; }, "event.step.contiguous"],
    ["negative logical time", (state: ClusterState) => { state.logicalTime = -1; }, "cluster.logical-time"],
  ])("rejects %s", (_name, mutate, invariantId) => {
    const state = createInitialClusterState();
    mutate(state);
    expect(validateClusterInvariants(state).violations.map((violation) => violation.id)).toContain(invariantId);
  });

  it("rejects two running leaders in the same term", () => {
    const state = createInitialClusterState();
    makeLeader(state.nodes.A, Object.keys(state.nodes));
    makeLeader(state.nodes.B, Object.keys(state.nodes));
    expect(validateClusterInvariants(state).violations.map((violation) => violation.id)).toContain("election.leader-uniqueness-per-term");
  });

  it("allows partition-local leaders in different terms", () => {
    const state = createInitialClusterState();
    makeLeader(state.nodes.B, Object.keys(state.nodes), 1);
    makeLeader(state.nodes.C, Object.keys(state.nodes), 2);
    state.nodes.A.partitionId = state.nodes.B.partitionId = "minority";
    state.nodes.C.partitionId = state.nodes.D.partitionId = state.nodes.E.partitionId = "majority";
    expect(validateClusterInvariants(state).valid).toBe(true);
  });
});

describe("scenario invariant audit", () => {
  it.each(getAvailableScenarios().map((scenario) => [scenario.name, scenario]))("keeps every %s step valid", (_name, scenario) => {
    expect(runScenarioWithInvariantChecks(scenario)).toMatchObject({ scenarioId: scenario.id, valid: true });
  });
});

function entry(index: number) {
  return { index, term: 1, command: `command-${index}`, committed: false, applied: false };
}

function makeLeader(node: RaftNode, peers: string[], term = 1): void {
  Object.assign(node, {
    role: "leader",
    currentTerm: term,
    votedFor: node.id,
    nextIndex: Object.fromEntries(peers.map((peer) => [peer, 1])),
    matchIndex: Object.fromEntries(peers.map((peer) => [peer, 0])),
  });
}

function event(id: string, step: number) {
  return { id, step, logicalTime: 0, type: "test", title: "Test", description: "Test", explanation: "Test", raftRule: "Test" };
}
