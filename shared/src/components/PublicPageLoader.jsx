import { Loader2 } from "lucide-react";

export function PublicPageLoader({ brandName = "BYBS LMS", logoSrc = "/assets/Logo1.png", label = "Loading BYBS..." }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bybs-page px-4 text-bybs-text" role="status" aria-live="polite">
      <div className="grid justify-items-center gap-4 rounded-lg border border-bybs-border bg-white p-6 text-center shadow-sm">
        <img alt={brandName} className="h-14 w-14 object-contain" src={logoSrc} />
        <Loader2 className="h-6 w-6 animate-spin text-bybs-blue" aria-hidden="true" />
        <p className="text-sm font-semibold text-bybs-navy">{label}</p>
      </div>
    </div>
  );
}
