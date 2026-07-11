import {
  areNodesConnected,
  formatPartitionLabel,
  getPartitionGroups,
  isNetworkPartitionActive,
  type NetworkOperationResult,
} from "../../simulator/network/topology";
import type { ClusterState } from "../../simulator/types";
import styles from "./NetworkStatusPanel.module.css";

interface NetworkStatusPanelProps {
  clusterState: ClusterState;
  canControl: boolean;
  onCreatePartition: () => NetworkOperationResult;
  onHealNetwork: () => NetworkOperationResult;
}

const PRESET_LEFT = ["A", "B"];
const PRESET_RIGHT = ["C", "D", "E"];

export function NetworkStatusPanel({
  clusterState,
  canControl,
  onCreatePartition,
  onHealNetwork,
}: NetworkStatusPanelProps) {
  const active = isNetworkPartitionActive(clusterState);
  const groups = getPartitionGroups(clusterState);
  const clusterSize = Object.keys(clusterState.nodes).length;
  const majority = Math.floor(clusterSize / 2) + 1;
  const selectedNode = clusterState.nodes.B;
  const reachableFromB = selectedNode
    ? Object.keys(clusterState.nodes).filter((nodeId) =>
        areNodesConnected(clusterState, selectedNode.id, nodeId),
      )
    : [];

  return (
    <section className={styles.panel} aria-labelledby="network-title">
      <div className={styles.header}>
        <div>
          <h2 id="network-title">Network Topology</h2>
          <p>{active ? "Partitioned" : "Fully Connected"}</p>
        </div>
        <span className={styles.badge}>{clusterSize} nodes · majority {majority}</span>
      </div>

      <div className={styles.groups}>
        {active ? (
          groups.map((group) => (
            <div key={group.id} className={styles.group}>
              <span>{group.label}</span>
              <strong>{group.nodeIds.map((nodeId) => `Node ${nodeId}`).join(", ")}</strong>
            </div>
          ))
        ) : (
          <div className={styles.group}>
            <span>Connectivity</span>
            <strong>All nodes can communicate</strong>
          </div>
        )}
        <div className={styles.group}>
          <span>Reachable from Node B</span>
          <strong>{reachableFromB.map((nodeId) => `Node ${nodeId}`).join(", ")}</strong>
        </div>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          onClick={onCreatePartition}
          disabled={!canControl || active}
          title={`${PRESET_LEFT.join(" + ")} | ${PRESET_RIGHT.join(" + ")}`}
        >
          Create Partition
        </button>
        <button
          type="button"
          onClick={onHealNetwork}
          disabled={!canControl || !active}
        >
          Heal Network
        </button>
      </div>

      <p className={styles.rule}>
        Commit majority remains {majority} of {clusterSize}; partition groups do not change Raft membership.
      </p>

      {active ? (
        <p className={styles.rule}>
          Node B is in {formatPartitionLabel(clusterState.nodes.B.partitionId)}; Node C is in {formatPartitionLabel(clusterState.nodes.C.partitionId)}.
        </p>
      ) : null}
    </section>
  );
}
