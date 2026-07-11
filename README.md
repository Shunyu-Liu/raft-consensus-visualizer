# Raft Explorer

[![CI](https://github.com/Shunyu-Liu/raft-consensus-visualizer/actions/workflows/ci.yml/badge.svg)](https://github.com/Shunyu-Liu/raft-consensus-visualizer/actions/workflows/ci.yml)
[![Deploy GitHub Pages](https://github.com/Shunyu-Liu/raft-consensus-visualizer/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/Shunyu-Liu/raft-consensus-visualizer/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Interactive educational visualization of the Raft consensus algorithm.

Raft Explorer is an educational simulator designed to visualize the core ideas of the Raft consensus algorithm. It is not a production-ready Raft implementation.

## Live Demo

https://shunyu-liu.github.io/raft-consensus-visualizer/

Simulator: https://shunyu-liu.github.io/raft-consensus-visualizer/#/simulator

Learn: https://shunyu-liu.github.io/raft-consensus-visualizer/#/learn

## Current Status

Phase 11B remote publication is complete. Continuous integration and the live GitHub Pages deployment are active on `main`.

Implemented:

- Deterministic election timeout
- Follower to Candidate transition
- Current term increment
- Candidate self vote
- RequestVote RPC
- RequestVote Response
- Follower voting rules
- Majority vote
- Candidate to Leader transition
- Step, Start, Pause, Reset, and Speed controls
- Empty AppendEntries heartbeats
- Two deterministic heartbeat rounds
- Follower heartbeat handling
- Election timer reset on valid heartbeat
- AppendEntries Response
- SVG RPC visualization
- Message Inspector
- Client Command
- Leader Log Append
- Non-empty AppendEntries
- Follower Log Append
- nextIndex and matchIndex update
- Majority Replication
- Leader Commit Index
- Leader Last Applied
- Commit Notification
- Follower Commit Index
- Follower Last Applied
- Node Crash
- Node Restart
- Leader Failure
- Dropped Messages to Crashed Nodes
- New Election
- Multiple Terms
- Higher-Term Step Down
- Re-election
- Split Vote
- Deterministic Election Timing
- Scenario Registry
- Scenario Selection
- Network Partition
- Partition Groups
- Partition-aware Message Delivery
- Network Topology UI
- Create Partition UI
- Heal Network UI
- Minority Leader
- Minority Cannot Commit
- Majority Election During Partition
- Two partition-local leaders in different terms
- Network Healing
- Higher-Term Reconciliation
- Role Reconciliation
- Conflicting Logs scenario
- prevLogIndex Validation
- prevLogTerm Validation
- AppendEntries Rejection
- Failure Response
- nextIndex Backtracking
- AppendEntries Retry
- Common Prefix Discovery
- Conflict Detection
- Conflict Truncation
- Leader Log Suffix Replication
- Log Convergence
- Partition Log Reconciliation
- Replacement of Old Uncommitted Entries
- Log Comparison UI
- Conflict Marks
- Retry and Backtracking teaching events
- Learn Page
- Learning Path
- Concept Guide
- Raft Safety Explanation
- Scenario Guide
- Common Misconceptions
- Glossary
- Glossary Search
- Simulator Deep Links
- Hash Navigation
- Responsive Layout
- Keyboard Accessibility
- Reduced Motion
- Semantic HTML
- UI Polish
- MIT License
- Contributing Guide
- Changelog
- Architecture Documentation
- Dependency Security Documentation
- GitHub Actions CI
- GitHub Pages Deployment Workflow
- Release Checklist

Not yet implemented:

- Complex message flight animation
- Conflict Term Optimization
- Conflict Index fast jump
- Snapshot and log compaction
- Membership Change
- Joint Consensus
- PreVote
- CheckQuorum
- ReadIndex
- Linearizable Read
- Real network transport
- Real disk persistence
- Production Raft

## Recommended Learning Order

1. Basic Leader Election
2. Heartbeats
3. Log Replication
4. Commit and Apply
5. Leader Failure
6. Split Vote
7. Network Partition
8. Conflicting Logs

## Concepts Covered

- Consensus
- Replicated State Machine
- Follower, Candidate, and Leader roles
- Terms and currentTerm
- Leader Election
- RequestVote
- Heartbeat as empty AppendEntries
- AppendEntries
- Log Replication
- Commit Index
- Last Applied
- Raft Safety Properties
- Network Partition
- Log Reconciliation
- nextIndex and matchIndex
- Conflicting Logs

## Getting Started

```bash
nvm use
npm ci
npm run dev
```

Open `http://localhost:5173/#/simulator` or `http://localhost:5173/#/learn`.

## Scripts

```bash
npm run dev
npm run typecheck
npm run lint
npm run test
npm run test:watch
npm run test:coverage
npm run build
npm run preview
npm run check
```

`npm run check` runs typecheck, lint, tests, and production build.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Simulator Model](docs/RAFT_MODEL.md)
- [Scenarios](docs/SCENARIOS.md)
- [Roadmap](docs/ROADMAP.md)
- [GitHub Setup](docs/GITHUB_SETUP.md)
- [Dependency Security](docs/DEPENDENCY_SECURITY.md)
- [Release Checklist](docs/RELEASE_CHECKLIST.md)
- [Contributing](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)
- [Security](SECURITY.md)

## Deployment

The application uses hash navigation so GitHub Project Pages can serve both routes from the same static `index.html`:

- `/#/simulator`
- `/#/learn`

The deploy workflow sets `VITE_BASE_PATH` to `/${{ github.event.repository.name }}/`. For a custom deployment, set `VITE_BASE_PATH` before `npm run build`.

## Simulator Notes

The current Basic Leader Election scenario is deterministic. Node B has the earliest election timeout at logical time T+1500 ms. The simulator does not use real network timing, real concurrency, persistent storage, or production-grade Raft networking.

Heartbeat is represented as an AppendEntries RPC with an empty `entries` array. Log replication is represented as AppendEntries with log entries. Commit notification is represented as AppendEntries with an empty `entries` array and an updated `leaderCommit`.

Replicated does not automatically mean committed. The leader commits a current-term entry after confirming that it is stored on a majority of servers, counting the leader's own local log as one replica. Followers learn the new commit index from the `leaderCommit` field in later AppendEntries RPCs.

Crash does not erase `currentTerm`, `votedFor`, or the log. A restarted server returns as a follower and learns about newer terms through Raft messages. Network partition is separate from crash: partitioned nodes stay running and can still communicate inside their own group. Messages are checked against the current topology at delivery time, so a queued message can be dropped by a newly created partition or delivered after a heal.

Majority is calculated from configured cluster membership, not from running, reachable, or same-partition nodes. In the Network Partition scenario, Node B can append `SET x = 10` in the A/B minority and replicate it to Node A, but 2 of 5 replicas is not a majority, so the entry remains uncommitted and unapplied. The C/D/E majority can elect Node C in Term 2. After the network heals, Node C's higher-term AppendEntries makes old leader Node B step down to follower.

Phase 8 reconciles divergent uncommitted logs through normal AppendEntries. The leader uses `nextIndex` to find the last log position it shares with a follower. Each retry sends `prevLogIndex` and `prevLogTerm`; if either field does not match the follower log, the follower rejects AppendEntries. The leader backs up `nextIndex` one index at a time and retries.

After a matching prefix is found, the follower compares incoming entries with its local log. If it finds a different term at the same index, it removes that first conflicting entry and all entries after it, then appends the leader's suffix. Committed entries are never intentionally removed. An empty heartbeat does not automatically delete extra follower log entries; log repair requires non-empty AppendEntries from the leader.

In the Network Partition scenario, Node B can append old `SET x = 10` in the A/B minority, but it remains uncommitted. After the network heals, Node C can append and replicate `SET x = 20` in Term 2. Followers with the old uncommitted entry reject the first mismatched AppendEntries attempts, the leader backs up `nextIndex`, and the old suffix is replaced by the new leader entry. The final committed log contains `SET x = 20`, not `SET x = 10`.

Randomized election timeouts reduce repeated split votes; this project uses deterministic teaching timeouts to keep scenarios reproducible.

Current simplifications:

- No infinite background heartbeat loop
- No real network delay
- No probabilistic packet loss
- Client commands are stored as strings; there is no command parser
- No database or real state machine
- One in-flight client command at a time
- Network partitions are deterministic preset groups, not a general topology editor
- One-index-at-a-time nextIndex backtracking
- No Conflict Term Optimization
- No Conflict Index fast backtracking
- No real wall-clock election timer
- No full disk or state-machine recovery
- No Snapshot
- No InstallSnapshot
- No Log Compaction
- No Membership Change
- No Joint Consensus
- No PreVote
- No CheckQuorum
- No ReadIndex
- No Linearizable Read
- No real network
- No real disk persistence
- Static GitHub Pages deployment only; no backend deployment
- Election timer reset is shown as a deterministic teaching event

## Reference

This project is inspired by Diego Ongaro and John Ousterhout, "In Search of an Understandable Consensus Algorithm."
