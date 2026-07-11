import {
  isAppendEntriesMessage,
  isAppendEntriesResponseMessage,
  isHeartbeatMessage,
  isRequestVoteMessage,
  isRequestVoteResponseMessage,
} from "../../simulator/messageTypes";
import type { RaftMessage } from "../../simulator/types";

export function getMessageDisplayName(message: RaftMessage): string {
  const suffix = message.status === "dropped" && message.dropReason === "network_partition"
    ? " · Partitioned"
    : "";

  if (isRequestVoteMessage(message)) {
    return `RequestVote${suffix}`;
  }

  if (isRequestVoteResponseMessage(message)) {
    return `${message.payload.voteGranted ? "Vote Granted" : "Vote Rejected"}${suffix}`;
  }

  if (isHeartbeatMessage(message)) {
    return `Heartbeat${suffix}`;
  }

  if (isAppendEntriesMessage(message)) {
    if (message.payload.purpose === "commit_update") {
      return `Commit Update${suffix}`;
    }
    return `AppendEntries · ${message.payload.entries.length} entry${message.payload.entries.length === 1 ? "" : "ies"}${suffix}`;
  }

  if (isAppendEntriesResponseMessage(message)) {
    return `${message.payload.success ? "Ack" : "Rejected"}${suffix}`;
  }

  return `Message${suffix}`;
}

export function getCompactMessageLabel(message: RaftMessage): string {
  if (isRequestVoteMessage(message)) return "Vote request";
  if (isRequestVoteResponseMessage(message)) return message.payload.voteGranted ? "Vote granted" : "Vote denied";
  if (isHeartbeatMessage(message)) return "Heartbeat";
  if (isAppendEntriesMessage(message)) {
    if (message.payload.purpose === "commit_update") return "Commit update";
    return `Append ×${message.payload.entries.length}`;
  }
  if (isAppendEntriesResponseMessage(message)) return message.payload.success ? "Ack" : "Reject";
  return "RPC";
}
