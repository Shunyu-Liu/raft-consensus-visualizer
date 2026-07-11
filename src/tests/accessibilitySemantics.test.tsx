import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../app/App";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub;

describe("accessibility semantics", () => {
  it("uses semantic navigation, main content, labels, tabs, and live region", () => {
    window.location.hash = "#/simulator";
    render(<App />);

    expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByLabelText("Scenario")).toBeInTheDocument();
    expect(screen.getByLabelText("Client command")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by Category")).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Inspector sections" })).toBeInTheDocument();
    expect(screen.getByText("Raft Explorer is ready.")).toBeInTheDocument();
  });

  it("does not trigger simulator shortcuts while focus is inside an input", () => {
    window.location.hash = "#/simulator";
    render(<App />);

    const commandInput = screen.getByLabelText("Client command");
    fireEvent.keyDown(commandInput, { key: "n" });

    expect(screen.getByText("No events yet. Start the simulation or execute the next step.")).toBeInTheDocument();
  });

  it("does not run simulator shortcuts on the Learn page", () => {
    window.location.hash = "#/learn";
    render(<App />);

    fireEvent.keyDown(window, { key: "n" });

    expect(screen.getByRole("heading", { level: 1, name: "Learn Raft" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1, name: "Simulator" })).not.toBeInTheDocument();
  });
});
