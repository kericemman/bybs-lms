import { Button } from "./Button.jsx";

export function QuickAction({ title, description, icon: Icon, actionLabel, onClick }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-bybs-border bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        {Icon ? (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-bybs-pale text-bybs-blue">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
        <div>
          <h3 className="text-sm font-semibold text-bybs-navy">{title}</h3>
          {description ? <p className="mt-1 text-sm text-bybs-body">{description}</p> : null}
        </div>
      </div>
      {actionLabel ? (
        <Button variant="secondary" size="sm" onClick={onClick} type="button">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
