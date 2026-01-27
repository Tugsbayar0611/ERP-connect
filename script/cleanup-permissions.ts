import { db } from "../server/db";
import { permissions, rolePermissions } from "../shared/schema";
import { eq, like, or, inArray } from "drizzle-orm";

async function main() {
    console.log("Cleaning up duplicate/plural permissions...");

    const invalidResources = [
        "roles",
        "users",
        "products",
        "invoices",
        "sales_orders",
        "purchase_orders",
        "reports",
        "contacts" // Check if singular 'contact' is used? No, 'contacts' is used in seed normally? 
        // Wait, route-permissions used 'contact' or 'contacts'?
    ];

    // Let's verify route-permissions usage first.
    // I will just delete the explicit plurals that I identified as duplicates of singulars.
    // user/users, role/roles, product/products, invoice/invoices, sales_order/sales_orders, purchase_order/purchase_orders.

    const targetResources = [
        "roles",
        "users",
        "products",
        "invoices",
        "sales_orders",
        "purchase_orders",
        "reports" // report/reports
    ];

    // Find IDs to delete
    const permsToDelete = await db.select().from(permissions).where(
        inArray(permissions.resource, targetResources)
    );

    console.log(`Found ${permsToDelete.length} invalid permissions.`);

    if (permsToDelete.length > 0) {
        const ids = permsToDelete.map(p => p.id);

        // First delete from rolePermissions to avoid FK error
        await db.delete(rolePermissions).where(
            inArray(rolePermissions.permissionId, ids)
        );
        console.log("Deleted associated rolePermissions.");

        // Delete permissions
        await db.delete(permissions).where(
            inArray(permissions.id, ids)
        );
        console.log("Deleted invalid permissions.");
    }

    process.exit(0);
}

main();
