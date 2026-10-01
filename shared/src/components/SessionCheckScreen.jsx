import { Loader2 } from "lucide-react";

export function SessionCheckScreen() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-screen items-center justify-center bg-bybs-page px-4"
    >
      <div className="flex items-center gap-3 rounded-md border border-bybs-border bg-white px-4 py-3 text-sm text-bybs-body shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-bybs-blue" aria-hidden="true" />
        Checking your session...
      </div>
    </main>
  );
}
