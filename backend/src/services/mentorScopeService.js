import { Cohort } from "../models/Cohort.js";
import { Module } from "../models/Module.js";

function uniqueStrings(values = []) {
  return Array.from(new Set(values.filter(Boolean).map((value) => String(value))));
}

export async function mentorCohortIds(mentor) {
  const directCohortId = mentor.cohort ? [mentor.cohort] : [];
  const linkedCohorts = await Cohort.find({ mentors: mentor._id }).select("_id");
  return uniqueStrings([...directCohortId, ...linkedCohorts.map((cohort) => cohort._id)]);
}

export async function mentorVisibleModuleIds(mentor) {
  const cohortIds = await mentorCohortIds(mentor);
  if (!cohortIds.length) return [];

  const modules = await Module.find({
    cohort: { $in: cohortIds },
    status: { $ne: "archived" },
    $or: [
      { assignedMentor: mentor._id },
      { assignedMentor: { $exists: false } },
      { assignedMentor: null }
    ]
  }).select("_id");

  return modules.map((module) => module._id);
}

export async function mentorVisibleModuleFilter(mentor) {
  const cohortIds = await mentorCohortIds(mentor);

  if (!cohortIds.length) {
    return { _id: null };
  }

  return {
    cohort: { $in: cohortIds },
    status: { $ne: "archived" },
    $or: [
      { assignedMentor: mentor._id },
      { assignedMentor: { $exists: false } },
      { assignedMentor: null }
    ]
  };
}

export async function mentorAssignmentVisibilityFilter(mentor) {
  const cohortIds = await mentorCohortIds(mentor);
  const visibleModuleIds = await mentorVisibleModuleIds(mentor);

  if (!cohortIds.length) {
    return { _id: null };
  }

  return {
    cohort: { $in: cohortIds },
    $or: [
      { module: { $in: visibleModuleIds } },
      { module: { $exists: false } },
      { module: null }
    ]
  };
}

export async function mentorCanUseCohort(mentor, cohortId) {
  const cohortIds = await mentorCohortIds(mentor);
  return cohortIds.includes(String(cohortId || ""));
}

export async function mentorCanUseModule(mentor, { cohortId, moduleId }) {
  if (!moduleId) return true;

  const module = await Module.findOne({
    ...(await mentorVisibleModuleFilter(mentor)),
    _id: moduleId,
    cohort: cohortId
  }).select("_id");

  return Boolean(module);
}
