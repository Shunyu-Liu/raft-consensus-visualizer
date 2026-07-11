import { useMemo, useState } from "react";
import { learningConcepts } from "../../content/concepts";
import { glossaryItems, searchGlossary } from "../../content/glossary";
import { misconceptions } from "../../content/misconceptions";
import { safetyDisclaimer, safetyProperties } from "../../content/safetyProperties";
import { scenarioGuides } from "../../content/scenarioGuides";
import type { ScenarioDefinition } from "../../simulator/scenarios/types";
import type { ScenarioId } from "../../simulator/types";
import styles from "./LearnPage.module.css";

interface LearnPageProps {
  scenarios: ScenarioDefinition[];
  onOpenScenario: (scenarioId: ScenarioId) => void;
}

export function LearnPage({ scenarios, onOpenScenario }: LearnPageProps) {
  const [glossaryQuery, setGlossaryQuery] = useState("");
  const [completedConceptIds, setCompletedConceptIds] = useState<string[]>([]);
  const filteredGlossary = useMemo(
    () => searchGlossary(glossaryQuery, glossaryItems),
    [glossaryQuery],
  );

  function toggleComplete(conceptId: string) {
    setCompletedConceptIds((current) =>
      current.includes(conceptId)
        ? current.filter((candidate) => candidate !== conceptId)
        : [...current, conceptId],
    );
  }

  const scenarioById = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

  return (
    <main className={styles.page}>
      <section className={styles.hero} aria-labelledby="learn-title">
        <p className={styles.kicker}>Learning Guide</p>
        <h1 id="learn-title">Learn Raft</h1>
        <p>
          Understand Raft step by step through concepts, diagrams, and interactive scenarios.
        </p>
        <div className={styles.disclaimer}>
          This guide explains the educational model used by Raft Explorer. The simulator is not a production Raft implementation.
        </div>
      </section>

      <section className={styles.layout}>
        <nav className={styles.conceptNav} aria-label="Concept navigation">
          <h2>Concept Navigation</h2>
          <ol>
            {learningConcepts.map((concept) => (
              <li key={concept.id}>
                <a href={`#concept-${concept.id}`}>
                  <span>{concept.order}</span>
                  {concept.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.content}>
          <section className={styles.panel} aria-labelledby="learning-path-title">
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.kicker}>Recommended order</p>
                <h2 id="learning-path-title">Learning Path</h2>
              </div>
              <span>{completedConceptIds.length} / {learningConcepts.length} complete</span>
            </div>
            <div className={styles.pathGrid}>
              {learningConcepts.map((concept) => (
                <article key={concept.id} className={styles.pathCard}>
                  <div className={styles.cardTitle}>
                    <span>{concept.order}</span>
                    <h3>{concept.title}</h3>
                  </div>
                  <p>{concept.summary}</p>
                  <div className={styles.cardActions}>
                    <a href={`#concept-${concept.id}`}>Open Concept</a>
                    {concept.relatedScenarioIds[0] ? (
                      <button
                        type="button"
                        onClick={() => onOpenScenario(concept.relatedScenarioIds[0])}
                      >
                        Open in Simulator
                      </button>
                    ) : null}
                    <button type="button" onClick={() => toggleComplete(concept.id)}>
                      {completedConceptIds.includes(concept.id) ? "Completed" : "Mark Complete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="concepts-title">
            <p className={styles.kicker}>Core ideas</p>
            <h2 id="concepts-title">Concept Guide</h2>
            {learningConcepts.map((concept) => (
              <article
                key={concept.id}
                id={`concept-${concept.id}`}
                className={styles.concept}
              >
                <div className={styles.conceptHeader}>
                  <div>
                    <p className={styles.kicker}>Concept {concept.order}</p>
                    <h3>{concept.title}</h3>
                  </div>
                  {concept.paperSection ? <span>{concept.paperSection}</span> : null}
                </div>
                <p className={styles.summary}>{concept.summary}</p>
                <h4>What is it?</h4>
                {concept.explanation.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                <h4>Why is it needed?</h4>
                <p>{concept.whyItMatters}</p>
                <h4>How does Raft use it?</h4>
                <ul>
                  {concept.keyPoints.map((point) => <li key={point}>{point}</li>)}
                </ul>
                <h4>What should you watch in the simulator?</h4>
                <ul>
                  {concept.simulatorWatchFor.map((item) => <li key={item}>{item}</li>)}
                </ul>
                {concept.commonMistake ? (
                  <div className={styles.callout}>
                    <strong>Common mistake:</strong> {concept.commonMistake.misconception}
                    <br />
                    <strong>Correction:</strong> {concept.commonMistake.correction}
                  </div>
                ) : null}
                {renderConceptDiagram(concept.id)}
                <div className={styles.relatedActions}>
                  {concept.relatedScenarioIds.map((scenarioId) => (
                    <button key={scenarioId} type="button" onClick={() => onOpenScenario(scenarioId)}>
                      Open {scenarioById.get(scenarioId)?.name ?? scenarioId}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </section>

          <section className={styles.panel} aria-labelledby="safety-title">
            <p className={styles.kicker}>Section 5.4</p>
            <h2 id="safety-title">Raft Safety Properties</h2>
            <p>{safetyDisclaimer}</p>
            <div className={styles.safetyGrid}>
              {safetyProperties.map((property) => (
                <article key={property.id} className={styles.infoCard}>
                  <h3>{property.title}</h3>
                  <p>{property.explanation}</p>
                  <small>{property.simulatorNote}</small>
                </article>
              ))}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="scenario-guide-title">
            <p className={styles.kicker}>Practice</p>
            <h2 id="scenario-guide-title">Scenario Guide</h2>
            <div className={styles.scenarioGrid}>
              {scenarioGuides.map((guide) => {
                const scenario = scenarioById.get(guide.scenarioId);
                return (
                  <article key={guide.scenarioId} className={styles.infoCard}>
                    <div className={styles.cardTitle}>
                      <span>{guide.difficulty}</span>
                      <h3>{scenario?.name ?? guide.scenarioId}</h3>
                    </div>
                    <p>{guide.initialSituation}</p>
                    <h4>Learning Goals</h4>
                    <ul>{guide.learningGoals.map((goal) => <li key={goal}>{goal}</li>)}</ul>
                    <h4>What to Watch</h4>
                    <ul>{guide.whatToWatch.map((item) => <li key={item}>{item}</li>)}</ul>
                    <p><strong>Expected outcome:</strong> {guide.expectedOutcome}</p>
                    <button type="button" onClick={() => onOpenScenario(guide.scenarioId)}>
                      Open in Simulator
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="misconceptions-title">
            <p className={styles.kicker}>Corrections</p>
            <h2 id="misconceptions-title">Common Misconceptions</h2>
            <div className={styles.misconceptions}>
              {misconceptions.map((item) => (
                <details key={item.id}>
                  <summary>{item.misconception}</summary>
                  <p>{item.correction}</p>
                </details>
              ))}
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="glossary-title">
            <div className={styles.sectionHeader}>
              <div>
                <p className={styles.kicker}>Reference</p>
                <h2 id="glossary-title">Glossary</h2>
              </div>
              <span>{filteredGlossary.length} terms</span>
            </div>
            <label className={styles.searchLabel}>
              Search Glossary
              <input
                value={glossaryQuery}
                onChange={(event) => setGlossaryQuery(event.currentTarget.value)}
                placeholder="term, commit, log"
              />
            </label>
            {filteredGlossary.length === 0 ? (
              <p className={styles.empty}>No glossary terms match your search.</p>
            ) : (
              <div className={styles.glossaryGrid}>
                {filteredGlossary.map((item) => (
                  <article key={item.id} className={styles.infoCard}>
                    <h3>{item.term}</h3>
                    <p>{item.shortDefinition}</p>
                    <small>{item.longDefinition}</small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="references-title">
            <p className={styles.kicker}>References</p>
            <h2 id="references-title">References</h2>
            <p>
              Diego Ongaro and John Ousterhout, <cite>In Search of an Understandable Consensus Algorithm</cite>.
            </p>
            <p>
              <a href="https://raft.github.io/raft.pdf">Raft paper</a>
              {" · "}
              <a href="https://raft.github.io/">Raft website</a>
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

function renderConceptDiagram(conceptId: string) {
  if (conceptId === "consensus") {
    return <Flow items={["Client Command", "Leader", "Replicated Log", "Majority", "Committed Result"]} />;
  }
  if (conceptId === "replicated-state-machine") {
    return <Flow items={["Same command order", "Same state"]} />;
  }
  if (conceptId === "roles") {
    return <Flow items={["Follower", "Candidate", "Leader", "Follower"]} />;
  }
  if (conceptId === "commit-apply") {
    return <Flow items={["Appended", "Replicated", "Majority Replicated", "Committed", "Applied"]} />;
  }
  if (conceptId === "conflicting-logs") {
    return (
      <div className={styles.logDiagram} aria-label="Conflicting log comparison">
        <div><strong>Leader C</strong><code>1/T1 2/T1 3/T3 4/T4</code></div>
        <div><strong>Follower B</strong><code>1/T1 2/T1 3/T2 4/T2</code></div>
      </div>
    );
  }
  return null;
}

function Flow({ items }: { items: string[] }) {
  return (
    <ol className={styles.flow}>
      {items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
    </ol>
  );
}
