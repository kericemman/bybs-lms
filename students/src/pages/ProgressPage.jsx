import { Award, ClipboardCheck, ClipboardList, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, PageHeader, ProgressBar, SectionHeader, StatCard } from "@bybs/shared";
import { studentApi } from "../services/api.js";

export function ProgressPage() {
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    studentApi.progress()
      .then((response) => setProgress(response.data))
      .catch((loadError) => setError(loadError.message));
  }, []);

  const data = progress || {};

  return (
    <div className="space-y-6">
      <PageHeader
        description="Track submissions, feedback, revisions, scores, attendance, resources, discussions, and mentor sessions."
        title="My progress"
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ClipboardList} label="Total assignments" value={data.totalAssignments || 0} />
        <StatCard icon={ClipboardCheck} label="Submitted" value={data.submittedCount || 0} />
        <StatCard icon={RotateCcw} label="Needs revision" tone="gold" value={data.needsRevisionCount || 0} />
        <StatCard icon={Award} label="Average score" tone="rose" value={data.averageScore ?? "N/A"} />
      </div>

      <Card>
        <SectionHeader
          description="This gives you a quick weekly view of your accountability."
          title="Fellowship requirements"
        />
        <div className="space-y-5">
          <ProgressBar label="Overall progress" value={data.progress || 0} />
          <ProgressBar label="Assignment completion" value={data.progress || 0} />
          <ProgressBar label="Attendance" value={data.attendancePercentage || 0} />
        </div>
      </Card>
    </div>
  );
}
