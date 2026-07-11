import type { ScenarioGuideItem } from "./types";

export const scenarioGuides: ScenarioGuideItem[] = [
  {
    scenarioId: "basic-leader-election",
    difficulty: "Beginner",
    learningGoals: ["Election", "Heartbeat", "Client command", "Replication", "Commit"],
    initialSituation: "Node B has the earliest deterministic election timeout in a five-node cluster.",
    whatToWatch: ["Follower to candidate", "RequestVote RPCs", "Leader heartbeats", "Client command replication", "Commit and apply"],
    expectedOutcome: "Node B becomes leader, replicates a client command, commits it on a majority, and followers apply it.",
    relatedConceptIds: ["consensus", "roles", "leader-election", "heartbeat", "log-replication", "commit-apply"],
  },
  {
    scenarioId: "leader-failure",
    difficulty: "Intermediate",
    learningGoals: ["Crash", "Missing heartbeats", "New term", "Higher-term step down"],
    initialSituation: "Node B becomes leader, then crashes before Node C later wins a higher term.",
    whatToWatch: ["Crash event", "New election", "Old leader restart", "Higher-term AppendEntries"],
    expectedOutcome: "Node C becomes the only leader in Term 2 and the old leader returns as follower.",
    relatedConceptIds: ["roles", "terms", "leader-election", "heartbeat"],
  },
  {
    scenarioId: "split-vote",
    difficulty: "Intermediate",
    learningGoals: ["Competing candidates", "No majority", "New election term", "Randomized timeout intuition"],
    initialSituation: "Two candidates start competing campaigns in the same term.",
    whatToWatch: ["Vote division", "No majority", "Later timeout", "Leader elected in a new term"],
    expectedOutcome: "The split vote does not elect a leader; a later term resolves the election.",
    relatedConceptIds: ["leader-election", "terms", "safety"],
  },
  {
    scenarioId: "network-partition",
    difficulty: "Advanced",
    learningGoals: ["Minority", "Majority", "Cannot commit", "Different-term leaders", "Healing"],
    initialSituation: "A/B become a minority partition while C/D/E can form a majority.",
    whatToWatch: ["Cross-partition drops", "Minority command remains uncommitted", "Majority leader in higher term", "Healing and log repair"],
    expectedOutcome: "The majority makes progress, the old leader steps down, and divergent uncommitted logs are repaired.",
    relatedConceptIds: ["network-partition", "terms", "commit-apply", "conflicting-logs"],
  },
  {
    scenarioId: "conflicting-logs",
    difficulty: "Advanced",
    learningGoals: ["prevLogIndex", "prevLogTerm", "Reject", "Backtracking", "Truncation", "Convergence"],
    initialSituation: "Node C leads Term 4 while Node B holds an old uncommitted Term 2 suffix.",
    whatToWatch: ["AppendEntries rejection", "nextIndex 5 to 4 to 3", "Common prefix discovery", "Conflict truncation", "Final log convergence"],
    expectedOutcome: "Node B preserves the committed prefix, replaces the old suffix, and matches the leader log.",
    relatedConceptIds: ["conflicting-logs", "log-replication", "safety"],
  },
];
