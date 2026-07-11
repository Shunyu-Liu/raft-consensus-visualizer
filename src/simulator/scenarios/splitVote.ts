import { createInitialClusterState } from "../createInitialState";
import {
  SCRIPT_SPLIT_VOTE_TERM_ONE,
  SCRIPT_SPLIT_VOTE_TERM_TWO,
  registerSplitVoteHandlers,
} from "../transitions/splitVote";
import { registerFailureHandlers } from "../transitions/failure";
import { createScenarioSimulator } from "./leaderFailure";
import type { ScenarioDefinition } from "./types";

export const splitVoteScenario: ScenarioDefinition = {
  id: "split-vote",
  name: "Split Vote",
  description:
    "Node A and Node D split the Term 1 vote, then Node A wins a deterministic Term 2 election.",
  learningObjectives: [
    "Split votes can leave a term without a leader",
    "A later timeout starts a new term",
    "Randomized election timeouts reduce repeated collisions",
  ],
  capabilities: {
    clientCommands: false,
    manualCrash: true,
    manualRestart: true,
    networkPartition: false,
  },
  createInitialState: () => createInitialClusterState(["A", "B", "C", "D", "E"]),
  createInitialActions: () => [
    { id: "action-1", type: SCRIPT_SPLIT_VOTE_TERM_ONE, scheduledTime: 1500, sequence: 1, payload: {} },
    { id: "action-2", type: SCRIPT_SPLIT_VOTE_TERM_TWO, scheduledTime: 2600, sequence: 2, payload: {} },
  ],
  createSimulator: () => {
    const simulator = createScenarioSimulator(splitVoteScenario);
    registerSplitVoteHandlers(simulator);
    registerFailureHandlers(simulator);
    return simulator;
  },
};
