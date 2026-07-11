import type { ScheduledAction } from "../types";

/** Stores future simulator actions, not already-emitted teaching events. */
export class EventQueue {
  private actions: ScheduledAction[] = [];

  get size(): number {
    return this.actions.length;
  }

  enqueue(action: ScheduledAction): void {
    this.actions.push(action);
    this.actions.sort(compareActions);
  }

  peek(): ScheduledAction | undefined {
    return this.actions[0];
  }

  dequeue(): ScheduledAction | undefined {
    return this.actions.shift();
  }

  isEmpty(): boolean {
    return this.actions.length === 0;
  }

  clear(): void {
    this.actions = [];
  }

  toArray(): ScheduledAction[] {
    return structuredClone(this.actions);
  }
}

function compareActions(left: ScheduledAction, right: ScheduledAction): number {
  if (left.scheduledTime !== right.scheduledTime) {
    return left.scheduledTime - right.scheduledTime;
  }

  return left.sequence - right.sequence;
}
