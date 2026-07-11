/** Stable identifier for a Raft node, such as "A" or "B". */
export type NodeId = string;

/** Stable identifier for a visualized or queued RPC message. */
export type MessageId = string;

/** Stable identifier for a deterministic learning scenario. */
export type ScenarioId = string;

/** Raft protocol role. Crashes are intentionally modeled outside the role. */
export type NodeRole = "follower" | "candidate" | "leader";

/** Runtime availability of a node in the browser simulation. */
export type NodeStatus = "running" | "crashed";

/** Stable identifier for a simulated network partition group. */
export type PartitionId = string;

/** Structured reason for terminal message drops. */
export type MessageDropReason = "target_crashed" | "network_partition";

/** A single replicated state machine command stored in a Raft log. */
export interface LogEntry {
  index: number;
  term: number;
  command: string;
  committed: boolean;
  applied: boolean;
}

/** Complete teaching-state snapshot for one Raft server. */
export interface RaftNode {
  id: NodeId;
  role: NodeRole;
  status: NodeStatus;
  currentTerm: number;
  votedFor: NodeId | null;
  log: LogEntry[];
  commitIndex: number;
  lastApplied: number;
  electionElapsed: number;
  electionTimeout: number;
  heartbeatElapsed: number;
  partitionId: PartitionId | null;
  /** Volatile teaching state used to show votes collected during an election. */
  votesReceived?: NodeId[];
  /** Volatile teaching timestamp for visualization; not Raft persistent state. */
  lastHeartbeatReceivedAt?: number;
  /** Volatile teaching counter for deterministic heartbeat rounds. */
  heartbeatRoundsSent?: number;
  nextIndex?: Record<NodeId, number>;
  matchIndex?: Record<NodeId, number>;
}

/** Core Raft simulation state. UI selection and playback controls live elsewhere. */
export interface ClusterState {
  nodes: Record<NodeId, RaftNode>;
  messages: RaftMessage[];
  events: SimulationEvent[];
  currentStep: number;
  logicalTime: number;
}

/** A deterministic future action managed by the internal EventQueue. */
export interface ScheduledAction<TPayload = unknown> {
  id: string;
  type: string;
  scheduledTime: number;
  sequence: number;
  payload: TPayload;
}

/** State that controls deterministic playback, separate from the Raft cluster. */
export interface SimulatorControlState {
  scenarioId: ScenarioId;
  playbackStatus: "idle" | "running" | "paused" | "completed";
  speed: number;
}

/** View-only state owned by React UI, not by the Raft simulator. */
export interface SimulatorUIState {
  selectedNodeId: NodeId | null;
  selectedMessageId: MessageId | null;
  displayMode: "basic" | "advanced";
  theme: "light" | "dark";
}

/** A human-readable change produced by a simulator transition. */
export interface StateChange {
  nodeId: NodeId;
  field: string;
  before: unknown;
  after: unknown;
}

/** Teaching event shown in the timeline and explanation panel. */
export interface SimulationEvent {
  id: string;
  step: number;
  logicalTime: number;
  type: string;
  title: string;
  description: string;
  explanation: string;
  raftRule: string;
  sourceNode?: NodeId;
  targetNode?: NodeId;
  term?: number;
  paperSection?: string;
  stateChanges?: StateChange[];
  isDemoEvent?: boolean;
}

/** RequestVote RPC fields from the Raft leader election protocol. */
export interface RequestVoteRPC {
  term: number;
  candidateId: NodeId;
  lastLogIndex: number;
  lastLogTerm: number;
}

/** Response to a RequestVote RPC. */
export interface RequestVoteResponse {
  term: number;
  voteGranted: boolean;
  voterId: NodeId;
}

/** AppendEntries RPC. An empty entries array represents a heartbeat. */
export interface AppendEntriesRPC {
  term: number;
  leaderId: NodeId;
  prevLogIndex: number;
  prevLogTerm: number;
  entries: LogEntry[];
  leaderCommit: number;
  purpose: "heartbeat" | "log_replication" | "commit_update" | "log_reconciliation";
  attempt?: number;
}

/** Response to an AppendEntries RPC. */
export interface AppendEntriesResponse {
  term: number;
  success: boolean;
  followerId: NodeId;
  matchIndex: number;
  rejectedNextIndex?: number;
  conflictIndex?: number;
  conflictTerm?: number;
  attempt?: number;
}

/** Message envelope used by the browser simulator's deterministic queue. */
export interface RaftMessage {
  id: MessageId;
  type:
    | "request_vote"
    | "request_vote_response"
    | "append_entries"
    | "append_entries_response";
  from: NodeId;
  to: NodeId;
  term: number;
  status: "queued" | "delivered" | "dropped";
  createdAtLogicalTime?: number;
  deliveredAtLogicalTime?: number;
  droppedAtLogicalTime?: number;
  dropReason?: MessageDropReason;
  payload:
    | RequestVoteRPC
    | RequestVoteResponse
    | AppendEntriesRPC
    | AppendEntriesResponse;
}
