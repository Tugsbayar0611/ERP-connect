import "dotenv/config";
import { pool } from "../server/db";

async function checkServer() {
  console.log("🔍 Checking server setup...\n");

  // Check 1: Database connection
  console.log("📋 Check 1: Database Connection");
  try {
    const client = await pool.connect();
    const result = await client.query("SELECT NOW()");
    console.log("  ✅ Database connected:", result.rows[0].now);
    client.release();
  } catch (err: any) {
    console.error("  ❌ Database connection failed:", err.message);
    console.error("     Make sure DATABASE_URL is set correctly in .env");
    process.exit(1);
  }

  // Check 2: Environment variables
  console.log("\n📋 Check 2: Environment Variables");
  console.log("  ✅ DATABASE_URL:", process.env.DATABASE_URL ? "Set" : "❌ Missing");
  console.log("  ✅ PORT:", process.env.PORT || "5000 (default)");
  console.log("  ✅ NODE_ENV:", process.env.NODE_ENV || "development");

  // Check 3: Required dependencies
  console.log("\n📋 Check 3: Server Files");
  try {
    const fs = await import("fs");
    const path = await import("path");
    
    const files = [
      "server/index.ts",
      "server/routes.ts",
      "server/storage.ts",
      "server/db.ts",
      "server/vite.ts",
    ];

    for (const file of files) {
      if (fs.existsSync(path.resolve(file))) {
        console.log(`  ✅ ${file}`);
      } else {
        console.log(`  ❌ ${file} - Missing`);
      }
    }
  } catch (err: any) {
    console.error("  ⚠️  Error checking files:", err.message);
  }

  console.log("\n✅ Server setup check completed!");
  console.log("\n💡 If database is connected, try running: npm run dev");
  
  await pool.end();
}

checkServer();
