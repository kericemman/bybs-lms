import { LifeBuoy, MessageCircle, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, EmptyState, PageHeader, SafeHtml, StatusBadge } from "@bybs/shared";
import { studentApi } from "../services/api.js";
import { formatDateTime } from "../utils/format.js";

const inputClassName = "h-10 w-full rounded-md border border-bybs-border px-3 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";
const textareaClassName = "min-h-28 w-full rounded-md border border-bybs-border px-3 py-2 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";
const categories = [
  ["assignment", "Assignment"],
  ["mentor", "Mentor"],
  ["resourceAccess", "Resource access"],
  ["technical", "Technical"],
  ["login", "Login"],
  ["general", "General"]
];

export function SupportPage() {
  const [tickets, setTickets] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [replyTicketId, setReplyTicketId] = useState("");
  const [reply, setReply] = useState("");
  const [form, setForm] = useState({ category: "general", subject: "", message: "" });
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadTickets() {
    const response = await studentApi.listSupportTickets();
    setTickets(response.data);
  }

  useEffect(() => {
    loadTickets().catch((loadError) => setError(loadError.message));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      await studentApi.createSupportTicket(form);
      setFeedback("Support ticket created.");
      setForm({ category: "general", subject: "", message: "" });
      setShowForm(false);
      await loadTickets();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReply(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      await studentApi.replySupportTicket(replyTicketId, { message: reply });
      setFeedback("Reply added.");
      setReply("");
      setReplyTicketId("");
      await loadTickets();
    } catch (replyError) {
      setError(replyError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<Button icon={Plus} onClick={() => setShowForm((current) => !current)} type="button">New ticket</Button>}
        description="Ask for help with login, assignments, mentor sessions, resources, or technical issues."
        title="Support"
      />

      {showForm ? (
        <section className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-bybs-body">Category</span>
              <select
                className={inputClassName}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                value={form.category}
              >
                {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-bybs-body">Subject</span>
              <input
                className={inputClassName}
                onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
                required
                value={form.subject}
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-bybs-body">Message</span>
              <textarea
                className={textareaClassName}
                onChange={(event) => setForm((current) => ({ ...current, message: event.target.value }))}
                required
                value={form.message}
              />
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button disabled={isSubmitting} type="submit">{isSubmitting ? "Sending..." : "Create ticket"}</Button>
              <Button onClick={() => setShowForm(false)} type="button" variant="secondary">Cancel</Button>
            </div>
          </form>
        </section>
      ) : null}

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      {!tickets.length ? (
        <EmptyState
          description="Your support requests will appear here after you create a ticket."
          icon={LifeBuoy}
          title="No support tickets"
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <article className="rounded-lg border border-bybs-border bg-white p-4 shadow-sm" key={ticket._id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-bybs-blue">{ticket.category}</p>
                  <h2 className="mt-1 text-base font-semibold text-bybs-navy">{ticket.subject}</h2>
                  <SafeHtml className="mt-2 text-sm text-bybs-body" html={ticket.message} />
                  <p className="mt-2 text-xs text-bybs-muted">{formatDateTime(ticket.createdAt)}</p>
                </div>
                <StatusBadge status={ticket.status} />
              </div>

              {ticket.replies?.length ? (
                <div className="mt-4 space-y-2">
                  {ticket.replies.map((ticketReply) => (
                    <div className="rounded-md bg-bybs-pale p-3" key={ticketReply._id || ticketReply.createdAt}>
                      <SafeHtml className="text-sm text-bybs-body" html={ticketReply.message} />
                      <p className="mt-1 text-xs text-bybs-muted">{ticketReply.createdBy?.name || "BYBS"} · {formatDateTime(ticketReply.createdAt)}</p>
                    </div>
                  ))}
                </div>
              ) : null}

              {replyTicketId === ticket._id ? (
                <form className="mt-4 space-y-3" onSubmit={handleReply}>
                  <textarea
                    className={textareaClassName}
                    onChange={(event) => setReply(event.target.value)}
                    required
                    value={reply}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={isSubmitting} icon={MessageCircle} size="sm" type="submit">Reply</Button>
                    <Button onClick={() => setReplyTicketId("")} size="sm" type="button" variant="secondary">Cancel</Button>
                  </div>
                </form>
              ) : (
                <Button className="mt-4" icon={MessageCircle} onClick={() => setReplyTicketId(ticket._id)} size="sm" type="button" variant="secondary">
                  Reply
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
