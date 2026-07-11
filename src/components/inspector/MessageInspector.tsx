import {
  isAppendEntriesMessage,
  isAppendEntriesResponseMessage,
  isHeartbeatMessage,
  isRequestVoteMessage,
  isRequestVoteResponseMessage,
} from "../../simulator/messageTypes";
import {
  formatDropReason,
  formatPartitionLabel,
} from "../../simulator/network/topology";
import type { ClusterState, RaftMessage } from "../../simulator/types";
import { getMessageDisplayName } from "../cluster/messageDisplay";
import styles from "./MessageInspector.module.css";

interface MessageInspectorProps {
  message: RaftMessage | null;
  clusterState: ClusterState;
}

export function MessageInspector({ message, clusterState }: MessageInspectorProps) {
  if (!message) {
    return <p className={styles.empty}>Select an RPC message to inspect its fields.</p>;
  }

  const fromNode = clusterState.nodes[message.from];
  const toNode = clusterState.nodes[message.to];

  return (
    <div className={styles.messageInspector}>
      <dl className={styles.fields}>
        <div><dt>Message Type</dt><dd>{message.type}</dd></div>
        <div><dt>Display Name</dt><dd>{getMessageDisplayName(message)}</dd></div>
        <div><dt>From</dt><dd>Node {message.from}</dd></div>
        <div><dt>From Group</dt><dd>{formatPartitionLabel(fromNode?.partitionId ?? null)}</dd></div>
        <div><dt>To</dt><dd>Node {message.to}</dd></div>
        <div><dt>To Group</dt><dd>{formatPartitionLabel(toNode?.partitionId ?? null)}</dd></div>
        <div><dt>Term</dt><dd>{message.term}</dd></div>
        <div><dt>Status</dt><dd>{message.status}</dd></div>
        <div><dt>Created At</dt><dd>{formatTime(message.createdAtLogicalTime)}</dd></div>
        <div><dt>Delivered At</dt><dd>{formatTime(message.deliveredAtLogicalTime)}</dd></div>
        <div><dt>Dropped At</dt><dd>{formatTime(message.droppedAtLogicalTime)}</dd></div>
        <div><dt>Drop Reason</dt><dd>{formatDropReason(message.dropReason)}</dd></div>
      </dl>

      {message.dropReason === "network_partition" ? (
        <p className={styles.note}>
          The target node is running, but the simulated network partition prevents communication between the two groups.
        </p>
      ) : null}

      <div className={styles.payload}>
        <h3>Payload</h3>
        {renderPayload(message)}
      </div>
    </div>
  );
}

function renderPayload(message: RaftMessage) {
  if (isRequestVoteMessage(message)) {
    return (
      <dl className={styles.fields}>
        <div><dt>term</dt><dd>{message.payload.term}</dd></div>
        <div><dt>candidateId</dt><dd>{message.payload.candidateId}</dd></div>
        <div><dt>lastLogIndex</dt><dd>{message.payload.lastLogIndex}</dd></div>
        <div><dt>lastLogTerm</dt><dd>{message.payload.lastLogTerm}</dd></div>
      </dl>
    );
  }

  if (isRequestVoteResponseMessage(message)) {
    return (
      <dl className={styles.fields}>
        <div><dt>term</dt><dd>{message.payload.term}</dd></div>
        <div><dt>voterId</dt><dd>{message.payload.voterId}</dd></div>
        <div><dt>voteGranted</dt><dd>{String(message.payload.voteGranted)}</dd></div>
      </dl>
    );
  }

  if (isAppendEntriesMessage(message)) {
    return (
      <>
        {isHeartbeatMessage(message) ? (
          <p className={styles.note}>
            A heartbeat is an AppendEntries RPC with no new log entries.
          </p>
        ) : null}
        <dl className={styles.fields}>
          <div><dt>Protocol RPC</dt><dd>AppendEntries</dd></div>
          <div><dt>Purpose</dt><dd>{message.payload.purpose}</dd></div>
          <div><dt>Attempt</dt><dd>{message.payload.attempt ?? "None"}</dd></div>
          <div><dt>term</dt><dd>{message.payload.term}</dd></div>
          <div><dt>leaderId</dt><dd>{message.payload.leaderId}</dd></div>
          <div><dt>prevLogIndex</dt><dd>{message.payload.prevLogIndex}</dd></div>
          <div><dt>prevLogTerm</dt><dd>{message.payload.prevLogTerm}</dd></div>
          <div><dt>entries</dt><dd>{message.payload.entries.length === 0 ? "Empty []" : message.payload.entries.length}</dd></div>
          <div><dt>leaderCommit</dt><dd>{message.payload.leaderCommit}</dd></div>
        </dl>
        {message.payload.entries.length > 0 ? (
          <div className={styles.entries}>
            {message.payload.entries.map((entry, index) => (
              <div key={index} className={styles.entry}>
                <span>Index {"index" in Object(entry) ? String(Object(entry).index) : "?"}</span>
                <span>Term {"term" in Object(entry) ? String(Object(entry).term) : "?"}</span>
                <span>{"command" in Object(entry) ? String(Object(entry).command) : "Unknown command"}</span>
              </div>
            ))}
          </div>
        ) : null}
      </>
    );
  }

  if (isAppendEntriesResponseMessage(message)) {
    return (
      <dl className={styles.fields}>
        <div><dt>term</dt><dd>{message.payload.term}</dd></div>
        <div><dt>followerId</dt><dd>{message.payload.followerId}</dd></div>
        <div><dt>success</dt><dd>{String(message.payload.success)}</dd></div>
        <div><dt>matchIndex</dt><dd>{message.payload.matchIndex}</dd></div>
        <div><dt>rejectedNextIndex</dt><dd>{message.payload.rejectedNextIndex ?? "None"}</dd></div>
        <div><dt>conflictIndex</dt><dd>{message.payload.conflictIndex ?? "None"}</dd></div>
        <div><dt>conflictTerm</dt><dd>{message.payload.conflictTerm ?? "None"}</dd></div>
        <div><dt>attempt</dt><dd>{message.payload.attempt ?? "None"}</dd></div>
      </dl>
    );
  }

  return <p className={styles.empty}>Unknown payload shape.</p>;
}

function formatTime(value: number | undefined): string {
  return value === undefined ? "Not yet" : `T+${value} ms`;
}
