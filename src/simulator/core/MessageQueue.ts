import type { MessageDropReason, MessageId, RaftMessage } from "../types";

/** Manages message lifecycle while preserving terminal message states. */
export class MessageQueue {
  private messages: RaftMessage[];

  constructor(initialMessages: RaftMessage[] = []) {
    this.messages = structuredClone(initialMessages);
  }

  enqueue(message: RaftMessage): RaftMessage[] {
    this.messages = [...this.messages, structuredClone({ ...message, status: "queued" })];
    return this.toArray();
  }

  getById(id: MessageId): RaftMessage | undefined {
    const message = this.messages.find((candidate) => candidate.id === id);
    return message ? structuredClone(message) : undefined;
  }

  getQueuedMessages(): RaftMessage[] {
    return structuredClone(
      this.messages.filter((message) => message.status === "queued"),
    );
  }

  markDelivered(id: MessageId, deliveredAtLogicalTime?: number): RaftMessage[] {
    this.markTerminal(id, "delivered", deliveredAtLogicalTime);
    return this.toArray();
  }

  markDropped(
    id: MessageId,
    droppedAtLogicalTime?: number,
    dropReason?: MessageDropReason,
  ): RaftMessage[] {
    this.markTerminal(id, "dropped", droppedAtLogicalTime, dropReason);
    return this.toArray();
  }

  clear(): RaftMessage[] {
    this.messages = [];
    return [];
  }

  toArray(): RaftMessage[] {
    return structuredClone(this.messages);
  }

  private markTerminal(
    id: MessageId,
    status: "delivered" | "dropped",
    resolvedAtLogicalTime?: number,
    dropReason?: MessageDropReason,
  ): void {
    this.messages = this.messages.map((message) => {
      if (message.id !== id || message.status !== "queued") {
        return message;
      }

      return {
        ...message,
        status,
        deliveredAtLogicalTime:
          status === "delivered" ? resolvedAtLogicalTime : message.deliveredAtLogicalTime,
        droppedAtLogicalTime:
          status === "dropped" ? resolvedAtLogicalTime : message.droppedAtLogicalTime,
        dropReason: status === "dropped" ? dropReason : message.dropReason,
      };
    });
  }
}
