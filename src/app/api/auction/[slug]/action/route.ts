export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { executeAuctioneerAction } from '@/lib/auctionStore';
import { verifyAdminSession, getAdminPassword } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const body = await request.json().catch(() => ({}));
    const { action, payload, adminPin } = body;

    if (!slug || !action) {
      return NextResponse.json({ success: false, error: 'Tournament slug and action are required' }, { status: 400 });
    }

    // Verify Authorization: check session cookie or adminPin
    const isAuthedSession = verifyAdminSession(request);
    const validPin = getAdminPassword();
    const isAuthedPin = Boolean(adminPin && String(adminPin).trim() === String(validPin).trim());

    if (!isAuthedSession && !isAuthedPin) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Valid Admin PIN or session required' },
        { status: 401 }
      );
    }

    const result = await executeAuctioneerAction({
      slug,
      action,
      payload,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // Payload optimization: transform large base64 photos to URLs to prevent heavy transfers
    const state = result.state;
    if (state && Array.isArray(state.playersQueue)) {
      state.playersQueue = state.playersQueue.map((item) => {
        const photo = item.player?.photoUrl || '';
        if (typeof photo === 'string' && photo.startsWith('data:image/') && item.player?.registrationId) {
          return {
            ...item,
            player: {
              ...item.player,
              photoUrl: `/api/player-photo/${encodeURIComponent(item.player.registrationId)}`,
            },
          };
        }
        return item;
      });
    }

    return NextResponse.json(
      { success: true, state },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    console.error('Error in POST /api/auction/[slug]/action:', err);
    return NextResponse.json({ success: false, error: err?.message || 'Failed to execute auction action' }, { status: 500 });
  }
}
