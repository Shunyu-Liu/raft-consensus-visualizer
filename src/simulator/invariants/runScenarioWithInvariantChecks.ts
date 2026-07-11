import { formatInvariantErrors } from "./validateClusterInvariants";
import type { ScenarioDefinition } from "../scenarios/types";
import type { ClusterState } from "../types";
import type { InvariantValidationResult } from "./types";

export interface ScenarioInvariantAuditResult {
  scenarioId: string;
  executedActions: number;
  valid: true;
}

export function runScenarioWithInvariantChecks(scenario: ScenarioDefinition): ScenarioInvariantAuditResult {
  const simulator = scenario.createSimulator();
  assertValid(simulator.getState(), simulator.validateInvariants());
  let executedActions = 0;
  while (simulator.hasPendingActions()) {
    simulator.step();
    executedActions += 1;
    if (executedActions > 500) throw new Error(`Scenario ${scenario.id} exceeded the 500 action audit limit.`);
    assertValid(simulator.getState(), simulator.getLastInvariantResult());
  }
  return { scenarioId: scenario.id, executedActions, valid: true };
}

function assertValid(
  state: ClusterState,
  result: InvariantValidationResult,
): void {
  if (!result.valid) throw new Error(formatInvariantErrors(result, state));
}
