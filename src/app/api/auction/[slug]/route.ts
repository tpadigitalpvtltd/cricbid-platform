import { NextResponse } from 'next/server';
import { getFullAuctionState } from '@/lib/auctionStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    if (!slug) {
      return NextResponse.json({ success: false, error: 'Tournament slug is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');

    const state = await getFullAuctionState(slug);
    if (!state) {
      return NextResponse.json({ success: false, error: 'Tournament not found' }, { status: 404 });
    }

    // Bandwidth Optimization:
    // 1. Neither Live Stream nor Team Bidder pages need the playersQueue.
    // 2. For Controller Desk, strip huge base64 photos from queue list items (controller caches initial photos).
    // This reduces response size from 15MB down to ~15KB (99.9% bandwidth saving to stay well within free limits).
    if (view === 'live' || view === 'bid') {
      state.playersQueue = [];
    } else if (Array.isArray(state.playersQueue)) {
      state.playersQueue = state.playersQueue.map((item) => ({
        ...item,
        player: {
          ...item.player,
          // Strip heavy base64 strings from queue list to prevent origin bandwidth exhaustion
          photoUrl: item.player?.photoUrl?.startsWith('data:image/') ? '' : (item.player?.photoUrl || ''),
        },
      }));
    }

    return NextResponse.json(
      { success: true, state },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    console.error('Error in GET /api/auction/[slug]:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
