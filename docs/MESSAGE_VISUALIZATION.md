# Message Visualization

Raft Explorer treats the main cluster canvas as a teaching view of the current action. Message records are never deleted; they remain available in the Message Inspector, event timeline, trace, and time-travel history.

## Display Modes

- **Focus** shows messages created or changed by the current scheduled action.
- **Context** shows activity from the current action and the preceding two actions.
- **All** shows every message in the current snapshot for debugging.

Activity is derived from adjacent action snapshots, so the trace format remains version 1. Historical views only use frames at or before the selected action.

## Routing

The SVG layer measures node card bounds, starts and ends paths at rectangle boundary intersections, groups messages by an ordered node pair, and assigns stable lanes per direction. Candidate quadratic curves are sampled against expanded bounds for unrelated nodes, approximate route-distance and crossing penalties against accepted routes, and accepted label rectangles. Labels choose deterministic points at 0.40, 0.50, and 0.60 along the actual Bézier curve with normal offsets. This is deterministic heuristic routing, not guaranteed optimal routing, a physical collision engine, or a general graph edge-routing proof.

Labels use compact teaching names such as “Vote request”, “Heartbeat”, and “Ack”. Full fields remain in the Message Inspector. A selected historical message can be pinned once; pinned paths are neutral, dashed, and explicitly labeled.

## Accessibility

Display controls are real radio buttons with descriptions, message arrows expose full source/target/status labels, and reduced-motion preferences disable pulse animation.
