import { useEffect } from "react";

interface Options {
  /**
   * Fired when the customer tried to leave and we managed to stop them. Used to
   * escalate the on-screen warning — the browser's own dialog gives us no
   * callback, so this only covers the attempts we intercept ourselves.
   */
  onAttempt?: () => void;
  /**
   * Trap the Back button with a history sentinel. Off by default: while a
   * third-party payment modal is open it owns the history stack (Razorpay
   * closes itself on Back), and fighting it there breaks its dismiss.
   */
  guardBackButton?: boolean;
}

/**
 * Holds the tab still while money is moving.
 *
 * The window this protects starts when the customer commits to paying and ends
 * when the app has written down what they bought. Losing the tab in between is
 * the worst moment in the product: the charge may already have happened, and
 * the person has no way to tell.
 *
 * What is actually enforceable is narrow, so it is worth being precise:
 *  - `beforeunload` raises the browser's own confirm dialog on refresh, tab
 *    close and window close. The wording is the browser's — custom strings have
 *    been ignored since Chrome 51 — so all we control is whether it appears.
 *  - Reload/close **keyboard shortcuts** can be swallowed before they get that
 *    far, which is what makes the warning feel like a response rather than a
 *    generic prompt. Toolbar buttons and Safari's Cmd+R never reach the page;
 *    `beforeunload` is the backstop for those.
 *  - Back is trapped with a duplicate history entry, when opted in.
 *
 * None of this is a data-integrity mechanism. The Razorpay webhook settles the
 * same payment server-side and is idempotent, so a killed tab still ends up with
 * the right subscription. The guard exists so nobody has to discover that while
 * wondering whether they have just paid for nothing.
 */
export function usePaymentExitGuard(active: boolean, options: Options = {}) {
  const { onAttempt, guardBackButton = false } = options;

  useEffect(() => {
    if (!active) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const meta = e.metaKey || e.ctrlKey;
      if (key === "f5" || (meta && (key === "r" || key === "w"))) {
        e.preventDefault();
        e.stopPropagation();
        onAttempt?.();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    // Capture phase, so the shortcut is dead before any focused control sees it.
    window.addEventListener("keydown", onKeyDown, true);

    let onPopState: (() => void) | undefined;
    if (guardBackButton) {
      // The sentinel goes on up front so the first Back lands on a duplicate of
      // the current URL: the router re-renders the same route (nothing moves)
      // and we immediately push it again.
      window.history.pushState(null, "", window.location.href);
      onPopState = () => {
        window.history.pushState(null, "", window.location.href);
        onAttempt?.();
      };
      window.addEventListener("popstate", onPopState);
    }

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("keydown", onKeyDown, true);
      if (onPopState) window.removeEventListener("popstate", onPopState);
    };
  }, [active, onAttempt, guardBackButton]);
}
