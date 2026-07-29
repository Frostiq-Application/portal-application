import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

/**
 * Subscribes to the viewport breakpoint via `useSyncExternalStore` rather than
 * an effect that seeds state on mount. The browser already holds this value, so
 * reading it through a store gets the right answer on the very first render —
 * an effect renders `false` once and corrects itself, which shows up as a
 * desktop-then-mobile flicker on small screens.
 */
function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.innerWidth < MOBILE_BREAKPOINT,
    // No viewport on the server: match the old hook, which reported desktop
    // until the effect ran.
    () => false,
  )
}
