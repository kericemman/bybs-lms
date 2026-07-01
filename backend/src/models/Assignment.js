import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    instructions: { type: String, required: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: "Cohort", required: true, index: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: "Module", index: true },
    dueDate: { type: Date, required: true, index: true },
    templateFileUrl: { type: String },
    resourceLinks: [
      {
        title: { type: String, trim: true },
        url: { type: String, required: true }
      }
    ],
    maxScore: { type: Number, default: 100 },
    allowResubmission: { type: Boolean, default: true },
    status: {
      type: String,
      enum: ["draft", "published", "closed", "archived"],
      default: "draft",
      index: true
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

export const Assignment = mongoose.model("Assignment", assignmentSchema);
