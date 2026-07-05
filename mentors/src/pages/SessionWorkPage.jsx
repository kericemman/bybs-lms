import { ClipboardCheck, Eye, Link, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Card, DataTable, PageHeader, RichTextEditor, SafeHtml, StatusBadge } from "@bybs/shared";
import { useAuth } from "../auth/AuthContext.jsx";
import { FormField, inputClassName } from "../components/FormField.jsx";
import { mentorApi } from "../services/api.js";
import { formatCatDateTime, formatDate } from "../utils/format.js";

function tomorrowIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

const createStatusOptions = [
  { value: "published", label: "Publish now" },
  { value: "draft", label: "Save as draft" }
];

const assignmentStatusOptions = [
  { value: "published", label: "Published" },
  { value: "draft", label: "Draft" },
  { value: "closed", label: "Closed" },
  { value: "archived", label: "Archived" }
];

function initialForm(overrides = {}) {
  return {
    session: "",
    module: "",
    materialTitle: "",
    recordingTitle: "",
    recordingUrl: "",
    assignmentTitle: "",
    assignmentOverview: "",
    assignmentTasks: "",
    assignmentDeliverables: "",
    gradingGuide: "",
    supportNotes: "",
    resourceLinks: [{ title: "", url: "" }],
    dueDate: tomorrowIsoDate(),
    maxScore: 100,
    allowResubmission: true,
    status: "published",
    ...overrides
  };
}

function entityId(value) {
  return String(value?._id || value?.id || value || "");
}

function toDateInput(value) {
  if (!value) return tomorrowIsoDate();
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function sessionMentorName(session) {
  return session?.module?.assignedMentor?.name || session?.module?.assignedMentor?.email || "Assigned mentor";
}

function resourceLinksForForm(resourceLinks = []) {
  const links = resourceLinks.map((link) => ({
    title: link.title || "",
    url: link.url || ""
  }));

  return links.length ? links : [{ title: "", url: "" }];
}

function sectionsFromInstructions(instructions = "") {
  const fields = {
    assignmentOverview: [],
    assignmentTasks: [],
    assignmentDeliverables: [],
    gradingGuide: [],
    supportNotes: []
  };
  const headingMap = {
    "assignment overview": "assignmentOverview",
    "what to do": "assignmentTasks",
    "expected submission": "assignmentDeliverables",
    "grading guide": "gradingGuide",
    "support notes": "supportNotes"
  };
  let currentField = "assignmentOverview";
  let foundKnownHeading = false;

  for (const line of String(instructions || "").split("\n")) {
    const heading = line.match(/^##\s+(.+)$/);

    if (heading) {
      const normalizedHeading = heading[1].trim().toLowerCase();

      if (normalizedHeading === "resource links") {
        currentField = null;
        foundKnownHeading = true;
        continue;
      }

      if (headingMap[normalizedHeading]) {
        currentField = headingMap[normalizedHeading];
        foundKnownHeading = true;
        continue;
      }

      currentField = "assignmentOverview";
    }

    if (currentField) {
      fields[currentField].push(line);
    }
  }

  if (!foundKnownHeading) {
    fields.assignmentOverview = [instructions];
  }

  return Object.fromEntries(
    Object.entries(fields).map(([field, lines]) => [field, lines.join("\n").trim()])
  );
}

function AssignmentDetailsCard({ assignment, canEdit, onClose, onEdit }) {
  const sections = sectionsFromInstructions(assignment.instructions);
  const sectionRows = [
    ["Assignment overview", sections.assignmentOverview],
    ["Tasks and steps", sections.assignmentTasks],
    ["Expected submission", sections.assignmentDeliverables],
    ["Grading guide", sections.gradingGuide],
    ["Support notes", sections.supportNotes]
  ].filter(([, value]) => value);

  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase text-bybs-blue">Assignment details</p>
          <h2 className="mt-1 text-lg font-semibold text-bybs-navy">{assignment.title}</h2>
          <p className="mt-1 text-sm text-bybs-body">
            {assignment.module?.title || "Unassigned module"} · Due {formatDate(assignment.dueDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit ? (
            <Button icon={Pencil} onClick={onEdit} size="sm" type="button" variant="secondary">
              Edit
            </Button>
          ) : null}
          <Button icon={X} onClick={onClose} size="sm" type="button" variant="secondary">
            Close
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-md border border-bybs-border bg-bybs-pale p-3">
          <p className="text-xs font-medium uppercase text-bybs-muted">Status</p>
          <div className="mt-2"><StatusBadge status={assignment.status} /></div>
        </div>
        <div className="rounded-md border border-bybs-border bg-bybs-pale p-3">
          <p className="text-xs font-medium uppercase text-bybs-muted">Max score</p>
          <p className="mt-2 text-sm font-semibold text-bybs-navy">{assignment.maxScore || 100}</p>
        </div>
        <div className="rounded-md border border-bybs-border bg-bybs-pale p-3">
          <p className="text-xs font-medium uppercase text-bybs-muted">Resubmission</p>
          <p className="mt-2 text-sm font-semibold text-bybs-navy">{assignment.allowResubmission ? "Allowed" : "Closed"}</p>
        </div>
        <div className="rounded-md border border-bybs-border bg-bybs-pale p-3">
          <p className="text-xs font-medium uppercase text-bybs-muted">Posted by</p>
          <p className="mt-2 text-sm font-semibold text-bybs-navy">{assignment.createdBy?.name || "BYBS team"}</p>
        </div>
      </div>

      {assignment.templateFileUrl ? (
        <div className="mt-5 rounded-md border border-bybs-border p-4">
          <p className="text-sm font-semibold text-bybs-navy">Attached file</p>
          <a className="mt-2 inline-block text-sm font-medium text-bybs-blue" href={assignment.templateFileUrl} rel="noreferrer" target="_blank">
            Open attached material
          </a>
        </div>
      ) : null}

      {sectionRows.length ? (
        <div className="mt-5 space-y-4">
          {sectionRows.map(([label, html]) => (
            <div className="rounded-md border border-bybs-border p-4" key={label}>
              <p className="text-sm font-semibold text-bybs-navy">{label}</p>
              <SafeHtml className="mt-2 text-sm leading-6 text-bybs-body" html={html} />
            </div>
          ))}
        </div>
      ) : null}

      {assignment.resourceLinks?.length ? (
        <div className="mt-5 rounded-md border border-bybs-border p-4">
          <p className="text-sm font-semibold text-bybs-navy">Resource links</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {assignment.resourceLinks.map((resourceLink) => (
              <Button
                as="a"
                href={resourceLink.url}
                icon={Link}
                key={`${resourceLink.title}-${resourceLink.url}`}
                rel="noreferrer"
                target="_blank"
                variant="secondary"
              >
                {resourceLink.title || "Open link"}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export function SessionWorkPage() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [sessions, setSessions] = useState([]);
  const [modules, setModules] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [form, setForm] = useState(() => initialForm());
  const [editingAssignment, setEditingAssignment] = useState(null);
  const [workMode, setWorkMode] = useState("list");
  const [viewAssignment, setViewAssignment] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentUserId = entityId(user);

  async function loadAssignments() {
    const response = await mentorApi.listAssignments();
    setAssignments(response.data);
    return response.data;
  }

  useEffect(() => {
    Promise.all([mentorApi.listSessions(), mentorApi.listModules(), mentorApi.listAssignments()])
      .then(([sessionResponse, moduleResponse, assignmentResponse]) => {
        const firstSession = sessionResponse.data[0];
        setSessions(sessionResponse.data);
        setModules(moduleResponse.data);
        setAssignments(assignmentResponse.data);
        setForm((current) => ({
          ...current,
          session: current.session || firstSession?._id || "",
          module: current.module || firstSession?.module?._id || firstSession?.module || ""
        }));
      })
      .catch((requestError) => setError(requestError.message));
  }, []);

  function canManageAssignment(assignment) {
    return entityId(assignment.createdBy) === currentUserId;
  }

  function openCreateForm() {
    setEditingAssignment(null);
    setUploadedFile(null);
    setViewAssignment(null);
    setWorkMode("create");
    setError("");
    setFeedback("");
    setForm((current) => ({
      ...initialForm(),
      session: current.session || sessions[0]?._id || "",
      module: current.module || sessions[0]?.module?._id || sessions[0]?.module || ""
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function viewAssignmentDetails(assignment) {
    setViewAssignment(assignment);
    setWorkMode("list");
    setError("");
    setFeedback("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function updateField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateResourceLink(index, field, value) {
    setForm((current) => ({
      ...current,
      resourceLinks: current.resourceLinks.map((link, itemIndex) =>
        itemIndex === index ? { ...link, [field]: value } : link
      )
    }));
  }

  function addResourceLink() {
    setForm((current) => ({
      ...current,
      resourceLinks: [...current.resourceLinks, { title: "", url: "" }]
    }));
  }

  function removeResourceLink(index) {
    setForm((current) => ({
      ...current,
      resourceLinks: current.resourceLinks.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  function updateSession(sessionId) {
    const session = sessions.find((item) => item._id === sessionId);
    const sessionModuleId = session?.module?._id || session?.module || "";
    const cohortId = session?.cohort?._id || session?.cohort || "";
    const sessionModules = cohortId
      ? modules.filter((module) => String(module.cohort?._id || module.cohort || "") === String(cohortId))
      : modules;

    setForm((current) => ({
      ...current,
      session: sessionId,
      module: sessionModuleId || (sessionModules.some((module) => module._id === current.module) ? current.module : sessionModules[0]?._id || "")
    }));
  }

  function resetForm({ clearMessages = true } = {}) {
    setForm((current) => ({
      ...initialForm(),
      session: current.session,
      module: current.module
    }));
    setEditingAssignment(null);
    setWorkMode("list");
    setUploadedFile(null);
    if (clearMessages) {
      setError("");
      setFeedback("");
    }
  }

  function startEditAssignment(assignment) {
    if (!canManageAssignment(assignment)) return;

    setEditingAssignment(assignment);
    setViewAssignment(null);
    setWorkMode("edit");
    setUploadedFile(null);
    const sections = sectionsFromInstructions(assignment.instructions);
    setForm(initialForm({
      session: "",
      module: assignment.module?._id || assignment.module || "",
      assignmentTitle: assignment.title || "",
      assignmentOverview: sections.assignmentOverview,
      assignmentTasks: sections.assignmentTasks,
      assignmentDeliverables: sections.assignmentDeliverables,
      gradingGuide: sections.gradingGuide,
      supportNotes: sections.supportNotes,
      resourceLinks: resourceLinksForForm(assignment.resourceLinks),
      dueDate: toDateInput(assignment.dueDate),
      maxScore: assignment.maxScore || 100,
      allowResubmission: Boolean(assignment.allowResubmission),
      status: assignment.status || "published"
    }));
    setError("");
    setFeedback("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteAssignment(assignment) {
    if (!canManageAssignment(assignment)) return;
    if (!window.confirm(`Delete "${assignment.title}"? Assignments with submissions must be archived instead.`)) return;

    setError("");
    setFeedback("");

    try {
      await mentorApi.deleteAssignment(assignment._id);
      if (editingAssignment?._id === assignment._id) {
        resetForm({ clearMessages: false });
      }
      if (viewAssignment?._id === assignment._id) {
        setViewAssignment(null);
      }
      setFeedback(`Assignment deleted: ${assignment.title}.`);
      await loadAssignments();
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setFeedback("");

    if (file.size > 50 * 1024 * 1024) {
      setError("Session material files must be 50 MB or smaller.");
      event.target.value = "";
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await mentorApi.uploadSessionFile(formData);
      setUploadedFile(response.data);
      setForm((current) => ({
        ...current,
        materialTitle: current.materialTitle || response.data.originalName || "Session materials"
      }));
      setFeedback(`${response.data.originalName || "File"} uploaded.`);
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
    setFeedback("");
    setIsSubmitting(true);

    try {
      const resourceLinks = form.resourceLinks
        .map((link) => ({
          title: link.title.trim(),
          url: link.url.trim()
        }))
        .filter((link) => link.url);
      const assignmentBreakdown = [
        form.assignmentOverview,
        form.assignmentTasks,
        form.assignmentDeliverables,
        form.gradingGuide,
        form.supportNotes
      ]
        .map((item) => item.trim())
        .filter(Boolean)
        .join("\n\n");

      if (editingAssignment) {
        const updatePayload = {
          title: form.assignmentTitle.trim(),
          instructions: assignmentBreakdown,
          dueDate: form.dueDate,
          resourceLinks,
          maxScore: Number(form.maxScore),
          allowResubmission: form.allowResubmission,
          status: form.status
        };

        if (form.module) {
          updatePayload.module = form.module;
        }

        if (uploadedFile?.url) {
          updatePayload.templateFileUrl = uploadedFile.url;
        }

        const response = await mentorApi.updateAssignment(editingAssignment._id, updatePayload);
        resetForm({ clearMessages: false });
        setFeedback(`Assignment updated: ${response.data.title}.`);
        await loadAssignments();
        return;
      }

      const payload = {
        session: form.session,
        module: form.module,
        recordingTitle: form.recordingTitle.trim(),
        recordingUrl: form.recordingUrl.trim(),
        assignmentTitle: form.assignmentTitle.trim(),
        assignmentBreakdown,
        assignmentSections: {
          overview: form.assignmentOverview.trim(),
          tasks: form.assignmentTasks.trim(),
          deliverables: form.assignmentDeliverables.trim(),
          grading: form.gradingGuide.trim(),
          supportNotes: form.supportNotes.trim()
        },
        resourceLinks,
        dueDate: form.dueDate,
        maxScore: Number(form.maxScore),
        allowResubmission: form.allowResubmission,
        status: form.status
      };

      if (uploadedFile) {
        payload.materialFile = {
          title: form.materialTitle.trim() || uploadedFile.originalName,
          url: uploadedFile.url,
          fileType: uploadedFile.fileType
        };
      }

      const response = await mentorApi.createSessionWork(payload);
      resetForm({ clearMessages: false });
      setFeedback(`Session work published: ${response.data.assignment.title}. ${response.data.notifiedStudents || 0} mentee(s) notified.`);
      await loadAssignments();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedSession = sessions.find((session) => session._id === form.session);
  const selectedSessionCohortId = selectedSession?.cohort?._id || selectedSession?.cohort || "";
  const availableModules = editingAssignment
    ? modules
    : selectedSessionCohortId
    ? modules.filter((module) => String(module.cohort?._id || module.cohort || "") === String(selectedSessionCohortId))
    : modules;
  const selectedModule = modules.find((module) => module._id === form.module);
  const statusOptions = editingAssignment ? assignmentStatusOptions : createStatusOptions;

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-6">
      <PageHeader
        actions={
          <Button icon={Plus} onClick={openCreateForm} type="button">
            Add Session Assignment
          </Button>
        }
        description="Publish post-session materials, recording links, and assignment breakdowns for mentees."
        title="Session work"
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}
      {feedback ? <p className="rounded-md bg-bybs-pale px-3 py-2 text-sm text-bybs-blue">{feedback}</p> : null}

      {workMode !== "list" ? (
      <Card className="w-full max-w-full">
        <form className="grid w-full min-w-0 grid-cols-1 gap-4 overflow-hidden lg:grid-cols-3" onSubmit={handleSubmit}>
          {editingAssignment ? (
            <div className="min-w-0 rounded-md border border-bybs-border bg-bybs-pale p-4 lg:col-span-3">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase text-bybs-blue">Editing assignment</p>
                  <h2 className="mt-1 text-lg font-semibold text-bybs-navy">{editingAssignment.title}</h2>
                  <p className="mt-1 text-sm text-bybs-body">
                    Update the assignment content, due date, resource links, score, resubmission setting, or status.
                  </p>
                </div>
                <Button icon={X} onClick={resetForm} type="button" variant="secondary">
                  Cancel edit
                </Button>
              </div>
            </div>
          ) : (
            <FormField label="Session">
              <select className={inputClassName} onChange={(event) => updateSession(event.target.value)} required value={form.session}>
                <option value="">Choose session</option>
                {sessions.map((session) => (
                  <option key={session._id} value={session._id}>
                    {session.title} - {session.module?.title || "No module"} - {sessionMentorName(session)} - {formatCatDateTime(session.startsAt)}
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="Module">
            <select
              className={inputClassName}
              disabled={Boolean(editingAssignment) || !availableModules.length}
              onChange={(event) => updateField("module", event.target.value)}
              required={!editingAssignment && Boolean(availableModules.length)}
              value={form.module}
            >
              <option value="">{availableModules.length ? "Choose module" : "No module available"}</option>
              {availableModules.map((module) => (
                <option key={module._id} value={module._id}>
                  {module.title}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Assignment title">
            <input
              className={inputClassName}
              onChange={(event) => updateField("assignmentTitle", event.target.value)}
              placeholder="Session reflection and action plan"
              required
              value={form.assignmentTitle}
            />
          </FormField>
          <FormField label="Due date">
            <input className={inputClassName} onChange={(event) => updateField("dueDate", event.target.value)} required type="date" value={form.dueDate} />
          </FormField>

          {!editingAssignment && selectedSession ? (
            <div className="min-w-0 rounded-md border border-bybs-border bg-bybs-pale p-4 text-sm lg:col-span-3">
              <p className="font-semibold text-bybs-navy">{selectedModule?.title || selectedSession.module?.title || "Module not selected"}</p>
              <p className="mt-1 text-bybs-body">
                {selectedSession.cohort?.title || "Cohort"} · {selectedModule?.startDate || selectedModule?.endDate ? `${formatDate(selectedModule?.startDate)} - ${formatDate(selectedModule?.endDate)}` : "Module dates not set"}
              </p>
            </div>
          ) : null}

          <div className="w-full min-w-0 max-w-full rounded-md border border-bybs-border bg-bybs-pale p-4 lg:col-span-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-bybs-navy">Slides, PDF, or document</p>
                <p className="mt-1 text-sm text-bybs-body">
                  {uploadedFile
                    ? uploadedFile.originalName
                    : editingAssignment
                      ? "Upload a replacement file for this assignment if needed."
                      : "Upload the session material mentees should read or download."}
                </p>
                {editingAssignment?.templateFileUrl && !uploadedFile ? (
                  <a className="mt-2 inline-block text-sm font-medium text-bybs-blue" href={editingAssignment.templateFileUrl} rel="noreferrer" target="_blank">
                    Open current file
                  </a>
                ) : null}
              </div>
              <div className="flex min-w-0 max-w-full flex-wrap gap-2">
                {uploadedFile ? (
                  <Button icon={X} onClick={() => setUploadedFile(null)} type="button" variant="secondary">
                    Remove file
                  </Button>
                ) : null}
                <Button disabled={isUploading} icon={Upload} onClick={() => fileInputRef.current?.click()} type="button" variant="secondary">
                  {isUploading ? "Uploading..." : "Upload file"}
                </Button>
                <input
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                  className="sr-only"
                  onChange={handleFileChange}
                  ref={fileInputRef}
                  type="file"
                />
              </div>
            </div>
            {uploadedFile ? (
              <div className="mt-4 min-w-0">
                <FormField label="Material title">
                  <input className={inputClassName} onChange={(event) => updateField("materialTitle", event.target.value)} value={form.materialTitle} />
                </FormField>
              </div>
            ) : null}
          </div>

          {!editingAssignment ? (
            <>
              <FormField label="Recording title">
                <input className={inputClassName} onChange={(event) => updateField("recordingTitle", event.target.value)} placeholder="Session recording" value={form.recordingTitle} />
              </FormField>
              <div className="min-w-0 lg:col-span-2">
                <FormField label="YouTube recording link">
                  <input className={inputClassName} onChange={(event) => updateField("recordingUrl", event.target.value)} placeholder="https://youtube.com/..." type="url" value={form.recordingUrl} />
                </FormField>
              </div>
            </>
          ) : null}

          <div className="min-w-0 lg:col-span-3">
            <FormField label="Assignment overview">
              <RichTextEditor
                id="assignment-overview"
                minHeightClassName="min-h-40"
                onChange={(value) => updateField("assignmentOverview", value)}
                placeholder="Set context for the assignment, why it matters, and what mentees should focus on."
                value={form.assignmentOverview}
              />
            </FormField>
          </div>

          <div className="min-w-0 lg:col-span-3">
            <FormField label="Tasks and steps">
              <RichTextEditor
                id="assignment-tasks"
                minHeightClassName="min-h-40"
                onChange={(value) => updateField("assignmentTasks", value)}
                placeholder="List the exact steps mentees should follow. Use clear numbered steps where helpful."
                value={form.assignmentTasks}
              />
            </FormField>
          </div>

          <div className="min-w-0 lg:col-span-3">
            <FormField label="Expected submission">
              <RichTextEditor
                id="assignment-deliverables"
                minHeightClassName="min-h-32"
                onChange={(value) => updateField("assignmentDeliverables", value)}
                placeholder="Describe what mentees should submit: file type, format, length, screenshots, links, or reflection notes."
                value={form.assignmentDeliverables}
              />
            </FormField>
          </div>

          <div className="min-w-0 lg:col-span-2">
            <FormField label="Grading guide">
              <RichTextEditor
                id="grading-guide"
                minHeightClassName="min-h-32"
                onChange={(value) => updateField("gradingGuide", value)}
                placeholder="Explain how the work will be assessed: completeness, quality, reflection, presentation, or rubric points."
                value={form.gradingGuide}
              />
            </FormField>
          </div>

          <FormField label="Support notes">
            <RichTextEditor
              id="support-notes"
              minHeightClassName="min-h-32"
              onChange={(value) => updateField("supportNotes", value)}
              placeholder="Add reminders, office hours, common mistakes, or how to ask for help."
              value={form.supportNotes}
            />
          </FormField>

          <div className="w-full min-w-0 max-w-full space-y-3 rounded-md border border-bybs-border bg-white p-4 lg:col-span-3">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-bybs-navy">Assignment resource links</p>
                <p className="mt-1 text-sm text-bybs-body">Add helpful links mentees should use alongside the uploaded material.</p>
              </div>
              <Button icon={Link} onClick={addResourceLink} type="button" variant="secondary">
                Add link
              </Button>
            </div>
            {form.resourceLinks.map((resourceLink, index) => (
              <div className="grid w-full min-w-0 max-w-full grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto]" key={`resource-link-${index}`}>
                <input
                  className={inputClassName}
                  onChange={(event) => updateResourceLink(index, "title", event.target.value)}
                  placeholder="Resource title"
                  value={resourceLink.title}
                />
                <input
                  className={inputClassName}
                  onChange={(event) => updateResourceLink(index, "url", event.target.value)}
                  placeholder="https://..."
                  type="url"
                  value={resourceLink.url}
                />
                <Button
                  disabled={form.resourceLinks.length === 1}
                  icon={X}
                  onClick={() => removeResourceLink(index)}
                  type="button"
                  variant="secondary"
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>

          <div className="min-w-0 rounded-md border border-bybs-border bg-bybs-pale p-4 text-sm leading-6 text-bybs-body lg:col-span-3">
            <p className="font-semibold text-bybs-navy">Mentee layout preview</p>
            <p className="mt-2">
              {editingAssignment
                ? "The assignment update will keep a clear learner-facing layout using the sections filled in below."
                : "The assignment will be saved with clear sections: overview, tasks, expected submission, grading guide, resource links, and support notes."}
            </p>
          </div>

          <FormField label="Max score">
            <input className={inputClassName} max="1000" min="1" onChange={(event) => updateField("maxScore", event.target.value)} type="number" value={form.maxScore} />
          </FormField>
          <FormField label="Status">
            <select className={inputClassName} onChange={(event) => updateField("status", event.target.value)} value={form.status}>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </FormField>
          <label className="flex items-center gap-3 self-end text-sm font-medium text-bybs-navy">
            <input
              checked={form.allowResubmission}
              className="h-4 w-4 rounded border-bybs-border"
              onChange={(event) => updateField("allowResubmission", event.target.checked)}
              type="checkbox"
            />
            Allow resubmission
          </label>

          <div className="flex min-w-0 flex-wrap gap-2 lg:col-span-3">
            <Button disabled={isSubmitting || isUploading} icon={editingAssignment ? Pencil : Plus} type="submit">
              {isSubmitting
                ? editingAssignment ? "Updating..." : "Publishing..."
                : editingAssignment ? "Update assignment" : "Publish session work"}
            </Button>
            <Button icon={X} onClick={resetForm} type="button" variant="secondary">
              {editingAssignment ? "Cancel edit" : "Close form"}
            </Button>
          </div>
        </form>
      </Card>
      ) : null}

      {viewAssignment && workMode === "list" ? (
        <AssignmentDetailsCard
          assignment={viewAssignment}
          canEdit={canManageAssignment(viewAssignment)}
          onClose={() => setViewAssignment(null)}
          onEdit={() => startEditAssignment(viewAssignment)}
        />
      ) : null}

      <section className="min-w-0 max-w-full overflow-hidden space-y-3">
        <div>
          <p className="text-sm font-semibold uppercase text-bybs-blue">Posted assignments</p>
          <h2 className="mt-1 text-lg font-semibold text-bybs-navy">Manage assignments you submitted</h2>
          <p className="mt-1 text-sm text-bybs-body">
            You can edit or delete assignments you created. Assignments that already have submissions should be closed or archived instead of deleted.
          </p>
        </div>
        <DataTable
          columns={[
            { key: "title", header: "Assignment", wrap: true },
            { key: "module", header: "Module", render: (row) => row.module?.title || "Unassigned" },
            { key: "dueDate", header: "Due", render: (row) => formatDate(row.dueDate) },
            { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
            { key: "createdBy", header: "Posted by", render: (row) => row.createdBy?.name || "BYBS team" },
            {
              key: "actions",
              header: "Actions",
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Button icon={Eye} onClick={() => viewAssignmentDetails(row)} size="sm" type="button" variant="secondary">
                    View
                  </Button>
                  {canManageAssignment(row) ? (
                    <>
                      <Button icon={Pencil} onClick={() => startEditAssignment(row)} size="sm" type="button" variant="secondary">
                        Edit
                      </Button>
                      <Button icon={Trash2} onClick={() => deleteAssignment(row)} size="sm" type="button" variant="danger">
                        Delete
                      </Button>
                    </>
                  ) : null}
                </div>
              )
            }
          ]}
          emptyDescription="Assignments you publish from session work will appear here."
          emptyTitle="No assignments posted yet"
          rows={assignments}
        />
      </section>

      <DataTable
        columns={[
          { key: "title", header: "Session" },
          { key: "startsAt", header: "Date", render: (row) => formatCatDateTime(row.startsAt) },
          { key: "cohort", header: "Cohort", render: (row) => row.cohort?.title || "Cohort" },
          { key: "module", header: "Module", render: (row) => row.module?.title || "Unassigned" },
          { key: "mentor", header: "Mentor", render: (row) => sessionMentorName(row) },
          { key: "moduleDates", header: "Module dates", render: (row) => row.module?.startDate || row.module?.endDate ? `${formatDate(row.module?.startDate)} - ${formatDate(row.module?.endDate)}` : "Not set" },
          { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
          {
            key: "attendance",
            header: "Attendance",
            render: (row) => (
              <Button as="a" href={`/attendance?session=${row._id}`} icon={ClipboardCheck} size="sm" variant="secondary">
                Mark
              </Button>
            )
          }
        ]}
        emptyDescription="Sessions created by Admin for your cohort will appear here."
        emptyTitle="No sessions available"
        rows={sessions}
      />
    </div>
  );
}
