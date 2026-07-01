import { STATUS_TONES } from "../constants/statuses.js";
import { cn } from "../lib/cn.js";

const toneClasses = {
  success: "bg-bybs-pale text-bybs-blue ring-bybs-border",
  info: "bg-bybs-pale text-bybs-blue ring-bybs-border",
  warning: "bg-bybs-gold/30 text-bybs-navy ring-bybs-border",
  danger: "bg-bybs-blush text-bybs-rose ring-bybs-border",
  neutral: "bg-white text-bybs-body ring-bybs-border"
};

function humanize(value) {
  return String(value)
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

export function StatusBadge({ status, label, tone, className }) {
  const resolvedTone = tone || STATUS_TONES[status] || "neutral";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        toneClasses[resolvedTone],
        className
      )}
    >
      {label || humanize(status)}
    </span>
  );
}
