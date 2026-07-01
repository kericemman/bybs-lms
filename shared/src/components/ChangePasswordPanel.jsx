import { KeyRound, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button.jsx";
import { Card } from "./Card.jsx";

const inputClassName =
  "h-11 w-full min-w-0 rounded-md border border-bybs-border bg-white px-3 text-sm outline-none transition focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";

function validatePassword(password) {
  if (password.length < 12) return "Use at least 12 characters.";
  if (!/[a-z]/.test(password)) return "Add a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Add an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Add a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Add a symbol.";
  return "";
}

export function ChangePasswordPanel({
  force = false,
  onChangePassword,
  title = "Change password",
  description = "Update your temporary password before continuing with sensitive work."
}) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const validationError = validatePassword(form.newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setIsSaving(true);
    try {
      await onChangePassword?.({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword
      });
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccess("Password updated.");
    } catch (requestError) {
      setError(requestError.message || "Password could not be updated.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card className={force ? "border-bybs-gold bg-bybs-pale" : ""}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-bybs-blue ring-1 ring-bybs-border">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold uppercase text-bybs-blue">Account security</p>
            <h2 className="mt-1 text-lg font-semibold text-bybs-navy">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-bybs-body">{description}</p>
          </div>
        </div>
      </div>

      <form className="mt-5 grid gap-4 lg:grid-cols-3" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-sm font-semibold text-bybs-navy">Current password</span>
          <input
            autoComplete="current-password"
            className={`${inputClassName} mt-1.5`}
            onChange={(event) => updateField("currentPassword", event.target.value)}
            required
            type="password"
            value={form.currentPassword}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-bybs-navy">New password</span>
          <input
            autoComplete="new-password"
            className={`${inputClassName} mt-1.5`}
            onChange={(event) => updateField("newPassword", event.target.value)}
            required
            type="password"
            value={form.newPassword}
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-bybs-navy">Confirm new password</span>
          <input
            autoComplete="new-password"
            className={`${inputClassName} mt-1.5`}
            onChange={(event) => updateField("confirmPassword", event.target.value)}
            required
            type="password"
            value={form.confirmPassword}
          />
        </label>
        {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm font-semibold text-bybs-rose lg:col-span-3">{error}</p> : null}
        {success ? <p className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-bybs-blue ring-1 ring-bybs-border lg:col-span-3">{success}</p> : null}
        <div className="lg:col-span-3">
          <Button disabled={isSaving} icon={isSaving ? Loader2 : KeyRound} type="submit">
            {isSaving ? "Updating..." : "Update password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
