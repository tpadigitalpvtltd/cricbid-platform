import { NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import {
  getTournamentBySlugAsync,
  incrementRegistrationCount,
  savePlayerRegistration,
  getPlayersByTournament,
  getAllPlayers,
  MASTER_GOOGLE_SHEET_URL,
} from '@/lib/tournamentStore';
import { clean10DigitPhone, validatePhoneNumber } from '@/lib/utils';

const VALID_ROLES = [
  'Pure Batsman',
  'Fast Bowler',
  'Spin Bowler',
  'Batting All-Rounder',
  'Bowling All-Rounder',
  'Wicketkeeper-Batsman',
];

const VALID_BATTING_STYLES = ['Right-hand', 'Left-hand'];
const VALID_BOWLING_STYLES = [
  'Right-arm Fast',
  'Right-arm Spin',
  'Left-arm Fast',
  'Left-arm Spin',
  'None',
];

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));

    const {
      fullName,
      phone,
      age,
      role,
      battingStyle,
      bowlingStyle,
      stats,
      photoUrl,
      paymentId,
      orderId,
      signature,
      registrationId,
      tournamentSlug,
    } = payload;

    // 1. Mandatory Field Presence Check
    if (!fullName || !phone || !age || !role || !battingStyle || !bowlingStyle || !tournamentSlug) {
      return NextResponse.json(
        { success: false, error: 'Missing mandatory registration fields' },
        { status: 400 }
      );
    }

    // 2. Full Name Validation & Sanitization
    const trimmedName = String(fullName).trim();
    if (trimmedName.length < 2 || trimmedName.length > 70) {
      return NextResponse.json(
        { success: false, error: 'Full name must be between 2 and 70 characters' },
        { status: 400 }
      );
    }
    // Disallow HTML / script injection
    if (/[<>{}]/g.test(trimmedName)) {
      return NextResponse.json(
        { success: false, error: 'Full name contains invalid characters' },
        { status: 400 }
      );
    }

    // 3. Phone Validation & Normalization
    const rawPhone = String(phone).trim();
    if (!validatePhoneNumber(rawPhone)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid 10-digit Indian mobile number' },
        { status: 400 }
      );
    }
    const normalizedPhone = clean10DigitPhone(rawPhone);

    // 4. Age Validation
    const numericAge = parseInt(String(age), 10);
    if (isNaN(numericAge) || numericAge < 10 || numericAge > 70) {
      return NextResponse.json(
        { success: false, error: 'Player age must be a valid number between 10 and 70 years' },
        { status: 400 }
      );
    }

    // 5. Cricket Role & Style Enums Validation
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Invalid cricket role selected. Allowed: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!VALID_BATTING_STYLES.includes(battingStyle)) {
      return NextResponse.json(
        { success: false, error: 'Invalid batting style selected. Allowed: Right-hand, Left-hand' },
        { status: 400 }
      );
    }

    if (!VALID_BOWLING_STYLES.includes(bowlingStyle)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid bowling style selected. Allowed: ${VALID_BOWLING_STYLES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 6. Photo URL / Base64 Validation
    let sanitizedPhotoUrl = '';
    if (photoUrl && typeof photoUrl === 'string' && photoUrl.trim()) {
      const trimmedPhoto = photoUrl.trim();
      if (trimmedPhoto.startsWith('data:image/svg+xml')) {
        return NextResponse.json(
          { success: false, error: 'SVG image format is not permitted for security reasons' },
          { status: 400 }
        );
      }
      if (trimmedPhoto.startsWith('data:image/')) {
        // Must be jpeg, png, or webp base64
        if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(trimmedPhoto)) {
          return NextResponse.json(
            { success: false, error: 'Only JPEG, PNG, and WebP image formats are supported' },
            { status: 400 }
          );
        }
        // Limit base64 length to ~650KB to protect server memory & Google Sheets limits
        if (trimmedPhoto.length > 750000) {
          return NextResponse.json(
            { success: false, error: 'Image size exceeds maximum allowed upload limit (~500KB)' },
            { status: 400 }
          );
        }
        sanitizedPhotoUrl = trimmedPhoto;
      } else if (trimmedPhoto.startsWith('https://')) {
        sanitizedPhotoUrl = trimmedPhoto;
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid photo URL format. Must be HTTPS URL or image file' },
          { status: 400 }
        );
      }
    }

    // 7. Tournament Lookup
    const tournament = await getTournamentBySlugAsync(tournamentSlug);
    if (!tournament) {
      return NextResponse.json(
        { success: false, error: `Tournament '${tournamentSlug}' not found` },
        { status: 404 }
      );
    }

    // 8. Duplicate Registration Prevention for the same tournament
    const existingPlayersInTournament = getPlayersByTournament(tournament.slug);
    const isDuplicate = existingPlayersInTournament.some((p) => {
      const pClean = clean10DigitPhone(p.phone || '');
      return pClean === normalizedPhone;
    });

    if (isDuplicate) {
      return NextResponse.json(
        {
          success: false,
          error: `A player with mobile number +91 ${normalizedPhone} is already registered for ${tournament.title}.`,
        },
        { status: 409 }
      );
    }

    // 9. Server-Enforced Fee Integrity (Never trust client-supplied amount!)
    const isPaidTournament = Boolean(tournament.isPaid);
    const tournamentEntryFee = isPaidTournament ? (Number(tournament.entryFee) || 0) : 0;
    const expectedAmountInPaise = Math.round(tournamentEntryFee * 100);

    let finalPaymentStatus: 'PAID' | 'FREE' = 'FREE';
    let finalPaymentId = 'FREE_ENTRY';

    // 10. Payment Verification
    if (isPaidTournament) {
      if (!paymentId || typeof paymentId !== 'string' || !paymentId.trim()) {
        return NextResponse.json(
          { success: false, error: 'Payment transaction reference is required for paid registration' },
          { status: 402 }
        );
      }

      finalPaymentId = paymentId.trim();

      // Replay Attack Protection: Check if this paymentId was already used
      const allExisting = getAllPlayers();
      const isReplayed = allExisting.some(
        (p) =>
          p.paymentId &&
          p.paymentId !== 'FREE_ENTRY' &&
          p.paymentId !== 'FREE_REGISTRATION' &&
          p.paymentId === finalPaymentId
      );

      if (isReplayed) {
        return NextResponse.json(
          {
            success: false,
            error: 'This payment transaction reference has already been used for a registration.',
          },
          { status: 409 }
        );
      }

      const keyId =
        tournament.razorpayKeyId ||
        process.env.RAZORPAY_KEY_ID ||
        process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

      const keySecret =
        tournament.razorpayKeySecret ||
        process.env.RAZORPAY_KEY_SECRET;

      const isMockOrder =
        (orderId && String(orderId).startsWith('order_mock_')) ||
        !keySecret ||
        keySecret.includes('placeholder');

      if (isMockOrder) {
        // Mock mode registration
        finalPaymentStatus = 'PAID';
      } else {
        // Real Razorpay Credentials verification
        const razorpay = new Razorpay({
          key_id: keyId!,
          key_secret: keySecret!,
        });

        // If checkout HMAC signature is provided, verify it first
        if (orderId && signature && typeof signature === 'string') {
          const generatedSignature = crypto
            .createHmac('sha256', keySecret!)
            .update(`${orderId}|${finalPaymentId}`)
            .digest('hex');

          if (generatedSignature !== signature) {
            return NextResponse.json(
              { success: false, error: 'Payment signature verification failed' },
              { status: 403 }
            );
          }
        }

        // Verify payment directly with Razorpay API (handles Hosted Links & Checkout)
        try {
          const paymentRecord = await razorpay.payments.fetch(finalPaymentId);

          if (!paymentRecord) {
            return NextResponse.json(
              { success: false, error: 'Payment record could not be found with payment gateway' },
              { status: 400 }
            );
          }

          // Check payment capture status
          if (paymentRecord.status !== 'captured' && paymentRecord.status !== 'authorized') {
            return NextResponse.json(
              {
                success: false,
                error: `Payment is not completed (Current status: ${paymentRecord.status}). Registration cannot be confirmed.`,
              },
              { status: 402 }
            );
          }

          // Check amount integrity against server fee
          if (Number(paymentRecord.amount) !== expectedAmountInPaise) {
            return NextResponse.json(
              {
                success: false,
                error: `Payment amount mismatch: Paid ₹${Number(paymentRecord.amount) / 100}, but tournament entry fee is ₹${tournamentEntryFee}`,
              },
              { status: 400 }
            );
          }

          // Check currency
          if (paymentRecord.currency !== 'INR') {
            return NextResponse.json(
              { success: false, error: 'Invalid payment currency' },
              { status: 400 }
            );
          }

          // Check notes binding if present
          if (
            paymentRecord.notes &&
            paymentRecord.notes.tournamentSlug &&
            paymentRecord.notes.tournamentSlug !== tournament.slug
          ) {
            return NextResponse.json(
              { success: false, error: 'Payment is not associated with this tournament' },
              { status: 403 }
            );
          }

          finalPaymentStatus = 'PAID';
        } catch (rzpErr: any) {
          console.error('Razorpay payment fetch error:', rzpErr);
          return NextResponse.json(
            {
              success: false,
              error: `Unable to verify payment with Razorpay: ${rzpErr?.error?.description || rzpErr?.message || 'Invalid payment identifier'}`,
            },
            { status: 400 }
          );
        }
      }
    } else {
      // Free tournament
      finalPaymentStatus = 'FREE';
      finalPaymentId = 'FREE_ENTRY';
    }

    const timestamp = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'medium',
    });

    const finalRegId =
      registrationId && typeof registrationId === 'string' && registrationId.startsWith('CRIC-')
        ? registrationId
        : `CRIC-2026-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Sanitized player record
    const registrationRecord = {
      timestamp,
      registrationId: finalRegId,
      tournamentSlug: tournament.slug,
      tournamentTitle: tournament.title,
      fullName: trimmedName,
      phone: normalizedPhone,
      age: String(numericAge),
      role,
      battingStyle,
      bowlingStyle,
      stats: (stats && typeof stats === 'string') ? stats.trim().slice(0, 300) : 'No previous achievements provided',
      photoUrl: sanitizedPhotoUrl,
      paymentId: finalPaymentId,
      orderId: (orderId && typeof orderId === 'string') ? orderId.trim() : 'N/A',
      paymentStatus: finalPaymentStatus,
      amount: isPaidTournament ? tournamentEntryFee : 0,
    };

    // Save to persistent database
    savePlayerRegistration(registrationRecord);

    // Increment count in tournament store
    incrementRegistrationCount(tournament.slug);

    // Sync to Google Sheet
    let sheetSyncSuccess = false;
    let sheetSyncMessage = 'Not configured';

    const targetSheetUrl =
      (tournament.googleSheetUrl && tournament.googleSheetUrl.startsWith('http'))
        ? tournament.googleSheetUrl
        : (process.env.GOOGLE_SHEET_SCRIPT_URL || MASTER_GOOGLE_SHEET_URL);

    if (targetSheetUrl && targetSheetUrl.startsWith('http') && !targetSheetUrl.includes('YOUR_SCRIPT')) {
      try {
        const sheetResponse = await fetch(targetSheetUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(registrationRecord),
          redirect: 'follow',
        });

        if (sheetResponse.ok) {
          const sheetResult = await sheetResponse.json().catch(() => null);
          sheetSyncSuccess = true;
          sheetSyncMessage = sheetResult?.message || 'Synced with Google Sheet successfully';
        } else {
          sheetSyncMessage = `Google Apps Script returned status ${sheetResponse.status}`;
        }
      } catch (sheetError: any) {
        console.error('Failed to sync to Google Sheet:', sheetError);
        sheetSyncMessage = `Sync failed: ${sheetError?.message || 'Network error'}`;
      }
    } else {
      sheetSyncMessage = 'Google Sheet Script URL is not configured';
    }

    return NextResponse.json({
      success: true,
      message: isPaidTournament
        ? 'Player registered & fee verified successfully!'
        : 'Free player registration completed successfully!',
      registration: registrationRecord,
      sheetSync: {
        synced: sheetSyncSuccess,
        message: sheetSyncMessage,
      },
    });
  } catch (error: any) {
    console.error('Registration processing error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Server error while processing registration',
      },
      { status: 500 }
    );
  }
}
