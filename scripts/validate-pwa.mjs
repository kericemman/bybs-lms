import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const portals = ["admins", "mentors", "students"];
const requiredFiles = [
  "index.html",
  "manifest.webmanifest",
  "offline.html",
  "offline.js",
  "service-worker.js",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png"
];

for (const portal of portals) {
  const distDirectory = path.join(root, portal, "dist");
  await Promise.all(requiredFiles.map((file) => access(path.join(distDirectory, file))));

  const manifest = JSON.parse(await readFile(path.join(distDirectory, "manifest.webmanifest"), "utf8"));
  if (!manifest.name || !manifest.short_name || manifest.display !== "standalone") {
    throw new Error(`${portal} manifest is missing its installable app identity.`);
  }
  if (manifest.scope !== "/" || !manifest.start_url?.startsWith("/")) {
    throw new Error(`${portal} manifest must remain scoped to its own portal origin.`);
  }

  const index = await readFile(path.join(distDirectory, "index.html"), "utf8");
  if (!index.includes("/manifest.webmanifest") || !index.includes('name="theme-color"')) {
    throw new Error(`${portal} index is missing PWA metadata.`);
  }

  const serviceWorker = await readFile(path.join(distDirectory, "service-worker.js"), "utf8");
  for (const guard of ['startsWith("/api/")', 'startsWith("/uploads/")', 'cache: "no-store"']) {
    if (!serviceWorker.includes(guard)) {
      throw new Error(`${portal} service worker is missing security guard: ${guard}`);
    }
  }

  const iconChecks = [
    ["icons/icon-192.png", 192],
    ["icons/icon-512.png", 512],
    ["icons/icon-maskable-512.png", 512]
  ];

  for (const [file, expectedSize] of iconChecks) {
    const metadata = await sharp(path.join(distDirectory, file)).metadata();
    if (metadata.width !== expectedSize || metadata.height !== expectedSize) {
      throw new Error(`${portal}/${file} must be ${expectedSize}x${expectedSize}.`);
    }
  }

  console.log(`Validated ${portal} PWA output.`);
}
