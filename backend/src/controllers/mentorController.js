import { Assignment } from "../models/Assignment.js";
import { Booking } from "../models/Booking.js";
import { Certificate } from "../models/Certificate.js";
import { env } from "../config/env.js";
import { Discussion } from "../models/Discussion.js";
import { MentorAvailability } from "../models/MentorAvailability.js";
import { Module } from "../models/Module.js";
import { Notification } from "../models/Notification.js";
import { Reminder } from "../models/Reminder.js";
import { Report } from "../models/Report.js";
import { Resource } from "../models/Resource.js";
import { Session } from "../models/Session.js";
import { Submission } from "../models/Submission.js";
import { User } from "../models/User.js";
import {
  mentorAssignmentVisibilityFilter,
  mentorCohortIds,
  mentorVisibleModuleFilter,
  mentorVisibleModuleIds
} from "../services/mentorScopeService.js";
import { emailConfigured, sendEmail } from "../services/emailService.js";
import { serializeCertificate } from "../services/certificateService.js";
import { notifyUser, notifyUsers } from "../services/portalNotificationService.js";
import { calculateStudentProgress } from "../services/progressService.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { sanitizePlainText, sanitizeRichText } from "../utils/sanitizeRichText.js";

const reviewableStatuses = ["submitted", "lateSubmission", "needsRevision"];
const activeAssignmentStatuses = ["published", "closed"];

function idFor(value) {
  return String(value?._id || value?.id || value || "");
}

async function graduationProgressForStudent(student) {
  if (!student?.cohort) return null;

  try {
    return await calculateStudentProgress(student);
  } catch (error) {
    return {
      graduationReady: false,
      progress: 0,
      error: error.message
    };
  }
}

function attendanceSummary(session, expectedCount = 0) {
  const counts = {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0
  };

  (session.attendance || []).forEach((record) => {
    if (counts[record.status] !== undefined) {
      counts[record.status] += 1;
    }
  });

  const marked = Object.values(counts).reduce((total, count) => total + count, 0);

  return {
    ...counts,
    marked,
    total: expectedCount || marked,
    pending: Math.max((expectedCount || marked) - marked, 0)
  };
}

async function assignedStudentFilter(mentor) {
  const cohortIds = await mentorCohortIds(mentor);
  const scopes = [{ mentor: mentor._id }];

  if (cohortIds.length) {
    scopes.push({ cohort: { $in: cohortIds } });
  }

  return {
    role: "student",
    status: { $ne: "removed" },
    $or: scopes
  };
}

async function assignedStudents(mentor) {
  return User.find(await assignedStudentFilter(mentor))
    .select("name email phone status cohort mentor lastLogin createdAt")
    .populate("cohort", "title status")
    .sort({ name: 1 });
}

async function findAssignedStudent(mentor, studentId, select = "_id") {
  const student = await User.findOne({
    ...(await assignedStudentFilter(mentor)),
    _id: studentId
  })
    .select(select)
    .populate("cohort", "title status");

  if (!student) {
    throw new ApiError(403, "This student is not assigned to you");
  }

  return student;
}

async function assertStudentInScope(mentor, studentId) {
  await findAssignedStudent(mentor, studentId);
}

async function assertStudentsInScope(mentor, studentIds = []) {
  if (!studentIds.length) return;

  const allowedStudents = await User.find({
    ...(await assignedStudentFilter(mentor)),
    _id: { $in: studentIds }
  }).select("_id");
  const allowedIds = new Set(allowedStudents.map((student) => String(student._id)));
  const denied = studentIds.find((id) => !allowedIds.has(String(id)));

  if (denied) {
    throw new ApiError(403, "Report includes a student outside your assigned scope");
  }
}

function escapeRegExp(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function discussionSearchFilter(search = "") {
  const cleanSearch = sanitizePlainText(search).trim();
  if (!cleanSearch) return {};

  const pattern = { $regex: escapeRegExp(cleanSearch), $options: "i" };
  return { $or: [{ title: pattern }, { body: pattern }] };
}

const mentorDiscussionAudiences = ["all", "mentorsAdmins", "mentorsOnly", "mentorsMentees"];

function discussionAudienceFilter(audiences) {
  return {
    $or: [
      { audience: { $exists: false } },
      { audience: { $in: audiences } }
    ]
  };
}

function attachAndFilters(filter, filters) {
  const activeFilters = filters.filter((item) => item && Object.keys(item).length);
  if (activeFilters.length) {
    filter.$and = activeFilters;
  }
  return filter;
}

function populateDiscussion(query) {
  return query
    .populate("cohort", "title status")
    .populate("module", "title status startDate endDate")
    .populate("createdBy", "name email role profileImage bio expertise")
    .populate("comments.createdBy", "name email role profileImage bio expertise");
}

async function populateDiscussionDocument(discussion) {
  await discussion.populate("cohort", "title status");
  await discussion.populate("module", "title status startDate endDate");
  await discussion.populate("createdBy", "name email role profileImage bio expertise");
  await discussion.populate("comments.createdBy", "name email role profileImage bio expertise");
}

function submissionFilter(studentIds, assignmentIds, status) {
  const filter = {
    student: { $in: studentIds },
    assignment: { $in: assignmentIds }
  };
  if (status) filter.status = status;
  return filter;
}

async function mentorScopedAssignmentFilter(mentor, { cohortId, moduleId, statuses = activeAssignmentStatuses } = {}) {
  const cohortIds = await mentorCohortIds(mentor);
  const scopedCohortIds = cohortId
    ? cohortIds.filter((id) => String(id) === String(cohortId))
    : cohortIds;

  if (!scopedCohortIds.length) {
    return { _id: null };
  }

  if (moduleId) {
    const assignedModule = await Module.findOne({
      _id: moduleId,
      cohort: { $in: scopedCohortIds },
      assignedMentor: mentor._id,
      status: { $ne: "archived" }
    }).select("_id");

    if (!assignedModule) {
      return { _id: null };
    }
  }

  const assignedModules = await Module.find({
    cohort: { $in: scopedCohortIds },
    assignedMentor: mentor._id,
    status: { $ne: "archived" }
  }).select("_id");
  const moduleIds = assignedModules.map((module) => module._id);
  const scopes = [{ createdBy: mentor._id }];

  if (moduleIds.length) {
    scopes.push({ module: { $in: moduleIds } });
  }

  const filter = {
    cohort: { $in: scopedCohortIds },
    $or: scopes
  };

  if (statuses?.length) {
    filter.status = { $in: statuses };
  } else {
    filter.status = { $ne: "archived" };
  }

  if (moduleId) {
    filter.module = moduleId;
  }

  return filter;
}

async function mentorScopedAssignmentIds(mentor, options = {}) {
  const assignments = await Assignment.find(await mentorScopedAssignmentFilter(mentor, options)).select("_id");
  return assignments.map((assignment) => assignment._id);
}

async function mentorModuleSubmissionStats(mentor, modules = []) {
  if (!modules.length) return {};

  const students = await User.find(await assignedStudentFilter(mentor)).select("_id cohort");
  const studentIds = students.map((student) => student._id);
  const studentIdsByCohort = new Map();

  students.forEach((student) => {
    const cohortId = String(student.cohort || "");
    if (!studentIdsByCohort.has(cohortId)) {
      studentIdsByCohort.set(cohortId, new Set());
    }
    studentIdsByCohort.get(cohortId).add(String(student._id));
  });

  const moduleIds = modules.map((module) => module._id);
  const assignments = await Assignment.find({
    module: { $in: moduleIds },
    status: { $in: activeAssignmentStatuses }
  }).select("_id module");
  const assignmentIds = assignments.map((assignment) => assignment._id);
  const assignmentsByModule = new Map();
  const moduleByAssignment = new Map();

  assignments.forEach((assignment) => {
    const moduleId = String(assignment.module || "");
    if (!assignmentsByModule.has(moduleId)) {
      assignmentsByModule.set(moduleId, []);
    }
    assignmentsByModule.get(moduleId).push(assignment);
    moduleByAssignment.set(String(assignment._id), moduleId);
  });

  const submissions = await Submission.find({
    assignment: { $in: assignmentIds },
    student: { $in: studentIds }
  }).select("assignment student status isLate");
  const stats = {};

  modules.forEach((module) => {
    const moduleId = String(module._id);
    const cohortId = String(module.cohort?._id || module.cohort || "");
    const moduleAssignments = assignmentsByModule.get(moduleId) || [];
    const cohortStudentIds = studentIdsByCohort.get(cohortId) || new Set();
    const submittedPairs = new Set();
    let late = 0;

    submissions.forEach((submission) => {
      if (moduleByAssignment.get(String(submission.assignment)) !== moduleId) return;
      if (!cohortStudentIds.has(String(submission.student))) return;

      submittedPairs.add(`${submission.assignment}:${submission.student}`);
      if (submission.status === "lateSubmission" || submission.isLate) late += 1;
    });

    const expected = moduleAssignments.length * cohortStudentIds.size;

    stats[moduleId] = {
      assignments: moduleAssignments.length,
      submitted: submittedPairs.size,
      pending: Math.max(expected - submittedPairs.size, 0),
      late
    };
  });

  return stats;
}

function cleanStudentRow(student, stats) {
  const totalAssignments = stats.totalAssignments || 0;
  const submittedCount = stats.submittedCount || 0;

  return {
    id: student.id,
    name: student.name,
    email: student.email,
    phone: student.phone,
    cohort: student.cohort,
    status: student.status,
    profileImage: student.profileImage,
    progress: totalAssignments ? Math.round((submittedCount / totalAssignments) * 100) : 0,
    submittedCount,
    reviewedCount: stats.reviewedCount || 0,
    totalAssignments,
    lastSubmissionAt: stats.lastSubmissionAt || null
  };
}

function resourceTypeForFile(fileType = "") {
  const normalized = fileType.toLowerCase();

  if (["ppt", "pptx", "key"].includes(normalized)) return "slides";
  if (normalized === "pdf") return "pdf";
  if (["doc", "docx", "txt"].includes(normalized)) return "reading";
  return "template";
}

function sectionBlock(title, body) {
  if (!body) return "";
  return `## ${title}\n${sanitizeRichText(body).trim()}`;
}

function resourceLinksBlock(resourceLinks = []) {
  const links = resourceLinks
    .filter((link) => link.url)
    .map((link) => `- [${sanitizePlainText(link.title || link.url)}](${link.url})`)
    .join("\n");

  return links ? `## Resource links\n${links}` : "";
}

function sanitizeResourceLinks(resourceLinks = []) {
  return resourceLinks.map((link) => ({
    ...link,
    title: sanitizePlainText(link.title || "")
  }));
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function firstName(user) {
  return (user?.name || "there").trim().split(/\s+/)[0] || "there";
}

function hasHtml(value = "") {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function messageHtml(value = "") {
  const cleanMessage = sanitizeRichText(value);
  if (!cleanMessage) return "";
  if (hasHtml(cleanMessage)) return cleanMessage;
  return `<p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">${escapeHtml(cleanMessage).replace(/\n/g, "<br />")}</p>`;
}

function studentPortalNotificationUrl() {
  return `${env.clientStudentUrl.replace(/\/$/, "")}/app/notifications`;
}

function buildMentorMessageEmail({ mentor, student, title, message }) {
  const portalUrl = studentPortalNotificationUrl();
  const mentorName = sanitizePlainText(mentor.name || "Your mentor");

  return `<!doctype html>
<html>
  <body style="margin:0;background:#F7F9FC;padding:24px;font-family:Arial,sans-serif;color:#374151;">
    <div style="max-width:640px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:10px;overflow:hidden;">
      <div style="background:#00337C;padding:20px 24px;color:#FFFFFF;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">Build Your Best Self LMS</div>
        <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3;">Private mentor message</h1>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 14px;font-size:14px;line-height:1.7;">Hi ${escapeHtml(firstName(student))},</p>
        <p style="margin:0 0 18px;font-size:14px;line-height:1.7;">${escapeHtml(mentorName)} sent you a private message in your BYBS mentee portal.</p>
        <div style="border:1px solid #E5E7EB;border-radius:8px;padding:16px;background:#F5F9FF;">
          <h2 style="margin:0 0 12px;color:#10233F;font-size:18px;line-height:1.35;">${escapeHtml(title)}</h2>
          ${message}
        </div>
        <a href="${escapeHtml(portalUrl)}" style="display:inline-block;margin-top:22px;background:#00337C;color:#FFFFFF;text-decoration:none;border-radius:6px;padding:12px 16px;font-size:14px;font-weight:700;">Open your notification</a>
        <p style="margin:20px 0 0;color:#6B7280;font-size:12px;line-height:1.6;">This message was sent through the BYBS LMS so you can keep your learning support in one place.</p>
      </div>
    </div>
  </body>
</html>`;
}

async function sendMentorMessageEmail({ mentor, student, title, message }) {
  if (!emailConfigured()) {
    return { status: "notConfigured" };
  }

  try {
    const mentorName = sanitizePlainText(mentor.name || "Your mentor");

    await sendEmail({
      to: student.email,
      subject: `Message from ${mentorName}: ${title}`,
      html: buildMentorMessageEmail({ mentor, student, title, message })
    });

    return { status: "sent", sentAt: new Date() };
  } catch (error) {
    return {
      status: "failed",
      error: error.message?.slice(0, 300) || "Email delivery failed"
    };
  }
}

function buildAssignmentInstructions({ assignmentBreakdown, assignmentSections = {}, resourceLinks = [] }) {
  return [
    sectionBlock("Assignment overview", assignmentSections.overview || assignmentBreakdown),
    sectionBlock("What to do", assignmentSections.tasks),
    sectionBlock("Expected submission", assignmentSections.deliverables),
    sectionBlock("Grading guide", assignmentSections.grading),
    resourceLinksBlock(resourceLinks),
    sectionBlock("Support notes", assignmentSections.supportNotes)
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function findMentorSession(mentor, sessionId) {
  const cohortIds = await mentorCohortIds(mentor);
  const visibleModuleIds = await mentorVisibleModuleIds(mentor);

  if (!cohortIds.length) {
    throw new ApiError(403, "You are not assigned to a cohort yet");
  }

  const session = await Session.findOne({
    _id: sessionId,
    cohort: { $in: cohortIds },
    $or: [
      { module: { $in: visibleModuleIds } },
      { module: { $exists: false } },
      { module: null }
    ]
  })
    .populate("cohort", "title status")
    .populate("module", "title status assignedMentor startDate endDate");

  if (!session) {
    throw new ApiError(404, "Session not found in your assigned cohort");
  }

  return session;
}

async function sessionAttendanceRoster(mentor, session) {
  const cohortId = session.cohort?._id || session.cohort;
  const students = await User.find({
    ...(await assignedStudentFilter(mentor)),
    cohort: cohortId
  })
    .select("name email phone status profileImage")
    .sort({ name: 1 });
  const attendanceByStudent = new Map(
    (session.attendance || []).map((record) => [idFor(record.student), record])
  );

  return students.map((student) => {
    const record = attendanceByStudent.get(idFor(student._id));

    return {
      student: {
        _id: student._id,
        id: student.id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        status: student.status,
        profileImage: student.profileImage
      },
      status: record?.status || "",
      markedBy: record?.markedBy,
      markedAt: record?.markedAt
    };
  });
}

async function assertAttendanceStudentsInScope(mentor, session, studentIds = []) {
  const uniqueStudentIds = Array.from(new Set(studentIds.map(idFor)));
  const cohortId = session.cohort?._id || session.cohort;
  const students = await User.find({
    ...(await assignedStudentFilter(mentor)),
    cohort: cohortId,
    _id: { $in: uniqueStudentIds }
  }).select("_id");
  const allowedIds = new Set(students.map((student) => idFor(student._id)));
  const denied = uniqueStudentIds.find((studentId) => !allowedIds.has(studentId));

  if (denied) {
    throw new ApiError(403, "Attendance includes a mentee outside this session cohort");
  }
}

async function notifyStudentsAboutAssignment({ assignment, cohortId }) {
  if (assignment.status !== "published") return 0;

  const students = await User.find({
    role: "student",
    status: "active",
    cohort: cohortId
  }).select("_id name email role");

  if (!students.length) return 0;

  await notifyUsers({
    recipients: students,
    portalRole: "student",
    notification: {
      title: `New assignment: ${assignment.title}`,
      message: `A new assignment has been posted. Submit it by ${new Date(assignment.dueDate).toLocaleDateString()}.`,
      channel: "both",
      previewText: assignment.instructions.slice(0, 160),
      ctaLabel: "Open assignment",
      ctaUrl: "/app/assignments",
      targetType: "cohort",
      targetLabel: "Assigned cohort",
      type: "assignment",
      readStatus: false
    }
  });

  return students.length;
}

async function reminderRecipients({ mentor, assignment, target }) {
  const scopedStudents = await User.find({
    ...(await assignedStudentFilter(mentor)),
    cohort: assignment.cohort,
    status: "active"
  }).select("_id name email");

  if (target === "allAssigned") {
    return scopedStudents;
  }

  const scopedStudentIds = scopedStudents.map((student) => student._id);

  if (target === "notSubmitted") {
    const submittedStudentIds = await Submission.distinct("student", {
      assignment: assignment._id,
      student: { $in: scopedStudentIds }
    });
    const submitted = new Set(submittedStudentIds.map((id) => String(id)));
    return scopedStudents.filter((student) => !submitted.has(String(student._id)));
  }

  const submissions = await Submission.find({
    assignment: assignment._id,
    student: { $in: scopedStudentIds },
    status: target
  }).select("student");
  const targetStudentIds = new Set(submissions.map((submission) => String(submission.student)));

  return scopedStudents.filter((student) => targetStudentIds.has(String(student._id)));
}

function reminderDeliveryStats(delivery) {
  return {
    sent: delivery?.sent || 0,
    failed: delivery?.failed || 0,
    notConfigured: delivery?.notConfigured || 0
  };
}

async function populateReminder(reminder) {
  await reminder.populate("assignment", "title dueDate status module");
  await reminder.populate({
    path: "assignment",
    populate: { path: "module", select: "title status" }
  });
  await reminder.populate("cohort", "title status");
  await reminder.populate("recipients", "name email role");
  return reminder;
}

export const mentorDashboard = asyncHandler(async (req, res) => {
  const students = await assignedStudents(req.user);
  const studentIds = students.map((student) => student._id);
  const assignmentIds = await mentorScopedAssignmentIds(req.user, { statuses: null });
  const cohortIds = await mentorCohortIds(req.user);
  const visibleModuleIds = await mentorVisibleModuleIds(req.user);
  const now = new Date();
  const sessionScopeFilter = {
    cohort: { $in: cohortIds },
    $or: [
      { module: { $in: visibleModuleIds } },
      { module: { $exists: false } },
      { module: null }
    ]
  };

  const [
    assignedModules,
    pendingReviews,
    upcomingSessions,
    nextSessions,
    attendanceMarkedSessions,
    attendancePendingSessions,
    atRiskStudentIds,
    pendingSubmissions,
    pendingBookings
  ] = await Promise.all([
    Module.find({
      assignedMentor: req.user._id,
      status: { $ne: "archived" }
    })
      .populate("cohort", "title status")
      .sort({ startDate: 1, order: 1 }),
    Submission.countDocuments({
      student: { $in: studentIds },
      assignment: { $in: assignmentIds },
      status: { $in: reviewableStatuses }
    }),
    Session.countDocuments({
      ...sessionScopeFilter,
      startsAt: { $gte: now },
      status: "scheduled"
    }),
    Session.find({
      ...sessionScopeFilter,
      startsAt: { $gte: now },
      status: "scheduled"
    })
      .populate("cohort", "title status")
      .populate({
        path: "module",
        select: "title status assignedMentor startDate endDate",
        populate: { path: "assignedMentor", select: "name email role profileImage" }
      })
      .sort({ startsAt: 1 })
      .limit(5),
    Session.countDocuments({
      ...sessionScopeFilter,
      startsAt: { $lt: now },
      status: { $ne: "cancelled" },
      "attendance.markedBy": req.user._id
    }),
    Session.countDocuments({
      ...sessionScopeFilter,
      startsAt: { $lt: now },
      status: { $ne: "cancelled" },
      "attendance.markedBy": { $ne: req.user._id }
    }),
    Submission.distinct("student", {
      student: { $in: studentIds },
      assignment: { $in: assignmentIds },
      status: { $in: ["lateSubmission", "needsRevision"] }
    }),
    Submission.find({
      student: { $in: studentIds },
      assignment: { $in: assignmentIds },
      status: { $in: reviewableStatuses }
    })
      .populate("student", "name email")
      .populate("assignment", "title dueDate maxScore")
      .sort({ submittedAt: -1 })
      .limit(6),
    Booking.find({
      mentor: req.user._id,
      status: "pending"
    })
      .populate("student", "name email")
      .sort({ startsAt: 1 })
      .limit(6)
  ]);

  const attention = [
    ...pendingSubmissions.map((submission) => ({
      id: submission.id,
      kind: "submission",
      name: submission.student?.name || "Student",
      reason: submission.assignment?.title || "Submission ready for review",
      status: submission.status,
      date: submission.submittedAt
    })),
    ...pendingBookings.map((booking) => ({
      id: booking.id,
      kind: "booking",
      name: booking.student?.name || "Student",
      reason: booking.reason,
      status: booking.status,
      date: booking.startsAt
    }))
  ].sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0));

  res.json({
    data: {
      summary: {
        assignedStudents: students.length,
        assignedModules: assignedModules.length,
        pendingReviews,
        upcomingSessions,
        attendanceMarkedSessions,
        attendancePendingSessions,
        atRiskStudents: atRiskStudentIds.length
      },
      modules: assignedModules,
      nextSessions: nextSessions.map((session) => ({
        ...session.toObject(),
        attendanceSummary: attendanceSummary(session)
      })),
      attention
    }
  });
});

export const listMentorSessions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const cohortIds = await mentorCohortIds(req.user);
  const visibleModuleIds = await mentorVisibleModuleIds(req.user);

  if (!cohortIds.length) {
    res.json(paginatedResponse({ data: [], total: 0, page, limit }));
    return;
  }

  const filter = {
    cohort: { $in: cohortIds },
    $or: [
      { module: { $in: visibleModuleIds } },
      { module: { $exists: false } },
      { module: null }
    ]
  };
  if (req.query.status) filter.status = req.query.status;

  const [sessions, total] = await Promise.all([
    Session.find(filter)
      .populate("cohort", "title status")
      .populate({
        path: "module",
        select: "title status assignedMentor startDate endDate",
        populate: { path: "assignedMentor", select: "name email role profileImage" }
      })
      .sort({ startsAt: -1 })
      .skip(skip)
      .limit(limit),
    Session.countDocuments(filter)
  ]);

  res.json(paginatedResponse({
    data: sessions.map((session) => ({
      ...session.toObject(),
      attendanceSummary: attendanceSummary(session)
    })),
    total,
    page,
    limit
  }));
});

export const getMentorSessionAttendance = asyncHandler(async (req, res) => {
  const session = await findMentorSession(req.user, req.params.id);
  const roster = await sessionAttendanceRoster(req.user, session);

  res.json({
    data: {
      session: {
        ...session.toObject(),
        attendanceSummary: attendanceSummary(session, roster.length)
      },
      roster
    }
  });
});

export const updateMentorSessionAttendance = asyncHandler(async (req, res) => {
  const session = await findMentorSession(req.user, req.params.id);

  if (session.status === "cancelled") {
    throw new ApiError(409, "Attendance cannot be marked for a cancelled session");
  }

  const recordsByStudent = new Map(
    req.body.records.map((record) => [idFor(record.student), record.status])
  );
  await assertAttendanceStudentsInScope(req.user, session, Array.from(recordsByStudent.keys()));

  const updatedAt = new Date();
  const preservedRecords = (session.attendance || [])
    .filter((record) => !recordsByStudent.has(idFor(record.student)))
    .map((record) => (typeof record.toObject === "function" ? record.toObject() : record));
  const updatedRecords = Array.from(recordsByStudent.entries()).map(([student, status]) => ({
    student,
    status,
    markedBy: req.user._id,
    markedAt: updatedAt
  }));

  session.attendance = [...preservedRecords, ...updatedRecords];
  if (req.body.markCompleted) {
    session.status = "completed";
  }
  await session.save();
  await session.populate("cohort", "title status");
  await session.populate("module", "title status assignedMentor startDate endDate");

  const roster = await sessionAttendanceRoster(req.user, session);

  res.json({
    data: {
      session: {
        ...session.toObject(),
        attendanceSummary: attendanceSummary(session, roster.length)
      },
      roster
    }
  });
});

export const listMentorModules = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = await mentorVisibleModuleFilter(req.user);

  const [modules, total] = await Promise.all([
    Module.find(filter)
      .populate("cohort", "title status")
      .populate("assignedMentor", "name email")
      .sort({ startDate: 1, order: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Module.countDocuments(filter)
  ]);
  const stats = await mentorModuleSubmissionStats(req.user, modules);

  res.json(paginatedResponse({
    data: modules.map((module) => ({
      ...module.toObject(),
      stats: stats[String(module._id)] || { assignments: 0, submitted: 0, pending: 0, late: 0 }
    })),
    total,
    page,
    limit
  }));
});

export const listMentorDiscussions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = attachAndFilters(
    {
      status: req.query.status || { $ne: "archived" }
    },
    [discussionAudienceFilter(mentorDiscussionAudiences), discussionSearchFilter(req.query.search)]
  );

  if (req.query.cohort) {
    filter.cohort = req.query.cohort;
  }

  if (req.query.module) {
    filter.module = req.query.module;
  }

  const [discussions, total] = await Promise.all([
    populateDiscussion(Discussion.find(filter))
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Discussion.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: discussions, total, page, limit }));
});

export const createMentorDiscussion = asyncHandler(async (req, res) => {
  const cohortIds = await mentorCohortIds(req.user);
  let cohort = req.user.cohort || (cohortIds.length === 1 ? cohortIds[0] : undefined);

  if (req.body.cohort) {
    if (!cohortIds.includes(String(req.body.cohort))) {
      throw new ApiError(403, "This cohort is not assigned to you");
    }

    cohort = req.body.cohort;
  }

  if (req.body.module) {
    const module = await Module.findOne({
      _id: req.body.module,
      cohort: { $in: cohortIds },
      status: { $ne: "archived" }
    }).select("cohort status");

    if (!module) {
      throw new ApiError(403, "This module is not available to you");
    }

    if (cohort && String(module.cohort) !== String(cohort)) {
      throw new ApiError(400, "Module does not belong to the selected cohort");
    }

    cohort = module.cohort;
  }

  const discussion = await Discussion.create({
    cohort,
    module: req.body.module,
    title: sanitizePlainText(req.body.title),
    body: sanitizeRichText(req.body.body || ""),
    createdBy: req.user._id,
    audience: req.body.audience || "all",
    status: "open"
  });

  await populateDiscussionDocument(discussion);
  res.status(201).json({ data: discussion });
});

export const updateMentorDiscussion = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findOne({
    _id: req.params.id,
    createdBy: req.user._id,
    status: { $ne: "archived" },
    $and: [discussionAudienceFilter(mentorDiscussionAudiences)]
  });

  if (!discussion) {
    throw new ApiError(404, "Discussion not found");
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "title")) {
    discussion.title = sanitizePlainText(req.body.title);
  }
  if (Object.prototype.hasOwnProperty.call(req.body, "body")) {
    discussion.body = sanitizeRichText(req.body.body || "");
  }
  if (req.body.audience) {
    discussion.audience = req.body.audience;
  }

  await discussion.save();
  await populateDiscussionDocument(discussion);
  res.json({ data: discussion });
});

export const archiveMentorDiscussion = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findOne({
    _id: req.params.id,
    createdBy: req.user._id,
    status: { $ne: "archived" },
    $and: [discussionAudienceFilter(mentorDiscussionAudiences)]
  });

  if (!discussion) {
    throw new ApiError(404, "Discussion not found");
  }

  discussion.status = "archived";
  await discussion.save();
  res.json({ data: { id: req.params.id, archived: true } });
});

export const replyMentorDiscussion = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findOne({
    _id: req.params.id,
    status: "open",
    $and: [discussionAudienceFilter(mentorDiscussionAudiences)]
  });

  if (!discussion) {
    throw new ApiError(404, "Open discussion not found");
  }

  const ownerId = discussion.createdBy;
  const cleanBody = sanitizeRichText(req.body.body);

  discussion.comments.push({
    body: cleanBody,
    createdBy: req.user._id
  });
  await discussion.save();

  if (String(ownerId) !== String(req.user._id)) {
    const owner = await User.findById(ownerId).select("name email role");
    if (owner) {
      const ownerPortalUrl = owner.role === "student" ? "/app/forum" : owner.role === "mentor" ? "/forum" : "/discussions";

      await notifyUser({
        recipient: owner,
        portalRole: owner.role,
        notification: {
          title: `New reply: ${discussion.title}`,
          message: `${req.user.name} replied to your discussion.`,
          channel: "both",
          previewText: sanitizePlainText(cleanBody).slice(0, 160),
          type: "system",
          ctaLabel: "Open forum",
          ctaUrl: ownerPortalUrl,
          targetType: "discussion",
          targetRole: owner.role,
          targetLabel: "Forum discussion",
          readStatus: false
        }
      });
    }
  }

  await populateDiscussionDocument(discussion);
  res.status(201).json({ data: discussion });
});

export const updateMentorDiscussionComment = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findOne({
    _id: req.params.id,
    status: "open",
    $and: [discussionAudienceFilter(mentorDiscussionAudiences)]
  });

  if (!discussion) {
    throw new ApiError(404, "Open discussion not found");
  }

  const comment = discussion.comments.id(req.params.commentId);
  if (!comment || String(comment.createdBy) !== String(req.user._id)) {
    throw new ApiError(404, "Reply not found");
  }

  comment.body = sanitizeRichText(req.body.body);
  await discussion.save();
  await populateDiscussionDocument(discussion);
  res.json({ data: discussion });
});

export const deleteMentorDiscussionComment = asyncHandler(async (req, res) => {
  const discussion = await Discussion.findOne({
    _id: req.params.id,
    status: "open",
    $and: [discussionAudienceFilter(mentorDiscussionAudiences)]
  });

  if (!discussion) {
    throw new ApiError(404, "Open discussion not found");
  }

  const comment = discussion.comments.id(req.params.commentId);
  if (!comment || String(comment.createdBy) !== String(req.user._id)) {
    throw new ApiError(404, "Reply not found");
  }

  discussion.comments.pull({ _id: req.params.commentId });
  await discussion.save();
  await populateDiscussionDocument(discussion);
  res.json({ data: discussion });
});

export const listMentorAssignments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = await mentorAssignmentVisibilityFilter(req.user);

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [assignments, total] = await Promise.all([
    Assignment.find(filter)
      .populate("cohort", "title status")
      .populate("module", "title status startDate endDate")
      .populate("createdBy", "name email")
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(limit),
    Assignment.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: assignments, total, page, limit }));
});

export const createAssignmentReminder = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findOne({
    ...(await mentorAssignmentVisibilityFilter(req.user)),
    _id: req.body.assignment
  }).populate("cohort", "title status");

  if (!assignment) {
    throw new ApiError(404, "Assignment not found in your assigned scope");
  }

  const recipients = await reminderRecipients({
    mentor: req.user,
    assignment,
    target: req.body.target
  });

  if (!recipients.length) {
    throw new ApiError(404, "No students matched this reminder target");
  }

  const title = req.body.title || `Reminder: ${assignment.title}`;
  const message = sanitizeRichText(req.body.message);

  const delivery = await notifyUsers({
    recipients,
    portalRole: "student",
    notification: {
      title: sanitizePlainText(title),
      message,
      channel: "both",
      previewText: sanitizePlainText(message).slice(0, 160),
      ctaLabel: "Open assignment",
      ctaUrl: "/app/assignments",
      targetType: "assignment",
      targetLabel: assignment.title,
      type: "reminder",
      readStatus: false
    }
  });

  const notificationIds = (delivery.notifications || []).map((notification) => notification._id);
  const reminder = await Reminder.create({
    mentor: req.user._id,
    assignment: assignment._id,
    cohort: assignment.cohort?._id || assignment.cohort,
    target: req.body.target,
    title: sanitizePlainText(title),
    message,
    recipients: recipients.map((recipient) => recipient._id),
    recipientCount: recipients.length,
    notificationIds,
    emailDelivery: reminderDeliveryStats(delivery),
    status: "sent"
  });

  if (notificationIds.length) {
    await Notification.updateMany(
      { _id: { $in: notificationIds } },
      { $set: { reminder: reminder._id } }
    );
  }

  await populateReminder(reminder);

  res.status(201).json({
    data: {
      reminder,
      assignment: assignment._id,
      sent: recipients.length,
      target: req.body.target,
      emailDelivery: reminder.emailDelivery
    }
  });
});

export const listAssignmentReminders = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { mentor: req.user._id, status: { $ne: "archived" } };

  const [reminders, total] = await Promise.all([
    Reminder.find(filter)
      .populate({
        path: "assignment",
        select: "title dueDate status module",
        populate: { path: "module", select: "title status" }
      })
      .populate("cohort", "title status")
      .populate("recipients", "name email role")
      .sort({ sentAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Reminder.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: reminders, total, page, limit }));
});

export const updateAssignmentReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    mentor: req.user._id,
    status: { $ne: "archived" }
  });

  if (!reminder) {
    throw new ApiError(404, "Reminder not found");
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "title")) {
    reminder.title = sanitizePlainText(req.body.title);
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "message")) {
    reminder.message = sanitizeRichText(req.body.message);
  }

  reminder.editedAt = new Date();
  await reminder.save();

  await Notification.updateMany(
    { _id: { $in: reminder.notificationIds }, archivedAt: { $exists: false } },
    {
      $set: {
        title: reminder.title,
        message: reminder.message,
        previewText: sanitizePlainText(reminder.message).slice(0, 160)
      }
    }
  );

  await populateReminder(reminder);
  res.json({ data: reminder });
});

export const archiveAssignmentReminder = asyncHandler(async (req, res) => {
  const reminder = await Reminder.findOne({
    _id: req.params.id,
    mentor: req.user._id,
    status: { $ne: "archived" }
  });

  if (!reminder) {
    throw new ApiError(404, "Reminder not found");
  }

  const archivedAt = new Date();
  reminder.status = "archived";
  reminder.archivedAt = archivedAt;
  reminder.archivedBy = req.user._id;
  await reminder.save();

  await Notification.updateMany(
    { _id: { $in: reminder.notificationIds }, archivedAt: { $exists: false } },
    { $set: { archivedAt, archivedBy: req.user._id } }
  );

  res.json({ data: { id: req.params.id, archived: true } });
});

export const createSessionWork = asyncHandler(async (req, res) => {
  const session = await findMentorSession(req.user, req.body.session);
  const cohortId = session.cohort?._id || session.cohort;
  const moduleId = req.body.module || session.module?._id || session.module;
  const resources = [];
  const assignmentInstructions = buildAssignmentInstructions({
    assignmentBreakdown: req.body.assignmentBreakdown,
    assignmentSections: req.body.assignmentSections,
    resourceLinks: req.body.resourceLinks
  });

  if (moduleId) {
    const allowedModule = await Module.findOne({
      ...(await mentorVisibleModuleFilter(req.user)),
      _id: moduleId,
      cohort: cohortId
    }).select("_id");

    if (!allowedModule) {
      throw new ApiError(403, "Selected module is not available for this session");
    }
  }

  const assignment = await Assignment.create({
    title: sanitizePlainText(req.body.assignmentTitle),
    instructions: assignmentInstructions,
    cohort: cohortId,
    module: moduleId,
    dueDate: req.body.dueDate,
    templateFileUrl: req.body.materialFile?.url,
    resourceLinks: sanitizeResourceLinks(req.body.resourceLinks),
    maxScore: req.body.maxScore,
    allowResubmission: req.body.allowResubmission,
    status: req.body.status,
    createdBy: req.user._id
  });

  if (req.body.materialFile?.url) {
    resources.push(
      await Resource.create({
        title: req.body.materialFile.title || `${session.title} materials`,
        description: sanitizeRichText(`Session material for ${session.title}`),
        type: resourceTypeForFile(req.body.materialFile.fileType),
        url: req.body.materialFile.url,
        fileType: req.body.materialFile.fileType,
        cohort: cohortId,
        module: moduleId,
        session: session._id,
        uploadedBy: req.user._id,
        visibility: "published"
      })
    );
  }

  if (req.body.recordingUrl) {
    resources.push(
      await Resource.create({
        title: req.body.recordingTitle || `${session.title} recording`,
        description: sanitizeRichText(`Recording for ${session.title}`),
        type: "recording",
        url: req.body.recordingUrl,
        cohort: cohortId,
        module: moduleId,
        session: session._id,
        uploadedBy: req.user._id,
        visibility: "published"
      })
    );
  }

  const notifiedStudents = await notifyStudentsAboutAssignment({ assignment, cohortId });

  await assignment.populate("cohort", "title status");
  await assignment.populate("module", "title status assignedMentor startDate endDate");
  await assignment.populate("createdBy", "name email");

  await Promise.all(
    resources.map(async (resource) => {
      await resource.populate("cohort", "title status");
      await resource.populate("module", "title status assignedMentor startDate endDate");
      await resource.populate("session", "title startsAt");
    })
  );

  res.status(201).json({
    data: {
      session,
      assignment,
      resources,
      notifiedStudents
    }
  });
});

export const listMentorStudents = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = await assignedStudentFilter(req.user);
  const [students, total] = await Promise.all([
    User.find(filter)
      .select("name email phone status cohort mentor lastLogin createdAt profileImage")
      .populate("cohort", "title status")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  const rows = await Promise.all(
    students.map(async (student) => {
      const assignmentFilter = student.cohort
        ? await mentorScopedAssignmentFilter(req.user, { cohortId: student.cohort._id || student.cohort })
        : { _id: null };
      const scopedAssignments = await Assignment.find(assignmentFilter).select("_id");
      const assignmentIds = scopedAssignments.map((assignment) => assignment._id);
      const [submittedCount, reviewedCount, latestSubmission] = await Promise.all([
        Submission.countDocuments({ student: student._id, assignment: { $in: assignmentIds } }),
        Submission.countDocuments({ student: student._id, assignment: { $in: assignmentIds }, status: { $in: ["reviewed", "approved"] } }),
        Submission.findOne({ student: student._id, assignment: { $in: assignmentIds } }).sort({ submittedAt: -1 }).select("submittedAt")
      ]);

      return cleanStudentRow(student, {
        totalAssignments: scopedAssignments.length,
        submittedCount,
        reviewedCount,
        lastSubmissionAt: latestSubmission?.submittedAt
      });
    })
  );

  res.json(paginatedResponse({ data: rows, total, page, limit }));
});

export const getMentorStudent = asyncHandler(async (req, res) => {
  const student = await findAssignedStudent(
    req.user,
    req.params.id,
    "name email phone status cohort mentor lastLogin createdAt profileImage bio expertise"
  );
  const assignmentFilter = student.cohort
    ? await mentorScopedAssignmentFilter(req.user, { cohortId: student.cohort._id || student.cohort })
    : { _id: null };

  const [assignments, allSubmissions, recentBookings, graduationCertificate] = await Promise.all([
    Assignment.find(assignmentFilter)
      .select("title dueDate maxScore status module createdBy")
      .populate("module", "title status startDate endDate")
      .populate("createdBy", "name email")
      .sort({ dueDate: 1, createdAt: 1 }),
    Submission.find({ student: student._id })
      .populate("assignment", "title dueDate maxScore status module")
      .populate("reviewedBy", "name email")
      .sort({ submittedAt: -1 }),
    Booking.find({ mentor: req.user._id, student: student._id })
      .select("startsAt endsAt reason meetingLink status mentorNotes createdAt")
      .sort({ startsAt: -1 })
      .limit(5),
    Certificate.findOne({ student: student._id })
      .populate("student", "name email status cohort")
      .populate("cohort", "title status")
      .populate("mentorApprovedBy", "name email")
      .populate("issuedBy", "name email role")
      .populate("revokedBy", "name email role")
  ]);
  const assignmentIds = new Set(assignments.map((assignment) => String(assignment._id)));
  const submissions = allSubmissions.filter((submission) =>
    assignmentIds.has(String(submission.assignment?._id || submission.assignment))
  );

  const submissionsByAssignment = new Map(
    submissions
      .filter((submission) => submission.assignment)
      .map((submission) => [String(submission.assignment._id || submission.assignment), submission])
  );
  const assignmentProgress = assignments.map((assignment) => {
    const submission = submissionsByAssignment.get(String(assignment._id));

    return {
      id: assignment.id,
      title: assignment.title,
      dueDate: assignment.dueDate,
      maxScore: assignment.maxScore,
      status: assignment.status,
      module: assignment.module,
      postedBy: assignment.createdBy,
      submissionStatus: submission?.status || "notStarted",
      submittedAt: submission?.submittedAt || null,
      score: submission?.score ?? null,
      reviewedAt: submission?.reviewedAt || null,
      feedback: submission?.feedback || ""
    };
  });
  const submittedCount = assignmentProgress.filter((assignment) => assignment.submissionStatus !== "notStarted").length;
  const reviewedCount = assignmentProgress.filter((assignment) => ["reviewed", "approved"].includes(assignment.submissionStatus)).length;
  const latestSubmission = submissions[0];
  const systemProgress = await graduationProgressForStudent(student);

  res.json({
    data: {
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        phone: student.phone,
        status: student.status,
        cohort: student.cohort,
        profileImage: student.profileImage,
        bio: student.bio,
        expertise: student.expertise,
        lastLogin: student.lastLogin,
        createdAt: student.createdAt
      },
      progress: {
        totalAssignments: assignments.length,
        submittedCount,
        reviewedCount,
        pendingCount: Math.max(assignments.length - submittedCount, 0),
        progress: assignments.length ? Math.round((submittedCount / assignments.length) * 100) : 0,
        lastSubmissionAt: latestSubmission?.submittedAt || null,
        assignmentProgress
      },
      systemProgress,
      recentSubmissions: submissions.slice(0, 5),
      recentBookings,
      graduationCertificate: graduationCertificate ? serializeCertificate(graduationCertificate) : null
    }
  });
});

export const sendMentorStudentMessage = asyncHandler(async (req, res) => {
  const student = await findAssignedStudent(req.user, req.params.id, "name email status cohort");
  const cleanTitle = sanitizePlainText(req.body.title);
  const cleanMessageHtml = messageHtml(req.body.message);
  const mentorName = sanitizePlainText(req.user.name || "Your mentor");
  const previewText = sanitizePlainText(req.body.message).slice(0, 180);
  const deliveryRequested = emailConfigured();

  const notification = await Notification.create({
    recipient: student._id,
    title: cleanTitle,
    message: `<p><strong>From ${escapeHtml(mentorName)}</strong></p>${cleanMessageHtml}`,
    channel: "both",
    previewText,
    ctaLabel: "Open notification",
    ctaUrl: "/app/notifications",
    targetType: "mentorMessage",
    targetRole: "student",
    targetLabel: "Private mentor message",
    emailDeliveryStatus: deliveryRequested ? "pending" : "notConfigured",
    type: "system"
  });

  const emailDelivery = await sendMentorMessageEmail({
    mentor: req.user,
    student,
    title: cleanTitle,
    message: cleanMessageHtml
  });

  notification.emailDeliveryStatus = emailDelivery.status;
  notification.emailDeliveryError = emailDelivery.error;
  notification.emailSentAt = emailDelivery.sentAt;
  await notification.save();

  res.status(201).json({
    data: {
      notification,
      emailDeliveryStatus: notification.emailDeliveryStatus,
      emailDeliveryError: notification.emailDeliveryError
    }
  });
});

export const approveStudentGraduation = asyncHandler(async (req, res) => {
  const student = await findAssignedStudent(req.user, req.params.id, "name email status cohort mentor");
  const existingCertificate = await Certificate.findOne({ student: student._id });

  if (existingCertificate?.status === "issued") {
    throw new ApiError(409, "This mentee already has an issued certificate");
  }

  if (existingCertificate?.status === "revoked") {
    throw new ApiError(409, "This certificate request was revoked by admin");
  }

  const systemProgress = await calculateStudentProgress(student);

  if (!systemProgress.graduationReady) {
    throw new ApiError(
      409,
      `Graduation recommendation cannot be sent yet. System progress is ${systemProgress.progress}% and this mentee is not graduation-ready.`
    );
  }

  const certificate = existingCertificate || new Certificate({
    student: student._id,
    cohort: student.cohort?._id || student.cohort,
    mentorApprovedBy: req.user._id
  });

  certificate.cohort = student.cohort?._id || student.cohort;
  certificate.mentorApprovedBy = req.user._id;
  certificate.mentorApprovedAt = new Date();
  certificate.mentorNotes = sanitizeRichText(req.body.mentorNotes || "");
  certificate.status = "mentorApproved";
  await certificate.save();

  const admins = await User.find({
    role: { $in: ["admin", "adminManager", "superAdmin"] },
    status: { $ne: "removed" }
  }).select("_id name email role");

  if (admins.length) {
    await notifyUsers({
      recipients: admins,
      portalRole: "admin",
      notification: {
        title: `Certificate review: ${student.name}`,
        message: `${req.user.name} recommended ${student.name} for BYBS graduation certificate review.`,
        channel: "both",
        previewText: "A mentor submitted a graduation recommendation.",
        ctaLabel: "Review certificate",
        ctaUrl: "/certificates",
        targetType: "certificate",
        targetRole: "admin",
        targetLabel: student.name,
        type: "system",
        readStatus: false
      }
    });
  }

  await certificate.populate("student", "name email status cohort");
  await certificate.populate("cohort", "title status");
  await certificate.populate("mentorApprovedBy", "name email");

  res.status(existingCertificate ? 200 : 201).json({
    data: serializeCertificate(certificate)
  });
});

export const listMentorSubmissions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [students, assignmentIds] = await Promise.all([
    assignedStudents(req.user),
    mentorScopedAssignmentIds(req.user, { moduleId: req.query.module, statuses: null })
  ]);
  const studentIds = students.map((student) => student._id);
  const filter = submissionFilter(studentIds, assignmentIds, req.query.status);

  const [submissions, total] = await Promise.all([
    Submission.find(filter)
      .populate("student", "name email cohort")
      .populate({
        path: "assignment",
        select: "title instructions dueDate maxScore status module templateFileUrl resourceLinks createdBy",
        populate: [
          { path: "module", select: "title status assignedMentor startDate endDate" },
          { path: "createdBy", select: "name email" }
        ]
      })
      .populate("reviewedBy", "name email")
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit),
    Submission.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: submissions, total, page, limit }));
});

export const reviewSubmission = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id).populate({
    path: "assignment",
    select: "title instructions dueDate maxScore status module templateFileUrl resourceLinks createdBy",
    populate: [
      { path: "module", select: "title status assignedMentor startDate endDate" },
      { path: "createdBy", select: "name email" }
    ]
  });

  if (!submission) {
    throw new ApiError(404, "Submission not found");
  }

  await assertStudentInScope(req.user, submission.student);

  const assignmentIds = await mentorScopedAssignmentIds(req.user, { statuses: null });
  const canReviewAssignment = assignmentIds.some((assignmentId) => String(assignmentId) === String(submission.assignment?._id || submission.assignment));

  if (!canReviewAssignment) {
    throw new ApiError(403, "You can only review submissions from your assigned modules");
  }

  if (req.body.score !== undefined && submission.assignment?.maxScore && req.body.score > submission.assignment.maxScore) {
    throw new ApiError(400, "Score cannot be higher than the assignment maximum score");
  }

  Object.assign(submission, {
    score: req.body.status === "approved" ? req.body.score : undefined,
    feedback: sanitizeRichText(req.body.feedback || ""),
    status: req.body.status,
    reviewedBy: req.user._id,
    reviewedAt: new Date()
  });

  await submission.save();
  await submission.populate("student", "name email cohort");
  await submission.populate({
    path: "assignment",
    select: "title instructions dueDate maxScore status module templateFileUrl resourceLinks createdBy",
    populate: [
      { path: "module", select: "title status assignedMentor startDate endDate" },
      { path: "createdBy", select: "name email" }
    ]
  });
  await submission.populate("reviewedBy", "name email");

  await notifyUser({
    recipient: submission.student,
    portalRole: "student",
    notification: {
      title: `Assignment reviewed: ${submission.assignment?.title || "Submission"}`,
      message: req.body.feedback || `Your submission status is now ${submission.status}.`,
      channel: "both",
      previewText: sanitizePlainText(req.body.feedback || `Submission status: ${submission.status}`).slice(0, 160),
      type: "assignment",
      ctaLabel: "Open assignments",
      ctaUrl: "/app/assignments",
      targetType: "assignment",
      targetRole: "student",
      targetLabel: submission.assignment?.title || "Submission review",
      readStatus: false
    }
  });

  res.json({ data: submission });
});

export const listMentorAvailability = asyncHandler(async (req, res) => {
  const slots = await MentorAvailability.find({ mentor: req.user._id }).sort({ dayOfWeek: 1, startTime: 1 });
  res.json({ data: slots });
});

export const createMentorAvailability = asyncHandler(async (req, res) => {
  if (req.body.startTime >= req.body.endTime) {
    throw new ApiError(400, "End time must be later than start time");
  }

  const slot = await MentorAvailability.create({
    ...req.body,
    mentor: req.user._id
  });

  res.status(201).json({ data: slot });
});

export const updateMentorAvailability = asyncHandler(async (req, res) => {
  const slot = await MentorAvailability.findOne({ _id: req.params.id, mentor: req.user._id });

  if (!slot) {
    throw new ApiError(404, "Availability slot not found");
  }

  Object.assign(slot, req.body);

  if (slot.startTime >= slot.endTime) {
    throw new ApiError(400, "End time must be later than start time");
  }

  await slot.save();
  res.json({ data: slot });
});

export const deleteMentorAvailability = asyncHandler(async (req, res) => {
  const slot = await MentorAvailability.findOne({ _id: req.params.id, mentor: req.user._id });

  if (!slot) {
    throw new ApiError(404, "Availability slot not found");
  }

  await slot.deleteOne();
  res.json({ data: { id: req.params.id, deleted: true } });
});

export const listMentorBookings = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { mentor: req.user._id };

  if (req.query.status) {
    filter.status = req.query.status;
  }

  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .populate("student", "name email cohort")
      .sort({ startsAt: 1 })
      .skip(skip)
      .limit(limit),
    Booking.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: bookings, total, page, limit }));
});

export const updateMentorBooking = asyncHandler(async (req, res) => {
  const booking = await Booking.findOne({ _id: req.params.id, mentor: req.user._id });

  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  const previousStatus = booking.status;
  const previousMeetingLink = booking.meetingLink;
  Object.assign(booking, sanitizeMentorBookingPayload(req.body));
  await booking.save();
  await booking.populate("student", "name email cohort");

  const statusChanged = req.body.status && previousStatus !== booking.status;
  const meetingLinkAdded = req.body.meetingLink && previousMeetingLink !== booking.meetingLink;

  if (statusChanged || meetingLinkAdded || req.body.mentorNotes) {
    await notifyUser({
      recipient: booking.student,
      portalRole: "student",
      notification: {
        title: statusChanged ? `Booking ${booking.status}` : "Booking updated",
        message: req.body.mentorNotes || `Your mentor booking for ${new Date(booking.startsAt).toLocaleString()} was updated.`,
        channel: "both",
        previewText: sanitizePlainText(req.body.mentorNotes || `Booking status: ${booking.status}`).slice(0, 160),
        type: "booking",
        ctaLabel: "Open bookings",
        ctaUrl: "/app/bookings",
        targetType: "booking",
        targetRole: "student",
        targetLabel: "Mentor booking",
        readStatus: false
      }
    });
  }

  res.json({ data: booking });
});

export const listMentorNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [notifications, total] = await Promise.all([
    Notification.find({ recipient: req.user._id, archivedAt: { $exists: false } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Notification.countDocuments({ recipient: req.user._id, archivedAt: { $exists: false } })
  ]);

  res.json(paginatedResponse({ data: notifications, total, page, limit }));
});

export const markMentorNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id, archivedAt: { $exists: false } },
    { readStatus: true },
    { new: true }
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }

  res.json({ data: notification });
});

export const listMentorReports = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [reports, total] = await Promise.all([
    Report.find({ mentor: req.user._id, archivedAt: { $exists: false } })
      .populate("cohort", "title status")
      .populate("studentsDoingWell", "name email")
      .populate("studentsAtRisk", "name email")
      .populate("adminComments.admin", "name email role")
      .populate("lastReviewedBy", "name email role")
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit),
    Report.countDocuments({ mentor: req.user._id, archivedAt: { $exists: false } })
  ]);

  res.json(paginatedResponse({ data: reports, total, page, limit }));
});

export const createMentorReport = asyncHandler(async (req, res) => {
  const cohortIds = await mentorCohortIds(req.user);
  const cohort = req.body.cohort || req.user.cohort || cohortIds[0];

  if (!cohort) {
    throw new ApiError(400, "A cohort is required before submitting a report");
  }

  if (!cohortIds.includes(String(cohort))) {
    throw new ApiError(403, "You can only submit reports for your assigned cohort");
  }

  await assertStudentsInScope(req.user, [...req.body.studentsDoingWell, ...req.body.studentsAtRisk]);

  const activeStudentCount =
    req.body.activeStudentCount ??
    (await User.countDocuments({
      ...(await assignedStudentFilter(req.user)),
      cohort
    }));

  const report = await Report.create({
    ...sanitizeMentorReportPayload(req.body),
    cohort,
    activeStudentCount,
    mentor: req.user._id
  });

  await report.populate("cohort", "title status");
  await report.populate("studentsDoingWell", "name email");
  await report.populate("studentsAtRisk", "name email");
  await report.populate("adminComments.admin", "name email role");
  await report.populate("lastReviewedBy", "name email role");

  res.status(201).json({ data: report });
});

export const updateMentorReport = asyncHandler(async (req, res) => {
  const report = await Report.findOne({ _id: req.params.id, mentor: req.user._id, archivedAt: { $exists: false } });

  if (!report) {
    throw new ApiError(404, "Report not found");
  }

  const cohortIds = await mentorCohortIds(req.user);
  const nextCohort = req.body.cohort || report.cohort;

  if (req.body.cohort && !cohortIds.includes(String(req.body.cohort))) {
    throw new ApiError(403, "You can only update reports for your assigned cohort");
  }

  await assertStudentsInScope(req.user, [
    ...(req.body.studentsDoingWell || []),
    ...(req.body.studentsAtRisk || [])
  ]);

  const payload = sanitizeMentorReportPayload(req.body, { partial: true });

  if (req.body.cohort) {
    payload.cohort = req.body.cohort;
  }

  if (req.body.cohort && !Object.prototype.hasOwnProperty.call(payload, "activeStudentCount")) {
    payload.activeStudentCount = await User.countDocuments({
      ...(await assignedStudentFilter(req.user)),
      cohort: nextCohort
    });
  }

  Object.assign(report, payload, { reviewStatus: "submitted" });
  await report.save();
  await report.populate("cohort", "title status");
  await report.populate("studentsDoingWell", "name email");
  await report.populate("studentsAtRisk", "name email");
  await report.populate("adminComments.admin", "name email role");
  await report.populate("lastReviewedBy", "name email role");

  res.json({ data: report });
});

export const archiveMentorReport = asyncHandler(async (req, res) => {
  const report = await Report.findOne({ _id: req.params.id, mentor: req.user._id, archivedAt: { $exists: false } });

  if (!report) {
    throw new ApiError(404, "Report not found");
  }

  report.archivedAt = new Date();
  report.archivedBy = req.user._id;
  report.archiveReason = "Archived by mentor from the mentor portal";
  await report.save();

  res.json({ data: { id: req.params.id, archived: true } });
});

function sanitizeMentorBookingPayload(payload) {
  const nextPayload = { ...payload };

  if (Object.prototype.hasOwnProperty.call(nextPayload, "mentorNotes")) {
    nextPayload.mentorNotes = sanitizeRichText(nextPayload.mentorNotes || "");
  }

  return nextPayload;
}

function sanitizeMentorReportPayload(payload, { partial = false } = {}) {
  const nextPayload = {};
  const fields = [
    "cohort",
    "period",
    "activeStudentCount",
    "studentsDoingWell",
    "studentsAtRisk"
  ];
  const richTextFields = [
    "assignmentCompletionSummary",
    "attendanceConcerns",
    "observations",
    "recommendations",
    "supportNeeded"
  ];

  fields.forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      nextPayload[field] = payload[field];
    }
  });

  richTextFields.forEach((field) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      nextPayload[field] = sanitizeRichText(payload[field] || "");
    }
  });

  return nextPayload;
}
