import { Loader2, MessageSquarePlus, RefreshCw, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./Button.jsx";
import { Card } from "./Card.jsx";
import { DataTable } from "./DataTable.jsx";
import { PageHeader } from "./PageHeader.jsx";
import { StatusBadge } from "./StatusBadge.jsx";

const inputClassName =
  "h-10 w-full rounded-md border border-bybs-border bg-white px-3 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";
const textAreaClassName =
  "min-h-32 w-full rounded-md border border-bybs-border bg-white px-3 py-2 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";

const categories = [
  ["overall", "Overall experience"],
  ["bug", "Bug or error"],
  ["navigation", "Navigation"],
  ["content", "Content or resources"],
  ["assignments", "Assignments"],
  ["sessions", "Sessions"],
  ["notifications", "Notifications"],
  ["performance", "Speed or performance"],
  ["support", "Support"],
  ["featureRequest", "Feature request"],
  ["other", "Other"]
];

const statusTone = {
  new: "info",
  reviewed: "warning",
  resolved: "success"
};

function categoryLabel(value) {
  return categories.find(([category]) => category === value)?.[1] || value || "Overall experience";
}

function formatDateTime(value) {
  if (!value) return "Not set";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

function initialForm() {
  return {
    category: "overall",
    rating: "4",
    subject: "",
    message: ""
  };
}

export function BetaFeedbackWorkspace({
  description = "Share what is working, what is confusing, and what BYBS should improve during beta testing.",
  listFeedback,
  submitFeedback,
  title = "Beta Feedback"
}) {
  const [feedbackRows, setFeedbackRows] = useState([]);
  const [form, setForm] = useState(() => initialForm());
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadFeedback() {
    setIsLoading(true);
    try {
      const response = await listFeedback?.();
      setFeedbackRows(response?.data || []);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadFeedback().catch((requestError) => {
      setError(requestError.message || "Could not load beta feedback.");
      setIsLoading(false);
    });
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      await submitFeedback?.({
        ...form,
        rating: Number(form.rating)
      });
      setFeedback("Thank you. Your beta feedback has been sent to the BYBS admin team.");
      setForm(initialForm());
      await loadFeedback();
    } catch (requestError) {
      setError(requestError.message || "Could not send beta feedback.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button disabled={isLoading} icon={isLoading ? Loader2 : RefreshCw} onClick={() => loadFeedback()} type="button" variant="secondary">
            {isLoading ? "Loading..." : "Refresh"}
          </Button>
        }
        description={description}
        title={title}
      />

      <Card>
        <form className="grid gap-4 lg:grid-cols-3" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-bybs-body">Feedback area</span>
            <select
              className={inputClassName}
              onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              value={form.category}
            >
              {categories.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-bybs-body">Rating</span>
            <select
              className={inputClassName}
              onChange={(event) => setForm((current) => ({ ...current, rating: event.target.value }))}
              value={form.rating}
            >
              <option value="5">5 - Excellent</option>
              <option value="4">4 - Good</option>
              <option value="3">3 - Okay</option>
              <option value="2">2 - Needs work</option>
              <option value="1">1 - Blocking my work</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-medium text-bybs-body">Subject</span>
            <input
              className={inputClassName}
              onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
              placeholder="Example: Assignment upload was clear"
              required
              value={form.subject}
            />
          </label>
          <label className="block lg:col-span-3">
            <span className="text-sm font-medium text-bybs-body">Feedback</span>
            <textarea
              className={textAreaClassName}
              onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
              placeholder="Tell the admin team what happened, what you expected, and what would make the platform easier to use."
              required
              value={form.message}
            />
          </label>
          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-3">{error}</p> : null}
          {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue lg:col-span-3">{feedback}</p> : null}
          <div className="lg:col-span-3">
            <Button disabled={isSubmitting} icon={isSubmitting ? Loader2 : MessageSquarePlus} type="submit">
              {isSubmitting ? "Sending..." : "Send beta feedback"}
            </Button>
          </div>
        </form>
      </Card>

      {isLoading ? (
        <Card>
          <div className="flex items-center gap-3 text-sm text-bybs-body">
            <Loader2 className="h-5 w-5 animate-spin text-bybs-blue" aria-hidden="true" />
            Loading your feedback...
          </div>
        </Card>
      ) : (
        <DataTable
          columns={[
            {
              key: "subject",
              header: "Feedback",
              wrap: true,
              render: (row) => (
                <div>
                  <p className="font-medium text-bybs-navy">{row.subject}</p>
                  <p className="mt-1 text-xs text-bybs-muted">{categoryLabel(row.category)}</p>
                </div>
              )
            },
            {
              key: "rating",
              header: "Rating",
              render: (row) => (
                <span className="inline-flex items-center gap-1 font-medium text-bybs-navy">
                  <Star className="h-4 w-4 fill-bybs-gold text-bybs-gold" aria-hidden="true" />
                  {row.rating}/5
                </span>
              )
            },
            { key: "message", header: "Message", wrap: true },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} tone={statusTone[row.status]} /> },
            { key: "createdAt", header: "Sent", render: (row) => formatDateTime(row.createdAt) }
          ]}
          emptyDescription="Your beta feedback will appear here after you send it."
          emptyTitle="No beta feedback yet"
          rows={feedbackRows}
        />
      )}
    </div>
  );
}
