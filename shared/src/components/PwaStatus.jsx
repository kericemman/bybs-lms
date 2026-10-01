import { RefreshCw, WifiOff } from "lucide-react";
import { usePwa } from "../hooks/usePwa.js";

export function PwaStatus() {
  const { applyUpdate, isOnline, isUpdating, updateReady } = usePwa();

  if (isOnline && !updateReady) return null;

  return (
    <div
      aria-live="polite"
      className="fixed inset-x-3 bottom-3 z-[140] mx-auto flex max-w-xl items-center justify-between gap-3 rounded-lg border border-bybs-border bg-white px-4 py-3 text-sm shadow-xl sm:inset-x-auto sm:left-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2"
      role="status"
    >
      <div className="flex min-w-0 items-center gap-3">
        {isOnline ? (
          <RefreshCw className="h-5 w-5 shrink-0 text-bybs-blue" aria-hidden="true" />
        ) : (
          <WifiOff className="h-5 w-5 shrink-0 text-bybs-rose" aria-hidden="true" />
        )}
        <p className="leading-5 text-bybs-body">
          {isOnline
            ? "A new BYBS LMS version is ready."
            : "You are offline. Live LMS actions will resume when your connection returns."}
        </p>
      </div>
      {isOnline && updateReady ? (
        <button
          className="min-h-11 shrink-0 rounded-md bg-bybs-blue px-3 py-2 font-semibold text-white transition hover:bg-bybs-blueHover disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-10"
          disabled={isUpdating}
          onClick={applyUpdate}
          type="button"
        >
          {isUpdating ? "Updating..." : "Update app"}
        </button>
      ) : null}
    </div>
  );
}
