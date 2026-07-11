import { useState } from "react";
import { areNodesConnected } from "../../simulator/network/topology";
import type { ClusterState, LogEntry, NodeId, RaftNode, SimulatorUIState } from "../../simulator/types";
import type { NodeOperationResult } from "../../simulator/transitions/failure";
import { getMessageDisplayName } from "../cluster/messageDisplay";
import { getVisibleMessageIds } from "../cluster/messageVisibility";
import type { MessageActivityFrame } from "../cluster/messageActivity";
import { MessageInspector } from "./MessageInspector";
import styles from "./Inspector.module.css";

type InspectorTab = "explanation" | "message" | "node" | "logs";

interface InspectorProps {
  clusterState: ClusterState;
  selectedNodeId: NodeId | null;
  selectedMessageId: string | null;
  displayMode: SimulatorUIState["displayMode"];
  scenarioDescription: string;
  onSelectMessage: (messageId: string) => void;
  pinnedMessageId: string | null;
  onPinMessage: (messageId: string | null) => void;
  messageDisplayMode: SimulatorUIState["messageDisplayMode"];
  currentActionStep: number;
  activityFrames: MessageActivityFrame[];
  onCrashNode: (nodeId: NodeId) => NodeOperationResult;
  onRestartNode: (nodeId: NodeId) => NodeOperationResult;
  mutationsDisabled?: boolean;
}

export function Inspector({
  clusterState,
  selectedNodeId,
  selectedMessageId,
  displayMode,
  scenarioDescription,
  onSelectMessage,
  pinnedMessageId,
  onPinMessage,
  messageDisplayMode,
  currentActionStep,
  activityFrames,
  onCrashNode,
  onRestartNode,
  mutationsDisabled = false,
}: InspectorProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>("explanation");
  const selectedNode = selectedNodeId ? clusterState.nodes[selectedNodeId] : null;
  const selectedMessage = selectedMessageId
    ? clusterState.messages.find((message) => message.id === selectedMessageId) ?? null
    : null;
  const latestEvent = clusterState.events[clusterState.events.length - 1];
  const requiredVotes = Math.floor(Object.keys(clusterState.nodes).length / 2) + 1;
  const reachableNodes = selectedNode
    ? Object.values(clusterState.nodes)
        .filter((node) => areNodesConnected(clusterState, selectedNode.id, node.id))
        .map((node) => node.id)
    : [];
  const unreachableNodes = selectedNode
    ? Object.values(clusterState.nodes)
        .filter((node) => !areNodesConnected(clusterState, selectedNode.id, node.id))
        .map((node) => node.id)
    : [];

  return (
    <aside className={styles.inspector}>
      <div className={styles.tabs} role="tablist" aria-label="Inspector sections">
        {inspectorTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`inspector-${tab.id}`}
            id={`inspector-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "explanation" ? (
      <section
        className={styles.panel}
        id="inspector-explanation"
        role="tabpanel"
        aria-labelledby="inspector-tab-explanation"
      >
        <h2>Teaching Explanation</h2>
        <p className={styles.kicker}>Current scenario</p>
        <h3>{latestEvent?.title ?? "Basic Leader Election"}</h3>
        <dl className={styles.explanationList}>
          <div>
            <dt>What happened?</dt>
            <dd>{latestEvent?.description ?? scenarioDescription}</dd>
          </div>
          <div>
            <dt>Why did it happen?</dt>
            <dd>
              {latestEvent?.explanation ??
                "Node B has the earliest deterministic election timeout. Start the simulation or execute the next step to observe how it requests votes."}
            </dd>
          </div>
          <div>
            <dt>Raft rule</dt>
            <dd>{latestEvent?.raftRule ?? "Leader election starts after an election timeout."}</dd>
          </div>
          <div>
            <dt>Related section</dt>
            <dd>{latestEvent?.paperSection ?? "Section 5.2 — Leader Election"}</dd>
          </div>
        </dl>
      </section>
      ) : null}

      {activeTab === "message" ? (
      <section
        className={styles.panel}
        id="inspector-message"
        role="tabpanel"
        aria-labelledby="inspector-tab-message"
      >
        <h2>Message Inspector</h2>
        <MessageInspector message={selectedMessage} clusterState={clusterState} />
        {selectedMessage ? (() => {
          const visible = getVisibleMessageIds(clusterState.messages, messageDisplayMode, currentActionStep, activityFrames, null).has(selectedMessage.id);
          const hiddenCopy = messageDisplayMode === "focus"
            ? "This message is outside the current Focus view."
            : messageDisplayMode === "context"
              ? "This message is outside the current Context view."
              : "This message is not present in the current snapshot.";
          return <>{!visible ? <p className={styles.empty}>{hiddenCopy}</p> : null}<button type="button" onClick={() => onPinMessage(pinnedMessageId === selectedMessage.id ? null : selectedMessage.id)}>{pinnedMessageId === selectedMessage.id ? "Unpin from canvas" : "Pin on canvas"}</button></>;
        })() : null}
      </section>
      ) : null}

      {activeTab === "logs" ? (
      <section
        className={styles.panel}
        id="inspector-logs"
        role="tabpanel"
        aria-labelledby="inspector-tab-logs"
      >
        <h2>Log Comparison</h2>
        <LogComparison clusterState={clusterState} />
      </section>
      ) : null}

      {activeTab === "message" ? (
      <section className={styles.panel}>
        <h2>Messages</h2>
        {clusterState.messages.length === 0 ? (
          <p className={styles.empty}>No RPC messages yet.</p>
        ) : (
          <div className={styles.messageList}>
            {clusterState.messages.slice(-12).reverse().map((message) => (
              <button
                type="button"
                key={message.id}
                className={styles.messageItem}
                data-selected={message.id === selectedMessageId}
                onClick={() => onSelectMessage(message.id)}
              >
                <span>{getMessageDisplayName(message)}</span>
                <small>{message.from} → {message.to} · {message.status}</small>
              </button>
            ))}
          </div>
        )}
      </section>
      ) : null}

      {activeTab === "node" ? (
      <section
        className={styles.panel}
        id="inspector-node"
        role="tabpanel"
        aria-labelledby="inspector-tab-node"
      >
        <h2>Node Inspector</h2>
        {selectedNode ? (
          <>
            <p className={styles.kicker}>Node {selectedNode.id}</p>
            <dl className={styles.nodeDetails}>
              <div><dt>Role</dt><dd>{selectedNode.role}</dd></div>
              <div><dt>Status</dt><dd>{selectedNode.status}</dd></div>
              <div><dt>Current Term</dt><dd>{selectedNode.currentTerm}</dd></div>
              <div><dt>Voted For</dt><dd>{selectedNode.votedFor ?? "None"}</dd></div>
              <div><dt>Commit Index</dt><dd>{selectedNode.commitIndex}</dd></div>
              <div><dt>Last Applied</dt><dd>{selectedNode.lastApplied}</dd></div>
              <div><dt>Election Timeout</dt><dd>{selectedNode.electionTimeout} ms</dd></div>
              <div><dt>Partition</dt><dd>{selectedNode.partitionId ?? "Connected"}</dd></div>
              <div><dt>Can Reach</dt><dd>{reachableNodes.join(", ")}</dd></div>
              {unreachableNodes.length > 0 ? (
                <div><dt>Cannot Reach</dt><dd>{unreachableNodes.join(", ")}</dd></div>
              ) : null}
              {selectedNode.votesReceived ? (
                <>
                  <div><dt>Votes Received</dt><dd>{selectedNode.votesReceived.join(", ")}</dd></div>
                  <div><dt>Vote Count</dt><dd>{selectedNode.votesReceived.length} / {requiredVotes} required</dd></div>
                </>
              ) : null}
            </dl>

            <div className={styles.nodeActions}>
              <button
                type="button"
                onClick={() => onCrashNode(selectedNode.id)}
                disabled={mutationsDisabled || selectedNode.status === "crashed"}
              >
                Crash Node
              </button>
              <button
                type="button"
                onClick={() => onRestartNode(selectedNode.id)}
                disabled={mutationsDisabled || selectedNode.status === "running"}
              >
                Restart Node
              </button>
            </div>

            {selectedNode.role === "leader" && selectedNode.votesReceived ? (
              <p className={styles.result}>
                Election Result: Won Term {selectedNode.currentTerm} with a majority.
              </p>
            ) : null}

            <div className={styles.logTable}>
              <h3>Log</h3>
              {selectedNode.log.length === 0 ? (
                <p className={styles.empty}>Log is empty.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Index</th>
                      <th scope="col">Term</th>
                      <th scope="col">Command</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedNode.log.map((entry) => (
                      <tr key={entry.index}>
                        <td>{entry.index}</td>
                        <td>{entry.term}</td>
                        <td>{entry.command}</td>
                        <td>{entry.applied ? "Applied" : entry.committed ? "Committed" : "Uncommitted"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {displayMode === "advanced" && selectedNode.role === "leader" ? (
              <div className={styles.advanced}>
                <h3>Leader internals</h3>
                <pre>{JSON.stringify({
                  configuredClusterSize: Object.keys(clusterState.nodes).length,
                  majorityRequired: requiredVotes,
                  reachableNodes: reachableNodes.length,
                  nextIndex: selectedNode.nextIndex,
                  matchIndex: selectedNode.matchIndex,
                }, null, 2)}</pre>
              </div>
            ) : null}
          </>
        ) : (
          <p className={styles.empty}>Select a node to inspect its state.</p>
        )}
      </section>
      ) : null}
    </aside>
  );
}

const inspectorTabs: Array<{ id: InspectorTab; label: string }> = [
  { id: "explanation", label: "Explanation" },
  { id: "message", label: "Message" },
  { id: "node", label: "Node" },
  { id: "logs", label: "Log Comparison" },
];

function LogComparison({ clusterState }: { clusterState: ClusterState }) {
  const leader = Object.values(clusterState.nodes).find((node) => node.role === "leader");
  const followers = Object.values(clusterState.nodes).filter((node) => node.id !== leader?.id);
  const focusFollower = followers.find((node) => hasConflict(leader, node)) ?? followers[0];

  if (!leader || !focusFollower) {
    return <p className={styles.empty}>A leader is needed before logs can be compared.</p>;
  }

  const maxIndex = Math.max(...[leader, focusFollower].flatMap((node) => node.log.map((entry) => entry.index)), 0);
  const rows = Array.from({ length: maxIndex }, (_, index) => index + 1).map((index) => {
    const leaderEntry = leader.log.find((entry) => entry.index === index);
    const followerEntry = focusFollower.log.find((entry) => entry.index === index);
    const status = getComparisonStatus(leaderEntry, followerEntry, focusFollower.commitIndex);
    return { index, leaderEntry, followerEntry, status };
  });

  return (
    <div className={styles.logComparison}>
      <p className={styles.kicker}>Leader {leader.id} vs Node {focusFollower.id}</p>
      {leader.nextIndex?.[focusFollower.id] !== undefined ? (
        <dl className={styles.comparisonStats}>
          <div><dt>nextIndex</dt><dd>{leader.nextIndex[focusFollower.id]}</dd></div>
          <div><dt>matchIndex</dt><dd>{leader.matchIndex?.[focusFollower.id] ?? 0}</dd></div>
        </dl>
      ) : null}
      <table>
        <thead>
          <tr>
            <th scope="col">Index</th>
            <th scope="col">Leader</th>
            <th scope="col">Follower</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.index} data-status={row.status}>
              <td>{row.index}</td>
              <td>{formatEntry(row.leaderEntry)}</td>
              <td>{formatEntry(row.followerEntry)}</td>
              <td>{formatStatus(row.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function hasConflict(leader: RaftNode | undefined, follower: RaftNode): boolean {
  if (!leader) {
    return false;
  }
  return follower.log.some((entry) => {
    const leaderEntry = leader.log.find((candidate) => candidate.index === entry.index);
    return leaderEntry !== undefined && leaderEntry.term !== entry.term;
  });
}

function getComparisonStatus(
  leaderEntry: LogEntry | undefined,
  followerEntry: LogEntry | undefined,
  followerCommitIndex: number,
): "common" | "conflict" | "missing" | "extra" {
  if (leaderEntry && followerEntry && leaderEntry.term === followerEntry.term) {
    return "common";
  }
  if (leaderEntry && followerEntry) {
    return followerEntry.index <= followerCommitIndex ? "common" : "conflict";
  }
  if (leaderEntry) {
    return "missing";
  }
  return "extra";
}

function formatEntry(entry: LogEntry | undefined): string {
  return entry ? `T${entry.term} ${entry.command}` : "-";
}

function formatStatus(status: "common" | "conflict" | "missing" | "extra"): string {
  if (status === "common") return "Common prefix";
  if (status === "conflict") return "Conflict";
  if (status === "missing") return "Needs leader entry";
  return "Extra follower entry";
}
