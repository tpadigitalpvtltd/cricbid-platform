import { NextResponse } from 'next/server';
import { getTournamentBySlugAsync, updateTournament, deleteTournament } from '@/lib/tournamentStore';
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

    // Sanitize tournament for public consumption - NEVER expose secrets
    const sanitizedTournament = {
      id: tournament.id,
      title: tournament.title,
      slug: tournament.slug,
      tagline: tournament.tagline,
      city: tournament.city,
      venue: tournament.venue,
      bannerUrl: tournament.bannerUrl,
      registrationDeadline: tournament.registrationDeadline,
      auctionDate: tournament.auctionDate,
      isPaid: Boolean(tournament.isPaid),
      entryFee: Number(tournament.entryFee) || 0,
      organizerName: tournament.organizerName,
      organizerContact: tournament.organizerContact,
      registeredCount: tournament.registeredCount || 0,
      createdAt: tournament.createdAt,
    };

    return NextResponse.json({ success: true, tournament: sanitizedTournament });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error fetching tournament' },
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

    const { slug } = params;
    const body = await request.json();

    const existing = await getTournamentBySlugAsync(slug);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Admin updates (e.g., toggling isPaid, entryFee, Google Sheet URL, Title, Dates, Venue)
    const updated = updateTournament(existing.id, {
      ...(body.isPaid !== undefined && { isPaid: Boolean(body.isPaid) }),
      ...(body.entryFee !== undefined && { entryFee: Number(body.entryFee) }),
      ...(body.googleSheetUrl !== undefined && { googleSheetUrl: body.googleSheetUrl }),
      ...(body.title !== undefined && { title: body.title.trim() }),
      ...(body.tagline !== undefined && { tagline: body.tagline?.trim() }),
      ...(body.city !== undefined && { city: body.city.trim() }),
      ...(body.venue !== undefined && { venue: body.venue.trim() }),
      ...(body.bannerUrl !== undefined && { bannerUrl: body.bannerUrl.trim() }),
      ...(body.auctionDate !== undefined && { auctionDate: body.auctionDate }),
      ...(body.registrationDeadline !== undefined && { registrationDeadline: body.registrationDeadline }),
      ...(body.organizerName !== undefined && { organizerName: body.organizerName?.trim() }),
      ...(body.organizerContact !== undefined && { organizerContact: body.organizerContact?.trim() }),
    });

    return NextResponse.json({
      success: true,
      message: 'Tournament settings updated successfully',
      tournament: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error updating tournament' },
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

    const { slug } = params;
    const existing = await getTournamentBySlugAsync(slug);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    const deleted = deleteTournament(existing.id);

    return NextResponse.json({
      success: deleted,
      message: deleted ? 'Tournament deleted successfully' : 'Failed to delete tournament',
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error deleting tournament' },
      { status: 500 }
    );
  }
}
