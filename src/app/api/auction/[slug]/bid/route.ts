import { NextResponse } from 'next/server';
import { placeAuctionBid } from '@/lib/auctionStore';

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const body = await request.json().catch(() => ({}));
    const { teamId, amount, secretPin } = body;

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Tournament slug is required' }, { status: 400 });
    }

    if (!teamId || !amount || typeof amount !== 'number') {
      return NextResponse.json({ success: false, error: 'Valid teamId and numeric amount are required' }, { status: 400 });
    }

    const result = await placeAuctionBid({
      slug,
      teamId,
      amount,
      secretPin,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, state: result.state });
  } catch (err: any) {
    console.error('Error in POST /api/auction/[slug]/bid:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to place bid' }, { status: 500 });
  }
}
