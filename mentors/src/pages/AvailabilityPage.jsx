import { CalendarClock, Plus, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, PageHeader, StatusBadge } from "@bybs/shared";
import { FormField, inputClassName } from "../components/FormField.jsx";
import { mentorApi } from "../services/api.js";

const days = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" }
];

function initialForm() {
  return {
    dayOfWeek: "monday",
    startTime: "09:00",
    endTime: "10:00",
    isActive: true
  };
}

export function AvailabilityPage() {
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState(() => initialForm());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadSlots() {
    const response = await mentorApi.listAvailability();
    setSlots(response.data);
  }

  useEffect(() => {
    loadSlots().catch((requestError) => setError(requestError.message));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setFeedback("");
    setIsSubmitting(true);

    try {
      await mentorApi.createAvailability(form);
      setFeedback("Availability slot added.");
      setForm(initialForm());
      setIsFormOpen(false);
      await loadSlots();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleSlot(slot) {
    setError("");
    setFeedback("");

    try {
      await mentorApi.updateAvailability(slot._id, { isActive: !slot.isActive });
      setFeedback(slot.isActive ? "Slot disabled." : "Slot activated.");
      await loadSlots();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function deleteSlot(slot) {
    setError("");
    setFeedback("");

    if (!window.confirm(`Delete ${slot.dayOfWeek} ${slot.startTime}-${slot.endTime}?`)) return;

    try {
      await mentorApi.deleteAvailability(slot._id);
      setFeedback("Availability slot deleted.");
      await loadSlots();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button
            icon={isFormOpen ? X : Plus}
            onClick={() => {
              if (isFormOpen) {
                setForm(initialForm());
                setIsFormOpen(false);
              } else {
                setIsFormOpen(true);
              }
              setError("");
              setFeedback("");
            }}
            type="button"
            variant={isFormOpen ? "secondary" : "primary"}
          >
            {isFormOpen ? "Close form" : "Add availability"}
          </Button>
        }
        description="Set weekly slots mentees can book for 1:1 mentor sessions."
        title="Availability"
      />

      {isFormOpen ? (
        <Card>
          <form className="grid gap-4 md:grid-cols-4" onSubmit={handleSubmit}>
            <FormField label="Day">
              <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, dayOfWeek: event.target.value }))} value={form.dayOfWeek}>
                {days.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}
              </select>
            </FormField>
            <FormField label="Start time">
              <input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} required type="time" value={form.startTime} />
            </FormField>
            <FormField label="End time">
              <input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} required type="time" value={form.endTime} />
            </FormField>
            <div className="flex flex-wrap items-end gap-2 md:col-span-4">
              <Button disabled={isSubmitting} icon={Plus} type="submit">
                {isSubmitting ? "Adding..." : "Add slot"}
              </Button>
              <Button
                icon={X}
                onClick={() => {
                  setForm(initialForm());
                  setIsFormOpen(false);
                }}
                type="button"
                variant="secondary"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      <DataTable
        columns={[
          { key: "dayOfWeek", header: "Day", render: (row) => days.find((day) => day.value === row.dayOfWeek)?.label || row.dayOfWeek },
          { key: "startTime", header: "Start" },
          { key: "endTime", header: "End" },
          { key: "isActive", header: "Status", render: (row) => <StatusBadge label={row.isActive ? "Active" : "Inactive"} tone={row.isActive ? "success" : "neutral"} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <Button icon={CalendarClock} onClick={() => toggleSlot(row)} size="sm" type="button" variant="secondary">
                  {row.isActive ? "Disable" : "Activate"}
                </Button>
                <Button icon={Trash2} onClick={() => deleteSlot(row)} size="sm" type="button" variant="danger">
                  Delete
                </Button>
              </div>
            )
          }
        ]}
        emptyDescription="Add weekly availability such as Monday 6 PM to 8 PM or Saturday 10 AM to 12 PM."
        emptyTitle="No availability set"
        rows={slots}
      />
    </div>
  );
}
