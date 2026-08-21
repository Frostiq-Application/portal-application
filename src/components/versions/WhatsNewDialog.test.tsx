import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import userEvent from "@testing-library/user-event";
import type { LatestVersion } from "@/types/versions";

/**
 * The rule this dialog exists to enforce: shown once, to the people who
 * haven't read it, for a release that asked to be announced — and 1.0.0 never
 * announces itself.
 */
const state = vi.hoisted(() => ({
  latest: null as LatestVersion | null,
  markSeen: vi.fn(),
}));

vi.mock("@/features/api/versionsApi", () => ({
  useLatestVersionQuery: () => ({ data: state.latest }),
  useMarkVersionSeenMutation: () => [state.markSeen],
}));

const { WhatsNewDialog } = await import("./WhatsNewDialog");

/** The footer links out to the history page, so the dialog needs a router. */
const mount = () =>
  render(
    <MemoryRouter>
      <WhatsNewDialog />
    </MemoryRouter>,
  );

const version = (over: Partial<LatestVersion> = {}): LatestVersion => ({
  id: "v-2",
  version: "1.1.0",
  title: "Bulk upload for menus",
  tags: ["Catalog"],
  notes: "## What's new\n\n- Upload a menu from a spreadsheet",
  releasedAt: "2026-08-20T00:00:00.000Z",
  seen: false,
  notify: true,
  ...over,
});

beforeEach(() => {
  state.latest = null;
  state.markSeen = vi.fn();
});

describe("WhatsNewDialog", () => {
  it("shows the note for an unread release", () => {
    state.latest = version();
    mount();
    expect(screen.getByText("Bulk upload for menus")).toBeInTheDocument();
    expect(screen.getByText(/Version 1.1.0/)).toBeInTheDocument();
    expect(
      screen.getByText("Upload a menu from a spreadsheet"),
    ).toBeInTheDocument();
  });

  it("shows the tags the release was labelled with", () => {
    state.latest = version({ tags: ["Catalog", "Orders"] });
    mount();
    expect(screen.getByText("Catalog")).toBeInTheDocument();
    expect(screen.getByText("Orders")).toBeInTheDocument();
  });

  it("stays shut once this user has read it", () => {
    state.latest = version({ seen: true });
    mount();
    expect(screen.queryByText("Bulk upload for menus")).not.toBeInTheDocument();
  });

  it("stays shut for a release published quietly — 1.0.0 included", () => {
    state.latest = version({
      id: "v-1",
      version: "1.0.0",
      title: "First release",
      notify: false,
    });
    mount();
    expect(screen.queryByText("First release")).not.toBeInTheDocument();
  });

  it("stays shut when nothing has been published yet", () => {
    state.latest = null;
    const { container } = mount();
    expect(container).toBeEmptyDOMElement();
  });

  it("records the read on the server when dismissed, and does not come back", async () => {
    state.latest = version();
    mount();
    await userEvent.click(screen.getByRole("button", { name: "Got it" }));

    expect(state.markSeen).toHaveBeenCalledWith("v-2");
    expect(screen.queryByText("Bulk upload for menus")).not.toBeInTheDocument();
  });
});
