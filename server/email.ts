/**
 * Email Service
 * Имэйл илгээх үйлчилгээ
 */

import nodemailer from "nodemailer";

// Email transporter configuration
let transporter: nodemailer.Transporter | null = null;

/**
 * Initialize email transporter
 */
function getTransporter(): nodemailer.Transporter | null {
  // If already initialized, return it
  if (transporter) {
    return transporter;
  }

  // Check if SMTP is configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM || smtpUser;

  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
    console.warn("⚠️  SMTP not configured. Email sending disabled.");
    return null;
  }

  // Create transporter
  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort, 10),
    secure: smtpPort === "465", // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  return transporter;
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  to: string,
  resetToken: string,
  userName?: string
): Promise<void> {
  const emailTransporter = getTransporter();
  
  if (!emailTransporter) {
    // In development, just log the token
    if (process.env.NODE_ENV === "development") {
      console.log("🔑 Password Reset Token (Dev Mode):", resetToken);
      console.log("📧 Would send email to:", to);
    }
    throw new Error("Email service not configured");
  }

  const resetUrl = `${process.env.APP_URL || "http://localhost:5000"}/login?resetToken=${resetToken}&view=reset-password`;
  const smtpFrom = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@monerp.mn";

  const mailOptions = {
    from: `MonERP <${smtpFrom}>`,
    to,
    subject: "Нууц үг сэргээх | MonERP",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .token-box { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; font-family: monospace; word-break: break-all; margin: 20px 0; }
            .footer { text-align: center; color: #999; font-size: 12px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>MonERP</h1>
              <p>Нууц үг сэргээх</p>
            </div>
            <div class="content">
              <p>Сайн байна уу${userName ? ` ${userName}` : ""},</p>
              <p>Та нууц үгээ сэргээх хүсэлт илгээсэн байна. Доорх линк дээр дарж нууц үгээ сэргээнэ үү:</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Нууц үг сэргээх</a>
              </p>
              <p>Эсвэл доорх токеныг хуулж нэвтрэх хуудас дээр оруулна уу:</p>
              <div class="token-box">${resetToken}</div>
              <p><strong>Анхаар:</strong> Энэ линк 1 цагийн дараа хүчинтэй болно.</p>
              <p>Хэрэв та нууц үг сэргээх хүсэлт илгээгээгүй бол энэ имэйлийг үл тоомсорлож болно.</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} MonERP. Бүх эрх хуулиар хамгаалагдсан.</p>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `
MonERP - Нууц үг сэргээх

Сайн байна уу${userName ? ` ${userName}` : ""},

Та нууц үгээ сэргээх хүсэлт илгээсэн байна. Доорх линк дээр дарж нууц үгээ сэргээнэ үү:

${resetUrl}

Эсвэл доорх токеныг хуулж нэвтрэх хуудас дээр оруулна уу:

${resetToken}

Анхаар: Энэ линк 1 цагийн дараа хүчинтэй болно.

Хэрэв та нууц үг сэргээх хүсэлт илгээгээгүй бол энэ имэйлийг үл тоомсорлож болно.

© ${new Date().getFullYear()} MonERP. Бүх эрх хуулиар хамгаалагдсан.
    `,
  };

  try {
    await emailTransporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to: ${to}`);
  } catch (error: any) {
    console.error("❌ Error sending email:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
}

/**
 * Test email configuration
 */
export async function testEmailConfig(): Promise<boolean> {
  const emailTransporter = getTransporter();
  
  if (!emailTransporter) {
    return false;
  }

  try {
    await emailTransporter.verify();
    return true;
  } catch (error) {
    console.error("Email configuration test failed:", error);
    return false;
  }
}
