import { NextResponse } from 'next/server';
import { getAllTournamentsAsync, createTournamentAsync } from '@/lib/tournamentStore';
import { verifyAdminSession } from '@/lib/auth';

export async function GET() {
  try {
    const rawTournaments = await getAllTournamentsAsync();

    // Sanitize tournaments for public display - never leak secret keys
    const tournaments = rawTournaments.map((t) => ({
      id: t.id,
      title: t.title,
      slug: t.slug,
      tagline: t.tagline,
      city: t.city,
      venue: t.venue,
      bannerUrl: t.bannerUrl,
      registrationDeadline: t.registrationDeadline,
      auctionDate: t.auctionDate,
      isPaid: Boolean(t.isPaid),
      entryFee: Number(t.entryFee) || 0,
      organizerName: t.organizerName,
      organizerContact: t.organizerContact,
      registeredCount: t.registeredCount || 0,
      createdAt: t.createdAt,
    }));

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
    const body = await request.json().catch(() => ({}));

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

    const cleanTitle = String(title).trim().slice(0, 100);
    const cleanCity = String(city).trim().slice(0, 50);
    const cleanVenue = String(venue).trim().slice(0, 100);

    // Default banners if not provided
    const defaultBanners = [
      'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1531415074868-036b1c57e3ce?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?q=80&w=1200&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?q=80&w=1200&auto=format&fit=crop',
    ];

    let chosenBanner = defaultBanners[Math.floor(Math.random() * defaultBanners.length)];
    if (bannerUrl && typeof bannerUrl === 'string') {
      const trimmedBanner = bannerUrl.trim();
      if (trimmedBanner.startsWith('data:image/svg')) {
        return NextResponse.json(
          { success: false, error: 'SVG image format is not permitted for security reasons' },
          { status: 400 }
        );
      }
      if (
        trimmedBanner.startsWith('http://') ||
        trimmedBanner.startsWith('https://') ||
        trimmedBanner.startsWith('data:image/')
      ) {
        chosenBanner = trimmedBanner;
      }
    }

    // Abuse prevention: Public organizers can only create Free tournaments.
    // Paid tournaments require Super Admin authorization.
    const isAdmin = verifyAdminSession(request);
    const isPaidMode = isAdmin ? Boolean(body.isPaid) : false;
    const tournamentFee = isPaidMode ? (Number(body.entryFee) || 0) : 0;

    const newTournament = await createTournamentAsync({
      title: cleanTitle,
      tagline: tagline?.trim()?.slice(0, 150) || `${cleanCity} Premier Cricket Draft 2026`,
      city: cleanCity,
      venue: cleanVenue,
      bannerUrl: chosenBanner,
      registrationDeadline: registrationDeadline || '2026-12-31',
      auctionDate: auctionDate || '2027-01-10',
      googleSheetUrl: '',
      isPaid: isPaidMode,
      entryFee: tournamentFee,
      organizerName: organizerName?.trim()?.slice(0, 80) || 'Tournament Host',
      organizerContact: organizerContact?.trim()?.slice(0, 50) || '',
    });

    return NextResponse.json({
      success: true,
      message: isPaidMode
        ? `Tournament created in Paid Mode (₹${tournamentFee})`
        : 'Tournament created in Free Registration Mode',
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
