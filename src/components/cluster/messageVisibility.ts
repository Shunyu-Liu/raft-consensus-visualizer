import type { MessageDisplayMode, MessageId, RaftMessage } from "../../simulator/types";
import type { MessageActivityFrame } from "./messageActivity";

export function getVisibleMessageIds(messages: RaftMessage[], mode: MessageDisplayMode, currentActionStep: number, frames: MessageActivityFrame[], pinnedMessageId: MessageId | null): Set<MessageId> {
  const ids = new Set<MessageId>();
  if (mode === "all") messages.forEach((message) => ids.add(message.id));
  else {
    const start = mode === "focus" ? currentActionStep : Math.max(1, currentActionStep - 2);
    frames.filter((frame) => frame.actionStep >= start && frame.actionStep <= currentActionStep).forEach((frame) => frame.messageIds.forEach((id) => ids.add(id)));
  }
  if (pinnedMessageId && messages.some((message) => message.id === pinnedMessageId)) ids.add(pinnedMessageId);
  return ids;
}

export function getVisibleMessages(messages: RaftMessage[], mode: MessageDisplayMode, currentActionStep: number, frames: MessageActivityFrame[], pinnedMessageId: MessageId | null): RaftMessage[] {
  const ids = getVisibleMessageIds(messages, mode, currentActionStep, frames, pinnedMessageId);
  return messages.filter((message) => ids.has(message.id));
}
