import type { ClusterState, MessageId, RaftMessage } from "../../simulator/types";
import type { TraceActionRecord } from "../../simulator/trace/types";

export type MessageActivityKind = "created" | "delivered" | "dropped" | "updated";

export interface MessageActivity {
  messageId: MessageId;
  actionStep: number;
  kind: MessageActivityKind;
}

export interface MessageActivityFrame {
  actionStep: number;
  messageIds: MessageId[];
  activityByMessageId: Record<MessageId, MessageActivityKind>;
}

export function getMessageActivity(
  previousState: ClusterState,
  currentState: ClusterState,
  actionStep: number,
): MessageActivity[] {
  const previous = new Map(previousState.messages.map((message) => [message.id, message]));
  return currentState.messages.flatMap<MessageActivity>((message) => {
    const before = previous.get(message.id);
    if (!before) return [{ messageId: message.id, actionStep, kind: "created" as const }];
    if (before.status === "queued" && message.status === "delivered") return [{ messageId: message.id, actionStep, kind: "delivered" as const }];
    if (before.status === "queued" && message.status === "dropped") return [{ messageId: message.id, actionStep, kind: "dropped" as const }];
    if (messageChanged(before, message)) return [{ messageId: message.id, actionStep, kind: "updated" as const }];
    return [];
  });
}

export function buildMessageActivityFrames(initialState: ClusterState, history: TraceActionRecord[]): MessageActivityFrame[] {
  let previous = initialState;
  return history.map((record, index) => {
    const actionStep = index + 1;
    const activities = getMessageActivity(previous, record.stateAfter, actionStep);
    previous = record.stateAfter;
    return {
      actionStep,
      messageIds: activities.map((activity) => activity.messageId),
      activityByMessageId: Object.fromEntries(activities.map((activity) => [activity.messageId, activity.kind])),
    };
  });
}

function messageChanged(before: RaftMessage, after: RaftMessage): boolean {
  return before.id !== after.id || before.status !== after.status ||
    before.createdAtLogicalTime !== after.createdAtLogicalTime ||
    before.deliveredAtLogicalTime !== after.deliveredAtLogicalTime ||
    before.droppedAtLogicalTime !== after.droppedAtLogicalTime ||
    before.dropReason !== after.dropReason;
}
