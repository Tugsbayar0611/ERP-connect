
import {
    vehicles, routes, trips, seatReservations,
    type Vehicle, type InsertVehicle,
    type Route, type InsertRoute,
    type Trip, type InsertTrip,
    type SeatReservation, type InsertSeatReservation
} from "@shared/schema";
import { db } from "../db";
import { eq, and, desc, asc, sql, gte } from "drizzle-orm"; // Added gte
import { FinanceStorage } from "./finance";

export class TransportStorage extends FinanceStorage {
    // --- Vehicles ---
    async getVehicles(tenantId: string): Promise<Vehicle[]> {
        return await db.select().from(vehicles).where(eq(vehicles.tenantId, tenantId)).orderBy(asc(vehicles.name));
    }

    async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
        const [newVehicle] = await db.insert(vehicles).values(vehicle).returning();
        return newVehicle;
    }

    async updateVehicle(id: string, update: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
        const [updated] = await db.update(vehicles).set({ ...update, updatedAt: new Date() }).where(eq(vehicles.id, id)).returning();
        return updated;
    }

    async deleteVehicle(id: string): Promise<void> {
        await db.delete(vehicles).where(eq(vehicles.id, id));
    }

    // --- Routes ---
    async getRoutes(tenantId: string): Promise<Route[]> {
        return await db.select().from(routes).where(eq(routes.tenantId, tenantId)).orderBy(asc(routes.name));
    }

    async createRoute(route: InsertRoute): Promise<Route> {
        const [newRoute] = await db.insert(routes).values(route).returning();
        return newRoute;
    }

    async updateRoute(id: string, update: Partial<InsertRoute>): Promise<Route | undefined> {
        const [updated] = await db.update(routes).set({ ...update, updatedAt: new Date() }).where(eq(routes.id, id)).returning();
        return updated;
    }

    async deleteRoute(id: string): Promise<void> {
        await db.delete(routes).where(eq(routes.id, id));
    }

    // --- Trips ---
    async getTrips(tenantId: string, fromDate?: Date): Promise<Trip[]> {
        const conditions = [eq(trips.tenantId, tenantId)];
        if (fromDate) {
            conditions.push(gte(trips.departureTime, fromDate));
        }
        return await db.select().from(trips).where(and(...conditions)).orderBy(asc(trips.departureTime));
    }

    async createTrip(trip: InsertTrip): Promise<Trip> {
        const [newTrip] = await db.insert(trips).values(trip).returning();
        return newTrip;
    }

    async updateTrip(id: string, update: Partial<InsertTrip>): Promise<Trip | undefined> {
        const [updated] = await db.update(trips).set({ ...update, updatedAt: new Date() }).where(eq(trips.id, id)).returning();
        return updated;
    }

    // --- Reservations ---
    async getTripReservations(tripId: string): Promise<SeatReservation[]> {
        return await db.select().from(seatReservations).where(eq(seatReservations.tripId, tripId));
    }

    async getSeatReservation(id: string): Promise<SeatReservation | undefined> {
        const [reservation] = await db.select().from(seatReservations).where(eq(seatReservations.id, id));
        return reservation;
    }

    async createSeatReservation(reservation: InsertSeatReservation): Promise<SeatReservation> {
        // Optimistic Locking or Constraint rely on DB unique index
        const [newReservation] = await db.insert(seatReservations).values(reservation).returning();
        return newReservation;
    }

    async cancelSeatReservation(id: string): Promise<void> {
        await db.update(seatReservations).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(seatReservations.id, id));
    }
}
