import { Assignment } from "../models/Assignment.js";
import { Booking } from "../models/Booking.js";
import { MentorAvailability } from "../models/MentorAvailability.js";
import { Module } from "../models/Module.js";
import { Notification } from "../models/Notification.js";
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
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { sanitizePlainText, sanitizeRichText } from "../utils/sanitizeRichText.js";

const reviewableStatuses = ["submitted", "lateSubmission", "needsRevision"];
const activeAssignmentStatuses = ["published", "closed"];

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

async function assertStudentInScope(mentor, studentId) {
  const student = await User.findOne({
    ...(await assignedStudentFilter(mentor)),
    _id: studentId
  }).select("_id");

  if (!student) {
    throw new ApiError(403, "This student is not assigned to you");
  }
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

function submissionFilter(studentIds, status) {
  const filter = { student: { $in: studentIds } };
  if (status) filter.status = status;
  return filter;
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

async function notifyStudentsAboutAssignment({ assignment, cohortId }) {
  if (assignment.status !== "published") return 0;

  const students = await User.find({
    role: "student",
    status: "active",
    cohort: cohortId
  }).select("_id name");

  if (!students.length) return 0;

  await Notification.insertMany(
    students.map((student) => ({
      recipient: student._id,
      title: `New assignment: ${assignment.title}`,
      message: `A new assignment has been posted. Submit it by ${new Date(assignment.dueDate).toLocaleDateString()}.`,
      channel: "platform",
      previewText: assignment.instructions.slice(0, 160),
      ctaLabel: "Open assignment",
      ctaUrl: "/assignments",
      targetType: "cohort",
      targetLabel: "Assigned cohort",
      type: "assignment",
      readStatus: false
    }))
  );

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

export const mentorDashboard = asyncHandler(async (req, res) => {
  const students = await assignedStudents(req.user);
  const studentIds = students.map((student) => student._id);
  const now = new Date();

  const [assignedModules, pendingReviews, upcomingSessions, atRiskStudentIds, pendingSubmissions, pendingBookings] = await Promise.all([
    Module.find({
      assignedMentor: req.user._id,
      status: { $ne: "archived" }
    })
      .populate("cohort", "title status")
      .sort({ startDate: 1, order: 1 }),
    Submission.countDocuments({
      student: { $in: studentIds },
      status: { $in: reviewableStatuses }
    }),
    Booking.countDocuments({
      mentor: req.user._id,
      startsAt: { $gte: now },
      status: { $in: ["pending", "approved"] }
    }),
    Submission.distinct("student", {
      student: { $in: studentIds },
      status: { $in: ["lateSubmission", "needsRevision"] }
    }),
    Submission.find({
      student: { $in: studentIds },
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
        atRiskStudents: atRiskStudentIds.length
      },
      modules: assignedModules,
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
      .populate("module", "title status assignedMentor startDate endDate")
      .sort({ startsAt: -1 })
      .skip(skip)
      .limit(limit),
    Session.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: sessions, total, page, limit }));
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

  res.json(paginatedResponse({ data: modules, total, page, limit }));
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

  await Notification.insertMany(
    recipients.map((student) => ({
      recipient: student._id,
      title: sanitizePlainText(title),
      message,
      channel: "platform",
      previewText: message.slice(0, 160),
      ctaLabel: "Open assignment",
      ctaUrl: "/assignments",
      targetType: "assignment",
      targetLabel: assignment.title,
      type: "reminder",
      readStatus: false
    }))
  );

  res.status(201).json({
    data: {
      assignment: assignment._id,
      sent: recipients.length,
      target: req.body.target
    }
  });
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
      .select("name email phone status cohort mentor lastLogin createdAt")
      .populate("cohort", "title status")
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  const rows = await Promise.all(
    students.map(async (student) => {
      const assignmentFilter = student.cohort
        ? { cohort: student.cohort._id || student.cohort, status: { $in: activeAssignmentStatuses } }
        : { _id: null };
      const [totalAssignments, submittedCount, reviewedCount, latestSubmission] = await Promise.all([
        Assignment.countDocuments(assignmentFilter),
        Submission.countDocuments({ student: student._id }),
        Submission.countDocuments({ student: student._id, status: { $in: ["reviewed", "approved"] } }),
        Submission.findOne({ student: student._id }).sort({ submittedAt: -1 }).select("submittedAt")
      ]);

      return cleanStudentRow(student, {
        totalAssignments,
        submittedCount,
        reviewedCount,
        lastSubmissionAt: latestSubmission?.submittedAt
      });
    })
  );

  res.json(paginatedResponse({ data: rows, total, page, limit }));
});

export const listMentorSubmissions = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const students = await assignedStudents(req.user);
  const studentIds = students.map((student) => student._id);
  const filter = submissionFilter(studentIds, req.query.status);

  const [submissions, total] = await Promise.all([
    Submission.find(filter)
      .populate("student", "name email cohort")
      .populate("assignment", "title dueDate maxScore status")
      .populate("reviewedBy", "name email")
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit),
    Submission.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: submissions, total, page, limit }));
});

export const reviewSubmission = asyncHandler(async (req, res) => {
  const submission = await Submission.findById(req.params.id).populate("assignment", "maxScore");

  if (!submission) {
    throw new ApiError(404, "Submission not found");
  }

  await assertStudentInScope(req.user, submission.student);

  if (req.body.score !== undefined && submission.assignment?.maxScore && req.body.score > submission.assignment.maxScore) {
    throw new ApiError(400, "Score cannot be higher than the assignment maximum score");
  }

  Object.assign(submission, {
    score: req.body.score,
    feedback: sanitizeRichText(req.body.feedback || ""),
    status: req.body.status,
    reviewedBy: req.user._id,
    reviewedAt: new Date()
  });

  await submission.save();
  await submission.populate("student", "name email cohort");
  await submission.populate("assignment", "title dueDate maxScore status");
  await submission.populate("reviewedBy", "name email");

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

  Object.assign(booking, sanitizeMentorBookingPayload(req.body));
  await booking.save();
  await booking.populate("student", "name email cohort");

  res.json({ data: booking });
});

export const listMentorReports = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const [reports, total] = await Promise.all([
    Report.find({ mentor: req.user._id })
      .populate("cohort", "title status")
      .populate("studentsDoingWell", "name email")
      .populate("studentsAtRisk", "name email")
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit),
    Report.countDocuments({ mentor: req.user._id })
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

  res.status(201).json({ data: report });
});

function sanitizeMentorBookingPayload(payload) {
  const nextPayload = { ...payload };

  if (Object.prototype.hasOwnProperty.call(nextPayload, "mentorNotes")) {
    nextPayload.mentorNotes = sanitizeRichText(nextPayload.mentorNotes || "");
  }

  return nextPayload;
}

function sanitizeMentorReportPayload(payload) {
  return {
    ...payload,
    assignmentCompletionSummary: sanitizeRichText(payload.assignmentCompletionSummary || ""),
    attendanceConcerns: sanitizeRichText(payload.attendanceConcerns || ""),
    observations: sanitizeRichText(payload.observations || ""),
    recommendations: sanitizeRichText(payload.recommendations || ""),
    supportNeeded: sanitizeRichText(payload.supportNeeded || "")
  };
}
