import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// In-memory cache to prevent redundant Supabase queries and speed up rendering
const photoCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
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
      return new Response('Player ID is required', { status: 400 });
    }

    const registrationId = decodeURIComponent(rawId).trim();

    // 1. Check in-memory LRU cache first (instant response in <1ms)
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

    // 2. Fetch photo_url from Supabase
    const { data, error } = await supabase
      .from('players')
      .select('photo_url')
      .ilike('registration_id', registrationId)
      .maybeSingle();

    if (error || !data || !data.photo_url || typeof data.photo_url !== 'string') {
      return new Response('Photo not found', { status: 404 });
    }

    const photoUrl = data.photo_url.trim();

    // 3. Handle external image URLs
    if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
      return NextResponse.redirect(photoUrl, 302);
    }

    // 4. Handle base64 Data URIs (e.g. data:image/jpeg;base64,....)
    if (photoUrl.startsWith('data:image/')) {
      const match = photoUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const contentType = match[1] || 'image/jpeg';
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');

        // Prevent memory leak by keeping cache bounded
        if (photoCache.size > 500) {
          const oldestKey = photoCache.keys().next().value;
          if (oldestKey) photoCache.delete(oldestKey);
        }

        photoCache.set(registrationId, { buffer, contentType, timestamp: Date.now() });

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
    console.error('Error in GET /api/player-photo/[id]:', err);
    return new Response('Internal server error', { status: 500 });
  }
}
