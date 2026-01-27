/**
 * Two-Factor Authentication (2FA) utilities using TOTP
 */

import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { storage } from "./storage";

/**
 * Generate a new TOTP secret for a user
 */
export function generate2FASecret(userEmail: string, serviceName: string = "MonERP"): {
  secret: string;
  otpauthUrl: string;
} {
  if (!userEmail) {
    throw new Error("userEmail is required");
  }

  try {
    const secret = speakeasy.generateSecret({
      name: `${serviceName} (${userEmail})`,
      issuer: serviceName,
      length: 32,
    });

    if (!secret.base32 || !secret.otpauth_url) {
      throw new Error("Failed to generate secret: missing base32 or otpauth_url");
    }

    return {
      secret: secret.base32,
      otpauthUrl: secret.otpauth_url,
    };
  } catch (error: any) {
    console.error("speakeasy.generateSecret error:", error);
    throw new Error(`Failed to generate 2FA secret: ${error.message || "Unknown error"}`);
  }
}

/**
 * Verify TOTP token
 */
export function verify2FAToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 2, // Allow 2 time steps (60 seconds) of tolerance
  });
}

/**
 * Generate QR code image (base64) for 2FA setup
 */
export async function generate2FAQRCode(otpauthUrl: string): Promise<string> {
  if (!otpauthUrl) {
    throw new Error("otpauthUrl is required");
  }
  
  try {
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
      errorCorrectionLevel: "M",
    });
    return qrCodeDataUrl;
  } catch (error: any) {
    console.error("QRCode.toDataURL error:", error);
    throw new Error(`QR code generation failed: ${error.message || "Unknown error"}`);
  }
}

/**
 * Check if user has 2FA enabled
 */
export async function is2FAEnabled(userId: string): Promise<boolean> {
  const user = await storage.getUser(userId);
  return user?.twoFactorEnabled === true;
}
