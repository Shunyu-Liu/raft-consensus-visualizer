import { describe, expect, it } from "vitest";
import { EventQueue } from "../simulator/core/EventQueue";
import type { ScheduledAction } from "../simulator/types";

function action(
  id: string,
  scheduledTime: number,
  sequence: number,
): ScheduledAction {
  return {
    id,
    type: "test_action",
    scheduledTime,
    sequence,
    payload: {},
  };
}

describe("EventQueue", () => {
  it("enqueues actions and orders them by scheduled time", () => {
    const queue = new EventQueue();

    queue.enqueue(action("late", 200, 1));
    queue.enqueue(action("early", 100, 2));

    expect(queue.toArray().map((item) => item.id)).toEqual(["early", "late"]);
  });

  it("keeps stable sequence order when scheduled time is equal", () => {
    const queue = new EventQueue();

    queue.enqueue(action("second", 100, 2));
    queue.enqueue(action("first", 100, 1));

    expect(queue.dequeue()?.id).toBe("first");
    expect(queue.dequeue()?.id).toBe("second");
  });

  it("peeks without deleting the next action", () => {
    const queue = new EventQueue();
    queue.enqueue(action("first", 100, 1));

    expect(queue.peek()?.id).toBe("first");
    expect(queue.size).toBe(1);
  });

  it("dequeues and removes the next action", () => {
    const queue = new EventQueue();
    queue.enqueue(action("first", 100, 1));

    expect(queue.dequeue()?.id).toBe("first");
    expect(queue.isEmpty()).toBe(true);
  });

  it("returns undefined when dequeuing an empty queue", () => {
    const queue = new EventQueue();

    expect(queue.dequeue()).toBeUndefined();
  });

  it("clears all queued actions", () => {
    const queue = new EventQueue();
    queue.enqueue(action("first", 100, 1));
    queue.clear();

    expect(queue.size).toBe(0);
    expect(queue.isEmpty()).toBe(true);
  });
});
