import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const LOADING_EVENT = "bybs:global-loading";

export function emitGlobalLoading(action) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LOADING_EVENT, { detail: { action } }));
}

export function GlobalLoader({ label = "Loading..." }) {
  const [activeRequests, setActiveRequests] = useState(0);

  useEffect(() => {
    function handleLoading(event) {
      setActiveRequests((current) => {
        if (event.detail?.action === "start") return current + 1;
        return Math.max(current - 1, 0);
      });
    }

    window.addEventListener(LOADING_EVENT, handleLoading);
    return () => window.removeEventListener(LOADING_EVENT, handleLoading);
  }, []);

  if (!activeRequests) return null;

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-[100] h-1 bg-bybs-pale" aria-hidden="true">
        <div className="h-full w-2/5 animate-pulse bg-bybs-blue" />
      </div>
      <div
        aria-live="polite"
        className="fixed right-4 top-20 z-[100] inline-flex items-center gap-2 rounded-md border border-bybs-border bg-white px-3 py-2 text-sm font-medium text-bybs-navy shadow-md"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin text-bybs-blue" aria-hidden="true" />
        <span>{label}</span>
      </div>
    </>
  );
}
