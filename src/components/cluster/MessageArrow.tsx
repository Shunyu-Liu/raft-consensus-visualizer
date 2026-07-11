import type { RaftMessage } from "../../simulator/types";
import type { MessageActivityKind } from "./messageActivity";
import type { Route } from "./messageRouting";
import { getCompactMessageLabel } from "./messageDisplay";
import styles from "./MessageLayer.module.css";

interface MessageArrowProps {
  message: RaftMessage;
  route: Route;
  isSelected: boolean;
  isPinned: boolean;
  activityKind?: MessageActivityKind;
  activityStep?: number;
  onSelect: () => void;
}

export function MessageArrow({ message, route, isSelected, isPinned, activityKind, activityStep, onSelect }: MessageArrowProps) {
  return (
    <g className={styles.arrowGroup} data-message-type={message.type} data-status={message.status} data-selected={isSelected} data-pinned={isPinned} data-activity={activityKind} onClick={onSelect}>
      <path className={styles.hitPath} d={route.path} />
      <path className={styles.path} d={route.path} markerEnd="url(#message-arrow)" />
      <foreignObject x={route.labelX - 54} y={route.labelY - 14} width="108" height="28">
        <button type="button" className={styles.label} aria-label={`${getCompactMessageLabel(message)} from Node ${message.from} to Node ${message.to}, ${message.status}${isPinned ? ", pinned historical message" : ""}`} onClick={onSelect}>
          {getCompactMessageLabel(message)}{isPinned ? " · Pinned" : activityStep ? ` · ${activityStep}` : ""}
        </button>
      </foreignObject>
    </g>
  );
}
