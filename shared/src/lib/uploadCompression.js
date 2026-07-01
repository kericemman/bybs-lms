import imageCompression from "browser-image-compression";

const COMPRESSION_FIELD = "__bybsUploadCompression";
const MANIFEST_FIELD = "__bybsUploadManifest";
const COMPRESSION_VERSION = "gzip-v1";

function canCompressUploads() {
  return typeof CompressionStream === "function" && typeof Response === "function";
}

function isBlobLike(value) {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

function fileNameFor(value, fieldName) {
  if (typeof File !== "undefined" && value instanceof File && value.name) {
    return value.name;
  }

  return `${fieldName || "upload"}.bin`;
}

async function gzipBlob(blob) {
  const compressedStream = blob.stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(compressedStream).blob();
}

async function prepareImageFile(file, originalName) {
  if (!file.type?.startsWith("image/")) return file;

  try {
    const compressedImage = await imageCompression(file, {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: file.type
    });

    if (!compressedImage?.size || compressedImage.size >= file.size) {
      return file;
    }

    if (typeof File === "function") {
      return new File([compressedImage], originalName, {
        type: compressedImage.type || file.type,
        lastModified: file.lastModified || Date.now()
      });
    }

    return compressedImage;
  } catch {
    return file;
  }
}

function buildPreparedFormData(textEntries, preparedFiles) {
  const nextFormData = new FormData();
  textEntries.forEach((entry) => nextFormData.append(entry.fieldName, entry.value));
  preparedFiles.forEach((entry) => {
    nextFormData.append(entry.fieldName, entry.file, entry.originalName);
  });
  return nextFormData;
}

export async function compressUploadFormData(formData) {
  if (!(formData instanceof FormData) || formData.has(COMPRESSION_FIELD)) {
    return formData;
  }

  const textEntries = [];
  const fileEntries = [];

  for (const [fieldName, value] of formData.entries()) {
    if (isBlobLike(value)) {
      fileEntries.push({ fieldName, file: value });
    } else {
      textEntries.push({ fieldName, value });
    }
  }

  if (!fileEntries.length) {
    return formData;
  }

  const preparedFiles = [];
  let changedFile = false;

  for (const entry of fileEntries) {
    const originalName = fileNameFor(entry.file, entry.fieldName);
    const preparedFile = await prepareImageFile(entry.file, originalName);
    changedFile = changedFile || preparedFile !== entry.file;
    preparedFiles.push({
      fieldName: entry.fieldName,
      file: preparedFile,
      originalName
    });
  }

  if (!canCompressUploads()) {
    throw new Error("This browser cannot prepare compressed uploads. Please use an updated browser and try again.");
  }

  const compressedFormData = new FormData();
  const manifest = [];
  const compressedFiles = [];

  for (const entry of preparedFiles) {
    const originalName = entry.originalName;
    const originalType = entry.file.type || "application/octet-stream";
    const originalSize = entry.file.size || 0;
    const compressedBlob = await gzipBlob(entry.file);
    const compressedName = `${originalName}.gz`;

    manifest.push({
      fieldName: entry.fieldName,
      originalName,
      originalType,
      originalSize,
      compressedName,
      compressedSize: compressedBlob.size
    });

    if (typeof File === "function") {
      compressedFiles.push({
        fieldName: entry.fieldName,
        file: new File([compressedBlob], compressedName, {
          type: "application/gzip",
          lastModified: entry.file.lastModified || Date.now()
        })
      });
    } else {
      compressedFiles.push({
        fieldName: entry.fieldName,
        file: compressedBlob,
        fileName: compressedName
      });
    }
  }

  compressedFormData.append(COMPRESSION_FIELD, COMPRESSION_VERSION);
  compressedFormData.append(MANIFEST_FIELD, JSON.stringify(manifest));

  textEntries.forEach((entry) => compressedFormData.append(entry.fieldName, entry.value));
  compressedFiles.forEach((entry) => {
    if (entry.fileName) {
      compressedFormData.append(entry.fieldName, entry.file, entry.fileName);
      return;
    }

    compressedFormData.append(entry.fieldName, entry.file);
  });

  return compressedFormData;
}
