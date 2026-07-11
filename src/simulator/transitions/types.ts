import type {
  ClusterState,
  MessageDropReason,
  RaftMessage,
  ScheduledAction,
  SimulationEvent,
} from "../types";

export interface TransitionContext {
  createEventId: () => string;
  createMessageId: () => string;
  createActionId: () => string;
}

export interface TransitionResult {
  nextState: ClusterState;
  emittedEvents: SimulationEvent[];
  outgoingMessages?: RaftMessage[];
  messageStatusUpdates?: Array<{
    messageId: string;
    status: "delivered" | "dropped";
    logicalTime?: number;
    reason?: MessageDropReason;
  }>;
  scheduledActions?: ScheduledAction[];
}

export type ActionHandler<TPayload = unknown> = (
  state: ClusterState,
  action: ScheduledAction<TPayload>,
  context: TransitionContext,
) => TransitionResult;
