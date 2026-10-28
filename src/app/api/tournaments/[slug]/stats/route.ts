import { NextResponse } from 'next/server';
import { getTournamentBySlugAsync } from '@/lib/tournamentStore';
import { reconcileMissingTournamentPayments } from '@/lib/paymentReconciler';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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

    // Auto-reconcile any captured payments in background
    await reconcileMissingTournamentPayments(slug);

    // Query exact real player count from players table (excluding incomplete/abandoned payment drafts)
    let count = tournament.registeredCount || 0;
    try {
      const { count: realPlayerCount, error: countErr } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .ilike('tournament_slug', tournament.slug)
        .neq('payment_status', 'PENDING_PAYMENT');

      if (!countErr && typeof realPlayerCount === 'number') {
        count = realPlayerCount;
        // Keep tournaments table registered_count in exact sync
        if (tournament.registeredCount !== realPlayerCount) {
          await supabase
            .from('tournaments')
            .update({ registered_count: realPlayerCount })
            .ilike('slug', tournament.slug);
        }
      }
    } catch (e) {
      // fallback to tournament record count
    }

    return NextResponse.json(
      {
        success: true,
        slug: tournament.slug,
        title: tournament.title,
        isPaid: tournament.isPaid,
        entryFee: tournament.entryFee,
        registeredCount: count,
        source: 'database',
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || 'Error fetching stats' },
      { status: 500 }
    );
  }
}
