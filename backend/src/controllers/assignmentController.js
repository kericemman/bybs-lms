import { Assignment } from "../models/Assignment.js";
import { Submission } from "../models/Submission.js";
import { User } from "../models/User.js";
import {
  mentorAssignmentVisibilityFilter,
  mentorCanUseCohort,
  mentorCanUseModule
} from "../services/mentorScopeService.js";
import { notifyUsers } from "../services/portalNotificationService.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { sanitizePlainText, sanitizeRichText } from "../utils/sanitizeRichText.js";

async function assertMentorAssignmentScope(mentor, { cohort, module }) {
  const canUseCohort = await mentorCanUseCohort(mentor, cohort);

  if (!canUseCohort) {
    throw new ApiError(403, "Mentors can only manage assignments for their assigned cohort");
  }

  const canUseModule = await mentorCanUseModule(mentor, { cohortId: cohort, moduleId: module });

  if (!canUseModule) {
    throw new ApiError(403, "Mentors can only manage assignments for modules assigned to them");
  }
}

async function notifyStudentsAboutPublishedAssignment(assignment) {
  if (assignment.status !== "published" || !assignment.cohort) return 0;

  const cohortId = assignment.cohort?._id || assignment.cohort;
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
      previewText: sanitizePlainText(assignment.instructions || "").slice(0, 160),
      ctaLabel: "Open assignment",
      ctaUrl: "/app/assignments",
      targetType: "cohort",
      targetRole: "student",
      targetLabel: "Assigned cohort",
      type: "assignment",
      readStatus: false
    }
  });

  return students.length;
}

export const listAssignments = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  let filter = {};

  if (req.user.role === "mentor") {
    filter = await mentorAssignmentVisibilityFilter(req.user);

    if (req.query.cohort) {
      await assertMentorAssignmentScope(req.user, { cohort: req.query.cohort });
      filter.cohort = req.query.cohort;
    }
  } else if (req.query.cohort) {
    filter.cohort = req.query.cohort;
  }
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    filter.title = { $regex: req.query.search, $options: "i" };
  }

  const [assignments, total] = await Promise.all([
    Assignment.find(filter)
      .populate("cohort", "title status")
      .populate("createdBy", "name email")
      .sort({ dueDate: 1 })
      .skip(skip)
      .limit(limit),
    Assignment.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: assignments, total, page, limit }));
});

export const createAssignment = asyncHandler(async (req, res) => {
  if (req.user.role === "mentor") {
    await assertMentorAssignmentScope(req.user, {
      cohort: req.body.cohort,
      module: req.body.module
    });
  }

  const assignment = await Assignment.create({
    ...sanitizeAssignmentPayload(req.body),
    createdBy: req.user._id
  });

  const populatedAssignment = await Assignment.findById(assignment._id)
    .populate("cohort", "title status")
    .populate("createdBy", "name email");

  await notifyStudentsAboutPublishedAssignment(assignment);

  res.status(201).json({ data: populatedAssignment });
});

export const updateAssignment = asyncHandler(async (req, res) => {
  if (req.user.role === "mentor") {
    const existingAssignment = await Assignment.findOne({
      ...(await mentorAssignmentVisibilityFilter(req.user)),
      _id: req.params.id,
      createdBy: req.user._id
    });

    if (!existingAssignment) {
      throw new ApiError(404, "Assignment not found");
    }

    if (req.body.cohort && String(req.body.cohort) !== String(existingAssignment.cohort)) {
      throw new ApiError(403, "Mentors cannot move assignments to another cohort");
    }

    if (
      Object.prototype.hasOwnProperty.call(req.body, "module") &&
      String(req.body.module || "") !== String(existingAssignment.module || "")
    ) {
      throw new ApiError(403, "Mentors cannot move assignments between modules");
    }

    await assertMentorAssignmentScope(req.user, {
      cohort: existingAssignment.cohort,
      module: existingAssignment.module
    });
  }

  const previousAssignment = await Assignment.findById(req.params.id).select("status cohort title");
  const assignment = await Assignment.findByIdAndUpdate(req.params.id, sanitizeAssignmentPayload(req.body), {
    new: true,
    runValidators: true
  })
    .populate("cohort", "title status")
    .populate("createdBy", "name email");

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  if (previousAssignment?.status !== "published" && assignment.status === "published") {
    await notifyStudentsAboutPublishedAssignment(assignment);
  }

  res.json({ data: assignment });
});

function sanitizeAssignmentPayload(payload) {
  const nextPayload = { ...payload };

  if (Object.prototype.hasOwnProperty.call(nextPayload, "title")) {
    nextPayload.title = sanitizePlainText(nextPayload.title);
  }

  if (Object.prototype.hasOwnProperty.call(nextPayload, "instructions")) {
    nextPayload.instructions = sanitizeRichText(nextPayload.instructions);
  }

  if (Array.isArray(nextPayload.resourceLinks)) {
    nextPayload.resourceLinks = nextPayload.resourceLinks.map((link) => ({
      ...link,
      title: sanitizePlainText(link.title || "")
    }));
  }

  return nextPayload;
}

export const deleteAssignment = asyncHandler(async (req, res) => {
  const filter = req.user.role === "mentor"
    ? { ...(await mentorAssignmentVisibilityFilter(req.user)), _id: req.params.id, createdBy: req.user._id }
    : { _id: req.params.id };
  const assignment = await Assignment.findOne(filter);

  if (!assignment) {
    throw new ApiError(404, "Assignment not found");
  }

  const submissionCount = await Submission.countDocuments({ assignment: assignment._id });

  if (submissionCount > 0) {
    throw new ApiError(409, "This assignment has submissions. Archive it instead of deleting it.");
  }

  await assignment.deleteOne();

  res.json({ data: { id: req.params.id, deleted: true } });
});
