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
  visibilityAge?: number;
  onSelect: () => void;
}

export function MessageArrow({ message, route, isSelected, isPinned, activityKind, activityStep, visibilityAge, onSelect }: MessageArrowProps) {
  return (
    <g className={styles.arrowGroup} data-message-id={message.id} data-message-type={message.type} data-from={message.from} data-to={message.to} data-status={message.status} data-selected={isSelected} data-pinned={isPinned} data-activity={activityKind} data-activity-step={activityStep} data-visibility-age={visibilityAge} data-lane={route.lane} onClick={onSelect}>
      <path className={styles.hitPath} d={route.path} data-route-path="hit" />
      <path className={styles.path} d={route.path} data-route-path="visual" />
      <foreignObject x={route.labelX - 54} y={route.labelY - 14} width="108" height="28">
        <button type="button" className={styles.label} aria-label={`${getCompactMessageLabel(message)} from Node ${message.from} to Node ${message.to}, ${message.status}${isPinned ? ", pinned historical message" : ""}`} onClick={onSelect}>
          {getCompactMessageLabel(message)}{isPinned ? " · Pinned" : ""}
        </button>
      </foreignObject>
    </g>
  );
}
