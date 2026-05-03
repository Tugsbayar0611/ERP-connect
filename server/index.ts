// server/index.ts

import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { pool } from "./db"; // DB холболт тест хийхэд ашиглая
import { initializeSocket } from "./socket";
import { rateLimitStore } from "./security";
const app = express();
const httpServer = createServer(app);

// Initialize Socket.io
const io = initializeSocket(httpServer);

// Security Headers (Helmet)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"], // Tailwind needs inline styles, Google Fonts for stylesheets
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Vite dev mode needs eval
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:", "ws:", "wss:"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://fonts.googleapis.com"], // Google Fonts
      frameSrc: ["'self'", "blob:"], // Allow blob URLs in iframes for PDF preview
      objectSrc: ["'self'", "blob:"], // Allow blob URLs in object tags for PDF preview
    },
  },
  crossOriginEmbedderPolicy: false, // Vite HMR needs this
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

// HTTPS enforcement (production only) - early in middleware chain
if (process.env.NODE_ENV === "production") {
  app.use((req: any, res: any, next: any) => {
    const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
    if (!isSecure) {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

// Serve uploads
import path from "path";
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

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

app.get("/api/reset-rate-limit", (req, res, next) => {
  try {
    rateLimitStore.clear();
    res.send("Rate limit reset хийлээ");
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
      if (capturedJsonResponse) {
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

  // AI routes нь Passport/session-аас хамааралтай тул registerRoutes дараа mount хийнэ
  const { default: aiRoutes } = await import("./routes/ai");
  app.use("/api/ai", aiRoutes);

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;

    // Don't leak error details in production
    const message = process.env.NODE_ENV === "production" && status === 500
      ? "Internal Server Error"
      : err.message || "Internal Server Error";

    res.status(status).json({ message });

    // Log error for debugging (but don't expose to client)
    if (process.env.NODE_ENV !== "production") {
      console.error("Error:", err);
      throw err;
    }
  });

  // Vite / static
  if (process.env.NODE_ENV === "production" && process.env.FORCE_HTTPS === "true") {
    app.use((req: any, res: any, next: any) => {
      const isSecure = req.secure || req.headers["x-forwarded-proto"] === "https";
      if (!isSecure) {
        return res.redirect(301, `https://${req.headers.host}${req.url}`);
      }
      next();
    });
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
})();