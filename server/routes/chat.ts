import { Router } from "express";
import { storage } from "../storage";
import { insertChatMessageSchema } from "@shared/schema";
import { emitNewMessage, emitMessageEdit, emitMessageDelete } from "../socket";

const router = Router();

// Helper to ensure tenant context
const requireTenant = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(403).send("No tenant associated with user");
    req.tenantId = tenantId;
    next();
};

// GET /api/chat/channels - Get user's channels
router.get("/channels", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const channels = await storage.getChatChannels(req.tenantId, req.user.id);
        res.json(channels);
    } catch (error) {
        next(error);
    }
});

// GET /api/chat/channels/:id - Get single channel
router.get("/channels/:id", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const channel = await storage.getChatChannel(req.params.id);
        if (!channel) return res.sendStatus(404);

        // Check if user is member
        const isMember = await storage.isChannelMember(req.params.id, req.user.id);
        if (!isMember) return res.sendStatus(403);

        res.json(channel);
    } catch (error) {
        next(error);
    }
});

// POST /api/chat/channels/direct - Create or get existing direct chat
router.post("/channels/direct", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: "userId required" });

        const channel = await storage.getOrCreateDirectChannel(
            req.tenantId,
            req.user.id,
            userId,
            req.user.id
        );
        res.json(channel);
    } catch (error) {
        next(error);
    }
});

// POST /api/chat/channels/group - Create group chat
router.post("/channels/group", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const { name, memberIds } = req.body;
        if (!name || !memberIds || !Array.isArray(memberIds)) {
            return res.status(400).json({ error: "name and memberIds[] required" });
        }

        const channel = await storage.createGroupChannel(
            req.tenantId,
            name,
            req.user.id,
            memberIds
        );
        res.status(201).json(channel);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/chat/channels/:id - Delete channel (only creator can delete)
router.delete("/channels/:id", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const result = await storage.deleteChannel(req.params.id, req.user.id);

        if (!result.success) {
            return res.status(403).json({ error: result.error });
        }

        res.sendStatus(204);
    } catch (error) {
        next(error);
    }
});
router.get("/channels/:id/members", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const isMember = await storage.isChannelMember(req.params.id, req.user.id);
        if (!isMember) return res.sendStatus(403);

        const members = await storage.getChannelMembers(req.params.id);
        res.json(members);
    } catch (error) {
        next(error);
    }
});

// GET /api/chat/channels/:id/messages - Get channel messages
router.get("/channels/:id/messages", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const isMember = await storage.isChannelMember(req.params.id, req.user.id);
        if (!isMember) return res.sendStatus(403);

        const { limit, cursor } = req.query;
        const messages = await storage.getChatMessages(
            req.params.id,
            limit ? parseInt(limit as string) : 50,
            cursor as string | undefined
        );

        // Update last read
        await storage.updateLastReadAt(req.params.id, req.user.id);

        res.json(messages);
    } catch (error) {
        next(error);
    }
});

// POST /api/chat/channels/:id/messages - Send message
router.post("/channels/:id/messages", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const isMember = await storage.isChannelMember(req.params.id, req.user.id);
        if (!isMember) return res.sendStatus(403);

        const { content, type, fileUrl, replyToId } = req.body;
        if (!content) return res.status(400).json({ error: "content required" });

        const message = await storage.createChatMessage({
            channelId: req.params.id,
            senderId: req.user.id,
            content,
            type: type || "text",
            fileUrl,
            replyToId
        });

        // Emit via Socket.io for real-time delivery
        emitNewMessage(req.params.id, {
            ...message,
            senderName: req.user.fullName,
            senderEmail: req.user.email
        });

        res.status(201).json(message);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/chat/messages/:id - Delete (soft) message (only sender can delete)
router.delete("/messages/:id", requireTenant, async (req: any, res: any, next: any) => {
    try {
        // Get message to check ownership
        const message = await storage.getChatMessageById(req.params.id);
        if (!message) return res.sendStatus(404);

        // Only sender can delete their own message
        if (message.senderId !== req.user.id) {
            return res.status(403).json({ error: "Зөвхөн өөрийн мессежийг устгах боломжтой" });
        }

        await storage.deleteMessage(req.params.id);

        // Emit via Socket.io
        emitMessageDelete(message.channelId, req.params.id);

        res.sendStatus(204);
    } catch (error) {
        next(error);
    }
});

// PATCH /api/chat/messages/:id - Edit message (only sender can edit)
router.patch("/messages/:id", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: "Content required" });
        }

        const result = await storage.updateMessage(req.params.id, req.user.id, content.trim());

        if (!result.success) {
            return res.status(403).json({ error: result.error });
        }

        // Get message to emit with channelId
        const message = await storage.getChatMessageById(req.params.id);
        if (message) {
            emitMessageEdit(message.channelId, req.params.id, content.trim());
        }

        res.json({ success: true });
    } catch (error) {
        next(error);
    }
});

// POST /api/chat/messages/:id/reactions - Toggle reaction
router.post("/messages/:id/reactions", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const { emoji } = req.body;
        if (!emoji) return res.status(400).json({ error: "Emoji required" });

        const result = await storage.toggleMessageReaction(req.params.id, req.user.id, emoji);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/chat/employees/search - Search employees for mentions/new chats
router.get("/employees/search", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const { q } = req.query;
        // Get all users from tenant (simplified - could add search logic)
        const users = await storage.getUsers(req.tenantId);

        if (q) {
            const query = (q as string).toLowerCase();
            const filtered = users.filter((u: any) =>
                u.fullName?.toLowerCase().includes(query) ||
                u.email?.toLowerCase().includes(query)
            );
            return res.json(filtered);
        }

        res.json(users);
    } catch (error) {
        next(error);
    }
});

export default router;
