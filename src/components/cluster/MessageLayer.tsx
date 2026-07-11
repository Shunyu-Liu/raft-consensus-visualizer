import type { MessageDisplayMode, MessageId, NodeId, RaftMessage } from "../../simulator/types";
import type { MessageActivityFrame } from "./messageActivity";
import { getVisibleMessageIds } from "./messageVisibility";
import { MessageArrow } from "./MessageArrow";
import { assignDirectionalLanes, createRoute, type NodeBounds, type Route } from "./messageRouting";
import styles from "./MessageLayer.module.css";

interface MessageLayerProps {
  messages: RaftMessage[];
  nodeBounds: Record<NodeId, NodeBounds>;
  selectedMessageId: MessageId | null;
  pinnedMessageId: MessageId | null;
  displayMode: MessageDisplayMode;
  currentActionStep: number;
  activityFrames: MessageActivityFrame[];
  onSelectMessage: (messageId: MessageId) => void;
}

export function MessageLayer({
  messages, nodeBounds, selectedMessageId, pinnedMessageId, displayMode,
  currentActionStep, activityFrames, onSelectMessage,
}: MessageLayerProps) {
  const visibleIds = getVisibleMessageIds(messages, displayMode, currentActionStep, activityFrames, pinnedMessageId);
  const visibleMessages = messages.filter((message) => visibleIds.has(message.id));
  const lanes = assignDirectionalLanes(visibleMessages);
  const accepted: Route[] = [];

  return (
    <svg className={styles.layer} aria-label="Raft RPC messages">
      <defs><marker id="message-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" className={styles.marker} /></marker></defs>
      {visibleMessages.map((message) => {
        const from = nodeBounds[message.from]; const to = nodeBounds[message.to];
        if (!from || !to) return null;
        const obstacles = Object.entries(nodeBounds).filter(([id]) => id !== message.from && id !== message.to).map(([, bounds]) => bounds);
        const route = createRoute(message, from, to, lanes.get(message.id) ?? 0, obstacles, accepted);
        accepted.push(route);
        const frame = activityFrames.find((candidate) => candidate.actionStep === currentActionStep);
        const activityStep = [...activityFrames].reverse().find((candidate) => candidate.messageIds.includes(message.id) && candidate.actionStep <= currentActionStep)?.actionStep;
        const naturalStart = displayMode === "focus" ? currentActionStep : Math.max(1, currentActionStep - 2);
        const naturalVisible = displayMode === "all" || activityFrames.some((candidate) => candidate.actionStep >= naturalStart && candidate.actionStep <= currentActionStep && candidate.messageIds.includes(message.id));
        const isPinned = message.id === pinnedMessageId && !naturalVisible;
        return <MessageArrow key={message.id} message={message} route={route} isSelected={message.id === selectedMessageId} isPinned={isPinned} activityKind={frame?.activityByMessageId[message.id]} activityStep={activityStep} onSelect={() => onSelectMessage(message.id)} />;
      })}
    </svg>
  );
}
