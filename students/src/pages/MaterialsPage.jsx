import { BookOpen, CalendarDays, ClipboardList, Download, ExternalLink, Layers3, MessageCircleQuestion } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AddToCalendarButton,
  Button,
  CONTENT_TIMELINES,
  EmptyState,
  PageHeader,
  SafeHtml,
  StatusBadge,
  downloadFileUrl,
  isUploadedFileUrl,
  moduleTimelineStatus,
  normalizeFileUrl,
  timelineCounts
} from "@bybs/shared";
import { apiBaseUrl, studentApi } from "../services/api.js";
import { formatDate, formatDateTime, titleFor } from "../utils/format.js";

const materialTypeLabels = {
  external: "external link",
  pdf: "PDF",
  reading: "reading",
  recording: "recording",
  reflection: "reflection",
  slides: "slides",
  template: "template",
  video: "video",
  zoom: "Zoom link"
};

const fileTypeLabels = {
  csv: "CSV file",
  doc: "Word document",
  docx: "Word document",
  jpeg: "image",
  jpg: "image",
  mp4: "video",
  pdf: "PDF",
  png: "image",
  ppt: "slides",
  pptx: "slides",
  txt: "text file",
  webp: "image",
  xls: "spreadsheet",
  xlsx: "spreadsheet"
};

const materialButtonClassName =
  "w-full !bg-bybs-blue !text-white shadow-sm hover:!bg-bybs-blueHover focus-visible:!ring-bybs-pale sm:w-auto";

const richTextClassName =
  "text-sm leading-6 text-bybs-body [&_a]:break-words [&_a]:font-medium [&_a]:text-bybs-blue [&_a]:underline [&_h2]:mt-3 [&_h2]:font-semibold [&_h2]:text-bybs-navy [&_h3]:mt-3 [&_h3]:font-semibold [&_h3]:text-bybs-blue [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:my-2 [&_ul]:ml-5 [&_ul]:list-disc";

function idFor(value) {
  return String(value?._id || value?.id || value || "");
}

function materialActionTarget(material) {
  const fileType = String(material.fileType || "").trim().toLowerCase();
  const type = String(material.type || "").trim().toLowerCase();
  return fileTypeLabels[fileType] || materialTypeLabels[type] || "material";
}

function viewActionLabel(material) {
  const type = String(material.type || "").trim().toLowerCase();
  const target = materialActionTarget(material);

  if (type === "recording" || type === "video") return `Watch ${target}`;
  if (type === "reading") return `Read ${target}`;
  if (type === "zoom") return "Open Zoom link";
  if (type === "external") return "Open external link";
  return `View ${target}`;
}

function moduleDates(module) {
  if (!module?.startDate && !module?.endDate) return "Dates will be shared here";
  return `${formatDate(module.startDate)} - ${formatDate(module.endDate)}`;
}

function mentorName(module) {
  return module?.assignedMentor?.name || module?.assignedMentor?.email || "BYBS mentor";
}

function sessionCalendarEvent(session) {
  return {
    id: session._id,
    title: `BYBS session: ${session.title}`,
    description: `${session.module?.title || "BYBS learning session"}.`,
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    location: session.zoomLink || "BYBS LMS",
    url: session.zoomLink || ""
  };
}

function compareModules(left, right) {
  const leftOrder = Number(left.order || 0);
  const rightOrder = Number(right.order || 0);
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  const leftDate = new Date(left.startDate || left.endDate || 0).getTime();
  const rightDate = new Date(right.startDate || right.endDate || 0).getTime();
  return leftDate - rightDate || left.title.localeCompare(right.title);
}

function buildLearningGroups({ assignments, materials, modules, sessions }) {
  const groups = new Map();

  function ensureGroup(module) {
    const moduleId = idFor(module) || "general";
    if (!groups.has(moduleId)) {
      groups.set(moduleId, {
        _id: moduleId,
        title: moduleId === "general" ? "General learning" : module?.title || "Module",
        description: module?.description || "",
        startDate: module?.startDate,
        endDate: module?.endDate,
        order: module?.order,
        assignedMentor: module?.assignedMentor,
        timelineStatus: moduleId === "general" ? "current" : moduleTimelineStatus(module),
        assignments: [],
        materials: [],
        sessions: []
      });
    }
    return groups.get(moduleId);
  }

  modules.forEach((module) => ensureGroup(module));
  materials.forEach((item) => ensureGroup(item.module).materials.push(item));
  sessions.forEach((item) => ensureGroup(item.module).sessions.push(item));
  assignments.forEach((item) => ensureGroup(item.module).assignments.push(item));

  return [...groups.values()]
    .map((group) => ({
      ...group,
      materials: [...group.materials].sort((left, right) => new Date(right.createdAt || 0) - new Date(left.createdAt || 0)),
      sessions: [...group.sessions].sort((left, right) => new Date(left.startsAt || 0) - new Date(right.startsAt || 0)),
      assignments: [...group.assignments].sort((left, right) => new Date(left.dueDate || 0) - new Date(right.dueDate || 0))
    }))
    .sort(compareModules);
}

export function MaterialsPage() {
  const [modules, setModules] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [activeTimeline, setActiveTimeline] = useState("current");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      studentApi.listModules(),
      studentApi.listSessions(),
      studentApi.listMaterials(),
      studentApi.listAssignments()
    ])
      .then(([moduleResponse, sessionResponse, materialResponse, assignmentResponse]) => {
        setModules(moduleResponse.data || []);
        setSessions(sessionResponse.data || []);
        setMaterials(materialResponse.data || []);
        setAssignments(assignmentResponse.data || []);
      })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setIsLoading(false));
  }, []);

  const groups = useMemo(
    () => buildLearningGroups({ assignments, materials, modules, sessions }),
    [assignments, materials, modules, sessions]
  );
  const counts = useMemo(() => timelineCounts(groups, (group) => group.timelineStatus), [groups]);
  const visibleGroups = useMemo(
    () => groups.filter((group) => group.timelineStatus === activeTimeline),
    [activeTimeline, groups]
  );

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-6">
      <PageHeader description="Move through your modules, session resources, and assignments in one place." title="Learn" />

      <div aria-label="Learning timeline" className="flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist">
        {CONTENT_TIMELINES.map((timeline) => (
          <button
            aria-controls={`learning-${timeline.value}`}
            aria-selected={activeTimeline === timeline.value}
            className={`h-10 shrink-0 rounded-md px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bybs-blue focus-visible:ring-offset-2 ${activeTimeline === timeline.value ? "bg-bybs-blue text-white" : "border border-bybs-border bg-white text-bybs-body hover:bg-bybs-pale hover:text-bybs-blue"}`}
            key={timeline.value}
            onClick={() => setActiveTimeline(timeline.value)}
            role="tab"
            type="button"
          >
            {timeline.label} ({counts[timeline.value]})
          </button>
        ))}
      </div>

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose" role="alert">{error}</p> : null}

      {isLoading ? (
        <div className="rounded-lg border border-bybs-border bg-white p-8 text-center text-sm text-bybs-muted" role="status">Loading your learning content...</div>
      ) : !groups.length ? (
        <EmptyState description="Published modules and resources will appear here once your cohort begins." icon={BookOpen} title="No learning content yet" />
      ) : !visibleGroups.length ? (
        <EmptyState description={`You do not have ${activeTimeline} modules right now.`} icon={Layers3} title={`No ${activeTimeline} modules`} />
      ) : (
        <div className="space-y-10" id={`learning-${activeTimeline}`} role="tabpanel">
          {visibleGroups.map((group) => (
            <section className="min-w-0 border-b border-bybs-border pb-10 last:border-b-0" key={group._id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase text-bybs-blue">{activeTimeline} module</p>
                  <h2 className="mt-1 break-words text-xl font-semibold text-bybs-navy">{group.title}</h2>
                  <p className="mt-1 text-sm text-bybs-body">{moduleDates(group)} · Mentor: {mentorName(group)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge label={activeTimeline} status={activeTimeline === "completed" ? "completed" : "active"} />
                  {group._id !== "general" ? (
                    <Button as="a" href={`/app/questions?module=${group._id}`} icon={MessageCircleQuestion} size="sm" variant="secondary">Ask mentor</Button>
                  ) : null}
                </div>
              </div>

              {group.description ? <SafeHtml className={`${richTextClassName} mt-4 max-w-3xl`} html={group.description} /> : null}

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-bybs-muted">
                <span>{group.materials.length} resources</span>
                <span>{group.sessions.length} sessions</span>
                <span>{group.assignments.length} assignments</span>
              </div>

              {group.materials.length ? (
                <div className="mt-6">
                  <div className="mb-3 flex items-center gap-2"><BookOpen className="h-4 w-4 text-bybs-blue" aria-hidden="true" /><h3 className="font-semibold text-bybs-navy">Resources</h3></div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {group.materials.map((material) => {
                      const materialUrl = normalizeFileUrl(material.url, apiBaseUrl);
                      const materialDownloadUrl = downloadFileUrl(material.url, apiBaseUrl);
                      const canDownload = isUploadedFileUrl(material.url);

                      return (
                        <article className="min-w-0 max-w-full overflow-hidden rounded-lg border border-bybs-border bg-white p-4 shadow-sm" key={material._id}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0"><h4 className="break-words text-base font-semibold text-bybs-navy">{material.title}</h4><p className="mt-1 text-xs text-bybs-muted">{titleFor(material.session, "Module resource")}</p></div>
                            <StatusBadge label={material.type} status="published" />
                          </div>
                          {material.description ? <SafeHtml className={`${richTextClassName} mt-3`} html={material.description} /> : null}
                          <p className="mt-3 text-xs text-bybs-muted">Added {formatDateTime(material.createdAt)}</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button as="a" className={materialButtonClassName} href={materialUrl} icon={ExternalLink} rel="noreferrer" size="sm" target="_blank" variant="primary">{viewActionLabel(material)}</Button>
                            {canDownload ? <Button as="a" className={materialButtonClassName} download href={materialDownloadUrl} icon={Download} rel="noreferrer" size="sm" variant="primary">Download {materialActionTarget(material)}</Button> : null}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {group.sessions.length ? (
                <div className="mt-7">
                  <div className="mb-3 flex items-center gap-2"><CalendarDays className="h-4 w-4 text-bybs-blue" aria-hidden="true" /><h3 className="font-semibold text-bybs-navy">Sessions</h3></div>
                  <div className="space-y-3">
                    {group.sessions.map((session) => (
                      <article className="flex flex-col gap-3 rounded-lg border border-bybs-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between" key={session._id}>
                        <div className="min-w-0"><h4 className="break-words font-semibold text-bybs-navy">{session.title}</h4><p className="mt-1 text-sm text-bybs-body">{formatDateTime(session.startsAt)}</p></div>
                        <div className="flex flex-wrap gap-2">
                          {session.zoomLink ? <Button as="a" href={session.zoomLink} icon={ExternalLink} rel="noreferrer" size="sm" target="_blank" variant="secondary">Open session link</Button> : null}
                          <AddToCalendarButton event={sessionCalendarEvent(session)} fileName={`bybs-session-${session._id}`} />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {group.assignments.length ? (
                <div className="mt-7">
                  <div className="mb-3 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-bybs-blue" aria-hidden="true" /><h3 className="font-semibold text-bybs-navy">Assignments</h3></div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {group.assignments.map((assignment) => (
                      <article className="flex min-w-0 flex-col gap-3 rounded-lg border border-bybs-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between" key={assignment._id}>
                        <div className="min-w-0"><h4 className="break-words font-semibold text-bybs-navy">{assignment.title}</h4><p className="mt-1 text-sm text-bybs-body">Due {formatDateTime(assignment.dueDate)}</p></div>
                        <Button as="a" href={`/app/assignments?assignment=${assignment._id}`} size="sm" variant="secondary">Open assignment</Button>
                      </article>
                    ))}
                  </div>
                </div>
              ) : null}

              {!group.materials.length && !group.sessions.length && !group.assignments.length ? (
                <p className="mt-5 rounded-md bg-bybs-pale px-4 py-3 text-sm text-bybs-body">Content for this module will appear here when it is published.</p>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
