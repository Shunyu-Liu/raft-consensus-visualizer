import type { Misconception } from "./types";

export const misconceptions: Misconception[] = [
  {
    id: "heartbeat-separate-rpc",
    misconception: "Heartbeat is a separate RPC.",
    correction: "Heartbeat is an AppendEntries RPC with an empty entries array.",
  },
  {
    id: "one-follower-commit",
    misconception: "Copying a log entry to one follower means the entry is committed.",
    correction: "Commit requires the Raft majority rule and current-term commit conditions.",
  },
  {
    id: "replicated-committed-same",
    misconception: "Replicated and committed are the same state.",
    correction: "An entry can exist on multiple servers while still being uncommitted.",
  },
  {
    id: "global-current-term",
    misconception: "The cluster has one shared currentTerm.",
    correction: "Each server stores its own currentTerm, and terms can temporarily differ.",
  },
  {
    id: "missing-acks-step-down",
    misconception: "A leader immediately steps down when it cannot reach a majority.",
    correction: "A leader normally steps down after observing a higher term, not simply because acknowledgements are missing.",
  },
  {
    id: "partition-two-leaders",
    misconception: "A network partition cannot show two leaders.",
    correction: "Different partitions may temporarily contain leaders from different terms. Election Safety concerns leaders elected in the same term.",
  },
  {
    id: "crash-erases-log",
    misconception: "Crash deletes a node's log.",
    correction: "The teaching model preserves currentTerm, votedFor, and log across a crash.",
  },
  {
    id: "restart-knows-term",
    misconception: "A restarted node automatically knows the newest term.",
    correction: "A restarted node learns newer terms through Raft messages.",
  },
  {
    id: "majority-online-nodes",
    misconception: "Majority is calculated from currently online or reachable nodes.",
    correction: "Majority is based on configured cluster membership.",
  },
  {
    id: "heartbeat-deletes-extra-log",
    misconception: "An empty heartbeat deletes extra follower logs.",
    correction: "Conflicting entries are removed when AppendEntries carries entries that conflict with the follower's suffix.",
  },
  {
    id: "commit-index-last-applied",
    misconception: "commitIndex and lastApplied are the same value.",
    correction: "Committed entries may wait briefly before being applied. lastApplied cannot exceed commitIndex.",
  },
  {
    id: "followers-never-delete",
    misconception: "Follower logs are never deleted.",
    correction: "A follower can remove an uncommitted conflicting suffix when accepting the current leader's entries.",
  },
];
