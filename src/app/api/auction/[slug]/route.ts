import { NextResponse } from 'next/server';
import { getFullAuctionState } from '@/lib/auctionStore';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Tournament slug is required' }, { status: 400 });
    }

    const state = await getFullAuctionState(slug);
    if (!state) {
      return NextResponse.json({ success: false, error: 'Tournament not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, state });
  } catch (err: any) {
    console.error('Error in GET /api/auction/[slug]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
