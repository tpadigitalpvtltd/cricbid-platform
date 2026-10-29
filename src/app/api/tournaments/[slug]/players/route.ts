export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { NextResponse } from 'next/server';
import {
  getPlayersByTournamentAsync,
  getTournamentBySlugAsync,
  updatePlayer,
  deletePlayer,
} from '@/lib/tournamentStore';
import { reconcileMissingTournamentPayments } from '@/lib/paymentReconciler';
import { verifyAdminSession } from '@/lib/auth';

const lastReconcileTimeBySlug = new Map<string, number>();

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const tournament = await getTournamentBySlugAsync(slug);

    if (!tournament) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Auto-reconcile captured Razorpay payments with throttling (at most once every 45s per tournament)
    // to prevent serverless concurrency race conditions and Razorpay rate limits
    const now = Date.now();
    const lastTime = lastReconcileTimeBySlug.get(slug.toLowerCase()) || 0;
    if (now - lastTime > 45000) {
      lastReconcileTimeBySlug.set(slug.toLowerCase(), now);
      await reconcileMissingTournamentPayments(slug).catch(() => 0);
    }

    const rawPlayers = await getPlayersByTournamentAsync(slug);

    // Sanitize players for public view - protect privacy of personal contact and payment info
    const publicPlayers = rawPlayers.map((player) => {
      const cleanPhone = (player.phone || '').replace(/[^0-9]/g, '');
      const maskedPhone =
        cleanPhone.length >= 4
          ? `******${cleanPhone.slice(-4)}`
          : '******';

      return {
        registrationId: player.registrationId,
        tournamentSlug: player.tournamentSlug,
        fullName: player.fullName,
        role: player.role,
        battingStyle: player.battingStyle,
        bowlingStyle: player.bowlingStyle,
        age: player.age,
        stats: player.stats,
        photoUrl:
          typeof player.photoUrl === 'string' && player.photoUrl.startsWith('data:image/') && player.registrationId
            ? `/api/player-photo/${encodeURIComponent(player.registrationId)}`
            : (player.photoUrl || ''),
        paymentStatus: player.paymentStatus,
        maskedPhone,
        timestamp: player.timestamp,
      };
    });

    return NextResponse.json(
      {
        success: true,
        tournament: {
          title: tournament.title,
          slug: tournament.slug,
          city: tournament.city,
          venue: tournament.venue,
          auctionDate: tournament.auctionDate,
          registeredCount: publicPlayers.length,
        },
        total: publicPlayers.length,
        players: publicPlayers,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error fetching players' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { registrationId, updates } = body;

    if (!registrationId || !updates) {
      return NextResponse.json(
        { success: false, error: 'registrationId and updates are required' },
        { status: 400 }
      );
    }

    const updated = updatePlayer(registrationId, updates);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Player entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Player entry updated successfully',
      player: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error updating player' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    if (!verifyAdminSession(request)) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    let registrationId = searchParams.get('registrationId');

    if (!registrationId) {
      const body = await request.json().catch(() => ({}));
      registrationId = body.registrationId;
    }

    if (!registrationId) {
      return NextResponse.json(
        { success: false, error: 'registrationId is required to delete' },
        { status: 400 }
      );
    }

    const deleted = deletePlayer(registrationId);

    return NextResponse.json({
      success: deleted,
      message: deleted ? 'Player registration deleted successfully' : 'Player not found',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error deleting player' },
      { status: 500 }
    );
  }
}
