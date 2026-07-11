import { describe, expect, it } from "vitest";
import { MessageQueue } from "../simulator/core/MessageQueue";
import type { RaftMessage } from "../simulator/types";

function message(id: string): RaftMessage {
  return {
    id,
    type: "append_entries",
    from: "A",
    to: "B",
    term: 0,
    status: "queued",
    payload: {
      term: 0,
      leaderId: "A",
      prevLogIndex: 0,
      prevLogTerm: 0,
      entries: [],
      leaderCommit: 0,
      purpose: "heartbeat",
    },
  };
}

describe("MessageQueue", () => {
  it("enqueues messages in queued state", () => {
    const queue = new MessageQueue();

    queue.enqueue(message("message-1"));

    expect(queue.getQueuedMessages()).toHaveLength(1);
    expect(queue.getById("message-1")?.status).toBe("queued");
  });

  it("finds a message by ID", () => {
    const queue = new MessageQueue();

    queue.enqueue(message("message-1"));

    expect(queue.getById("message-1")?.id).toBe("message-1");
  });

  it("marks queued messages as delivered", () => {
    const queue = new MessageQueue();

    queue.enqueue(message("message-1"));
    queue.markDelivered("message-1");

    expect(queue.getById("message-1")?.status).toBe("delivered");
  });

  it("marks queued messages as dropped", () => {
    const queue = new MessageQueue();

    queue.enqueue(message("message-1"));
    queue.markDropped("message-1");

    expect(queue.getById("message-1")?.status).toBe("dropped");
  });

  it("does not move delivered messages to dropped", () => {
    const queue = new MessageQueue();

    queue.enqueue(message("message-1"));
    queue.markDelivered("message-1");
    queue.markDropped("message-1");

    expect(queue.getById("message-1")?.status).toBe("delivered");
  });

  it("does not move dropped messages to delivered", () => {
    const queue = new MessageQueue();

    queue.enqueue(message("message-1"));
    queue.markDropped("message-1");
    queue.markDelivered("message-1");

    expect(queue.getById("message-1")?.status).toBe("dropped");
  });

  it("clears all messages", () => {
    const queue = new MessageQueue();

    queue.enqueue(message("message-1"));
    queue.clear();

    expect(queue.toArray()).toEqual([]);
  });
});
