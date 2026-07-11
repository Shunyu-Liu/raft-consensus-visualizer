import { EventQueue } from "./EventQueue";
import { IdGenerator } from "./IdGenerator";
import { MessageQueue } from "./MessageQueue";
import { applyTransition } from "../transitions/applyTransition";
import type { ActionHandler, TransitionContext } from "../transitions/types";
import type { ClusterState, ScheduledAction, SimulationEvent } from "../types";
import { validateClusterInvariants, validateScheduledActions } from "../invariants/validateClusterInvariants";
import type { InvariantValidationResult } from "../invariants/types";
import type { TraceActionRecord } from "../trace/types";

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
  private readonly eventIdGenerator: IdGenerator;
  private readonly messageIdGenerator: IdGenerator;
  private readonly actionIdGenerator: IdGenerator;
  private nextSequence = 1;
  private actionHistory: TraceActionRecord[] = [];
  private lastInvariantResult: InvariantValidationResult = { valid: true, violations: [] };

  constructor(initialState: ClusterState, initialActions: ScheduledAction[] = []) {
    this.initialState = structuredClone(initialState);
    this.initialActions = structuredClone(initialActions);
    this.state = structuredClone(initialState);
    this.eventIdGenerator = new IdGenerator(nextAvailableId(initialState.events.map((event) => event.id), "event"));
    this.messageIdGenerator = new IdGenerator(nextAvailableId(initialState.messages.map((message) => message.id), "message"));
    this.actionIdGenerator = new IdGenerator(nextAvailableId(initialActions.map((action) => action.id), "action"));
    this.messageQueue = new MessageQueue(this.state.messages);
    this.registerHandler("engine_demo_tick", createEngineDemoTickHandler());
    this.restoreInitialActions();
    this.lastInvariantResult = this.validateInvariants();
  }

  getState(): ClusterState {
    return structuredClone(this.state);
  }

  getPendingActions(): ScheduledAction[] {
    return this.eventQueue.toArray();
  }

  getInitialState(): ClusterState {
    return structuredClone(this.initialState);
  }

  getInitialActions(): ScheduledAction[] {
    return structuredClone(this.initialActions);
  }

  getActionHistory(): TraceActionRecord[] {
    return structuredClone(this.actionHistory);
  }

  getHistoryState(step: number): ClusterState {
    if (!Number.isInteger(step) || step < 0 || step > this.actionHistory.length) {
      throw new Error(`History step must be between 0 and ${this.actionHistory.length}.`);
    }
    return step === 0
      ? this.getInitialState()
      : structuredClone(this.actionHistory[step - 1].stateAfter);
  }

  validateInvariants(): InvariantValidationResult {
    const stateResult = validateClusterInvariants(this.state);
    const actionResult = validateScheduledActions(this.getPendingActions());
    const violations = [...stateResult.violations, ...actionResult.violations];
    return { valid: !violations.some((violation) => violation.severity === "error"), violations };
  }

  getLastInvariantResult(): InvariantValidationResult {
    return structuredClone(this.lastInvariantResult);
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

    const stateBefore = this.getState();
    const messagesBefore = new Map(stateBefore.messages.map((message) => [message.id, JSON.stringify(message)]));
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

    const stateAfter = this.getState();
    this.actionHistory.push({
      order: this.actionHistory.length + 1,
      action: structuredClone(action),
      logicalTimeBefore: stateBefore.logicalTime,
      logicalTimeAfter: stateAfter.logicalTime,
      stateBefore,
      stateAfter,
      emittedEventIds: emittedEvents.map((event) => event.id),
      affectedMessageIds: stateAfter.messages
        .filter((message) => messagesBefore.get(message.id) !== JSON.stringify(message))
        .map((message) => message.id),
    });
    this.lastInvariantResult = this.validateInvariants();

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
    this.actionHistory = [];
    this.restoreInitialActions();
    this.lastInvariantResult = this.validateInvariants();
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

function nextAvailableId(ids: string[], prefix: string): number {
  return ids.reduce((nextValue, id) => {
    const match = new RegExp(`^${prefix}-(\\d+)$`).exec(id);
    return match ? Math.max(nextValue, Number(match[1]) + 1) : nextValue;
  }, 1);
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
