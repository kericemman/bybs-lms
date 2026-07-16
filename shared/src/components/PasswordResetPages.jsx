import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button.jsx";

const inputClassName =
  "mt-1 h-11 w-full rounded-md border border-bybs-border bg-white px-3 text-sm outline-none transition focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";

function validatePassword(password) {
  if (password.length < 12) return "Use at least 12 characters.";
  if (!/[a-z]/.test(password)) return "Add a lowercase letter.";
  if (!/[A-Z]/.test(password)) return "Add an uppercase letter.";
  if (!/[0-9]/.test(password)) return "Add a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Add a symbol.";
  return "";
}

function AuthShell({ children, description, icon: Icon, title }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bybs-page px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-bybs-border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-md bg-bybs-blue text-white">
            <Icon className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold uppercase text-bybs-blue">BYBS LMS</p>
          <h1 className="mt-2 text-2xl font-semibold text-bybs-navy">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-bybs-body">{description}</p>
        </div>
        {children}
      </section>
    </main>
  );
}

export function ForgotPasswordPage({
  description = "Enter your account email and we will send a secure password reset link if it matches a BYBS LMS account.",
  loginPath = "/login",
  onRequestReset,
  title = "Forgot password"
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await onRequestReset?.(email);
      setMessage(
        response?.message ||
          "If this email belongs to a BYBS mentor or mentee account, a password reset link will be sent shortly."
      );
    } catch (requestError) {
      setError(requestError.message || "Password reset could not be started.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell description={description} icon={Mail} title={title}>
      {message ? (
        <div className="rounded-md border border-bybs-border bg-bybs-pale p-4">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-bybs-blue" aria-hidden="true" />
            <div>
              <p className="font-semibold text-bybs-navy">Check your email</p>
              <p className="mt-1 text-sm leading-6 text-bybs-body">{message}</p>
              <p className="mt-2 text-sm leading-6 text-bybs-muted">
                The link expires after 30 minutes. Check spam or junk if it does not appear in your inbox.
              </p>
            </div>
          </div>
          <Button as="a" className="mt-4 w-full" href={loginPath} icon={ArrowLeft} variant="secondary">
            Back to login
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-bybs-body">Email</span>
            <input
              autoComplete="email"
              className={inputClassName}
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

          <Button className="w-full" disabled={isSubmitting} icon={isSubmitting ? Loader2 : ArrowRight} type="submit">
            {isSubmitting ? "Sending..." : "Send reset link"}
          </Button>
          <Button as="a" className="w-full" href={loginPath} icon={ArrowLeft} variant="ghost">
            Back to login
          </Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordPage({
  description = "Choose a new password for your BYBS LMS account.",
  loginPath = "/login",
  onResetPassword,
  title = "Reset password",
  token
}) {
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError("Reset link is missing or invalid. Please request a new link.");
      return;
    }

    const validationError = validatePassword(form.newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await onResetPassword?.({
        token,
        newPassword: form.newPassword
      });
      setForm({ newPassword: "", confirmPassword: "" });
      setSuccess(response?.message || "Password has been reset. You can now sign in with your new password.");
    } catch (requestError) {
      setError(requestError.message || "Password could not be reset.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell description={description} icon={KeyRound} title={title}>
      {success ? (
        <div className="rounded-md border border-bybs-border bg-bybs-pale p-4">
          <div className="flex gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-bybs-blue" aria-hidden="true" />
            <div>
              <p className="font-semibold text-bybs-navy">Password updated</p>
              <p className="mt-1 text-sm leading-6 text-bybs-body">{success}</p>
            </div>
          </div>
          <Button as="a" className="mt-4 w-full" href={loginPath} icon={ArrowRight}>
            Sign in
          </Button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={handleSubmit}>
          {!token ? (
            <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">
              Reset link is missing or invalid. Please request a new password reset link.
            </p>
          ) : null}

          <label className="block">
            <span className="text-sm font-medium text-bybs-body">New password</span>
            <input
              autoComplete="new-password"
              className={inputClassName}
              onChange={(event) => updateField("newPassword", event.target.value)}
              required
              type="password"
              value={form.newPassword}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-bybs-body">Confirm new password</span>
            <input
              autoComplete="new-password"
              className={inputClassName}
              onChange={(event) => updateField("confirmPassword", event.target.value)}
              required
              type="password"
              value={form.confirmPassword}
            />
          </label>

          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

          <Button className="w-full" disabled={isSubmitting || !token} icon={isSubmitting ? Loader2 : KeyRound} type="submit">
            {isSubmitting ? "Resetting..." : "Reset password"}
          </Button>
          <Button as="a" className="w-full" href={loginPath} icon={ArrowLeft} variant="ghost">
            Back to login
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
