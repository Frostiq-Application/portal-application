import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Node 25 ships its own `localStorage` global, and with no backing file behind
// it that global is an inert object carrying none of the Storage methods — not
// even `getItem`. It shadows the working one jsdom puts on the window, so
// anything that persists a session dies on `localStorage.clear is not a
// function` under a local Node this new while passing on an older one. Install
// a real in-memory Storage so the suite behaves the same on every Node.
class MemoryStorage implements Storage {
  #entries = new Map<string, string>();
  get length() {
    return this.#entries.size;
  }
  key(i: number) {
    return [...this.#entries.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.#entries.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.#entries.set(String(k), String(v));
  }
  removeItem(k: string) {
    this.#entries.delete(k);
  }
  clear() {
    this.#entries.clear();
  }
  [key: string]: unknown;
}

for (const target of new Set<object>([globalThis, window])) {
  Object.defineProperty(target, "localStorage", {
    configurable: true,
    writable: true,
    value: new MemoryStorage(),
  });
}

// jsdom has no matchMedia; several shadcn primitives read it on mount.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

// Radix measures with ResizeObserver, which jsdom doesn't implement.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as never;

// Nor IntersectionObserver, which every infinitely-scrolled list watches its
// sentinel with. Nothing ever intersects in jsdom, so pages render their first
// batch and stay there — which is what the tests assert against.
globalThis.IntersectionObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
} as never;

afterEach(cleanup);
