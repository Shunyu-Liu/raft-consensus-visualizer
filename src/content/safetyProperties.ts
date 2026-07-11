import type { SafetyProperty } from "./types";

export const safetyProperties: SafetyProperty[] = [
  {
    id: "election-safety",
    title: "Election Safety",
    explanation: "At most one leader can be elected in a given term. Partition-local leaders in different terms do not violate this property.",
    simulatorNote: "Watch Split Vote and Network Partition: no majority means no winner for that term, while Node C can later win a higher term.",
    paperSection: "Section 5.4 — Safety",
  },
  {
    id: "leader-append-only",
    title: "Leader Append-Only",
    explanation: "A leader appends new entries to its own log and does not overwrite or delete entries in its own log.",
    simulatorNote: "Follower conflict truncation is different: a follower may remove an uncommitted suffix when accepting the current leader's entries.",
    paperSection: "Section 5.4 — Safety",
  },
  {
    id: "log-matching",
    title: "Log Matching",
    explanation: "If two logs contain an entry with the same index and term, the logs match through that index.",
    simulatorNote: "The Conflicting Logs scenario shows the leader searching for a shared prefix with prevLogIndex and prevLogTerm.",
    paperSection: "Section 5.4 — Safety",
  },
  {
    id: "leader-completeness",
    title: "Leader Completeness",
    explanation: "An entry committed in a term will be present in the logs of leaders elected in later terms.",
    simulatorNote: "The RequestVote log up-to-date rule helps keep a stale-log candidate from becoming leader.",
    paperSection: "Section 5.4 — Safety",
  },
  {
    id: "state-machine-safety",
    title: "State Machine Safety",
    explanation: "Servers do not apply different commands at the same log index.",
    simulatorNote: "Only committed entries are applied, and they are applied in log order.",
    paperSection: "Section 5.4 — Safety",
  },
];

export const safetyDisclaimer =
  "Raft Explorer demonstrates the intuition behind these properties, but it is not a formal verification tool.";
