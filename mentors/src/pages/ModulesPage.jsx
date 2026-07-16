import { BookOpen, CalendarDays, Eye, FileText, Users, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  DataTable,
  PageHeader,
  SafeHtml,
  SectionHeader,
  StatCard,
  StatusBadge
} from "@bybs/shared";
import { mentorApi } from "../services/api.js";
import { formatDate } from "../utils/format.js";

const detailContentClassName =
  "text-sm leading-6 text-bybs-body [&_a]:font-medium [&_a]:text-bybs-blue [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-bybs-rose [&_blockquote]:bg-bybs-blush [&_blockquote]:px-4 [&_blockquote]:py-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-bybs-navy [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-bybs-blue [&_ol]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1 [&_p]:my-2 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1";

function moduleDates(module) {
  if (!module?.startDate && !module?.endDate) return "Not set";
  return `${formatDate(module.startDate)} - ${formatDate(module.endDate)}`;
}

function plainDescription(value = "") {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function ModulesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [modules, setModules] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState(searchParams.get("module") || "");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    mentorApi
      .listModules()
      .then((moduleResponse) => {
        if (!isMounted) return;

        setModules(moduleResponse.data);
        const requestedModuleId = searchParams.get("module");
        const requestedModule = moduleResponse.data.find((module) => module._id === requestedModuleId);

        if (requestedModule) {
          setSelectedModuleId(requestedModule._id);
        }
      })
      .catch((requestError) => {
        if (isMounted) setError(requestError.message);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedModule = useMemo(
    () => modules.find((module) => module._id === selectedModuleId),
    [modules, selectedModuleId]
  );
  const moduleStats = useMemo(() => {
    return Object.fromEntries(
      modules.map((module) => [
        module._id,
        module.stats || { assignments: 0, submitted: 0, pending: 0, late: 0 }
      ])
    );
  }, [modules]);
  const moduleRows = modules.map((module) => ({
    ...module,
    stats: moduleStats[module._id] || { assignments: 0, submitted: 0, pending: 0, late: 0 }
  }));

  function viewModule(module) {
    setSelectedModuleId(module._id);
    setSearchParams({ module: module._id });
  }

  function closeModuleDetails() {
    setSelectedModuleId("");
    setSearchParams({});
  }

  const publishedModules = modules.filter((module) => module.status === "published").length;
  const upcomingModules = modules.filter((module) => module.startDate && new Date(module.startDate) > new Date()).length;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <Button as="a" href="/session-work" icon={FileText} variant="secondary">
            Upload session work
          </Button>
        }
        description="Review modules assigned by Admin, including dates, cohort context, and the full module outline."
        title="Assigned modules"
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
        <StatCard icon={BookOpen} label="Assigned modules" tone="blue" value={modules.length} />
        <StatCard icon={Users} label="Published modules" tone="blue" value={publishedModules} />
        <StatCard icon={CalendarDays} label="Upcoming modules" tone="gold" value={upcomingModules} />
      </div>

      <Card>
        <SectionHeader
          description="Use View to open the selected module outline, dates, and submission stats."
          title="Module list"
        />
        {isLoading ? (
          <div className="rounded-lg border border-bybs-border bg-white p-8 text-center text-sm text-bybs-muted">
            Loading modules...
          </div>
        ) : (
          <DataTable
            columns={[
              { key: "title", header: "Module" },
              { key: "cohort", header: "Cohort", render: (row) => row.cohort?.title || "Cohort" },
              { key: "dates", header: "Dates", render: (row) => moduleDates(row) },
              { key: "assignments", header: "Assignments", render: (row) => row.stats.assignments },
              { key: "submitted", header: "Submitted", render: (row) => row.stats.submitted },
              { key: "pending", header: "Pending", render: (row) => row.stats.pending },
              { key: "late", header: "Late", render: (row) => row.stats.late },
              { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
              {
                key: "actions",
                header: "Actions",
                render: (row) => (
                  <Button icon={Eye} onClick={() => viewModule(row)} size="sm" type="button" variant="secondary">
                    View
                  </Button>
                )
              }
            ]}
            emptyDescription="Modules assigned to you by Admin will appear here."
            emptyTitle="No modules assigned"
            rows={moduleRows}
          />
        )}
      </Card>

      {selectedModule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bybs-navy/50 px-4 py-6">
          <section className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg border border-bybs-border bg-white shadow-xl">
            <div className="flex flex-col gap-3 border-b border-bybs-border p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-bybs-blue">{selectedModule.cohort?.title || "Cohort"}</p>
                <h2 className="mt-1 text-xl font-semibold text-bybs-navy">{selectedModule.title}</h2>
                <p className="mt-1 text-sm text-bybs-muted">{moduleDates(selectedModule)}</p>
              </div>
              <Button aria-label="Close module details" icon={X} onClick={closeModuleDetails} size="icon" type="button" variant="ghost" />
            </div>
            <div className="max-h-[calc(90vh-96px)] space-y-5 overflow-y-auto p-4 sm:p-5">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-md bg-bybs-pale px-3 py-1 font-medium text-bybs-blue">
                  {selectedModule.cohort?.title || "Cohort"}
                </span>
                <StatusBadge status={selectedModule.status} />
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ["Assignments", moduleStats[selectedModule._id]?.assignments || 0],
                  ["Submitted", moduleStats[selectedModule._id]?.submitted || 0],
                  ["Pending", moduleStats[selectedModule._id]?.pending || 0],
                  ["Late", moduleStats[selectedModule._id]?.late || 0]
                ].map(([label, value]) => (
                  <div className="rounded-md border border-bybs-border bg-white px-3 py-2" key={label}>
                    <p className="text-xs font-medium text-bybs-muted">{label}</p>
                    <p className="mt-1 text-lg font-semibold text-bybs-navy">{value}</p>
                  </div>
                ))}
              </div>
              {selectedModule.description ? (
                <SafeHtml className={detailContentClassName} html={selectedModule.description} />
              ) : (
                <p className="rounded-md bg-bybs-pale px-3 py-3 text-sm text-bybs-muted">
                  No description has been added for this module yet.
                </p>
              )}
              {plainDescription(selectedModule.description).length > 0 ? (
                <Button as="a" href="/session-work" icon={FileText} variant="secondary">
                  Add session work for this module
                </Button>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
