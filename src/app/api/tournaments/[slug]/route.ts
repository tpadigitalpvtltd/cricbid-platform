import { NextResponse } from 'next/server';
import { getTournamentBySlug, updateTournament } from '@/lib/tournamentStore';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const tournament = getTournamentBySlug(slug);

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

    const existing = getTournamentBySlug(slug);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Tournament not found' },
        { status: 404 }
      );
    }

    // Admin updates (e.g., toggling isPaid, entryFee, Razorpay keys, Google Sheet URL)
    const updated = updateTournament(existing.id, {
      ...(body.isPaid !== undefined && { isPaid: Boolean(body.isPaid) }),
      ...(body.entryFee !== undefined && { entryFee: Number(body.entryFee) }),
      ...(body.googleSheetUrl !== undefined && { googleSheetUrl: body.googleSheetUrl }),
      ...(body.razorpayKeyId !== undefined && { razorpayKeyId: body.razorpayKeyId }),
      ...(body.razorpayKeySecret !== undefined && { razorpayKeySecret: body.razorpayKeySecret }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.city !== undefined && { city: body.city }),
      ...(body.venue !== undefined && { venue: body.venue }),
      ...(body.auctionDate !== undefined && { auctionDate: body.auctionDate }),
      ...(body.registrationDeadline !== undefined && { registrationDeadline: body.registrationDeadline }),
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
