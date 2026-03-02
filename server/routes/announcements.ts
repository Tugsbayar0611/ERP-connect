import { Router } from "express";
import { storage } from "../storage";
import { insertAnnouncementSchema } from "@shared/schema";

const router = Router();

// Helper to ensure tenant context
const requireTenant = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(403).send("No tenant associated with user");
    req.tenantId = tenantId;
    next();
};

// GET /api/announcements - Get all announcements for tenant
router.get("/", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const { unreadOnly } = req.query;
        const announcements = await storage.getAnnouncements(req.tenantId, {
            unreadOnly: unreadOnly === "true",
            userId: req.user.id
        });
        res.json(announcements);
    } catch (error) {
        next(error);
    }
});

// GET /api/announcements/:id - Get single announcement
router.get("/:id", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const announcement = await storage.getAnnouncement(req.params.id);
        if (!announcement) return res.sendStatus(404);
        res.json(announcement);
    } catch (error) {
        next(error);
    }
});

// POST /api/announcements - Create new announcement
router.post("/", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const data = insertAnnouncementSchema.parse(req.body);
        const announcement = await storage.createAnnouncement({
            ...data,
            tenantId: req.tenantId,
            createdById: req.user.id
        });
        res.status(201).json(announcement);
    } catch (error) {
        next(error);
    }
});

// PUT /api/announcements/:id - Update announcement
router.put("/:id", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const updated = await storage.updateAnnouncement(req.params.id, req.body);
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/announcements/:id - Delete announcement
router.delete("/:id", requireTenant, async (req: any, res: any, next: any) => {
    try {
        await storage.deleteAnnouncement(req.params.id);
        res.sendStatus(204);
    } catch (error) {
        next(error);
    }
});

// POST /api/announcements/:id/read - Mark as read
router.post("/:id/read", requireTenant, async (req: any, res: any, next: any) => {
    try {
        await storage.markAnnouncementAsRead(req.params.id, req.user.id);
        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// GET /api/announcements/:id/comments - Get comments
router.get("/:id/comments", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const comments = await storage.getAnnouncementComments(req.params.id);
        res.json(comments);
    } catch (error) {
        next(error);
    }
});

// POST /api/announcements/:id/comments - Add comment
router.post("/:id/comments", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const { content } = req.body;
        if (!content) return res.status(400).json({ error: "Content required" });
        const comment = await storage.addAnnouncementComment(req.params.id, req.user.id, content);
        res.status(201).json(comment);
    } catch (error) {
        next(error);
    }
});

// POST /api/announcements/:id/reactions - Toggle reaction
router.post("/:id/reactions", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const { emoji } = req.body;
        if (!emoji) return res.status(400).json({ error: "Emoji required" });
        const result = await storage.toggleAnnouncementReaction(req.params.id, req.user.id, emoji);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/announcements/:id/reactions - Get reactions
router.get("/:id/reactions", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const reactions = await storage.getAnnouncementReactions(req.params.id);
        res.json(reactions);
    } catch (error) {
        next(error);
    }
});

export default router;
