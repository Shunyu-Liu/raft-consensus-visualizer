import type { RaftMessage } from "../../simulator/types";
import type { NodePosition } from "./MessageLayer";
import { getMessageDisplayName } from "./messageDisplay";
import styles from "./MessageLayer.module.css";

interface MessageArrowProps {
  message: RaftMessage;
  from: NodePosition;
  to: NodePosition;
  offset: number;
  isSelected: boolean;
  onSelect: () => void;
}

export function MessageArrow({
  message,
  from,
  to,
  offset,
  isSelected,
  onSelect,
}: MessageArrowProps) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  const bend = (offset - 1) * 18;
  const startX = from.x + (dx / length) * 92 + normalX * bend;
  const startY = from.y + (dy / length) * 64 + normalY * bend;
  const endX = to.x - (dx / length) * 92 + normalX * bend;
  const endY = to.y - (dy / length) * 64 + normalY * bend;
  const midX = (startX + endX) / 2 + normalX * 12;
  const midY = (startY + endY) / 2 + normalY * 12;
  const path = `M ${startX} ${startY} Q ${midX} ${midY} ${endX} ${endY}`;

  return (
    <g
      className={styles.arrowGroup}
      data-message-type={message.type}
      data-status={message.status}
      data-selected={isSelected}
      onClick={onSelect}
    >
      <path className={styles.hitPath} d={path} />
      <path className={styles.path} d={path} markerEnd="url(#message-arrow)" />
      <foreignObject x={midX - 54} y={midY - 14} width="108" height="28">
        <button type="button" className={styles.label} onClick={onSelect}>
          {getMessageDisplayName(message)}
        </button>
      </foreignObject>
    </g>
  );
}
