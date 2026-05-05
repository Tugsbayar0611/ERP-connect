import { scrypt, randomBytes, timingSafeEqual, createHash, createHmac } from "crypto";
import { promisify } from "util";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { type Express } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool, db } from "./db";
import { storage } from "./storage";
import { type User, userSessions } from "@shared/schema";
import { validatePasswordStrength, updateSessionActivity, createRateLimiter } from "./security";
import { eq, and, isNull } from "drizzle-orm";

const scryptAsync = promisify(scrypt);
const PgSession = connectPg(session);

// Session tracking helpers
function hashSessionToken(token: string): string {
  const secret = process.env.SESSION_HASH_SECRET || "erp_session_secret_dev";
  return createHmac("sha256", secret).update(token).digest("hex");
}

function getClientInfo(req: any) {
  const ip =
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.ip ||
    req.connection?.remoteAddress ||
    null;
  const userAgent = req.headers["user-agent"]?.toString() || null;
  const deviceName = parseDeviceName(userAgent);
  return { ipAddress: ip, userAgent, deviceName };
}

function parseDeviceName(userAgent: string | null): string {
  if (!userAgent) return "Unknown Device";
  if (userAgent.includes("iPhone")) return "iPhone";
  if (userAgent.includes("iPad")) return "iPad";
  if (userAgent.includes("Android")) return "Android";
  if (userAgent.includes("Windows")) {
    if (userAgent.includes("Edge")) return "Edge (Windows)";
    if (userAgent.includes("Chrome")) return "Chrome (Windows)";
    if (userAgent.includes("Firefox")) return "Firefox (Windows)";
    return "Windows";
  }
  if (userAgent.includes("Mac")) {
    if (userAgent.includes("Chrome")) return "Chrome (Mac)";
    if (userAgent.includes("Safari")) return "Safari (Mac)";
    return "Mac";
  }
  return "Unknown Device";
}

async function insertUserSession(req: any, user: any) {
  try {
    const sessionId = req.sessionID;
    if (!sessionId) return;
    const tokenHash = hashSessionToken(sessionId);
    const { ipAddress, userAgent, deviceName } = getClientInfo(req);

    await db.insert(userSessions).values({
      tenantId: user.tenantId,
      userId: user.id,
      sessionTokenHash: tokenHash,
      ipAddress,
      userAgent,
      deviceName,
    }).onConflictDoNothing(); // Prevent duplicates if session already exists
  } catch (e) {
    console.error("Failed to insert user session:", e);
  }
}

async function revokeUserSession(req: any) {
  try {
    const sessionId = req.sessionID;
    if (!sessionId) return;
    const tokenHash = hashSessionToken(sessionId);

    await db.update(userSessions)
      .set({ revokedAt: new Date(), revokeReason: "logout" })
      .where(and(
        eq(userSessions.sessionTokenHash, tokenHash),
        isNull(userSessions.revokedAt)
      ));
  } catch (e) {
    console.error("Failed to revoke user session:", e);
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    store: new PgSession({
      pool,
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "erp_secure_session_secret_placeholder",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 30 * 60 * 1000, // 30 minutes (session timeout)
      secure: process.env.NODE_ENV === "production" && process.env.FORCE_HTTPS === "true",
      httpOnly: true,
      sameSite: "lax",
    },
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1); // trust first proxy
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Session activity update middleware (update timeout on each request)
  app.use(updateSessionActivity);

  // Session revocation check middleware
  const LAST_SEEN_THROTTLE_MS = 5 * 60 * 1000; // 5 minutes
  app.use(async (req, res, next) => {
    if (!req.isAuthenticated() || !req.sessionID) {
      return next();
    }

    try {
      const tokenHash = hashSessionToken(req.sessionID);
      const sessionRecord = await db.query.userSessions.findFirst({
        where: (t: any, { and: andOp, eq: eqOp, isNull: isNullOp }: any) =>
          andOp(
            eqOp(t.sessionTokenHash, tokenHash),
            isNullOp(t.revokedAt)
          ),
      });

      // If session is revoked or doesn't exist in our tracking table, logout
      if (!sessionRecord) {
        req.logout((err) => {
          if (err) console.error("Logout error:", err);
          return res.status(401).json({ message: "Session revoked" });
        });
        return;
      }

      // Throttled lastSeenAt update
      const lastSeen = new Date(sessionRecord.lastSeenAt).getTime();
      if (Date.now() - lastSeen > LAST_SEEN_THROTTLE_MS) {
        db.update(userSessions)
          .set({ lastSeenAt: new Date() })
          .where(eq(userSessions.id, sessionRecord.id))
          .catch(() => { }); // Don't block request
      }

      next();
    } catch (e) {
      console.error("Session validation error:", e);
      next(); // Don't block on validation errors
    }
  });

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        console.log("[AUTH DEBUG] Login attempt:", { username, passwordLength: password?.length });

        const user = await storage.getUserByUsername(username);
        console.log("[AUTH DEBUG] User found by username:", user
          ? { id: user.id, username: user.username, email: user.email, hasPasswordHash: !!user.passwordHash, passwordHashPrefix: user.passwordHash?.substring(0, 20) + "...", status: (user as any).status }
          : null
        );

        if (!user) {
          console.log("[AUTH DEBUG] FAIL: User not found for username:", username);
          return done(null, false, { message: "Нэвтрэх нэр эсвэл нууц үг буруу байна" });
        }

        if (!user.passwordHash) {
          console.log("[AUTH DEBUG] FAIL: User has no passwordHash (Google OAuth user?)");
          return done(null, false, { message: "Нэвтрэх нэр эсвэл нууц үг буруу байна" });
        }

        const passwordMatch = await comparePasswords(password, user.passwordHash);
        console.log("[AUTH DEBUG] Password match result:", passwordMatch);

        if (!passwordMatch) {
          console.log("[AUTH DEBUG] FAIL: Password mismatch for user:", username);
          return done(null, false, { message: "Нэвтрэх нэр эсвэл нууц үг буруу байна" });
        }

        // Check user status for admin approval workflow
        if ((user as any).status === "pending") {
          console.log("[AUTH DEBUG] FAIL: User status is pending");
          return done(null, false, { message: "Таны бүртгэлийг админ баталгаажуулаагүй байна. Түр хүлээнэ үү." });
        }
        if ((user as any).status === "rejected") {
          console.log("[AUTH DEBUG] FAIL: User status is rejected");
          return done(null, false, { message: "Таны хүсэлт татгалзагдсан байна. Админтай холбогдоно уу." });
        }
        if ((user as any).status === "invited") {
          console.log("[AUTH DEBUG] FAIL: User status is invited");
          return done(null, false, { message: "Та имэйлээр ирсэн урилгын линкээр нууц үгээ тохируулна уу." });
        }

        console.log("[AUTH DEBUG] SUCCESS: Login OK for user:", { id: user.id, username: user.username, email: user.email });
        return done(null, user);
      } catch (err) {
        console.error("[AUTH DEBUG] ERROR in LocalStrategy:", err);
        return done(err);
      }
    }),
  );

  // Google OAuth Strategy
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (googleClientId && googleClientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: `${process.env.APP_URL || "http://localhost:5000"}/api/auth/google/callback`,
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            const googleEmail = profile.emails?.[0]?.value;
            const isEmailVerified = profile.emails?.[0]?.verified;
            if (!googleEmail) {
              return done(new Error("google_email_not_found"), undefined);
            }
            if (isEmailVerified === false) {
              return done(new Error("google_email_not_verified"), undefined);
            }
            if (!googleEmail.toLowerCase().endsWith("@mtcone.net")) {
              return done(new Error("unauthorized_domain"), undefined);
            }

            // Check if user exists
            let user = await storage.getUserByEmail(googleEmail);

            if (!user) {
              // Find the existing company tenant (we have one company: mtcone.net)
              // Look up the first active tenant instead of relying on DEFAULT_TENANT_ID env
              const { db } = await import("./db");
              const { tenants } = await import("@shared/schema");
              const { asc } = await import("drizzle-orm");

              const [firstTenant] = await db
                .select()
                .from(tenants)
                .orderBy(asc(tenants.createdAt))
                .limit(1);

              if (!firstTenant) {
                console.error("Google OAuth: No tenant found in database. Please create a company first.");
                return done(new Error("no_tenant"), undefined);
              }

              const dummyPassword = randomBytes(32).toString("hex");
              const hashedPassword = await hashPassword(dummyPassword);

              user = await storage.createUser({
                tenantId: firstTenant.id,
                email: googleEmail,
                username: googleEmail,
                passwordHash: hashedPassword,
                fullName: profile.displayName || profile.name?.givenName || googleEmail,
                isActive: true,
                status: "active",
              });

              // Auto-link to Employee record if email matches
              await storage.linkUserToEmployeeByEmail(user.id, googleEmail, firstTenant.id);

              // Check if employee was linked. If not, auto-create one.
              const existingEmployee = await storage.getEmployeeByUserId(user.id);
              if (!existingEmployee) {
                await storage.createEmployee({
                  tenantId: firstTenant.id,
                  userId: user.id,
                  firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || googleEmail.split('@')[0],
                  lastName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '',
                  email: googleEmail,
                  hireDate: new Date().toISOString().split('T')[0],
                  status: "active",
                });
                console.log(`Google OAuth: Created new employee profile for ${googleEmail}`);
              }

              console.log(`Google OAuth: Created new user ${googleEmail} under tenant ${firstTenant.name}`);
            }

            return done(null, user);
          } catch (err: any) {
            return done(err, undefined);
          }
        }
      )
    );
  }

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (user) {
        // Attach employeeId if linked
        const employee = await storage.getEmployeeByUserId(user.id);
        if (employee) {
          (user as any).employeeId = employee.id;
        }

        // Attach RBAC roles and permissions flags for easier frontend checks
        const userRoles = await storage.getUserRoles(user.id);
        const userPermissions = await storage.getUserPermissions(user.id);
        (user as any).userRoles = userRoles;
        (user as any).permissions = userPermissions.map((p: any) => `${p.resource}.${p.action}`);
        (user as any).isAdmin = userRoles.some((r: any) => r.name.toLowerCase() === "admin" || r.isSystem) || user.role === 'Admin';
        (user as any).isHR = userRoles.some((r: any) => r.name.toLowerCase() === "hr") || user.role === 'HR' || (user as any).isAdmin;
        (user as any).isManager = userRoles.some((r: any) => r.name.toLowerCase() === "manager") || user.role === 'Manager';
      }
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/auth/register", createRateLimiter(15 * 60 * 1000, 5), async (req, res, next) => {
    try {
      // Password strength validation
      const passwordValidation = validatePasswordStrength(req.body.password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }

      const { username, email, password, fullName, companyCode, companyName } = req.body;

      // Normalize email for matching
      const normalizedEmail = email?.trim().toLowerCase();

      // Domain check
      if (normalizedEmail && !normalizedEmail.endsWith('@mtcone.net')) {
        return res.status(400).json({ message: "Зөвхөн @mtcone.net хаягаар бүртгүүлэх боломжтой" });
      }

      // Check for existing username (global check)
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Нэвтрэх нэр бүртгэлтэй байна" });
      }

      const hashedPassword = await hashPassword(password);
      let tenant;
      let userStatus = "active";
      let userRole = "Admin";

      // ============================================
      // SCENARIO A: Join Existing Company (by code)
      // ============================================
      if (companyCode && companyCode.trim()) {
        const code = companyCode.trim().toUpperCase();
        tenant = await storage.getTenantByCode(code);

        if (!tenant) {
          return res.status(400).json({ message: "Компанийн код буруу байна. HR-аасаа зөв код авна уу." });
        }

        // Check if email already exists in this tenant
        const existingEmailInTenant = await storage.getUserByEmailInTenant(normalizedEmail, tenant.id);
        if (existingEmailInTenant) {
          return res.status(400).json({ message: "Энэ имэйл хаяг аль хэдийн энэ компанид бүртгэлтэй байна" });
        }

        userStatus = "pending"; // Requires admin approval
        userRole = "User"; // Regular employee

        // Create user with pending status
        const user = await storage.createUser({
          tenantId: tenant.id,
          email: normalizedEmail,
          username,
          passwordHash: hashedPassword,
          fullName: fullName || username,
          status: userStatus,
          role: userRole,
          isActive: true,
        });

        // Auto-link to Employee if exists with matching email
        await storage.linkUserToEmployeeByEmail(user.id, normalizedEmail, tenant.id);

        // Return success but don't login (pending approval)
        return res.status(201).json({
          message: "Бүртгэл амжилттай. Админ баталгаажуулахыг хүлээнэ үү.",
          status: "pending",
          companyName: tenant.name,
        });
      }

      // ============================================
      // SCENARIO B: Create New Company (Admin/Owner)
      // ============================================
      else {
        if (!companyName || !companyName.trim()) {
          return res.status(400).json({ message: "Компанийн нэр эсвэл код шаардлагатай" });
        }

        // Generate unique company code (format: ERP-XXXX)
        const generatedCode = await storage.generateUniqueCompanyCode();

        // Create new tenant
        tenant = await storage.createTenant({
          name: companyName.trim(),
          code: generatedCode,
          countryCode: "MN",
          timezone: "Asia/Ulaanbaatar",
          currencyCode: "MNT",
          status: "active"
        });

        userStatus = "active"; // Owner is active immediately
        userRole = "Admin";

        // Create user (Admin/Owner)
        const user = await storage.createUser({
          tenantId: tenant.id,
          email: normalizedEmail,
          username,
          passwordHash: hashedPassword,
          fullName: fullName || username,
          status: userStatus,
          role: userRole,
          isActive: true,
        });

        // Auto-create Employee profile for owner
        await storage.createEmployee({
          tenantId: tenant.id,
          userId: user.id,
          firstName: fullName?.split(' ')[0] || username,
          lastName: fullName?.split(' ').slice(1).join(' ') || '',
          email: normalizedEmail,
          hireDate: new Date().toISOString().split('T')[0],
          status: "active",
        });

        // Login immediately (new owner)
        req.login(user, (err) => {
          if (err) return next(err);
          res.status(201).json({
            ...user,
            companyCode: generatedCode,
            message: `Компани амжилттай үүслээ! Таны компанийн код: ${generatedCode}`,
          });
        });
      }
    } catch (err) {
      next(err);
    }
  });

  // Forgot Password - Request reset token
  app.post("/api/auth/forgot-password", createRateLimiter(15 * 60 * 1000, 3), async (req, res, next) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      // Don't reveal if user exists (security best practice)
      if (!user) {
        return res.status(200).json({ message: "If the user exists, a password reset email would be sent." });
      }

      // Generate reset token
      const resetToken = randomBytes(32).toString("hex");
      // Use SHA256 for deterministic hashing (can compare later)
      const tokenHash = createHash("sha256").update(resetToken).digest("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store token in database (using raw SQL since table not in schema yet)
      // Mark old tokens as used first
      const { pool } = await import("./db");
      await pool.query(
        `UPDATE password_reset_tokens SET used = true WHERE user_id = $1 AND used = false`,
        [user.id]
      );

      // Insert new token
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );

      // Send email with reset token
      try {
        const { sendPasswordResetEmail } = await import("./email");
        await sendPasswordResetEmail(user.email, resetToken, user.fullName || undefined);

        res.status(200).json({
          message: "Нууц үг сэргээх линк имэйлээр илгээгдлээ. Имэйлээ шалгана уу.",
        });
      } catch (emailError: any) {
        // If email fails in development, return token for testing
        if (process.env.NODE_ENV === "development") {
          console.warn("⚠️  Email sending failed, returning token in dev mode:", emailError.message);
          return res.status(200).json({
            message: "Password reset token generated (dev mode - email failed)",
            resetToken,
          });
        }

        // In production, don't reveal token even if email fails
        console.error("Email sending failed:", emailError);
        res.status(200).json({
          message: "If the user exists, a password reset email would be sent.",
        });
      }
    } catch (err) {
      next(err);
    }
  });

  // Reset Password - Use token to reset password
  app.post("/api/auth/reset-password", createRateLimiter(15 * 60 * 1000, 5), async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      // Password strength validation
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }

      // Hash the provided token to compare with stored hash
      const tokenHash = createHash("sha256").update(token).digest("hex");

      // Find token in database
      const { pool } = await import("./db");
      const tokenResult = await pool.query(
        `SELECT prt.*, u.id as user_id, u.email
         FROM password_reset_tokens prt
         JOIN users u ON u.id = prt.user_id
         WHERE prt.token_hash = $1 AND prt.expires_at > now() AND prt.used = false
         LIMIT 1`,
        [tokenHash]
      );

      if (tokenResult.rows.length === 0) {
        return res.status(400).json({ message: "Invalid or expired reset token" });
      }

      const validToken = tokenResult.rows[0];

      // Update password
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(validToken.user_id, { passwordHash: hashedPassword });

      // Mark token as used
      await pool.query(
        `UPDATE password_reset_tokens SET used = true WHERE id = $1`,
        [validToken.id]
      );

      res.status(200).json({ message: "Password reset successfully" });
    } catch (err) {
      next(err);
    }
  });

  // Accept Invitation - Use token to set initial password
  app.post("/api/auth/accept-invitation", createRateLimiter(15 * 60 * 1000, 5), async (req, res, next) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      // Password strength validation
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }

      // Hash the provided token with SHA256 to compare with stored hash
      const shaTokenHash = createHash("sha256").update(token).digest("hex");

      const { db } = await import("./db");
      const { users } = await import("@shared/schema");
      
      const userResult = await db.query.users.findFirst({
        where: (t: any, { eq, and, gt }: any) => and(
          eq(t.inviteTokenHash, shaTokenHash),
          eq(t.status, "invited"),
          gt(t.inviteExpiresAt, new Date())
        )
      });

      if (!userResult) {
        return res.status(400).json({ message: "Invalid or expired invitation token" });
      }

      // Update password and status
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(userResult.id, { 
        passwordHash: hashedPassword,
        inviteTokenHash: null,
        inviteExpiresAt: null,
        status: "active",
        mustChangePassword: false
      });

      res.status(200).json({ message: "Invitation accepted. You can now log in." });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/login", createRateLimiter(15 * 60 * 1000, 5), async (req, res, next) => {
    console.log("[AUTH DEBUG] POST /api/auth/login - body:", { username: req.body?.username, email: req.body?.email, passwordLength: req.body?.password?.length });
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) {
        console.error("[AUTH DEBUG] passport.authenticate error:", err);
        return next(err);
      }
      if (!user) {
        console.log("[AUTH DEBUG] passport.authenticate returned no user, info:", info);
        return res.status(401).json({ message: info?.message || "Invalid username or password" });
      }

      // Check if 2FA is enabled
      const userData = await storage.getUser(user.id);
      if (userData?.twoFactorEnabled) {
        // Store user in session temporarily (not fully authenticated yet)
        (req.session as any).pending2FA = { userId: user.id };
        return res.status(200).json({
          requires2FA: true,
          message: "2FA verification required",
        });
      }

      // No 2FA, proceed with normal login
      req.login(user, async (err) => {
        if (err) return next(err);
        // Update last login time
        storage.updateUserLastLogin(user.id).catch(console.error);
        // Track session
        await insertUserSession(req, user);
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  // 2FA verification endpoint (after initial login)
  app.post("/api/auth/2fa/verify-login", createRateLimiter(15 * 60 * 1000, 5), async (req, res, next) => {
    try {
      const { token } = req.body;
      const pending2FA = (req.session as any).pending2FA;

      if (!pending2FA?.userId) {
        return res.status(400).json({ message: "No pending 2FA verification" });
      }

      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "TOTP token required" });
      }

      const user = await storage.getUser(pending2FA.userId);
      if (!user || !user.twoFactorSecret) {
        return res.status(400).json({ message: "2FA not configured" });
      }

      const { verify2FAToken } = await import("./two-factor");
      const isValid = verify2FAToken(user.twoFactorSecret, token);

      if (!isValid) {
        return res.status(400).json({ message: "Invalid TOTP token" });
      }

      // 2FA verified, complete login
      req.login(user, async (err) => {
        if (err) return next(err);
        delete (req.session as any).pending2FA;
        storage.updateUserLastLogin(user.id).catch(console.error);
        // Track session
        await insertUserSession(req, user);
        res.status(200).json(user);
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/logout", async (req, res, next) => {
    // Revoke session before logout
    await revokeUserSession(req);
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  // Helper middleware for authenticated routes
  function requireAuth(req: any, res: any, next: any) {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  }

  // 2FA Routes
  app.get("/api/auth/2fa/setup", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      if (!user || !user.email) {
        return res.status(400).json({ message: "User email not found" });
      }

      const { generate2FASecret, generate2FAQRCode } = await import("./two-factor");

      // Generate new secret
      const { secret, otpauthUrl } = generate2FASecret(user.email, "MonERP");

      if (!secret || !otpauthUrl) {
        return res.status(500).json({ message: "Failed to generate 2FA secret" });
      }

      // Generate QR code
      let qrCode: string;
      try {
        qrCode = await generate2FAQRCode(otpauthUrl);
      } catch (qrError: any) {
        console.error("QR code generation error:", qrError);
        return res.status(500).json({
          message: "Failed to generate QR code",
          error: qrError.message
        });
      }

      // Store secret temporarily (user needs to verify before enabling)
      // In production, encrypt this secret
      try {
        await storage.updateUser(user.id, { twoFactorSecret: secret });
      } catch (updateError: any) {
        console.error("Failed to update user secret:", updateError);
        return res.status(500).json({
          message: "Failed to save secret",
          error: updateError.message
        });
      }

      res.json({
        secret,
        qrCode,
        otpauthUrl,
      });
    } catch (err: any) {
      console.error("2FA setup error:", err);
      res.status(500).json({
        message: "Internal server error",
        error: err.message
      });
    }
  });

  app.post("/api/auth/2fa/verify", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const { token } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ message: "TOTP token required" });
      }

      const userData = await storage.getUser(user.id);
      if (!userData?.twoFactorSecret) {
        return res.status(400).json({ message: "2FA not set up. Please generate a secret first." });
      }

      const { verify2FAToken } = await import("./two-factor");
      const isValid = verify2FAToken(userData.twoFactorSecret, token);

      if (!isValid) {
        return res.status(400).json({ message: "Invalid TOTP token" });
      }

      // Enable 2FA after successful verification
      await storage.updateUser(user.id, { twoFactorEnabled: true });

      res.json({ message: "2FA enabled successfully" });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/2fa/disable", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const { token } = req.body;

      // Verify token before disabling
      const userData = await storage.getUser(user.id);
      if (!userData?.twoFactorSecret) {
        return res.status(400).json({ message: "2FA not enabled" });
      }

      if (token) {
        const { verify2FAToken } = await import("./two-factor");
        const isValid = verify2FAToken(userData.twoFactorSecret, token);
        if (!isValid) {
          return res.status(400).json({ message: "Invalid TOTP token" });
        }
      }

      // Disable 2FA
      await storage.updateUser(user.id, {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      });

      res.json({ message: "2FA disabled successfully" });
    } catch (err) {
      next(err);
    }
  });

  // Change Password - Requires old password
  app.post("/api/auth/change-password", requireAuth, createRateLimiter(15 * 60 * 1000, 5), async (req, res, next) => {
    try {
      const user = req.user as User;
      const { oldPassword, newPassword } = req.body;

      if (!oldPassword || !newPassword) {
        return res.status(400).json({ message: "Old password and new password are required" });
      }

      // Get current user data
      const userData = await storage.getUser(user.id);
      if (!userData) {
        return res.status(400).json({ message: "User not found" });
      }

      // Verify old password
      if (!userData.passwordHash) {
        return res.status(400).json({ message: "Нууцүг тохируулагдаагүй байна. Имэйлээр ирсэн урилгын линкээр нууц үгээ тохируулна уу." });
      }
      const isOldPasswordValid = await comparePasswords(oldPassword, userData.passwordHash);
      if (!isOldPasswordValid) {
        return res.status(400).json({ message: "Хуучин нууц үг буруу байна" });
      }

      // Validate new password strength
      const passwordValidation = validatePasswordStrength(newPassword);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }

      // Check if new password is different from old password
      if (oldPassword === newPassword) {
        return res.status(400).json({ message: "Шинэ нууц үг хуучин нууц үгтэй ижил байж болохгүй" });
      }

      // Update password and clear mustChangePassword flag
      const hashedPassword = await hashPassword(newPassword);
      await storage.updateUser(user.id, {
        passwordHash: hashedPassword,
        mustChangePassword: false  // Clear the first-login flag
      });

      res.status(200).json({ message: "Нууц үг амжилттай солигдлоо" });
    } catch (err) {
      next(err);
    }
  });

  // Get User Profile (own info)
  app.get("/api/auth/profile", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const userData = await storage.getUser(user.id);
      if (!userData) {
        return res.status(404).json({ message: "User not found" });
      }
      // Don't send password hash
      const { passwordHash, ...safeUser } = userData;
      res.json(safeUser);
    } catch (err) {
      next(err);
    }
  });

  // Update User Profile (own info)
  app.put("/api/auth/profile", requireAuth, createRateLimiter(15 * 60 * 1000, 10), async (req, res, next) => {
    try {
      const user = req.user as User;
      const { fullName, email } = req.body;

      // Validate email if provided
      if (email && email !== user.email) {
        // Check if email is already taken
        const existingUser = await storage.getUserByUsername(email);
        if (existingUser && existingUser.id !== user.id) {
          return res.status(400).json({ message: "Имэйл хаяг аль хэдийн бүртгэлтэй байна" });
        }
      }

      // Update user profile
      const updates: any = {};
      if (fullName !== undefined) updates.fullName = fullName;
      if (email !== undefined) updates.email = email;

      const updatedUser = await storage.updateUser(user.id, updates);

      // Don't send password hash
      const { passwordHash, ...safeUser } = updatedUser;
      res.json(safeUser);
    } catch (err) {
      next(err);
    }
  });

  // Update User Settings
  app.patch("/api/auth/settings", requireAuth, async (req, res, next) => {
    try {
      const user = req.user as User;
      const { settings } = req.body;

      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ message: "Settings object required" });
      }

      // Merge existing settings with new settings
      const currentSettings = (user.settings as any) || {};
      const newSettings = { ...currentSettings, ...settings };

      const updatedUser = await storage.updateUser(user.id, { settings: newSettings });

      res.json(updatedUser.settings);
    } catch (err) {
      next(err);
    }
  });

  // Google OAuth Routes
  if (googleClientId && googleClientSecret) {
    app.get("/api/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

    app.get(
      "/api/auth/google/callback",
      (req, res, next) => {
        passport.authenticate("google", (err: any, user: any, info: any) => {
          if (err) {
            if (err.message === "unauthorized_domain") {
              return res.redirect("/login?error=domain");
            }
            if (err.message === "google_email_not_verified") {
              return res.redirect("/login?error=unverified_email");
            }
            if (err.message === "no_tenant") {
              return res.redirect("/login?error=no_tenant");
            }
            console.error("Google OAuth error:", err);
            return res.redirect("/login?error=google_auth_failed");
          }
          if (!user) {
            return res.redirect("/login?error=google_auth_failed");
          }
          req.login(user, async (loginErr) => {
            if (loginErr) return res.redirect("/login?error=google_auth_failed");
            storage.updateUserLastLogin(user.id).catch(console.error);
            await insertUserSession(req, user);
            
            req.session.save((err) => {
              if (err) console.error("Google OAuth session save error:", err);
              return res.redirect("/");
            });
          });
        })(req, res, next);
      }
    );
  }
}
