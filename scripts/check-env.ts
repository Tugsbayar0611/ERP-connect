/**
 * Environment Sanity Check
 * Validates production environment variables
 */

const REQUIRED_ENV_VARS = [
  "NODE_ENV",
  "DATABASE_URL",
  "SESSION_SECRET",
] as const;

const OPTIONAL_ENV_VARS = [
  "PORT",
  "CORS_ORIGIN",
  "HTTPS",
] as const;

function checkEnv() {
  console.log("🔍 Checking environment variables...\n");
  
  let hasErrors = false;
  
  // Check required vars
  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];
    if (!value) {
      console.error(`❌ Missing required: ${varName}`);
      hasErrors = true;
    } else {
      // Mask sensitive values
      const displayValue = varName.includes("SECRET") || varName.includes("PASSWORD") || varName.includes("KEY")
        ? "***"
        : value;
      console.log(`✅ ${varName}=${displayValue}`);
    }
  }
  
  // Check optional vars
  console.log("\n📋 Optional variables:");
  for (const varName of OPTIONAL_ENV_VARS) {
    const value = process.env[varName];
    if (value) {
      console.log(`  ✅ ${varName}=${value}`);
    } else {
      console.log(`  ⚠️  ${varName} not set (using default)`);
    }
  }
  
  // Security checks
  console.log("\n🔒 Security checks:");
  
  if (process.env.NODE_ENV === "production") {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      console.error("❌ SESSION_SECRET must be at least 32 characters in production");
      hasErrors = true;
    } else {
      console.log("✅ SESSION_SECRET length OK");
    }
    
    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === "*") {
      console.warn("⚠️  CORS_ORIGIN should be set to specific domains in production");
    } else {
      console.log("✅ CORS_ORIGIN configured");
    }
  }
  
  // Database URL check
  if (process.env.DATABASE_URL) {
    if (process.env.DATABASE_URL.includes("localhost") && process.env.NODE_ENV === "production") {
      console.warn("⚠️  DATABASE_URL points to localhost in production");
    } else {
      console.log("✅ DATABASE_URL looks valid");
    }
  }
  
  console.log("\n" + "=".repeat(60));
  if (hasErrors) {
    console.error("❌ Environment check FAILED");
    process.exit(1);
  } else {
    console.log("✅ Environment check PASSED");
    process.exit(0);
  }
}

checkEnv();
