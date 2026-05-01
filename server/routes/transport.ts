
import { Router } from "express";
import { storage } from "../storage";
import { requireTenant } from "../middleware";
import { insertVehicleSchema, insertRouteSchema, insertTripSchema, insertSeatReservationSchema } from "@shared/schema";
import { z } from "zod";

const router = Router();

// --- VEHICLES ---
router.get("/vehicles", requireTenant, async (req: any, res) => {
    try {
        const vehicles = await storage.getVehicles(req.tenantId);
        res.json(vehicles);
    } catch (e) {
        res.status(500).json({ message: "Failed to fetch vehicles" });
    }
});

router.post("/vehicles", requireTenant, async (req: any, res) => {
    try {
        const data = insertVehicleSchema.parse({ ...req.body, tenantId: req.tenantId });
        const vehicle = await storage.createVehicle(data);
        res.status(201).json(vehicle);
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return res.status(400).json({ message: "Validation error", errors: e.errors });
        }
        res.status(500).json({ message: "Failed to create vehicle" });
    }
});

router.delete("/vehicles/:id", requireTenant, async (req: any, res) => {
    try {
        await storage.deleteVehicle(req.params.id);
        res.sendStatus(204);
    } catch (e) {
        res.status(500).json({ message: "Failed to delete vehicle" });
    }
});

// --- ROUTES ---
router.get("/routes", requireTenant, async (req: any, res) => {
    try {
        const routes = await storage.getRoutes(req.tenantId);
        res.json(routes);
    } catch (e) {
        res.status(500).json({ message: "Failed to fetch routes" });
    }
});

router.post("/routes", requireTenant, async (req: any, res) => {
    try {
        const data = insertRouteSchema.parse({ ...req.body, tenantId: req.tenantId });
        const route = await storage.createRoute(data);
        res.status(201).json(route);
    } catch (e: any) {
        if (e instanceof z.ZodError) {
            return res.status(400).json({ message: "Validation error", errors: e.errors });
        }
        res.status(500).json({ message: "Failed to create route" });
    }
});

router.delete("/routes/:id", requireTenant, async (req: any, res) => {
    try {
        await storage.deleteRoute(req.params.id);
        res.sendStatus(204);
    } catch (e) {
        res.status(500).json({ message: "Failed to delete route" });
    }
});

// --- TRIPS ---
router.get("/trips", requireTenant, async (req: any, res) => {
    try {
        const fromDate = req.query.from ? new Date(req.query.from) : undefined;
        const trips = await storage.getTrips(req.tenantId, fromDate);

        // Enrich with route and vehicle info if needed (or do it in frontend / storage join)
        // For now returning raw trips
        // TODO: join with routes and vehicles

        res.json(trips);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch trips" });
    }
});

router.post("/trips", requireTenant, async (req: any, res) => {
    try {
        const data = insertTripSchema.parse({
            ...req.body,
            tenantId: req.tenantId,
            departureTime: new Date(req.body.departureTime) // Ensure date parsing
        });
        const trip = await storage.createTrip(data);
        await storage.createAuditLog({
            tenantId: req.tenantId,
            actorId: req.user.id,
            entity: "trip",
            entityId: trip.id,
            action: "create",
            ipAddress: req.ip,
            message: `Scheduled trip for route ${data.routeId} at ${data.departureTime}`
        });
        res.status(201).json(trip);
    } catch (e: any) {
        if (e.code === '23505') { // Unique violation
            return res.status(409).json({ message: "Trip already exists for this vehicle/route/time" });
        }
        if (e instanceof z.ZodError) {
            return res.status(400).json({ message: "Validation error", errors: e.errors });
        }
        console.error(e);
        res.status(500).json({ message: "Failed to create trip" });
    }
});


// --- RESERVATIONS ---
router.get("/trips/:id/seats", requireTenant, async (req: any, res) => {
    try {
        const reservations = await storage.getTripReservations(req.params.id);
        const activeReservations = reservations.filter((r: any) => r.status !== 'cancelled');
        
        // Find current user's employee ID so frontend can know which seats belong to them
        const employee = await storage.getEmployeeByUserId(req.user.id);
        
        res.json({
            reservations: activeReservations,
            currentEmployeeId: employee?.id || null
        });
    } catch (e) {
        res.status(500).json({ message: "Failed to fetch seat availability" });
    }
});

router.get("/trips/:id/manifest", requireTenant, async (req: any, res) => {
    try {
        const reservations = await storage.getTripReservations(req.params.id);
        const active = reservations.filter((r: any) => r.status !== 'cancelled');

        // Enrich with passenger details
        // In a real DB, this would be a JOIN. Here we might need loop or storage optimization.
        const manifest = await Promise.all(active.map(async (r: any) => {
            const passenger = await storage.getEmployee(r.passengerId);
            const userId = passenger?.userId;
            const user = userId ? await storage.getUser(userId) : null;
            return {
                seatNumber: r.seatNumber,
                passengerName: user?.fullName || "Unknown",
                passengerPhone: passenger?.phone || "-",
                passengerId: r.passengerId,
                status: r.status
            };
        }));

        res.json(manifest.sort((a, b) => a.seatNumber.localeCompare(b.seatNumber)));
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch manifest" });
    }
});

router.patch("/trips/:id", requireTenant, async (req: any, res) => {
    try {
        const trip = await storage.getTrips(req.tenantId); // optimize later to getTrip(id)
        const targetTrip = trip.find((t: any) => t.id === req.params.id);

        if (!targetTrip) return res.status(404).json({ message: "Trip not found" });

        const updated = await storage.updateTrip(req.params.id, req.body);

        await storage.createAuditLog({
            tenantId: req.tenantId,
            actorId: req.user.id,
            entity: "trip",
            entityId: req.params.id,
            action: "update",
            ipAddress: req.ip,
            message: `Updated trip status to ${req.body.status}`
        });

        res.json(updated);
    } catch (e) {
        res.status(500).json({ message: "Failed to update trip" });
    }
});

router.post("/reservations", requireTenant, async (req: any, res) => {
    try {
        const { tripId, seatNumber } = req.body;
        // Check if employee
        // Ideally we get employeeId from user context or DB lookup
        const employee = await storage.getEmployeeByUserId(req.user.id);
        if (!employee) return res.status(400).json({ message: "Only employees can book seats" });

        const data = insertSeatReservationSchema.parse({
            tenantId: req.tenantId,
            tripId,
            seatNumber,
            passengerId: employee.id,
            status: "confirmed"
        });

        const reservation = await storage.createSeatReservation(data);

        // Audit Log
        await storage.createAuditLog({
            tenantId: req.tenantId,
            actorId: req.user.id,
            entity: "seat_reservation",
            entityId: reservation.id,
            action: "create",
            ipAddress: req.ip,
            message: `Booked seat ${seatNumber} on trip ${tripId}`
        });

        res.status(201).json(reservation);
    } catch (e: any) {
        if (e.code === '23505') {
            return res.status(409).json({ message: "Уучлаарай, тус суудал захиалгатай эсвэл та энэ аялалд аль хэдийн бүртгэлтэй байна." });
        }
        if (e instanceof z.ZodError) {
            return res.status(400).json({ message: "Validation error", errors: e.errors });
        }
        console.error(e);
        res.status(500).json({ message: "Failed to book seat" });
    }
});

router.post("/reservations/:id/cancel", requireTenant, async (req: any, res) => {
    try {
        const reservationId = req.params.id;
        const reservation = await storage.getSeatReservation(reservationId);
        if (!reservation) return res.status(404).json({ message: "Reservation not found" });

        // Check if user owns reservation (or is admin) - skipping for now as per previous logic

        // Cancellation Policy: 2 hours before departure
        const trips = await storage.getTrips(req.tenantId);
        const trip = trips.find((t: any) => t.id === reservation.tripId);

        if (trip) {
            const departureTime = new Date(trip.departureTime);
            const now = new Date();
            const hoursDiff = (departureTime.getTime() - now.getTime()) / (1000 * 60 * 60);
            if (hoursDiff < 2) {
                return res.status(400).json({ message: "Цуцлах хугацаа хэтэрсэн байна (Хөдлөхөөс 2 цагийн өмнө цуцлах шаардлагатай)" });
            }
        }

        await storage.cancelSeatReservation(reservationId);

        await storage.createAuditLog({
            tenantId: req.tenantId,
            actorId: req.user.id,
            entity: "seat_reservation",
            entityId: reservationId,
            action: "cancel",
            ipAddress: req.ip,
            message: `Cancelled reservation ${reservationId}`
        });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ message: "Failed to cancel reservation" });
    }
});

export default router;
