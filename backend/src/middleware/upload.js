import crypto from "node:crypto";
import path from "node:path";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import { fileTypeFromBuffer } from "file-type";
import multer from "multer";
import sanitizeFilename from "sanitize-filename";
import sharp from "sharp";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

const gunzipAsync = promisify(gunzip);
const COMPRESSION_FIELD = "__bybsUploadCompression";
const MANIFEST_FIELD = "__bybsUploadManifest";
const COMPRESSION_VERSION = "gzip-v1";

const allowedResourceTypes = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4"
]);

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const csvTypes = new Set(["text/csv", "application/csv", "application/vnd.ms-excel", "text/plain"]);
const compressedTypes = new Set(["application/gzip", "application/x-gzip", "application/octet-stream"]);
const optimizableImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const zipContainerTypes = new Set(["application/zip", "application/x-zip-compressed"]);
const officeZipExtensions = new Set([".docx", ".pptx", ".xlsx"]);
const allowedResourceExtensions = new Set([
  ".csv",
  ".doc",
  ".docx",
  ".jpeg",
  ".jpg",
  ".mp4",
  ".pdf",
  ".png",
  ".ppt",
  ".pptx",
  ".txt",
  ".webp",
  ".xls",
  ".xlsx"
]);
const allowedCsvExtensions = new Set([".csv"]);
const allowedImageExtensions = new Set([".jpeg", ".jpg", ".png", ".webp"]);

function safeExtension(file) {
  const ext = path.extname(safeOriginalName(file.originalname)).toLowerCase();
  return ext.replace(/[^a-z0-9.]/g, "") || ".bin";
}

function safeOriginalName(originalName = "") {
  return sanitizeFilename(path.basename(originalName)) || "upload.bin";
}

function parseCompressionManifest(req) {
  if (req.body?.[COMPRESSION_FIELD] !== COMPRESSION_VERSION) {
    return [];
  }

  try {
    const parsed = JSON.parse(req.body[MANIFEST_FIELD] || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new ApiError(400, "Invalid compressed upload metadata");
  }
}

function compressedFileMetadata(req, fieldName) {
  return parseCompressionManifest(req).find((item) => item?.fieldName === fieldName);
}

function isCompressedUpload(req, file) {
  return Boolean(compressedFileMetadata(req, file.fieldname));
}

function uploadExtension(req, file) {
  const metadata = compressedFileMetadata(req, file.fieldname);
  return safeExtension({ originalname: metadata?.originalName || file.originalname });
}

function validateCompressedEnvelope(file) {
  return compressedTypes.has(file.mimetype) || file.originalname?.toLowerCase().endsWith(".gz");
}

function validateResourceUpload(req, file) {
  const metadata = compressedFileMetadata(req, file.fieldname);
  const mimeType = metadata?.originalType || file.mimetype;
  const extension = uploadExtension(req, file);

  if (env.requireCompressedUploads && !metadata) {
    return false;
  }

  if (metadata && !validateCompressedEnvelope(file)) {
    return false;
  }

  return allowedResourceTypes.has(mimeType) && allowedResourceExtensions.has(extension);
}

function validateCsvUpload(req, file) {
  const metadata = compressedFileMetadata(req, file.fieldname);
  const mimeType = metadata?.originalType || file.mimetype;
  const extension = uploadExtension(req, file);

  if (env.requireCompressedUploads && !metadata) {
    return false;
  }

  if (metadata && !validateCompressedEnvelope(file)) {
    return false;
  }

  return csvTypes.has(mimeType) && allowedCsvExtensions.has(extension);
}

function validateImageUpload(req, file) {
  const metadata = compressedFileMetadata(req, file.fieldname);
  const mimeType = metadata?.originalType || file.mimetype;
  const extension = uploadExtension(req, file);

  if (env.requireCompressedUploads && !metadata) {
    return false;
  }

  if (metadata && !validateCompressedEnvelope(file)) {
    return false;
  }

  return allowedImageTypes.has(mimeType) && allowedImageExtensions.has(extension);
}

function compressedMetadataRequired(req, file) {
  return env.requireCompressedUploads && !compressedFileMetadata(req, file.fieldname);
}

async function fileBuffer(file) {
  if (file.buffer) return file.buffer;
  return readFile(file.path);
}

async function detectFileType(file) {
  const buffer = await fileBuffer(file);
  return fileTypeFromBuffer(buffer);
}

function ensureDetectedResourceType({ file, detected }) {
  const detectedMimeType = detected?.mime;
  const mimeType = detectedMimeType || file.mimetype;
  const extension = safeExtension(file);

  if (
    detectedMimeType &&
    zipContainerTypes.has(detectedMimeType) &&
    officeZipExtensions.has(extension) &&
    allowedResourceTypes.has(file.mimetype)
  ) {
    return file.mimetype;
  }

  if (detectedMimeType && !allowedResourceTypes.has(detectedMimeType)) {
    throw new ApiError(400, "Unsupported resource file content");
  }

  if (!allowedResourceTypes.has(mimeType) || !allowedResourceExtensions.has(extension)) {
    throw new ApiError(400, "Unsupported resource file type");
  }

  return mimeType;
}

function ensureDetectedCsvType({ detected }) {
  if (detected?.mime) {
    throw new ApiError(400, "CSV import must be a plain text CSV file");
  }
}

function ensureDetectedImageType({ file, detected }) {
  const detectedMimeType = detected?.mime;
  const mimeType = detectedMimeType || file.mimetype;
  const extension = safeExtension(file);

  if (detectedMimeType && !allowedImageTypes.has(detectedMimeType)) {
    throw new ApiError(400, "Unsupported profile image content");
  }

  if (!allowedImageTypes.has(mimeType) || !allowedImageExtensions.has(extension)) {
    throw new ApiError(400, "Please upload a JPG, PNG, or WebP image");
  }

  return mimeType;
}

async function optimizeStoredImage(file, mimeType) {
  if (!file.path || !optimizableImageTypes.has(mimeType)) return;

  const input = await readFile(file.path);
  let pipeline = sharp(input, { failOn: "none" }).rotate();

  if (mimeType === "image/jpeg") {
    pipeline = pipeline.jpeg({ quality: 82, mozjpeg: true });
  } else if (mimeType === "image/png") {
    pipeline = pipeline.png({ compressionLevel: 9, adaptiveFiltering: true });
  } else if (mimeType === "image/webp") {
    pipeline = pipeline.webp({ quality: 82 });
  }

  const optimized = await pipeline.toBuffer();

  if (optimized.length && optimized.length < input.length) {
    await writeFile(file.path, optimized);
    file.optimized = true;
    file.originalSize = file.size;
    file.size = optimized.length;
  }
}

const resourceStorage = multer.diskStorage({
  async destination(_req, _file, callback) {
    await mkdir(env.uploadDir, { recursive: true });
    callback(null, env.uploadDir);
  },
  filename(req, file, callback) {
    const name = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${uploadExtension(req, file)}`;
    callback(null, name);
  }
});

export const resourceUpload = multer({
  storage: resourceStorage,
  limits: {
    fileSize: 50 * 1024 * 1024
  },
  fileFilter(req, file, callback) {
    try {
      if (compressedMetadataRequired(req, file)) {
        callback(new ApiError(400, "Uploads must be compressed by the BYBS uploader"));
        return;
      }

      if (!validateResourceUpload(req, file)) {
        callback(new ApiError(400, "Unsupported resource file type"));
        return;
      }
    } catch (error) {
      callback(error);
      return;
    }

    callback(null, true);
  }
});

export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024
  },
  fileFilter(req, file, callback) {
    try {
      if (compressedMetadataRequired(req, file)) {
        callback(new ApiError(400, "Uploads must be compressed by the BYBS uploader"));
        return;
      }

      if (!validateCsvUpload(req, file)) {
        callback(new ApiError(400, "Please upload a CSV file"));
        return;
      }
    } catch (error) {
      callback(error);
      return;
    }

    callback(null, true);
  }
});

export const profileImageUpload = multer({
  storage: resourceStorage,
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter(req, file, callback) {
    try {
      if (compressedMetadataRequired(req, file)) {
        callback(new ApiError(400, "Uploads must be compressed by the BYBS uploader"));
        return;
      }

      if (!validateImageUpload(req, file)) {
        callback(new ApiError(400, "Please upload a JPG, PNG, or WebP image"));
        return;
      }
    } catch (error) {
      callback(error);
      return;
    }

    callback(null, true);
  }
});

export async function decompressCompressedUpload(req, _res, next) {
  try {
    if (!req.file || !isCompressedUpload(req, req.file)) {
      next();
      return;
    }

    const metadata = compressedFileMetadata(req, req.file.fieldname);
    const compressedSize = req.file.size;
    const compressedBuffer = req.file.buffer || await readFile(req.file.path);
    const decompressedBuffer = await gunzipAsync(compressedBuffer);
    const expectedSize = Number(metadata.originalSize || 0);

    if (expectedSize && decompressedBuffer.length !== expectedSize) {
      throw new ApiError(400, "Compressed upload size did not match the original file");
    }

    if (req.file.path) {
      await writeFile(req.file.path, decompressedBuffer);
    } else {
      req.file.buffer = decompressedBuffer;
    }

    req.file.compressed = true;
    req.file.compressedSize = compressedSize;
    req.file.originalname = safeOriginalName(metadata.originalName);
    req.file.mimetype = metadata.originalType || req.file.mimetype;
    req.file.size = decompressedBuffer.length;
    next();
  } catch (error) {
    next(error instanceof ApiError ? error : new ApiError(400, "Compressed upload could not be processed"));
  }
}

export async function finalizeResourceUpload(req, _res, next) {
  try {
    if (!req.file) {
      next();
      return;
    }

    req.file.originalname = safeOriginalName(req.file.originalname);
    const detected = await detectFileType(req.file);
    const mimeType = ensureDetectedResourceType({ file: req.file, detected });

    req.file.detectedMimeType = detected?.mime || "";
    req.file.mimetype = mimeType;

    await optimizeStoredImage(req.file, mimeType);
    next();
  } catch (error) {
    if (req.file?.path) {
      await unlink(req.file.path).catch(() => {});
    }

    next(error);
  }
}

export async function finalizeCsvUpload(req, _res, next) {
  try {
    if (!req.file) {
      next();
      return;
    }

    req.file.originalname = safeOriginalName(req.file.originalname);
    const detected = await detectFileType(req.file);
    ensureDetectedCsvType({ detected });
    next();
  } catch (error) {
    next(error);
  }
}

export async function finalizeProfileImageUpload(req, _res, next) {
  try {
    if (!req.file) {
      next();
      return;
    }

    req.file.originalname = safeOriginalName(req.file.originalname);
    const detected = await detectFileType(req.file);
    const mimeType = ensureDetectedImageType({ file: req.file, detected });

    req.file.detectedMimeType = detected?.mime || "";
    req.file.mimetype = mimeType;

    await optimizeStoredImage(req.file, mimeType);
    next();
  } catch (error) {
    if (req.file?.path) {
      await unlink(req.file.path).catch(() => {});
    }

    next(error);
  }
}
