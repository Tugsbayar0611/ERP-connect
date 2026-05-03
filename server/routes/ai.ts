import { Router, Request, Response } from "express";
import { askClaude, streamClaude, streamClaudeWithHistory } from "../../lib/claude";
import { requireTenant } from "../middleware";
import { db } from "../db";
import { aiKnowledgeBase, type InsertAiKnowledgeBase, aiChatSessions, aiChatHistory } from "@shared/schema";
import { eq, and, desc, asc, gte, count } from "drizzle-orm";

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
// 4. GET CHAT SESSIONS
// GET /api/ai/chat/sessions
// ─────────────────────────────────────────────
router.get("/chat/sessions", requireTenant, async (req: any, res: Response) => {
    // Хэрэггүй болсон хуучин сессиүүдийг устгах (30 хоног)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Clean up with raw sql safely:
    await db.execute(`DELETE FROM ai_chat_sessions WHERE user_id = '${req.user.id}' AND created_at < NOW() - INTERVAL '30 days'`);

    const sessions = await db.select()
        .from(aiChatSessions)
        .where(and(
            eq(aiChatSessions.tenantId, req.tenantId),
            eq(aiChatSessions.userId, req.user.id)
        ))
        .orderBy(desc(aiChatSessions.updatedAt));
    res.json(sessions);
});

// ─────────────────────────────────────────────
// 5. GET CHAT SESSION HISTORY
// GET /api/ai/chat/sessions/:id
// ─────────────────────────────────────────────
router.get("/chat/sessions/:id", requireTenant, async (req: any, res: Response) => {
    // Check if session belongs to user
    const [session] = await db.select()
        .from(aiChatSessions)
        .where(and(
            eq(aiChatSessions.id, req.params.id),
            eq(aiChatSessions.tenantId, req.tenantId),
            eq(aiChatSessions.userId, req.user.id)
        ));
        
    if (!session) return res.status(404).json({ error: "Session not found" });

    const history = await db.select()
        .from(aiChatHistory)
        .where(eq(aiChatHistory.sessionId, session.id))
        .orderBy(asc(aiChatHistory.createdAt));
        
    res.json(history);
});

// ─────────────────────────────────────────────
// 6. STREAMING CHAT (Multi-turn, History дэмжсэн, DB Storage, Rate Limited)
// POST /api/ai/chat
// Body: { message: string, sessionId?: string }
// ─────────────────────────────────────────────
router.post("/chat", requireTenant, async (req: any, res: Response) => {
    const { message, sessionId } = req.body;
    if (!message) return res.status(400).json({ error: "message шаардлагатай" });

    // --- RATE LIMITING (Өдөрт 10 асуулт) ---
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Өнөөдөр асуусан асуултын тоог гаргах (энэ хэрэглэгчийн бүх session-с)
    const usageResult = await db.execute(`
        SELECT COUNT(*) as count 
        FROM ai_chat_history h
        JOIN ai_chat_sessions s ON h.session_id = s.id
        WHERE s.user_id = '${req.user.id}' 
          AND h.role = 'user' 
          AND h.created_at >= NOW() - INTERVAL '24 hours'
    `);
    const countSoFar = Number((usageResult as any).rows?.[0]?.count || 0);

    if (countSoFar >= 10) {
        return res.status(429).json({ 
            error: "Таны өдөрт асуух асуултын хязгаар (10) дууссан байна. Маргааш дахин оролдоно уу." 
        });
    }
    // ---------------------------------------

    // 1. Fetch Knowledge Base Documents — requireTenant-аас тогтоогдсон tenantId ашиглана
    const kbs = await db.select()
        .from(aiKnowledgeBase)
        .where(and(
            eq(aiKnowledgeBase.tenantId, req.tenantId),
            eq(aiKnowledgeBase.isActive, true)
        ));

    let kbContext = "";
    if (kbs.length > 0) {
        kbContext = `\n\n[МЭДЛЭГИЙН САН - ЭДГЭЭР ЗААВРУУДЫГ АШИГЛАЖ ХАРИУЛНА УУ]:\n`;
        kbs.forEach((kb, i) => {
            kbContext += `\n--- ЗААВАР ${i + 1}: ${kb.title} (${kb.category}) ---\n${kb.content}\n`;
        });
    }

    const system = `Та MonERP системийн дэвшилтэт AI туслагч юм.
AWS Bedrock дээрх Claude claude-opus-4-5 загварыг ашиглаж байна.
Монгол болон Англи хэл хоёуланд хариулж чадна.
Таны үндсэн бөгөөд ЦОР ГАНЦ зорилго бол байгууллагын ажилтнуудад энэхүү ERP системийг хэрхэн ашиглахыг зааж өгөх, системтэй холбоотой асуудлуудад туслах явдал юм.

ЧУХАЛ ДҮРЭМ (ХАТУУ БАРИМТЛАХ):
1. ТА ЗӨВХӨН MonERP систем, түүний модулиуд, хүний нөөц, тайлан, цаг бүртгэл гэх мэт системтэй шууд холбоотой асуултуудад л хариулна.
2. Хэрэв хэрэглэгч системээс гадуур, өөр сэдвээр (жишээлбэл: ерөнхий мэдлэг, түүх, улс төр, хоолны жор, код бичих тухай ерөнхий асуулт гэх мэт) асуувал: "Уучлаарай, би зөвхөн MonERP системтэй холбоотой асуултуудад хариулах зориулалттай туслагч байна. Системтэй холбоотой өөр асуух зүйл байна уу?" гэж эелдгээр татгалзах хэрэгтэй.
3. Мэдлэгийн санд байхгүй ч гэсэн логик болон ERP системийн ерөнхий ойлголттой таарч байвал хариулж болно. Харин огт хамааралгүй зүйлд хэзээ ч хариулж болохгүй.

${kbContext}`;

    // Streaming хариу SSE (Server-Sent Events)-ээр
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // 2. Load History and Setup Session
    let currentSessionId = sessionId;
    let history: Array<{ role: "user" | "assistant"; content: string }> = [];

    if (currentSessionId) {
        // Одоо байгаа session
        const [session] = await db.select().from(aiChatSessions).where(eq(aiChatSessions.id, currentSessionId));
        if (!session || session.userId !== req.user.id) {
            return res.status(403).json({ error: "Session mismatch" });
        }
        
        // Load history from DB
        const dbHistory = await db.select()
            .from(aiChatHistory)
            .where(eq(aiChatHistory.sessionId, currentSessionId))
            .orderBy(asc(aiChatHistory.createdAt));
            
        history = dbHistory.map(h => ({ role: h.role as "user" | "assistant", content: h.content }));
        
        // Шинэ мессеж хадгалах
        await db.insert(aiChatHistory).values({
            sessionId: currentSessionId,
            role: "user",
            content: message
        });
        
        // Update session updatedAt
        await db.update(aiChatSessions)
            .set({ updatedAt: new Date() })
            .where(eq(aiChatSessions.id, currentSessionId));
    } else {
        // Шинэ session үүсгэх
        const [newSession] = await db.insert(aiChatSessions).values({
            tenantId: req.tenantId,
            userId: req.user.id,
            title: message.substring(0, 40) + (message.length > 40 ? "..." : "")
        }).returning();
        
        currentSessionId = newSession.id;
        
        // Шинэ мессеж хадгалах
        await db.insert(aiChatHistory).values({
            sessionId: currentSessionId,
            role: "user",
            content: message
        });
    }

    // History + шинэ мессежийг нэгтгэх
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
        ...history,
        { role: "user", content: message },
    ];

    try {
        let fullResponse = "";
        
        // SSE Headers for stream
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        
        // Send sessionId back so client knows which session was created/used
        res.write(`data: ${JSON.stringify({ sessionId: currentSessionId })}\n\n`);

        await streamClaudeWithHistory(
            system,
            messages,
            (chunk) => {
                fullResponse += chunk;
                res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            },
            4000
        );
        
        // Stream дууссаны дараа AI хариуг DB-д хадгалах
        await db.insert(aiChatHistory).values({
            sessionId: currentSessionId,
            role: "assistant",
            content: fullResponse
        });

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
    } catch (err: any) {
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        } else {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        }
    }
});

// ─────────────────────────────────────────────
// 5. KNOWLEDGE BASE CRUD (For Admins)
// ─────────────────────────────────────────────
router.get("/kb", requireTenant, async (req: any, res: Response) => {
    const kbs = await db.select()
        .from(aiKnowledgeBase)
        .where(eq(aiKnowledgeBase.tenantId, req.tenantId))
        .orderBy(desc(aiKnowledgeBase.updatedAt));
    res.json(kbs);
});

router.post("/kb", requireTenant, async (req: any, res: Response) => {
    const { title, category, content, keywords } = req.body;
    if (!title || !content) return res.status(400).json({ error: "title, content шаардлагатай" });

    const [kb] = await db.insert(aiKnowledgeBase).values({
        tenantId: req.tenantId,
        title,
        category: category || "general",
        content,
        keywords: keywords || null,
        createdBy: req.user.id,
    }).returning();
    res.status(201).json(kb);
});

router.patch("/kb/:id", requireTenant, async (req: any, res: Response) => {
    const [updated] = await db.update(aiKnowledgeBase)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(
            eq(aiKnowledgeBase.id, req.params.id),
            eq(aiKnowledgeBase.tenantId, req.tenantId)
        )).returning();
    
    if (!updated) return res.status(404).json({ error: "Олдсонгүй" });
    res.json(updated);
});

router.delete("/kb/:id", requireTenant, async (req: any, res: Response) => {
    await db.delete(aiKnowledgeBase).where(and(
        eq(aiKnowledgeBase.id, req.params.id),
        eq(aiKnowledgeBase.tenantId, req.tenantId)
    ));
    res.sendStatus(204);
});

export default router;
