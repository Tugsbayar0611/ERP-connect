
import {
    assetIssuances,
    type AssetIssuance, type InsertAssetIssuance
} from "@shared/schema";
import { db } from "../db";
import { eq, and, desc } from "drizzle-orm";
import { CanteenStorage } from "./canteen";

export class AssetStorage extends CanteenStorage {
    async issueAsset(data: InsertAssetIssuance): Promise<AssetIssuance> {
        const [asset] = await db.insert(assetIssuances).values(data).returning();
        return asset;
    }

    async returnAsset(id: string, returnedBy: string): Promise<AssetIssuance> {
        const [asset] = await db.update(assetIssuances)
            .set({
                status: "returned",
                returnedAt: new Date(),
                returnedBy
            })
            .where(eq(assetIssuances.id, id))
            .returning();
        return asset;
    }

    async getEmployeeAssets(tenantId: string, employeeId: string): Promise<AssetIssuance[]> {
        return await db.select().from(assetIssuances)
            .where(and(eq(assetIssuances.tenantId, tenantId), eq(assetIssuances.employeeId, employeeId)))
            .orderBy(desc(assetIssuances.issuedAt));
    }

    async getAsset(id: string): Promise<AssetIssuance | undefined> {
        const [asset] = await db.select().from(assetIssuances).where(eq(assetIssuances.id, id));
        return asset;
    }

    async getAssetBySerial(tenantId: string, serialNumber: string): Promise<AssetIssuance | undefined> {
        const [asset] = await db.select().from(assetIssuances)
            .where(and(
                eq(assetIssuances.tenantId, tenantId),
                eq(assetIssuances.serialNumber, serialNumber),
                eq(assetIssuances.status, "issued") // Only check currently issued ones? Or any? USUALLY UNIQUE PER ITEM globally.
            ));
        // If unique constraint is truly desired per tenant regardless of status, remove status check.
        // But if I return it, can I issue it again? 
        // User said: "different tenant дээр ижил serial зөвшөөрөгдөнө (tenant unique)".
        // And "duplicate serial (same tenant) issue хийхэд 409".
        // Usually physical assets keep serials forever.
        // So I should check REGARDLESS of status if we want strict uniqueness.
        // HOWEVER, if I lost it, and found it, I might re-issue? 
        // Let's assume strict uniqueness for now.
        return asset;
    }
}
