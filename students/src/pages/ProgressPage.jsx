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
  const breakdown = data.breakdown || {};

  return (
    <div className="space-y-6">
      <PageHeader
        description="Track submissions, feedback, revisions, scores, attendance, resources, discussions, and mentor sessions."
        title="My progress"
      />

      {error ? <p className="rounded-md bg-bybs-blush px-3 py-2 text-sm text-bybs-rose">{error}</p> : null}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={ClipboardList} label="Total assignments" value={data.totalAssignments || 0} />
        <StatCard icon={ClipboardCheck} label="Submitted" value={`${data.submittedCount || 0}/${data.totalAssignments || 0}`} />
        <StatCard icon={RotateCcw} label="Needs revision" tone="gold" value={data.needsRevisionCount || 0} />
        <StatCard icon={Award} label="Approved score" tone="rose" value={`${data.scorePercentage || 0}%`} />
      </div>

      <Card>
        <SectionHeader
          description="This gives you a quick weekly view of your accountability."
          title="Fellowship requirements"
        />
        <div className="space-y-5">
          <ProgressBar label="Overall progress" value={data.progress || 0} />
          <ProgressBar label="Assignment completion" value={data.assignmentCompletionPercentage || 0} />
          <ProgressBar label="Approved score" value={data.scorePercentage || 0} />
          <ProgressBar label="Attendance" value={data.attendancePercentage || 0} />
          <ProgressBar label="Punctuality" value={data.punctualityPercentage || 0} />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionHeader
            description="This formula is used consistently for BYBS progress and cohort ranking."
            title="Progress formula"
          />
          <div className="space-y-3">
            {[
              ["Assignment completion", breakdown.weights?.assignmentCompletion, breakdown.assignmentCompletion],
              ["Approved score", breakdown.weights?.score, breakdown.score],
              ["Attendance", breakdown.weights?.attendance, breakdown.attendance],
              ["Punctuality", breakdown.weights?.punctuality, breakdown.punctuality]
            ].map(([label, weight, value]) => (
              <div className="rounded-md border border-bybs-border bg-white p-3" key={label}>
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-bybs-navy">{label}</span>
                  <span className="text-bybs-muted">{weight || 0}% weight</span>
                </div>
                <ProgressBar value={value || 0} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionHeader title="Attendance and timing" />
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Attendance marked", data.attendanceMarked || 0],
              ["Attended", data.attended || 0],
              ["Late attendance", data.lateAttendanceCount || 0],
              ["Late submissions", data.lateSubmissionCount || 0]
            ].map(([label, value]) => (
              <div className="rounded-md border border-bybs-border bg-white p-3" key={label}>
                <p className="text-sm text-bybs-body">{label}</p>
                <p className="mt-2 text-xl font-semibold text-bybs-navy">{value}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
