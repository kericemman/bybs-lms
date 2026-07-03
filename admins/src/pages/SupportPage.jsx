import {
  AlertCircle,
  CheckCircle,
  ClipboardCopy,
  Mail,
  MessageCircle,
  Search,
  UserCircle
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button, EmptyState, PageHeader, ProgressBar, SectionHeader, StatusBadge, formatInternationalPhone } from "@bybs/shared";
import { inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { adminApi } from "../services/api.js";
import { formatDateTime, relatedTitle } from "../utils/format.js";

const statusOptions = ["open", "inProgress", "resolved", "closed"];
const categoryOptions = ["login", "assignment", "mentor", "resourceAccess", "technical", "general"];

function supportProgress(status) {
  if (status === "closed") return 100;
  if (status === "resolved") return 85;
  if (status === "inProgress") return 45;
  return 10;
}

function copyText(value) {
  if (!value || typeof navigator === "undefined" || !navigator.clipboard) return;
  navigator.clipboard.writeText(value).catch(() => {});
}

function DetailRow({ label, value, canCopy = false }) {
  const displayValue = value === undefined || value === null || value === "" ? "Not set" : value;

  return (
    <div className="rounded-md bg-bybs-pale p-3">
      <p className="text-xs font-medium uppercase text-bybs-muted">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="break-all text-sm font-medium text-bybs-navy">{displayValue}</p>
        {canCopy && value ? (
          <button className="text-bybs-blue hover:text-bybs-blueHover" onClick={() => copyText(value)} type="button">
            <ClipboardCopy className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function SupportPage() {
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState("");
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({ status: "", category: "", search: "" });
  const [reply, setReply] = useState("");
  const [statusDraft, setStatusDraft] = useState("open");
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function loadTickets(nextFilters = filters) {
    const response = await adminApi.listSupportTickets(nextFilters);
    setTickets(response.data);
    return response.data;
  }

  async function loadDetail(id) {
    if (!id) {
      setDetail(null);
      return;
    }

    const response = await adminApi.getSupportTicket(id);
    setDetail(response.data);
    setStatusDraft(response.data.ticket.status);
  }

  useEffect(() => {
    loadTickets().catch((requestError) => setError(requestError.message));
  }, []);

  useEffect(() => {
    if (selectedTicketId) {
      loadDetail(selectedTicketId).catch((requestError) => setError(requestError.message));
    }
  }, [selectedTicketId]);

  async function applyFilters(event) {
    event.preventDefault();
    setError("");
    setFeedback("");

    try {
      const rows = await loadTickets(filters);
      if (selectedTicketId && !rows.some((ticket) => ticket._id === selectedTicketId)) {
        setSelectedTicketId("");
        setDetail(null);
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function updateTicket(payload, successMessage) {
    if (!detail?.ticket?._id) return;

    setError("");
    setFeedback("");
    setIsSaving(true);

    try {
      await adminApi.updateSupportTicket(detail.ticket._id, payload);
      setFeedback(successMessage);
      setReply("");
      await Promise.all([loadTickets(), loadDetail(detail.ticket._id)]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function sendReply(event) {
    event.preventDefault();
    await updateTicket({ reply, status: statusDraft }, "Reply sent and mentee notified.");
  }

  const ticket = detail?.ticket;
  const context = detail?.context;
  const student = context?.student || ticket?.student;
  const completion = supportProgress(ticket?.status);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Investigate mentee issues, understand account context, reply, and move tickets through resolution."
        title="Support tickets"
      />

      <form className="grid gap-3 rounded-lg border border-bybs-border bg-white p-4 shadow-sm lg:grid-cols-[1fr_180px_180px_auto]" onSubmit={applyFilters}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-bybs-muted" aria-hidden="true" />
          <input
            className={`${inputClassName} pl-9`}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder="Search ticket, mentee email, or mentee ID"
            value={filters.search}
          />
        </div>
        <select className={inputClassName} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} value={filters.status}>
          <option value="">All statuses</option>
          {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select className={inputClassName} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} value={filters.category}>
          <option value="">All categories</option>
          {categoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <Button type="submit">Filter</Button>
      </form>

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <section className="space-y-3">
          {!tickets.length ? (
            <EmptyState
              description="Support tickets will appear here once mentees begin sending requests."
              icon={AlertCircle}
              title="No support tickets"
            />
          ) : (
            tickets.map((row) => (
              <button
                className={`w-full rounded-lg border bg-white p-4 text-left shadow-sm transition hover:bg-bybs-pale ${
                  selectedTicketId === row._id ? "border-bybs-blue ring-2 ring-bybs-pale" : "border-bybs-border"
                }`}
                key={row._id}
                onClick={() => setSelectedTicketId(row._id)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase text-bybs-blue">{row.category}</p>
                    <h2 className="mt-1 text-sm font-semibold text-bybs-navy">{row.subject}</h2>
                    <p className="mt-1 text-sm text-bybs-body">{relatedTitle(row.student)}</p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-bybs-muted">{row.message}</p>
                <p className="mt-3 text-xs text-bybs-muted">{formatDateTime(row.createdAt)}</p>
              </button>
            ))
          )}
        </section>

        {!ticket ? (
          <EmptyState
            description="Select a ticket to see mentee context, diagnostics, replies, and resolution controls."
            icon={MessageCircle}
            title="Select a support ticket"
          />
        ) : (
          <section className="space-y-5">
            <div className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-sm font-medium text-bybs-blue">{ticket.category}</p>
                  <h2 className="mt-1 text-xl font-semibold text-bybs-navy">{ticket.subject}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-bybs-body">{ticket.message}</p>
                  <p className="mt-3 text-xs text-bybs-muted">Created {formatDateTime(ticket.createdAt)}</p>
                </div>
                <div className="min-w-48">
                  <StatusBadge status={ticket.status} />
                  <div className="mt-4">
                    <ProgressBar label="Resolution progress" value={completion} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
              <div className="space-y-5">
                <section className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
                  <SectionHeader description="Use this to confirm the mentee, account state, and assignment context without opening the database." title="Mentee context" />
                  <div className="grid gap-3 md:grid-cols-2">
                    <DetailRow label="Name" value={student?.name} />
                    <DetailRow label="Email" value={student?.email} canCopy />
                    <DetailRow label="Mentee ID" value={student?.id || student?._id} canCopy />
                    <DetailRow label="Phone" value={formatInternationalPhone(student?.phone)} canCopy={Boolean(student?.phone)} />
                    <DetailRow label="Account status" value={student?.status} />
                    <DetailRow label="Last login" value={formatDateTime(student?.lastLogin)} />
                    <DetailRow label="Cohort" value={relatedTitle(student?.cohort)} />
                    <DetailRow label="Mentor" value={relatedTitle(student?.mentor)} />
                  </div>
                </section>

                <section className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
                  <SectionHeader title="Debug checklist" />
                  <div className="space-y-2">
                    {(detail.checklist || []).map((item) => (
                      <div className="flex gap-2 rounded-md bg-bybs-pale p-3 text-sm text-bybs-body" key={item}>
                        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-bybs-blue" aria-hidden="true" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
                  <SectionHeader title="Reply to mentee" />
                  <form className="space-y-4" onSubmit={sendReply}>
                    <label className="block">
                      <span className="text-sm font-medium text-bybs-body">Ticket status</span>
                      <select className={`${inputClassName} mt-1`} onChange={(event) => setStatusDraft(event.target.value)} value={statusDraft}>
                        {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-bybs-body">Message</span>
                      <textarea
                        className={`${textAreaClassName} mt-1`}
                        onChange={(event) => setReply(event.target.value)}
                        placeholder="Explain what happened, what you checked, and the next step for the mentee."
                        required
                        value={reply}
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={isSaving} icon={Mail} type="submit">{isSaving ? "Sending..." : "Send reply"}</Button>
                      <Button disabled={isSaving} onClick={() => updateTicket({ status: statusDraft }, "Status updated and mentee notified.")} type="button" variant="secondary">
                        Update status only
                      </Button>
                    </div>
                  </form>
                </section>
              </div>

              <div className="space-y-5">
                <section className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
                  <SectionHeader title="Mentee activity" />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <DetailRow label="Assignments" value={context?.summary?.totalAssignments ?? 0} />
                    <DetailRow label="Submitted" value={context?.summary?.submittedCount ?? 0} />
                    <DetailRow label="Pending" value={context?.summary?.pendingAssignments ?? 0} />
                    <DetailRow label="Open tickets" value={context?.summary?.openTickets ?? 0} />
                    <DetailRow label="Materials" value={context?.summary?.publishedMaterials ?? 0} />
                  </div>
                </section>

                <section className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
                  <SectionHeader title="Recent submissions" />
                  {!context?.recentSubmissions?.length ? (
                    <p className="text-sm text-bybs-muted">No submissions recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {context.recentSubmissions.map((submission) => (
                        <div className="rounded-md bg-bybs-pale p-3" key={submission._id}>
                          <p className="text-sm font-medium text-bybs-navy">{relatedTitle(submission.assignment)}</p>
                          <p className="mt-1 text-xs text-bybs-muted">{submission.status} · {formatDateTime(submission.submittedAt)}</p>
                          {submission.fileUrl ? (
                            <a className="mt-1 inline-block text-xs font-medium text-bybs-blue" href={submission.fileUrl} rel="noreferrer" target="_blank">Open file</a>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
                  <SectionHeader title="Recent bookings" />
                  {!context?.recentBookings?.length ? (
                    <p className="text-sm text-bybs-muted">No bookings recorded.</p>
                  ) : (
                    <div className="space-y-3">
                      {context.recentBookings.map((booking) => (
                        <div className="rounded-md bg-bybs-pale p-3" key={booking._id}>
                          <p className="text-sm font-medium text-bybs-navy">{formatDateTime(booking.startsAt)}</p>
                          <p className="mt-1 text-xs text-bybs-muted">{booking.status} · {booking.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </div>

            <section className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
              <SectionHeader title="Conversation" />
              <div className="space-y-3">
                <div className="rounded-md bg-bybs-pale p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-bybs-navy">
                    <UserCircle className="h-4 w-4" aria-hidden="true" />
                    {relatedTitle(ticket.student)}
                  </div>
                  <p className="mt-2 text-sm text-bybs-body">{ticket.message}</p>
                </div>
                {ticket.replies?.map((ticketReply) => (
                  <div className="rounded-md bg-white p-3 ring-1 ring-bybs-border" key={ticketReply._id || ticketReply.createdAt}>
                    <p className="text-sm font-medium text-bybs-navy">{relatedTitle(ticketReply.createdBy, "BYBS Team")}</p>
                    <p className="mt-2 text-sm text-bybs-body">{ticketReply.message}</p>
                    <p className="mt-2 text-xs text-bybs-muted">{formatDateTime(ticketReply.createdAt)}</p>
                  </div>
                ))}
              </div>
            </section>
          </section>
        )}
      </div>
    </div>
  );
}
