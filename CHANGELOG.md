# Changelog

## [Unreleased]

## [1.0.0] - 2026-07-11

### Added

- Deterministic Raft simulator engine with EventQueue, MessageQueue, IdGenerator, ScheduledAction, ActionHandler, and TransitionResult.
- Leader election, RequestVote, one vote per term, log up-to-date voting, majority election, and split-vote teaching scenarios.
- Heartbeats as empty AppendEntries, election timer reset, AppendEntries responses, and SVG message visualization.
- Client command flow, leader append, follower replication, nextIndex, matchIndex, majority replication, commit index, last applied, commit notification, and follower apply.
- Crash, restart, leader failure, higher-term step down, network partitions, minority leader behavior, majority progress, and network healing.
- Conflicting log detection, AppendEntries rejection, one-index-at-a-time nextIndex backtracking, retry, conflict truncation, leader suffix replication, and log convergence.
- Learn page with learning path, concept guide, safety properties, scenario guide, common misconceptions, glossary, and glossary search.
- Accessibility and UI polish including hash navigation, semantic structure, labels, focus states, reduced motion support, inspector tabs, and event timeline filtering.
- CI and GitHub Pages deployment preparation.
