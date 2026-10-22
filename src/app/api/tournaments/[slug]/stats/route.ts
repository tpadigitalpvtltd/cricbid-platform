import { NextResponse } from 'next/server';
import { getTournamentBySlugAsync } from '@/lib/tournamentStore';

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

    return NextResponse.json({
      success: true,
      slug: tournament.slug,
      title: tournament.title,
      isPaid: tournament.isPaid,
      entryFee: tournament.entryFee,
      registeredCount: tournament.registeredCount || 0,
      source: 'database',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error fetching stats' },
      { status: 500 }
    );
  }
}
