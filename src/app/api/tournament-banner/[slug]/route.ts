import { NextResponse } from 'next/server';
import { supabase, withTimeout } from '@/lib/supabase';
import { getTournamentBySlug } from '@/lib/tournamentStore';

// In-memory cache for fast sub-millisecond responses
const bannerCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const DEFAULT_BANNER =
  'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const rawSlug = params.slug;
    if (!rawSlug) {
      return NextResponse.redirect(DEFAULT_BANNER, 302);
    }

    const cleanSlug = decodeURIComponent(rawSlug).trim().toLowerCase();

    // 1. Check in-memory cache first
    const cached = bannerCache.get(cleanSlug);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return new Response(new Uint8Array(cached.buffer), {
        status: 200,
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
        },
      });
    }

    // 2. Query Supabase for banner_url
    let bannerUrl = '';
    try {
      const { data, error } = await withTimeout(
        supabase
          .from('tournaments')
          .select('banner_url')
          .ilike('slug', cleanSlug)
          .maybeSingle(),
        3000
      );
      if (!error && data?.banner_url) {
        bannerUrl = data.banner_url;
      }
    } catch (e) {}

    // 3. Fallback to local store
    if (!bannerUrl) {
      const local = getTournamentBySlug(cleanSlug);
      if (local?.bannerUrl && !local.bannerUrl.startsWith('/api/tournament-banner/')) {
        bannerUrl = local.bannerUrl;
      }
    }

    if (!bannerUrl) {
      return NextResponse.redirect(DEFAULT_BANNER, 302);
    }

    // 4. If HTTP URL, redirect
    if (bannerUrl.startsWith('http://') || bannerUrl.startsWith('https://')) {
      return NextResponse.redirect(bannerUrl, 302);
    }

    // 5. If base64 data URI, decode and serve as raw binary image
    if (bannerUrl.startsWith('data:image/')) {
      const match = bannerUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const contentType = match[1] || 'image/jpeg';
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');

        if (bannerCache.size > 20) {
          const oldestKey = bannerCache.keys().next().value;
          if (oldestKey) bannerCache.delete(oldestKey);
        }

        bannerCache.set(cleanSlug, { buffer, contentType, timestamp: Date.now() });

        return new Response(new Uint8Array(buffer), {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
          },
        });
      }
    }

    return NextResponse.redirect(DEFAULT_BANNER, 302);
  } catch (err) {
    console.error('Error in GET /api/tournament-banner/[slug]:', err);
    return NextResponse.redirect(DEFAULT_BANNER, 302);
  }
}
