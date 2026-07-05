import { cn } from "../lib/cn.js";

export function StatCard({ label, value, hint, icon: Icon, tone = "primary" }) {
  const tones = {
    primary: "bg-bybs-pale text-bybs-blue",
    blue: "bg-bybs-pale text-bybs-blue",
    rose: "bg-bybs-blush text-bybs-rose",
    gold: "bg-bybs-gold/30 text-bybs-navy"
  };

  return (
    <div className="rounded-lg border border-bybs-border bg-white p-3 shadow-sm sm:p-4">
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <p className="text-xs leading-5 text-bybs-body sm:text-sm">{label}</p>
          <p className="mt-1 text-xl font-semibold text-bybs-navy sm:mt-2 sm:text-2xl">{value}</p>
        </div>
        {Icon ? (
          <span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md sm:h-9 sm:w-9", tones[tone])}>
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-3 text-xs text-bybs-muted">{hint}</p> : null}
    </div>
  );
}
