import { Router, Request, Response } from "express";
import { askClaude, streamClaude, streamClaudeWithHistory } from "../../lib/claude";

const router = Router();

// ─────────────────────────────────────────────
// 1. КОД БИЧҮҮЛЭХ
// POST /api/ai/write-code
// Body: { task: string, context?: string }
// ─────────────────────────────────────────────
router.post("/write-code", async (req: Request, res: Response) => {
    const { task, context } = req.body;
    if (!task) return res.status(400).json({ error: "task шаардлагатай" });

    const system = `Та ERP системийн ахлах хөгжүүлэгч туслагч юм.
Манай ERP-ийн технологийн стек:
- Backend: Node.js + TypeScript + Express
- Database: PostgreSQL + Drizzle ORM
- Frontend: React + Tailwind CSS + shadcn/ui
- Auth: Passport.js
- Realtime: Socket.io

Дүрэм:
1. Ажиллах TypeScript код бичнэ
2. Drizzle ORM syntax ашиглана (raw SQL биш)
3. Коммент Монгол хэлээр бичнэ
4. Error handling заавал оруулна
5. Зөвхөн код хариулна — тайлбар код дотор коммент болно`;

    const userMsg = context
        ? `Контекст:\n${context}\n\nДаалгавар: ${task}`
        : `Даалгавар: ${task}`;

    try {
        const code = await askClaude(system, userMsg, 3000);
        res.json({ code });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// 2. КОД ШАЛГАХ (Code Review)
// POST /api/ai/review-code
// Body: { code: string, filename?: string }
// ─────────────────────────────────────────────
router.post("/review-code", async (req: Request, res: Response) => {
    const { code, filename } = req.body;
    if (!code) return res.status(400).json({ error: "code шаардлагатай" });

    const system = `Та ахлах TypeScript/Node.js хөгжүүлэгч юм.
Кодыг шинжилж, ЗӨВХӨН дараах JSON форматаар хариул (өөр юу ч биш):
{
  "score": <1-10 тоо>,
  "summary": "<нийт үнэлгээ Монгол хэлээр>",
  "issues": [
    {
      "line": <мөрийн дугаар эсвэл null>,
      "severity": "critical|high|medium|low",
      "type": "security|performance|logic|style",
      "message": "<асуудлын тайлбар Монгол хэлээр>",
      "fix": "<засах арга>"
    }
  ],
  "security": ["<аюулгүй байдлын асуудлуудын жагсаалт>"],
  "performance": ["<performance зөвлөмжүүд>"],
  "suggestions": ["<ерөнхий сайжруулалтын санаанууд>"]
}`;

    const userMsg = `${filename ? `Файл: ${filename}\n` : ""}Дараах кодыг шалга:\n\`\`\`typescript\n${code}\n\`\`\``;

    try {
        const raw = await askClaude(system, userMsg, 2000);
        const cleaned = raw.replace(/```json\n?|```\n?/g, "").trim();
        const review = JSON.parse(cleaned);
        res.json(review);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// 3. ТАЙЛАН ҮҮСГЭХ
// POST /api/ai/generate-report
// Body: { type: "sales"|"inventory"|"hr"|"finance", data: object, period?: string }
// ─────────────────────────────────────────────
router.post("/generate-report", async (req: Request, res: Response) => {
    const { type, data, period } = req.body;
    if (!type || !data) {
        return res.status(400).json({ error: "type болон data шаардлагатай" });
    }

    const reportTypes: Record<string, string> = {
        sales: "борлуулалтын",
        inventory: "агуулахын нөөцийн",
        hr: "хүний нөөцийн",
        finance: "санхүүгийн",
    };

    const system = `Та мэргэжлийн ERP системийн тайлан зохиогч юм.
Монгол хэлээр тайлан бичнэ.
Дараах бүтцийг яг дагана:

# [Тайлангийн нэр]
**Үе:** [хугацаа]
**Огноо:** [өнөөдөр]

## Товч дүгнэлт
[2-3 өгүүлбэр]

## Үндсэн үзүүлэлтүүд
[хүснэгт эсвэл жагсаалт]

## Дүн шинжилгээ
[дэлгэрэнгүй тайлбар]

## Дүгнэлт ба зөвлөмж
[тодорхой арга хэмжээнүүд]

Markdown форматаар бичнэ.`;

    const userMsg = `${reportTypes[type] || type} тайлан бичнэ үү.
${period ? `Хугацаа: ${period}` : ""}

Өгөгдөл:
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\``;

    try {
        const report = await askClaude(system, userMsg, 4000);
        res.json({
            report,
            type,
            period: period || null,
            generatedAt: new Date().toISOString(),
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────
// 4. STREAMING CHAT (Multi-turn, History дэмжсэн)
// POST /api/ai/chat
// Body: { message: string, history?: Array<{role, content}> }
// ─────────────────────────────────────────────
router.post("/chat", async (req: Request, res: Response) => {
    const { message, history = [] } = req.body;
    if (!message) return res.status(400).json({ error: "message шаардлагатай" });

    const system = `Та MonERP системийн дэвшилтэт AI туслагч юм.
AWS Bedrock дээрх Claude claude-opus-4-5 загварыг ашиглаж байна.
Монгол болон Англи хэл хоёуланд хариулж чадна.
ERP системийн дараах функцүүдэд туслана:
- Хүний нөөц (цалин, ирц, ажилтнууд)
- Санхүү (нэхэмжлэх, тайлан)
- Агуулах ба борлуулалт
- Системийн тохиргоо
Хариултаа товч, тодорхой, ашигтай байдлаар өг.`;

    // Streaming хариу SSE (Server-Sent Events)-ээр
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // History + шинэ мессежийг нэгтгэх
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
        ...history,
        { role: "user", content: message },
    ];

    try {
        await streamClaudeWithHistory(
            system,
            messages,
            (chunk) => {
                res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            },
            4000
        );
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
    } catch (err: any) {
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

export default router;
