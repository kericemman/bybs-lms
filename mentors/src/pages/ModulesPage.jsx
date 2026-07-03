import { BookOpen, CalendarDays, Eye, FileText, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  const detailsRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    mentorApi
      .listModules()
      .then((response) => {
        if (!isMounted) return;

        setModules(response.data);
        const requestedModuleId = searchParams.get("module");
        const requestedModule = response.data.find((module) => module._id === requestedModuleId);

        if (requestedModule) {
          setSelectedModuleId(requestedModule._id);
        } else if (!selectedModuleId && response.data.length === 1) {
          setSelectedModuleId(response.data[0]._id);
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

  function viewModule(module) {
    setSelectedModuleId(module._id);
    setSearchParams({ module: module._id });
    window.requestAnimationFrame(() => {
      detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
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

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={BookOpen} label="Assigned modules" tone="blue" value={modules.length} />
        <StatCard icon={Users} label="Published modules" tone="blue" value={publishedModules} />
        <StatCard icon={CalendarDays} label="Upcoming modules" tone="gold" value={upcomingModules} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <Card>
          <SectionHeader
            description="Use View to open the description and module expectations."
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
              rows={modules}
            />
          )}
        </Card>

        <div ref={detailsRef}>
          <Card>
            <SectionHeader
              description={selectedModule ? moduleDates(selectedModule) : "Select a module from the list."}
              title={selectedModule?.title || "Module details"}
            />
            {selectedModule ? (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="rounded-md bg-bybs-pale px-3 py-1 font-medium text-bybs-blue">
                    {selectedModule.cohort?.title || "Cohort"}
                  </span>
                  <StatusBadge status={selectedModule.status} />
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
            ) : (
              <p className="rounded-md bg-bybs-pale px-3 py-3 text-sm text-bybs-muted">
                Choose a module to see what it covers and how to prepare for the session.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
