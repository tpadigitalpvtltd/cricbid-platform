import crypto from 'crypto';
import { cookies } from 'next/headers';

const SESSION_COOKIE_NAME = 'cricbid_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

// In-memory rate limiting for admin login attempts
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes lockout

/**
 * Get server-side admin secret from environment.
 * Never use NEXT_PUBLIC_ for admin passwords!
 */
export function getAdminPassword(): string {
  return (
    process.env.ADMIN_PASSWORD ||
    process.env.ADMIN_PIN ||
    process.env.NEXT_PUBLIC_ADMIN_PIN ||
    process.env.CRICBID_ADMIN_SECRET ||
    'Shoaib@55' // Fallback for backward compatibility during migration
  );
}

/**
 * Get session signing secret
 */
function getSessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    process.env.RAZORPAY_KEY_SECRET ||
    'cricbid_session_signing_secret_2026'
  );
}

/**
 * Check rate limit for IP
 */
export function checkRateLimit(ip: string): { allowed: boolean; remainingMs: number } {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record) {
    return { allowed: true, remainingMs: 0 };
  }

  if (record.count >= MAX_ATTEMPTS) {
    const elapsed = now - record.lastAttempt;
    if (elapsed < LOCKOUT_MS) {
      return { allowed: false, remainingMs: LOCKOUT_MS - elapsed };
    }
    // Lockout expired, reset
    loginAttempts.delete(ip);
    return { allowed: true, remainingMs: 0 };
  }

  return { allowed: true, remainingMs: 0 };
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(ip: string): void {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, lastAttempt: now };
  record.count += 1;
  record.lastAttempt = now;
  loginAttempts.set(ip, record);
}

/**
 * Reset failed attempts upon successful login
 */
export function resetAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

/**
 * Generate a cryptographically signed session token
 */
export function createSessionToken(): string {
  const payload = {
    role: 'super_admin',
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadStr)
    .digest('base64url');

  return `${payloadStr}.${signature}`;
}

/**
 * Verify a session token's cryptographic signature and expiration
 */
export function verifySessionToken(token: string): boolean {
  if (!token || !token.includes('.')) return false;

  const [payloadStr, signature] = token.split('.');
  if (!payloadStr || !signature) return false;

  const expectedSignature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payloadStr)
    .digest('base64url');

  // Constant-time comparison
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadStr, 'base64url').toString('utf-8'));
    if (!payload || payload.role !== 'super_admin') return false;
    if (typeof payload.expiresAt === 'number' && Date.now() > payload.expiresAt) {
      return false; // Expired
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate incoming request for admin authorization
 * Checks both session cookie and Authorization: Bearer token
 */
export function verifyAdminSession(request: Request): boolean {
  // 1. Check Authorization Bearer header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (verifySessionToken(token)) {
      return true;
    }
  }

  // 2. Check Cookie header
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  if (match && match[1]) {
    const token = decodeURIComponent(match[1]);
    if (verifySessionToken(token)) {
      return true;
    }
  }

  return false;
}

export { SESSION_COOKIE_NAME, SESSION_TTL_SECONDS };
