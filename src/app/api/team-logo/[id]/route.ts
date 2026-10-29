import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// In-memory cache to prevent redundant Supabase queries and speed up rendering
const logoCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour memory TTL

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const rawId = params.id;
    if (!rawId) {
      return new Response('Team ID is required', { status: 400 });
    }

    const teamId = decodeURIComponent(rawId).trim();

    // 1. Check in-memory LRU cache first (instant response in <1ms)
    const cached = logoCache.get(teamId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return new Response(new Uint8Array(cached.buffer), {
        status: 200,
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      });
    }

    // 2. Fetch logo_url from Supabase tournament_teams
    const { data, error } = await supabase
      .from('tournament_teams')
      .select('logo_url')
      .eq('id', teamId)
      .maybeSingle();

    if (error || !data || !data.logo_url || typeof data.logo_url !== 'string') {
      return new Response('Team logo not found', { status: 404 });
    }

    const logoUrl = data.logo_url.trim();

    // 3. Handle external image URLs
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      return NextResponse.redirect(logoUrl, 302);
    }

    // 4. Handle base64 Data URIs (e.g. data:image/png;base64,....)
    if (logoUrl.startsWith('data:image/')) {
      const match = logoUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const contentType = match[1] || 'image/png';
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');

        // Prevent memory leak by keeping cache bounded
        if (logoCache.size > 100) {
          const oldestKey = logoCache.keys().next().value;
          if (oldestKey) logoCache.delete(oldestKey);
        }

        logoCache.set(teamId, { buffer, contentType, timestamp: Date.now() });

        return new Response(new Uint8Array(buffer), {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
          },
        });
      }
    }

    return new Response('Unsupported image format', { status: 400 });
  } catch (err: any) {
    console.error('Error in GET /api/team-logo/[id]:', err);
    return new Response('Internal server error', { status: 500 });
  }
}
