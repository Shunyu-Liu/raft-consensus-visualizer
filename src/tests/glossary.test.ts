import { describe, expect, it } from "vitest";
import { glossaryItems, searchGlossary } from "../content/glossary";
import { learningConcepts } from "../content/concepts";
import { getAvailableScenarios } from "../simulator/scenarios/registry";

describe("glossary content and search", () => {
  it("contains at least forty unique typed terms", () => {
    expect(glossaryItems.length).toBeGreaterThanOrEqual(40);
    expect(new Set(glossaryItems.map((item) => item.id)).size).toBe(glossaryItems.length);
    expect(new Set(glossaryItems.map((item) => item.term.toLowerCase())).size).toBe(glossaryItems.length);

    for (const term of [
      "Heartbeat",
      "AppendEntries",
      "Commit Index",
      "Last Applied",
      "nextIndex",
      "matchIndex",
      "Network Partition",
      "Conflicting Log",
    ]) {
      expect(glossaryItems.some((item) => item.term === term)).toBe(true);
    }
  });

  it("keeps related concept and scenario links valid", () => {
    const conceptIds = new Set(learningConcepts.map((concept) => concept.id));
    const scenarioIds = new Set(getAvailableScenarios().map((scenario) => scenario.id));

    for (const item of glossaryItems) {
      expect(item.shortDefinition).not.toHaveLength(0);
      expect(item.longDefinition).not.toHaveLength(0);
      expect(item.relatedConceptIds.every((conceptId) => conceptIds.has(conceptId))).toBe(true);
      expect(item.relatedScenarioIds.every((scenarioId) => scenarioIds.has(scenarioId))).toBe(true);
    }
  });

  it("searches case-insensitively, trims whitespace, and supports empty states", () => {
    expect(searchGlossary("").length).toBe(glossaryItems.length);
    expect(searchGlossary("  TERM  ").some((item) => item.term === "Term")).toBe(true);
    expect(searchGlossary("heartbeat").map((item) => item.term)).toContain("Heartbeat");
    expect(searchGlossary("not-a-real-raft-term")).toEqual([]);
  });
});
