export function FormField({ label, children, hint }) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-medium text-bybs-body">{label}</span>
      <div className="mt-1 min-w-0">{children}</div>
      {hint ? <p className="mt-1 text-xs text-bybs-muted">{hint}</p> : null}
    </label>
  );
}

export const inputClassName =
  "h-10 w-full min-w-0 rounded-md border border-bybs-border px-3 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";

export const textAreaClassName =
  "min-h-24 w-full min-w-0 rounded-md border border-bybs-border px-3 py-2 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";
