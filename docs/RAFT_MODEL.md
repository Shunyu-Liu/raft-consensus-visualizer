# Simulator Model

Raft Explorer demonstrates the core ideas of Raft. It is intentionally smaller than a production implementation.

## Modeled

- Leader election
- RequestVote RPC and response
- One vote per term
- Log up-to-date voting rule
- Heartbeat as empty AppendEntries
- AppendEntries response
- Client command append
- Log replication
- Commit index and last applied
- Crash and restart
- Leader failure and re-election
- Split vote
- Network partition and healing
- Conflicting log reconciliation
- nextIndex and matchIndex

## Simplifications

- Deterministic logical time instead of real wall-clock timers
- Deterministic message ordering
- No real sockets or packet loss
- No durable disk
- No real state machine; applied entries are marked as applied
- No snapshots or log compaction
- No membership changes or joint consensus
- No PreVote, CheckQuorum, ReadIndex, or linearizable reads
- One-index-at-a-time nextIndex backtracking without conflict-term optimization

## Safety Notes

Raft Explorer demonstrates the intuition behind Raft safety properties, but it is not a formal verification tool.

Committed prefix entries are protected during conflict truncation. Empty heartbeats do not delete extra follower logs; conflicting suffixes are replaced when AppendEntries carries entries that conflict with local uncommitted entries.
