import * as React from "react"

export const SIDEBAR_COOKIE_NAME = "sidebar_state"
export const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

/**
 * Below this width the sidebar opens collapsed to its icon rail, whatever the
 * last toggle said. A tablet in portrait has roughly a phone's worth of usable
 * width once 16rem goes to navigation, so starting expanded leaves the page it
 * is navigating squeezed into what's left. Phones are unaffected — under 768px
 * the sidebar is a sheet that starts closed anyway.
 */
const SIDEBAR_EXPANDED_MIN_WIDTH = 1024

/**
 * The state the sidebar should open in.
 *
 * A stored choice is honoured, with one asymmetry: collapsing carries
 * everywhere, expanding only where there is room for it. The cookie is not
 * per-device, so a single toggle on a desktop used to follow the account onto
 * every tablet forever — the viewport rule below could never fire again, and
 * the icon rail became unreachable on the screens that need it most.
 *
 * Collapsing is safe to carry because it never costs the page any width.
 *
 * The cookie was previously written and never read, so `defaultOpen` stayed
 * true whatever the screen or the last choice — which is why every reload
 * sprang the sidebar back open.
 */
export function initialSidebarOpen(): boolean {
  const roomToExpand =
    typeof window === "undefined" ||
    window.innerWidth >= SIDEBAR_EXPANDED_MIN_WIDTH

  if (typeof document !== "undefined") {
    const stored = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${SIDEBAR_COOKIE_NAME}=(true|false)(?:;|$)`),
    )
    if (stored) return stored[1] === "true" && roomToExpand
  }
  return roomToExpand
}

/**
 * Kept out of sidebar.tsx so that file exports only components — a module
 * mixing components with a hook drops out of Fast Refresh.
 */
export type SidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
}

export const SidebarContext = React.createContext<SidebarContextProps | null>(
  null,
)

export function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}
