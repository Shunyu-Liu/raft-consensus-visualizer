import { MessageQueue } from "../core/MessageQueue";
import type { ClusterState, ScheduledAction } from "../types";
import type { TransitionResult } from "./types";

export interface AppliedTransition {
  state: ClusterState;
  scheduledActions: ScheduledAction[];
}

/** Applies a handler result in one place so state, events, and messages stay consistent. */
export function applyTransition(
  result: TransitionResult,
  currentMessages: MessageQueue,
): AppliedTransition {
  for (const update of result.messageStatusUpdates ?? []) {
    if (update.status === "delivered") {
      currentMessages.markDelivered(update.messageId, update.logicalTime);
    } else {
      currentMessages.markDropped(update.messageId, update.logicalTime, update.reason);
    }
  }

  for (const message of result.outgoingMessages ?? []) {
    currentMessages.enqueue(message);
  }

  const stateWithEventsAndMessages: ClusterState = {
    ...structuredClone(result.nextState),
    events: [
      ...result.nextState.events,
      ...structuredClone(result.emittedEvents),
    ],
    messages: currentMessages.toArray(),
  };

  return {
    state: stateWithEventsAndMessages,
    scheduledActions: structuredClone(result.scheduledActions ?? []),
  };
}
