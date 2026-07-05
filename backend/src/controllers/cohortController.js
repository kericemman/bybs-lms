import { Assignment } from "../models/Assignment.js";
import { Cohort } from "../models/Cohort.js";
import { Discussion } from "../models/Discussion.js";
import { Module } from "../models/Module.js";
import { Resource } from "../models/Resource.js";
import { Session } from "../models/Session.js";
import { User } from "../models/User.js";
import { calculateCohortRanking } from "../services/progressService.js";
import { ApiError } from "../utils/apiError.js";
import { getPagination, paginatedResponse } from "../utils/pagination.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listCohorts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.search) {
    filter.title = { $regex: req.query.search, $options: "i" };
  }

  const [cohorts, total] = await Promise.all([
    Cohort.find(filter)
      .populate("mentors", "name email")
      .populate("students", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Cohort.countDocuments(filter)
  ]);

  res.json(paginatedResponse({ data: cohorts, total, page, limit }));
});

export const createCohort = asyncHandler(async (req, res) => {
  const cohort = await Cohort.create(req.body);
  res.status(201).json({ data: cohort });
});

export const updateCohort = asyncHandler(async (req, res) => {
  const cohort = await Cohort.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  if (!cohort) {
    throw new ApiError(404, "Cohort not found");
  }

  res.json({ data: cohort });
});

export const cohortRanking = asyncHandler(async (req, res) => {
  const ranking = await calculateCohortRanking(req.params.id);
  res.json({ data: ranking });
});

export const deleteCohort = asyncHandler(async (req, res) => {
  const cohort = await Cohort.findById(req.params.id);

  if (!cohort) {
    throw new ApiError(404, "Cohort not found");
  }

  const [userCount, moduleCount, sessionCount, resourceCount, discussionCount, assignmentCount] = await Promise.all([
    User.countDocuments({ cohort: cohort._id, status: { $ne: "removed" } }),
    Module.countDocuments({ cohort: cohort._id }),
    Session.countDocuments({ cohort: cohort._id }),
    Resource.countDocuments({ cohort: cohort._id }),
    Discussion.countDocuments({ cohort: cohort._id }),
    Assignment.countDocuments({ cohort: cohort._id })
  ]);

  const linkedRecords =
    userCount + moduleCount + sessionCount + resourceCount + discussionCount + assignmentCount;

  if (linkedRecords > 0) {
    throw new ApiError(409, "This cohort has linked records. Archive it instead of deleting it.");
  }

  await cohort.deleteOne();

  res.json({ data: { id: req.params.id, deleted: true } });
});
