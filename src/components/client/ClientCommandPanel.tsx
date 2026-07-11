import { useState } from "react";
import type { SimulatorControlState } from "../../simulator/types";
import type { ClientCommandSubmissionResult } from "../../simulator/transitions/replication";
import styles from "./ClientCommandPanel.module.css";

interface ClientCommandPanelProps {
  canSubmit: boolean;
  playbackStatus: SimulatorControlState["playbackStatus"];
  onSubmitCommand: (command: string) => ClientCommandSubmissionResult;
}

export function ClientCommandPanel({
  canSubmit,
  playbackStatus,
  onSubmitCommand,
}: ClientCommandPanelProps) {
  const [command, setCommand] = useState("SET x = 10");
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    const result = onSubmitCommand(command);
    if (!result.accepted) {
      setMessage(result.reason ?? "Command was rejected.");
      return;
    }

    setMessage("Command accepted. Use Next Step or Start to replicate it.");
  }

  return (
    <section className={styles.panel} aria-labelledby="client-command-title">
      <div>
        <h2 id="client-command-title">Client Command</h2>
        <p>Commands are appended to the leader's log before being replicated to followers.</p>
      </div>
      <div className={styles.controls}>
        <label>
          Client command
          <input
            value={command}
            maxLength={100}
            onChange={(event) => setCommand(event.currentTarget.value)}
            placeholder="SET x = 10"
            disabled={!canSubmit}
          />
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={!canSubmit || playbackStatus === "running"}
        >
          Submit to Leader
        </button>
      </div>
      {message ? <p className={styles.message}>{message}</p> : null}
    </section>
  );
}
