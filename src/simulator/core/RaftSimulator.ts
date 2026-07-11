import { EventQueue } from "./EventQueue";
import { IdGenerator } from "./IdGenerator";
import { MessageQueue } from "./MessageQueue";
import { applyTransition } from "../transitions/applyTransition";
import type { ActionHandler, TransitionContext } from "../transitions/types";
import type { ClusterState, ScheduledAction, SimulationEvent } from "../types";

export interface StepResult {
  executed: boolean;
  action?: ScheduledAction;
  emittedEvents: SimulationEvent[];
  state: ClusterState;
}

/** Deterministic simulator engine. It does not implement Raft protocol rules yet. */
export class RaftSimulator {
  private readonly initialState: ClusterState;
  private readonly initialActions: ScheduledAction[];
  private state: ClusterState;
  private readonly eventQueue = new EventQueue();
  private messageQueue: MessageQueue;
  private readonly handlers = new Map<string, ActionHandler>();
  private readonly eventIdGenerator = new IdGenerator();
  private readonly messageIdGenerator = new IdGenerator();
  private readonly actionIdGenerator = new IdGenerator();
  private nextSequence = 1;

  constructor(initialState: ClusterState, initialActions: ScheduledAction[] = []) {
    this.initialState = structuredClone(initialState);
    this.initialActions = structuredClone(initialActions);
    this.state = structuredClone(initialState);
    this.messageQueue = new MessageQueue(this.state.messages);
    this.registerHandler("engine_demo_tick", createEngineDemoTickHandler());
    this.restoreInitialActions();
  }

  getState(): ClusterState {
    return structuredClone(this.state);
  }

  getPendingActions(): ScheduledAction[] {
    return this.eventQueue.toArray();
  }

  registerHandler(actionType: string, handler: ActionHandler): void {
    this.handlers.set(actionType, handler);
  }

  createAction<TPayload = unknown>(
    type: string,
    scheduledTime: number,
    payload: TPayload,
  ): ScheduledAction<TPayload> {
    const sequence = this.nextSequence;
    this.nextSequence += 1;

    return {
      id: this.actionIdGenerator.next("action"),
      type,
      scheduledTime,
      sequence,
      payload,
    };
  }

  schedule(action: ScheduledAction): void {
    if (action.scheduledTime < this.state.logicalTime) {
      throw new Error(
        `Cannot schedule action "${action.id}" at T+${action.scheduledTime} ms because logical time is already T+${this.state.logicalTime} ms.`,
      );
    }

    const actionToQueue =
      action.sequence > 0 ? action : { ...action, sequence: this.nextSequence };

    this.nextSequence = Math.max(this.nextSequence, actionToQueue.sequence + 1);
    this.eventQueue.enqueue(structuredClone(actionToQueue));
  }

  step(): StepResult {
    const action = this.eventQueue.dequeue();

    if (!action) {
      return {
        executed: false,
        emittedEvents: [],
        state: this.getState(),
      };
    }

    const handler = this.handlers.get(action.type);
    if (!handler) {
      throw new Error(`No action handler registered for "${action.type}".`);
    }

    const logicalTime = Math.max(this.state.logicalTime, action.scheduledTime);
    const stateAtActionTime: ClusterState = {
      ...this.state,
      logicalTime,
    };

    const transition = handler(
      structuredClone(stateAtActionTime),
      structuredClone(action),
      this.createTransitionContext(),
    );
    const emittedEvents = this.assignEventSteps(transition.emittedEvents);
    const applied = applyTransition(transition, this.messageQueue);

    this.state = {
      ...applied.state,
      events: [...transition.nextState.events, ...emittedEvents],
      currentStep: this.state.currentStep + 1,
      logicalTime,
    };

    for (const scheduledAction of applied.scheduledActions) {
      this.schedule(scheduledAction);
    }

    return {
      executed: true,
      action: structuredClone(action),
      emittedEvents: structuredClone(emittedEvents),
      state: this.getState(),
    };
  }

  reset(): void {
    this.state = structuredClone(this.initialState);
    this.eventQueue.clear();
    this.messageQueue = new MessageQueue(this.state.messages);
    this.eventIdGenerator.reset();
    this.messageIdGenerator.reset();
    this.actionIdGenerator.reset();
    this.nextSequence = 1;
    this.restoreInitialActions();
  }

  hasPendingActions(): boolean {
    return !this.eventQueue.isEmpty();
  }

  private createTransitionContext(): TransitionContext {
    return {
      createEventId: () => this.eventIdGenerator.next("event"),
      createMessageId: () => this.messageIdGenerator.next("message"),
      createActionId: () => this.actionIdGenerator.next("action"),
    };
  }

  private assignEventSteps(events: SimulationEvent[]): SimulationEvent[] {
    const firstStep = this.state.events.length + 1;

    return events.map((event, index) => ({
      ...event,
      step: firstStep + index,
    }));
  }

  private restoreInitialActions(): void {
    for (const action of this.initialActions) {
      this.schedule(action);
    }
  }
}

function createEngineDemoTickHandler(): ActionHandler {
  return (state, action, context) => {
    const event: SimulationEvent = {
      id: context.createEventId(),
      step: state.currentStep + 1,
      logicalTime: action.scheduledTime,
      type: "engine_demo_tick",
      title: "Phase 2 Engine Event",
      description: "The simulator executed one scheduled infrastructure action.",
      explanation:
        "This is an engine demonstration event, not a Raft protocol event.",
      raftRule: "No Raft protocol rule is applied in this Phase 2 infrastructure action.",
      isDemoEvent: true,
    };

    return {
      nextState: state,
      emittedEvents: [event],
    };
  };
}
