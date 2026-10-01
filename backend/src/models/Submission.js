import mongoose from "mongoose";

const submissionAttemptSchema = new mongoose.Schema(
  {
    attemptNumber: { type: Number, min: 1 },
    fileUrl: { type: String },
    linkUrl: { type: String },
    writtenResponse: { type: String },
    submittedAt: { type: Date },
    isLate: { type: Boolean, default: false },
    status: { type: String },
    score: { type: Number },
    feedback: { type: String },
    feedbackFileUrl: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date }
  },
  { timestamps: true }
);

const reviewDraftSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["reviewed", "needsRevision", "approved"],
      default: "reviewed"
    },
    score: { type: Number, min: 0 },
    feedback: { type: String },
    feedbackFileUrl: { type: String },
    savedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    savedAt: { type: Date }
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    fileUrl: { type: String },
    linkUrl: { type: String },
    writtenResponse: { type: String },
    attemptNumber: { type: Number, min: 1, default: 1 },
    submittedAt: { type: Date, default: Date.now },
    resubmittedAt: { type: Date },
    isLate: { type: Boolean, default: false, index: true },
    score: { type: Number },
    feedback: { type: String },
    feedbackFileUrl: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    reviewDraft: { type: reviewDraftSchema, select: false },
    history: { type: [submissionAttemptSchema], default: [] },
    status: {
      type: String,
      enum: ["notStarted", "submitted", "resubmitted", "lateSubmission", "reviewed", "needsRevision", "approved"],
      default: "submitted",
      index: true
    }
  },
  { timestamps: true }
);

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });
submissionSchema.index({ status: 1, submittedAt: 1 });
submissionSchema.index({ student: 1, status: 1 });
submissionSchema.index({ "reviewDraft.savedAt": 1, submittedAt: 1 });

export const Submission = mongoose.model("Submission", submissionSchema);
