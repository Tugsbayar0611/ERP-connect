/**
 * Security Routes - Session Management
 * Phase 6: Multi-session tracking and revocation
 */

import { Router } from "express";
import { requireTenant } from "../middleware/tenant";
import { hashSessionToken } from "../utils/qr-signing";
import { db } from "../db";
import { userSessions } from "@shared/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { createAuditLog } from "../audit-log";

const router = Router();

// Helper: Get current session ID from request
function getCurrentSessionId(req: any): string | null {
    return req.sessionID || req.session?.id || null;
}

// 1. List my sessions
router.get("/sessions/me", requireTenant, async (req: any, res) => {
    try {
        const currentSessionId = getCurrentSessionId(req);
        const currentTokenHash = currentSessionId ? hashSessionToken(currentSessionId) : null;

        const sessions = await db.select()
            .from(userSessions)
            .where(and(
                eq(userSessions.userId, req.user.id),
                eq(userSessions.tenantId, req.tenantId),
                isNull(userSessions.revokedAt)
            ))
            .orderBy(desc(userSessions.lastSeenAt));

        // Mark current session
        const result = sessions.map(s => ({
            id: s.id,
            deviceName: s.deviceName || 'Unknown Device',
            ipAddress: s.ipAddress,
            createdAt: s.createdAt,
            lastSeenAt: s.lastSeenAt,
            isCurrent: s.sessionTokenHash === currentTokenHash
        }));

        res.json(result);
    } catch (e) {
        console.error("Failed to list sessions:", e);
        res.status(500).json({ message: "Failed to fetch sessions" });
    }
});

// 2. Revoke one session
router.post("/sessions/:id/revoke", requireTenant, async (req: any, res) => {
    try {
        const sessionId = req.params.id;

        // Find the session
        const [session] = await db.select()
            .from(userSessions)
            .where(and(
                eq(userSessions.id, sessionId),
                eq(userSessions.tenantId, req.tenantId),
                isNull(userSessions.revokedAt)
            ));

        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }

        // Only allow revoking own sessions (or admin can revoke others)
        const isAdmin = req.user.role === 'Admin' || (req.user as any).isAdmin;
        if (session.userId !== req.user.id && !isAdmin) {
            return res.status(403).json({ message: "Cannot revoke this session" });
        }

        // Revoke the session
        await db.update(userSessions)
            .set({
                revokedAt: new Date(),
                revokedBy: req.user.id,
                revokeReason: req.body.reason || 'Manual revoke'
            })
            .where(eq(userSessions.id, sessionId));

        // Audit log
        // Audit log
        await createAuditLog(
            {
                tenantId: req.tenantId,
                userId: req.user.id,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.headers["user-agent"]
            },
            "session",
            sessionId,
            "update",
            { revokedAt: null },
            { revokedAt: new Date(), revokedBy: req.user.id, reason: req.body.reason },
            "Session revoked"
        );

        res.json({ message: "Session revoked" });
    } catch (e) {
        console.error("Failed to revoke session:", e);
        res.status(500).json({ message: "Failed to revoke session" });
    }
});

// 3. Logout all devices (except current)
router.post("/sessions/me/logout-all", requireTenant, async (req: any, res) => {
    try {
        const currentSessionId = getCurrentSessionId(req);
        const currentTokenHash = currentSessionId ? hashSessionToken(currentSessionId) : null;
        const includeCurrentSession = req.body.includeCurrentSession === true;

        // Get all active sessions
        const sessions = await db.select()
            .from(userSessions)
            .where(and(
                eq(userSessions.userId, req.user.id),
                eq(userSessions.tenantId, req.tenantId),
                isNull(userSessions.revokedAt)
            ));

        // Revoke all (or all except current)
        let revokedCount = 0;
        for (const session of sessions) {
            if (!includeCurrentSession && session.sessionTokenHash === currentTokenHash) {
                continue; // Skip current session
            }

            await db.update(userSessions)
                .set({
                    revokedAt: new Date(),
                    revokedBy: req.user.id,
                    revokeReason: 'Logout all devices'
                })
                .where(eq(userSessions.id, session.id));
            revokedCount++;
        }

        // Audit log
        // Audit log
        if (revokedCount > 0) {
            await createAuditLog(
                {
                    tenantId: req.tenantId,
                    userId: req.user.id,
                    ip: req.ip || req.connection.remoteAddress,
                    userAgent: req.headers["user-agent"]
                },
                "session",
                "bulk_logout", // pseudo-id
                "update",
                undefined,
                { count: revokedCount, includeCurrent: includeCurrentSession },
                `Terminated ${revokedCount} active sessions`
            );
        }

        res.json({ message: `${revokedCount} session(s) logged out` });
    } catch (e) {
        console.error("Failed to logout all:", e);
        res.status(500).json({ message: "Failed to logout all sessions" });
    }
});

export default router;
