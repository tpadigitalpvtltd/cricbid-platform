import { NextResponse } from 'next/server';
import { getAllTournamentsAsync, createTournamentAsync } from '@/lib/tournamentStore';

export async function GET() {
  try {
    const tournaments = await getAllTournamentsAsync();
    return NextResponse.json({ success: true, tournaments });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch tournaments' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      title,
      city,
      venue,
      bannerUrl,
      registrationDeadline,
      auctionDate,
      googleSheetUrl,
      organizerName,
      organizerContact,
      tagline,
    } = body;

    if (!title || !city || !venue) {
      return NextResponse.json(
        { success: false, error: 'Title, City, and Venue are required' },
        { status: 400 }
      );
    }

    // Default banners if not provided
    const defaultBanners = [
      'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1531415074868-036b1c57e3ce?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?q=80&w=1200&auto=format&fit=crop',
    ];

    const chosenBanner =
      bannerUrl && bannerUrl.trim()
        ? bannerUrl.trim()
        : defaultBanners[Math.floor(Math.random() * defaultBanners.length)];

    // Public User constraint: Always Free Registration Mode
    const newTournament = await createTournamentAsync({
      title: title.trim(),
      tagline: tagline?.trim() || `${city} Premier Cricket Draft 2026`,
      city: city.trim(),
      venue: venue.trim(),
      bannerUrl: chosenBanner,
      registrationDeadline: registrationDeadline || '2026-12-31',
      auctionDate: auctionDate || '2027-01-10',
      googleSheetUrl: googleSheetUrl?.trim() || '',
      isPaid: false, // Locked to Free Mode for public host
      entryFee: 0,
      organizerName: organizerName?.trim() || 'Tournament Host',
      organizerContact: organizerContact?.trim() || '',
    });

    return NextResponse.json({
      success: true,
      message: 'Tournament created in Free Registration Mode',
      tournament: newTournament,
    });
  } catch (error: any) {
    console.error('Error creating tournament:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to create tournament' },
      { status: 500 }
    );
  }
}
