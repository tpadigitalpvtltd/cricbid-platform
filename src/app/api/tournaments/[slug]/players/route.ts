import { NextResponse } from 'next/server';
import {
  getPlayersByTournamentAsync,
  getTournamentBySlugAsync,
  updatePlayer,
  deletePlayer,
} from '@/lib/tournamentStore';

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

    const players = await getPlayersByTournamentAsync(slug);

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
      total: players.length,
      players,
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
