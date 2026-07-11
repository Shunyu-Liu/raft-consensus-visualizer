import type { ScenarioId } from "../simulator/types";

export interface LearningConcept {
  id: string;
  order: number;
  title: string;
  summary: string;
  whyItMatters: string;
  explanation: string[];
  keyPoints: string[];
  simulatorWatchFor: string[];
  relatedScenarioIds: ScenarioId[];
  paperSection?: string;
  commonMistake?: {
    misconception: string;
    correction: string;
  };
}

export interface SafetyProperty {
  id: string;
  title: string;
  explanation: string;
  simulatorNote: string;
  paperSection: string;
}

export interface GlossaryItem {
  id: string;
  term: string;
  shortDefinition: string;
  longDefinition: string;
  relatedConceptIds: string[];
  relatedScenarioIds: ScenarioId[];
  paperSection?: string;
}

export interface Misconception {
  id: string;
  misconception: string;
  correction: string;
}

export interface ScenarioGuideItem {
  scenarioId: ScenarioId;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  learningGoals: string[];
  initialSituation: string;
  whatToWatch: string[];
  expectedOutcome: string;
  relatedConceptIds: string[];
}
