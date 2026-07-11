import type { MessageId, NodeId, RaftMessage } from "../../simulator/types";
import { MessageArrow } from "./MessageArrow";
import styles from "./MessageLayer.module.css";

export interface NodePosition {
  x: number;
  y: number;
}

interface MessageLayerProps {
  messages: RaftMessage[];
  nodePositions: Record<NodeId, NodePosition>;
  selectedMessageId: MessageId | null;
  onSelectMessage: (messageId: MessageId) => void;
}

export function MessageLayer({
  messages,
  nodePositions,
  selectedMessageId,
  onSelectMessage,
}: MessageLayerProps) {
  const visibleMessages = getVisibleMessages(messages, selectedMessageId);

  return (
    <svg className={styles.layer} aria-label="Raft RPC messages">
      <defs>
        <marker
          id="message-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className={styles.marker} />
        </marker>
      </defs>
      {visibleMessages.map((message, index) => {
        const from = nodePositions[message.from];
        const to = nodePositions[message.to];

        if (!from || !to) {
          return null;
        }

        return (
          <MessageArrow
            key={message.id}
            message={message}
            from={from}
            to={to}
            offset={index % 3}
            isSelected={message.id === selectedMessageId}
            onSelect={() => onSelectMessage(message.id)}
          />
        );
      })}
    </svg>
  );
}

function getVisibleMessages(messages: RaftMessage[], selectedMessageId: MessageId | null) {
  const queued = messages.filter((message) => message.status === "queued");
  const recentDelivered = messages
    .filter((message) => message.status === "delivered")
    .slice(-12);
  const recentDropped = messages
    .filter((message) => message.status === "dropped")
    .slice(-12);
  const selected = selectedMessageId
    ? messages.find((message) => message.id === selectedMessageId)
    : undefined;
  const byId = new Map<string, RaftMessage>();

  for (const message of [...queued, ...recentDelivered, ...recentDropped, ...(selected ? [selected] : [])]) {
    byId.set(message.id, message);
  }

  return [...byId.values()];
}
