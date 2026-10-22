import { NextResponse } from 'next/server';
import {
  getPlayersByTournamentAsync,
  getTournamentBySlugAsync,
  updatePlayer,
  deletePlayer,
} from '@/lib/tournamentStore';
import { verifyAdminSession } from '@/lib/auth';

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
        photoUrl: player.photoUrl,
        paymentStatus: player.paymentStatus,
        maskedPhone,
        timestamp: player.timestamp,
      };
    });

    return NextResponse.json({
      success: true,
      tournament: {
        title: tournament.title,
        slug: tournament.slug,
        city: tournament.city,
        venue: tournament.venue,
        auctionDate: tournament.auctionDate,
        registeredCount: tournament.registeredCount,
      },
      total: publicPlayers.length,
      players: publicPlayers,
    });
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
