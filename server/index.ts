// server/index.ts

import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic, serveUploads } from "./static";
import { createServer } from "http";
import { createServer as createHttpsServer } from "https";
import fs from "fs";
import { pool } from "./db"; // DB холболт тест хийхэд ашиглая
import { initializeSocket } from "./socket";
import { rateLimitStore } from "./security";
const app = express();
const httpServer = createServer(app);
// HTTPS server (only in production with SSL certs)
const sslKeyPath = process.env.SSL_KEY_PATH || "/opt/ERP-connect/10.0.7.151-key.pem";
const sslCertPath = process.env.SSL_CERT_PATH || "/opt/ERP-connect/10.0.7.151.pem";
const httpsServer = fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)
  ? createHttpsServer({
      key: fs.readFileSync(sslKeyPath),
      cert: fs.readFileSync(sslCertPath),
    }, app)
  : null;

// Initialize Socket.io
const io = initializeSocket(httpServer);

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

if (process.env.NODE_ENV === "production" && process.env.FORCE_HTTPS === "true") {
  app.use((req: any, res, next) => {
    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
    if (!isSecure) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production"
    ? {
        useDefaults: true,
        directives: {
          "default-src": ["'self'"],
          "base-uri": ["'self'"],
          "object-src": ["'none'"],
          "frame-ancestors": ["'self'"],
          "img-src": ["'self'", "data:", "blob:"],
          "font-src": ["'self'", "data:"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "script-src": ["'self'", "'unsafe-inline'"],
          "connect-src": ["'self'", "ws:", "wss:"],
          "worker-src": ["'self'", "blob:"],
          "upgrade-insecure-requests": null,
        },
      }
    : false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  originAgentCluster: false,
}));

// CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((o: string) => o.trim())
    : process.env.NODE_ENV === "production"
      ? false // Deny all in production if not configured
      : ["http://localhost:5000", "http://localhost:5173"], // Dev defaults
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: '50mb', // PDF файлууд base64 хэлбэрээр илгээхэд хангалттай том хязгаар
    verify: (req, _res, buf) => {
      // rawBody-г дараа нь хэрэглэх боломжтой болгоно
      // (жишээ нь Stripe webhook гэх мэт)
      (req as any).rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false, limit: '50mb' }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// DB холболт шалгах энгийн route
app.get("/api/db-test", async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ now: result.rows[0].now });
  } catch (err) {
    next(err);
  }
});

app.post("/api/reset-rate-limit", (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "production") {
      const configuredToken = process.env.RATE_LIMIT_RESET_TOKEN;
      const authHeader = req.get("authorization") || "";
      const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
      const suppliedToken = req.get("x-admin-token") || bearerToken;

      if (!configuredToken || suppliedToken !== configuredToken) {
        return res.status(404).json({ message: "Not Found" });
      }
    }

    rateLimitStore.clear();
    res.json({ message: "Rate limit reset" });
  } catch (err) {
    next(err);
  }
});

// API log middleware
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse && process.env.NODE_ENV !== "production") {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // энд registerRoutes дотор чинь db-г ашигладаг бол бүгд local Postgres руу явна
  await registerRoutes(httpServer, app);
  serveUploads(app);

  // AI routes нь Passport/session-аас хамааралтай тул registerRoutes дараа mount хийнэ
  const { default: aiRoutes } = await import("./routes/ai");
  app.use("/api/ai", aiRoutes);

  app.use("/api", (_req, res) => {
    res.status(404).json({ message: "Not Found" });
  });

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;

    // Don't leak error details in production
    const message = process.env.NODE_ENV === "production"
      ? (status === 404 ? "Not Found" : status >= 500 ? "Internal Server Error" : err.message || "Error")
      : err.message || "Internal Server Error";

    if (!res.headersSent) {
      res.status(status).json({ message });
    }

    // Log error for debugging (but don't expose to client)
    if (process.env.NODE_ENV !== "production") {
      console.error("Error:", err);
    }
  });

  // Vite / static
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: false,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
  httpsServer?.listen(5443, "0.0.0.0", () => {
    log(`serving HTTPS on port 5443`);
  });
})();
