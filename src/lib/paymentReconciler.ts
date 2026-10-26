import Razorpay from 'razorpay';
import { supabase } from './supabase';
import { clean10DigitPhone } from './utils';
import { PlayingRole, RegistrationSubmission } from './types';
import {
  getTournamentBySlugAsync,
  savePlayerRegistrationAsync,
  incrementRegistrationCountAsync,
  getPendingOrder,
} from './tournamentStore';

// In-memory debounce map to prevent calling Razorpay API on every sub-second request
const lastSyncMap = new Map<string, number>();
const SYNC_INTERVAL_MS = 15000; // 15 seconds debounce per tournament

export async function reconcileMissingTournamentPayments(slug: string): Promise<number> {
  if (!slug) return 0;

  const now = Date.now();
  const lastSync = lastSyncMap.get(slug.toLowerCase()) || 0;
  if (now - lastSync < SYNC_INTERVAL_MS) {
    return 0; // Throttled to maintain high speed & stay within API limits
  }
  lastSyncMap.set(slug.toLowerCase(), now);

  try {
    const keyId =
      process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret || keyId.includes('placeholder')) {
      return 0;
    }

    const tournament = await getTournamentBySlugAsync(slug);
    if (!tournament || !tournament.isPaid) {
      return 0;
    }

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
    const paymentsRes = await razorpay.payments.all({ count: 30 });
    const payments = paymentsRes.items || [];

    // Query existing players for this tournament from Supabase
    const { data: dbPlayers } = await supabase
      .from('players')
      .select('registration_id, payment_id, order_id, phone, payment_status')
      .ilike('tournament_slug', slug);

    const existingPaymentIds = new Set(
      (dbPlayers || []).map((p) => p.payment_id).filter(Boolean)
    );
    const existingOrderIds = new Set(
      (dbPlayers || []).map((p) => p.order_id).filter(Boolean)
    );
    const existingPhones = new Set(
      (dbPlayers || [])
        .filter((p) => p.payment_status !== 'PENDING_PAYMENT')
        .map((p) => clean10DigitPhone(p.phone || ''))
        .filter(Boolean)
    );

    let recoveredCount = 0;

    for (const pay of payments) {
      if (pay.status !== 'captured') continue;

      const tourneySlugInNotes =
        pay.notes?.tournamentSlug || pay.notes?.tournament_slug || '';
      const isMatch =
        tourneySlugInNotes.toLowerCase() === slug.toLowerCase() ||
        (tourneySlugInNotes === '' &&
          Number(pay.amount) === Math.round(Number(tournament.entryFee) * 100));

      if (!isMatch) continue;

      const playerPhone = clean10DigitPhone(
        String(pay.notes?.phone || pay.contact || '')
      );

      // Check if already reconciled by payment ID, order ID, or player phone
      if (
        existingPaymentIds.has(pay.id) ||
        (pay.order_id && existingOrderIds.has(pay.order_id)) ||
        (playerPhone && existingPhones.has(playerPhone))
      ) {
        continue;
      }

      // Found un-reconciled captured payment!
      const playerName =
        pay.notes?.fullName ||
        pay.notes?.player_name ||
        'Verified Player';

      const timestamp = new Date(pay.created_at * 1000).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'medium',
      });

      const pending =
        (pay.order_id ? getPendingOrder(pay.order_id) : null) ||
        (pay.description ? getPendingOrder(pay.description.replace(/^#/, '')) : null) ||
        (playerPhone ? getPendingOrder(`${playerPhone}_${slug}`) : null) ||
        (playerPhone ? getPendingOrder(`${playerPhone}_${tournament.slug}`) : null);

      // Check persistent Supabase draft records to recover photo and all form data
      let draftFromDb: any = null;
      try {
        if (pay.order_id) {
          const { data: dOrder } = await supabase
            .from('players')
            .select('*')
            .eq('order_id', pay.order_id)
            .eq('payment_status', 'PENDING_PAYMENT')
            .maybeSingle();
          if (dOrder) draftFromDb = dOrder;
        }
        if (!draftFromDb && playerPhone) {
          const { data: dPhone } = await supabase
            .from('players')
            .select('*')
            .ilike('tournament_slug', slug)
            .ilike('phone', `%${playerPhone}%`)
            .eq('payment_status', 'PENDING_PAYMENT')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (dPhone) draftFromDb = dPhone;
        }
      } catch (e) {}

      const resolvedPhoto = draftFromDb?.photo_url || pending?.photoUrl || '';
      const resolvedName = draftFromDb?.full_name || pending?.fullName || String(playerName).trim();
      const resolvedAge = draftFromDb?.age || pending?.age || '24';
      const resolvedRole = (draftFromDb?.role as PlayingRole) || (pending?.role as PlayingRole) || ('Batting All-Rounder' as PlayingRole);
      const resolvedBatting = draftFromDb?.batting_style || pending?.battingStyle || 'Right-hand';
      const resolvedBowling = draftFromDb?.bowling_style || pending?.bowlingStyle || 'Right-arm Fast';
      const resolvedStats = (draftFromDb?.stats && draftFromDb.stats !== 'Draft pending checkout') 
        ? draftFromDb.stats 
        : (pending?.stats || 'Auto-reconciled via Razorpay Gateway');

      // Clean up temporary draft row if it existed
      if (draftFromDb?.registration_id) {
        try {
          await supabase.from('players').delete().eq('registration_id', draftFromDb.registration_id);
        } catch (e) {}
      }

      const newRecord: RegistrationSubmission = {
        timestamp,
        registrationId: `CRIC-2026-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
        tournamentSlug: tournament.slug,
        tournamentTitle: tournament.title,
        fullName: resolvedName,
        phone: pending?.phone || playerPhone || '9876543210',
        age: resolvedAge,
        role: resolvedRole,
        battingStyle: resolvedBatting,
        bowlingStyle: resolvedBowling,
        stats: resolvedStats,
        photoUrl: resolvedPhoto,
        paymentId: pay.id,
        orderId: pay.order_id || 'AUTO_RECONCILED',
        paymentStatus: 'PAID',
        amount: pay.amount ? Number(pay.amount) / 100 : Number(tournament.entryFee) || 0,
      };

      // Double check Supabase right before saving to prevent race conditions with returning checkout
      const { data: alreadyInserted } = await supabase
        .from('players')
        .select('registration_id')
        .or(`payment_id.eq.${pay.id}${playerPhone ? `,phone.ilike.%${playerPhone}%` : ''}`)
        .ilike('tournament_slug', tournament.slug)
        .neq('payment_status', 'PENDING_PAYMENT')
        .maybeSingle();

      if (alreadyInserted) {
        existingPaymentIds.add(pay.id);
        if (playerPhone) existingPhones.add(playerPhone);
        continue;
      }

      await savePlayerRegistrationAsync(newRecord);
      await incrementRegistrationCountAsync(tournament.slug);
      existingPaymentIds.add(pay.id);
      if (playerPhone) existingPhones.add(playerPhone);
      recoveredCount++;
      console.log(
        `[Auto-Recovery] Successfully reconciled payment ${pay.id} for player "${playerName}" in ${tournament.slug}`
      );
    }

    return recoveredCount;
  } catch (err) {
    console.error('[Auto-Recovery] Error reconciling payments:', err);
    return 0;
  }
}
