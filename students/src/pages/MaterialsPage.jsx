import { BookOpen, Download, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, EmptyState, PageHeader, StatusBadge, downloadFileUrl, isUploadedFileUrl, normalizeFileUrl } from "@bybs/shared";
import { apiBaseUrl, studentApi } from "../services/api.js";
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
    <div className="min-w-0 max-w-full overflow-x-hidden space-y-6">
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
          {materials.map((material) => {
            const materialUrl = normalizeFileUrl(material.url, apiBaseUrl);
            const materialDownloadUrl = downloadFileUrl(material.url, apiBaseUrl);
            const canDownload = isUploadedFileUrl(material.url);

            return (
              <article className="min-w-0 max-w-full overflow-hidden rounded-lg border border-bybs-border bg-white p-4 shadow-sm" key={material._id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-semibold text-bybs-navy">{material.title}</h2>
                    <p className="mt-1 break-words text-sm text-bybs-body">{titleFor(material.module, "General material")}</p>
                  </div>
                  <StatusBadge label={material.type} status="published" />
                </div>
                {material.description ? <p className="mt-3 break-words text-sm text-bybs-body">{material.description}</p> : null}
                <div className="mt-4 space-y-1 text-xs text-bybs-muted">
                  <p>Session: {titleFor(material.session, "Not attached")}</p>
                  <p>Added {formatDateTime(material.createdAt)}</p>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    as="a"
                    href={materialUrl}
                    icon={ExternalLink}
                    rel="noreferrer"
                    size="sm"
                    target="_blank"
                    variant="secondary"
                  >
                    Open material
                  </Button>
                  {canDownload ? (
                    <Button as="a" download href={materialDownloadUrl} icon={Download} rel="noreferrer" size="sm" variant="secondary">
                      Download
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
