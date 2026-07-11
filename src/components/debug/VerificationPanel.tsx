import { useState, type ChangeEvent } from "react";
import type { InvariantValidationResult } from "../../simulator/invariants/types";
import { getTraceFileName } from "../../simulator/trace/createSimulationTrace";
import { parseTraceJson } from "../../simulator/trace/parseTrace";
import { serializeTrace } from "../../simulator/trace/serializeTrace";
import { MAX_TRACE_FILE_SIZE_BYTES } from "../../simulator/trace/validateTrace";
import type { RaftStateChange } from "../../simulator/trace/compareStates";
import type { SimulationTrace } from "../../simulator/trace/types";
import type { SimulatorUIState } from "../../simulator/types";
import styles from "./VerificationPanel.module.css";

interface OperationResult { accepted: boolean; reason?: string }

interface VerificationPanelProps {
  invariantResult: InvariantValidationResult;
  displayMode: SimulatorUIState["displayMode"];
  isInspectingHistory: boolean;
  selectedHistoryStep: number;
  historyStepCount: number;
  stateComparison: RaftStateChange[];
  onCreateTrace: () => SimulationTrace;
  onLoadTrace: (trace: SimulationTrace) => OperationResult;
  onReplay: () => OperationResult;
  onViewStep: (step: number) => void;
  onReturnToLive: () => void;
}

export function VerificationPanel(props: VerificationPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trace = props.onCreateTrace();
  const traceSize = new Blob([serializeTrace(trace)]).size;
  const status = props.invariantResult.valid ? "Passed" : "Error";

  function exportTrace() {
    const json = serializeTrace(trace);
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = getTraceFileName(trace);
    link.click();
    URL.revokeObjectURL(url);
    setError(null);
    setMessage(`Trace exported at action step ${trace.executedActions.length}.`);
  }

  async function importTrace(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (file.size > MAX_TRACE_FILE_SIZE_BYTES) {
      setMessage(null);
      setError("The selected trace file is too large. The maximum supported size is 10 MB.");
      return;
    }
    const validation = parseTraceJson(await file.text());
    if (!validation.valid || !validation.trace) {
      setMessage(null);
      setError(validation.message ?? "Trace validation failed.");
      return;
    }
    const loaded = props.onLoadTrace(validation.trace);
    if (!loaded.accepted) {
      setMessage(null);
      setError(loaded.reason ?? "Trace replay failed.");
      return;
    }
    setError(null);
    setMessage(`Imported and replayed ${file.name}.`);
  }

  function replay() {
    const result = props.onReplay();
    if (!result.accepted) {
      setMessage(null);
      setError(result.reason ?? "Trace replay failed.");
      return;
    }
    setError(null);
    setMessage("Trace replay matched the recorded final state.");
  }

  return (
    <section className={styles.panel} aria-labelledby="verification-title">
      <div className={styles.header}>
        <div>
          <h2 id="verification-title">Verification &amp; Replay</h2>
          <p>Runtime invariant checking and reproducible action history</p>
        </div>
        <strong className={styles.status} data-status={status.toLowerCase()}>
          Verification: {status}
        </strong>
      </div>

      <div className={styles.toolbar}>
        <button type="button" onClick={exportTrace}>Export Trace</button>
        <label className={styles.importLabel}>
          Import Trace
          <input type="file" accept="application/json,.json" onChange={importTrace} />
        </label>
        <button type="button" onClick={replay}>Replay Trace</button>
        <span>Trace size: {formatBytes(traceSize)}</span>
      </div>

      <div className={styles.history}>
        <button type="button" aria-label="Jump to start" onClick={() => props.onViewStep(0)} disabled={props.selectedHistoryStep === 0}>|&lt;</button>
        <button type="button" aria-label="Previous action step" onClick={() => props.onViewStep(props.selectedHistoryStep - 1)} disabled={props.selectedHistoryStep === 0}>&lt;</button>
        <label>
          Current Action Step
          <input
            type="range"
            min="0"
            max={Math.max(0, props.historyStepCount)}
            value={props.selectedHistoryStep}
            onChange={(event) => props.onViewStep(Number(event.currentTarget.value))}
          />
        </label>
        <button type="button" aria-label="Next action step" onClick={() => props.onViewStep(props.selectedHistoryStep + 1)} disabled={props.selectedHistoryStep >= props.historyStepCount}>&gt;</button>
        <button type="button" aria-label="Jump to end" onClick={() => props.onViewStep(props.historyStepCount)} disabled={props.selectedHistoryStep >= props.historyStepCount}>&gt;|</button>
        <output>Action Step: {props.selectedHistoryStep} / {props.historyStepCount}</output>
      </div>

      {props.isInspectingHistory ? (
        <div className={styles.historyNotice}>
          <strong>Viewing history</strong>
          <span>Step {props.selectedHistoryStep} of {props.historyStepCount}. Mutations are disabled.</span>
          <button type="button" onClick={props.onReturnToLive}>Return to Live State</button>
        </div>
      ) : null}

      {props.displayMode === "advanced" ? (
        <div className={styles.details}>
          <div>
            <h3>Invariant Status</h3>
            {props.invariantResult.violations.length === 0 ? <p>All protocol invariants currently pass.</p> : (
              <ul>{props.invariantResult.violations.map((violation, index) => (
                <li key={`${violation.id}-${index}`}>
                  <strong>{violation.severity}: {violation.title}</strong>
                  <span>{violation.description}</span>
                  <small>{[violation.nodeIds?.join(", "), violation.term === undefined ? null : `Term ${violation.term}`, violation.logIndex === undefined ? null : `Log ${violation.logIndex}`].filter(Boolean).join(" · ")}</small>
                </li>
              ))}</ul>
            )}
          </div>
          <div>
            <h3>Changes from Previous Action</h3>
            {props.stateComparison.length === 0 ? <p>No Raft state changes.</p> : (
              <ul>{props.stateComparison.slice(0, 20).map((change, index) => (
                <li key={`${change.nodeId ?? "message"}-${change.field}-${index}`}>
                  {change.nodeId ? `Node ${change.nodeId} ` : ""}{change.field}: {String(change.before)} → {String(change.after)}
                </li>
              ))}</ul>
            )}
          </div>
        </div>
      ) : null}

      {message ? <p className={styles.message} role="status">{message}</p> : null}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </section>
  );
}

function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}
