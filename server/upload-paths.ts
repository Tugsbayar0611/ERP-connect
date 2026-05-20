import path from "path";

export const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads"));

const DEFAULT_MODULE = "general";

export function sanitizeUploadSegment(value: string | undefined | null, fallback = DEFAULT_MODULE) {
  const sanitized = String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sanitized || fallback;
}

export function getUploadRelativeDir(
  tenantId: string | undefined | null,
  moduleName = DEFAULT_MODULE,
  date = new Date(),
) {
  const tenantSegment = sanitizeUploadSegment(tenantId, "no-tenant");
  const moduleSegment = sanitizeUploadSegment(moduleName);
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return path.posix.join(tenantSegment, year, month, moduleSegment);
}

export function getUploadDestination(relativeDir: string) {
  return path.join(uploadDir, relativeDir);
}

export function uploadUrlFor(relativePath: string) {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return `/uploads/${normalized}`;
}
