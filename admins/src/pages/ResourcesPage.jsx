import { Plus, Save, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Card, DataTable, PageHeader, StatusBadge } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { FilterBar } from "../components/FilterBar.jsx";
import { FormField, inputClassName, textAreaClassName } from "../components/FormField.jsx";
import { RowActions } from "../components/RowActions.jsx";
import { adminApi } from "../services/api.js";
import { relatedTitle } from "../utils/format.js";
import { canDeleteOperationalRecords } from "../utils/permissions.js";

const initialForm = {
  title: "",
  description: "",
  type: "pdf",
  url: "",
  fileType: "",
  cohort: "",
  module: "",
  session: "",
  visibility: "draft"
};

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" }
];

export function ResourcesPage() {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [modules, setModules] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [filters, setFilters] = useState({ search: "", cohort: "", status: "" });
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canDelete = canDeleteOperationalRecords(user);

  async function loadData() {
    const [resourceResponse, cohortResponse, moduleResponse, sessionResponse] = await Promise.all([
      adminApi.listResources(filters),
      adminApi.listCohorts(),
      adminApi.listModules(),
      adminApi.listSessions()
    ]);
    setResources(resourceResponse.data);
    setCohorts(cohortResponse.data);
    setModules(moduleResponse.data);
    setSessions(sessionResponse.data);
  }

  useEffect(() => {
    loadData().catch((requestError) => setError(requestError.message));
  }, [filters]);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setIsFormOpen(false);
    setUploadMessage("");
  }

  function startEdit(resource) {
    setEditingId(resource._id);
    setIsFormOpen(true);
    setForm({
      title: resource.title || "",
      description: resource.description || "",
      type: resource.type || "pdf",
      url: resource.url || "",
      fileType: resource.fileType || "",
      cohort: resource.cohort?._id || "",
      module: resource.module?._id || "",
      session: resource.session?._id || "",
      visibility: resource.visibility || "draft"
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(resource) {
    setError("");

    try {
      await adminApi.deleteResource(resource._id);
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setError("Resource files must be 50 MB or smaller.");
      event.target.value = "";
      return;
    }

    setIsUploading(true);
    setError("");
    setUploadMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await adminApi.uploadResourceFile(formData);
      setForm((current) => ({
        ...current,
        url: response.data.url,
        fileType: response.data.fileType || current.fileType
      }));
      setUploadMessage(`${response.data.originalName} uploaded.`);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      if (editingId) {
        await adminApi.updateResource(editingId, form);
      } else {
        await adminApi.createResource(form);
      }
      resetForm();
      await loadData();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredModules = form.cohort ? modules.filter((module) => module.cohort?._id === form.cohort) : modules;
  const filteredSessions = form.cohort ? sessions.filter((session) => session.cohort?._id === form.cohort) : sessions;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button icon={isFormOpen ? X : Plus} onClick={() => (isFormOpen ? resetForm() : setIsFormOpen(true))} type="button" variant={isFormOpen ? "secondary" : "primary"}>
            {isFormOpen ? "Close form" : "Create resource"}
          </Button>
        }
        description="Publish slides, PDFs, recordings, templates, readings, videos, and external links."
        title="Resources"
      />

      <FilterBar cohorts={cohorts} filters={filters} onChange={setFilters} onReset={() => setFilters({ search: "", cohort: "", status: "" })} statuses={statusOptions} />

      {!isFormOpen && error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {!isFormOpen && uploadMessage ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{uploadMessage}</p> : null}

      {isFormOpen ? (
      <Card>
        <form className="grid gap-4 lg:grid-cols-4" onSubmit={handleSubmit}>
          <FormField label="Title"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} required value={form.title} /></FormField>
          <FormField label="Type">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} value={form.type}>
              <option value="slides">Slides</option>
              <option value="pdf">PDF</option>
              <option value="template">Template</option>
              <option value="zoom">Zoom link</option>
              <option value="recording">Recording</option>
              <option value="reading">Reading</option>
              <option value="external">External link</option>
              <option value="video">Video</option>
              <option value="reflection">Reflection</option>
            </select>
          </FormField>
          <FormField label="Cohort">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, cohort: event.target.value, module: "", session: "" }))} required value={form.cohort}>
              <option value="">Choose cohort</option>
              {cohorts.map((cohort) => <option key={cohort._id} value={cohort._id}>{cohort.title}</option>)}
            </select>
          </FormField>
          <FormField label="Visibility">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))} value={form.visibility}>
              {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
          </FormField>
          <FormField label="Resource URL">
            <input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))} required type="url" value={form.url} />
          </FormField>
          <FormField label="Upload file">
            <label className="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-bybs-border bg-white px-3 text-sm font-medium text-bybs-body hover:bg-bybs-pale">
              <Upload className="h-4 w-4" aria-hidden="true" />
              {isUploading ? "Uploading..." : "Choose file"}
              <input
                accept=".csv,.doc,.docx,.jpeg,.jpg,.mp4,.pdf,.png,.ppt,.pptx,.txt,.webp,.xls,.xlsx"
                className="sr-only"
                disabled={isUploading}
                onChange={handleFileChange}
                type="file"
              />
            </label>
          </FormField>
          <FormField label="Module">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, module: event.target.value }))} value={form.module}>
              <option value="">No module</option>
              {filteredModules.map((module) => <option key={module._id} value={module._id}>{module.title}</option>)}
            </select>
          </FormField>
          <FormField label="Session">
            <select className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, session: event.target.value }))} value={form.session}>
              <option value="">No session</option>
              {filteredSessions.map((session) => <option key={session._id} value={session._id}>{session.title}</option>)}
            </select>
          </FormField>
          <FormField label="File type"><input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, fileType: event.target.value }))} placeholder="pdf, mp4, link" value={form.fileType} /></FormField>
          <div className="lg:col-span-4"><FormField label="Description"><textarea className={textAreaClassName} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} value={form.description} /></FormField></div>
          {uploadMessage ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue lg:col-span-4">{uploadMessage}</p> : null}
          {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose lg:col-span-4">{error}</p> : null}
          <div className="flex flex-wrap gap-2 lg:col-span-4">
            <Button disabled={isSubmitting} icon={editingId ? Save : Plus} type="submit">{isSubmitting ? "Saving..." : editingId ? "Update resource" : "Create resource"}</Button>
            {editingId ? <Button icon={X} onClick={resetForm} type="button" variant="secondary">Cancel edit</Button> : null}
          </div>
        </form>
      </Card>
      ) : null}

      <DataTable
        columns={[
          { key: "title", header: "Resource" },
          { key: "type", header: "Type" },
          { key: "cohort", header: "Cohort", render: (row) => relatedTitle(row.cohort) },
          { key: "module", header: "Module", render: (row) => relatedTitle(row.module) },
          { key: "visibility", header: "Visibility", render: (row) => <StatusBadge status={row.visibility} /> },
          {
            key: "actions",
            header: "Actions",
            render: (row) => (
              <RowActions
                confirmMessage={`Delete ${row.title}? This will remove the resource record.`}
                onDelete={canDelete ? () => handleDelete(row) : undefined}
                onEdit={() => startEdit(row)}
              />
            )
          }
        ]}
        rows={resources}
      />
    </div>
  );
}
