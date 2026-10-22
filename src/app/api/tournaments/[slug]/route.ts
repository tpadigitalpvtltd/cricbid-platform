import { NextResponse } from 'next/server';
import { getTournamentBySlugAsync, updateTournament, deleteTournament } from '@/lib/tournamentStore';

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

    return NextResponse.json({ success: true, tournament });
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
    const { slug } = params;
    const body = await request.json();

    const existing = await getTournamentBySlugAsync(slug);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Admin updates (e.g., toggling isPaid, entryFee, Razorpay keys, Google Sheet URL, Title, Dates, Venue)
    const updated = updateTournament(existing.id, {
      ...(body.isPaid !== undefined && { isPaid: Boolean(body.isPaid) }),
      ...(body.entryFee !== undefined && { entryFee: Number(body.entryFee) }),
      ...(body.googleSheetUrl !== undefined && { googleSheetUrl: body.googleSheetUrl }),
      ...(body.razorpayKeyId !== undefined && { razorpayKeyId: body.razorpayKeyId }),
      ...(body.razorpayKeySecret !== undefined && { razorpayKeySecret: body.razorpayKeySecret }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.tagline !== undefined && { tagline: body.tagline }),
      ...(body.city !== undefined && { city: body.city }),
      ...(body.venue !== undefined && { venue: body.venue }),
      ...(body.bannerUrl !== undefined && { bannerUrl: body.bannerUrl }),
      ...(body.auctionDate !== undefined && { auctionDate: body.auctionDate }),
      ...(body.registrationDeadline !== undefined && { registrationDeadline: body.registrationDeadline }),
      ...(body.organizerName !== undefined && { organizerName: body.organizerName }),
      ...(body.organizerContact !== undefined && { organizerContact: body.organizerContact }),
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
