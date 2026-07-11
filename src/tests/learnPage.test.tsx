import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LearnPage } from "../components/learn/LearnPage";
import { getAvailableScenarios } from "../simulator/scenarios/registry";

describe("LearnPage", () => {
  it("renders the major learning sections and one main h1", () => {
    render(<LearnPage scenarios={getAvailableScenarios()} onOpenScenario={vi.fn()} />);

    expect(screen.getByRole("heading", { level: 1, name: "Learn Raft" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Learning Path" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Raft Safety Properties" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Scenario Guide" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Common Misconceptions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Glossary" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "References" })).toBeInTheDocument();
    expect(screen.getByText(/not a production Raft implementation/i)).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });

  it("filters glossary search and shows the no-results empty state", () => {
    render(<LearnPage scenarios={getAvailableScenarios()} onOpenScenario={vi.fn()} />);

    const search = screen.getByLabelText("Search Glossary");
    fireEvent.change(search, { target: { value: "heartbeat" } });
    expect(screen.getAllByText("Heartbeat").length).toBeGreaterThan(0);

    fireEvent.change(search, { target: { value: "zzzz-no-match" } });
    expect(screen.getByText("No glossary terms match your search.")).toBeInTheDocument();
  });

  it("opens scenario ids through the provided callback", () => {
    const openScenario = vi.fn();
    render(<LearnPage scenarios={getAvailableScenarios()} onOpenScenario={openScenario} />);

    fireEvent.click(screen.getAllByRole("button", { name: /Open in Simulator/i })[0]);
    expect(openScenario).toHaveBeenCalledWith("basic-leader-election");
  });
});
