import type { SimulationTrace } from "./types";

export function serializeTrace(trace: SimulationTrace): string {
  return JSON.stringify(trace, null, 2);
}
