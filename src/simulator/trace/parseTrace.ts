import type { TraceValidationResult } from "./validateTrace";
import { validateTrace } from "./validateTrace";

export function parseTraceJson(json: string): TraceValidationResult {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { valid: false, code: "invalid-json", message: "The selected file is not valid JSON." };
  }
  return validateTrace(value);
}
