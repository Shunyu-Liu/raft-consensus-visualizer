import { useState } from "react";
import type { SimulationEvent } from "../../simulator/types";
import styles from "./EventTimeline.module.css";

interface EventTimelineProps {
  events: SimulationEvent[];
}

export function EventTimeline({ events }: EventTimelineProps) {
  const [filter, setFilter] = useState<EventCategory>("all");
  const filteredEvents = events.filter((event) =>
    filter === "all" ? true : categorizeEvent(event.type) === filter,
  );

  return (
    <section className={styles.timeline} aria-labelledby="timeline-title">
      <div className={styles.header}>
        <h2 id="timeline-title">Event Timeline</h2>
        <span>{events.length} events</span>
      </div>
      <label className={styles.filterLabel}>
        Filter by Category
        <select
          value={filter}
          onChange={(event) => setFilter(event.currentTarget.value as EventCategory)}
        >
          {eventCategories.map((category) => (
            <option key={category} value={category}>{formatCategory(category)}</option>
          ))}
        </select>
      </label>

      {events.length === 0 ? (
        <p className={styles.empty}>No events yet. Start the simulation or execute the next step.</p>
      ) : filteredEvents.length === 0 ? (
        <p className={styles.empty}>No events match this filter.</p>
      ) : (
        <ol className={styles.eventList}>
          {filteredEvents.map((event) => (
          <li key={event.id} className={styles.eventItem}>
            <div className={styles.step}>Step {event.step}</div>
            <div className={styles.body}>
              <div className={styles.eventTitle}>
                {event.title}
                <span className={styles.categoryBadge}>{formatCategory(categorizeEvent(event.type))}</span>
                {event.isDemoEvent ? <span className={styles.demoBadge}>Demo Event</span> : null}
              </div>
              <p>{event.description}</p>
              <small>T+{event.logicalTime} ms</small>
            </div>
          </li>
          ))}
        </ol>
      )}
    </section>
  );
}

type EventCategory =
  | "all"
  | "election"
  | "heartbeat"
  | "replication"
  | "commit"
  | "failure"
  | "partition"
  | "reconciliation";

const eventCategories: EventCategory[] = [
  "all",
  "election",
  "heartbeat",
  "replication",
  "commit",
  "failure",
  "partition",
  "reconciliation",
];

function categorizeEvent(type: string): Exclude<EventCategory, "all"> {
  if (type.includes("vote") || type.includes("election") || type.includes("candidate")) {
    return "election";
  }
  if (type.includes("heartbeat")) {
    return "heartbeat";
  }
  if (type.includes("commit") || type.includes("applied")) {
    return "commit";
  }
  if (type.includes("crash") || type.includes("restart") || type.includes("failure")) {
    return "failure";
  }
  if (type.includes("partition") || type.includes("network")) {
    return "partition";
  }
  if (type.includes("conflict") || type.includes("backtrack") || type.includes("reconciliation")) {
    return "reconciliation";
  }
  return "replication";
}

function formatCategory(category: EventCategory): string {
  if (category === "all") return "All";
  return category[0].toUpperCase() + category.slice(1);
}
