import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getAdminPassword,
  createSessionToken,
  verifySessionToken,
  checkRateLimit,
  recordFailedAttempt,
  resetAttempts,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    const token = match ? decodeURIComponent(match[1]) : null;

    const isValid = token ? verifySessionToken(token) : false;

    return NextResponse.json({
      success: true,
      authenticated: isValid,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, authenticated: false, error: error?.message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const forwarded = request.headers.get('x-forwarded-for');
    const clientIp = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

    // 1. Rate limiting check
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      const waitMinutes = Math.ceil(rateCheck.remainingMs / 60000);
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed login attempts. Please wait ${waitMinutes} minute(s) before trying again.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Password is required' },
        { status: 400 }
      );
    }

    const correctPassword = getAdminPassword();

    // Constant-time comparison to prevent timing attacks
    const inputBuf = Buffer.from(password.trim());
    const targetBuf = Buffer.from(correctPassword.trim());

    const isMatch =
      inputBuf.length === targetBuf.length &&
      crypto.timingSafeEqual(inputBuf, targetBuf);

    if (!isMatch) {
      recordFailedAttempt(clientIp);
      return NextResponse.json(
        { success: false, error: 'Invalid administrator credentials. Access denied.' },
        { status: 401 }
      );
    }

    // Success: reset rate limit & issue signed session token
    resetAttempts(clientIp);
    const sessionToken = createSessionToken();

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = [
      `${SESSION_COOKIE_NAME}=${sessionToken}`,
      'Path=/',
      `Max-Age=${SESSION_TTL_SECONDS}`,
      'HttpOnly',
      'SameSite=Lax',
      isProduction ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ');

    const response = NextResponse.json({
      success: true,
      message: 'Admin authentication successful',
      token: sessionToken,
    });

    response.headers.set('Set-Cookie', cookieOptions);
    return response;
  } catch (error: any) {
    console.error('Admin login error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error during authentication' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
    isProduction ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');

  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  response.headers.set('Set-Cookie', cookieOptions);
  return response;
}
