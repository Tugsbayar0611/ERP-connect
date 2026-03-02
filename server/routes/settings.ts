
import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import {
    insertWeatherSettingsSchema,
    insertTenantSchema,
    insertPermissionSchema,
    insertBranchSchema,
    insertCompanySettingsSchema,
    type InsertCompanySettings
} from "@shared/schema";
import { requireTenant, requireTenantAndPermission } from "../middleware";
import { logRBACEvent } from "../rbac-audit";

const router = Router();

// --- Weather Widget ---
router.get("/weather", requireTenant, async (req: any, res) => {
    try {
        const settings = await storage.getWeatherSettings(req.tenantId);

        // Default mock data for development/testing
        const mockWeatherData = {
            temp: -30,
            feelsLike: -35,
            condition: "extreme_cold",
            description: "Хүйтэн",
            city: "Ulaanbaatar",
            settings: {
                cityName: "Ulaanbaatar",
                alertEnabled: true,
                coldThreshold: -25,
                heatThreshold: 35,
            },
            alert: {
                alertType: "extreme_cold",
                temperatureCelsius: -35,
                conditionText: "Хүйтэн",
                message: "Маргааш -35°C хүйтэн байна. Ажилтнууддаа гэрээсээ ажиллах санал тавих уу?",
                suggestedAction: "work_from_home",
            },
        };

        // Determine effective settings (DB or Defaults)
        const city = settings?.cityName || "Ulaanbaatar";
        const country = settings?.countryCode || "MN";
        const alertEnabled = settings?.alertEnabled ?? true; // Default to true
        const coldThreshold = Number(settings?.coldThreshold) || -25;
        const heatThreshold = Number(settings?.heatThreshold) || 35;

        // Fetch current weather
        const { fetchWeatherData, checkWeatherAlerts } = await import("../weather-service");
        const apiKey = settings?.apiKey || process.env.WEATHER_API_KEY || process.env.OPENWEATHERMAP_API_KEY;

        // If no API key, return mock data
        if (!apiKey) {
            console.warn("No weather API key found in settings or environment");
            return res.json(mockWeatherData);
        }

        const weatherData = await fetchWeatherData(city, country, apiKey);

        // If API fails, return mock data instead of error
        if (!weatherData) {
            console.warn("Weather API failed, returning mock data");
            return res.json(mockWeatherData);
        }

        // Check for alerts
        let alert = null;
        if (alertEnabled) {
            alert = checkWeatherAlerts(weatherData, coldThreshold, heatThreshold);

            // Create alert if needed and not already sent today
            if (alert) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const existingAlerts = await storage.getWeatherAlerts(req.tenantId, 1);
                const todayAlert = existingAlerts.find((a: any) =>
                    a.alertType === alert!.alertType &&
                    new Date(a.createdAt) >= today &&
                    !a.isSent
                );

                if (!todayAlert) {
                    await storage.createWeatherAlert({
                        tenantId: req.tenantId,
                        alertType: alert.alertType,
                        temperatureCelsius: String(alert.temperatureCelsius),
                        conditionText: alert.conditionText,
                        message: alert.message,
                        suggestedAction: alert.suggestedAction,
                        isSent: false,
                        createdAt: new Date(),
                    } as any);
                }
            }
        }

        res.json({
            ...weatherData,
            settings: {
                cityName: city,
                alertEnabled: alertEnabled,
                coldThreshold: coldThreshold,
                heatThreshold: heatThreshold,
            },
            alert,
        });
    } catch (err: any) {
        console.error("Weather error:", err);
        res.status(500).json({ message: err.message || "Цаг агаарын мэдээлэл авахад алдаа гарлаа" });
    }
});

router.get("/weather/alerts", requireTenant, async (req: any, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 10;
        const alerts = await storage.getWeatherAlerts(req.tenantId, limit);
        res.json(alerts);
    } catch (err: any) {
        console.error("Weather alerts error:", err);
        res.status(500).json({ message: err.message || "Алдаа гарлаа" });
    }
});

router.put("/weather/settings", requireTenantAndPermission, async (req: any, res) => {
    try {
        const input = insertWeatherSettingsSchema.parse(req.body);
        const settings = await storage.upsertWeatherSettings(req.tenantId, input);
        res.json(settings);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error("Weather settings error:", err);
            res.status(500).json({ message: err.message || "Алдаа гарлаа" });
        }
    }
});

router.post("/weather/alerts/:id/send", requireTenantAndPermission, async (req: any, res) => {
    try {
        await storage.markWeatherAlertAsSent(req.params.id);

        // TODO: Send notification to all employees or admins
        // This could be integrated with email/SMS service

        res.json({ success: true, message: "Анхааруулга илгээгдлээ" });
    } catch (err: any) {
        console.error("Send alert error:", err);
        res.status(500).json({ message: err.message || "Алдаа гарлаа" });
    }
});

// --- Stats ---
router.get("/stats", requireTenant, async (req: any, res) => {
    // Debug: Log tenantId to ensure correct tenant context
    console.log(`[API /api/stats] tenantId: ${req.tenantId}, userId: ${req.user?.id}, role: ${req.user?.role}`);
    const stats = await storage.getStats(req.tenantId, req.user?.id, req.user?.role);
    res.json(stats);
});

// --- Leaderboard ---
router.get("/leaderboard", requireTenant, async (req: any, res) => {
    try {
        // Debug: Log params
        // console.log(`[API /api/leaderboard] tenantId: ${req.tenantId}, range: ${req.query.timeRange}`);
        const limit = req.query.limit ? parseInt(req.query.limit) : 5;
        const timeRange = req.query.timeRange as string || 'all_time';
        const leaderboard = await storage.getLeaderboardData(req.tenantId, limit, timeRange);
        res.json(leaderboard);
    } catch (err: any) {
        console.error("Leaderboard error:", err);
        res.status(500).json({ message: err.message || "Error fetching leaderboard" });
    }
});

// --- Company Settings (Tenant) ---
router.get("/company", requireTenant, async (req: any, res) => {
    const tenant = await storage.getTenant(req.tenantId);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    res.json(tenant);
});

router.get("/company/settings", requireTenant, async (req: any, res) => {
    try {
        const settings = await storage.getCompanySettings(req.tenantId);
        res.json(settings || {
            workStartTime: "09:00",
            workEndTime: "18:00",
            lateThresholdMinutes: 0
        });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching company settings" });
    }
});

router.put("/company/settings", requireTenantAndPermission, async (req: any, res) => {
    try {
        const updateSchema = insertCompanySettingsSchema.omit({
            tenantId: true,
            id: true,
            createdAt: true,
            updatedAt: true
        });
        const input = updateSchema.parse(req.body);
        // Cast input to InsertCompanySettings because upsert expects full schema but we inject tenantId
        // This works because upsert handles the merging
        const settings = await storage.upsertCompanySettings(req.tenantId, input as any);
        res.json(settings);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error(err);
            res.status(500).json({ message: err.message || "Error updating company settings" });
        }
    }
});

router.put("/company", requireTenantAndPermission, async (req: any, res) => {
    try {
        const updateData = insertTenantSchema.partial().parse(req.body);
        const updated = await storage.updateTenant(req.tenantId, updateData);
        res.status(200).json(updated);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error updating company" });
    }
});

// --- Branches (Offices) ---
router.get("/branches", requireTenant, async (req: any, res) => {
    try {
        const branches = await storage.getBranches(req.tenantId);
        res.json(branches);
    } catch (err: any) {
        console.error("Fetch branches error:", err);
        res.status(500).json({ message: err.message || "Error fetching branches" });
    }
});

router.post("/branches", requireTenantAndPermission, async (req: any, res) => {
    try {
        const data = insertBranchSchema.parse(req.body);
        const branch = await storage.createBranch({
            ...data,
            tenantId: req.tenantId,
        });
        res.status(201).json(branch);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error("Create branch error:", err);
            res.status(500).json({ message: err.message || "Error creating branch" });
        }
    }
});

router.put("/branches/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const data = insertBranchSchema.partial().parse(req.body);
        const branch = await storage.updateBranch(req.params.id, data);
        res.json(branch);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error("Update branch error:", err);
            res.status(500).json({ message: err.message || "Error updating branch" });
        }
    }
});

router.delete("/branches/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        await storage.deleteBranch(req.params.id);
        res.status(204).send();
    } catch (err: any) {
        console.error("Delete branch error:", err);
        res.status(500).json({ message: err.message || "Error deleting branch" });
    }
});

// --- QPay Settings ---
router.get("/qpay/settings", requireTenant, async (req: any, res) => {
    try {
        const settings = await storage.getQPaySettings(req.tenantId);
        if (!settings) {
            return res.json({
                enabled: false,
                mode: "sandbox",
                clientId: null,
                clientSecret: null,
                invoiceCode: null,
                callbackSecret: null,
                webhookUrl: null,
                autoPosting: false,
            });
        }
        // Mask secrets in response
        const response = { ...settings };
        if (response.clientSecret) response.clientSecret = "********";
        if (response.callbackSecret) response.callbackSecret = "********";
        res.json(response);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching QPay settings" });
    }
});

router.put("/qpay/settings", requireTenantAndPermission, async (req: any, res) => {
    try {
        const { clientSecret, callbackSecret, ...rest } = req.body;
        const existing = await storage.getQPaySettings(req.tenantId);

        // Only update secrets if provided (not masked)
        const updateData: any = { ...rest };
        if (clientSecret && clientSecret !== "********") {
            updateData.clientSecret = clientSecret;
        } else if (existing && clientSecret === "********") {
            updateData.clientSecret = existing.clientSecret;
        }

        if (callbackSecret && callbackSecret !== "********") {
            updateData.callbackSecret = callbackSecret;
        } else if (existing && callbackSecret === "********") {
            updateData.callbackSecret = existing.callbackSecret;
        }

        // Generate webhook URL
        const publicBaseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:5000";
        updateData.webhookUrl = `${publicBaseUrl}/api/payments/qpay/webhook`;

        const settings = await storage.updateQPaySettings(req.tenantId, updateData);
        const response = { ...settings };
        if (response.clientSecret) response.clientSecret = "********";
        if (response.callbackSecret) response.callbackSecret = "********";
        res.json(response);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error updating QPay settings" });
    }
});

// --- QPay QR Generation ---
router.post("/qpay/generate-qr", requireTenantAndPermission, async (req: any, res) => {
    try {
        const { invoiceId } = req.body;
        if (!invoiceId) {
            return res.status(400).json({ message: "invoiceId is required" });
        }

        const settings = await storage.getQPaySettings(req.tenantId);
        if (!settings || !settings.enabled) {
            return res.status(400).json({ message: "QPay is not enabled" });
        }

        const invoice = await storage.getInvoice(invoiceId);
        if (!invoice || invoice.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Invoice not found" });
        }

        // Check if QR already exists
        let qpayInvoice = await storage.getQPayInvoiceByInvoiceId(invoiceId);

        if (!qpayInvoice) {
            // Generate callback URL
            const publicBaseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:5000";
            const tenantKey = req.tenantId; // In production, use tenant public key
            const callbackUrl = `${publicBaseUrl}/api/payments/qpay/webhook?t=${tenantKey}&inv=${invoiceId}`;

            // Create QPay service and call API
            // Use dynamic import or move qpay-service to be importable
            const { createQPayService } = await import("../qpay-service");
            const qpayService = await createQPayService(req.tenantId, storage);

            if (!qpayService || !qpayService.isConfigured()) {
                return res.status(400).json({ message: "QPay service is not properly configured" });
            }

            // Call QPay API to create invoice
            const result = await qpayService.createInvoice({
                senderInvoiceNo: invoice.invoiceNumber,
                invoiceDescription: `Invoice ${invoice.invoiceNumber}`,
                amount: parseFloat(invoice.totalAmount.toString()),
                callbackUrl,
            });

            if (!result.success || !result.data) {
                return res.status(500).json({
                    message: result.error || "Failed to create QPay invoice",
                    errorCode: result.errorCode
                });
            }

            // Store QPay invoice in database
            qpayInvoice = await storage.createQPayInvoice({
                tenantId: req.tenantId,
                invoiceId,
                qpayInvoiceId: result.data.invoiceId,
                amount: invoice.totalAmount,
                qrText: result.data.qrText,
                qrImage: result.data.qrImage,
                status: "pending",
                callbackUrl,
            } as any);
        }

        res.json({
            invoiceId: qpayInvoice.qpayInvoiceId,
            qrImage: qpayInvoice.qrImage,
            qrText: qpayInvoice.qrText,
            callbackUrl: qpayInvoice.callbackUrl,
            status: qpayInvoice.status,
        });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error generating QR" });
    }
});

// --- QPay Check Payment Status ---
router.get("/qpay/check-payment/:invoiceId", requireTenant, async (req: any, res) => {
    try {
        const { invoiceId } = req.params;
        const invoice = await storage.getInvoice(invoiceId);

        if (!invoice || invoice.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Invoice not found" });
        }

        const qpayInvoice = await storage.getQPayInvoiceByInvoiceId(invoiceId);
        if (!qpayInvoice || !qpayInvoice.qpayInvoiceId) {
            return res.status(404).json({ message: "QPay invoice not found" });
        }

        const { createQPayService } = await import("../qpay-service");
        const qpayService = await createQPayService(req.tenantId, storage);

        if (!qpayService || !qpayService.isConfigured()) {
            return res.status(400).json({ message: "QPay service is not properly configured" });
        }

        const result = await qpayService.checkPaymentStatus({
            objectType: "INVOICE",
            objectId: qpayInvoice.qpayInvoiceId,
        });

        if (!result.success) {
            return res.status(500).json({
                message: result.error || "Failed to check payment status",
                errorCode: result.errorCode
            });
        }

        res.json({
            count: result.data?.count || 0,
            paidAmount: result.data?.paidAmount || 0,
            payments: result.data?.rows || [],
        });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error checking payment status" });
    }
});

// --- RBAC: Roles ---
router.get("/roles", requireTenant, async (req: any, res) => {
    try {
        const roles = await storage.getRoles(req.tenantId);
        res.json(roles);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching roles" });
    }
});

router.get("/roles/:id", requireTenant, async (req: any, res) => {
    try {
        const role = await storage.getRole(req.tenantId, req.params.id);
        if (!role || role.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Role not found" });
        }
        const rolePermissions = await storage.getRolePermissions(role.id);
        res.json({ ...role, permissions: rolePermissions });
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching role" });
    }
});

router.post("/roles", requireTenantAndPermission, async (req: any, res) => {
    try {
        const roleSchema = z.object({
            name: z.string().min(1, "Role name is required"),
            description: z.string().optional(),
            isSystem: z.boolean().optional().default(false),
        });
        const data = roleSchema.parse(req.body);
        const role = await storage.createRole(req.tenantId, {
            ...data,
            tenantId: req.tenantId,
        } as any, []);

        // Audit log
        logRBACEvent({
            type: "role.create",
            userId: req.user.id,
            tenantId: req.tenantId,
            details: {
                roleId: role.id,
                roleName: role.name,
            },
        });

        res.status(201).json(role);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error(err);
            res.status(500).json({ message: err.message || "Error creating role" });
        }
    }
});

router.put("/roles/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const role = await storage.getRole(req.tenantId, req.params.id);
        if (!role || role.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Role not found" });
        }
        if (role.isSystem) {
            return res.status(403).json({ message: "Cannot modify system role" });
        }
        const roleSchema = z.object({
            name: z.string().min(1).optional(),
            description: z.string().optional(),
        });
        const data = roleSchema.parse(req.body);
        const updated = await storage.updateRole(req.params.id, data);
        res.json(updated);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error(err);
            res.status(500).json({ message: err.message || "Error updating role" });
        }
    }
});

router.delete("/roles/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const role = await storage.getRole(req.tenantId, req.params.id);
        if (!role || role.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Role not found" });
        }
        if (role.isSystem) {
            return res.status(403).json({ message: "Cannot delete system role" });
        }
        await storage.deleteRole(req.tenantId, req.params.id);
        res.status(204).send();
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error deleting role" });
    }
});

// --- RBAC: Permissions ---
router.get("/permissions", requireTenant, async (req: any, res) => {
    try {
        const permissions = await storage.getPermissions();
        res.json(permissions);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching permissions" });
    }
});

// --- RBAC: Role Permissions ---
router.get("/roles/:id/permissions", requireTenant, async (req: any, res) => {
    try {
        const role = await storage.getRole(req.tenantId, req.params.id);
        if (!role || role.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Role not found" });
        }
        const permissions = await storage.getRolePermissions(req.params.id);
        res.json(permissions);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching role permissions" });
    }
});

router.post("/roles/:id/permissions", requireTenantAndPermission, async (req: any, res) => {
    try {
        const role = await storage.getRole(req.tenantId, req.params.id);
        if (!role || role.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Role not found" });
        }
        const permissionSchema = z.object({
            permissionId: z.string().uuid("Invalid permission ID"),
        });
        const { permissionId } = permissionSchema.parse(req.body);
        await storage.assignPermissionToRole(req.params.id, permissionId);

        // Get permission details for audit
        const permission = await storage.getPermission(permissionId);

        // Audit log
        logRBACEvent({
            type: "permission.assign",
            userId: req.user.id,
            tenantId: req.tenantId,
            details: {
                roleId: role.id,
                roleName: role.name,
                permissionId,
                permissionResource: permission?.resource,
                permissionAction: permission?.action,
            },
        });

        res.status(201).json({ message: "Permission assigned" });
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error(err);
            res.status(500).json({ message: err.message || "Error assigning permission" });
        }
    }
});

router.delete("/roles/:id/permissions/:permissionId", requireTenantAndPermission, async (req: any, res) => {
    try {
        const role = await storage.getRole(req.tenantId, req.params.id);
        if (!role || role.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Role not found" });
        }
        await storage.removePermissionFromRole(req.params.id, req.params.permissionId);
        res.status(204).send();
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error removing permission" });
    }
});

// --- Users ---
router.get("/tenant-users", requireTenant, async (req: any, res) => {
    try {
        const users = await storage.getUsers(req.tenantId);
        // Return sanitized list for directory usage
        const directory = users.map((u: any) => ({
            id: u.id,
            email: u.email,
            username: u.username,
            fullName: u.fullName,
            role: u.role,
            status: u.status,
            createdAt: u.createdAt,
            tenantId: u.tenantId,
            // Exclude passwordHash and other sensitive fields
        }));
        res.json(directory);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching tenant users" });
    }
});

router.get("/users", requireTenant, async (req: any, res) => {
    try {
        const users = await storage.getUsers(req.tenantId);
        res.json(users);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching users" });
    }
});

router.post("/users", requireTenantAndPermission, async (req: any, res) => {
    try {
        const { email, password, fullName } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required" });
        }

        // Check if user already exists
        const existingUser = await storage.getUserByUsername(email);
        if (existingUser) {
            return res.status(400).json({ message: "User with this email already exists" });
        }

        // Validate password strength
        const { validatePasswordStrength } = await import("../security");
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.valid) {
            return res.status(400).json({ message: passwordValidation.message });
        }

        // Hash password
        const { hashPassword } = await import("../auth");
        const hashedPassword = await hashPassword(password);

        // Create user
        const user = await storage.createUser({
            tenantId: req.tenantId,
            email,
            passwordHash: hashedPassword,
            fullName: fullName || email,
            isActive: true,
        });

        res.status(201).json(user);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error creating user" });
    }
});

// --- RBAC: User Roles ---
router.get("/users/:id/roles", requireTenant, async (req: any, res) => {
    try {
        const user = await storage.getUser(req.params.id);
        if (!user || user.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "User not found" });
        }
        const roles = await storage.getUserRoles(req.params.id);
        res.json(roles);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching user roles" });
    }
});

router.get("/users/:id/permissions", requireTenant, async (req: any, res) => {
    try {
        const user = await storage.getUser(req.params.id);
        if (!user || user.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "User not found" });
        }
        const permissions = await storage.getUserPermissions(req.params.id);
        res.json(permissions);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching user permissions" });
    }
});

router.post("/users/:id/roles", requireTenantAndPermission, async (req: any, res) => {
    try {
        const user = await storage.getUser(req.params.id);
        if (!user || user.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "User not found" });
        }
        const roleSchema = z.object({
            roleId: z.string().uuid("Invalid role ID"),
        });
        const { roleId } = roleSchema.parse(req.body);
        const role = await storage.getRole(req.tenantId, roleId);
        if (!role || role.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Role not found" });
        }
        await storage.assignRoleToUser(req.params.id, roleId);
        res.status(201).json({ message: "Role assigned" });
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error(err);
            res.status(500).json({ message: err.message || "Error assigning role" });
        }
    }
});

router.delete("/users/:id/roles/:roleId", requireTenantAndPermission, async (req: any, res) => {
    try {
        const user = await storage.getUser(req.params.id);
        if (!user || user.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "User not found" });
        }
        await storage.removeRoleFromUser(req.params.id, req.params.roleId);
        res.status(204).send();
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error removing role" });
    }
});

// --- Audit Log ---
router.get("/audit-logs", requireTenant, async (req: any, res) => {
    try {
        const filters: any = {};

        if (req.query.entityType) filters.entityType = req.query.entityType;
        if (req.query.entityId) filters.entityId = req.query.entityId;
        if (req.query.action) filters.action = req.query.action;
        if (req.query.startDate) filters.startDate = new Date(req.query.startDate);
        if (req.query.endDate) filters.endDate = new Date(req.query.endDate);
        if (req.query.limit) filters.limit = parseInt(req.query.limit, 10);

        const logs = await storage.getAuditLogs(req.tenantId, Object.keys(filters).length > 0 ? filters : undefined);
        res.json(logs);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching audit logs" });
    }
});

export default router;
