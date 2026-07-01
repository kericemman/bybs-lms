import { BetaFeedback } from "../models/BetaFeedback.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { sanitizePlainText } from "../utils/sanitizeRichText.js";

function searchRegex(search) {
  return { $regex: search, $options: "i" };
}

function cleanFeedback(feedback) {
  return {
    id: feedback.id,
    _id: feedback._id,
    submittedBy: feedback.submittedBy,
    role: feedback.role,
    userName: feedback.userName,
    userEmail: feedback.userEmail,
    category: feedback.category,
    rating: feedback.rating,
    subject: feedback.subject,
    message: feedback.message,
    status: feedback.status,
    adminNotes: feedback.adminNotes,
    reviewedBy: feedback.reviewedBy,
    reviewedAt: feedback.reviewedAt,
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt
  };
}

function sanitizeFeedbackPayload(payload) {
  return {
    category: payload.category,
    rating: payload.rating,
    subject: sanitizePlainText(payload.subject),
    message: sanitizePlainText(payload.message)
  };
}

export const createBetaFeedback = asyncHandler(async (req, res) => {
  const payload = sanitizeFeedbackPayload(req.body);
  const feedback = await BetaFeedback.create({
    ...payload,
    submittedBy: req.user._id,
    role: req.user.role,
    userName: req.user.name,
    userEmail: req.user.email
  });

  await feedback.populate("submittedBy", "name email role");
  res.status(201).json({ data: cleanFeedback(feedback) });
});

export const listMyBetaFeedback = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = { submittedBy: req.user._id };

  if (req.query.category) filter.category = req.query.category;
  if (req.query.status) filter.status = req.query.status;

  const [feedback, total] = await Promise.all([
    BetaFeedback.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    BetaFeedback.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: feedback.map(cleanFeedback), total, page, limit }));
});

export const listBetaFeedback = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  if (req.query.role) filter.role = req.query.role;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    filter.$or = [
      { userName: searchRegex(req.query.search) },
      { userEmail: searchRegex(req.query.search) },
      { subject: searchRegex(req.query.search) },
      { message: searchRegex(req.query.search) }
    ];
  }

  const [feedback, total] = await Promise.all([
    BetaFeedback.find(filter)
      .populate("submittedBy", "name email role")
      .populate("reviewedBy", "name email role")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    BetaFeedback.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: feedback.map(cleanFeedback), total, page, limit }));
});

export const updateBetaFeedback = asyncHandler(async (req, res) => {
  const feedback = await BetaFeedback.findById(req.params.id);

  if (!feedback) {
    throw new ApiError(404, "Beta feedback not found");
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
    feedback.status = req.body.status;
    feedback.reviewedBy = req.user._id;
    feedback.reviewedAt = new Date();
  }

  if (Object.prototype.hasOwnProperty.call(req.body, "adminNotes")) {
    feedback.adminNotes = sanitizePlainText(req.body.adminNotes || "");
  }

  await feedback.save();
  await feedback.populate("submittedBy", "name email role");
  await feedback.populate("reviewedBy", "name email role");

  res.json({ data: cleanFeedback(feedback) });
});
