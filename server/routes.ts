


import type { Express } from "express";
import { type Server } from "http";
import { setupAuth } from "./auth";
import { apiRateLimiter } from "./security";
import path from "path";
import fs from "fs";
import express from "express";

// Modular route imports
import announcementsRoutes from "./routes/announcements";
import chatRoutes from "./routes/chat";
import hrRoutes from "./routes/hr";
import accountingRoutes from "./routes/accounting";
import inventoryRouter from "./routes/inventory";
import crmRoutes from "./routes/crm";
import documentsRoutes from "./routes/documents";
import settingsRoutes from "./routes/settings";
import performanceRoutes from "./routes/performance";
import newsRoutes from "./routes/news";
import reportsRoutes from "./routes/reports";
import uploadRoutes from "./routes/upload";
import requestsRoutes from "./routes/requests";
import notificationsRoutes from "./routes/notifications";
import rosterRoutes from "./routes/roster";
import transportRoutes from "./routes/transport";
import canteenRoutes from "./routes/canteen";
import assetRoutes from "./routes/assets";
import templatesRoutes from "./routes/templates";
import securityRoutes from "./routes/security";
import digitalIdRoutes from "./routes/digital-id";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupAuth(app);

  // General API rate limiting (applied to all API routes)
  app.use("/api", apiRateLimiter);

  // Serve uploads directory
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
  app.use('/uploads', express.static(uploadDir));

  // Mount modular routes
  app.use("/api/announcements", announcementsRoutes);
  app.use("/api/chat", chatRoutes);
  app.use("/api/posts", newsRoutes); // News Feed
  app.use("/api/templates", templatesRoutes);
  app.use("/api/reports", reportsRoutes); // Reports (Trial Balance, BS, P&L, VAT)
  app.use("/api/upload", uploadRoutes); // Generic File Upload


  // Domain modules
  app.use("/api", hrRoutes);
  app.use(accountingRoutes);
  app.use(inventoryRouter);
  app.use("/api", crmRoutes);
  app.use("/api", documentsRoutes);
  app.use("/api", settingsRoutes); // Weather, Company, QPay, RBAC, Users, Audit
  app.use("/api", requestsRoutes);
  app.use("/api", notificationsRoutes);
  app.use("/api/rosters", rosterRoutes);

  // ...

  app.use("/api/transport", transportRoutes);
  app.use("/api/canteen", canteenRoutes);
  app.use("/api/assets", assetRoutes);
  app.use("/api", performanceRoutes); // Performance & KPI

  // Phase 6: Security & Digital ID
  app.use("/api/security", securityRoutes);
  app.use("/api/digital-id", digitalIdRoutes);

  return httpServer;
}
