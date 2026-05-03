import { db } from "./server/db";
import { aiChatSessions, aiChatHistory } from "./shared/schema";

async function check() {
    const sessions = await db.select().from(aiChatSessions);
    const history = await db.select().from(aiChatHistory);
    console.log("=== SESSIONS ===");
    console.log(sessions.length > 0 ? sessions : "No sessions found.");
    console.log("=== HISTORY ===");
    console.log(history.length > 0 ? history : "No history found.");
    process.exit(0);
}
check();
