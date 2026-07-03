import { useEffect, useState } from "react";
import { Button, DataTable, PageHeader, StatusBadge } from "@bybs/shared";
import { inputClassName } from "../components/FormField.jsx";
import { adminApi } from "../services/api.js";
import { formatDateTime, relatedTitle } from "../utils/format.js";

const statusOptions = ["pending", "approved", "declined", "completed", "cancelled"];

export function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function loadBookings() {
    const response = await adminApi.listBookings({ status });
    setBookings(response.data);
  }

  useEffect(() => {
    loadBookings().catch((requestError) => setError(requestError.message));
  }, [status]);

  async function updateStatus(booking, nextStatus) {
    setError("");

    try {
      await adminApi.updateBooking(booking._id, { status: nextStatus });
      await loadBookings();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description="View mentor/mentee 1:1 sessions and follow their approval status."
        title="Bookings"
      />
      <select className={inputClassName} onChange={(event) => setStatus(event.target.value)} value={status}>
        <option value="">All statuses</option>
        {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      <DataTable
        columns={[
          { key: "student", header: "Mentee", render: (row) => relatedTitle(row.student) },
          { key: "mentor", header: "Mentor", render: (row) => relatedTitle(row.mentor) },
          { key: "startsAt", header: "Starts", render: (row) => formatDateTime(row.startsAt) },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex gap-2">
                <Button onClick={() => updateStatus(row, "approved")} size="sm" type="button" variant="secondary">Approve</Button>
                <Button onClick={() => updateStatus(row, "declined")} size="sm" type="button" variant="secondary">Decline</Button>
              </div>
            )
          }
        ]}
        emptyDescription="Mentee mentor session requests will appear here."
        rows={bookings}
      />
    </div>
  );
}
