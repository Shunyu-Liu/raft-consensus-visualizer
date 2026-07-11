import type { NodeId } from "../types";

export type InvariantSeverity = "error" | "warning";

export interface InvariantViolation {
  id: string;
  severity: InvariantSeverity;
  title: string;
  description: string;
  nodeIds?: NodeId[];
  term?: number;
  logIndex?: number;
}

export interface InvariantValidationResult {
  valid: boolean;
  violations: InvariantViolation[];
}
