import type { GlossaryItem } from "./types";

const base = {
  relatedConceptIds: ["consensus"],
  relatedScenarioIds: ["basic-leader-election"],
  paperSection: "Section 5.1 — Raft Basics",
} as const;

export const glossaryItems: GlossaryItem[] = [
  item("consensus", "Consensus", "Agreement on committed decisions.", "Consensus lets a cluster safely decide command order and committed results despite crashes, restarts, and partitions.", ["consensus"]),
  item("replicated-state-machine", "Replicated State Machine", "A state machine driven by the same committed log on multiple servers.", "If each replica applies the same commands in the same order, each replica reaches the same state.", ["replicated-state-machine"]),
  item("server", "Server", "A member of the Raft cluster.", "A server stores term, vote, log, commitIndex, and lastApplied state.", ["roles"]),
  item("node", "Node", "The visualized server in Raft Explorer.", "Node and server are used interchangeably in the simulator UI.", ["roles"]),
  item("follower", "Follower", "The default passive role.", "Followers receive leader messages and can become candidates after election timeout.", ["roles"]),
  item("candidate", "Candidate", "A server campaigning to become leader.", "A candidate increments term, votes for itself, and sends RequestVote RPCs.", ["roles", "leader-election"]),
  item("leader", "Leader", "The server that accepts client commands for a term.", "A leader appends commands, replicates logs, sends heartbeats, and tracks follower progress.", ["roles", "log-replication"]),
  item("term", "Term", "A logical era in Raft.", "Terms are stored per server and increase when elections begin.", ["terms"]),
  item("current-term", "Current Term", "The highest term a server has observed.", "A server updates currentTerm after observing a higher-term Raft message.", ["terms"]),
  item("election-timeout", "Election Timeout", "The delay after which a follower starts an election.", "Raft uses election timeouts to detect missing leader contact.", ["leader-election"]),
  item("randomized-election-timeout", "Randomized Election Timeout", "A production technique to reduce repeated split votes.", "Raft Explorer uses deterministic teaching timeouts, but the concept explains why real Raft randomizes election timing.", ["leader-election"]),
  item("vote", "Vote", "A server's support for one candidate in a term.", "A server grants at most one vote per term.", ["leader-election"]),
  item("majority", "Majority", "More than half of configured cluster members.", "A five-node cluster requires three votes or replicas for majority.", ["consensus", "commit-apply"]),
  item("quorum", "Quorum", "A majority-sized decision set.", "Quorum overlap helps prevent conflicting committed decisions.", ["consensus"]),
  item("request-vote", "RequestVote", "The RPC candidates send to request votes.", "RequestVote carries candidate term, candidate id, lastLogIndex, and lastLogTerm.", ["leader-election"]),
  item("request-vote-response", "RequestVote Response", "The reply to RequestVote.", "It tells the candidate whether a vote was granted and carries the responder's term.", ["leader-election"]),
  item("append-entries", "AppendEntries", "The RPC leaders use for heartbeats, log entries, and commit updates.", "AppendEntries carries term, leaderId, prevLogIndex, prevLogTerm, entries, and leaderCommit.", ["heartbeat", "log-replication"]),
  item("append-entries-response", "AppendEntries Response", "The follower reply to AppendEntries.", "It reports success or rejection and lets the leader update replication progress.", ["log-replication", "conflicting-logs"]),
  item("heartbeat", "Heartbeat", "An empty AppendEntries RPC.", "Heartbeat maintains leadership and resets follower election timers without carrying new entries.", ["heartbeat"]),
  item("log", "Log", "The ordered list of commands on a server.", "Raft replicates logs so servers can apply the same committed commands in order.", ["replicated-state-machine", "log-replication"]),
  item("log-entry", "Log Entry", "One command record in a Raft log.", "A log entry has an index, term, command, and commit/apply status in the simulator.", ["log-replication"]),
  item("log-index", "Log Index", "The position of an entry in the log.", "Indexes are used by prevLogIndex, commitIndex, lastApplied, nextIndex, and matchIndex.", ["log-replication"]),
  item("log-term", "Log Term", "The term stored on a log entry.", "Entry terms let Raft detect stale or conflicting log suffixes.", ["log-replication", "conflicting-logs"]),
  item("command", "Command", "The client operation stored in a log entry.", "Raft Explorer treats commands as strings such as SET x = 10.", ["replicated-state-machine"]),
  item("prev-log-index", "prevLogIndex", "The index before the new entries in AppendEntries.", "Followers use prevLogIndex with prevLogTerm to check whether their log prefix matches the leader's expectation.", ["log-replication", "conflicting-logs"]),
  item("prev-log-term", "prevLogTerm", "The term at prevLogIndex.", "A mismatch causes the follower to reject AppendEntries.", ["log-replication", "conflicting-logs"]),
  item("commit-index", "Commit Index", "The highest log index known to be committed.", "Followers learn leader commit progress from leaderCommit in AppendEntries.", ["commit-apply"]),
  item("last-applied", "Last Applied", "The highest log index applied to the state machine.", "lastApplied advances in order and cannot exceed commitIndex.", ["commit-apply"]),
  item("committed-entry", "Committed Entry", "An entry considered safe by Raft's commit rule.", "Committed entries should not be replaced by later leaders.", ["commit-apply", "safety"]),
  item("applied-entry", "Applied Entry", "An entry already executed by the state machine.", "Raft Explorer marks applied entries instead of running a real database.", ["commit-apply"]),
  item("next-index", "nextIndex", "The next log index a leader will send to a follower.", "Failed AppendEntries backs up nextIndex; success moves it to matchIndex plus one.", ["log-replication", "conflicting-logs"]),
  item("match-index", "matchIndex", "The highest index the leader knows a follower has replicated.", "Leaders use matchIndex values to reason about majority replication.", ["log-replication", "conflicting-logs"]),
  item("network-partition", "Network Partition", "A communication split between groups of running nodes.", "Partitioned nodes keep running, but cross-group messages are dropped.", ["network-partition"], ["network-partition"]),
  item("minority-partition", "Minority Partition", "A partition group that cannot form a majority.", "A two-node group in a five-node cluster cannot commit by itself.", ["network-partition"], ["network-partition"]),
  item("majority-partition", "Majority Partition", "A partition group large enough to form a majority.", "A three-node group in a five-node cluster can elect a leader and commit.", ["network-partition"], ["network-partition"]),
  item("crash", "Crash", "A node stops processing messages.", "The teaching model preserves currentTerm, votedFor, and log across crash.", ["roles"], ["leader-failure"]),
  item("restart", "Restart", "A crashed node returns as a follower.", "A restarted node learns newer terms through later Raft messages.", ["terms"], ["leader-failure"]),
  item("split-vote", "Split Vote", "An election where no candidate receives a majority.", "A later election term can resolve the tie.", ["leader-election"], ["split-vote"]),
  item("log-matching", "Log Matching", "The property that same index and term imply identical prefix.", "AppendEntries uses prevLogIndex and prevLogTerm to preserve log matching.", ["safety", "conflicting-logs"]),
  item("common-prefix", "Common Prefix", "The shared matching start of two logs.", "Log reconciliation finds the common prefix before replacing conflicting suffixes.", ["conflicting-logs"]),
  item("conflicting-log", "Conflicting Log", "A log suffix with entries whose terms differ from the leader at the same indexes.", "Uncommitted conflicting suffixes can be replaced by the current leader's entries.", ["conflicting-logs"], ["conflicting-logs"]),
  item("conflict-truncation", "Conflict Truncation", "Deleting the first conflicting entry and everything after it.", "Follower truncation is allowed for uncommitted conflicting suffixes, not committed prefixes.", ["conflicting-logs"], ["conflicting-logs"]),
  item("log-reconciliation", "Log Reconciliation", "Repairing divergent logs through AppendEntries retries.", "The leader backs up nextIndex until it finds a matching prefix, then sends its suffix.", ["conflicting-logs"], ["conflicting-logs"]),
  item("state-machine-safety", "State Machine Safety", "Servers do not apply different commands at the same index.", "Raft applies committed entries in order to preserve state-machine safety.", ["safety"]),
  item("leader-completeness", "Leader Completeness", "Later leaders contain entries committed in earlier terms.", "The RequestVote log up-to-date rule supports this safety property.", ["safety"]),
  item("election-safety", "Election Safety", "At most one leader can be elected in a given term.", "Majority voting prevents two candidates from both winning the same term.", ["safety", "leader-election"]),
];

export function searchGlossary(query: string, items: GlossaryItem[] = glossaryItems): GlossaryItem[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return items;
  }

  return items.filter((item) =>
    [item.term, item.shortDefinition, item.longDefinition]
      .join(" ")
      .toLowerCase()
      .includes(normalized),
  );
}

function item(
  id: string,
  term: string,
  shortDefinition: string,
  longDefinition: string,
  relatedConceptIds: string[] = [...base.relatedConceptIds],
  relatedScenarioIds: string[] = [...base.relatedScenarioIds],
  paperSection = base.paperSection,
): GlossaryItem {
  return {
    id,
    term,
    shortDefinition,
    longDefinition,
    relatedConceptIds,
    relatedScenarioIds,
    paperSection,
  };
}
