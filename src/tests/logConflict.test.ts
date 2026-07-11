import { describe, expect, it } from "vitest";
import {
  findFirstConflict,
  getLastLogIndex,
  getLastLogTerm,
  getLogEntryAtIndex,
  logMatchesAt,
  mergeLeaderEntries,
} from "../simulator/log/logUtils";
import type { LogEntry } from "../simulator/types";

const followerLog: LogEntry[] = [
  { index: 1, term: 1, command: "SET x = 1", committed: true, applied: true },
  { index: 2, term: 1, command: "SET y = 2", committed: true, applied: true },
  { index: 3, term: 2, command: "SET old = 7", committed: false, applied: false },
  { index: 4, term: 2, command: "SET old = 9", committed: false, applied: false },
];

const leaderSuffix: LogEntry[] = [
  { index: 3, term: 3, command: "SET x = 5", committed: false, applied: false },
  { index: 4, term: 4, command: "SET z = 8", committed: false, applied: false },
];

describe("log conflict helpers", () => {
  it("reads last index, last term, and entries by Raft index", () => {
    expect(getLastLogIndex([])).toBe(0);
    expect(getLastLogTerm([])).toBe(0);
    expect(getLastLogIndex(followerLog)).toBe(4);
    expect(getLastLogTerm(followerLog)).toBe(2);
    expect(getLogEntryAtIndex(followerLog, 2)?.command).toBe("SET y = 2");
    expect(getLogEntryAtIndex(followerLog, 9)).toBeUndefined();
  });

  it("validates prevLogIndex and prevLogTerm", () => {
    expect(logMatchesAt([], 0, 0)).toBe(true);
    expect(logMatchesAt(followerLog, 2, 1)).toBe(true);
    expect(logMatchesAt(followerLog, 4, 4)).toBe(false);
    expect(logMatchesAt(followerLog, 5, 4)).toBe(false);
  });

  it("finds and replaces only the first conflicting uncommitted suffix", () => {
    expect(findFirstConflict(followerLog, leaderSuffix)).toBe(3);

    const result = mergeLeaderEntries(followerLog, leaderSuffix, 2);

    expect(result.rejected).toBe(false);
    expect(result.conflictIndex).toBe(3);
    expect(result.log.map((entry) => entry.term)).toEqual([1, 1, 3, 4]);
    expect(result.log.map((entry) => entry.command)).toEqual([
      "SET x = 1",
      "SET y = 2",
      "SET x = 5",
      "SET z = 8",
    ]);
  });

  it("rejects an attempted truncation of committed prefix entries", () => {
    const result = mergeLeaderEntries(
      followerLog,
      [{ index: 2, term: 9, command: "ILLEGAL", committed: false, applied: false }],
      2,
    );

    expect(result.rejected).toBe(true);
    expect(result.conflictIndex).toBe(2);
    expect(result.log).toEqual(followerLog);
  });
});
