import mongoose from "mongoose";

const resourceSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String },
    type: {
      type: String,
      enum: ["slides", "pdf", "template", "zoom", "recording", "reading", "external", "video", "reflection"],
      required: true,
      index: true
    },
    url: { type: String, required: true },
    fileType: { type: String },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: "Cohort", required: true, index: true },
    module: { type: mongoose.Schema.Types.ObjectId, ref: "Module", index: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: "Session", index: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    visibility: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
      index: true
    }
  },
  { timestamps: true }
);

export const Resource = mongoose.model("Resource", resourceSchema);
