import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { supabase, isSupabaseHealthy } from '@/lib/supabase';
import { getDefaultSeedTeams } from '@/lib/auctionStore';

// In-memory cache to prevent redundant Supabase queries and speed up rendering
const logoCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour memory TTL

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

function renderTeamCrestSvg(shortName = 'TM', color = '#f59e0b'): Response {
  const safeShort = (shortName || 'TM').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'TM';
  const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(color || '') ? color : '#f59e0b';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <rect width="160" height="160" rx="32" fill="#0b1329"/>
  <path d="M80 18 L134 38 L134 84 C134 118 110 138 80 146 C50 138 26 118 26 84 L26 38 Z" fill="${safeColor}" opacity="0.2" stroke="${safeColor}" stroke-width="5"/>
  <text x="80" y="94" font-family="Arial, sans-serif" font-weight="900" font-size="38" fill="#ffffff" text-anchor="middle">${safeShort}</text>
</svg>`;
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
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
      return renderTeamCrestSvg('TM', '#f59e0b');
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

    // 2. Check seed / local teams for metadata or data:image logo
    let logoUrl = '';
    let fallbackShort = 'TM';
    let fallbackColor = '#f59e0b';

    try {
      const ymplTeams = getDefaultSeedTeams('ympl-season-2-organised-by-sr11-kqel');
      const matched = ymplTeams.find((t) => t.id === teamId);
      if (matched) {
        fallbackShort = matched.shortName || matched.name.slice(0, 3).toUpperCase();
        fallbackColor = matched.color || '#f59e0b';
        if (matched.logoUrl && !matched.logoUrl.startsWith('/api/team-logo/')) {
          logoUrl = matched.logoUrl;
        }
      }
      if (!logoUrl) {
        const seedPath = path.join(process.cwd(), 'data', 'auction_data.json');
        if (fs.existsSync(seedPath)) {
          const ad = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
          for (const slug of Object.keys(ad.teams || {})) {
            const foundTeam = (ad.teams[slug] || []).find((t: any) => t.id === teamId);
            if (foundTeam) {
              fallbackShort = foundTeam.shortName || foundTeam.name?.slice(0, 3)?.toUpperCase() || fallbackShort;
              fallbackColor = foundTeam.color || fallbackColor;
              if (foundTeam.logoUrl && !foundTeam.logoUrl.startsWith('/api/team-logo/')) {
                logoUrl = foundTeam.logoUrl;
                break;
              }
            }
          }
        }
      }
    } catch {}

    // 3. Fetch logo_url from Supabase tournament_teams if healthy
    if (!logoUrl && isSupabaseHealthy()) {
      const { data, error } = await supabase
        .from('tournament_teams')
        .select('logo_url, short_name, color')
        .eq('id', teamId)
        .maybeSingle();

      if (!error && data) {
        if (data.short_name) fallbackShort = data.short_name;
        if (data.color) fallbackColor = data.color;
        if (data.logo_url && typeof data.logo_url === 'string' && !data.logo_url.startsWith('/api/team-logo/')) {
          logoUrl = data.logo_url.trim();
        }
      }
    }

    if (!logoUrl) {
      return renderTeamCrestSvg(fallbackShort, fallbackColor);
    }

    // 4. Handle external image URLs
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      return NextResponse.redirect(logoUrl, 302);
    }

    // 5. Handle base64 Data URIs (e.g. data:image/png;base64,....)
    if (logoUrl.startsWith('data:image/')) {
      const match = logoUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const contentType = match[1] || 'image/png';
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');

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

    return renderTeamCrestSvg(fallbackShort, fallbackColor);
  } catch (err: any) {
    console.error('Error in GET /api/team-logo/[id]:', err);
    return renderTeamCrestSvg('TM', '#f59e0b');
  }
}
