import { Assignment } from "../models/Assignment.js";
import { Certificate } from "../models/Certificate.js";
import { MentorQuestion } from "../models/MentorQuestion.js";
import { Submission } from "../models/Submission.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { User } from "../models/User.js";
import { calculateCohortRanking, calculateStudentProgress } from "../services/progressService.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPagination } from "../utils/pagination.js";

const questionStatuses = ["open", "answered", "resolved"];
const supportStatuses = ["open", "inProgress", "resolved", "closed"];

function average(rows, key, predicate = () => true) {
  const measured = rows.filter(predicate);
  if (!measured.length) return 0;
  return Math.round(measured.reduce((total, row) => total + Number(row[key] || 0), 0) / measured.length);
}

function assessLearner(row) {
  const attentionReasons = [];
  const watchReasons = [];

  if (!["active", "completed"].includes(row.student?.status)) {
    attentionReasons.push(`Account is ${row.student?.status || "not active"}`);
  }
  if (row.needsRevisionCount > 0) {
    attentionReasons.push(`${row.needsRevisionCount} submission${row.needsRevisionCount === 1 ? "" : "s"} need revision`);
  }
  if (row.totalAssignments > 0 && row.assignmentCompletionPercentage < 50) {
    attentionReasons.push(`Assignment completion is ${row.assignmentCompletionPercentage}%`);
  }
  if (row.sessionsHeld > 0 && row.attendancePercentage < 60) {
    attentionReasons.push(`Attendance is ${row.attendancePercentage}%`);
  }

  if (row.pendingCount > 0) {
    watchReasons.push(`${row.pendingCount} assignment${row.pendingCount === 1 ? "" : "s"} pending`);
  }
  if (row.lateSubmissionCount > 0) {
    watchReasons.push(`${row.lateSubmissionCount} late submission${row.lateSubmissionCount === 1 ? "" : "s"}`);
  }
  if (row.scoredCount > 0 && row.scorePercentage < 60) {
    watchReasons.push(`Approved score is ${row.scorePercentage}%`);
  }
  if ((row.totalAssignments > 0 || row.sessionsHeld > 0) && row.progress < 70) {
    watchReasons.push(`Overall progress is ${row.progress}%`);
  }

  return {
    risk: attentionReasons.length ? "needsAttention" : watchReasons.length ? "watch" : "onTrack",
    attentionReasons: [...attentionReasons, ...watchReasons]
  };
}

function overviewSummary(rows, totals) {
  const assessed = rows.map((row) => ({ ...row, ...assessLearner(row) }));

  return {
    learners: rows.length,
    assignments: totals.assignments,
    sessions: totals.sessions,
    graduationReady: totals.graduationReady,
    needsAttention: assessed.filter((row) => row.risk === "needsAttention").length,
    watch: assessed.filter((row) => row.risk === "watch").length,
    averageProgress: average(rows, "progress"),
    averageAssignmentCompletion: average(rows, "assignmentCompletionPercentage", (row) => row.totalAssignments > 0),
    averageScore: average(rows, "scorePercentage", (row) => row.scoredCount > 0),
    averageAttendance: average(rows, "attendancePercentage", (row) => row.sessionsHeld > 0)
  };
}

function matchesSearch(row, search) {
  if (!search) return true;
  const term = search.toLowerCase();
  return [row.student?.name, row.student?.email, row.student?.mentor?.name]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(term));
}

function statusCounts(rows = [], statuses = []) {
  const counts = Object.fromEntries(statuses.map((status) => [status, 0]));
  rows.forEach((row) => {
    if (row && Object.hasOwn(counts, row._id)) counts[row._id] = row.count;
  });
  return counts;
}

export const listLearnerOverview = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const result = await calculateCohortRanking(req.query.cohort);
  const assessedRows = result.ranking.map((row) => ({ ...row, ...assessLearner(row) }));
  const summary = overviewSummary(result.ranking, result.totals);
  const filteredRows = assessedRows.filter((row) => {
    if (!matchesSearch(row, req.query.search)) return false;
    if (req.query.status && row.student?.status !== req.query.status) return false;
    if (req.query.risk && row.risk !== req.query.risk) return false;
    if (req.query.readiness === "ready" && !row.graduationReady) return false;
    if (req.query.readiness === "notReady" && row.graduationReady) return false;
    return true;
  });

  res.json({
    data: filteredRows.slice(skip, skip + limit),
    meta: {
      total: filteredRows.length,
      page,
      limit,
      pages: Math.max(1, Math.ceil(filteredRows.length / limit))
    },
    cohort: result.cohort,
    weights: result.weights,
    summary
  });
});

export const getLearnerOverview = asyncHandler(async (req, res) => {
  const student = await User.findOne({
    _id: req.params.id,
    role: "student",
    status: { $ne: "removed" }
  })
    .select("name email phone status profileImage bio cohort mentor lastLogin createdAt")
    .populate("cohort", "title status startDate endDate")
    .populate("mentor", "name email profileImage status");

  if (!student) {
    throw new ApiError(404, "Mentee not found");
  }
  if (!student.cohort?._id) {
    throw new ApiError(409, "Mentee is not assigned to a cohort");
  }

  const progress = await calculateStudentProgress(student);
  const assessment = assessLearner(progress);
  const assignmentIds = await Assignment.find({
    cohort: student.cohort._id,
    status: { $ne: "archived" }
  }).distinct("_id");
  const questionFilter = { student: student._id, cohort: student.cohort._id };
  const canViewQuestionSubjects = ["admin", "superAdmin"].includes(req.user.role);

  const [
    recentSubmissions,
    supportStatusRows,
    recentSupportTickets,
    questionStatusRows,
    recentQuestions,
    certificate
  ] = await Promise.all([
    Submission.find({ student: student._id, assignment: { $in: assignmentIds } })
      .select("assignment fileUrl linkUrl submittedAt resubmittedAt isLate score feedback feedbackFileUrl reviewedBy reviewedAt status attemptNumber updatedAt")
      .populate({
        path: "assignment",
        select: "title dueDate maxScore module",
        populate: { path: "module", select: "title" }
      })
      .populate("reviewedBy", "name role")
      .sort({ updatedAt: -1 })
      .limit(8),
    SupportTicket.aggregate([
      { $match: { student: student._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    SupportTicket.find({ student: student._id })
      .select("subject category status createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(5),
    MentorQuestion.aggregate([
      { $match: questionFilter },
      { $group: { _id: "$status", count: { $sum: 1 } } }
    ]),
    canViewQuestionSubjects
      ? MentorQuestion.find(questionFilter)
          .select("subject status mentor module assignment messageCount lastMessagePreview lastMessageAt")
          .populate("mentor", "name email profileImage")
          .populate("module", "title")
          .populate("assignment", "title")
          .sort({ lastMessageAt: -1 })
          .limit(5)
      : Promise.resolve([]),
    Certificate.findOne({ student: student._id, cohort: student.cohort._id })
      .select("status certificateNumber verificationCode mentorApprovedAt issuedAt revokedAt updatedAt")
      .sort({ updatedAt: -1 })
  ]);

  const supportCounts = statusCounts(supportStatusRows, supportStatuses);
  const questionCounts = statusCounts(questionStatusRows, questionStatuses);

  res.json({
    data: {
      student,
      progress,
      ...assessment,
      recentSubmissions,
      support: {
        counts: supportCounts,
        unresolved: supportCounts.open + supportCounts.inProgress,
        recent: recentSupportTickets
      },
      mentorQuestions: {
        counts: questionCounts,
        unresolved: questionCounts.open + questionCounts.answered,
        canViewSubjects: canViewQuestionSubjects,
        recent: recentQuestions
      },
      certificate
    }
  });
});
