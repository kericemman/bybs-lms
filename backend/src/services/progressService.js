import { Assignment } from "../models/Assignment.js";
import { Cohort } from "../models/Cohort.js";
import { Session } from "../models/Session.js";
import { Submission } from "../models/Submission.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/apiError.js";

const assignmentStatuses = ["published", "closed"];
const submittedStatuses = ["submitted", "lateSubmission", "reviewed", "needsRevision", "approved"];
const reviewedStatuses = ["reviewed", "approved"];
const attendanceWeights = {
  present: 1,
  late: 0.75,
  excused: 1,
  absent: 0
};

export const PROGRESS_WEIGHTS = {
  assignmentCompletion: 25,
  score: 35,
  attendance: 25,
  punctuality: 15
};

function idFor(value) {
  return String(value?._id || value?.id || value || "");
}

function percentage(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function round(value) {
  return Math.round(Number(value) || 0);
}

function assignmentMap(assignments = []) {
  return new Map(assignments.map((assignment) => [idFor(assignment), assignment]));
}

function groupSubmissionsByStudent(submissions = []) {
  const grouped = new Map();

  submissions.forEach((submission) => {
    const studentId = idFor(submission.student);
    if (!grouped.has(studentId)) {
      grouped.set(studentId, []);
    }
    grouped.get(studentId).push(submission);
  });

  return grouped;
}

function sessionAttendanceForStudent(sessions = [], studentId) {
  const marked = [];

  sessions.forEach((session) => {
    const record = session.attendance?.find((item) => idFor(item.student) === studentId);
    if (record) marked.push(record);
  });

  const weightedAttendance = marked.reduce((total, record) => total + (attendanceWeights[record.status] ?? 0), 0);
  const presentCount = marked.filter((record) => record.status === "present").length;
  const lateCount = marked.filter((record) => record.status === "late").length;
  const excusedCount = marked.filter((record) => record.status === "excused").length;
  const absentCount = marked.filter((record) => record.status === "absent").length;

  return {
    attendanceMarked: marked.length,
    attended: presentCount + lateCount + excusedCount,
    presentCount,
    lateAttendanceCount: lateCount,
    excusedCount,
    absentCount,
    attendancePercentage: percentage(weightedAttendance, marked.length)
  };
}

function scoreSummary({ assignments, submissions }) {
  const assignmentsById = assignmentMap(assignments);
  const scored = submissions.filter((submission) => submission.status === "approved" && typeof submission.score === "number");
  const earnedScore = scored.reduce((total, submission) => total + Number(submission.score || 0), 0);
  const possibleScore = scored.reduce((total, submission) => {
    const assignment = assignmentsById.get(idFor(submission.assignment));
    return total + Number(assignment?.maxScore || 100);
  }, 0);

  return {
    scoredCount: scored.length,
    approvedCount: submissions.filter((submission) => submission.status === "approved").length,
    reviewedCount: submissions.filter((submission) => reviewedStatuses.includes(submission.status)).length,
    earnedScore,
    possibleScore,
    scorePercentage: percentage(earnedScore, possibleScore),
    averageScore: scored.length ? round(earnedScore / scored.length) : null
  };
}

function buildProgressRow({ student, assignments, submissions, sessions, rank = null }) {
  const studentId = idFor(student);
  const totalAssignments = assignments.length;
  const assignmentsById = assignmentMap(assignments);
  const submitted = submissions.filter((submission) => submittedStatuses.includes(submission.status));
  const submittedAssignmentIds = new Set(submitted.map((submission) => idFor(submission.assignment)));
  const lateSubmissions = submissions.filter((submission) => submission.status === "lateSubmission" || submission.isLate);
  const needsRevisionCount = submissions.filter((submission) => submission.status === "needsRevision").length;
  const onTimeSubmissions = submitted.filter((submission) => {
    const assignment = assignmentsById.get(idFor(submission.assignment));
    if (!assignment?.dueDate) return !submission.isLate && submission.status !== "lateSubmission";
    return !submission.isLate && new Date(submission.submittedAt || submission.createdAt) <= new Date(assignment.dueDate);
  });
  const score = scoreSummary({ assignments, submissions });
  const attendance = sessionAttendanceForStudent(sessions, studentId);
  const assignmentCompletionPercentage = percentage(submittedAssignmentIds.size, totalAssignments);
  const punctualityPercentage = percentage(onTimeSubmissions.length, totalAssignments);
  const overallProgress = round(
    (assignmentCompletionPercentage * PROGRESS_WEIGHTS.assignmentCompletion +
      score.scorePercentage * PROGRESS_WEIGHTS.score +
      attendance.attendancePercentage * PROGRESS_WEIGHTS.attendance +
      punctualityPercentage * PROGRESS_WEIGHTS.punctuality) /
      100
  );
  const graduationReady =
    totalAssignments > 0 &&
    overallProgress >= 70 &&
    assignmentCompletionPercentage >= 80 &&
    score.scorePercentage >= 60 &&
    attendance.attendancePercentage >= 70;

  return {
    student: {
      _id: student._id,
      id: student.id || studentId,
      name: student.name,
      email: student.email,
      phone: student.phone,
      status: student.status,
      cohort: student.cohort,
      profileImage: student.profileImage
    },
    rank,
    totalAssignments,
    submittedCount: submittedAssignmentIds.size,
    pendingCount: Math.max(totalAssignments - submittedAssignmentIds.size, 0),
    lateSubmissionCount: lateSubmissions.length,
    needsRevisionCount,
    ...score,
    ...attendance,
    assignmentCompletionPercentage,
    punctualityPercentage,
    progress: overallProgress,
    graduationReady,
    breakdown: {
      weights: PROGRESS_WEIGHTS,
      assignmentCompletion: assignmentCompletionPercentage,
      score: score.scorePercentage,
      attendance: attendance.attendancePercentage,
      punctuality: punctualityPercentage
    }
  };
}

function rankRows(rows) {
  return rows
    .sort((left, right) => {
      if (right.progress !== left.progress) return right.progress - left.progress;
      if (right.scorePercentage !== left.scorePercentage) return right.scorePercentage - left.scorePercentage;
      if (right.attendancePercentage !== left.attendancePercentage) return right.attendancePercentage - left.attendancePercentage;
      if (right.assignmentCompletionPercentage !== left.assignmentCompletionPercentage) {
        return right.assignmentCompletionPercentage - left.assignmentCompletionPercentage;
      }
      return String(left.student.name || "").localeCompare(String(right.student.name || ""));
    })
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export async function calculateStudentProgress(student, { now = new Date() } = {}) {
  const cohortId = student.cohort?._id || student.cohort;

  if (!cohortId) {
    throw new ApiError(400, "Mentee is not assigned to a cohort");
  }

  const assignments = await Assignment.find({
    cohort: cohortId,
    status: { $in: assignmentStatuses }
  }).select("_id title dueDate maxScore status");
  const assignmentIds = assignments.map((assignment) => assignment._id);
  const [submissions, sessions] = await Promise.all([
    Submission.find({
      student: student._id,
      assignment: { $in: assignmentIds }
    }),
    Session.find({
      cohort: cohortId,
      status: { $ne: "cancelled" },
      startsAt: { $lte: now }
    }).select("attendance status startsAt")
  ]);

  return buildProgressRow({ student, assignments, submissions, sessions });
}

export async function calculateCohortRanking(cohortId, { now = new Date() } = {}) {
  const cohort = await Cohort.findById(cohortId).select("title status startDate endDate");

  if (!cohort) {
    throw new ApiError(404, "Cohort not found");
  }

  const [students, assignments, sessions] = await Promise.all([
    User.find({
      role: "student",
      cohort: cohortId,
      status: { $ne: "removed" }
    })
      .select("name email phone status cohort profileImage")
      .sort({ name: 1 }),
    Assignment.find({
      cohort: cohortId,
      status: { $in: assignmentStatuses }
    }).select("_id title dueDate maxScore status"),
    Session.find({
      cohort: cohortId,
      status: { $ne: "cancelled" },
      startsAt: { $lte: now }
    }).select("attendance status startsAt")
  ]);
  const submissions = await Submission.find({
    student: { $in: students.map((student) => student._id) },
    assignment: { $in: assignments.map((assignment) => assignment._id) }
  });
  const submissionsByStudent = groupSubmissionsByStudent(submissions);
  const ranking = rankRows(
    students.map((student) =>
      buildProgressRow({
        student,
        assignments,
        submissions: submissionsByStudent.get(idFor(student)) || [],
        sessions
      })
    )
  );

  return {
    cohort,
    weights: PROGRESS_WEIGHTS,
    totals: {
      students: students.length,
      assignments: assignments.length,
      sessions: sessions.length,
      graduationReady: ranking.filter((row) => row.graduationReady).length
    },
    ranking
  };
}
