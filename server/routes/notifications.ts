import { Router } from "express";
import { storage } from "../storage";
import { requireTenant } from "../middleware";
import { isEmployee, isManager, isPrivileged } from "../../shared/roles";
import { db } from "../db";
import { notificationReads, notificationSettings } from "../../shared/schema";
import { eq, inArray, and, sql } from "drizzle-orm";

const router = Router();

// Helper to generate dynamic list
async function generateCoreNotifications(tenantId: string, user: any, audience?: string) {
    let notifications: any[] = [];

    // 1. Employee Context (Requests, Documents, Personal items)
    const employee = await storage.getEmployeeByUserId(user.id);
    if (employee) {
        // Use generic requests instead of legacy leaveRequests
        const requests = await storage.getMyRequests(tenantId, employee.id);
        const myRequestNotifications = requests
            .slice(0, 20)
            .map(req => ({
                id: req.id,
                title: getRequestTitle(req),
                description: `${req.title} (${safeFormatDate(req.createdAt)})`,
                type: getStatusType(req.status),
                // Fix: Date from DB is read as Local but treated as UTC by driver? or vice versa.
                // Keeping existing logic for consistency, but relying on frontend to format correctly.
                date: req.createdAt,
                link: `/me/requests/${req.id}`, // Link to details page
                metadata: { status: req.status, requestId: req.id }
            }));
        notifications = [...notifications, ...myRequestNotifications];
    }

    // 2. Admin/Manager Context (Inventory Alerts, Pending Approvals)
    const isAdminOrManager = isPrivileged(user.role) || isManager(user.role);

    if (audience === "admin" || (!audience && isAdminOrManager)) {
        // A. Inventory Expiry Alerts
        const alerts = await storage.getExpiryAlerts(tenantId, 30);
        const inventoryNotifications = alerts.map((alert: any) => ({
            id: `expiry-${alert.id}`,
            title: "Барааны хугацаа дуусаж байна",
            description: `${alert.productName} (${alert.batchNumber}) - ${alert.daysUntilExpiry} хоног үлдлээ`,
            type: "warning",
            date: new Date().toISOString(),
            link: "/inventory?tab=alert",
            metadata: { daysUntilExpiry: alert.daysUntilExpiry }
        }));
        notifications = [...notifications, ...inventoryNotifications];

        // B. Pending Approvals
        // Find requests where current step awaits this user's role
        if (isAdminOrManager) {
            // Use getApproverInbox for specific assignments
            const inboxItems = await storage.getApproverInbox(tenantId, user.id);

            const approvalNotifications = inboxItems.map(req => ({
                id: `approval-${req.id}`,
                title: "Шинэ хүсэлт хүлээгдэж байна",
                description: `${req.title} - Step ${req.currentStep}`,
                type: "info",
                date: req.submittedAt || req.createdAt,
                link: `/requests/inbox`, // Manager inbox
                metadata: { requestId: req.id, type: 'approval' }
            }));
            notifications = [...notifications, ...approvalNotifications];
        }
    }

    // Sort by date desc
    notifications.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return notifications;
}

router.get("/notifications", requireTenant, async (req: any, res) => {
    try {
        const { audience } = req.query; // 'employee' | 'admin' | undefined

        const rawNotifications = await generateCoreNotifications(req.tenantId, req.user, audience as string);

        // READ STATE LOGIC
        // 1. Get Settings
        const [settings] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, req.user.id));
        // Default to epoch if no settings
        const lastReadAllAt = settings?.lastReadAllAt ? new Date(settings.lastReadAllAt) : new Date(0);

        // 2. Get Reads for these notifications
        const notificationIds = rawNotifications.map(n => n.id);

        let readIds = new Set<string>();
        if (notificationIds.length > 0) {
            const userReads = await db.select().from(notificationReads)
                .where(and(
                    eq(notificationReads.userId, req.user.id),
                    inArray(notificationReads.notificationId, notificationIds)
                ));
            userReads.forEach(r => readIds.add(r.notificationId));
        }

        // 3. Map
        const finalNotifications = rawNotifications.map(n => {
            const notifDate = new Date(n.date);
            const isRead = (notifDate <= lastReadAllAt) || readIds.has(n.id);
            return { ...n, read: isRead };
        });

        res.json(finalNotifications);

    } catch (error) {
        console.error("GET /notifications error:", error);
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
});

router.get("/notifications/unread-count", requireTenant, async (req: any, res) => {
    try {
        const { audience } = req.query;
        const rawNotifications = await generateCoreNotifications(req.tenantId, req.user, audience as string);

        // Get Settings
        const [settings] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, req.user.id));
        const lastReadAllAt = settings?.lastReadAllAt ? new Date(settings.lastReadAllAt) : new Date(0);

        // Get Reads
        const notificationIds = rawNotifications.map(n => n.id);
        let readIds = new Set<string>();
        if (notificationIds.length > 0) {
            const userReads = await db.select().from(notificationReads)
                .where(and(
                    eq(notificationReads.userId, req.user.id),
                    inArray(notificationReads.notificationId, notificationIds)
                ));
            userReads.forEach(r => readIds.add(r.notificationId));
        }

        // Count unread
        const unreadCount = rawNotifications.reduce((count, n) => {
            const notifDate = new Date(n.date);
            const isRead = (notifDate <= lastReadAllAt) || readIds.has(n.id);
            return isRead ? count : count + 1;
        }, 0);

        res.json({ count: unreadCount });
    } catch (error) {
        console.error("GET /notifications/unread-count error:", error);
        res.status(500).json({ message: "Failed to fetch unread count" });
    }
});

router.post("/notifications/:id/read", requireTenant, async (req: any, res) => {
    try {
        await db.insert(notificationReads).values({
            userId: req.user.id,
            notificationId: req.params.id,
        }).onConflictDoNothing();
        res.json({ success: true });
    } catch (error) {
        console.error("POST /notifications/:id/read error:", error);
        res.status(500).json({ message: "Failed to mark as read" });
    }
});

router.post("/notifications/read-all", requireTenant, async (req: any, res) => {
    try {
        await db.insert(notificationSettings).values({
            userId: req.user.id,
            lastReadAllAt: new Date(),
        }).onConflictDoUpdate({
            target: notificationSettings.userId,
            set: { lastReadAllAt: new Date() }
        });
        res.json({ success: true });
    } catch (error) {
        console.error("POST /notifications/read-all error:", error);
        res.status(500).json({ message: "Failed to mark all as read" });
    }
});

// Helpers
function getRequestTitle(req: any) {
    if (req.status === 'approved') return "Чөлөөний хүсэлт зөвшөөрөгдсөн";
    if (req.status === 'rejected') return "Чөлөөний хүсэлт татгалзсан";
    return "Чөлөөний хүсэлт хүлээгдэж байна";
}

function getStatusType(status: string) {
    if (status === 'approved') return "success";
    if (status === 'rejected') return "error";
    return "info";
}

function safeFormatDate(dateStr: any) {
    if (!dateStr) return "";
    try {
        return new Date(dateStr).toISOString().split('T')[0];
    } catch {
        return "";
    }
}

export default router;
