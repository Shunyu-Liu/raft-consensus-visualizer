# Scenarios

## Basic Leader Election and Log Replication

Node B times out first, becomes candidate, requests votes, wins a majority, sends heartbeats, accepts a client command, replicates it, commits it, and followers apply it.

## Leader Failure and Re-election

Node B becomes leader, crashes, Node C later wins a higher term, and the old leader restarts as a follower after observing higher-term messages.

## Split Vote

Two candidates compete in the same term, neither reaches a majority, and a later election term resolves the split.

## Network Partition — Minority Leader and Majority Progress

Node B remains a Term 1 leader in the A/B minority, but 2 of 5 nodes cannot commit. C/D/E form a majority, elect Node C in Term 2, and repair divergent logs after healing.

## Conflicting Logs and Log Reconciliation

Node C leads Term 4 while Node B has an old uncommitted suffix. Node C backs up nextIndex, finds the common prefix, truncates the conflicting follower suffix, appends its own suffix, and converges the logs.
