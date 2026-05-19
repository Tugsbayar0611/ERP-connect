/**
 * Environment Sanity Check
 * Validates required runtime environment variables.
 */

import "dotenv/config";

const REQUIRED_ENV_VARS = [
  "NODE_ENV",
  "DATABASE_URL",
  "SESSION_SECRET",
] as const;

const OPTIONAL_ENV_VARS = [
  "PORT",
  "CORS_ORIGIN",
  "FORCE_HTTPS",
  "SSL_KEY_PATH",
  "SSL_CERT_PATH",
  "QR_SECRET",
] as const;

function isSensitiveEnvVar(varName: string) {
  return varName.includes("SECRET")
    || varName.includes("PASSWORD")
    || varName.includes("KEY")
    || varName === "DATABASE_URL";
}

function displayEnvValue(varName: string, value: string) {
  return isSensitiveEnvVar(varName) ? "***" : value;
}

function checkEnv() {
  console.log("Checking environment variables...\n");

  let hasErrors = false;

  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];
    if (!value) {
      console.error(`Missing required: ${varName}`);
      hasErrors = true;
    } else {
      console.log(`${varName}=${displayEnvValue(varName, value)}`);
    }
  }

  console.log("\nOptional variables:");
  for (const varName of OPTIONAL_ENV_VARS) {
    const value = process.env[varName];
    if (value) {
      console.log(`  ${varName}=${displayEnvValue(varName, value)}`);
    } else {
      console.log(`  ${varName} not set (using default)`);
    }
  }

  console.log("\nSecurity checks:");

  if (process.env.NODE_ENV === "production") {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      console.error("SESSION_SECRET must be at least 32 characters in production");
      hasErrors = true;
    } else {
      console.log("SESSION_SECRET length OK");
    }

    const qrSigningSecret = process.env.QR_SECRET || process.env.SESSION_SECRET;
    if (!qrSigningSecret || qrSigningSecret.length < 32) {
      console.error("QR_SECRET or SESSION_SECRET must be at least 32 characters in production");
      hasErrors = true;
    } else {
      console.log("QR signing secret length OK");
    }

    if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === "*") {
      console.warn("CORS_ORIGIN should be set to specific domains in production");
    } else {
      console.log("CORS_ORIGIN configured");
    }
  }

  if (process.env.DATABASE_URL) {
    if (process.env.DATABASE_URL.includes("localhost") && process.env.NODE_ENV === "production") {
      console.warn("DATABASE_URL points to localhost in production");
    } else {
      console.log("DATABASE_URL looks valid");
    }
  }

  console.log("\n" + "=".repeat(60));
  if (hasErrors) {
    console.error("Environment check FAILED");
    process.exit(1);
  } else {
    console.log("Environment check PASSED");
    process.exit(0);
  }
}

checkEnv();
