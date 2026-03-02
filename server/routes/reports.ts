
import { Router } from "express";
import {
    getTrialBalance,
    getBalanceSheet,
    getProfitAndLoss,
    getVATReport
} from "../reports";
import { format } from "date-fns";

const router = Router();

// Helper to ensure tenant context
const requireTenant = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(403).send("No tenant associated with user");
    req.tenantId = tenantId;
    next();
};

// GET /api/reports/trial-balance
router.get("/trial-balance", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await getTrialBalance(
            req.tenantId,
            startDate as string,
            endDate as string
        );
        res.json(report);
    } catch (error) {
        next(error);
    }
});

// GET /api/reports/balance-sheet
router.get("/balance-sheet", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const { asOfDate } = req.query;
        const report = await getBalanceSheet(
            req.tenantId,
            asOfDate as string
        );
        res.json(report);
    } catch (error) {
        next(error);
    }
});

// GET /api/reports/profit-and-loss
router.get("/profit-and-loss", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await getProfitAndLoss(
            req.tenantId,
            startDate as string,
            endDate as string
        );
        res.json(report);
    } catch (error) {
        next(error);
    }
});

// GET /api/reports/vat
router.get("/vat", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const { startDate, endDate } = req.query;
        const report = await getVATReport(
            req.tenantId,
            startDate as string,
            endDate as string
        );
        res.json(report);
    } catch (error) {
        next(error);
    }
});

// GET /api/reports/vat/export
router.get("/vat/export", requireTenant, async (req: any, res: any, next: any) => {
    try {
        const { startDate, endDate, format: exportFormat } = req.query;
        const report = await getVATReport(
            req.tenantId,
            startDate as string,
            endDate as string
        );

        if (exportFormat === 'csv') {
            // Simple CSV generation
            const headers = "Type,Date,Invoice Number,Name,Tax Code,Amount,VAT";
            const salesRows = report.sales.map(r =>
                `Sales,${r.invoiceDate},${r.invoiceNumber},${r.customerName},${r.taxCode},${r.taxBase},${r.taxAmount}`
            ).join("\n");
            const purchaseRows = report.purchases.map(r =>
                `Purchase,${r.invoiceDate},${r.invoiceNumber},${r.customerName},${r.taxCode},${r.taxBase},${r.taxAmount}`
            ).join("\n");

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=vat-report-${startDate}-${endDate}.csv`);
            res.send(`${headers}\n${salesRows}\n${purchaseRows}`);
        } else {
            // Default to JSON if not CSV (frontend asks for excel but we might just dump JSON or implement excel later)
            // For now, let's just return JSON if not CSV, or maybe simple HTML for excel? 
            // Simple HTML table works for Excel
            const html = `
                <html>
                <body>
                    <table>
                        <thead>
                            <tr>
                                <th>Type</th>
                                <th>Date</th>
                                <th>Invoice Number</th>
                                <th>Name</th>
                                <th>Tax Code</th>
                                <th>Amount</th>
                                <th>VAT</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${report.sales.map(r => `
                                <tr>
                                    <td>Sales</td>
                                    <td>${r.invoiceDate}</td>
                                    <td>${r.invoiceNumber}</td>
                                    <td>${r.customerName}</td>
                                    <td>${r.taxCode}</td>
                                    <td>${r.taxBase}</td>
                                    <td>${r.taxAmount}</td>
                                </tr>
                            `).join('')}
                             ${report.purchases.map(r => `
                                <tr>
                                    <td>Purchase</td>
                                    <td>${r.invoiceDate}</td>
                                    <td>${r.invoiceNumber}</td>
                                    <td>${r.customerName}</td>
                                    <td>${r.taxCode}</td>
                                    <td>${r.taxBase}</td>
                                    <td>${r.taxAmount}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </body>
                </html>
            `;
            res.setHeader('Content-Type', 'application/vnd.ms-excel');
            res.setHeader('Content-Disposition', `attachment; filename=vat-report-${startDate}-${endDate}.xls`);
            res.send(html);
        }

    } catch (error) {
        next(error);
    }
});

export default router;
