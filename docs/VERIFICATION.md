# Verification

## Why Invariants Matter

Raft Explorer executes many small deterministic transitions. Runtime invariants make invalid intermediate states visible at the transition where they appear instead of allowing a later teaching event to hide the original defect.

## Checked Invariants

The pure `validateClusterInvariants` function checks node identity, legal roles and statuses, non-negative integer terms, candidate self-votes, one running leader per term, leader replication state, contiguous logs, log terms, committed and applied prefixes, commit and apply bounds, message IDs, event IDs and steps, and non-negative logical time. Pending actions are separately checked for unique IDs, valid sequence values, and non-negative scheduled time. Majority is always derived from configured membership.

## Scenario Audit

Each of the five registered scenarios is created from its real factory, checked in its initial state, stepped until its queue is empty, and checked after every action. Different-term leaders isolated in different network partitions are valid; two running leaders in the same term are not.

## Deterministic Traces

Every executed `ScheduledAction` records logical time, before and after state, emitted event IDs, and affected message IDs. The record uses deterministic simulator IDs and never includes wall-clock timestamps, user data, tokens, or local paths.

## Trace Format

Trace JSON uses format `raft-explorer-trace` and schema version `1`. See [TRACE_FORMAT.md](TRACE_FORMAT.md).

## Replay

Replay creates a fresh simulator from the referenced scenario and executes the recorded actions in order. It compares each action, state, event IDs, invariant result, logical time, and final state. Copying the recorded final state into a simulator is not replay.

## Time Travel

Action step 0 is the scenario initial state. Action step N is the state produced by replaying the first N actions. Entering history pauses playback and disables client commands, node operations, and network mutations. Return to Live State restores the preserved latest simulator state.

## Unit Tests

Vitest covers valid and invalid invariant states, all-scenario audits, trace validation, serialization, determinism, replay, and history boundaries. Coverage thresholds enforce statements 70%, branches 60%, functions 70%, and lines 70%.

## Scenario Tests

Scenario tests validate every intermediate state for Basic Leader Election, Leader Failure, Split Vote, Network Partition, and Conflicting Logs.

## Browser Tests

Playwright Chromium tests production preview navigation, all five scenarios, trace download/import/replay, time travel, mobile width, dark theme, reduced motion, console errors, page errors, and failed requests.

## Limitations

This is runtime invariant validation, deterministic testing, and reproducible trace replay. It is not formal verification, a model-checking proof, a TLA+ proof, or a proof that the simulator implements every part of production Raft.
