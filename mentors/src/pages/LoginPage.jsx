import { ArrowRight, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Navigate replace to="/" />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      await login(form);
      navigate(location.state?.from?.pathname || "/", { replace: true });
    } catch (loginError) {
      setError(loginError.message || "Login failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bybs-page px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-bybs-border bg-white p-6 shadow-sm">
        <div className="mb-6">
          <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-md bg-bybs-blue text-white">
            <LockKeyhole className="h-6 w-6" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold uppercase text-bybs-blue">BYBS LMS</p>
          <h1 className="mt-2 text-2xl font-semibold text-bybs-navy">Mentor login</h1>
          <p className="mt-2 text-sm text-bybs-body">
            Sign in to review submissions, manage bookings, and support your assigned students.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-bybs-body">Email</span>
            <input
              className="mt-1 h-11 w-full rounded-md border border-bybs-border px-3 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale"
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              required
              type="email"
              value={form.email}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-bybs-body">Password</span>
            <input
              className="mt-1 h-11 w-full rounded-md border border-bybs-border px-3 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale"
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              required
              type="password"
              value={form.password}
            />
          </label>

          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

          <Button className="w-full" disabled={isSubmitting} icon={ArrowRight} type="submit">
            {isSubmitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </section>
    </main>
  );
}
