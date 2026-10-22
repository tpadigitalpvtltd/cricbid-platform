import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getTournamentBySlugAsync } from '@/lib/tournamentStore';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tournamentSlug, fullName, phone } = body;

    let tournament = null;
    if (tournamentSlug) {
      tournament = await getTournamentBySlugAsync(tournamentSlug);
    }

    const amountInINR =
      tournament && tournament.entryFee !== undefined
        ? tournament.entryFee
        : (Number(process.env.NEXT_PUBLIC_REGISTRATION_FEE) || 499);

    const amountInPaise = amountInINR * 100;

    const keyId =
      tournament?.razorpayKeyId ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      'rzp_live_TlrysnDtv6awCC';
    const keySecret =
      tournament?.razorpayKeySecret ||
      process.env.RAZORPAY_KEY_SECRET ||
      '0fkxySFC1Mqcw8WXwIyJzwST';

    // Check if real keys are configured
    const isConfigured =
      keyId &&
      keySecret &&
      !keyId.includes('placeholder') &&
      !keySecret.includes('placeholder') &&
      keyId.startsWith('rzp_');

    if (!isConfigured) {
      // Local demo / mock mode
      const mockOrderId = `order_mock_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return NextResponse.json({
        success: true,
        orderId: mockOrderId,
        amount: amountInPaise,
        currency: 'INR',
        keyId: keyId || 'rzp_test_demo',
        isMock: true,
        message: 'Running in demo/mock mode. Set valid Razorpay keys in .env.local for production.',
      });
    }

    // Initialize real Razorpay instance
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: {
        tournament: tournament?.title || process.env.NEXT_PUBLIC_TOURNAMENT_NAME || 'CricBid Tournament',
        player_name: fullName || 'Player',
        phone: phone || '',
      },
    };

    const order = await razorpay.orders.create(options);

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: keyId,
      isMock: false,
    });
  } catch (error: any) {
    console.error('Razorpay order creation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Failed to create Razorpay order',
      },
      { status: 500 }
    );
  }
}
