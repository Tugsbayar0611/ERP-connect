import { db } from "../server/db";
import { documentTemplates, tenants, users } from "../shared/schema";
import { eq, and } from "drizzle-orm";

async function seed() {
    console.log("Seeding templates...");
    const tenant = await db.query.tenants.findFirst();
    if (!tenant) {
        console.error("No tenant found");
        process.exit(1);
    }

    const key = 'official_letter';
    const existing = await db.query.documentTemplates.findFirst({
        where: and(eq(documentTemplates.tenantId, tenant.id), eq(documentTemplates.key, key))
    });

    if (!existing) {
        await db.insert(documentTemplates).values({
            tenantId: tenant.id,
            key,
            version: 1,
            htmlTemplate: `
            <div style="font-family: serif; line-height: 1.6;">
                <h1 style="text-align: center;">OFFICIAL LETTER</h1>
                <p><strong>Date:</strong> {{date}}</p>
                <p><strong>Ref:</strong> {{reference_number}}</p>
                <br/>
                <p>To Whom It May Concern,</p>
                <p>This letter confirms the details of the request.</p>
                <br/>
                <p>{{content}}</p>
                <br/>
                <p>Sincerely,</p>
                <p>Authorized Signature</p>
            </div>
            `,
            isActive: true
        });
        console.log("Created official letter template v1");
    } else {
        console.log("Template already exists.");
    }
    process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
