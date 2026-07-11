# Trace Format

## Format Name

`raft-explorer-trace`

## Version

The current schema version is `1`. Import rejects unknown format names and unsupported versions.

## Scenario

`scenario.id` references one of the five registered scenarios. `scenario.name` is included for readability. Import rejects unavailable scenario IDs.

## Initial State

`initialState` is the complete five-node `ClusterState` at action step 0. `initialActions` contains the deterministic queue used to start the scenario.

## Actions

`executedActions` is ordered from 1. Each record contains the real `ScheduledAction`, logical time before and after execution, full before and after snapshots, emitted event IDs, and affected message IDs.

## Messages

Messages remain part of each `ClusterState`. Action records list IDs whose message envelope or lifecycle status changed during that action.

## Events

Events remain part of each state snapshot. `emittedEventIds` makes deterministic event generation directly comparable during replay.

## Final State

`finalState` is the live state at export time. It may represent a completed scenario or a reproducible partial run.

## Invariant Summary

`invariantSummary` records whether the exported live state passes runtime checks and includes structured violations when it does not.

## Import Validation

Import parses JSON as `unknown`, validates format, version, creator, scenario, actions, states, ordering, logical time, IDs, event steps, and invariants, then performs real replay. Invalid input is never cast directly into simulator state.

## Compatibility

Version 1 readers accept only version 1. Future incompatible schema changes must increment `version`; they must not silently reinterpret old traces.

## Small Example

```json
{
  "format": "raft-explorer-trace",
  "version": 1,
  "createdBy": {
    "application": "Raft Explorer",
    "applicationVersion": "1.1.0"
  },
  "scenario": {
    "id": "basic-leader-election",
    "name": "Basic Leader Election and Log Replication"
  },
  "initialState": { "nodes": {}, "messages": [], "events": [], "currentStep": 0, "logicalTime": 0 },
  "initialActions": [],
  "executedActions": [],
  "finalState": { "nodes": {}, "messages": [], "events": [], "currentStep": 0, "logicalTime": 0 },
  "invariantSummary": { "valid": true, "violations": [] }
}
```
