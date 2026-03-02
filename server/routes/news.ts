
import { Router } from "express";
import { storage } from "../storage";
import { insertCompanyPostSchema } from "@shared/schema";

const router = Router();

// Helper to ensure tenant context
const requireTenant = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(403).send("No tenant associated with user");
    req.tenantId = tenantId;
    next();
};

// GET /api/posts - Get all posts
router.get("/", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
        const search = req.query.q as string;
        const type = req.query.type as string;
        const severity = req.query.severity as string;

        const posts = await storage.getCompanyPosts(req.tenantId, { limit, search, type, severity });

        // TODO: Efficiently check isLiked for each post. 
        // For now, we'll fetch likes for the user and map them.
        // Or we can rely on the frontend to maybe fetch likes separately? 
        // But the frontend expects isLiked in the post object.
        // Let's do a quick hack: fetch all user likes for these posts?
        // Or just return as is and let the frontend deal with it (it might not show liked status correctly).

        // Better: checking likes for the current user
        const postsWithLikeStatus = await Promise.all(posts.map(async (post) => {
            const likes = await storage.getPostLikes(req.tenantId, post.id);
            const userLike = likes.find(like => like.employeeId === req.user.employeeId);
            return { ...post, currentUserReaction: userLike?.reactionType };
        }));

        res.json(postsWithLikeStatus);
    } catch (error) {
        next(error);
    }
});

// GET /api/posts/:id - Get single post
router.get("/:id", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const post = await storage.getCompanyPost(req.params.id);
        if (!post) return res.sendStatus(404);

        // Check like status
        const likes = await storage.getPostLikes(req.tenantId, post.id);
        const userLike = likes.find(like => like.employeeId === req.user.employeeId);

        res.json({ ...post, currentUserReaction: userLike?.reactionType });
    } catch (error) {
        next(error);
    }
});

// POST /api/posts - Create new post
router.post("/", requireTenant, async (req: any, res: any, next: any) => {
    try {
        // We need employeeId for the author. 
        // If req.user.employeeId is not set, we might need to find it or fail.
        if (!req.user.employeeId) {
            return res.status(400).json({ message: "User is not linked to an employee record" });
        }

        const data = insertCompanyPostSchema.parse(req.body);
        const post = await storage.createCompanyPost({
            ...data,
            tenantId: req.tenantId,
            authorId: req.user.employeeId,
            images: data.images || [] // Ensure images is array
        });
        res.status(201).json(post);
    } catch (error) {
        next(error);
    }
});

// PUT /api/posts/:id - Update post
router.put("/:id", requireTenant, async (req: any, res: any, next: any) => {
    try {
        // Should verify author or admin
        const existing = await storage.getCompanyPost(req.params.id);
        if (!existing) return res.sendStatus(404);

        if (existing.authorId !== req.user.employeeId && req.user.role !== 'Admin') {
            return res.sendStatus(403);
        }

        const updated = await storage.updateCompanyPost(req.params.id, req.body);
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

// DELETE /api/posts/:id - Delete post
router.delete("/:id", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const existing = await storage.getCompanyPost(req.params.id);
        if (!existing) return res.sendStatus(404);

        if (existing.authorId !== req.user.employeeId && req.user.role !== 'Admin') {
            return res.sendStatus(403);
        }

        await storage.deleteCompanyPost(req.params.id);
        res.sendStatus(204);
    } catch (error) {
        next(error);
    }
});

// POST /api/posts/:id/like - Toggle like
router.post("/:id/like", requireTenant, async (req: any, res: any, next: any) => {
    try {
        if (!req.user.employeeId) {
            return res.status(400).json({ message: "User is not linked to an employee record" });
        }
        const { reactionType } = req.body;
        const result = await storage.togglePostLike(req.tenantId, req.params.id, req.user.employeeId, reactionType);
        res.json(result);
    } catch (error) {
        next(error);
    }
});

// GET /api/posts/:id/comments - Get comments
router.get("/:id/comments", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const comments = await storage.getPostComments(req.tenantId, req.params.id);
        res.json(comments.map((comment: any) => ({
            ...comment,
            employeeName: `${comment.employeeFirstName || ""} ${comment.employeeLastName || ""}`.trim()
                || comment.userFullName
                || "Unknown",
        })));
    } catch (error) {
        next(error);
    }
});

// POST /api/posts/:id/comments - Add comment
router.post("/:id/comments", requireTenant, async (req: any, res: any, next: any) => {
    try {
        if (!req.user.employeeId) {
            return res.status(400).json({ message: "User is not linked to an employee record" });
        }

        const { content } = req.body;
        if (!content) return res.status(400).json({ error: "Content required" });

        const comment = await storage.createPostComment({
            tenantId: req.tenantId,
            postId: req.params.id,
            employeeId: req.user.employeeId,
            content,
            // Let DB set createdAt with defaultNow() for correct timezone
        } as any);
        res.status(201).json(comment);
    } catch (error) {
        next(error);
    }
});

export default router;
