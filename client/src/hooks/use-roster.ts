
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { insertRosterSchema, insertShiftSchema, type Roster, type Shift, type RosterDay, type RosterAssignment } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

// Schema for Roster Days Bulk Update
const rosterDaysSchema = z.object({
    days: z.array(z.object({
        dayIndex: z.number(),
        shiftId: z.string().nullable().optional(),
        isOff: z.boolean()
    }))
});

export type RosterDayInput = z.infer<typeof rosterDaysSchema>['days'][number];

// Schema for Bulk Assignment
const bulkAssignSchema = z.object({
    assignments: z.array(z.object({
        rosterId: z.string(),
        employeeId: z.string(),
        startDate: z.string(), // YYYY-MM-DD
        endDate: z.string().nullable().optional(),
    }))
});

export type AssignmentInput = z.infer<typeof bulkAssignSchema>['assignments'][number];

export function useRosters() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const rostersQuery = useQuery<Roster[]>({
        queryKey: ["rosters"],
        queryFn: async () => {
            const res = await fetch("/api/rosters");
            if (!res.ok) throw new Error("Failed to fetch rosters");
            return res.json();
        }
    });

    const createRosterMutation = useMutation({
        mutationFn: async (data: any) => {
            // Validate with schema first if needed, or rely on backend
            const res = await fetch("/api/rosters", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to create roster");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["rosters"] });
            toast({ title: "Success", description: "Roster created successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    return { rostersQuery, createRosterMutation };
}

export function useShifts() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const shiftsQuery = useQuery<Shift[]>({
        queryKey: ["shifts"],
        queryFn: async () => {
            const res = await fetch("/api/rosters/shifts"); // Note: Using the shifts endpoint we created in roster.ts
            if (!res.ok) throw new Error("Failed to fetch shifts");
            return res.json();
        }
    });

    const createShiftMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/rosters/shifts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to create shift");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["shifts"] });
            toast({ title: "Success", description: "Shift created successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    return { shiftsQuery, createShiftMutation };
}

export function useRosterTemplate(rosterId: string) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    /* 
     * Note: We didn't explicitly create a GET /api/rosters/:id endpoint in Phase 1 API tasks
     * but we might need it for details if not passed from list. 
     * For now we'll assume we pass roster data or fetch from list cache.
     * However, we DID impl GET /:id/shifts (Wait, looking at roster.ts...)
     * 
     * Reviewing roster.ts:
     * router.get("/shifts") -> All shifts
     * router.post("/shifts")
     * router.get("/") -> All rosters
     * router.post("/")
     * router.post("/:id/days") -> Bulk days
     * 
     * Missing: GET /api/rosters/:id/days to READ the pattern!
     * We need to fix the API first or implemented?
     * Ah, I missed GET /api/rosters/:id/days in the previous step's implementation of roster.ts?
     * Let me check the file content first.
     */

    const updateTemplateMutation = useMutation({
        mutationFn: async (days: RosterDayInput[]) => {
            const res = await fetch(`/api/rosters/${rosterId}/days`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ days }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to update template");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["rosterDays", rosterId] });
            toast({ title: "Success", description: "Roster pattern updated" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        }
    });

    return { updateTemplateMutation };
}

export function useAssignRoster() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const bulkAssignMutation = useMutation({
        mutationFn: async (assignments: AssignmentInput[]) => {
            const res = await fetch("/api/rosters/assign", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ assignments }),
            });
            if (!res.ok) {
                const err = await res.json();
                // Handle specific overlap error
                if (res.status === 409) {
                    throw new Error(`Roster overlap detected for employee ${err.employeeId}`);
                }
                throw new Error(err.message || "Failed to assign rosters");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["rosterAssignments"] });
            toast({ title: "Success", description: "Assignments updated successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Assignment Failed", description: error.message, variant: "destructive" });
        }
    });

    return { bulkAssignMutation };
}

export function useRosterAssignments(filters?: { from?: string; to?: string; scope?: string; employeeId?: string; departmentId?: string }) {
    const query = useQuery<RosterAssignment[]>({
        queryKey: ["/api/rosters/assignments", filters],
        queryFn: async () => {
            const queryStr = new URLSearchParams(JSON.parse(JSON.stringify(filters || {}))).toString(); // Clean undefined
            const res = await fetch(`/api/rosters/assignments?${queryStr}`);
            if (!res.ok) throw new Error("Failed to fetch assignments");
            return await res.json();
        }
    });
    return query;
}

export function useMyRoster(range?: { from?: string; to?: string }) {
    const queryStr = new URLSearchParams(range as any).toString();
    const query = useQuery<RosterAssignment[]>({
        queryKey: ["myRoster", range],
        queryFn: async () => {
            const res = await fetch(`/api/rosters/my?${queryStr}`);
            if (!res.ok) throw new Error("Failed to fetch my roster");
            return res.json();
        },
        enabled: !!range
    });
    return query;
}
