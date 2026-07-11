# Contributing to Raft Explorer

## Project Scope

Raft Explorer is an educational Raft simulator and learning guide. It is not a production Raft implementation, storage engine, or network service.

## Development Setup

```bash
git clone <repository-url>
cd raft-consensus-visualizer
npm ci
npm run dev
```

## Quality Checks

Run these before opening a pull request:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run check
```

## Project Architecture

```text
React UI
  -> useSimulator
  -> RaftSimulator
  -> Transition handlers
  -> EventQueue and MessageQueue
```

The simulator core is deterministic and independent of React, the DOM, wall-clock timers, and real networking.

## Contribution Areas

- Simulator correctness
- Teaching explanations
- Accessibility
- UI improvements
- Tests
- Documentation

## Protocol Changes

Changes to Raft rules must include tests, cite the relevant Raft paper section, explain any teaching simplification, and preserve deterministic scenarios. Keep protocol changes small and isolated.

## Pull Requests

Prefer small pull requests with a clear description, passing checks, and screenshots for UI changes. Avoid mixing unrelated refactors with behavior changes.

## Coding Style

- TypeScript strict mode
- No `any`
- CSS Modules for component styles
- Simulator code must not depend on React or the DOM
- Unknown external data should be represented as `unknown` and narrowed

## Reporting Bugs

Please include the scenario, steps to reproduce, expected behavior, actual behavior, browser, screenshots, and console errors when relevant.
