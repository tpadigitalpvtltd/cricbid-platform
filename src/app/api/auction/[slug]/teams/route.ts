import { NextResponse } from 'next/server';
import { getTournamentTeams, saveTournamentTeams } from '@/lib/auctionStore';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    if (!slug) return NextResponse.json({ success: false, error: 'Slug required' }, { status: 400 });

    const teams = await getTournamentTeams(slug);
    // Sanitize secretPin for public list
    const publicTeams = teams.map((t) => ({
      id: t.id,
      name: t.name,
      shortName: t.shortName,
      logoUrl: t.logoUrl,
      color: t.color,
      totalPurse: t.totalPurse,
      remainingPurse: t.remainingPurse,
      maxPlayers: t.maxPlayers,
      boughtPlayersCount: t.boughtPlayersCount,
    }));

    return NextResponse.json({ success: true, teams: publicTeams });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

// Verify Team PIN for Mobile Bidding Screen
export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const body = await request.json().catch(() => ({}));
    const { teamId, secretPin } = body;

    if (!slug || !teamId || !secretPin) {
      return NextResponse.json({ success: false, error: 'teamId and secretPin required' }, { status: 400 });
    }

    const teams = await getTournamentTeams(slug);
    const team = teams.find((t) => t.id === teamId);

    if (!team) {
      return NextResponse.json({ success: false, error: 'Team not found' }, { status: 404 });
    }

    if (String(team.secretPin).trim() !== String(secretPin).trim()) {
      return NextResponse.json({ success: false, error: 'Incorrect 4-digit Team PIN' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      team: {
        id: team.id,
        name: team.name,
        shortName: team.shortName,
        logoUrl: team.logoUrl,
        color: team.color,
        totalPurse: team.totalPurse,
        remainingPurse: team.remainingPurse,
        maxPlayers: team.maxPlayers,
        boughtPlayersCount: team.boughtPlayersCount,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
