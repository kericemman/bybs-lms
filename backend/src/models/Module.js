import mongoose from "mongoose";

const moduleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: "Cohort", required: true, index: true },
    assignedMentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    startDate: { type: Date },
    endDate: { type: Date },
    order: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true
    }
  },
  { timestamps: true }
);

moduleSchema.index({ cohort: 1, order: 1 });

export const Module = mongoose.model("Module", moduleSchema);
