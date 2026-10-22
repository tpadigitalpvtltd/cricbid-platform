import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getTournamentBySlugAsync } from '@/lib/tournamentStore';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tournamentSlug, fullName, phone, amount } = body;

    let tournament = null;
    if (tournamentSlug) {
      tournament = await getTournamentBySlugAsync(tournamentSlug);
    }

    // Exact fee resolution: prioritize explicit client fee set by tournament / admin
    let amountInINR = 499;
    if (amount !== undefined && Number(amount) > 0) {
      amountInINR = Number(amount);
    } else if (tournament && tournament.entryFee !== undefined && tournament.entryFee > 0) {
      amountInINR = tournament.entryFee;
    } else {
      amountInINR = Number(process.env.NEXT_PUBLIC_REGISTRATION_FEE) || 499;
    }

    const amountInPaise = Math.round(amountInINR * 100);

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

    // Also generate Razorpay Hosted Payment Link (rzp.io) to avoid "website does not match" restrictions!
    let paymentLinkUrl: string | null = null;
    try {
      const originHeader = request.headers.get('origin') || request.headers.get('referer') || 'https://cricbid-platform.vercel.app';
      const cleanOrigin = originHeader.split('/tournament')[0].replace(/\/$/, '');

      const digitsOnly = (phone || '').replace(/[^0-9]/g, '');
      const validPhone = digitsOnly.length >= 10 ? `+91${digitsOnly.slice(-10)}` : '+919876543210';

      const link = await razorpay.paymentLink.create({
        amount: amountInPaise,
        currency: 'INR',
        accept_partial: false,
        description: `Player Pass: ${fullName || 'Player'} - ${tournament?.title || 'CricBid'}`,
        customer: {
          name: fullName || 'Player',
          contact: validPhone,
        },
        notify: { sms: false, email: false },
        reminder_enable: false,
        callback_url: `${cleanOrigin}/tournament/${tournamentSlug}/register?payment_success=true`,
        callback_method: 'get',
        notes: {
          tournamentSlug: tournamentSlug || '',
          fullName: fullName || '',
          phone: phone || '',
        },
      });

      if (link && link.short_url) {
        paymentLinkUrl = link.short_url;
      }
    } catch (linkError) {
      console.warn('Payment link generation notice:', linkError);
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: keyId,
      isMock: false,
      paymentLinkUrl: paymentLinkUrl,
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
