import mongoose from "mongoose";

const systemLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true, index: true },
    errorMessage: { type: String },
    statusCode: { type: Number },
    route: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed }
  },
  { timestamps: true }
);

export const SystemLog = mongoose.model("SystemLog", systemLogSchema);
