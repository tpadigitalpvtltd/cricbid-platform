import fs from 'fs';
import path from 'path';
import os from 'os';
import { supabase } from './supabase';
import {
  TournamentTeam,
  AuctionRoom,
  AuctionBid,
  AuctionPlayerState,
  FullAuctionState,
  SoldRecord,
  AuctionRoomStatus,
} from './auctionTypes';
import { getPlayersByTournamentAsync, getTournamentBySlugAsync } from './tournamentStore';
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
    const channel = supabase.channel(`auction_${slug.toLowerCase()}`);
    await channel.send({
      type: 'broadcast',
      event: event,
      payload: {
        ...payload,
        timestamp: Date.now(),
      },
    });
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Retrieve or initialize the Auction Room for a tournament
 */
export async function getAuctionRoom(slug: string): Promise<AuctionRoom> {
  const cleanSlug = slug.toLowerCase();

  // 1. Try Supabase
  try {
    const { data, error } = await supabase
      .from('auction_rooms')
      .select('*')
      .ilike('tournament_slug', cleanSlug)
      .limit(1)
      .single();

    if (!error && data) {
      return {
        id: data.id,
        tournamentId: data.tournament_id,
        tournamentSlug: data.tournament_slug,
        status: data.status as AuctionRoomStatus,
        currentPlayerId: data.current_player_id,
        currentBid: Number(data.current_bid) || 0,
        currentBiddingTeamId: data.current_bidding_team_id,
        timerSeconds: Number(data.timer_seconds) || 10,
        timerRunning: Boolean(data.timer_running),
        timerExpiresAt: data.timer_expires_at ? Number(data.timer_expires_at) : null,
        basePrice: Number(data.base_price) || 1000,
        bidIncrement: Number(data.bid_increment) || 500,
        lastAction: data.last_action,
        lastActionTimestamp: data.last_action_timestamp ? Number(data.last_action_timestamp) : Date.now(),
        updatedAt: data.updated_at || new Date().toISOString(),
      };
    }
  } catch (err) {}

  // 2. Try Local Store
  const local = readLocalData();
  if (local.rooms[cleanSlug]) {
    return local.rooms[cleanSlug];
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

  // 1. Try Supabase
  try {
    const { data, error } = await supabase
      .from('tournament_teams')
      .select('*')
      .ilike('tournament_slug', cleanSlug)
      .order('created_at', { ascending: true });

    if (!error && Array.isArray(data)) {
      if (data.length > 0) {
        return data.map((t) => ({
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
      }

      // If database returned 0 rows, check if tournament was already initialized.
      // If initialized, respect that the admin intentionally cleared all teams!
      const local = readLocalData();
      if (local.teamsInitialized?.[cleanSlug]) {
        return local.teams[cleanSlug] || [];
      }
    }
  } catch (err) {}

  // 2. Try Local Store
  const local = readLocalData();
  if (local.teamsInitialized?.[cleanSlug]) {
    return local.teams[cleanSlug] || [];
  }
  if (local.teams[cleanSlug] && local.teams[cleanSlug].length > 0) {
    return local.teams[cleanSlug];
  }

  // 3. Seed Default Teams ONLY on initial room setup
  const defaultTeams = getDefaultSeedTeams(cleanSlug);
  local.teams[cleanSlug] = defaultTeams;
  if (!local.teamsInitialized) local.teamsInitialized = {};
  local.teamsInitialized[cleanSlug] = true;
  saveLocalData(local);

  // Sync to Supabase in background
  try {
    for (const t of defaultTeams) {
      await supabase.from('tournament_teams').upsert({
        id: t.id,
        tournament_slug: t.tournamentSlug,
        name: t.name,
        short_name: t.shortName,
        logo_url: t.logoUrl,
        color: t.color,
        total_purse: t.totalPurse,
        remaining_purse: t.remainingPurse,
        secret_pin: t.secretPin,
        max_players: t.maxPlayers,
        bought_players_count: t.boughtPlayersCount,
      });
    }
  } catch (e) {}

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
  } catch (e) {}
}

export async function saveTournamentTeams(slug: string, teams: TournamentTeam[]): Promise<void> {
  const cleanSlug = slug.toLowerCase();
  const local = readLocalData();
  if (!local.teamsInitialized) local.teamsInitialized = {};
  local.teamsInitialized[cleanSlug] = true;
  local.teams[cleanSlug] = teams;
  saveLocalData(local);

  try {
    for (const t of teams) {
      await supabase.from('tournament_teams').upsert({
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
      });
    }
  } catch (e) {}
}

/**
 * Get Recent Auction Bids
 */
export async function getAuctionBids(slug: string, limit = 20): Promise<AuctionBid[]> {
  const cleanSlug = slug.toLowerCase();

  try {
    const { data, error } = await supabase
      .from('auction_bids')
      .select('*')
      .ilike('tournament_slug', cleanSlug)
      .order('created_at', { ascending: false })
      .limit(limit);

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
    const { data, error } = await supabase
      .from('auction_players')
      .select('*')
      .ilike('tournament_slug', cleanSlug);

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
 * Retrieve the full consolidated state for the auction engine
 */
export async function getFullAuctionState(slug: string): Promise<FullAuctionState | null> {
  const cleanSlug = slug.toLowerCase();
  const tournament = await getTournamentBySlugAsync(cleanSlug);
  if (!tournament) return null;

  const [room, teams, rawPlayers, playerStates, bids] = await Promise.all([
    getAuctionRoom(cleanSlug),
    getTournamentTeams(cleanSlug),
    getPlayersByTournamentAsync(cleanSlug),
    getAuctionPlayerStates(cleanSlug),
    getAuctionBids(cleanSlug, 15),
  ]);

  // Current bidding team
  const currentBiddingTeam = teams.find((t) => t.id === room.currentBiddingTeamId) || null;

  // Build complete player queue
  const playersQueue = rawPlayers.map((player) => {
    const pState = playerStates[player.registrationId] || {
      playerId: player.registrationId,
      tournamentSlug: cleanSlug,
      status: 'PENDING',
      basePrice: room.basePrice || 1000,
    };
    return {
      player,
      status: pState.status,
      basePrice: pState.basePrice,
      soldPrice: pState.soldPrice,
      soldTeamName: pState.soldToTeamName,
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

  // Sold history
  const soldHistory: SoldRecord[] = [];
  rawPlayers.forEach((p) => {
    const st = playerStates[p.registrationId];
    if (st && st.status === 'SOLD' && st.soldToTeamId) {
      const team = teams.find((t) => t.id === st.soldToTeamId);
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
    getPlayersByTournamentAsync(cleanSlug),
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
  room.timerSeconds = 10; // Reset 10s countdown on new bid
  room.timerRunning = true;
  room.lastAction = 'NEW_BID';
  room.lastActionTimestamp = Date.now();

  await saveAuctionRoom(room);

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

  await recordAuctionBid(bidRecord);

  // Broadcast realtime update
  await broadcastAuctionUpdate(cleanSlug, 'BID_PLACED', {
    bid: bidRecord,
    room,
    team,
  });

  const fullState = await getFullAuctionState(cleanSlug);
  return { success: true, state: fullState || undefined };
}

/**
 * Execute Auctioneer / Admin Actions
 */
export async function executeAuctioneerAction(params: {
  slug: string;
  action: 'START' | 'PAUSE' | 'RESUME' | 'NEXT_PLAYER' | 'PREV_PLAYER' | 'SET_PLAYER' | 'MARK_SOLD' | 'MARK_UNSOLD' | 'RESET_TIMER' | 'SEED_TEAMS' | 'UPDATE_SETTINGS' | 'UPDATE_PLAYER_BASE_PRICE' | 'SAVE_TEAM' | 'DELETE_TEAM' | 'UPDATE_ALL_TEAMS';
  payload?: any;
}): Promise<{ success: boolean; error?: string; state?: FullAuctionState }> {
  const { slug, action, payload } = params;
  const cleanSlug = slug.toLowerCase();

  const [room, teams, rawPlayers, playerStates] = await Promise.all([
    getAuctionRoom(cleanSlug),
    getTournamentTeams(cleanSlug),
    getPlayersByTournamentAsync(cleanSlug),
    getAuctionPlayerStates(cleanSlug),
  ]);

  if (action === 'START') {
    room.status = 'ACTIVE';
    room.timerRunning = true;
    room.timerSeconds = 10;
    room.lastAction = 'RESUME';
    room.lastActionTimestamp = Date.now();
    await saveAuctionRoom(room);
    await broadcastAuctionUpdate(cleanSlug, 'AUCTION_STARTED', { room });
  } else if (action === 'PAUSE') {
    room.status = 'PAUSED';
    room.timerRunning = false;
    room.lastAction = 'PAUSE';
    room.lastActionTimestamp = Date.now();
    await saveAuctionRoom(room);
    await broadcastAuctionUpdate(cleanSlug, 'AUCTION_PAUSED', { room });
  } else if (action === 'RESUME') {
    room.status = 'ACTIVE';
    room.timerRunning = true;
    room.lastAction = 'RESUME';
    room.lastActionTimestamp = Date.now();
    await saveAuctionRoom(room);
    await broadcastAuctionUpdate(cleanSlug, 'AUCTION_RESUMED', { room });
  } else if (action === 'RESET_TIMER') {
    room.timerSeconds = 10;
    room.timerRunning = true;
    room.lastAction = 'RESET';
    room.lastActionTimestamp = Date.now();
    await saveAuctionRoom(room);
    await broadcastAuctionUpdate(cleanSlug, 'TIMER_RESET', { room });
  } else if (action === 'SET_PLAYER') {
    const targetPlayerId = payload?.playerId;
    const player = rawPlayers.find((p) => p.registrationId === targetPlayerId);
    if (!player) return { success: false, error: 'Player not found in tournament pool' };

    const playerCustomBase = playerStates[player.registrationId]?.basePrice;
    const basePrice = payload?.basePrice || playerCustomBase || room.basePrice || 1000;
    room.currentPlayerId = player.registrationId;
    room.currentBid = basePrice;
    room.currentBiddingTeamId = null;
    room.timerSeconds = room.timerSeconds || 10;
    room.timerRunning = room.status === 'ACTIVE';
    room.lastAction = 'NEXT';
    room.lastActionTimestamp = Date.now();

    await saveAuctionRoom(room);
    await saveAuctionPlayerState({
      playerId: player.registrationId,
      tournamentSlug: cleanSlug,
      status: 'IN_AUCTION',
      basePrice,
    });

    await broadcastAuctionUpdate(cleanSlug, 'PLAYER_CHANGED', { room, player });
  } else if (action === 'NEXT_PLAYER' || action === 'PREV_PLAYER') {
    const currentIndex = rawPlayers.findIndex((p) => p.registrationId === room.currentPlayerId);
    let targetIndex = 0;
    if (action === 'NEXT_PLAYER') {
      targetIndex = currentIndex >= 0 && currentIndex < rawPlayers.length - 1 ? currentIndex + 1 : 0;
    } else {
      targetIndex = currentIndex > 0 ? currentIndex - 1 : rawPlayers.length - 1;
    }

    const nextPlayer = rawPlayers[targetIndex];
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

      await saveAuctionRoom(room);
      await saveAuctionPlayerState({
        playerId: nextPlayer.registrationId,
        tournamentSlug: cleanSlug,
        status: 'IN_AUCTION',
        basePrice,
      });

      await broadcastAuctionUpdate(cleanSlug, 'PLAYER_CHANGED', { room, player: nextPlayer });
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
    await saveTournamentTeams(cleanSlug, teams);

    // Mark player as SOLD
    await saveAuctionPlayerState({
      playerId: room.currentPlayerId,
      tournamentSlug: cleanSlug,
      status: 'SOLD',
      basePrice: room.basePrice,
      soldPrice: room.currentBid,
      soldToTeamId: winningTeam.id,
      soldToTeamName: winningTeam.name,
      soldToTeamLogo: winningTeam.logoUrl,
    });

    room.lastAction = 'SOLD';
    room.lastActionTimestamp = Date.now();
    room.timerRunning = false;
    await saveAuctionRoom(room);

    await broadcastAuctionUpdate(cleanSlug, 'PLAYER_SOLD', {
      room,
      winningTeam,
      soldPrice: room.currentBid,
      playerId: room.currentPlayerId,
    });
  } else if (action === 'MARK_UNSOLD') {
    if (!room.currentPlayerId) {
      return { success: false, error: 'No player on auction block to mark as UNSOLD.' };
    }

    await saveAuctionPlayerState({
      playerId: room.currentPlayerId,
      tournamentSlug: cleanSlug,
      status: 'UNSOLD',
      basePrice: room.basePrice,
    });

    room.lastAction = 'UNSOLD';
    room.lastActionTimestamp = Date.now();
    room.timerRunning = false;
    room.currentBiddingTeamId = null;
    await saveAuctionRoom(room);

    await broadcastAuctionUpdate(cleanSlug, 'PLAYER_UNSOLD', {
      room,
      playerId: room.currentPlayerId,
    });
  } else if (action === 'SEED_TEAMS') {
    const defaultTeams = getDefaultSeedTeams(cleanSlug);
    await saveTournamentTeams(cleanSlug, defaultTeams);
    await broadcastAuctionUpdate(cleanSlug, 'TEAMS_UPDATED', { teams: defaultTeams });
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
    await saveAuctionRoom(room);
    await broadcastAuctionUpdate(cleanSlug, 'SETTINGS_UPDATED', { room });
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
      await saveAuctionPlayerState(existing);

      if (room.currentPlayerId === targetPlayerId && !room.currentBiddingTeamId) {
        room.currentBid = newBasePrice;
        await saveAuctionRoom(room);
      }
      await broadcastAuctionUpdate(cleanSlug, 'PLAYER_UPDATED', { playerId: targetPlayerId, basePrice: newBasePrice });
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
      await broadcastAuctionUpdate(cleanSlug, 'TEAMS_UPDATED', { teams });
    }
  } else if (action === 'DELETE_TEAM') {
    const teamId = payload?.teamId;
    if (teamId) {
      const filtered = teams.filter((t) => t.id !== teamId);
      if (room.currentBiddingTeamId === teamId) {
        room.currentBiddingTeamId = null;
        await saveAuctionRoom(room);
      }
      await saveTournamentTeams(cleanSlug, filtered);
      await deleteTournamentTeam(cleanSlug, teamId);
      await broadcastAuctionUpdate(cleanSlug, 'TEAMS_UPDATED', { teams: filtered });
    }
  } else if (action === 'UPDATE_ALL_TEAMS') {
    if (Array.isArray(payload?.teams)) {
      await saveTournamentTeams(cleanSlug, payload.teams);
      await broadcastAuctionUpdate(cleanSlug, 'TEAMS_UPDATED', { teams: payload.teams });
    }
  }

  const fullState = await getFullAuctionState(cleanSlug);
  return { success: true, state: fullState || undefined };
}
