import { useCallback, useEffect, useRef, useState } from "react";
import { formatPartitionLabel, getPartitionGroups, isNetworkPartitionActive } from "../../simulator/network/topology";
import type { MessageDisplayMode, MessageId, NodeId, RaftMessage, RaftNode } from "../../simulator/types";
import type { TraceActionRecord } from "../../simulator/trace/types";
import { MessageLayer } from "./MessageLayer";
import { type MessageActivityFrame } from "./messageActivity";
import { type NodeBounds } from "./messageRouting";
import { getVisibleMessages } from "./messageVisibility";
import { NodeCard } from "./NodeCard";
import styles from "./ClusterView.module.css";

interface ClusterViewProps {
  nodes: Record<NodeId, RaftNode>;
  messages: RaftMessage[];
  selectedNodeId: NodeId | null;
  selectedMessageId: MessageId | null;
  pinnedMessageId: MessageId | null;
  messageDisplayMode: MessageDisplayMode;
  currentActionStep: number;
  actionHistory: TraceActionRecord[];
  activityFrames: MessageActivityFrame[];
  onMessageDisplayModeChange: (mode: MessageDisplayMode) => void;
  onSelectNode: (nodeId: NodeId) => void;
  onSelectMessage: (messageId: MessageId) => void;
}

const NODE_ORDER: NodeId[] = ["A", "B", "C", "D", "E"];

export function ClusterView({ nodes, messages, selectedNodeId, selectedMessageId, pinnedMessageId, messageDisplayMode, currentActionStep, actionHistory, activityFrames, onMessageDisplayModeChange, onSelectNode, onSelectMessage }: ClusterViewProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const nodeRefs = useRef<Record<NodeId, HTMLButtonElement | null>>({});
  const [bounds, setBounds] = useState<Record<NodeId, NodeBounds>>({});
  const measure = useCallback(() => {
    const panel = panelRef.current; if (!panel) return;
    const panelRect = panel.getBoundingClientRect();
    const next: Record<NodeId, NodeBounds> = {};
    for (const nodeId of NODE_ORDER) {
      const element = nodeRefs.current[nodeId]; if (!element) continue;
      const rect = element.getBoundingClientRect();
      next[nodeId] = { centerX: rect.left - panelRect.left + rect.width / 2, centerY: rect.top - panelRect.top + rect.height / 2, width: rect.width, height: rect.height };
    }
    setBounds(next);
  }, []);
  useEffect(() => { measure(); const observer = new ResizeObserver(measure); if (panelRef.current) observer.observe(panelRef.current); return () => observer.disconnect(); }, [measure, nodes, messages]);
  const clusterState = { nodes, messages, events: [], currentStep: 0, logicalTime: 0 } as Parameters<typeof getPartitionGroups>[0];
  const groups = getPartitionGroups(clusterState);
  const currentAction = actionHistory[currentActionStep - 1];
  const summary = currentAction ? getCurrentActionSummary(currentAction.action, messages) : "Initial cluster state";
  const visibleCount = getVisibleMessages(messages, messageDisplayMode, currentActionStep, activityFrames, pinnedMessageId).length;
  const noRpc = currentActionStep > 0 && (activityFrames[currentActionStep - 1]?.messageIds.length ?? 0) === 0;

  return <section ref={panelRef} className={styles.clusterPanel} aria-labelledby="cluster-title">
    <div className={styles.panelHeader}>
      <div><h2 id="cluster-title">Raft Cluster</h2><p data-testid="action-summary">Step {currentActionStep} · {summary}</p>{noRpc ? <p className={styles.noRpc}>No RPC in this action</p> : null}</div>
      <div className={styles.messageControls} aria-label="Messages" role="radiogroup"><span>Messages</span>{(["focus", "context", "all"] as const).map((mode) => <button key={mode} type="button" role="radio" aria-checked={messageDisplayMode === mode} aria-label={mode === "focus" ? "Show messages from the current action" : mode === "context" ? "Show messages from the last three actions" : "Show all messages in the current snapshot"} onClick={() => onMessageDisplayModeChange(mode)}>{mode[0].toUpperCase() + mode.slice(1)}</button>)}<small data-testid="visible-message-count" data-visible-message-count={visibleCount}>{visibleCount} shown · {messages.length} total</small></div>
    </div>
    <div className={styles.clusterGrid} data-partitioned={isNetworkPartitionActive(clusterState)}>
      {groups.map((group) => <div key={group.id} className={styles.partitionGroup} data-group={group.id} aria-hidden="true"><span>{formatPartitionLabel(group.id)}</span></div>)}
      {NODE_ORDER.map((nodeId) => <NodeCard ref={(element) => { nodeRefs.current[nodeId] = element; }} key={nodeId} node={nodes[nodeId]} isSelected={selectedNodeId === nodeId} gridArea={`node${nodeId}`} onSelect={() => onSelectNode(nodeId)} />)}
    </div>
    <MessageLayer messages={messages} nodeBounds={bounds} selectedMessageId={selectedMessageId} pinnedMessageId={pinnedMessageId} displayMode={messageDisplayMode} currentActionStep={currentActionStep} activityFrames={activityFrames} onSelectMessage={onSelectMessage} />
  </section>;
}

function getCurrentActionSummary(action: TraceActionRecord["action"], messages: RaftMessage[]): string {
  const payload = action.payload as Record<string, unknown>;
  const message = typeof payload.messageId === "string" ? messages.find((candidate) => candidate.id === payload.messageId) : undefined;
  const source = message ? `${message.from} → ${message.to}` : typeof payload.nodeId === "string" ? `Node ${payload.nodeId}` : "";
  const labels: Record<string, string> = { election_timeout: "election timeout", send_request_vote: "Send RequestVote", deliver_request_vote: "Deliver RequestVote", deliver_request_vote_response: "Deliver RequestVote response", deliver_append_entries: "Deliver AppendEntries", deliver_append_entries_response: "Deliver AppendEntries response", client_command_received: "Client command received", create_network_partition: "Create network partition", heal_network_partition: "Heal network partition" };
  return `${labels[action.type] ?? action.type.split("_").join(" ")}${source ? ` · ${source}` : ""}`;
}
