
import {
    requests, requestApprovals, requestEvents,
    sequences, documentTemplates, requestDocuments,
    type Request, type InsertRequest, type DbInsertRequest,
    type RequestEvent, type InsertRequestEvent,
    employees
} from "@shared/schema";
import { db } from "../db";
import { eq, and, desc, asc, sql, inArray, or, isNull } from "drizzle-orm";
import { AssetStorage } from "./assets";

export class RequestsStorage extends AssetStorage {
    // --- Core CRUD ---
    async createRequest(data: DbInsertRequest): Promise<Request> {
        const [req] = await db.insert(requests).values(data).returning();
        return req;
    }

    async updateRequest(id: string, data: Partial<DbInsertRequest>): Promise<Request> {
        const [req] = await db.update(requests)
            .set({ ...data, updatedAt: new Date() })
            .where(eq(requests.id, id))
            .returning();
        return req;
    }

    async getRequest(id: string): Promise<Request | undefined> {
        const [req] = await db.select().from(requests).where(eq(requests.id, id));
        if (!req) return undefined;

        const payload = req.payload as any;
        return {
            ...req,
            startDate: payload?.startDate,
            endDate: payload?.endDate
        } as any;
    }

    async getRequestEvents(requestId: string): Promise<RequestEvent[]> {
        return await db.select().from(requestEvents)
            .where(eq(requestEvents.requestId, requestId))
            .orderBy(asc(requestEvents.createdAt));
    }

    async getApprovals(requestId: string): Promise<any[]> {
        return await db.select().from(requestApprovals)
            .where(eq(requestApprovals.requestId, requestId))
            .orderBy(asc(requestApprovals.step));
    }

    // --- Listings ---
    async getMyRequests(tenantId: string, employeeId: string, status?: string): Promise<Request[]> {
        const conditions = [
            eq(requests.tenantId, tenantId),
            eq(requests.employeeId, employeeId)
        ];
        if (status) {
            conditions.push(eq(requests.status, status));
        }
        const results = await db.select().from(requests)
            .where(and(...conditions))
            .orderBy(desc(requests.createdAt));

        return results.map(r => {
            const payload = r.payload as any;
            return {
                ...r,
                startDate: payload?.startDate,
                endDate: payload?.endDate
            };
        });
    }

    async getApproverInbox(tenantId: string, approverId: string, status: string = 'submitted'): Promise<any[]> {
        // Complex query: Find requests where current step awaits this approver
        // Join requests with approvals
        // Where requests.status = 'submitted' AND requestApprovals.approverId = me AND requestApprovals.step = requests.currentStep AND requestApprovals.decision IS NULL

        // Drizzle join
        const results = await db.select({
            request: requests,
            approval: requestApprovals,
            employee: employees // Join for requester info
        })
            .from(requests)
            .innerJoin(requestApprovals, eq(requests.id, requestApprovals.requestId))
            .leftJoin(employees, eq(requests.employeeId, employees.id)) // <--- Add this join
            .where(and(
                eq(requests.tenantId, tenantId),
                eq(requests.status, status),
                eq(requestApprovals.approverId, approverId),
                // eq(requestApprovals.step, requests.currentStep), // Can't easily compare columns in where with pure values, use sql
                sql`${requestApprovals.step} = ${requests.currentStep}`,
                isNull(requestApprovals.decision) // Pending
            ))
            .orderBy(desc(requests.submittedAt));

        return results.map(r => {
            const payload = r.request.payload as any;
            return {
                ...r.request,
                approvalId: r.approval.id,
                step: r.approval.step,
                startDate: payload?.startDate, // Extract for table view
                endDate: payload?.endDate,
                requestedBy: r.employee ? {
                    id: r.employee.id,
                    fullName: `${r.employee.lastName} ${r.employee.firstName}`,
                    department: r.employee.departmentId
                } : undefined
            };
        });
    }

    // --- Actions ---
    async logRequestEvent(data: InsertRequestEvent) {
        await db.insert(requestEvents).values(data);
    }

    async submitRequest(requestId: string, nextStep: number): Promise<Request> {
        const [req] = await db.update(requests)
            .set({
                status: 'submitted',
                submittedAt: new Date(),
                currentStep: nextStep,
                updatedAt: new Date()
            })
            .where(eq(requests.id, requestId))
            .returning();
        return req;
    }

    async createApprovals(approvals: any[]): Promise<void> {
        if (approvals.length > 0) {
            await db.insert(requestApprovals).values(approvals);
        }
    }

    async approveStep(approvalId: string, comment?: string): Promise<void> {
        await db.update(requestApprovals)
            .set({
                decision: 'approved',
                comment,
                decidedAt: new Date()
            })
            .where(eq(requestApprovals.id, approvalId));
    }

    async rejectStep(approvalId: string, comment: string): Promise<void> {
        await db.update(requestApprovals)
            .set({
                decision: 'rejected',
                comment,
                decidedAt: new Date()
            })
            .where(eq(requestApprovals.id, approvalId));
    }

    async setRequestStatus(requestId: string, status: string, nextStep: number = 0): Promise<Request> {
        const [req] = await db.update(requests)
            .set({
                status,
                currentStep: nextStep,
                updatedAt: new Date(),
                decidedAt: ['approved', 'rejected', 'cancelled'].includes(status) ? new Date() : undefined
            })
            .where(eq(requests.id, requestId))
            .returning();
        return req;
    }

    // --- Phase 5.2: Official Letter Numbers ---
    async assignOfficialLetterNumber(requestId: string): Promise<string | null> {
        return await db.transaction(async (tx) => {
            const [req] = await tx.select().from(requests).where(eq(requests.id, requestId));
            if (!req || req.type !== 'official_letter') return null;
            if (req.officialLetterNo) return req.officialLetterNo; // Idempotent

            const tenantId = req.tenantId;
            const year = new Date().getFullYear();
            const key = `official_letter_${year}`;

            // Lock & Increment Sequence
            // Upsert sequence
            let seq = await tx.select().from(sequences).where(and(eq(sequences.tenantId, tenantId), eq(sequences.key, key))).then(r => r[0]);

            let currentVal = 0;

            if (!seq) {
                // Try create
                const [newSeq] = await tx.insert(sequences)
                    .values({ tenantId, key, currentVal: 1 })
                    .onConflictDoUpdate({
                        target: [sequences.tenantId, sequences.key],
                        set: { currentVal: sql`sequences.current_val + 1` }
                    })
                    .returning();
                currentVal = newSeq.currentVal;
            } else {
                const [updated] = await tx.update(sequences)
                    .set({ currentVal: sql`current_val + 1`, updatedAt: new Date() })
                    .where(eq(sequences.id, seq.id))
                    .returning();
                currentVal = updated.currentVal;
            }

            // Format: LETTER-YYYY-XXXX
            const letterNo = `LETTER-${year}-${String(currentVal).padStart(4, '0')}`;

            // Get Active Template
            const [template] = await tx.select().from(documentTemplates)
                .where(and(eq(documentTemplates.tenantId, tenantId), eq(documentTemplates.key, 'official_letter'), eq(documentTemplates.isActive, true)))
                .orderBy(desc(documentTemplates.version))
                .limit(1);

            // Update Request
            await tx.update(requests)
                .set({
                    officialLetterNo: letterNo,
                    officialLetterTemplateVersion: template?.version || 1, // Fallback to 1
                    finalizedAt: new Date(),
                    updatedAt: new Date()
                })
                .where(eq(requests.id, requestId));

            return letterNo;
        });
    }

    // --- Templates ---
    async createTemplate(data: unknown) { // Typed properly if imported
        const [tmpl] = await db.insert(documentTemplates).values(data as any).returning();
        return tmpl;
    }

    async getActiveTemplate(tenantId: string, key: string) {
        const [t] = await db.select().from(documentTemplates)
            .where(and(eq(documentTemplates.tenantId, tenantId), eq(documentTemplates.key, key), eq(documentTemplates.isActive, true)))
            .orderBy(desc(documentTemplates.version))
            .limit(1);
        return t;
    }

    async getTemplateByVersion(tenantId: string, key: string, version: number) {
        const [t] = await db.select().from(documentTemplates)
            .where(and(eq(documentTemplates.tenantId, tenantId), eq(documentTemplates.key, key), eq(documentTemplates.version, version)));
        return t;
    }
}
