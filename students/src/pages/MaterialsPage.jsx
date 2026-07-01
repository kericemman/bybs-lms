import { BookOpen, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, EmptyState, PageHeader, StatusBadge } from "@bybs/shared";
import { studentApi } from "../services/api.js";
import { formatDateTime, titleFor } from "../utils/format.js";

export function MaterialsPage() {
  const [materials, setMaterials] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    studentApi.listMaterials()
      .then((response) => setMaterials(response.data))
      .catch((loadError) => setError(loadError.message));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        description="Access slides, PDFs, recordings, templates, readings, videos, and reflection questions."
        title="Learning materials"
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

      {!materials.length ? (
        <EmptyState
          description="Published cohort resources will appear here once uploaded by admins or mentors."
          icon={BookOpen}
          title="No resources yet"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {materials.map((material) => (
            <article className="rounded-lg border border-bybs-border bg-white p-4 shadow-sm" key={material._id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-bybs-navy">{material.title}</h2>
                  <p className="mt-1 text-sm text-bybs-body">{titleFor(material.module, "General material")}</p>
                </div>
                <StatusBadge label={material.type} status="published" />
              </div>
              {material.description ? <p className="mt-3 text-sm text-bybs-body">{material.description}</p> : null}
              <div className="mt-4 space-y-1 text-xs text-bybs-muted">
                <p>Session: {titleFor(material.session, "Not attached")}</p>
                <p>Added {formatDateTime(material.createdAt)}</p>
              </div>
              <Button
                as="a"
                className="mt-4"
                href={material.url}
                icon={ExternalLink}
                rel="noreferrer"
                size="sm"
                target="_blank"
                variant="secondary"
              >
                Open material
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
