import type { RaftSimulator } from "../core/RaftSimulator";
import type { ActionHandler, TransitionContext } from "./types";
import type { NodeId, RaftNode, SimulationEvent, StateChange } from "../types";

export const SCRIPT_SPLIT_VOTE_TERM_ONE = "script_split_vote_term_one";
export const SCRIPT_SPLIT_VOTE_TERM_TWO = "script_split_vote_term_two";

export function registerSplitVoteHandlers(simulator: RaftSimulator): void {
  simulator.registerHandler(SCRIPT_SPLIT_VOTE_TERM_ONE, handleSplitVoteTermOne);
  simulator.registerHandler(SCRIPT_SPLIT_VOTE_TERM_TWO, handleSplitVoteTermTwo);
}

export const handleSplitVoteTermOne: ActionHandler = (state, action, context) => {
  const nodes: Record<NodeId, RaftNode> = structuredClone(state.nodes);

  nodes.A = { ...nodes.A, role: "candidate", currentTerm: 1, votedFor: "A", votesReceived: ["A", "B"] };
  nodes.B = { ...nodes.B, currentTerm: 1, votedFor: "A" };
  nodes.C = { ...nodes.C, currentTerm: 1, votedFor: null };
  nodes.D = { ...nodes.D, role: "candidate", currentTerm: 1, votedFor: "D", votesReceived: ["D", "E"] };
  nodes.E = { ...nodes.E, currentTerm: 1, votedFor: "D" };

  return {
    nextState: { ...state, nodes },
    emittedEvents: [
      event(context, action.scheduledTime, {
        type: "split_vote",
        title: "Node A and Node D started elections in Term 1",
        description: "Node A received votes from A and B; Node D received votes from D and E.",
        explanation:
          "Neither candidate has the 3 votes required for a majority in a five-node cluster.",
        raftRule: "A candidate must receive votes from a majority of the full cluster membership.",
        paperSection: "Section 5.2 — Leader Election",
        stateChanges: [
          change("A", "role", "follower", "candidate"),
          change("D", "role", "follower", "candidate"),
        ],
      }),
      event(context, action.scheduledTime, {
        type: "election_failed",
        title: "Term 1 ended without a leader",
        description: "The vote was split 2 votes for Node A and 2 votes for Node D.",
        explanation:
          "Randomized election timeouts reduce the chance that candidates keep colliding in the same way.",
        raftRule: "No candidate becomes leader without a majority.",
        paperSection: "Section 5.2 — Leader Election",
      }),
    ],
  };
};

export const handleSplitVoteTermTwo: ActionHandler = (state, action, context) => {
  const peers = Object.keys(state.nodes);
  const nodes: Record<NodeId, RaftNode> = structuredClone(state.nodes);

  nodes.A = {
    ...nodes.A,
    role: "leader",
    currentTerm: 2,
    votedFor: "A",
    votesReceived: ["A", "B", "C"],
    nextIndex: Object.fromEntries(peers.map((peer) => [peer, nodes.A.log.length + 1])),
    matchIndex: Object.fromEntries(peers.map((peer) => [peer, 0])),
  };
  nodes.B = { ...nodes.B, role: "follower", currentTerm: 2, votedFor: "A", votesReceived: undefined };
  nodes.C = { ...nodes.C, role: "follower", currentTerm: 2, votedFor: "A", votesReceived: undefined };
  nodes.D = { ...nodes.D, role: "follower", currentTerm: 2, votedFor: "A", votesReceived: undefined };
  nodes.E = { ...nodes.E, role: "follower", currentTerm: 2, votedFor: "A", votesReceived: undefined };

  return {
    nextState: { ...state, nodes },
    emittedEvents: [
      event(context, action.scheduledTime, {
        type: "new_term",
        title: "Node A started Term 2 after a new timeout",
        description: "Node A's later deterministic timeout starts a new election round.",
        explanation:
          "A new term lets the cluster escape the previous split vote and try again.",
        raftRule: "Candidates increment their term when starting a new election.",
        sourceNode: "A",
        term: 2,
        paperSection: "Section 5.2 — Leader Election",
      }),
      event(context, action.scheduledTime, {
        type: "higher_term_observed",
        title: "Node D stepped down after seeing Term 2",
        description: "Node D observed Node A's higher term and returned to follower state.",
        explanation:
          "A candidate that sees a higher term updates its term and becomes a follower.",
        raftRule: "Servers step down when they observe a higher term.",
        sourceNode: "A",
        targetNode: "D",
        term: 2,
        stateChanges: [
          change("D", "role", "candidate", "follower"),
          change("D", "currentTerm", 1, 2),
        ],
      }),
      event(context, action.scheduledTime, {
        type: "leader_elected",
        title: "Node A became the leader of Term 2",
        description: "Node A received a majority after the second election timeout.",
        explanation:
          "The second timeout breaks the tie and allows one candidate to collect a majority.",
        raftRule: "A candidate that receives votes from a majority becomes leader.",
        sourceNode: "A",
        term: 2,
        paperSection: "Section 5.2 — Leader Election",
      }),
    ],
  };
};

function event(
  context: TransitionContext,
  logicalTime: number,
  input: Omit<SimulationEvent, "id" | "step" | "logicalTime">,
): SimulationEvent {
  return { id: context.createEventId(), step: 0, logicalTime, ...input };
}

function change(nodeId: NodeId, field: string, before: unknown, after: unknown): StateChange {
  return { nodeId, field, before, after };
}
