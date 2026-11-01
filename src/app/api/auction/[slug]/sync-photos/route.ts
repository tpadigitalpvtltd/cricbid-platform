import { NextResponse } from 'next/server';
import { getAllPlayers, updatePlayer } from '@/lib/tournamentStore';
import { invalidateAuctionPlayersCache, invalidateAuctionStateCache } from '@/lib/auctionStore';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const slug = (params.slug || 'ympl-season-2-organised-by-sr11-kqel').toLowerCase();
  const sbUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://dbakxdpudmfhrnhgyglq.supabase.co';
  const sbKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';

  const allPlayers = getAllPlayers();
  const missingPlayers = allPlayers.filter(
    (p) => !p.photoUrl || !p.photoUrl.startsWith('data:image/')
  );

  let syncedNow = 0;
  let dbReachable = false;

  // Fetch missing photos in small sequential batches of 4 so PostgreSQL never chokes
  const batchSize = 4;
  for (let i = 0; i < missingPlayers.length; i += batchSize) {
    const batch = missingPlayers.slice(i, i + batchSize);
    const idsCsv = batch.map((p) => `"${p.registrationId}"`).join(',');
    try {
      const res = await fetch(
        `${sbUrl}/rest/v1/players?registration_id=in.(${encodeURIComponent(idsCsv)})&select=registration_id,photo_url`,
        {
          headers: {
            apikey: sbKey,
            Authorization: `Bearer ${sbKey}`,
          },
          signal: AbortSignal.timeout(8000),
        }
      );
      if (res.ok) {
        dbReachable = true;
        const rows = await res.json();
        if (Array.isArray(rows)) {
          for (const row of rows) {
            const pid = row?.registration_id;
            const photo = row?.photo_url?.trim?.();
            if (pid && photo && photo.startsWith('data:image/')) {
              updatePlayer(pid, { photoUrl: photo });
              syncedNow++;
            }
          }
        }
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  if (syncedNow > 0) {
    invalidateAuctionPlayersCache(slug);
    invalidateAuctionStateCache(slug);
  }

  const updatedPlayers = getAllPlayers();
  const totalWithRealPhoto = updatedPlayers.filter(
    (p) => p.photoUrl && p.photoUrl.startsWith('data:image/')
  ).length;

  return NextResponse.json({
    success: true,
    dbReachable,
    totalPlayers: updatedPlayers.length,
    totalWithRealPhoto,
    remainingWithoutPhoto: updatedPlayers.length - totalWithRealPhoto,
    syncedNow,
  });
}
