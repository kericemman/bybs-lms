import path from "node:path";
import { env } from "../config/env.js";
import { uploadToCloudinary } from "../services/cloudinaryUploadService.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const uploadResourceFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "Resource file is required");
  }

  const cloudinaryUpload = await uploadToCloudinary(req.file);
  const publicPath = `/uploads/${req.file.filename}`;
  const publicBaseUrl = env.publicApiUrl || `${req.protocol}://${req.get("host")}`;
  const localUrl = `${publicBaseUrl.replace(/\/$/, "")}${publicPath}`;

  res.status(201).json({
    data: {
      originalName: req.file.originalname,
      fileName: req.file.filename,
      fileType: path.extname(req.file.originalname || "").replace(".", "").toLowerCase(),
      mimeType: req.file.mimetype,
      detectedMimeType: req.file.detectedMimeType || "",
      size: req.file.size,
      compressed: Boolean(req.file.compressed),
      compressedSize: req.file.compressedSize || req.file.size,
      optimized: Boolean(req.file.optimized),
      originalSize: req.file.originalSize || req.file.size,
      storage: cloudinaryUpload?.storage || "local",
      url: cloudinaryUpload?.url || localUrl,
      path: cloudinaryUpload?.publicId || publicPath,
      cloudinary: cloudinaryUpload
    }
  });
});
