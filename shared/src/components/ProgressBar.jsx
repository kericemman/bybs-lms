export function ProgressBar({ value = 0, label }) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-bybs-body">{label || "Progress"}</span>
        <span className="text-bybs-muted">{safeValue}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-bybs-pale">
        <div className="h-full rounded-full bg-bybs-blue transition-all" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}
