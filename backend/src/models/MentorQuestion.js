import mongoose from "mongoose";

const mentorQuestionMessageSchema = new mongoose.Schema(
  {
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["student", "mentor"], required: true },
    body: { type: String, required: true }
  },
  { timestamps: true }
);

const mentorQuestionSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: "Cohort", required: true, index: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: "Module", index: true },
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: "Assignment", index: true },
    subject: { type: String, required: true, trim: true },
    messages: { type: [mentorQuestionMessageSchema], default: [] },
    messageCount: { type: Number, default: 0, min: 0 },
    lastMessagePreview: { type: String },
    status: {
      type: String,
      enum: ["open", "answered", "resolved"],
      default: "open",
      index: true
    },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

mentorQuestionSchema.pre("validate", function requireLearningContext(next) {
  if (!this.module && !this.assignment) {
    this.invalidate("module", "A module or assignment context is required");
  }
  next();
});

mentorQuestionSchema.index({ student: 1, lastMessageAt: -1 });
mentorQuestionSchema.index({ mentor: 1, status: 1, lastMessageAt: -1 });
mentorQuestionSchema.index({ cohort: 1, status: 1, lastMessageAt: -1 });

export const MentorQuestion = mongoose.model("MentorQuestion", mentorQuestionSchema);
