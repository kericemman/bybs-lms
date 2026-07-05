import { BarChart3, Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, PageHeader, ProgressBar, SectionHeader, StatusBadge } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { FilterBar } from "../components/FilterBar.jsx";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { RowActions } from "../components/RowActions.jsx";
import { adminApi } from "../services/api.js";
import { canDeleteOperationalRecords } from "../utils/permissions.js";

const initialForm = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  status: "draft"
};

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" }
];

function toDateInput(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function CohortsPage() {
  const { user } = useAuth();
  const [cohorts, setCohorts] = useState([]);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [ranking, setRanking] = useState(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canDelete = canDeleteOperationalRecords(user);

  async function loadCohorts(nextFilters = filters) {
    const response = await adminApi.listCohorts(nextFilters);
    setCohorts(response.data);
  }

  useEffect(() => {
    loadCohorts().catch((requestError) => setError(requestError.message));
  }, [filters]);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setIsFormOpen(false);
  }

  function startEdit(cohort) {
    setEditingId(cohort._id);
    setIsFormOpen(true);
    setForm({
      title: cohort.title || "",
      description: cohort.description || "",
      startDate: toDateInput(cohort.startDate),
      endDate: toDateInput(cohort.endDate),
      status: cohort.status || "draft"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(cohort) {
    setError("");

    try {
      await adminApi.deleteCohort(cohort._id);
      await loadCohorts();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function openRanking(cohort) {
    setError("");
    setRankingLoading(true);

    try {
      const response = await adminApi.getCohortRanking(cohort._id);
      setRanking(response.data);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRankingLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (editingId) {
        await adminApi.updateCohort(editingId, form);
      } else {
        await adminApi.createCohort(form);
      }
      resetForm();
      await loadCohorts();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button icon={isFormOpen ? X : Plus} onClick={() => (isFormOpen ? resetForm() : setIsFormOpen(true))} type="button" variant={isFormOpen ? "secondary" : "primary"}>
            {isFormOpen ? "Close form" : "Create cohort"}
          </Button>
        }
        description="Organize mentees, mentors, modules, sessions, assignments, announcements, and rankings."
        title="Cohorts"
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onReset={() => setFilters({ search: "", status: "" })}
        statuses={statusOptions}
      />

      {!isFormOpen && error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

      {isFormOpen ? (
      <Card>
        <form className="grid gap-4 lg:grid-cols-4" onSubmit={handleSubmit}>
          <FormField label="Cohort title">
            <input
              className={inputClassName}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="BYBS Fellowship Cohort 4"
              required
              value={form.title}
            />
          </FormField>
          <FormField label="Start date">
            <input
              className={inputClassName}
              onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
              type="date"
              value={form.startDate}
            />
          </FormField>
          <FormField label="End date">
            <input
              className={inputClassName}
              onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
              type="date"
              value={form.endDate}
            />
          </FormField>
          <FormField label="Status">
            <select
              className={inputClassName}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              value={form.status}
            >
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </FormField>
          <div className="lg:col-span-4">
            <FormField label="Description">
              <textarea
                className={textAreaClassName}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                value={form.description}
              />
            </FormField>
          </div>
          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-4">{error}</p> : null}
          <div className="flex flex-wrap gap-2 lg:col-span-4">
            <Button disabled={isSubmitting} icon={editingId ? Save : Plus} type="submit">
              {isSubmitting ? "Saving..." : editingId ? "Update cohort" : "Create cohort"}
            </Button>
            {editingId ? (
              <Button icon={X} onClick={resetForm} type="button" variant="secondary">
                Cancel edit
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
      ) : null}

      {ranking ? (
        <Card>
          <SectionHeader
            action={
              <Button icon={X} onClick={() => setRanking(null)} size="sm" type="button" variant="secondary">
                Close
              </Button>
            }
            description="Ranking is computed from assignment completion, approved scores, attendance, and punctuality. Mentor notes do not affect the score."
            title={`${ranking.cohort?.title || "Cohort"} ranking`}
          />
          <div className="mb-5 grid gap-4 md:grid-cols-4">
            {[
              ["Mentees ranked", ranking.totals?.students || 0],
              ["Assignments", ranking.totals?.assignments || 0],
              ["Marked sessions", ranking.totals?.sessions || 0],
              ["Graduation ready", ranking.totals?.graduationReady || 0]
            ].map(([label, value]) => (
              <div className="rounded-md border border-bybs-border bg-white p-3" key={label}>
                <p className="text-sm text-bybs-body">{label}</p>
                <p className="mt-2 text-xl font-semibold text-bybs-navy">{value}</p>
              </div>
            ))}
          </div>
          {ranking.weights ? (
            <div className="mb-5 grid gap-3 rounded-lg border border-bybs-border bg-bybs-pale p-4 md:grid-cols-4">
              {Object.entries(ranking.weights).map(([key, value]) => (
                <div key={key}>
                  <p className="text-xs font-medium uppercase text-bybs-muted">{key.replace(/([A-Z])/g, " $1")}</p>
                  <p className="mt-1 text-lg font-semibold text-bybs-navy">{value}%</p>
                </div>
              ))}
            </div>
          ) : null}
          <DataTable
            columns={[
              { key: "rank", header: "Rank", render: (row) => `#${row.rank}` },
              { key: "student", header: "Mentee", render: (row) => row.student?.name || "Mentee" },
              { key: "progress", header: "Overall", render: (row) => <div className="w-40"><ProgressBar value={row.progress} /></div> },
              { key: "scorePercentage", header: "Score", render: (row) => `${row.scorePercentage || 0}%` },
              { key: "attendancePercentage", header: "Attendance", render: (row) => `${row.attendancePercentage || 0}%` },
              { key: "submitted", header: "Submitted", render: (row) => `${row.submittedCount || 0}/${row.totalAssignments || 0}` },
              { key: "late", header: "Late", render: (row) => row.lateSubmissionCount || 0 },
              {
                key: "graduationReady",
                header: "Graduation",
                render: (row) => (
                  <StatusBadge
                    label={row.graduationReady ? "Ready" : "Not ready"}
                    status={row.graduationReady ? "approved" : "pending"}
                  />
                )
              }
            ]}
            emptyDescription="Mentees assigned to this cohort will appear here once progress can be computed."
            emptyTitle="No ranking data"
            rows={ranking.ranking || []}
          />
        </Card>
      ) : null}

      <DataTable
        columns={[
          { key: "title", header: "Cohort" },
          { key: "students", header: "Mentees", render: (row) => row.students?.length || 0 },
          { key: "mentors", header: "Mentors", render: (row) => row.mentors?.length || 0 },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <div className="flex flex-wrap items-center gap-2">
                <Button disabled={rankingLoading} icon={BarChart3} onClick={() => openRanking(row)} size="sm" type="button" variant="secondary">
                  Ranking
                </Button>
                <RowActions
                  confirmMessage={`Delete ${row.title}? This cannot be undone.`}
                  onDelete={canDelete ? () => handleDelete(row) : undefined}
                  onEdit={() => startEdit(row)}
                />
              </div>
            )
          }
        ]}
        rows={cohorts}
      />
    </div>
  );
}
