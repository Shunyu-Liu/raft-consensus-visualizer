# Changelog

## [Unreleased]

## [1.2.0] - 2026-07-11

### Added

- Focus, Context, and All message display modes.
- Current-action message visualization and No-RPC action feedback.
- Historical message pinning and time-travel-safe message filtering.
- Node-boundary-aware RPC rendering and direction-aware deterministic lanes.
- Obstacle-aware message routing with route overlap and crossing penalties.
- Bézier-based label placement and label collision reduction.
- Additional browser acceptance tests.

### Fixed

- Restored SVG arrowheads after the message routing refactor.
- Kept arrowhead colors consistent with RPC paths.
- Corrected Focus and Context hidden-message copy.
- Unified visible-message counting and rendering logic.

## [1.1.0] - 2026-07-11

### Added

- Runtime Raft invariant checking and every-step audits for all five deterministic scenarios.
- Versioned deterministic trace export, validated import, real action replay, and state comparison.
- Time travel controls with historical mutation guards and return-to-live behavior.
- Playwright Chromium coverage for navigation, scenarios, traces, history, mobile layout, and browser errors.
- Coverage thresholds, CI end-to-end quality gates, and pre-deployment browser smoke tests.

### Fixed

- Avoided runtime action ID collisions with scripted scenario action IDs.
- Continued automatic playback after each completed action.
- Prevented the scenario selector from causing horizontal overflow on mobile viewports.

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
