export type RequestScope = "my" | "approvals";
export type RequestType = "leave" | "travel" | "reimbursement";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface RequestItem {
    id: string;
    type: RequestType;
    status: RequestStatus;
    title: string;
    details?: string;
    startDate?: string; // ISO
    endDate?: string;   // ISO
    createdAt: string;  // ISO
    requestedBy?: {
        id: string;
        fullName: string;
        avatarUrl?: string; // Optional
        department?: string;
    };
    // Generic fields
    meta?: Record<string, any>;
    approvalStep?: number;
    approvalChain?: Array<{
        role: string;
        status: string;
        stepName?: string;
        decidedBy?: string;
        decidedAt?: string;
        comment?: string;
    }>;
}

export const REQUEST_LABELS: Record<RequestType, string> = {
    leave: "Чөлөө",
    travel: "Томилолт",
    reimbursement: "Төлбөр",
};

export const STATUS_LABELS: Record<RequestStatus, string> = {
    pending: "Хүлээгдэж буй",
    approved: "Зөвшөөрсөн",
    rejected: "Татгалзсан",
    cancelled: "Цуцалсан",
};
