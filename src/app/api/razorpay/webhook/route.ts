import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  getTournamentBySlugAsync,
  incrementRegistrationCountAsync,
  savePlayerRegistrationAsync,
  getAllPlayersAsync,
} from '@/lib/tournamentStore';
import { clean10DigitPhone } from '@/lib/utils';
import { PlayingRole, RegistrationSubmission } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const webhookSecret =
      process.env.RAZORPAY_WEBHOOK_SECRET ||
      process.env.RAZORPAY_KEY_SECRET;

    if (!webhookSecret) {
      console.warn('Razorpay webhook secret is not configured.');
      return NextResponse.json(
        { success: false, error: 'Webhook secret is not configured on server' },
        { status: 500 }
      );
    }

    const signature = request.headers.get('x-razorpay-signature');
    if (!signature) {
      return NextResponse.json(
        { success: false, error: 'Missing x-razorpay-signature header' },
        { status: 400 }
      );
    }

    const rawBody = await request.text();

    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      console.warn('Invalid Razorpay webhook signature');
      return NextResponse.json(
        { success: false, error: 'Invalid webhook signature' },
        { status: 403 }
      );
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;

    // Handle payment.captured, payment_link.paid, or order.paid
    if (
      eventType === 'payment.captured' ||
      eventType === 'payment_link.paid' ||
      eventType === 'order.paid'
    ) {
      const payment =
        event.payload?.payment?.entity ||
        event.payload?.payment_link?.entity;

      if (!payment) {
        return NextResponse.json({ success: true, message: 'No payment entity found' });
      }

      const paymentId = payment.id;
      const tournamentSlug =
        payment.notes?.tournamentSlug || payment.notes?.tournament_slug;
      const playerName =
        payment.notes?.fullName ||
        payment.notes?.player_name ||
        payment.customer?.name ||
        'Verified Player';
      const playerPhone =
        payment.notes?.phone || payment.contact || payment.customer?.contact || '';
      const amount = payment.amount ? payment.amount / 100 : 0;

      if (!tournamentSlug) {
        return NextResponse.json({
          success: true,
          message: 'Ignored: Payment has no tournament association in notes',
        });
      }

      // Check if registration already exists for this paymentId (Idempotency)
      const existing = await getAllPlayersAsync();
      const alreadyLogged = existing.some((p) => p.paymentId === paymentId);

      if (alreadyLogged) {
        return NextResponse.json({
          success: true,
          message: 'Payment already reconciled with existing registration',
        });
      }

      const tournament = await getTournamentBySlugAsync(tournamentSlug);
      if (tournament) {
        const timestamp = new Date().toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          dateStyle: 'medium',
          timeStyle: 'medium',
        });

        const newRecord: RegistrationSubmission = {
          timestamp,
          registrationId: `CRIC-2026-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
          tournamentSlug: tournament.slug,
          tournamentTitle: tournament.title,
          fullName: String(playerName),
          phone: clean10DigitPhone(playerPhone),
          age: '24',
          role: 'Batting All-Rounder' as PlayingRole,
          battingStyle: 'Right-hand',
          bowlingStyle: 'Right-arm Fast',
          stats: 'Reconciled via Razorpay Webhook',
          photoUrl: '',
          paymentId: paymentId,
          orderId: payment.order_id || 'WEBHOOK',
          paymentStatus: 'PAID',
          amount: amount || (tournament.entryFee || 0),
        };

        await savePlayerRegistrationAsync(newRecord);
        await incrementRegistrationCountAsync(tournament.slug);
      }
    }

    return NextResponse.json({ success: true, received: true });
  } catch (error: any) {
    console.error('Razorpay webhook processing error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
