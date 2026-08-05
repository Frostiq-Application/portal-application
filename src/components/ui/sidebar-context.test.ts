import { afterEach, describe, expect, it } from "vitest";
import { SIDEBAR_COOKIE_NAME, initialSidebarOpen } from "./sidebar-context";

/**
 * What the sidebar opens as.
 *
 * A tablet has roughly a phone's worth of usable width once 16rem goes to
 * navigation, so it opens collapsed to the icon rail. The toggle writes a
 * cookie and that choice has to survive a reload — but it is one cookie across
 * every device, so it can only ever *narrow* the sidebar, never widen it onto a
 * screen with no room. Otherwise one toggle at a desk would follow the account
 * onto every tablet it ever signs in from.
 */
function setWidth(px: number) {
  Object.defineProperty(window, "innerWidth", {
    value: px,
    configurable: true,
    writable: true,
  });
}

function setStored(value: string | null) {
  document.cookie = `${SIDEBAR_COOKIE_NAME}=; path=/; max-age=0`;
  if (value !== null) {
    document.cookie = `${SIDEBAR_COOKIE_NAME}=${value}; path=/`;
  }
}

afterEach(() => {
  setStored(null);
  setWidth(1024);
});

describe("initialSidebarOpen", () => {
  it("opens collapsed on a tablet", () => {
    setStored(null);
    setWidth(768); // iPad Mini, portrait
    expect(initialSidebarOpen()).toBe(false);

    setWidth(1023); // the widest screen still treated as a tablet
    expect(initialSidebarOpen()).toBe(false);
  });

  it("opens expanded once there is room for it", () => {
    setStored(null);
    setWidth(1440);
    expect(initialSidebarOpen()).toBe(true);

    // The boundary itself counts as room.
    setWidth(1024);
    expect(initialSidebarOpen()).toBe(true);
  });

  it("lets a stored collapse beat a wide viewport", () => {
    setStored("false");
    setWidth(1920);
    expect(initialSidebarOpen()).toBe(false);
  });

  it("keeps a stored expand from prising the rail open on a tablet", () => {
    // One cookie covers every device the account signs in from, so a toggle at
    // a desk must not decide what a tablet opens as.
    setStored("true");
    setWidth(768);
    expect(initialSidebarOpen()).toBe(false);

    setWidth(1023);
    expect(initialSidebarOpen()).toBe(false);
  });

  it("still honours a stored expand where there is room", () => {
    setStored("true");
    setWidth(1440);
    expect(initialSidebarOpen()).toBe(true);
  });

  it("isn't fooled by a cookie whose name merely contains this one", () => {
    document.cookie = "other_sidebar_state=true; path=/";
    setStored(null);
    setWidth(768);
    expect(initialSidebarOpen()).toBe(false);
    document.cookie = "other_sidebar_state=; path=/; max-age=0";
  });
});
