import { NextResponse } from 'next/server';
import {
  getTournamentBySlugAsync,
  updateTournament,
  deleteTournamentAsync,
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

    // Sanitize tournament for public view (strip sensitive admin secrets if present)
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
    const existing = await getTournamentBySlugAsync(slug);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Disallow altering internal system fields or slug
    const { id, slug: ignoredSlug, createdAt, ...allowedUpdates } = body;

    const updated = updateTournament(existing.id, allowedUpdates);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Failed to update tournament' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Tournament updated successfully',
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

    const deleted = await deleteTournamentAsync(existing.id);

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
