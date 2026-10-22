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

    let count = tournament.registeredCount || 0;
    let source = 'local_store';

    // If Google Sheet Web App URL is connected, query live count from sheet
    const sheetUrl = tournament.googleSheetUrl || process.env.GOOGLE_SHEET_SCRIPT_URL;

    if (sheetUrl && sheetUrl.startsWith('http') && !sheetUrl.includes('AKfycb...')) {
      try {
        const countUrl = `${sheetUrl}${sheetUrl.includes('?') ? '&' : '?'}action=count`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s timeout

        const response = await fetch(countUrl, {
          method: 'GET',
          signal: controller.signal,
          redirect: 'follow',
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json().catch(() => null);
          if (data && typeof data.count === 'number') {
            count = data.count;
            source = 'google_sheet';
            // Sync count to tournament store
            updateTournament(tournament.id, { registeredCount: count });
          }
        }
      } catch (e) {
        // Fall back to local store without breaking UI
      }
    }

    return NextResponse.json({
      success: true,
      slug: tournament.slug,
      title: tournament.title,
      isPaid: tournament.isPaid,
      entryFee: tournament.entryFee,
      registeredCount: count,
      source,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error fetching stats' },
      { status: 500 }
    );
  }
}
