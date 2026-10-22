import { NextResponse } from 'next/server';
import { getPlayersByTournamentAsync, getTournamentBySlugAsync } from '@/lib/tournamentStore';

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
