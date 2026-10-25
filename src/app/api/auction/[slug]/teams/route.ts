import { NextResponse } from 'next/server';
import { getTournamentTeams, saveTournamentTeams, executeAuctioneerAction } from '@/lib/auctionStore';
import { verifyAdminSession, getAdminPassword } from '@/lib/auth';

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

// Add or Update Team
export async function PUT(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const body = await request.json().catch(() => ({}));
    const { team, adminPin } = body;

    const isAuthedSession = verifyAdminSession(request);
    const validPin = getAdminPassword();
    const isAuthedPin = Boolean(adminPin && String(adminPin).trim() === String(validPin).trim());

    if (!isAuthedSession && !isAuthedPin) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin PIN or session required' }, { status: 401 });
    }

    const res = await executeAuctioneerAction({
      slug,
      action: 'SAVE_TEAM',
      payload: { team },
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, teams: res.state?.teams, state: res.state });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}

// Delete Team
export async function DELETE(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const teamId = body?.teamId || searchParams.get('teamId');
    const adminPin = body?.adminPin || searchParams.get('adminPin');

    const isAuthedSession = verifyAdminSession(request);
    const validPin = getAdminPassword();
    const isAuthedPin = Boolean(adminPin && String(adminPin).trim() === String(validPin).trim());

    if (!isAuthedSession && !isAuthedPin) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Admin PIN or session required' }, { status: 401 });
    }

    if (!teamId) {
      return NextResponse.json({ success: false, error: 'teamId is required' }, { status: 400 });
    }

    const res = await executeAuctioneerAction({
      slug,
      action: 'DELETE_TEAM',
      payload: { teamId },
    });

    if (!res.success) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, teams: res.state?.teams, state: res.state });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
