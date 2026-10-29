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
    // 2. Instead of streaming massive base64 strings (15MB) on every poll,
    //    we transform base64 photos into CDN-cacheable image URLs (/api/player-photo/[id]).
    //    This keeps the JSON payload under 15KB while ensuring EVERY player's photo is rendered and cached by the browser!
    const optimizePhotoUrl = (player: any) => {
      if (!player) return '';
      const photo = player.photoUrl || '';
      if (typeof photo === 'string' && photo.startsWith('data:image/') && player.registrationId) {
        return `/api/player-photo/${encodeURIComponent(player.registrationId)}`;
      }
      return photo;
    };

    if (view === 'live' || view === 'bid') {
      state.playersQueue = [];
    } else if (Array.isArray(state.playersQueue)) {
      state.playersQueue = state.playersQueue.map((item) => ({
        ...item,
        player: {
          ...item.player,
          photoUrl: optimizePhotoUrl(item.player),
        },
      }));
    }

    if (state.currentPlayer) {
      state.currentPlayer = {
        ...state.currentPlayer,
        photoUrl: optimizePhotoUrl(state.currentPlayer),
      };
    }

    if (Array.isArray(state.soldHistory)) {
      state.soldHistory = state.soldHistory.map((sh) => ({
        ...sh,
        player: sh.player
          ? {
              ...sh.player,
              photoUrl: optimizePhotoUrl(sh.player),
            }
          : sh.player,
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
