export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import {
  getTournamentBySlugAsync,
  updateTournamentAsync,
  deleteTournamentAsync,
} from '@/lib/tournamentStore';
import { verifyAdminSession } from '@/lib/auth';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
};

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
        { status: 404, headers: NO_CACHE_HEADERS }
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
      bannerUrl:
        tournament.bannerUrl && !tournament.bannerUrl.startsWith('data:image/')
          ? tournament.bannerUrl
          : `/api/tournament-banner/${encodeURIComponent(tournament.slug)}`,
      registrationDeadline: tournament.registrationDeadline,
      auctionDate: tournament.auctionDate,
      isPaid: Boolean(tournament.isPaid),
      entryFee: Number(tournament.entryFee) || 0,
      organizerName: tournament.organizerName,
      organizerContact: tournament.organizerContact,
      registeredCount: tournament.registeredCount || 0,
      createdAt: tournament.createdAt,
    };

    return NextResponse.json(
      { success: true, tournament: sanitizedTournament },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error fetching tournament' },
      { status: 500, headers: NO_CACHE_HEADERS }
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
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const { slug } = params;
    const existing = await getTournamentBySlugAsync(slug);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Disallow altering internal system fields or slug
    const { id, slug: ignoredSlug, createdAt, registeredCount, ...allowedUpdates } = body;

    // Direct asynchronous cloud database update
    let updated = await updateTournamentAsync(slug, allowedUpdates);
    if (!updated && existing.id) {
      updated = await updateTournamentAsync(existing.id, allowedUpdates);
    }

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Failed to update tournament in cloud database' },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Tournament updated successfully',
        tournament: updated,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    console.error('PATCH tournament error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error updating tournament' },
      { status: 500, headers: NO_CACHE_HEADERS }
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
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const { slug } = params;
    const existing = await getTournamentBySlugAsync(slug);

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    const deleted = await deleteTournamentAsync(existing.slug);
    if (existing.id && existing.id !== existing.slug) {
      await deleteTournamentAsync(existing.id);
    }

    return NextResponse.json(
      {
        success: deleted,
        message: deleted ? 'Tournament deleted successfully' : 'Failed to delete tournament',
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error deleting tournament' },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
