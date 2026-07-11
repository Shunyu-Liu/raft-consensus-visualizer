import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatPartitionLabel,
  getPartitionGroups,
  isNetworkPartitionActive,
} from "../../simulator/network/topology";
import type { MessageId, NodeId, RaftMessage, RaftNode } from "../../simulator/types";
import { MessageLayer, type NodePosition } from "./MessageLayer";
import { NodeCard } from "./NodeCard";
import styles from "./ClusterView.module.css";

interface ClusterViewProps {
  nodes: Record<NodeId, RaftNode>;
  messages: RaftMessage[];
  selectedNodeId: NodeId | null;
  selectedMessageId: MessageId | null;
  onSelectNode: (nodeId: NodeId) => void;
  onSelectMessage: (messageId: MessageId) => void;
}

const NODE_ORDER: NodeId[] = ["A", "B", "C", "D", "E"];

export function ClusterView({
  nodes,
  messages,
  selectedNodeId,
  selectedMessageId,
  onSelectNode,
  onSelectMessage,
}: ClusterViewProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const nodeRefs = useRef<Record<NodeId, HTMLButtonElement | null>>({});
  const [positions, setPositions] = useState<Record<NodeId, NodePosition>>({});
  const partitionActive = isNetworkPartitionActive({ nodes, messages: [], events: [], currentStep: 0, logicalTime: 0 });
  const groups = getPartitionGroups({ nodes, messages: [], events: [], currentStep: 0, logicalTime: 0 });

  const measurePositions = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) {
      return;
    }

    const panelRect = panel.getBoundingClientRect();
    const nextPositions: Record<NodeId, NodePosition> = {};

    for (const nodeId of NODE_ORDER) {
      const element = nodeRefs.current[nodeId];
      if (!element) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      nextPositions[nodeId] = {
        x: rect.left - panelRect.left + rect.width / 2,
        y: rect.top - panelRect.top + rect.height / 2,
      };
    }

    setPositions(nextPositions);
  }, []);

  useEffect(() => {
    measurePositions();
    const observer = new ResizeObserver(measurePositions);
    if (panelRef.current) {
      observer.observe(panelRef.current);
    }

    return () => observer.disconnect();
  }, [measurePositions, nodes, messages]);

  return (
    <section ref={panelRef} className={styles.clusterPanel} aria-labelledby="cluster-title">
      <div className={styles.panelHeader}>
        <div>
          <h2 id="cluster-title">Raft Cluster Visualization</h2>
          <p>Basic Leader Election scenario. Use Next Step or Start to run it.</p>
        </div>
        <span className={styles.badge}>5 nodes</span>
      </div>

      <div className={styles.clusterGrid} data-partitioned={partitionActive}>
        {groups.map((group) => (
          <div
            key={group.id}
            className={styles.partitionGroup}
            data-group={group.id}
            aria-hidden="true"
          >
            <span>{formatPartitionLabel(group.id)}</span>
          </div>
        ))}
        {NODE_ORDER.map((nodeId) => (
          <NodeCard
            ref={(element) => {
              nodeRefs.current[nodeId] = element;
            }}
            key={nodeId}
            node={nodes[nodeId]}
            isSelected={selectedNodeId === nodeId}
            gridArea={`node${nodeId}`}
            onSelect={() => onSelectNode(nodeId)}
          />
        ))}
      </div>

      <MessageLayer
        messages={messages}
        nodePositions={positions}
        selectedMessageId={selectedMessageId}
        onSelectMessage={onSelectMessage}
      />
    </section>
  );
}
