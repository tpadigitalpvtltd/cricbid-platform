export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { executeAuctioneerAction } from '@/lib/auctionStore';
import { verifyAdminSession, getAdminPassword, verifyAdminPassword } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const body = await request.json().catch(() => ({}));
    const { action, payload, adminPin, clientSync } = body;

    if (!slug || !action) {
      return NextResponse.json({ success: false, error: 'Tournament slug and action are required' }, { status: 400 });
    }

    // Verify Authorization: check session cookie or adminPin
    const isAuthedSession = verifyAdminSession(request);
    const validPin = getAdminPassword();
    const isAuthedPin = Boolean(adminPin && verifyAdminPassword(String(adminPin)));

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
      clientSync,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }

    // Clone state so we never mutate AUCTION_STATE_CACHE in-place, and keep data:image/ photos intact!
    const buildInlineAvatarDataUri = (player: any) => {
      const fullName = String(player?.fullName || 'CRICKET PLAYER').toUpperCase().trim();
      const parts = fullName.replace(/[()[\]{}]/g, ' ').trim().split(/\s+/).filter(Boolean);
      const initials =
        parts.length === 0
          ? 'CR'
          : parts.length === 1
          ? parts[0].slice(0, 2)
          : parts[0][0] + parts[parts.length - 1][0];
      const safeInit = initials.replace(/[^A-Z0-9]/g, '') || 'CR';
      const role = String(player?.role || 'DRAFT PLAYER').toUpperCase().replace(/[&<>"']/g, '');
      const shortName = fullName.slice(0, 20).replace(/[&<>"']/g, '');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect width="400" height="400" fill="#070c18"/><circle cx="200" cy="145" r="70" fill="#0f172a" stroke="#fbbf24" stroke-width="4"/><text x="200" y="168" text-anchor="middle" fill="#fbbf24" font-family="Arial,sans-serif" font-weight="900" font-size="56">${safeInit}</text><path d="M80 350 C80 255 135 230 200 230 C265 230 320 255 320 350 Z" fill="#1e293b" stroke="#f59e0b" stroke-width="3"/><rect x="30" y="305" width="340" height="46" rx="12" fill="#090f1f" stroke="#f59e0b" stroke-width="2"/><text x="200" y="335" text-anchor="middle" fill="#ffffff" font-family="Arial,sans-serif" font-weight="900" font-size="20">${shortName}</text><text x="200" y="378" text-anchor="middle" fill="#fbbf24" font-family="Arial,sans-serif" font-weight="800" font-size="13">${role}</text></svg>`;
      return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
    };

    const resolvePlayerPhotoFast = (player: any) => {
      if (!player) return '';
      const photo = player.photoUrl || '';
      if (typeof photo === 'string' && photo.startsWith('data:image/')) {
        return photo;
      }
      return buildInlineAvatarDataUri(player);
    };

    const state = result.state ? { ...result.state } : undefined;
    if (state && Array.isArray(state.playersQueue)) {
      state.playersQueue = state.playersQueue.map((item) => ({
        ...item,
        player: {
          ...item.player,
          photoUrl: resolvePlayerPhotoFast(item.player),
        },
      }));
    }
    if (state && state.currentPlayer) {
      state.currentPlayer = {
        ...state.currentPlayer,
        photoUrl: resolvePlayerPhotoFast(state.currentPlayer),
      };
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
