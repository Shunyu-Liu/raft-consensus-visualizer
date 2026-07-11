import { forwardRef } from "react";
import { formatPartitionLabel } from "../../simulator/network/topology";
import type { RaftNode } from "../../simulator/types";
import styles from "./NodeCard.module.css";

interface NodeCardProps {
  node: RaftNode;
  isSelected: boolean;
  gridArea: string;
  onSelect: () => void;
}

const roleSymbol: Record<RaftNode["role"], string> = {
  follower: "F",
  candidate: "C",
  leader: "L",
};

export const NodeCard = forwardRef<HTMLButtonElement, NodeCardProps>(function NodeCard(
  { node, isSelected, gridArea, onSelect },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      className={styles.card}
      data-role={node.role}
      data-status={node.status}
      data-selected={isSelected}
      style={{ gridArea }}
      onClick={onSelect}
    >
      <div className={styles.header}>
        <span className={styles.nodeName}>Node {node.id}</span>
        <div className={styles.pills}>
          {node.partitionId ? (
            <span className={styles.groupPill}>{formatPartitionLabel(node.partitionId)}</span>
          ) : null}
          <span className={styles.rolePill}>
            <span className={styles.roleIcon}>{roleSymbol[node.role]}</span>
            {node.role}
          </span>
        </div>
      </div>

      <dl className={styles.metrics}>
        <div>
          <dt>Status</dt>
          <dd>{node.status}</dd>
        </div>
        <div>
          <dt>Current Term</dt>
          <dd>{node.currentTerm}</dd>
        </div>
        <div>
          <dt>Voted For</dt>
          <dd>{node.votedFor ? `Node ${node.votedFor}` : "None"}</dd>
        </div>
        <div>
          <dt>Commit Index</dt>
          <dd>{node.commitIndex}</dd>
        </div>
        <div>
          <dt>Last Applied</dt>
          <dd>{node.lastApplied}</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>{formatPartitionLabel(node.partitionId)}</dd>
        </div>
        {node.lastHeartbeatReceivedAt !== undefined ? (
          <div>
            <dt>Heartbeat</dt>
            <dd>T+{node.lastHeartbeatReceivedAt}</dd>
          </div>
        ) : null}
        {node.heartbeatRoundsSent !== undefined ? (
          <div>
            <dt>HB Round</dt>
            <dd>{node.heartbeatRoundsSent} / 2</dd>
          </div>
        ) : null}
        {node.votesReceived ? (
          <div>
            <dt>Votes</dt>
            <dd>{node.votesReceived.join(", ")}</dd>
          </div>
        ) : null}
      </dl>

      <div className={styles.logStrip} aria-label={`Node ${node.id} log`}>
        {node.log.length === 0 ? (
          <span className={styles.emptyLog}>Log is empty</span>
        ) : (
          node.log.map((entry) => (
            <span
              key={entry.index}
              className={styles.logEntry}
              data-status={entry.applied ? "applied" : entry.committed ? "committed" : "uncommitted"}
              title={`${entry.command} · ${entry.applied ? "Applied" : entry.committed ? "Committed" : "Uncommitted"}`}
            >
              {entry.index}
            </span>
          ))
        )}
      </div>
    </button>
  );
});
