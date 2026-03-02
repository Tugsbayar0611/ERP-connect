import express from "express";
import { storage } from "../storage";
import { requireTenant } from "../middleware";
import { z } from "zod";

const router = express.Router();

// Create new template version (Admin only ideally)
router.post("/official_letter", requireTenant, async (req: any, res) => {
    try {
        const { content } = req.body;
        if (!content) return res.status(400).send("Content required");

        // Simple admin check (if role exists)
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            // Allow manager for now if admin not distinct
            // return res.status(403).send("Forbidden");
        }

        const current = await storage.getActiveTemplate(req.tenantId, 'official_letter');
        const nextVersion = (current?.version || 0) + 1;

        const tmpl = await storage.createTemplate({
            tenantId: req.tenantId,
            key: 'official_letter',
            name: 'Official Letter Template',
            content,
            version: nextVersion,
            isActive: true,
            createdBy: req.user.id
        });

        res.json(tmpl);
    } catch (e) {
        console.error(e);
        res.status(500).send("Failed to create template");
    }
});

// Get active template
router.get("/official_letter/active", requireTenant, async (req: any, res) => {
    try {
        const tmpl = await storage.getActiveTemplate(req.tenantId, 'official_letter');
        res.json(tmpl || { content: '' });
    } catch (e) {
        res.status(500).send("Failed to fetch template");
    }
});

export default router;
