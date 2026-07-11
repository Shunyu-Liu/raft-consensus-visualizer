import { describe, expect, it } from "vitest";
import { learningConcepts } from "../content/concepts";
import { misconceptions } from "../content/misconceptions";
import { safetyDisclaimer, safetyProperties } from "../content/safetyProperties";
import { scenarioGuides } from "../content/scenarioGuides";
import { getAvailableScenarios } from "../simulator/scenarios/registry";

const conceptIds = new Set(learningConcepts.map((concept) => concept.id));
const scenarioIds = new Set(getAvailableScenarios().map((scenario) => scenario.id));

describe("learning content", () => {
  it("contains the required ordered concepts with complete metadata", () => {
    expect(learningConcepts.map((concept) => concept.id)).toEqual([
      "consensus",
      "replicated-state-machine",
      "roles",
      "terms",
      "leader-election",
      "heartbeat",
      "log-replication",
      "commit-apply",
      "safety",
      "network-partition",
      "conflicting-logs",
    ]);
    expect(new Set(learningConcepts.map((concept) => concept.id)).size).toBe(learningConcepts.length);
    expect(new Set(learningConcepts.map((concept) => concept.order)).size).toBe(learningConcepts.length);

    for (const concept of learningConcepts) {
      expect(concept.title).not.toHaveLength(0);
      expect(concept.summary).not.toHaveLength(0);
      expect(concept.relatedScenarioIds.every((scenarioId) => scenarioIds.has(scenarioId))).toBe(true);
    }
  });

  it("contains the five safety properties and the formal-verification disclaimer", () => {
    expect(safetyProperties.map((property) => property.title)).toEqual([
      "Election Safety",
      "Leader Append-Only",
      "Log Matching",
      "Leader Completeness",
      "State Machine Safety",
    ]);
    expect(new Set(safetyProperties.map((property) => property.id)).size).toBe(safetyProperties.length);
    expect(safetyProperties.every((property) => property.explanation.length > 0)).toBe(true);
    expect(safetyDisclaimer).toContain("not a formal verification tool");
  });

  it("contains misconception corrections for common Raft mistakes", () => {
    expect(misconceptions.length).toBeGreaterThanOrEqual(10);
    expect(misconceptions.some((item) => item.correction.includes("empty entries array"))).toBe(true);
    expect(misconceptions.some((item) => item.correction.includes("uncommitted"))).toBe(true);
    expect(misconceptions.some((item) => item.correction.includes("configured cluster membership"))).toBe(true);
    expect(misconceptions.some((item) => item.correction.includes("preserves currentTerm"))).toBe(true);
    expect(misconceptions.some((item) => item.correction.includes("conflict with the follower"))).toBe(true);
    expect(misconceptions.every((item) => item.misconception && item.correction)).toBe(true);
  });

  it("keeps scenario guides tied to real registry scenarios and concepts", () => {
    expect(scenarioGuides.map((guide) => guide.scenarioId)).toEqual([
      "basic-leader-election",
      "leader-failure",
      "split-vote",
      "network-partition",
      "conflicting-logs",
    ]);
    for (const guide of scenarioGuides) {
      expect(scenarioIds.has(guide.scenarioId)).toBe(true);
      expect(guide.learningGoals.length).toBeGreaterThan(0);
      expect(guide.whatToWatch.length).toBeGreaterThan(0);
      expect(guide.expectedOutcome).not.toHaveLength(0);
      expect(guide.relatedConceptIds.every((conceptId) => conceptIds.has(conceptId))).toBe(true);
    }
  });
});
