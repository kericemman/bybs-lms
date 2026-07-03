import { CalendarCheck, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, EmptyState, PageHeader, StatusBadge } from "@bybs/shared";
import { studentApi } from "../services/api.js";
import { formatDateTime } from "../utils/format.js";

const inputClassName = "h-10 w-full rounded-md border border-bybs-border px-3 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";
const textareaClassName = "min-h-24 w-full rounded-md border border-bybs-border px-3 py-2 text-sm outline-none focus:border-bybs-blue focus:ring-2 focus:ring-bybs-pale";

const dayLabels = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday"
};

function emptyForm() {
  return {
    selectedOption: "",
    availabilitySlot: "",
    startsAt: "",
    endsAt: "",
    reason: ""
  };
}

function optionKey(option) {
  return `${option.availabilitySlot}|${option.startsAt}`;
}

export function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [upcomingAvailability, setUpcomingAvailability] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(() => emptyForm());
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadBookings() {
    const [bookingResponse, availabilityResponse] = await Promise.all([
      studentApi.listBookings(),
      studentApi.listAvailability()
    ]);
    setBookings(bookingResponse.data);
    setAvailability(availabilityResponse.data);
    setUpcomingAvailability(availabilityResponse.upcoming || []);
  }

  useEffect(() => {
    loadBookings().catch((loadError) => setError(loadError.message));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      await studentApi.createBooking(form);
      setFeedback("Booking request sent.");
      setForm(emptyForm());
      setShowForm(false);
      await loadBookings();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function chooseAvailability(optionValue) {
    const option = upcomingAvailability.find((item) => optionKey(item) === optionValue);

    setForm((current) => ({
      ...current,
      selectedOption: optionValue,
      availabilitySlot: option?.availabilitySlot || "",
      startsAt: option?.startsAt || "",
      endsAt: option?.endsAt || ""
    }));
  }

  async function cancelBooking(booking) {
    setError("");
    setFeedback("");

    try {
      await studentApi.cancelBooking(booking._id);
      setFeedback("Booking cancelled.");
      await loadBookings();
    } catch (cancelError) {
      setError(cancelError.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={<Button icon={Plus} onClick={() => setShowForm((current) => !current)} type="button">Book session</Button>}
        description="Book 1:1 sessions based on your mentor's available time slots."
        title="Mentor booking"
      />

      {showForm ? (
        <section className="rounded-lg border border-bybs-border bg-white p-5 shadow-sm">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
            <label className="block">
              <span className="text-sm font-medium text-bybs-body">Available time</span>
              <select
                className={inputClassName}
                disabled={!upcomingAvailability.length}
                onChange={(event) => chooseAvailability(event.target.value)}
                required
                value={form.selectedOption}
              >
                <option value="">{upcomingAvailability.length ? "Choose a mentor slot" : "No upcoming slots available"}</option>
                {upcomingAvailability.map((option) => (
                  <option key={optionKey(option)} value={optionKey(option)}>
                    {formatDateTime(option.startsAt)} - {formatDateTime(option.endsAt)}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-md bg-bybs-pale p-3 text-sm text-bybs-body">
              <p className="font-medium text-bybs-navy">Mentor availability</p>
              {availability.length ? (
                <p className="mt-1">{availability.map((slot) => `${dayLabels[slot.dayOfWeek] || slot.dayOfWeek} ${slot.startTime}-${slot.endTime}`).join(", ")}</p>
              ) : (
                <p className="mt-1">No availability has been published yet.</p>
              )}
            </div>
            <label className="block md:col-span-2">
              <span className="text-sm font-medium text-bybs-body">Reason</span>
              <textarea
                className={textareaClassName}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                required
                value={form.reason}
              />
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Button disabled={isSubmitting || !form.startsAt} type="submit">{isSubmitting ? "Sending..." : "Request booking"}</Button>
              <Button onClick={() => setShowForm(false)} type="button" variant="secondary">Cancel</Button>
            </div>
          </form>
        </section>
      ) : null}

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      {!bookings.length ? (
        <EmptyState
          description="Your booked sessions and pending requests will appear here."
          icon={CalendarCheck}
          title="No bookings yet"
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <article className="rounded-lg border border-bybs-border bg-white p-4 shadow-sm" key={booking._id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-semibold text-bybs-navy">{formatDateTime(booking.startsAt)}</h2>
                  <p className="mt-1 text-sm text-bybs-body">{booking.reason}</p>
                  <p className="mt-1 text-xs text-bybs-muted">Mentor: {booking.mentor?.name || "Assigned mentor"}</p>
                  {booking.meetingLink ? (
                    <a className="mt-2 inline-block text-sm font-medium text-bybs-blue" href={booking.meetingLink} rel="noreferrer" target="_blank">
                      Join meeting
                    </a>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={booking.status} />
                  {["pending", "approved"].includes(booking.status) ? (
                    <Button onClick={() => cancelBooking(booking)} size="sm" type="button" variant="secondary">Cancel</Button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
