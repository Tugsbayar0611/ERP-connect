import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { uploadDir } from "./upload-paths";

function isBlockedUploadPath(requestPath: string) {
  let decodedPath = requestPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    return true;
  }

  const parts = decodedPath
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((part) => part.toLowerCase());

  return parts.some((part) => (
    part === "env" ||
    part === ".env" ||
    part.endsWith(".env") ||
    part.includes("secret") ||
    part.includes("credential") ||
    part.includes("private-key") ||
    /\.(?:pem|key|pfx|p12|crt|cer|jks|kdb)$/i.test(part)
  ));
}

export function serveUploads(app: Express) {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  app.use(
    "/uploads",
    (req, res, next) => {
      if (!req.isAuthenticated?.()) {
        return res.sendStatus(401);
      }

      if (isBlockedUploadPath(req.path)) {
        return res.status(404).json({ message: "File not found" });
      }

      const firstSegment = getUploadPathSegments(req.path)[0];
      const userTenantId = (req.user as any)?.tenantId;
      if (isUuid(firstSegment) && firstSegment !== userTenantId) {
        return res.status(404).json({ message: "File not found" });
      }

      next();
    },
    express.static(uploadDir, {
      dotfiles: "deny",
      fallthrough: false,
      index: false,
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
      },
    }),
  );
}

function getUploadPathSegments(requestPath: string) {
  let decodedPath = requestPath;
  try {
    decodedPath = decodeURIComponent(requestPath);
  } catch {
    return [];
  }

  return decodedPath
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean);
}

function isUuid(value: string | undefined) {
  return !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
