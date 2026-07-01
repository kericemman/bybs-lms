import { Button } from "./Button.jsx";

export function EmptyState({ title, description, icon: Icon, actionLabel, onAction }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-bybs-border bg-white p-8 text-center">
      {Icon ? (
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-md bg-bybs-pale text-bybs-blue">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      ) : null}
      <h3 className="text-base font-semibold text-bybs-navy">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm text-bybs-body">{description}</p> : null}
      {actionLabel ? (
        <Button className="mt-5" variant="secondary" onClick={onAction} type="button">
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
