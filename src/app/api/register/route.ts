import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getTournamentBySlugAsync,
  incrementRegistrationCount,
  savePlayerRegistration,
  MASTER_GOOGLE_SHEET_URL,
} from '@/lib/tournamentStore';

export async function POST(request: Request) {
  try {
    const payload = await request.json();

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

    // Strict validation for required fields
    if (!fullName || !phone || !age || !role || !battingStyle || !bowlingStyle) {
      return NextResponse.json(
        { success: false, error: 'Missing mandatory registration fields' },
        { status: 400 }
      );
    }

    // Lookup tournament details if slug provided
    const tournament = tournamentSlug ? await getTournamentBySlugAsync(tournamentSlug) : null;
    const isPaidTournament = tournament ? tournament.isPaid : false;
    const tournamentTitle = tournament ? tournament.title : 'Cricket Tournament 2026';
    const tournamentEntryFee = tournament ? tournament.entryFee : (Number(process.env.NEXT_PUBLIC_REGISTRATION_FEE) || 499);

    let finalPaymentStatus: 'PAID' | 'FREE' = 'FREE';
    let finalPaymentId = paymentId || 'FREE_REGISTRATION';

    if (isPaidTournament) {
      // Payment is strictly required for Paid tournaments
      if (!paymentId) {
        return NextResponse.json(
          { success: false, error: 'Payment is required for this tournament' },
          { status: 402 }
        );
      }
      finalPaymentStatus = 'PAID';
      finalPaymentId = paymentId;

      // Optional signature verification if real Razorpay secret is present
      const keySecret = tournament?.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET;
      if (
        keySecret &&
        !keySecret.includes('placeholder') &&
        orderId &&
        signature &&
        !orderId.startsWith('order_mock_')
      ) {
        const generatedSignature = crypto
          .createHmac('sha256', keySecret)
          .update(`${orderId}|${paymentId}`)
          .digest('hex');

        if (generatedSignature !== signature) {
          return NextResponse.json(
            { success: false, error: 'Razorpay signature verification failed' },
            { status: 403 }
          );
        }
      }
    } else {
      // Free Registration Mode
      finalPaymentStatus = 'FREE';
      finalPaymentId = 'FREE_ENTRY';
    }

    const timestamp = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'medium',
    });

    const finalRegId =
      registrationId ||
      `CRIC-2026-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Payload for Google Apps Script Web App and local database
    const registrationRecord = {
      timestamp,
      registrationId: finalRegId,
      tournamentSlug: tournamentSlug || 'general',
      tournamentTitle,
      fullName: fullName.trim(),
      phone: phone.trim(),
      age: String(age),
      role,
      battingStyle,
      bowlingStyle,
      stats: stats?.trim() || 'No previous achievements provided',
      photoUrl: photoUrl || '',
      paymentId: finalPaymentId,
      orderId: orderId || 'N/A',
      paymentStatus: finalPaymentStatus,
      amount: isPaidTournament ? tournamentEntryFee : 0,
    };

    // Save to persistent players database
    savePlayerRegistration(registrationRecord);

    // Increment count in tournament store
    if (tournamentSlug) {
      incrementRegistrationCount(tournamentSlug);
    }

    let sheetSyncSuccess = false;
    let sheetSyncMessage = 'Not configured';

    // Prioritize tournament-specific Google Sheet URL, fallback to master sheet URL
    const targetSheetUrl =
      (tournament && tournament.googleSheetUrl && tournament.googleSheetUrl.startsWith('http'))
        ? tournament.googleSheetUrl
        : (process.env.GOOGLE_SHEET_SCRIPT_URL || MASTER_GOOGLE_SHEET_URL);

    if (targetSheetUrl && targetSheetUrl.startsWith('http') && !targetSheetUrl.includes('YOUR_SCRIPT')) {
      try {
        const sheetResponse = await fetch(targetSheetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
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
      registration: {
        ...registrationRecord,
      },
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
