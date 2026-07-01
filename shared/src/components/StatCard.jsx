import { cn } from "../lib/cn.js";

export function StatCard({ label, value, hint, icon: Icon, tone = "primary" }) {
  const tones = {
    primary: "bg-bybs-pale text-bybs-blue",
    blue: "bg-bybs-pale text-bybs-blue",
    rose: "bg-bybs-blush text-bybs-rose",
    gold: "bg-bybs-gold/30 text-bybs-navy"
  };

  return (
    <div className="rounded-lg border border-bybs-border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-bybs-body">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-bybs-navy">{value}</p>
        </div>
        {Icon ? (
          <span className={cn("inline-flex h-10 w-10 items-center justify-center rounded-md", tones[tone])}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
      </div>
      {hint ? <p className="mt-3 text-xs text-bybs-muted">{hint}</p> : null}
    </div>
  );
}
