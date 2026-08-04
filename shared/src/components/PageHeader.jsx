import { cn } from "../lib/cn.js";

export function PageHeader({ title, description, actions, className }) {
  return (
    <div className={cn("flex min-w-0 max-w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-semibold tracking-normal text-bybs-navy">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl break-words text-sm text-bybs-body">{description}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
