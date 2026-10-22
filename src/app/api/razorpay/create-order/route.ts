import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { getTournamentBySlugAsync } from '@/lib/tournamentStore';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { tournamentSlug, fullName, phone } = body;

    if (!tournamentSlug) {
      return NextResponse.json(
        { success: false, error: 'tournamentSlug is required' },
        { status: 400 }
      );
    }

    const tournament = await getTournamentBySlugAsync(tournamentSlug);
    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Verify tournament payment requirement server-side
    if (!tournament.isPaid) {
      return NextResponse.json(
        {
          success: false,
          error: 'This tournament is configured for Free Registration. No payment is required.',
        },
        { status: 400 }
      );
    }

    // Server-enforced amount integrity: Never allow client to dictate amount!
    const amountInINR = Number(tournament.entryFee);
    if (!amountInINR || amountInINR <= 0 || isNaN(amountInINR)) {
      return NextResponse.json(
        { success: false, error: 'Invalid tournament entry fee configured on server' },
        { status: 400 }
      );
    }

    const amountInPaise = Math.round(amountInINR * 100);

    const keyId =
      tournament?.razorpayKeyId ||
      process.env.RAZORPAY_KEY_ID ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

    const keySecret =
      tournament?.razorpayKeySecret ||
      process.env.RAZORPAY_KEY_SECRET;

    // Check if real keys are configured
    const isConfigured = Boolean(
      keyId &&
      keySecret &&
      !keyId.includes('placeholder') &&
      !keySecret.includes('placeholder') &&
      keyId.startsWith('rzp_')
    );

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

    // Initialize real Razorpay instance with environment credentials
    const razorpay = new Razorpay({
      key_id: keyId!,
      key_secret: keySecret!,
    });

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
      notes: {
        tournamentSlug: tournament.slug,
        tournamentTitle: tournament.title,
        player_name: fullName || 'Player',
        phone: phone || '',
      },
    };

    const order = await razorpay.orders.create(options);

    // Generate Razorpay Hosted Payment Link (rzp.io) to avoid domain restrictions
    let paymentLinkUrl: string | null = null;
    try {
      const originHeader =
        request.headers.get('origin') ||
        request.headers.get('referer') ||
        'https://cricbid-platform.vercel.app';
      const cleanOrigin = originHeader.split('/tournament')[0].replace(/\/$/, '');

      const digitsOnly = (phone || '').replace(/[^0-9]/g, '');
      const validPhone =
        digitsOnly.length >= 10 ? `+91${digitsOnly.slice(-10)}` : '+919876543210';

      const link = await razorpay.paymentLink.create({
        amount: amountInPaise,
        currency: 'INR',
        accept_partial: false,
        description: `Player Pass: ${fullName || 'Player'} - ${tournament.title}`,
        customer: {
          name: fullName || 'Player',
          contact: validPhone,
        },
        notify: { sms: false, email: false },
        reminder_enable: false,
        callback_url: `${cleanOrigin}/tournament/${tournament.slug}/register?payment_success=true`,
        callback_method: 'get',
        notes: {
          tournamentSlug: tournament.slug,
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
