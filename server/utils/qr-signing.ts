/**
 * QR Digital ID - HMAC Signing Utilities
 * Used for generating tamper-proof QR codes for employee verification
 */

import crypto from 'crypto';

const QR_SECRET = process.env.QR_SECRET || 'erp_qr_secret_change_in_production';

export interface QRPayload {
    v: number;           // Version
    tenantId: string;
    employeeCode: string;
    iat: number;         // Issued at (unix timestamp)
    exp: number;         // Expires at (unix timestamp)
    nonce: string;       // Random string for replay protection
}

/**
 * Generate a signed QR string for an employee
 */
export function signPayload(payload: QRPayload): string {
    const payloadJson = JSON.stringify(payload);
    const payloadB64 = Buffer.from(payloadJson).toString('base64url');

    const signature = crypto
        .createHmac('sha256', QR_SECRET)
        .update(payloadB64)
        .digest('base64url');

    return `${payloadB64}.${signature}`;
}

/**
 * Generate QR payload for an employee
 * @param tenantId - The tenant UUID
 * @param employeeCode - The employee code (e.g., "EMP00123")
 * @param expiryMinutes - How long the QR is valid (default: 60 minutes)
 */
export function generateQRPayload(
    tenantId: string,
    employeeCode: string,
    expiryMinutes: number = 60
): { payload: QRPayload; qrString: string } {
    const now = Math.floor(Date.now() / 1000);

    const payload: QRPayload = {
        v: 1,
        tenantId,
        employeeCode,
        iat: now,
        exp: now + (expiryMinutes * 60),
        nonce: crypto.randomBytes(4).toString('hex'),
    };

    const qrString = signPayload(payload);

    return { payload, qrString };
}

export interface VerifyResult {
    valid: boolean;
    payload?: QRPayload;
    error?: string;
}

/**
 * Verify a QR string and extract the payload
 */
export function verifyQrString(qrString: string): VerifyResult {
    try {
        const parts = qrString.split('.');
        if (parts.length !== 2) {
            return { valid: false, error: 'Invalid QR format' };
        }

        const [payloadB64, signature] = parts;

        // Verify signature
        const expectedSig = crypto
            .createHmac('sha256', QR_SECRET)
            .update(payloadB64)
            .digest('base64url');

        if (signature !== expectedSig) {
            return { valid: false, error: 'Invalid signature' };
        }

        // Decode and parse payload
        const payloadJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
        const payload: QRPayload = JSON.parse(payloadJson);

        // Check expiry
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
            return { valid: false, error: 'QR code expired' };
        }

        return { valid: true, payload };
    } catch (e) {
        return { valid: false, error: 'Failed to parse QR' };
    }
}

/**
 * Hash a session token for storage
 */
export function hashSessionToken(sessionId: string): string {
    return crypto.createHash('sha256').update(sessionId).digest('hex');
}

/**
 * Parse User-Agent to get a friendly device name
 */
export function parseDeviceName(userAgent: string | undefined): string {
    if (!userAgent) return 'Unknown Device';

    // Simple parsing - in production use a proper UA parser
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('Windows')) {
        if (userAgent.includes('Edge')) return 'Edge (Windows)';
        if (userAgent.includes('Chrome')) return 'Chrome (Windows)';
        if (userAgent.includes('Firefox')) return 'Firefox (Windows)';
        return 'Windows Device';
    }
    if (userAgent.includes('Mac')) {
        if (userAgent.includes('Chrome')) return 'Chrome (Mac)';
        if (userAgent.includes('Safari')) return 'Safari (Mac)';
        if (userAgent.includes('Firefox')) return 'Firefox (Mac)';
        return 'Mac Device';
    }
    if (userAgent.includes('Linux')) return 'Linux Device';

    return 'Unknown Device';
}
