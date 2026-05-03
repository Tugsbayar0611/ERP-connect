/**
 * BIOMETRIC WEBHOOK & DEVICE MANAGEMENT API
 * ==========================================
 * 
 * POST /api/biometric/event          - Царай уншигч төхөөрөмж event явуулна (Bearer token auth)
 * GET  /api/biometric/devices        - Бүх төхөөрөмжийн жагсаалт (Admin)
 * POST /api/biometric/devices        - Шинэ төхөөрөмж нэмэх (Admin)
 * DELETE /api/biometric/devices/:id  - Төхөөрөмж устгах (Admin)
 * GET  /api/biometric/events         - Бүх событийн лог (Admin)
 * GET  /api/biometric/boarding/:tripId - Тухайн аялалын суух/буух бүртгэл
 */

import { Router } from "express";
import { db } from "../db";
import {
    biometricDevices, biometricEvents, busBoardingLogs,
    employees, attendanceDays, seatReservations, trips,
    type InsertBiometricEvent, type InsertBusBoardingLog
} from "@shared/schema";
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { storage } from "../storage";
import { requireTenant } from "../middleware";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

// ─────────────────────────────────────────────────────────────────
// MIDDLEWARE: Биометрийн токен шалгах (Device → ERP)
// ─────────────────────────────────────────────────────────────────
async function requireDeviceToken(req: any, res: any, next: any) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Device token required" });
    }
    const token = authHeader.slice(7).trim();

    const [device] = await db
        .select()
        .from(biometricDevices)
        .where(and(eq(biometricDevices.apiToken, token), eq(biometricDevices.isActive, true)))
        .limit(1);

    if (!device) {
        return res.status(401).json({ message: "Invalid or inactive device token" });
    }

    // Сүүлд харагдсан цагийг шинэчил
    await db.update(biometricDevices)
        .set({ lastSeenAt: new Date() })
        .where(eq(biometricDevices.id, device.id));

    req.biometricDevice = device;
    req.tenantId = device.tenantId;
    next();
}

// ─────────────────────────────────────────────────────────────────
// CORE PROCESSOR: Event хүлээж аваад ирц/хоолны данс шинэчлэх
// ─────────────────────────────────────────────────────────────────
async function processBiometricEvent(
    event: { id: string; tenantId: string; employeeId: string | null; eventType: string; scannedAt: Date; deviceId: string; rawPayload: any }
): Promise<{ result: string; error?: string }> {

    if (!event.employeeId) {
        return { result: "unknown_employee" };
    }

    const tenantId = event.tenantId;
    const employeeId = event.employeeId;
    const scannedAt = event.scannedAt;
    const workDate = scannedAt.toISOString().split("T")[0];

    try {
        switch (event.eventType) {
            // ─── ГАРЦЫН ЦАРАЙ УНШИГЧ ───
            case "check_in": {
                // Ирцийн бүртгэл: Upsert (байвал шинэчил, байхгүй бол үүсгэ)
                const existing = await db.select()
                    .from(attendanceDays)
                    .where(and(
                        eq(attendanceDays.tenantId, tenantId),
                        eq(attendanceDays.employeeId, employeeId),
                        eq(attendanceDays.workDate, workDate)
                    ))
                    .limit(1);

                if (existing.length === 0) {
                    // Ирцийн Roster-аас ээлж мэдээлэл авч хоцролт тооцно
                    const lateMinutes = await calculateLateMinutes(tenantId, employeeId, workDate, scannedAt);
                    const status = lateMinutes > 0 ? "late" : "present";

                    await db.insert(attendanceDays).values({
                        tenantId,
                        employeeId,
                        workDate,
                        checkIn: scannedAt,
                        status,
                        note: lateMinutes > 0 ? `${lateMinutes} минут хоцорсон` : undefined,
                    });
                }
                // Хэрэв аль хэдийн check_in бичигдсэн бол дахин бичихгүй (идемпотент)
                return { result: "success" };
            }

            case "check_out": {
                const existing = await db.select()
                    .from(attendanceDays)
                    .where(and(
                        eq(attendanceDays.tenantId, tenantId),
                        eq(attendanceDays.employeeId, employeeId),
                        eq(attendanceDays.workDate, workDate)
                    ))
                    .limit(1);

                if (existing.length > 0) {
                    const record = existing[0];
                    const checkIn = record.checkIn ? new Date(record.checkIn) : scannedAt;
                    const minutesWorked = Math.floor((scannedAt.getTime() - checkIn.getTime()) / 60000);
                    const overtimeMinutes = await calculateOvertimeMinutes(tenantId, employeeId, workDate, minutesWorked);

                    await db.update(attendanceDays)
                        .set({
                            checkOut: scannedAt,
                            minutesWorked,
                            updatedAt: new Date(),
                            note: [record.note, overtimeMinutes > 0 ? `${overtimeMinutes} мин илүү цаг` : ""]
                                .filter(Boolean).join(" | ") || null
                        })
                        .where(eq(attendanceDays.id, record.id));
                }
                return { result: "success" };
            }

            // ─── АВТОБУСНЫ ЦАРАЙ УНШИГЧ ───
            case "bus_board": {
                return await processBusCheckpoint(tenantId, employeeId, event.deviceId, "boarded", scannedAt, event.id);
            }

            case "camp_arrive": {
                return await processBusCheckpoint(tenantId, employeeId, event.deviceId, "arrived_camp", scannedAt, event.id, true);
            }

            case "bus_depart": {
                return await processBusCheckpoint(tenantId, employeeId, event.deviceId, "departed_camp", scannedAt, event.id);
            }

            case "returned_city": {
                return await processBusCheckpoint(tenantId, employeeId, event.deviceId, "returned_city", scannedAt, event.id);
            }

            default:
                return { result: "success" }; // Unknown event type, just log it
        }
    } catch (err: any) {
        return { result: "error", error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────
// Автобусны checkpoint боловсруулагч
// ─────────────────────────────────────────────────────────────────
async function processBusCheckpoint(
    tenantId: string,
    employeeId: string,
    deviceId: string,
    checkpointType: string,
    scannedAt: Date,
    biometricEventId: string,
    /** Кэмпэд очих үед хоолны данс автоматаар нэмэх эсэх */
    autoTopUpMeal = false
): Promise<{ result: string; error?: string }> {

    // Энэ төхөөрөмжийн vehicle-ийг ол
    const [device] = await db.select()
        .from(biometricDevices)
        .where(eq(biometricDevices.id, deviceId))
        .limit(1);

    if (!device?.vehicleId) {
        return { result: "error", error: "Device not linked to any vehicle" };
    }

    // Энэ ажилтны өнөөдрийн захиалгатай аялал ол
    const today = scannedAt.toISOString().split("T")[0];
    const todayStart = new Date(today + "T00:00:00.000Z");
    const todayEnd = new Date(today + "T23:59:59.999Z");

    // Тухайн vehicle-ийн өнөөдрийн аялал ол
    const [trip] = await db.select()
        .from(trips)
        .where(and(
            eq(trips.tenantId, tenantId),
            eq(trips.vehicleId, device.vehicleId),
            gte(trips.departureTime, todayStart),
            sql`${trips.departureTime} <= ${todayEnd}`
        ))
        .orderBy(desc(trips.departureTime))
        .limit(1);

    if (!trip) {
        return { result: "error", error: "No trip found for this device today" };
    }

    // Суудал захиалгатай эсэхийг шалга
    const [reservation] = await db.select()
        .from(seatReservations)
        .where(and(
            eq(seatReservations.tripId, trip.id),
            eq(seatReservations.passengerId, employeeId),
            eq(seatReservations.status, "confirmed")
        ))
        .limit(1);

    // Суудал захиалаагүй бол мэдэгдэл буцаа (яаралтай чухал алдаа биш, зүгээр бүртгэнэ)
    const logData: InsertBusBoardingLog = {
        tenantId,
        tripId: trip.id,
        reservationId: reservation?.id ?? null,
        employeeId,
        biometricEventId,
        checkpointType,
        scannedAt,
        deviceId,
    };

    let mealTopUpTxId: string | undefined;

    // Кэмпэд очих үед хоолны данс автоматаар нэмэх
    if (autoTopUpMeal) {
        const mealTopUpAmount = await getMealTopUpAmount(tenantId);
        if (mealTopUpAmount > 0) {
            try {
                // Ажилтны wallet олох/үүсгэх
                const wallet = await storage.getCanteenWallet(tenantId, employeeId);
                const tx = await storage.topUpWallet({
                    tenantId,
                    walletId: wallet.id,
                    amount: mealTopUpAmount,
                    type: "credit",
                    referenceType: "bus_arrival",
                    referenceId: trip.id,
                    description: `Автобусаар кэмпэд хүрэлцэн ирсэн тул хоолны мөнгө нэмэгдлээ (Аялал: ${trip.id.slice(0, 8)})`,
                    actorId: "system"
                });
                mealTopUpTxId = tx.id;
                logData.mealTopUpAmount = String(mealTopUpAmount);
                logData.mealTopUpAt = new Date();
                logData.mealTopUpTxId = mealTopUpTxId;
            } catch (topupErr: any) {
                console.error("Meal top-up failed:", topupErr.message);
                // Топ-ап амжилтгүй болсон ч boarding log-ийг бичнэ
            }
        }
    }

    // Bus boarding log бичих (idempotent - давхардахгүй)
    await db.insert(busBoardingLogs)
        .values(logData)
        .onConflictDoNothing(); // unqCheckpoint index давхардал гарвал алгасах

    return { result: "success" };
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Roster-оос хоцролтын минут тооцоолох
// ─────────────────────────────────────────────────────────────────
async function calculateLateMinutes(
    tenantId: string,
    employeeId: string,
    workDate: string,
    checkIn: Date
): Promise<number> {
    try {
        // Компанийн тохиргооноос ажлын эхлэх цагийг авах
        const settings = await storage.getCompanySettings(tenantId);
        const workStartTime = settings?.workStartTime || "08:00";
        const [hours, minutes] = workStartTime.split(":").map(Number);

        const expectedStart = new Date(workDate + "T00:00:00.000Z");
        expectedStart.setUTCHours(hours, minutes, 0, 0);

        const lateMs = checkIn.getTime() - expectedStart.getTime();
        return lateMs > 0 ? Math.floor(lateMs / 60000) : 0;
    } catch {
        return 0;
    }
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Roster-оос илүү цагийн минут тооцоолох
// ─────────────────────────────────────────────────────────────────
async function calculateOvertimeMinutes(
    tenantId: string,
    employeeId: string,
    workDate: string,
    minutesWorked: number
): Promise<number> {
    try {
        const settings = await storage.getCompanySettings(tenantId);
        const workStartTime = settings?.workStartTime || "08:00";
        const workEndTime = settings?.workEndTime || "17:00";

        const [startH, startM] = workStartTime.split(":").map(Number);
        const [endH, endM] = workEndTime.split(":").map(Number);
        const expectedMinutes = (endH * 60 + endM) - (startH * 60 + startM);

        return minutesWorked > expectedMinutes ? minutesWorked - expectedMinutes : 0;
    } catch {
        return 0;
    }
}

// ─────────────────────────────────────────────────────────────────
// HELPER: Хоолны мөнгөний дүн авах (тохиргооноос)
// ─────────────────────────────────────────────────────────────────
async function getMealTopUpAmount(tenantId: string): Promise<number> {
    try {
        const settings = await storage.getCompanySettings(tenantId);
        // CompanySettings-д meal_allowance_per_trip талбар нэмж болно
        // Одоогоор default 15,000₮ ашиглана
        return (settings as any)?.mealAllowancePerTrip ?? 15000;
    } catch {
        return 15000;
    }
}

// ══════════════════════════════════════════════════════════════════
// ROUTE 1: Төхөөрөмжөөс event хүлээж авах (Public - device token auth)
// POST /api/biometric/event
// ══════════════════════════════════════════════════════════════════
const eventSchema = z.object({
    /** Гадаад системийн (ZKTeco, гэх мэт) ажилтны ID */
    externalId: z.string().optional(),
    /** ERP-ийн employeeId (хэрэв мэддэг бол) */
    employeeId: z.string().uuid().optional(),
    eventType: z.enum(["check_in", "check_out", "bus_board", "camp_arrive", "bus_depart", "returned_city"]),
    /** Яг уншуулсан цаг (ISO 8601). Байхгүй бол серверийн цагийг ашиглана */
    scannedAt: z.string().optional(),
    photoUrl: z.string().url().optional(),
    /** Нэмэлт мэдээлэл хадгалах */
    extra: z.record(z.any()).optional(),
});

router.post("/event", requireDeviceToken, async (req: any, res) => {
    const device = req.biometricDevice;

    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
    }

    const { externalId, employeeId: bodyEmployeeId, eventType, scannedAt: rawTime, photoUrl, extra } = parsed.data;
    const scannedAt = rawTime ? new Date(rawTime) : new Date();

    if (isNaN(scannedAt.getTime())) {
        return res.status(400).json({ message: "Invalid scannedAt datetime" });
    }

    // ExternalId → ERP ажилтан хайх
    let resolvedEmployeeId: string | null = bodyEmployeeId ?? null;
    if (!resolvedEmployeeId && externalId) {
        // employees хүснэгтийн employeeNo талбараар хайх
        const [emp] = await db.select({ id: employees.id })
            .from(employees)
            .where(and(eq(employees.tenantId, device.tenantId), eq(employees.employeeNo, externalId)))
            .limit(1);
        resolvedEmployeeId = emp?.id ?? null;
    }

    // Event бичих
    const [savedEvent] = await db.insert(biometricEvents).values({
        tenantId: device.tenantId,
        deviceId: device.id,
        employeeId: resolvedEmployeeId,
        externalId: externalId ?? null,
        eventType,
        scannedAt,
        photoUrl: photoUrl ?? null,
        rawPayload: { ...extra, body: req.body },
        processResult: "pending",
    }).returning();

    // Async боловсруулалт (Response-ийг хүлээлгэхгүй)
    processBiometricEvent({
        id: savedEvent.id,
        tenantId: device.tenantId,
        employeeId: resolvedEmployeeId,
        eventType,
        scannedAt,
        deviceId: device.id,
        rawPayload: req.body,
    }).then(async ({ result, error }) => {
        await db.update(biometricEvents)
            .set({ processedAt: new Date(), processResult: result, processError: error ?? null })
            .where(eq(biometricEvents.id, savedEvent.id));
    }).catch(err => {
        console.error("Biometric event processing error:", err);
    });

    // Төхөөрөмжид хурдан хариу өгөх (300ms доторх)
    res.status(200).json({
        received: true,
        eventId: savedEvent.id,
        employeeFound: !!resolvedEmployeeId,
        message: resolvedEmployeeId ? "Event received and queued for processing" : "Event received but employee not found"
    });
});

// ══════════════════════════════════════════════════════════════════
// ROUTE 2: Төхөөрөмжийн удирдлага (Admin only)
// GET /api/biometric/devices
// ══════════════════════════════════════════════════════════════════
router.get("/devices", requireTenant, async (req: any, res) => {
    const devices = await db.select()
        .from(biometricDevices)
        .where(eq(biometricDevices.tenantId, req.tenantId))
        .orderBy(biometricDevices.name);
    res.json(devices);
});

router.post("/devices", requireTenant, async (req: any, res) => {
    const { name, location, deviceType, vehicleId } = req.body;
    if (!name || !location || !deviceType) {
        return res.status(400).json({ message: "name, location, deviceType шаардлагатай" });
    }

    // Автоматаар apiToken үүсгэх
    const apiToken = crypto.randomBytes(32).toString("hex");

    const [device] = await db.insert(biometricDevices).values({
        tenantId: req.tenantId,
        name,
        location,
        deviceType,
        vehicleId: vehicleId || null,
        apiToken,
    }).returning();

    res.status(201).json(device);
});

router.patch("/devices/:id", requireTenant, async (req: any, res) => {
    const { name, location, deviceType, vehicleId, isActive } = req.body;
    const [updated] = await db.update(biometricDevices)
        .set({
            ...(name && { name }),
            ...(location && { location }),
            ...(deviceType && { deviceType }),
            vehicleId: vehicleId !== undefined ? vehicleId : undefined,
            ...(isActive !== undefined && { isActive }),
        })
        .where(and(
            eq(biometricDevices.id, req.params.id),
            eq(biometricDevices.tenantId, req.tenantId)
        ))
        .returning();

    if (!updated) return res.status(404).json({ message: "Device not found" });
    res.json(updated);
});

router.delete("/devices/:id", requireTenant, async (req: any, res) => {
    await db.delete(biometricDevices).where(and(
        eq(biometricDevices.id, req.params.id),
        eq(biometricDevices.tenantId, req.tenantId)
    ));
    res.sendStatus(204);
});

// Token regenerate
router.post("/devices/:id/rotate-token", requireTenant, async (req: any, res) => {
    const newToken = crypto.randomBytes(32).toString("hex");
    const [updated] = await db.update(biometricDevices)
        .set({ apiToken: newToken })
        .where(and(
            eq(biometricDevices.id, req.params.id),
            eq(biometricDevices.tenantId, req.tenantId)
        ))
        .returning();

    if (!updated) return res.status(404).json({ message: "Device not found" });
    res.json({ apiToken: newToken });
});

// ══════════════════════════════════════════════════════════════════
// ROUTE 3: Event лог харах (Admin)
// GET /api/biometric/events?deviceId=&employeeId=&limit=50
// ══════════════════════════════════════════════════════════════════
router.get("/events", requireTenant, async (req: any, res) => {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const { deviceId, employeeId } = req.query;

    const conditions = [eq(biometricEvents.tenantId, req.tenantId)];
    if (deviceId) conditions.push(eq(biometricEvents.deviceId, deviceId as string));
    if (employeeId) conditions.push(eq(biometricEvents.employeeId, employeeId as string));

    const events = await db.select()
        .from(biometricEvents)
        .where(and(...conditions))
        .orderBy(desc(biometricEvents.scannedAt))
        .limit(limit);

    res.json(events);
});

// ══════════════════════════════════════════════════════════════════
// ROUTE 4: Тухайн аялалын boarding жагсаалт
// GET /api/biometric/boarding/:tripId
// ══════════════════════════════════════════════════════════════════
router.get("/boarding/:tripId", requireTenant, async (req: any, res) => {
    const logs = await db.select({
        id: busBoardingLogs.id,
        employeeId: busBoardingLogs.employeeId,
        checkpointType: busBoardingLogs.checkpointType,
        scannedAt: busBoardingLogs.scannedAt,
        mealTopUpAmount: busBoardingLogs.mealTopUpAmount,
        mealTopUpAt: busBoardingLogs.mealTopUpAt,
        reservationId: busBoardingLogs.reservationId,
        firstName: employees.firstName,
        lastName: employees.lastName,
    })
        .from(busBoardingLogs)
        .leftJoin(employees, eq(busBoardingLogs.employeeId, employees.id))
        .where(and(
            eq(busBoardingLogs.tenantId, req.tenantId),
            eq(busBoardingLogs.tripId, req.params.tripId)
        ))
        .orderBy(busBoardingLogs.scannedAt);

    res.json(logs);
});

export default router;
