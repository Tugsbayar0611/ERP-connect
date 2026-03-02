
import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { insertContactSchema, type DbInsertContact } from "@shared/schema";
import { requireTenant } from "../middleware";

const router = Router();

// --- Contacts (CRM) ---
router.get("/contacts", requireTenant, async (req: any, res) => {
    const type = req.query.type as string | undefined;
    const contacts = await storage.getContacts(req.tenantId, type);
    res.json(contacts);
});

router.get("/contacts/:id", requireTenant, async (req: any, res) => {
    const contact = await storage.getContact(req.params.id);
    if (!contact || contact.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Contact not found" });
    }
    res.json(contact);
});

router.post("/contacts", requireTenant, async (req: any, res) => {
    try {
        const input = { ...insertContactSchema.parse(req.body), tenantId: req.tenantId } as DbInsertContact;
        const contact = await storage.createContact(input);
        res.status(201).json(contact);
    } catch (err) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error(err);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
});

router.put("/contacts/:id", requireTenant, async (req: any, res) => {
    try {
        const existing = await storage.getContact(req.params.id);
        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Contact not found" });
        }
        const input = insertContactSchema.partial().parse(req.body);
        const contact = await storage.updateContact(req.params.id, input);
        res.json(contact);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error updating contact" });
    }
});

export default router;
