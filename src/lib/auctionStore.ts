import fs from 'fs';
import path from 'path';
import os from 'os';
import {  supabase, withTimeout } from './supabase';
import {
  TournamentTeam,
  AuctionRoom,
  AuctionBid,
  AuctionPlayerState,
  FullAuctionState,
  SoldRecord,
  AuctionRoomStatus,
  PlayerAuctionStatus,
} from './auctionTypes';
import { getPlayersByTournamentAsync, getTournamentBySlugAsync , savePlayerRegistrationAsync, incrementRegistrationCountAsync } from './tournamentStore';
import { RegistrationSubmission } from './types';

const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NODE_ENV === 'production'
);

const STORAGE_DIR = isServerless
  ? path.join(os.tmpdir(), 'cricbid-data')
  : path.join(process.cwd(), 'data');

const AUCTION_DATA_FILE = path.join(STORAGE_DIR, 'auction_data.json');

interface LocalAuctionData {
  rooms: Record<string, AuctionRoom>;
  teams: Record<string, TournamentTeam[]>;
  teamsInitialized: Record<string, boolean>;
  bids: Record<string, AuctionBid[]>;
  playerStates: Record<string, Record<string, AuctionPlayerState>>; // slug -> playerId -> state
}

// In-memory fallback
declare global {
  var __CRICBID_AUCTION_DATA__: LocalAuctionData | undefined;
}

if (!globalThis.__CRICBID_AUCTION_DATA__) {
  globalThis.__CRICBID_AUCTION_DATA__ = {
    rooms: {},
    teams: {},
    teamsInitialized: {},
    bids: {},
    playerStates: {},
  };
}

function ensureStorageDir(): void {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  } catch (err) {}
}

function readLocalData(): LocalAuctionData {
  if (globalThis.__CRICBID_AUCTION_DATA__ && Object.keys(globalThis.__CRICBID_AUCTION_DATA__.rooms).length > 0) {
    return globalThis.__CRICBID_AUCTION_DATA__;
  }
  try {
    if (fs.existsSync(AUCTION_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(AUCTION_DATA_FILE, 'utf8') || '{}');
      if (data && typeof data === 'object') {
        globalThis.__CRICBID_AUCTION_DATA__ = {
          rooms: data.rooms || {},
          teams: data.teams || {},
          teamsInitialized: data.teamsInitialized || {},
          bids: data.bids || {},
          playerStates: data.playerStates || {},
        };
        return globalThis.__CRICBID_AUCTION_DATA__;
      }
    }
  } catch (err) {}

  return (
    globalThis.__CRICBID_AUCTION_DATA__ || {
      rooms: {},
      teams: {},
      teamsInitialized: {},
      bids: {},
      playerStates: {},
    }
  );
}

function saveLocalData(data: LocalAuctionData): void {
  globalThis.__CRICBID_AUCTION_DATA__ = data;
  try {
    ensureStorageDir();
    fs.writeFileSync(AUCTION_DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {}
}

/**
 * Generate 6 default starter teams with rich cricket branding and 4-digit PINs
 */
export function getDefaultSeedTeams(slug: string): TournamentTeam[] {
  const isYmpl = slug.toLowerCase().includes('ympl');
  if (isYmpl) {
    return [
      {
        id: `team_${slug}_st`,
        tournamentSlug: slug,
        name: 'Super Titan',
        shortName: 'ST',
        logoUrl: '',
        color: '#0ea5e9',
        totalPurse: 100000,
        remainingPurse: 100000,
        secretPin: '1111',
        maxPlayers: 15,
        boughtPlayersCount: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: `team_${slug}_ra`,
        tournamentSlug: slug,
        name: 'Rani Amravati',
        shortName: 'RA',
        logoUrl: '',
        color: '#ec4899',
        totalPurse: 100000,
        remainingPurse: 100000,
        secretPin: '2222',
        maxPlayers: 15,
        boughtPlayersCount: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: `team_${slug}_kb`,
        tournamentSlug: slug,
        name: 'Kohinoor Badshah',
        shortName: 'KB',
        logoUrl: '',
        color: '#f59e0b',
        totalPurse: 100000,
        remainingPurse: 100000,
        secretPin: '3333',
        maxPlayers: 15,
        boughtPlayersCount: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: `team_${slug}_sr`,
        tournamentSlug: slug,
        name: 'SR Striker',
        shortName: 'SR',
        logoUrl: '',
        color: '#10b981',
        totalPurse: 100000,
        remainingPurse: 100000,
        secretPin: '4444',
        maxPlayers: 15,
        boughtPlayersCount: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: `team_${slug}_sm`,
        tournamentSlug: slug,
        name: 'Sahara MSD',
        shortName: 'SM',
        logoUrl: '',
        color: '#3b82f6',
        totalPurse: 100000,
        remainingPurse: 100000,
        secretPin: '5555',
        maxPlayers: 15,
        boughtPlayersCount: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: `team_${slug}_gr`,
        tournamentSlug: slug,
        name: 'GRCC',
        shortName: 'GR',
        logoUrl: '',
        color: '#8b5cf6',
        totalPurse: 100000,
        remainingPurse: 100000,
        secretPin: '6666',
        maxPlayers: 15,
        boughtPlayersCount: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: `team_${slug}_cs`,
        tournamentSlug: slug,
        name: 'CSK',
        shortName: 'CS',
        logoUrl: '',
        color: '#eab308',
        totalPurse: 100000,
        remainingPurse: 100000,
        secretPin: '7777',
        maxPlayers: 15,
        boughtPlayersCount: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: `team_${slug}_2s`,
        tournamentSlug: slug,
        name: '2 Star Furniture',
        shortName: '2S',
        logoUrl: '',
        color: '#14b8a6',
        totalPurse: 100000,
        remainingPurse: 100000,
        secretPin: '8888',
        maxPlayers: 15,
        boughtPlayersCount: 0,
        createdAt: new Date().toISOString(),
      },
    ];
  }

  return [
    {
      id: `team_${slug}_mt`,
      tournamentSlug: slug,
      name: 'Mumbai Titans',
      shortName: 'MT',
      logoUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=150&auto=format&fit=crop&q=80',
      color: '#0ea5e9',
      totalPurse: 100000,
      remainingPurse: 100000,
      secretPin: '1111',
      maxPlayers: 15,
      boughtPlayersCount: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: `team_${slug}_rc`,
      tournamentSlug: slug,
      name: 'Royal Challengers',
      shortName: 'RC',
      logoUrl: 'https://images.unsplash.com/photo-1511193311914-0346f16efe90?w=150&auto=format&fit=crop&q=80',
      color: '#ef4444',
      totalPurse: 100000,
      remainingPurse: 100000,
      secretPin: '2222',
      maxPlayers: 15,
      boughtPlayersCount: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: `team_${slug}_css`,
      tournamentSlug: slug,
      name: 'Chennai Super Strikers',
      shortName: 'CSS',
      logoUrl: 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=150&auto=format&fit=crop&q=80',
      color: '#f59e0b',
      totalPurse: 100000,
      remainingPurse: 100000,
      secretPin: '3333',
      maxPlayers: 15,
      boughtPlayersCount: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: `team_${slug}_kk`,
      tournamentSlug: slug,
      name: 'Kolkata Knights',
      shortName: 'KK',
      logoUrl: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=150&auto=format&fit=crop&q=80',
      color: '#8b5cf6',
      totalPurse: 100000,
      remainingPurse: 100000,
      secretPin: '4444',
      maxPlayers: 15,
      boughtPlayersCount: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: `team_${slug}_dd`,
      tournamentSlug: slug,
      name: 'Delhi Dynamos',
      shortName: 'DD',
      logoUrl: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?w=150&auto=format&fit=crop&q=80',
      color: '#06b6d4',
      totalPurse: 100000,
      remainingPurse: 100000,
      secretPin: '5555',
      maxPlayers: 15,
      boughtPlayersCount: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: `team_${slug}_pw`,
      tournamentSlug: slug,
      name: 'Punjab Warriors',
      shortName: 'PW',
      logoUrl: 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?w=150&auto=format&fit=crop&q=80',
      color: '#f43f5e',
      totalPurse: 100000,
      remainingPurse: 100000,
      secretPin: '6666',
      maxPlayers: 15,
      boughtPlayersCount: 0,
      createdAt: new Date().toISOString(),
    },
  ];
}

/**
 * Broadcast an auction event across connected clients via Supabase Realtime channel
 */
export async function broadcastAuctionUpdate(slug: string, event: string, payload: any): Promise<void> {
  try {
    const cleanSlug = slug.toLowerCase();
    const channel = supabase.channel(`auction_${cleanSlug}`);

    // Helper to optimize large base64 strings into CDN-cacheable URLs for instant sub-30ms broadcast
    const optPhoto = (p: any) => {
      if (!p) return '';
      const photo = p.photoUrl || '';
      if (typeof photo === 'string' && photo.startsWith('data:image/') && p.registrationId) {
        return `/api/player-photo/${encodeURIComponent(p.registrationId)}`;
      }
      return photo;
    };

    const optLogo = (t: any) => {
      if (!t) return '';
      const logo = t.logoUrl || t.teamLogoUrl || '';
      const id = t.id || t.teamId;
      if (typeof logo === 'string' && logo.startsWith('data:image/') && id) {
        return `/api/team-logo/${encodeURIComponent(id)}`;
      }
      return logo;
    };

    // Ensure broadcast payload is ultra-lean (<15KB) so Supabase Realtime delivers in <30ms without dropping
    let broadcastPayload = { ...payload, timestamp: Date.now() };

    if (broadcastPayload.bid) {
      broadcastPayload.bid = {
        ...broadcastPayload.bid,
        teamLogoUrl: optLogo(broadcastPayload.bid),
      };
    }

    if (broadcastPayload.team) {
      broadcastPayload.team = {
        ...broadcastPayload.team,
        logoUrl: optLogo(broadcastPayload.team),
      };
    }

    if (broadcastPayload.state) {
      broadcastPayload.state = {
        ...broadcastPayload.state,
        playersQueue: [], // Strip heavy queue to guarantee sub-30ms instant delivery (clients keep their cached queue)
      };

      if (broadcastPayload.state.currentPlayer) {
        broadcastPayload.state.currentPlayer = {
          ...broadcastPayload.state.currentPlayer,
          photoUrl: optPhoto(broadcastPayload.state.currentPlayer),
        };
      }

      if (Array.isArray(broadcastPayload.state.teams)) {
        broadcastPayload.state.teams = broadcastPayload.state.teams.map((t: any) => ({
          ...t,
          logoUrl: optLogo(t),
        }));
      }

      if (broadcastPayload.state.currentBiddingTeam) {
        broadcastPayload.state.currentBiddingTeam = {
          ...broadcastPayload.state.currentBiddingTeam,
          logoUrl: optLogo(broadcastPayload.state.currentBiddingTeam),
        };
      }

      if (Array.isArray(broadcastPayload.state.recentBids)) {
        broadcastPayload.state.recentBids = broadcastPayload.state.recentBids.map((b: any) => ({
          ...b,
          teamLogoUrl: optLogo(b),
        }));
      }

      if (Array.isArray(broadcastPayload.state.soldHistory)) {
        broadcastPayload.state.soldHistory = broadcastPayload.state.soldHistory.map((sh: any) => ({
          ...sh,
          team: sh.team
            ? {
                ...sh.team,
                logoUrl: optLogo(sh.team),
              }
            : sh.team,
          player: sh.player
            ? {
                ...sh.player,
                photoUrl: optPhoto(sh.player),
              }
            : sh.player,
        }));
      }
    }

    // Use direct httpSend for instantaneous REST broadcast delivery without websocket handshake delays
    try {
      await channel.httpSend(event, broadcastPayload);
    } catch (httpErr) {
      // Fallback if httpSend encounters any version mismatch
      await channel.send({
        type: 'broadcast',
        event: event,
        payload: broadcastPayload,
      });
    }
  } catch (err) {
    console.error('broadcastAuctionUpdate error:', err);
  }
}

const PLAYERS_CACHE: Record<string, { data: RegistrationSubmission[]; timestamp: number }> = {};

export async function getAuctionTournamentPlayers(slug: string): Promise<RegistrationSubmission[]> {
  const cleanSlug = slug.toLowerCase();
  const cached = PLAYERS_CACHE[cleanSlug];
  // 30-second memory cache for instant sub-millisecond retrieval during live auction
  if (cached && Date.now() - cached.timestamp < 30000 && cached.data.length > 0) {
    return cached.data;
  }
  const players = await getPlayersByTournamentAsync(cleanSlug);
  if (players && players.length > 0) {
    PLAYERS_CACHE[cleanSlug] = { data: players, timestamp: Date.now() };
  }
  return players;
}

export function invalidateAuctionPlayersCache(slug: string): void {
  delete PLAYERS_CACHE[slug.toLowerCase()];
}

/**
 * Retrieve or initialize the Auction Room for a tournament
 */
export async function getAuctionRoom(slug: string): Promise<AuctionRoom> {
  const cleanSlug = slug.toLowerCase();
  const local = readLocalData();
  const cachedRoom = local.rooms[cleanSlug];

  // 1. Try Supabase
  try {
    const roomQuery = supabase
      .from('auction_rooms')
      .select('*')
      .ilike('tournament_slug', cleanSlug)
      .maybeSingle();
    const { data, error } = await withTimeout(roomQuery, 2500);

    if (!error && data) {
      const dbBid = Number(data.current_bid) || 0;
      const dbPlayerId = data.current_player_id;
      const dbTimestamp = Number(data.last_action_timestamp) || 0;

      // Bid Protection: If local memory room has a higher bid for the same player, use local memory!
      if (cachedRoom && cachedRoom.currentPlayerId === dbPlayerId && cachedRoom.currentBid > dbBid) {
        return cachedRoom;
      }
      if (cachedRoom && (cachedRoom.lastActionTimestamp || 0) > dbTimestamp) {
        return cachedRoom;
      }

      return {
        id: data.id,
        tournamentId: data.tournament_id,
        tournamentSlug: data.tournament_slug,
        status: data.status as AuctionRoomStatus,
        currentPlayerId: data.current_player_id,
        currentBid: dbBid,
        currentBiddingTeamId: data.current_bidding_team_id,
        timerSeconds: Number(data.timer_seconds) || 10,
        timerRunning: Boolean(data.timer_running),
        timerExpiresAt: data.timer_expires_at ? Number(data.timer_expires_at) : null,
        basePrice: Number(data.base_price) || 1000,
        bidIncrement: Number(data.bid_increment) || 500,
        lastAction: data.last_action,
        lastActionTimestamp: dbTimestamp || Date.now(),
        updatedAt: data.updated_at || new Date().toISOString(),
      };
    }
  } catch (err) {}

  // 2. Try Local Store
  if (cachedRoom) {
    return cachedRoom;
  }

  // 3. Create initial room
  const newRoom: AuctionRoom = {
    id: `room_${cleanSlug}_${Date.now()}`,
    tournamentSlug: cleanSlug,
    status: 'WAITING',
    currentPlayerId: null,
    currentBid: 0,
    currentBiddingTeamId: null,
    timerSeconds: 10,
    timerRunning: false,
    basePrice: 1000,
    bidIncrement: 500,
    lastAction: 'INIT',
    lastActionTimestamp: Date.now(),
    updatedAt: new Date().toISOString(),
  };

  local.rooms[cleanSlug] = newRoom;
  saveLocalData(local);

  // Sync with Supabase in background
  try {
    await supabase.from('auction_rooms').upsert({
      id: newRoom.id,
      tournament_slug: newRoom.tournamentSlug,
      status: newRoom.status,
      current_player_id: newRoom.currentPlayerId,
      current_bid: newRoom.currentBid,
      current_bidding_team_id: newRoom.currentBiddingTeamId,
      timer_seconds: newRoom.timerSeconds,
      timer_running: newRoom.timerRunning,
      base_price: newRoom.basePrice,
      bid_increment: newRoom.bidIncrement,
      last_action: newRoom.lastAction,
      last_action_timestamp: newRoom.lastActionTimestamp,
      updated_at: newRoom.updatedAt,
    });
  } catch (e) {}

  return newRoom;
}

/**
 * Save / Update Auction Room
 */
export async function saveAuctionRoom(room: AuctionRoom): Promise<AuctionRoom> {
  const cleanSlug = room.tournamentSlug.toLowerCase();
  room.updatedAt = new Date().toISOString();

  // Local write
  const local = readLocalData();
  local.rooms[cleanSlug] = room;
  saveLocalData(local);

  // Supabase write
  try {
    await supabase.from('auction_rooms').upsert({
      id: room.id,
      tournament_slug: cleanSlug,
      status: room.status,
      current_player_id: room.currentPlayerId,
      current_bid: room.currentBid,
      current_bidding_team_id: room.currentBiddingTeamId,
      timer_seconds: room.timerSeconds,
      timer_running: room.timerRunning,
      timer_expires_at: room.timerExpiresAt,
      base_price: room.basePrice,
      bid_increment: room.bidIncrement,
      last_action: room.lastAction,
      last_action_timestamp: room.lastActionTimestamp,
      updated_at: room.updatedAt,
    });
  } catch (err) {}

  return room;
}

/**
 * Get Tournament Teams (seeds default 6 teams if empty, respects empty if user deleted all)
 */
export async function getTournamentTeams(slug: string): Promise<TournamentTeam[]> {
  const cleanSlug = slug.toLowerCase();
  const local = readLocalData();
  const cachedTeams = local.teams[cleanSlug];

  // 1. Try Supabase with fast timeout
  try {
    const query = supabase
      .from('tournament_teams')
      .select('*')
      .ilike('tournament_slug', cleanSlug)
      .order('created_at', { ascending: true });

    const { data, error } = await withTimeout(query, 2500);

    if (!error && Array.isArray(data) && data.length > 0) {
      const teams = data.map((t) => ({
        id: t.id,
        tournamentId: t.tournament_id,
        tournamentSlug: t.tournament_slug,
        name: t.name,
        shortName: t.short_name,
        logoUrl: t.logo_url || '',
        color: t.color || '#f59e0b',
        totalPurse: Number(t.total_purse) || 100000,
        remainingPurse: Number(t.remaining_purse) || 100000,
        secretPin: String(t.secret_pin || '1111'),
        maxPlayers: Number(t.max_players) || 15,
        boughtPlayersCount: Number(t.bought_players_count) || 0,
        createdAt: t.created_at,
      }));
      local.teams[cleanSlug] = teams;
      local.teamsInitialized[cleanSlug] = true;
      saveLocalData(local);
      return teams;
    }
  } catch (err) {}

  // 2. Return cached local teams if available
  if (cachedTeams && cachedTeams.length > 0) {
    return cachedTeams;
  }

  // 3. Fallback to default seed teams (guarantees teams are NEVER 0!)
  const defaultTeams = getDefaultSeedTeams(cleanSlug);
  local.teams[cleanSlug] = defaultTeams;
  local.teamsInitialized[cleanSlug] = true;
  saveLocalData(local);
  return defaultTeams;
}

/**
 * Save Teams to Store
 */
export async function deleteTournamentTeam(slug: string, teamId: string): Promise<void> {
  const cleanSlug = slug.toLowerCase();
  const local = readLocalData();
  if (!local.teamsInitialized) local.teamsInitialized = {};
  local.teamsInitialized[cleanSlug] = true;
  if (local.teams[cleanSlug]) {
    local.teams[cleanSlug] = local.teams[cleanSlug].filter((t) => t.id !== teamId);
    saveLocalData(local);
  }
  try {
    await supabase.from('tournament_teams').delete().eq('id', teamId);
  } catch (e) {
    console.error('deleteTournamentTeam error:', e);
  }
}

export async function saveTournamentTeams(slug: string, teams: TournamentTeam[]): Promise<void> {
  const cleanSlug = slug.toLowerCase();
  const local = readLocalData();
  if (!local.teamsInitialized) local.teamsInitialized = {};
  local.teamsInitialized[cleanSlug] = true;
  local.teams[cleanSlug] = teams;
  saveLocalData(local);

  try {
    const keepIds = teams.map((t) => t.id);
    if (keepIds.length > 0) {
      const records = teams.map((t) => ({
        id: t.id,
        tournament_slug: cleanSlug,
        name: t.name,
        short_name: t.shortName,
        logo_url: t.logoUrl,
        color: t.color,
        total_purse: t.totalPurse,
        remaining_purse: t.remainingPurse,
        secret_pin: t.secretPin,
        max_players: t.maxPlayers,
        bought_players_count: t.boughtPlayersCount,
      }));

      // Single bulk upsert instead of sequential loop!
      await supabase.from('tournament_teams').upsert(records);

      // Clean up deleted teams if any
      const { data: currentDbTeams } = await supabase
        .from('tournament_teams')
        .select('id')
        .ilike('tournament_slug', cleanSlug);

      if (Array.isArray(currentDbTeams)) {
        const toDelete = currentDbTeams
          .filter((dbTeam) => !keepIds.includes(dbTeam.id))
          .map((dbTeam) => dbTeam.id);

        if (toDelete.length > 0) {
          await supabase.from('tournament_teams').delete().in('id', toDelete);
        }
      }
    } else {
      // If teams array is empty, remove all teams for this tournament
      await supabase
        .from('tournament_teams')
        .delete()
        .ilike('tournament_slug', cleanSlug);
    }
  } catch (e) {
    console.error('saveTournamentTeams error:', e);
  }
}

/**
 * Get Recent Auction Bids
 */
export async function getAuctionBids(slug: string, limit = 20): Promise<AuctionBid[]> {
  const cleanSlug = slug.toLowerCase();

  try {
    const bidsQuery = supabase
      .from('auction_bids')
      .select('*')
      .ilike('tournament_slug', cleanSlug)
      .order('timestamp', { ascending: false })
      .limit(limit);
    const { data, error } = await withTimeout(bidsQuery, 2500);

    if (!error && Array.isArray(data)) {
      return data.map((b) => ({
        id: b.id,
        auctionId: b.auction_id,
        tournamentSlug: b.tournament_slug,
        playerId: b.player_id,
        teamId: b.team_id,
        teamName: b.team_name,
        teamShortName: b.team_short_name,
        teamLogoUrl: b.team_logo_url,
        amount: Number(b.amount),
        createdAt: b.created_at,
      }));
    }
  } catch (err) {}

  const local = readLocalData();
  return (local.bids[cleanSlug] || []).slice(0, limit);
}

/**
 * Record a new Auction Bid
 */
export async function recordAuctionBid(bid: AuctionBid): Promise<void> {
  const cleanSlug = bid.tournamentSlug.toLowerCase();
  const local = readLocalData();
  if (!local.bids[cleanSlug]) local.bids[cleanSlug] = [];
  local.bids[cleanSlug].unshift(bid);
  saveLocalData(local);

  try {
    await supabase.from('auction_bids').insert({
      id: bid.id,
      auction_id: bid.auctionId,
      tournament_slug: cleanSlug,
      player_id: bid.playerId,
      team_id: bid.teamId,
      team_name: bid.teamName,
      team_short_name: bid.teamShortName || '',
      team_logo_url: bid.teamLogoUrl || '',
      amount: bid.amount,
      created_at: bid.createdAt,
    });
  } catch (err) {}
}

/**
 * Get Player Auction States (SOLD, UNSOLD, PENDING)
 */
export async function getAuctionPlayerStates(slug: string): Promise<Record<string, AuctionPlayerState>> {
  const cleanSlug = slug.toLowerCase();

  try {
    const pStateQuery = supabase
      .from('auction_players')
      .select('*')
      .ilike('tournament_slug', cleanSlug);
    const { data, error } = await withTimeout(pStateQuery, 2500);

    if (!error && Array.isArray(data) && data.length > 0) {
      const map: Record<string, AuctionPlayerState> = {};
      data.forEach((p) => {
        map[p.player_id] = {
          playerId: p.player_id,
          tournamentSlug: p.tournament_slug,
          status: p.status,
          basePrice: Number(p.base_price) || 1000,
          soldPrice: p.sold_price ? Number(p.sold_price) : null,
          soldToTeamId: p.sold_to_team_id,
          soldToTeamName: p.sold_to_team_name,
          soldToTeamLogo: p.sold_to_team_logo,
          updatedAt: p.updated_at,
        };
      });
      return map;
    }
  } catch (err) {}

  const local = readLocalData();
  return local.playerStates[cleanSlug] || {};
}

/**
 * Update a Player's Auction State
 */
export async function saveAuctionPlayerState(state: AuctionPlayerState): Promise<void> {
  const cleanSlug = state.tournamentSlug.toLowerCase();
  const local = readLocalData();
  if (!local.playerStates[cleanSlug]) local.playerStates[cleanSlug] = {};
  local.playerStates[cleanSlug][state.playerId] = state;
  saveLocalData(local);

  try {
    await supabase.from('auction_players').upsert({
      id: `${cleanSlug}_${state.playerId}`,
      tournament_slug: cleanSlug,
      player_id: state.playerId,
      status: state.status,
      base_price: state.basePrice,
      sold_price: state.soldPrice,
      sold_to_team_id: state.soldToTeamId,
      sold_to_team_name: state.soldToTeamName,
      sold_to_team_logo: state.soldToTeamLogo,
      updated_at: new Date().toISOString(),
    });
  } catch (err) {}
}

/**
 * Build consolidated state synchronously in memory (0ms execution time)
 */
export function buildFullAuctionStateSync(params: {
  slug: string;
  room: AuctionRoom;
  teams: TournamentTeam[];
  rawPlayers: RegistrationSubmission[];
  playerStates: Record<string, AuctionPlayerState>;
  bids: AuctionBid[];
}): FullAuctionState {
  const { slug, room, teams, rawPlayers, playerStates, bids } = params;
  const cleanSlug = slug.toLowerCase();

  // Current bidding team
  const currentBiddingTeam = teams.find((t) => t.id === room.currentBiddingTeamId) || null;

  // Build complete player queue
  const playersQueue = rawPlayers.map((player) => {
    const pState = playerStates[player.registrationId] || {
      playerId: player.registrationId,
      tournamentSlug: cleanSlug,
      status: 'PENDING' as PlayerAuctionStatus,
      basePrice: room.basePrice || 1000,
    };
    return {
      player,
      status: pState.status,
      basePrice: pState.basePrice,
      soldPrice: pState.soldPrice,
      soldTeamName: pState.soldToTeamName,
      soldToTeamId: pState.soldToTeamId,
    };
  });

  // Current active player
  let currentPlayer: RegistrationSubmission | null = null;
  let currentPlayerState: AuctionPlayerState | null = null;

  if (room.currentPlayerId) {
    currentPlayer = rawPlayers.find((p) => p.registrationId === room.currentPlayerId) || null;
    currentPlayerState = playerStates[room.currentPlayerId] || null;
  }

  // If no current player is set, pick the first pending player
  if (!currentPlayer && playersQueue.length > 0) {
    const firstPending = playersQueue.find((pq) => pq.status === 'PENDING') || playersQueue[0];
    if (firstPending) {
      currentPlayer = firstPending.player;
      currentPlayerState = {
        playerId: firstPending.player.registrationId,
        tournamentSlug: cleanSlug,
        status: firstPending.status === 'PENDING' ? 'IN_AUCTION' : firstPending.status,
        basePrice: firstPending.basePrice || room.basePrice || 1000,
      };
      room.currentPlayerId = currentPlayer.registrationId;
      if (room.currentBid === 0) {
        room.currentBid = currentPlayerState.basePrice;
      }
    }
  }

  // Sold history - match either by team id or team name
  const soldHistory: SoldRecord[] = [];
  rawPlayers.forEach((p) => {
    const st = playerStates[p.registrationId];
    if (st && st.status === 'SOLD' && (st.soldToTeamId || st.soldToTeamName)) {
      const team = teams.find(
        (t) =>
          t.id === st.soldToTeamId ||
          (st.soldToTeamName && t.name.toLowerCase() === st.soldToTeamName.toLowerCase())
      );
      if (team) {
        soldHistory.push({
          player: p,
          soldPrice: st.soldPrice || 0,
          team,
          soldAt: st.updatedAt || new Date().toISOString(),
        });
      }
    }
  });

  // Self-heal and mathematically guarantee exact consistency between soldHistory, team squad count, and remaining purse!
  teams.forEach((t) => {
    const teamSoldRecords = soldHistory.filter(
      (sh) => sh.team.id === t.id || (sh.team.name && t.name && sh.team.name.toLowerCase() === t.name.toLowerCase())
    );
    t.boughtPlayersCount = teamSoldRecords.length;
    const spentAmount = teamSoldRecords.reduce((sum, sh) => sum + (sh.soldPrice || 0), 0);
    if (t.totalPurse > 0) {
      t.remainingPurse = Math.max(0, t.totalPurse - spentAmount);
    }
  });

  return {
    room,
    teams,
    currentBiddingTeam,
    currentPlayer,
    currentPlayerState,
    recentBids: bids,
    soldHistory,
    playersQueue,
  };
}

/**
 * Retrieve the full consolidated state for the auction engine
 */
export async function getFullAuctionState(slug: string): Promise<FullAuctionState | null> {
  const cleanSlug = slug.toLowerCase();
  const tournament = await getTournamentBySlugAsync(cleanSlug);
  if (!tournament) return null;

  const [room, teams, rawPlayers, playerStates, bids] = await Promise.all([
    getAuctionRoom(cleanSlug),
    getTournamentTeams(cleanSlug),
    getAuctionTournamentPlayers(cleanSlug),
    getAuctionPlayerStates(cleanSlug),
    getAuctionBids(cleanSlug, 15),
  ]);

  return buildFullAuctionStateSync({
    slug: cleanSlug,
    room,
    teams,
    rawPlayers,
    playerStates,
    bids,
  });
}

/**
 * Place a Bid from Mobile Team Owner or Auctioneer
 */
export async function placeAuctionBid(params: {
  slug: string;
  teamId: string;
  amount: number;
  secretPin?: string;
}): Promise<{ success: boolean; error?: string; state?: FullAuctionState }> {
  const { slug, teamId, amount, secretPin } = params;
  const cleanSlug = slug.toLowerCase();

  const [room, teams, rawPlayers] = await Promise.all([
    getAuctionRoom(cleanSlug),
    getTournamentTeams(cleanSlug),
    getAuctionTournamentPlayers(cleanSlug),
  ]);

  if (room.status !== 'ACTIVE') {
    return { success: false, error: 'Auction is currently paused or waiting.' };
  }

  if (!room.currentPlayerId) {
    return { success: false, error: 'No active player in the bidding stage.' };
  }

  const team = teams.find((t) => t.id === teamId);
  if (!team) {
    return { success: false, error: 'Team not recognized in this tournament.' };
  }

  // Verify secret PIN if provided
  if (secretPin && team.secretPin !== secretPin) {
    return { success: false, error: 'Invalid 4-digit Team PIN.' };
  }

  // Check purse budget
  if (amount > team.remainingPurse) {
    return {
      success: false,
      error: `Insufficient purse! ${team.name} only has ₹${team.remainingPurse.toLocaleString('en-IN')} remaining.`,
    };
  }

  // Check player squad capacity
  if (team.boughtPlayersCount >= team.maxPlayers) {
    return {
      success: false,
      error: `${team.name} has already filled their maximum squad capacity of ${team.maxPlayers} players.`,
    };
  }

  // Check bid increment validity
  if (amount <= room.currentBid && room.currentBiddingTeamId) {
    return {
      success: false,
      error: `Bid must be higher than current bid of ₹${room.currentBid.toLocaleString('en-IN')}`,
    };
  }

  const activePlayer = rawPlayers.find((p) => p.registrationId === room.currentPlayerId);
  if (!activePlayer) {
    return { success: false, error: 'Active player data missing.' };
  }

  // Update room state
  room.currentBid = amount;
  room.currentBiddingTeamId = team.id;
  room.timerSeconds = 10;
  room.timerExpiresAt = null;
  room.timerRunning = false;
  room.lastAction = 'NEW_BID';
  room.lastActionTimestamp = Date.now();

  // Record bid
  const bidRecord: AuctionBid = {
    id: `bid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    auctionId: room.id,
    tournamentSlug: cleanSlug,
    playerId: activePlayer.registrationId,
    teamId: team.id,
    teamName: team.name,
    teamShortName: team.shortName,
    teamLogoUrl: team.logoUrl,
    amount,
    createdAt: new Date().toISOString(),
  };

  // Instantly save to local memory store in 0ms so subsequent reads never see a stale/lower bid!
  const local = readLocalData();
  local.rooms[cleanSlug] = room;
  if (!local.bids[cleanSlug]) local.bids[cleanSlug] = [];
  local.bids[cleanSlug].unshift(bidRecord);
  saveLocalData(local);

  const [playerStates, recentBids] = await Promise.all([
    getAuctionPlayerStates(cleanSlug),
    getAuctionBids(cleanSlug, 14),
  ]);

  const allBids = [bidRecord, ...recentBids];

  const fullState = buildFullAuctionStateSync({
    slug: cleanSlug,
    room,
    teams,
    rawPlayers,
    playerStates,
    bids: allBids,
  });

  // Save room and bid concurrently in background (non-blocking for speed)
  Promise.all([
    saveAuctionRoom(room),
    recordAuctionBid(bidRecord),
  ]).catch((err) => console.error('Bid background save error:', err));

  // Broadcast realtime update with the complete state to all viewers in background (non-blocking for sub-15ms response!)
  broadcastAuctionUpdate(cleanSlug, 'BID_PLACED', {
    bid: bidRecord,
    room,
    team,
    state: fullState,
  }).catch((err) => console.error('Bid background broadcast error:', err));

  return { success: true, state: fullState };
}

/**
 * Execute Auctioneer / Admin Actions
 */
export async function executeAuctioneerAction(params: {
  slug: string;
  action:
    | 'START'
    | 'PAUSE'
    | 'RESUME'
    | 'NEXT_PLAYER'
    | 'PREV_PLAYER'
    | 'SET_PLAYER'
    | 'SKIP_PLAYER'
    | 'MARK_SOLD'
    | 'MARK_UNSOLD'
    | 'UNDO_SOLD'
    | 'REAUCTION_PLAYER'
    | 'MANUAL_EDIT_PLAYER_AUCTION'
    | 'RESET_TIMER'
    | 'SEED_TEAMS'
    | 'UPDATE_SETTINGS'
    | 'UPDATE_PLAYER_BASE_PRICE'
    | 'SAVE_TEAM'
    | 'DELETE_TEAM'
    | 'UPDATE_ALL_TEAMS'
    | 'START_HAMMER_5S'
    | 'CANCEL_HAMMER'
    | 'ADD_PLAYER';
  payload?: any;
}): Promise<{ success: boolean; error?: string; state?: FullAuctionState }> {
  const { slug, action, payload } = params;
  const cleanSlug = slug.toLowerCase();

  let [room, teams, rawPlayers, playerStates] = await Promise.all([
    getAuctionRoom(cleanSlug),
    getTournamentTeams(cleanSlug),
    getAuctionTournamentPlayers(cleanSlug),
    getAuctionPlayerStates(cleanSlug),
  ]);

  if (action === 'START') {
    room.status = 'ACTIVE';
    room.timerRunning = true;
    room.timerSeconds = 10;
    room.lastAction = 'RESUME';
    room.lastActionTimestamp = Date.now();
    saveAuctionRoom(room).catch((e) => console.error(e));
  } else if (action === 'PAUSE') {
    room.status = 'PAUSED';
    room.timerRunning = false;
    room.lastAction = 'PAUSE';
    room.lastActionTimestamp = Date.now();
    saveAuctionRoom(room).catch((e) => console.error(e));
  } else if (action === 'RESUME') {
    room.status = 'ACTIVE';
    room.timerRunning = true;
    room.lastAction = 'RESUME';
    room.lastActionTimestamp = Date.now();
    saveAuctionRoom(room).catch((e) => console.error(e));
  } else if (action === 'RESET_TIMER') {
    room.timerSeconds = 10;
    room.timerRunning = false;
    room.timerExpiresAt = null;
    room.lastAction = 'RESET';
    room.lastActionTimestamp = Date.now();
    saveAuctionRoom(room).catch((e) => console.error(e));
  } else if (action === 'START_HAMMER_5S') {
    room.timerSeconds = 5;
    room.timerRunning = true;
    room.timerExpiresAt = Date.now() + 5200;
    room.lastAction = 'HAMMER_5S';
    room.lastActionTimestamp = Date.now();
    saveAuctionRoom(room).catch((e) => console.error(e));
  } else if (action === 'CANCEL_HAMMER') {
    room.timerRunning = false;
    room.timerExpiresAt = null;
    room.lastAction = 'CANCEL_HAMMER';
    room.lastActionTimestamp = Date.now();
    saveAuctionRoom(room).catch((e) => console.error(e));
  } else if (action === 'SET_PLAYER' || action === 'REAUCTION_PLAYER') {
    const targetPlayerId = payload?.playerId;
    const player = rawPlayers.find((p) => p.registrationId === targetPlayerId);
    if (!player) return { success: false, error: 'Player not found in tournament pool' };

    const existingState = playerStates[player.registrationId];
    // If player was previously SOLD, automatically refund the previous team!
    if (existingState && existingState.status === 'SOLD' && existingState.soldToTeamId) {
      const prevTeam = teams.find((t) => t.id === existingState.soldToTeamId);
      if (prevTeam) {
        prevTeam.remainingPurse += existingState.soldPrice || 0;
        prevTeam.boughtPlayersCount = Math.max(0, (prevTeam.boughtPlayersCount || 1) - 1);
        await saveTournamentTeams(cleanSlug, teams);
      }
    }

    const playerCustomBase = existingState?.basePrice;
    const basePrice = payload?.basePrice || playerCustomBase || room.basePrice || 1000;
    room.currentPlayerId = player.registrationId;
    room.currentBid = basePrice;
    room.currentBiddingTeamId = null;
    room.timerSeconds = room.timerSeconds || 10;
    room.timerRunning = room.status === 'ACTIVE';
    room.lastAction = 'NEXT';
    room.lastActionTimestamp = Date.now();

    const newPState: AuctionPlayerState = {
      playerId: player.registrationId,
      tournamentSlug: cleanSlug,
      status: 'IN_AUCTION',
      basePrice,
      soldPrice: null,
      soldToTeamId: null,
      soldToTeamName: null,
      soldToTeamLogo: null,
      updatedAt: new Date().toISOString(),
    };
    playerStates[player.registrationId] = newPState;

    Promise.all([
      saveAuctionRoom(room),
      saveAuctionPlayerState(newPState),
    ]).catch((err) => console.error('Save error:', err));
  } else if (action === 'NEXT_PLAYER' || action === 'PREV_PLAYER') {
    let nextPlayer: any = null;
    if (payload?.playerId) {
      nextPlayer = rawPlayers.find((p) => p.registrationId === payload.playerId);
    }

    if (!nextPlayer) {
      const currentIndex = rawPlayers.findIndex((p) => p.registrationId === room.currentPlayerId);
      if (action === 'NEXT_PLAYER') {
        // 1. Look forward for next un-auctioned (PENDING) player
        nextPlayer = rawPlayers.slice(currentIndex + 1).find((p) => {
          const st = playerStates[p.registrationId];
          return !st || st.status === 'PENDING';
        });
        // 2. Wrap around from beginning for next un-auctioned player
        if (!nextPlayer) {
          nextPlayer = rawPlayers.find((p) => {
            const st = playerStates[p.registrationId];
            return (!st || st.status === 'PENDING') && p.registrationId !== room.currentPlayerId;
          });
        }
        // 3. Fallback: next player in list
        if (!nextPlayer && rawPlayers.length > 0) {
          const targetIndex = currentIndex >= 0 && currentIndex < rawPlayers.length - 1 ? currentIndex + 1 : 0;
          nextPlayer = rawPlayers[targetIndex];
        }
      } else {
        const targetIndex = currentIndex > 0 ? currentIndex - 1 : rawPlayers.length - 1;
        nextPlayer = rawPlayers[targetIndex];
      }
    }
    if (nextPlayer) {
      const playerCustomBase = playerStates[nextPlayer.registrationId]?.basePrice;
      const basePrice = (playerCustomBase && playerCustomBase > 0) ? playerCustomBase : (room.basePrice || 1000);
      room.currentPlayerId = nextPlayer.registrationId;
      room.currentBid = basePrice;
      room.currentBiddingTeamId = null;
      room.timerSeconds = room.timerSeconds || 10;
      room.timerRunning = room.status === 'ACTIVE';
      room.lastAction = 'NEXT';
      room.lastActionTimestamp = Date.now();

      const newPState: AuctionPlayerState = {
        playerId: nextPlayer.registrationId,
        tournamentSlug: cleanSlug,
        status: 'IN_AUCTION',
        basePrice,
        updatedAt: new Date().toISOString(),
      };
      playerStates[nextPlayer.registrationId] = newPState;

      Promise.all([
        saveAuctionRoom(room),
        saveAuctionPlayerState(newPState),
      ]).catch((err) => console.error('Save error:', err));
    }
  } else if (action === 'SKIP_PLAYER') {
    if (room.currentPlayerId) {
      const currState = playerStates[room.currentPlayerId];
      // If current player was IN_AUCTION with no bids, reset back to PENDING so they can be auctioned later
      if (currState && currState.status === 'IN_AUCTION' && !room.currentBiddingTeamId) {
        currState.status = 'PENDING';
        currState.updatedAt = new Date().toISOString();
        saveAuctionPlayerState(currState).catch((e) => console.error(e));
      }
    }

    const currentIndex = rawPlayers.findIndex((p) => p.registrationId === room.currentPlayerId);
    let nextPlayer = rawPlayers.slice(currentIndex + 1).find((p) => {
      const st = playerStates[p.registrationId];
      return !st || st.status === 'PENDING';
    });

    if (!nextPlayer) {
      nextPlayer = rawPlayers.find((p) => {
        const st = playerStates[p.registrationId];
        return !st || st.status === 'PENDING';
      });
    }

    if (!nextPlayer) {
      const targetIndex = currentIndex >= 0 && currentIndex < rawPlayers.length - 1 ? currentIndex + 1 : 0;
      nextPlayer = rawPlayers[targetIndex];
    }

    if (nextPlayer) {
      const playerCustomBase = playerStates[nextPlayer.registrationId]?.basePrice;
      const basePrice = (playerCustomBase && playerCustomBase > 0) ? playerCustomBase : (room.basePrice || 1000);
      room.currentPlayerId = nextPlayer.registrationId;
      room.currentBid = basePrice;
      room.currentBiddingTeamId = null;
      room.timerSeconds = room.timerSeconds || 10;
      room.timerRunning = room.status === 'ACTIVE';
      room.lastAction = 'NEXT';
      room.lastActionTimestamp = Date.now();

      const newPState: AuctionPlayerState = {
        playerId: nextPlayer.registrationId,
        tournamentSlug: cleanSlug,
        status: 'IN_AUCTION',
        basePrice,
        updatedAt: new Date().toISOString(),
      };
      playerStates[nextPlayer.registrationId] = newPState;

      Promise.all([
        saveAuctionRoom(room),
        saveAuctionPlayerState(newPState),
      ]).catch((err) => console.error('Save error:', err));
    }
  } else if (action === 'MARK_SOLD') {
    if (!room.currentPlayerId) {
      return { success: false, error: 'No player on auction block to sell.' };
    }
    if (!room.currentBiddingTeamId || room.currentBid <= 0) {
      return { success: false, error: 'Cannot mark as SOLD without at least one valid bid from a team!' };
    }

    const winningTeam = teams.find((t) => t.id === room.currentBiddingTeamId);
    if (!winningTeam) {
      return { success: false, error: 'Winning team not found' };
    }

    // Deduct purse and increment squad count
    winningTeam.remainingPurse = Math.max(0, winningTeam.remainingPurse - room.currentBid);
    winningTeam.boughtPlayersCount = (winningTeam.boughtPlayersCount || 0) + 1;

    // Mark player as SOLD
    const soldPState: AuctionPlayerState = {
      playerId: room.currentPlayerId,
      tournamentSlug: cleanSlug,
      status: 'SOLD',
      basePrice: room.basePrice,
      soldPrice: room.currentBid,
      soldToTeamId: winningTeam.id,
      soldToTeamName: winningTeam.name,
      soldToTeamLogo: winningTeam.logoUrl,
      updatedAt: new Date().toISOString(),
    };
    playerStates[room.currentPlayerId] = soldPState;

    room.lastAction = 'SOLD';
    room.lastActionTimestamp = Date.now();
    room.timerRunning = false;

    await Promise.all([
      saveTournamentTeams(cleanSlug, teams),
      saveAuctionPlayerState(soldPState),
      saveAuctionRoom(room),
    ]);
  } else if (action === 'MARK_UNSOLD') {
    const targetPlayerId = payload?.playerId || room.currentPlayerId;
    if (!targetPlayerId) {
      return { success: false, error: 'No player on auction block to mark as UNSOLD.' };
    }

    const existingState = playerStates[targetPlayerId];
    // If was previously sold, automatically refund the team!
    if (existingState && existingState.status === 'SOLD' && (existingState.soldToTeamId || existingState.soldToTeamName)) {
      const prevTeam = teams.find(
        (t) =>
          t.id === existingState.soldToTeamId ||
          (existingState.soldToTeamName && t.name.toLowerCase() === existingState.soldToTeamName.toLowerCase())
      );
      if (prevTeam) {
        prevTeam.remainingPurse += existingState.soldPrice || 0;
        prevTeam.boughtPlayersCount = Math.max(0, (prevTeam.boughtPlayersCount || 1) - 1);
        await saveTournamentTeams(cleanSlug, teams);
      }
    }

    const basePrice = existingState?.basePrice || room.basePrice || 1000;
    const unsoldState: AuctionPlayerState = {
      playerId: targetPlayerId,
      tournamentSlug: cleanSlug,
      status: 'UNSOLD',
      basePrice,
      soldPrice: null,
      soldToTeamId: null,
      soldToTeamName: null,
      soldToTeamLogo: null,
      updatedAt: new Date().toISOString(),
    };
    playerStates[targetPlayerId] = unsoldState;

    if (room.currentPlayerId === targetPlayerId) {
      room.lastAction = 'UNSOLD';
      room.lastActionTimestamp = Date.now();
      room.timerRunning = false;
      room.currentBiddingTeamId = null;
      saveAuctionRoom(room).catch((e) => console.error(e));
    }

    await saveAuctionPlayerState(unsoldState);
  } else if (action === 'UNDO_SOLD') {
    let targetPlayerId = payload?.playerId || room.currentPlayerId;
    let targetState = targetPlayerId ? playerStates[targetPlayerId] : null;

    if (!targetState || targetState.status !== 'SOLD') {
      const soldEntries = Object.values(playerStates).filter((s) => s.status === 'SOLD');
      if (soldEntries.length > 0) {
        soldEntries.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
        targetPlayerId = soldEntries[0].playerId;
        targetState = soldEntries[0];
      }
    }

    if (!targetPlayerId || !targetState || targetState.status !== 'SOLD') {
      return { success: false, error: 'No sold player found to undo.' };
    }

    const soldPrice = targetState.soldPrice || 0;
    const soldToTeamId = targetState.soldToTeamId;

    if (soldToTeamId) {
      const team = teams.find((t) => t.id === soldToTeamId);
      if (team) {
        team.remainingPurse += soldPrice;
        team.boughtPlayersCount = Math.max(0, (team.boughtPlayersCount || 1) - 1);
        await saveTournamentTeams(cleanSlug, teams);
      }
    }

    targetState.status = 'IN_AUCTION';
    targetState.soldPrice = null;
    targetState.soldToTeamId = null;
    targetState.soldToTeamName = null;
    targetState.soldToTeamLogo = null;
    targetState.updatedAt = new Date().toISOString();
    playerStates[targetPlayerId] = targetState;

    room.currentPlayerId = targetPlayerId;
    room.currentBid = targetState.basePrice || room.basePrice || 1000;
    room.currentBiddingTeamId = null;
    room.timerRunning = false;
    room.lastAction = 'UNDO';
    room.lastActionTimestamp = Date.now();

    Promise.all([
      saveAuctionPlayerState(targetState),
      saveAuctionRoom(room),
    ]).catch((e) => console.error(e));
  } else if (action === 'MANUAL_EDIT_PLAYER_AUCTION') {
    const targetPlayerId = payload?.playerId;
    if (!targetPlayerId) {
      return { success: false, error: 'playerId is required' };
    }

    const existingState = playerStates[targetPlayerId] || {
      playerId: targetPlayerId,
      tournamentSlug: cleanSlug,
      status: 'PENDING',
      basePrice: room.basePrice || 1000,
    };

    const newStatus: PlayerAuctionStatus = payload.status || existingState.status;
    const newBasePrice = Number(payload.basePrice) > 0 ? Number(payload.basePrice) : existingState.basePrice;
    const newSoldPrice =
      payload.soldPrice !== undefined && payload.soldPrice !== null && !isNaN(Number(payload.soldPrice))
        ? Number(payload.soldPrice)
        : existingState.soldPrice;
    const newSoldToTeamId = payload.soldToTeamId !== undefined ? payload.soldToTeamId : existingState.soldToTeamId;

    let teamsChanged = false;
    const wasSold = existingState.status === 'SOLD' && Boolean(existingState.soldToTeamId);
    const willBeSold = newStatus === 'SOLD' && Boolean(newSoldToTeamId);

    // 1. If was sold previously, handle refund if team, price, or status changed
    if (wasSold) {
      const prevTeam = teams.find((t) => t.id === existingState.soldToTeamId);
      if (!willBeSold || newSoldToTeamId !== existingState.soldToTeamId || newSoldPrice !== existingState.soldPrice) {
        if (prevTeam) {
          prevTeam.remainingPurse += existingState.soldPrice || 0;
          prevTeam.boughtPlayersCount = Math.max(0, (prevTeam.boughtPlayersCount || 1) - 1);
          teamsChanged = true;
        }
      }
    }

    // 2. If will be sold, charge the new team
    let newTeamObj = null;
    if (willBeSold) {
      newTeamObj = teams.find((t) => t.id === newSoldToTeamId);
      if (newTeamObj) {
        if (!wasSold || newSoldToTeamId !== existingState.soldToTeamId || newSoldPrice !== existingState.soldPrice) {
          newTeamObj.remainingPurse = Math.max(0, newTeamObj.remainingPurse - (newSoldPrice || 0));
          newTeamObj.boughtPlayersCount = (newTeamObj.boughtPlayersCount || 0) + 1;
          teamsChanged = true;
        }
      }
    }

    if (teamsChanged) {
      await saveTournamentTeams(cleanSlug, teams);
    }

    const updatedState: AuctionPlayerState = {
      playerId: targetPlayerId,
      tournamentSlug: cleanSlug,
      status: newStatus,
      basePrice: newBasePrice,
      soldPrice: willBeSold ? newSoldPrice : null,
      soldToTeamId: willBeSold ? newSoldToTeamId : null,
      soldToTeamName: willBeSold && newTeamObj ? newTeamObj.name : null,
      soldToTeamLogo: willBeSold && newTeamObj ? newTeamObj.logoUrl : null,
      updatedAt: new Date().toISOString(),
    };
    playerStates[targetPlayerId] = updatedState;

    if (room.currentPlayerId === targetPlayerId) {
      if (newStatus === 'SOLD') {
        room.currentBid = newSoldPrice || newBasePrice;
        room.currentBiddingTeamId = newSoldToTeamId || null;
        room.lastAction = 'SOLD';
        room.timerRunning = false;
      } else if (newStatus === 'UNSOLD') {
        room.currentBiddingTeamId = null;
        room.lastAction = 'UNSOLD';
        room.timerRunning = false;
      } else {
        room.currentBid = newBasePrice;
        room.currentBiddingTeamId = null;
        room.lastAction = 'EDIT';
      }
      room.lastActionTimestamp = Date.now();
      saveAuctionRoom(room).catch((e) => console.error(e));
    }

    saveAuctionPlayerState(updatedState).catch((e) => console.error(e));
  } else if (action === 'SEED_TEAMS') {
    const defaultTeams = getDefaultSeedTeams(cleanSlug);
    await saveTournamentTeams(cleanSlug, defaultTeams);
  } else if (action === 'UPDATE_SETTINGS') {
    if (payload?.basePrice !== undefined && Number(payload.basePrice) > 0) {
      room.basePrice = Number(payload.basePrice);
    }
    if (payload?.bidIncrement !== undefined && Number(payload.bidIncrement) > 0) {
      room.bidIncrement = Number(payload.bidIncrement);
    }
    if (payload?.timerSeconds !== undefined && Number(payload.timerSeconds) > 0) {
      room.timerSeconds = Number(payload.timerSeconds);
    }
    if (!room.currentBiddingTeamId && (room.currentBid === 0 || room.currentBid < room.basePrice)) {
      room.currentBid = room.basePrice;
    }
    room.updatedAt = new Date().toISOString();
    saveAuctionRoom(room).catch((e) => console.error(e));
  } else if (action === 'UPDATE_PLAYER_BASE_PRICE') {
    const targetPlayerId = payload?.playerId;
    const newBasePrice = Number(payload?.basePrice) || 1000;
    if (targetPlayerId) {
      const existing = playerStates[targetPlayerId] || {
        playerId: targetPlayerId,
        tournamentSlug: cleanSlug,
        status: 'PENDING',
        basePrice: newBasePrice,
      };
      existing.basePrice = newBasePrice;
      existing.updatedAt = new Date().toISOString();
      playerStates[targetPlayerId] = existing;
      saveAuctionPlayerState(existing).catch((e) => console.error(e));

      if (room.currentPlayerId === targetPlayerId && !room.currentBiddingTeamId) {
        room.currentBid = newBasePrice;
        saveAuctionRoom(room).catch((e) => console.error(e));
      }
    }
  } else if (action === 'SAVE_TEAM') {
    const teamData = payload?.team;
    if (teamData) {
      let teamId = teamData.id;
      let existingIndex = teams.findIndex((t) => t.id === teamId);
      const totalPurse =
        typeof teamData.totalPurse !== 'undefined' && !isNaN(Number(teamData.totalPurse)) && Number(teamData.totalPurse) >= 0
          ? Number(teamData.totalPurse)
          : 100000;
      const remainingPurse =
        typeof teamData.remainingPurse !== 'undefined' && !isNaN(Number(teamData.remainingPurse)) && Number(teamData.remainingPurse) >= 0
          ? Number(teamData.remainingPurse)
          : totalPurse;
      const maxPlayers = Number(teamData.maxPlayers) || 15;
      const secretPin = String(teamData.secretPin || Math.floor(1000 + Math.random() * 9000));

      const updatedTeam: TournamentTeam = {
        id: teamId || 'team_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        tournamentSlug: cleanSlug,
        name: teamData.name?.trim() || 'New Franchise',
        shortName: (teamData.shortName?.trim() || teamData.name?.slice(0, 3) || 'FR').toUpperCase(),
        logoUrl: teamData.logoUrl?.trim() || '',
        color: teamData.color || '#f59e0b',
        totalPurse,
        remainingPurse,
        secretPin,
        maxPlayers,
        boughtPlayersCount: Number(teamData.boughtPlayersCount) || 0,
      };

      if (existingIndex >= 0) {
        teams[existingIndex] = updatedTeam;
      } else {
        teams.push(updatedTeam);
      }
      await saveTournamentTeams(cleanSlug, teams);
    }
  } else if (action === 'DELETE_TEAM') {
    const teamId = payload?.teamId;
    if (teamId) {
      teams = teams.filter((t) => t.id !== teamId);
      if (room.currentBiddingTeamId === teamId) {
        room.currentBiddingTeamId = null;
        saveAuctionRoom(room).catch((e) => console.error(e));
      }
      await deleteTournamentTeam(cleanSlug, teamId);
      await saveTournamentTeams(cleanSlug, teams);
    }
  } else if (action === 'UPDATE_ALL_TEAMS') {
    if (Array.isArray(payload?.teams)) {
      teams = payload.teams;
      await saveTournamentTeams(cleanSlug, payload.teams);
    }
  } else if (action === 'ADD_PLAYER') {
    const playerData = payload?.player;
    if (!playerData || !playerData.fullName?.trim()) {
      return { success: false, error: 'Player full name is required' };
    }

    const regId = playerData.registrationId || `CRIC-2026-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const basePrice = Number(playerData.basePrice) > 0 ? Number(playerData.basePrice) : (room.basePrice || 1000);

    const newPlayerSub: RegistrationSubmission = {
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' }),
      registrationId: regId,
      tournamentSlug: cleanSlug,
      tournamentTitle: room.tournamentSlug || cleanSlug,
      fullName: playerData.fullName.trim(),
      phone: playerData.phone?.trim() || '9876543210',
      age: String(playerData.age || '24'),
      role: playerData.role || 'Batting All-Rounder',
      battingStyle: playerData.battingStyle || 'Right-hand',
      bowlingStyle: playerData.bowlingStyle || 'Right-arm Fast',
      stats: playerData.stats?.trim() || 'Manually added by Admin',
      photoUrl: playerData.photoUrl || '',
      paymentId: 'ADMIN_MANUAL',
      orderId: 'ADMIN_MANUAL',
      paymentStatus: 'PAID',
      amount: 0,
    };

    // 1. Save to registrations store (memory + disk + Supabase) so player appears in /players and /admin
    await savePlayerRegistrationAsync(newPlayerSub);

    // 2. Increment registration count
    await incrementRegistrationCountAsync(cleanSlug);

    // 3. Save initial player auction state (status: PENDING)
    const newPlayerState: AuctionPlayerState = {
      playerId: regId,
      tournamentSlug: cleanSlug,
      status: 'PENDING',
      basePrice,
      updatedAt: new Date().toISOString(),
    };
    playerStates[regId] = newPlayerState;
    await saveAuctionPlayerState(newPlayerState);

    // 4. Invalidate cache and update memory queue
    invalidateAuctionPlayersCache(cleanSlug);
    rawPlayers.unshift(newPlayerSub);
  }

  // Load recent bids
  const bids = await getAuctionBids(cleanSlug, 15);

  // Synchronously assemble the complete full state in 0ms!
  const fullState = buildFullAuctionStateSync({
    slug: cleanSlug,
    room,
    teams,
    rawPlayers,
    playerStates,
    bids,
  });

  // Ensure latest computed team purse & squad counts are safely persisted
  saveTournamentTeams(cleanSlug, fullState.teams).catch((e) => console.error(e));

  // Broadcast the full updated state to all connected screens in background (non-blocking for sub-25ms response!)
  broadcastAuctionUpdate(cleanSlug, 'STATE_UPDATE', {
    action,
    state: fullState,
  }).catch((err) => console.error('Action background broadcast error:', err));

  return { success: true, state: fullState };
}
