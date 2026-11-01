import { NextResponse } from 'next/server';
import { supabase, isSupabaseHealthy } from '@/lib/supabase';
import { getAllPlayers } from '@/lib/tournamentStore';

// In-memory cache to prevent redundant Supabase queries and speed up rendering
const photoCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour memory TTL

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

function getInitials(name: string): string {
  if (!name) return 'CR';
  const parts = name.replace(/[()[\]{}]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderFallbackPlayerSvg(player?: { fullName?: string; role?: string; registrationId?: string }): Response {
  const fullName = (player?.fullName || 'CRICKET PLAYER').toUpperCase();
  const initials = escapeXml(getInitials(fullName));
  const displayRole = escapeXml((player?.role || 'OFFICIAL DRAFT PLAYER').toUpperCase());
  const displayName = escapeXml(fullName.length > 22 ? fullName.slice(0, 20) + '..' : fullName);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">
  <defs>
    <radialGradient id="glow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.38"/>
      <stop offset="55%" stop-color="#1e293b" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#070c18" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <linearGradient id="jersey" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="#070c18"/>
  <rect width="600" height="600" fill="url(#glow)"/>
  <circle cx="300" cy="245" r="185" fill="none" stroke="#f59e0b" stroke-width="2" stroke-opacity="0.22" stroke-dasharray="10 8"/>
  <!-- Cricket Silhouette / Jersey Shoulders -->
  <path d="M120 510 C120 375 200 340 300 340 C400 340 480 375 480 510 Z" fill="url(#jersey)" stroke="#f59e0b" stroke-width="3" stroke-opacity="0.5"/>
  <path d="M235 342 L300 410 L365 342" fill="none" stroke="#fbbf24" stroke-width="5" stroke-opacity="0.8"/>
  <!-- Avatar Head Circle -->
  <circle cx="300" cy="215" r="96" fill="#0f172a" stroke="url(#gold)" stroke-width="5"/>
  <text x="300" y="242" text-anchor="middle" fill="#fbbf24" font-family="Arial, sans-serif" font-weight="900" font-size="78" letter-spacing="3">${initials}</text>
  <!-- Nameplate Banner -->
  <rect x="60" y="455" width="480" height="64" rx="16" fill="#090f1f" stroke="#f59e0b" stroke-width="2.5" stroke-opacity="0.7"/>
  <text x="300" y="496" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-weight="900" font-size="28" letter-spacing="1.5">${displayName}</text>
  <rect x="170" y="530" width="260" height="32" rx="10" fill="#f59e0b" fill-opacity="0.18"/>
  <text x="300" y="551" text-anchor="middle" fill="#fbbf24" font-family="Arial, sans-serif" font-weight="800" font-size="15" letter-spacing="2">${displayRole}</text>
</svg>`;
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store, must-revalidate',
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const rawId = params.id;
    if (!rawId) {
      return new Response('Player ID is required', { status: 400 });
    }

    const registrationId = decodeURIComponent(rawId).trim();

    // 1. Check local players store first (in case photo was uploaded/edited locally)
    let photoUrl = '';
    let foundLocal: any = undefined;
    try {
      const localPlayers = getAllPlayers();
      foundLocal = localPlayers.find(
        (p) => p.registrationId && p.registrationId.toLowerCase() === registrationId.toLowerCase()
      );
      if (foundLocal?.photoUrl && !foundLocal.photoUrl.startsWith('/api/player-photo/')) {
        photoUrl = foundLocal.photoUrl.trim();
      }
    } catch {}

    // 2. Check in-memory LRU cache if not overridden by local data:image
    if (!photoUrl) {
      const cached = photoCache.get(registrationId);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return new Response(new Uint8Array(cached.buffer), {
          status: 200,
          headers: {
            'Content-Type': cached.contentType,
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          },
        });
      }
    }

    // 3. Fetch photo_url directly from Supabase REST index (bypassing 550ms circuit breaker)
    if (!photoUrl) {
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
      if (sbUrl && sbKey) {
        try {
          const restRes = await fetch(
            `${sbUrl}/rest/v1/players?registration_id=eq.${encodeURIComponent(registrationId.toUpperCase())}&select=photo_url&limit=1`,
            {
              headers: {
                apikey: sbKey,
                Authorization: `Bearer ${sbKey}`,
              },
              signal: AbortSignal.timeout(4500),
            }
          );
          if (restRes.ok) {
            const rows = await restRes.json();
            const candidate = rows?.[0]?.photo_url?.trim?.();
            if (candidate && !candidate.startsWith('/api/player-photo/')) {
              photoUrl = candidate;
            }
          }
        } catch {}
      }
    }

    if (!photoUrl) {
      return renderFallbackPlayerSvg(foundLocal);
    }

    // 4. Handle external image URLs
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
      return NextResponse.redirect(photoUrl, 302);
    }

    // 5. Handle base64 Data URIs (e.g. data:image/jpeg;base64,....)
    if (photoUrl.startsWith('data:image/')) {
      const match = photoUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const contentType = match[1] || 'image/jpeg';
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');

        if (photoCache.size > 500) {
          const oldestKey = photoCache.keys().next().value;
          if (oldestKey) photoCache.delete(oldestKey);
        }

        photoCache.set(registrationId, { buffer, contentType, timestamp: Date.now() });

        return new Response(new Uint8Array(buffer), {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache, must-revalidate',
          },
        });
      }
    }

    return renderFallbackPlayerSvg(foundLocal);
  } catch (err: any) {
    console.error('Error in GET /api/player-photo/[id]:', err);
    return renderFallbackPlayerSvg();
  }
}
