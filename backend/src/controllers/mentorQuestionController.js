import { Assignment } from "../models/Assignment.js";
import { Cohort } from "../models/Cohort.js";
import { MentorQuestion } from "../models/MentorQuestion.js";
import { Module } from "../models/Module.js";
import { User } from "../models/User.js";
import { notifyUser } from "../services/portalNotificationService.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { notificationLinks } from "../utils/notificationLinks.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { sanitizePlainText, sanitizeRichText } from "../utils/sanitizeRichText.js";

function idString(value) {
  return String(value?._id || value || "");
}

function searchRegex(value = "") {
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "i");
}

function cleanMessage(value) {
  const body = sanitizeRichText(value || "");
  if (sanitizePlainText(body).length < 2) {
    throw new ApiError(400, "Write a question or reply before sending");
  }
  return body;
}

function populateQuestion(query, { includeMessages = true } = {}) {
  const populatedQuery = query
    .populate("student", "name email role profileImage bio")
    .populate("mentor", "name email role profileImage bio")
    .populate("cohort", "title status")
    .populate("module", "title status startDate endDate")
    .populate("assignment", "title status dueDate module")
    .populate("resolvedBy", "name email role");

  return includeMessages
    ? populatedQuery.populate("messages.sender", "name email role profileImage bio")
    : populatedQuery;
}

async function populateQuestionDocument(question) {
  await question.populate("student", "name email role profileImage bio");
  await question.populate("mentor", "name email role profileImage bio");
  await question.populate("cohort", "title status");
  await question.populate("module", "title status startDate endDate");
  await question.populate("assignment", "title status dueDate module");
  await question.populate("messages.sender", "name email role profileImage bio");
  await question.populate("resolvedBy", "name email role");
  return question;
}

function listFilter(query, participantFilter = {}) {
  const filter = { ...participantFilter };
  if (query.question) filter._id = query.question;
  if (query.status) filter.status = query.status;
  if (query.search) filter.subject = searchRegex(query.search);
  return filter;
}

async function listQuestions(req, res, participantFilter) {
  const { page, limit, skip } = getPagination(req.query);
  const filter = listFilter(req.query, participantFilter);
  const includeMessages = Boolean(req.query.question);
  const questionQuery = MentorQuestion.find(filter);
  if (!includeMessages) questionQuery.select("-messages");
  const [questions, total] = await Promise.all([
    populateQuestion(questionQuery, { includeMessages })
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    MentorQuestion.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: questions, total, page, limit }));
}

async function resolveQuestionContext(student, payload) {
  if (!student.cohort) {
    throw new ApiError(403, "You must belong to a cohort before asking a mentor question");
  }

  const cohort = await Cohort.findById(student.cohort).select("title status mentors");
  if (!cohort || !["active", "completed"].includes(cohort.status)) {
    throw new ApiError(403, "Your cohort is not available for mentor questions");
  }

  let assignment = null;
  let module = null;

  if (payload.assignment) {
    assignment = await Assignment.findOne({
      _id: payload.assignment,
      cohort: cohort._id,
      status: { $in: ["published", "closed"] }
    }).select("title module cohort status dueDate");

    if (!assignment) {
      throw new ApiError(404, "Assignment not found in your cohort");
    }
  }

  const moduleId = payload.module || assignment?.module;
  if (payload.module && assignment?.module && idString(payload.module) !== idString(assignment.module)) {
    throw new ApiError(400, "The selected assignment does not belong to that module");
  }

  if (moduleId) {
    module = await Module.findOne({
      _id: moduleId,
      cohort: cohort._id,
      status: "published"
    }).select("title assignedMentor cohort status");

    if (!module) {
      throw new ApiError(404, "Module not found in your cohort");
    }
  }

  const candidateIds = [module?.assignedMentor, student.mentor, ...(cohort.mentors || [])]
    .map(idString)
    .filter(Boolean);
  const mentors = candidateIds.length
    ? await User.find({ _id: { $in: candidateIds }, role: "mentor", status: "active" }).select("name email role status")
    : [];
  const mentorsById = new Map(mentors.map((mentor) => [idString(mentor), mentor]));
  const mentor = candidateIds.map((id) => mentorsById.get(id)).find(Boolean);

  if (!mentor) {
    throw new ApiError(409, "No active mentor is assigned to this learning context yet");
  }

  return { assignment, cohort, mentor, module };
}

async function notifyQuestionParticipant({ question, recipient, recipientRole, title, message, channel = "both" }) {
  await notifyUser({
    recipient,
    portalRole: recipientRole,
    notification: {
      title,
      message,
      previewText: sanitizePlainText(message).slice(0, 180),
      channel,
      type: "question",
      ctaLabel: "Open question",
      ctaUrl: recipientRole === "mentor"
        ? notificationLinks.mentorQuestion(question._id)
        : notificationLinks.studentQuestion(question._id),
      targetType: "mentorQuestion",
      targetRole: recipientRole,
      targetLabel: question.subject,
      readStatus: false
    }
  });
}

async function findParticipantQuestion(user, questionId) {
  const participantKey = user.role === "mentor" ? "mentor" : "student";
  const question = await MentorQuestion.findOne({ _id: questionId, [participantKey]: user._id });
  if (!question) throw new ApiError(404, "Mentor question not found");
  return question;
}

export const listStudentMentorQuestions = asyncHandler(async (req, res) => {
  await listQuestions(req, res, { student: req.user._id });
});

export const listMentorQuestions = asyncHandler(async (req, res) => {
  await listQuestions(req, res, { mentor: req.user._id });
});

export const listAdminMentorQuestions = asyncHandler(async (req, res) => {
  const participantFilter = {};
  for (const key of ["cohort", "student", "mentor", "module", "assignment"]) {
    if (req.query[key]) participantFilter[key] = req.query[key];
  }
  await listQuestions(req, res, participantFilter);
});

export const createStudentMentorQuestion = asyncHandler(async (req, res) => {
  const { assignment, cohort, mentor, module } = await resolveQuestionContext(req.user, req.body);
  const subject = sanitizePlainText(req.body.subject);
  if (subject.length < 3) {
    throw new ApiError(400, "Add a clear subject for your mentor question");
  }
  const body = cleanMessage(req.body.message);
  const now = new Date();

  const question = await MentorQuestion.create({
    student: req.user._id,
    mentor: mentor._id,
    cohort: cohort._id,
    module: module?._id,
    assignment: assignment?._id,
    subject,
    messageCount: 1,
    lastMessagePreview: sanitizePlainText(body).slice(0, 240),
    status: "open",
    lastMessageAt: now,
    messages: [{ sender: req.user._id, senderRole: "student", body, createdAt: now, updatedAt: now }]
  });

  await notifyQuestionParticipant({
    question,
    recipient: mentor,
    recipientRole: "mentor",
    title: `New mentee question: ${subject}`,
    message: `${req.user.name} asked a question about ${assignment?.title || module?.title || "their learning"}. ${sanitizePlainText(body).slice(0, 220)}`
  });

  await populateQuestionDocument(question);
  res.status(201).json({ data: question });
});

export const replyMentorQuestion = asyncHandler(async (req, res) => {
  const question = await findParticipantQuestion(req.user, req.params.id);
  if (question.status === "resolved") {
    throw new ApiError(409, "Reopen this question before adding another reply");
  }

  const body = cleanMessage(req.body.message);
  const now = new Date();
  question.messages.push({
    sender: req.user._id,
    senderRole: req.user.role,
    body,
    createdAt: now,
    updatedAt: now
  });
  question.status = req.user.role === "mentor" ? "answered" : "open";
  question.lastMessageAt = now;
  question.messageCount = Math.max(Number(question.messageCount || 0), question.messages.length);
  question.lastMessagePreview = sanitizePlainText(body).slice(0, 240);
  await question.save();

  const recipientId = req.user.role === "mentor" ? question.student : question.mentor;
  const recipientRole = req.user.role === "mentor" ? "student" : "mentor";
  const recipient = await User.findOne({ _id: recipientId, role: recipientRole, status: { $ne: "removed" } })
    .select("name email role status");

  if (recipient) {
    await notifyQuestionParticipant({
      question,
      recipient,
      recipientRole,
      title: req.user.role === "mentor" ? `Mentor replied: ${question.subject}` : `Mentee follow-up: ${question.subject}`,
      message: `${req.user.name} replied: ${sanitizePlainText(body).slice(0, 240)}`
    });
  }

  await populateQuestionDocument(question);
  res.status(201).json({ data: question });
});

export const updateMentorQuestionStatus = asyncHandler(async (req, res) => {
  const question = await findParticipantQuestion(req.user, req.params.id);
  const nextStatus = req.body.status;
  const changed = question.status !== nextStatus;

  question.status = nextStatus;
  question.resolvedAt = nextStatus === "resolved" ? new Date() : undefined;
  question.resolvedBy = nextStatus === "resolved" ? req.user._id : undefined;
  await question.save();

  if (changed) {
    const recipientId = req.user.role === "mentor" ? question.student : question.mentor;
    const recipientRole = req.user.role === "mentor" ? "student" : "mentor";
    const recipient = await User.findOne({ _id: recipientId, role: recipientRole, status: { $ne: "removed" } })
      .select("name email role status");

    if (recipient) {
      await notifyQuestionParticipant({
        question,
        recipient,
        recipientRole,
        title: `${nextStatus === "resolved" ? "Question resolved" : "Question reopened"}: ${question.subject}`,
        message: `${req.user.name} marked this mentor question as ${nextStatus}.`,
        channel: "platform"
      });
    }
  }

  await populateQuestionDocument(question);
  res.json({ data: question });
});
