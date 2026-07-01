import { CalendarCheck, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, PageHeader, StatusBadge } from "@bybs/shared";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { mentorApi } from "../services/api.js";
import { formatDateTime } from "../utils/format.js";

const statusOptions = [
  { value: "", label: "All bookings" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "completed", label: "Completed" },
  { value: "declined", label: "Declined" },
  { value: "cancelled", label: "Cancelled" }
];

const updateStatuses = [
  { value: "approved", label: "Approved" },
  { value: "declined", label: "Declined" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" }
];

function bookingForm(booking) {
  return {
    status: booking?.status === "pending" ? "approved" : booking?.status || "approved",
    meetingLink: booking?.meetingLink || "",
    mentorNotes: booking?.mentorNotes || ""
  };
}

export function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [status, setStatus] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [form, setForm] = useState(() => bookingForm());
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadBookings() {
    const response = await mentorApi.listBookings({ status });
    setBookings(response.data);
  }

  useEffect(() => {
    loadBookings().catch((requestError) => setError(requestError.message));
  }, [status]);

  function startUpdate(booking) {
    setSelectedBooking(booking);
    setForm(bookingForm(booking));
    setError("");
    setFeedback("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelUpdate() {
    setSelectedBooking(null);
    setForm(bookingForm());
  }

  async function quickUpdate(booking, nextStatus) {
    setError("");
    setFeedback("");

    try {
      await mentorApi.updateBooking(booking._id, { status: nextStatus });
      setFeedback(`Booking marked as ${nextStatus}.`);
      await loadBookings();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function submitUpdate(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      await mentorApi.updateBooking(selectedBooking._id, form);
      setFeedback("Booking updated.");
      cancelUpdate();
      await loadBookings();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="Approve, decline, complete, or add notes to student mentor sessions."
        title="Bookings"
      />

      {selectedBooking ? (
        <Card>
          <form className="grid gap-4 lg:grid-cols-3" onSubmit={submitUpdate}>
            <div className="lg:col-span-3">
              <p className="text-sm font-semibold uppercase text-bybs-blue">Booking update</p>
              <h2 className="mt-1 text-lg font-semibold text-bybs-navy">{selectedBooking.student?.name || "Student"}</h2>
              <p className="mt-1 text-sm text-bybs-body">{formatDateTime(selectedBooking.startsAt)}</p>
            </div>
            <FormField label="Status">
              <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} value={form.status}>
                {updateStatuses.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FormField>
            <div className="lg:col-span-2">
              <FormField label="Meeting link">
                <input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, meetingLink: event.target.value }))} placeholder="https://..." type="url" value={form.meetingLink} />
              </FormField>
            </div>
            <div className="lg:col-span-3">
              <FormField label="Mentor notes">
                <textarea className={textAreaClassName} onChange={(event) => setForm((current) => ({ ...current, mentorNotes: event.target.value }))} value={form.mentorNotes} />
              </FormField>
            </div>
            <div className="flex flex-wrap gap-2 lg:col-span-3">
              <Button disabled={isSubmitting} icon={Save} type="submit">{isSubmitting ? "Saving..." : "Save booking"}</Button>
              <Button icon={X} onClick={cancelUpdate} type="button" variant="secondary">Cancel</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-bybs-border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-medium text-bybs-navy">
          <CalendarCheck className="h-4 w-4 text-bybs-blue" aria-hidden="true" />
          Session requests
        </div>
        <select className={`${inputClassName} max-w-56`} onChange={(event) => setStatus(event.target.value)} value={status}>
          {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      <DataTable
        columns={[
          { key: "student", header: "Student", render: (row) => row.student?.name || "Student" },
          { key: "startsAt", header: "Start", render: (row) => formatDateTime(row.startsAt) },
          { key: "reason", header: "Reason", wrap: true },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                {row.status === "pending" ? (
                  <>
                    <Button onClick={() => quickUpdate(row, "approved")} size="sm" type="button" variant="secondary">Approve</Button>
                    <Button onClick={() => quickUpdate(row, "declined")} size="sm" type="button" variant="secondary">Decline</Button>
                  </>
                ) : null}
                {row.status === "approved" ? (
                  <Button onClick={() => quickUpdate(row, "completed")} size="sm" type="button" variant="secondary">Complete</Button>
                ) : null}
                <Button onClick={() => startUpdate(row)} size="sm" type="button" variant="secondary">Edit</Button>
              </div>
            )
          }
        ]}
        emptyDescription="Student booking requests will appear here after availability is published."
        emptyTitle="No bookings yet"
        rows={bookings}
      />
    </div>
  );
}
