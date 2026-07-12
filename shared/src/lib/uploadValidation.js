export const RESOURCE_UPLOAD_ACCEPT = [
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
].join(",");

const allowedExtensions = new Set([
  "csv",
  "doc",
  "docx",
  "jpeg",
  "jpg",
  "mp4",
  "pdf",
  "png",
  "ppt",
  "pptx",
  "txt",
  "webp",
  "xls",
  "xlsx"
]);

const allowedMimeTypes = new Set([
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
  "video/mp4"
]);

function extensionFor(file) {
  const name = String(file?.name || "");
  return name.includes(".") ? name.split(".").pop().toLowerCase() : "";
}

export function validateResourceFile(file, { maxSizeMb = 50 } = {}) {
  if (!file) return "Choose a file before uploading.";

  const extension = extensionFor(file);
  const hasAllowedExtension = allowedExtensions.has(extension);
  const hasAllowedMimeType = file.type ? allowedMimeTypes.has(file.type) : true;

  if (!hasAllowedExtension || !hasAllowedMimeType) {
    return "Please upload a PDF, Word, PowerPoint, Excel, CSV, text, image, or MP4 file.";
  }

  if (file.size > maxSizeMb * 1024 * 1024) {
    return `Please upload a file that is ${maxSizeMb} MB or smaller.`;
  }

  return "";
}
