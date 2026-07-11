# Architecture

Raft Explorer is a Vite, React, and TypeScript application built around a deterministic simulator core.

## Layers

```text
React UI
  -> useSimulator
  -> RaftSimulator
  -> Transition handlers
  -> EventQueue / MessageQueue
```

## Simulator Core

The simulator lives under `src/simulator/`. It owns cluster state, scheduled actions, messages, events, and deterministic logical time. It does not import React, use DOM APIs, depend on wall-clock time, or communicate over a real network.

## Transitions

Protocol behavior is modeled as transition handlers in `src/simulator/transitions/`. Handlers consume a cloned state snapshot and a ScheduledAction, then return a TransitionResult containing next state, emitted events, messages, status updates, and future actions.

## UI State

React UI state, such as selected node, selected message, display mode, theme, hash route, glossary search, and inspector tab selection, stays outside ClusterState. Visual state must not be written into RaftNode or simulator protocol state.

## Content

Teaching content is stored as typed data in `src/content/`. The Learn page renders that data and connects concepts to real Scenario IDs from the registry.

## Determinism

Scenarios use deterministic scheduled actions and logical time. Reset recreates the initial simulator state and action queue so tests and teaching flows are reproducible.
