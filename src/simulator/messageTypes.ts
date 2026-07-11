import type {
  AppendEntriesResponse,
  RaftMessage,
  RequestVoteResponse,
} from "./types";

export type RequestVoteMessage = RaftMessage & {
  type: "request_vote";
  payload: {
    term: number;
    candidateId: string;
    lastLogIndex: number;
    lastLogTerm: number;
  };
};

export type RequestVoteResponseMessage = RaftMessage & {
  type: "request_vote_response";
  payload: RequestVoteResponse;
};

export type AppendEntriesMessage = RaftMessage & {
  type: "append_entries";
  payload: {
    term: number;
    leaderId: string;
    prevLogIndex: number;
    prevLogTerm: number;
    entries: unknown[];
    leaderCommit: number;
    purpose: "heartbeat" | "log_replication" | "commit_update" | "log_reconciliation";
    attempt?: number;
  };
};

export type AppendEntriesResponseMessage = RaftMessage & {
  type: "append_entries_response";
  payload: AppendEntriesResponse;
};

export function isRequestVoteMessage(message: RaftMessage): message is RequestVoteMessage {
  return message.type === "request_vote" && hasRequestVotePayload(message.payload);
}

export function isRequestVoteResponseMessage(
  message: RaftMessage,
): message is RequestVoteResponseMessage {
  return message.type === "request_vote_response" && hasRequestVoteResponsePayload(message.payload);
}

export function isAppendEntriesMessage(message: RaftMessage): message is AppendEntriesMessage {
  return message.type === "append_entries" && hasAppendEntriesPayload(message.payload);
}

export function isHeartbeatMessage(message: RaftMessage): message is AppendEntriesMessage {
  return (
    isAppendEntriesMessage(message) &&
    message.payload.purpose === "heartbeat" &&
    message.payload.entries.length === 0
  );
}

export function isAppendEntriesResponseMessage(
  message: RaftMessage,
): message is AppendEntriesResponseMessage {
  return (
    message.type === "append_entries_response" &&
    hasAppendEntriesResponsePayload(message.payload)
  );
}

function hasRequestVotePayload(payload: unknown): payload is RequestVoteMessage["payload"] {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "term" in payload &&
    typeof payload.term === "number" &&
    "candidateId" in payload &&
    typeof payload.candidateId === "string" &&
    "lastLogIndex" in payload &&
    typeof payload.lastLogIndex === "number" &&
    "lastLogTerm" in payload &&
    typeof payload.lastLogTerm === "number"
  );
}

function hasRequestVoteResponsePayload(payload: unknown): payload is RequestVoteResponse {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "term" in payload &&
    typeof payload.term === "number" &&
    "voteGranted" in payload &&
    typeof payload.voteGranted === "boolean" &&
    "voterId" in payload &&
    typeof payload.voterId === "string"
  );
}

function hasAppendEntriesPayload(payload: unknown): payload is AppendEntriesMessage["payload"] {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "term" in payload &&
    typeof payload.term === "number" &&
    "leaderId" in payload &&
    typeof payload.leaderId === "string" &&
    "prevLogIndex" in payload &&
    typeof payload.prevLogIndex === "number" &&
    "prevLogTerm" in payload &&
    typeof payload.prevLogTerm === "number" &&
    "entries" in payload &&
    Array.isArray(payload.entries) &&
    "leaderCommit" in payload &&
    typeof payload.leaderCommit === "number" &&
    "purpose" in payload &&
    (
      payload.purpose === "heartbeat" ||
      payload.purpose === "log_replication" ||
      payload.purpose === "commit_update" ||
      payload.purpose === "log_reconciliation"
    ) &&
    (!("attempt" in payload) || typeof payload.attempt === "number")
  );
}

function hasAppendEntriesResponsePayload(payload: unknown): payload is AppendEntriesResponse {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "term" in payload &&
    typeof payload.term === "number" &&
    "success" in payload &&
    typeof payload.success === "boolean" &&
    "followerId" in payload &&
    typeof payload.followerId === "string" &&
    "matchIndex" in payload &&
    typeof payload.matchIndex === "number" &&
    (!("rejectedNextIndex" in payload) || typeof payload.rejectedNextIndex === "number") &&
    (!("conflictIndex" in payload) || typeof payload.conflictIndex === "number") &&
    (!("conflictTerm" in payload) || typeof payload.conflictTerm === "number") &&
    (!("attempt" in payload) || typeof payload.attempt === "number")
  );
}
