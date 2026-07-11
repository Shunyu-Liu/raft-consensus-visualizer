import type { LogEntry } from "../types";

export interface LogMergeResult {
  log: LogEntry[];
  conflictIndex?: number;
  rejected: boolean;
  reason?: string;
}

export function getLastLogIndex(log: LogEntry[]): number {
  return log.reduce((max, entry) => Math.max(max, entry.index), 0);
}

export function getLastLogTerm(log: LogEntry[]): number {
  const lastIndex = getLastLogIndex(log);
  return getLogTermAtIndex(log, lastIndex);
}

export function getLogEntryAtIndex(
  log: LogEntry[],
  index: number,
): LogEntry | undefined {
  return log.find((entry) => entry.index === index);
}

export function getLogTermAtIndex(log: LogEntry[], index: number): number {
  if (index === 0) {
    return 0;
  }
  return getLogEntryAtIndex(log, index)?.term ?? 0;
}

export function logMatchesAt(
  log: LogEntry[],
  prevLogIndex: number,
  prevLogTerm: number,
): boolean {
  if (prevLogIndex === 0 && prevLogTerm === 0) {
    return true;
  }

  return getLogTermAtIndex(log, prevLogIndex) === prevLogTerm;
}

export function findFirstConflict(
  followerLog: LogEntry[],
  incomingEntries: LogEntry[],
): number | undefined {
  for (const entry of incomingEntries) {
    const existing = getLogEntryAtIndex(followerLog, entry.index);
    if (existing && existing.term !== entry.term) {
      return entry.index;
    }
  }
  return undefined;
}

export function mergeLeaderEntries(
  followerLog: LogEntry[],
  incomingEntries: LogEntry[],
  commitIndex: number,
): LogMergeResult {
  if (incomingEntries.length === 0) {
    return { log: followerLog.map((entry) => ({ ...entry })), rejected: false };
  }

  const conflictIndex = findFirstConflict(followerLog, incomingEntries);
  if (conflictIndex !== undefined && conflictIndex <= commitIndex) {
    return {
      log: followerLog.map((entry) => ({ ...entry })),
      conflictIndex,
      rejected: true,
      reason: "Committed log conflict detected - reconciliation rejected.",
    };
  }

  let nextLog =
    conflictIndex === undefined
      ? followerLog.map((entry) => ({ ...entry }))
      : followerLog
          .filter((entry) => entry.index < conflictIndex)
          .map((entry) => ({ ...entry }));

  for (const entry of incomingEntries) {
    const existing = getLogEntryAtIndex(nextLog, entry.index);
    if (existing) {
      continue;
    }
    nextLog = [...nextLog, { ...entry }];
  }

  return {
    log: nextLog.sort((left, right) => left.index - right.index),
    conflictIndex,
    rejected: false,
  };
}
