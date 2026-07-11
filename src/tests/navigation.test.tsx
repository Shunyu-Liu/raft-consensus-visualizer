import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "../app/App";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverStub;

describe("hash navigation", () => {
  afterEach(() => {
    window.location.hash = "";
  });

  it("opens Learn from #/learn and marks the current nav item", () => {
    window.location.hash = "#/learn";
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "Learn Raft" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Learn" })).toHaveAttribute("aria-current", "page");
  });

  it("opens Simulator from #/simulator and safely falls back for unknown hash", () => {
    window.location.hash = "#/unknown";
    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: "Simulator" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Simulator" })).toHaveAttribute("aria-current", "page");
  });

  it("can open a Learn scenario in the simulator and reset selection", () => {
    window.location.hash = "#/learn";
    render(<App />);

    const conflictingButton = screen.getAllByRole("button", {
      name: "Open Conflicting Logs and Log Reconciliation",
    })[0];
    fireEvent.click(conflictingButton);

    expect(window.location.hash).toBe("#/simulator");
    expect(screen.getByRole("heading", { level: 1, name: "Simulator" })).toBeInTheDocument();
    expect(screen.getByLabelText("Scenario")).toHaveValue("conflicting-logs");
  });
});
