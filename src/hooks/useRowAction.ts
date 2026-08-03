import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { apiError } from "@/lib/apiError";

/**
 * Runs a per-row mutation — suspend, approve, activate — with the wait made
 * visible: the row is marked busy for as long as the request is out, and a
 * loading toast is raised straight away and then swapped in place for the
 * result. Without it a status change is a click, a silent pause of however
 * long the API takes, and then a success message for something the user had
 * no way of knowing was under way.
 *
 * Rows are tracked by id, so two shops can be acted on at once and neither
 * blocks the other. A second click on a row already in flight is dropped.
 */
interface RunOptions {
  /** Row the action belongs to — the account or branch id. */
  id: string;
  /** Shown on the row and in the loading toast, e.g. "Suspending shop…". */
  pending: string;
  /** Replaces the loading toast when the request succeeds. */
  success: string;
}

export interface RowAction {
  /** The pending label for `id`, or null when that row is idle. */
  busyLabel: (id: string) => string | null;
  /** Resolves true only if the request succeeded. */
  run: (opts: RunOptions, fn: () => Promise<unknown>) => Promise<boolean>;
}

export function useRowAction(): RowAction {
  const [pending, setPending] = useState<Record<string, string>>({});
  // The guard has to answer synchronously on the click — a state updater only
  // runs on the next render, by which point a second click has already fired.
  const inFlight = useRef(new Set<string>());

  const run = useCallback(
    async (
      { id, pending: label, success }: RunOptions,
      fn: () => Promise<unknown>,
    ) => {
      if (inFlight.current.has(id)) return false;
      inFlight.current.add(id);
      setPending((prev) => ({ ...prev, [id]: label }));

      const toastId = toast.loading(label);
      try {
        await fn();
        toast.success(success, { id: toastId });
        return true;
      } catch (err) {
        toast.error(apiError(err), { id: toastId });
        return false;
      } finally {
        inFlight.current.delete(id);
        setPending((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
    },
    [],
  );

  const busyLabel = useCallback((id: string) => pending[id] ?? null, [pending]);

  return { busyLabel, run };
}
