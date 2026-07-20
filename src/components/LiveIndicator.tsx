import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StreamStatus } from "@/hooks/useSseStream";

/** Small live/offline pill reflecting an SSE connection state. */
export function LiveIndicator({ status }: { status: StreamStatus }) {
  const map = {
    open: {
      Icon: Wifi,
      label: "Live",
      cls: "text-emerald-600 dark:text-emerald-400",
      dot: "bg-emerald-500",
      pulse: true,
    },
    connecting: {
      Icon: Wifi,
      label: "Connecting…",
      cls: "text-amber-600 dark:text-amber-400",
      dot: "bg-amber-500",
      pulse: true,
    },
    closed: {
      Icon: WifiOff,
      label: "Offline",
      cls: "text-muted-foreground",
      dot: "bg-muted-foreground/50",
      pulse: false,
    },
  }[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        map.cls,
      )}
      title={`Realtime updates: ${map.label}`}
    >
      <span className="relative flex h-2 w-2">
        {map.pulse && (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              map.dot,
            )}
          />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", map.dot)} />
      </span>
      {map.label}
    </span>
  );
}
