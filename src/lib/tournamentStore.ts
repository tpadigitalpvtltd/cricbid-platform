import fs from 'fs';
import path from 'path';
import os from 'os';
import { Tournament, RegistrationSubmission } from './types';
import { supabase } from './supabase';

export const MASTER_GOOGLE_SHEET_URL =
  process.env.GOOGLE_SHEET_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzLUMKCXZlwJH972TR45nfiXOYwEfIZoMsEHQWsSftcg0JSKHZRXegh_0iUgXMnpzDG7A/exec';

// Serverless environment detection (Vercel / AWS Lambda)
const isServerless = Boolean(
  process.env.VERCEL ||
  process.env.AWS_LAMBDA_FUNCTION_NAME ||
  process.env.NODE_ENV === 'production'
);

// Use os.tmpdir() for writable storage in serverless environments to prevent EROFS errors
const STORAGE_DIR = isServerless
  ? path.join(os.tmpdir(), 'cricbid-data')
  : path.join(process.cwd(), 'data');

const TOURNAMENTS_FILE = path.join(STORAGE_DIR, 'tournaments.json');
const PLAYERS_FILE = path.join(STORAGE_DIR, 'players.json');

const SEED_DIR = path.join(process.cwd(), 'data');
const SEED_TOURNAMENTS_FILE = path.join(SEED_DIR, 'tournaments.json');
const SEED_PLAYERS_FILE = path.join(SEED_DIR, 'players.json');

// In-memory global cache across lambda warm invocations
declare global {
  var __CRICBID_TOURNAMENTS__: Tournament[] | undefined;
  var __CRICBID_PLAYERS__: RegistrationSubmission[] | undefined;
  var __CRICBID_LAST_SYNC__: number | undefined;
}

if (!globalThis.__CRICBID_TOURNAMENTS__) {
  globalThis.__CRICBID_TOURNAMENTS__ = [];
}
if (!globalThis.__CRICBID_PLAYERS__) {
  globalThis.__CRICBID_PLAYERS__ = [];
}

/**
 * Safely execute a PromiseLike in the background without unhandled rejections
 */
function fireAndForget(promiseLike: PromiseLike<any>): void {
  Promise.resolve(promiseLike).catch((err: any) => {
    console.warn('Background Supabase sync notice:', err?.message || err);
  });
}

/**
 * Ensure writable data directory exists without crashing
 */
function ensureStorageDir(): void {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  } catch (err) {}
}

/**
 * Map database tournament record to TypeScript model
 */
function mapDbTournamentToModel(row: any): Tournament {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline || undefined,
    city: row.city,
    venue: row.venue,
    bannerUrl: row.banner_url || '',
    registrationDeadline: row.registration_deadline || '',
    auctionDate: row.auction_date || '',
    isPaid: Boolean(row.is_paid),
    entryFee: Number(row.entry_fee) || 0,
    googleSheetUrl: row.google_sheet_url || '',
    organizerName: row.organizer_name || 'Tournament Host',
    organizerContact: row.organizer_contact || '',
    registeredCount: Number(row.registered_count) || 0,
    createdAt: row.created_at || new Date().toISOString(),
  };
}

/**
 * Map database player record to TypeScript model
 */
function mapDbPlayerToModel(row: any): RegistrationSubmission {
  return {
    registrationId: row.registration_id,
    tournamentSlug: row.tournament_slug,
    tournamentTitle: row.tournament_title || '',
    fullName: row.full_name,
    phone: row.phone,
    age: String(row.age || '20'),
    role: row.role,
    battingStyle: row.batting_style,
    bowlingStyle: row.bowling_style,
    stats: row.stats || '',
    photoUrl: row.photo_url || '',
    paymentId: row.payment_id || '',
    orderId: row.order_id || '',
    paymentStatus: row.payment_status || 'FREE',
    amount: Number(row.amount) || 0,
    timestamp: row.timestamp || new Date().toISOString(),
  };
}

/**
 * Read tournaments with fallback order: Memory -> Writable Temp Disk -> Seed Disk
 */
function readTournamentsFromFile(): Tournament[] {
  if (globalThis.__CRICBID_TOURNAMENTS__ && globalThis.__CRICBID_TOURNAMENTS__.length > 0) {
    return globalThis.__CRICBID_TOURNAMENTS__;
  }

  try {
    if (fs.existsSync(TOURNAMENTS_FILE)) {
      const raw = fs.readFileSync(TOURNAMENTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        globalThis.__CRICBID_TOURNAMENTS__ = parsed;
        return parsed;
      }
    }
  } catch (err) {}

  try {
    if (fs.existsSync(SEED_TOURNAMENTS_FILE)) {
      const raw = fs.readFileSync(SEED_TOURNAMENTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        globalThis.__CRICBID_TOURNAMENTS__ = parsed;
        saveTournamentsToFile(parsed);
        return parsed;
      }
    }
  } catch (err) {}

  return globalThis.__CRICBID_TOURNAMENTS__ || [];
}

/**
 * Save tournaments to memory cache and writable disk safely
 */
function saveTournamentsToFile(tournaments: Tournament[]): void {
  globalThis.__CRICBID_TOURNAMENTS__ = tournaments;
  try {
    ensureStorageDir();
    fs.writeFileSync(TOURNAMENTS_FILE, JSON.stringify(tournaments, null, 2), 'utf-8');
  } catch (err) {}
}

/**
 * Read players with fallback order: Memory -> Writable Temp Disk -> Seed Disk
 */
function readPlayersFromFile(): RegistrationSubmission[] {
  if (globalThis.__CRICBID_PLAYERS__ && globalThis.__CRICBID_PLAYERS__.length > 0) {
    return globalThis.__CRICBID_PLAYERS__;
  }

  try {
    if (fs.existsSync(PLAYERS_FILE)) {
      const raw = fs.readFileSync(PLAYERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        globalThis.__CRICBID_PLAYERS__ = parsed;
        return parsed;
      }
    }
  } catch (err) {}

  try {
    if (fs.existsSync(SEED_PLAYERS_FILE)) {
      const raw = fs.readFileSync(SEED_PLAYERS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        globalThis.__CRICBID_PLAYERS__ = parsed;
        return parsed;
      }
    }
  } catch (err) {}

  return globalThis.__CRICBID_PLAYERS__ || [];
}

/**
 * Save players to memory cache and writable disk safely
 */
function savePlayersToFile(players: RegistrationSubmission[]): void {
  globalThis.__CRICBID_PLAYERS__ = players;
  try {
    ensureStorageDir();
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2), 'utf-8');
  } catch (err) {}
}

// =============================================================================
// PUBLIC TOURNAMENT APIS (Supabase Cloud + Local Fallback)
// =============================================================================

export function getAllTournaments(): Tournament[] {
  return readTournamentsFromFile();
}

export async function getAllTournamentsAsync(): Promise<Tournament[]> {
  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const mapped = data.map(mapDbTournamentToModel);
      saveTournamentsToFile(mapped);
      return mapped;
    }
  } catch (err) {
    console.warn('Supabase tournaments fetch notice:', err);
  }

  return readTournamentsFromFile();
}

export function getTournamentBySlug(slug: string): Tournament | null {
  const tournaments = readTournamentsFromFile();
  return tournaments.find((t) => t.slug.toLowerCase() === slug.toLowerCase()) || null;
}

export async function getTournamentBySlugAsync(slug: string): Promise<Tournament | null> {
  try {
    const { data, error } = await supabase
      .from('tournaments')
      .select('*')
      .ilike('slug', slug)
      .maybeSingle();

    if (!error) {
      if (data) {
        return mapDbTournamentToModel(data);
      }
      return null;
    }
  } catch (err) {
    console.warn('Supabase getTournamentBySlug notice:', err);
  }

  const all = readTournamentsFromFile();
  return all.find((t) => t.slug.toLowerCase() === slug.toLowerCase()) || null;
}

export function getTournamentById(id: string): Tournament | null {
  const tournaments = readTournamentsFromFile();
  return tournaments.find((t) => t.id === id) || null;
}

export function createTournament(
  input: Omit<Tournament, 'id' | 'slug' | 'registeredCount' | 'createdAt'> & { slug?: string }
): Tournament {
  const tournaments = readTournamentsFromFile();

  const generatedSlug =
    input.slug ||
    input.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') + `-${Date.now().toString(36).substring(2, 6)}`;

  const newTournament: Tournament = {
    ...input,
    id: `tourn_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    slug: generatedSlug,
    registeredCount: 0,
    createdAt: new Date().toISOString(),
  };

  const updated = [newTournament, ...tournaments.filter((t) => t.slug !== newTournament.slug)];
  saveTournamentsToFile(updated);

  // Async insert into Supabase
  fireAndForget(
    supabase
      .from('tournaments')
      .insert({
        id: newTournament.id,
        slug: newTournament.slug,
        title: newTournament.title,
        tagline: newTournament.tagline || '',
        city: newTournament.city,
        venue: newTournament.venue,
        banner_url: newTournament.bannerUrl,
        registration_deadline: newTournament.registrationDeadline,
        auction_date: newTournament.auctionDate,
        is_paid: newTournament.isPaid,
        entry_fee: newTournament.entryFee,
        google_sheet_url: newTournament.googleSheetUrl || '',
        organizer_name: newTournament.organizerName,
        organizer_contact: newTournament.organizerContact,
        registered_count: 0,
      })
  );

  return newTournament;
}

export async function createTournamentAsync(
  input: Omit<Tournament, 'id' | 'slug' | 'registeredCount' | 'createdAt'> & { slug?: string }
): Promise<Tournament> {
  const tournament = createTournament(input);
  try {
    await supabase.from('tournaments').upsert({
      id: tournament.id,
      slug: tournament.slug,
      title: tournament.title,
      tagline: tournament.tagline || '',
      city: tournament.city,
      venue: tournament.venue,
      banner_url: tournament.bannerUrl,
      registration_deadline: tournament.registrationDeadline,
      auction_date: tournament.auctionDate,
      is_paid: tournament.isPaid,
      entry_fee: tournament.entryFee,
      google_sheet_url: tournament.googleSheetUrl || '',
      organizer_name: tournament.organizerName,
      organizer_contact: tournament.organizerContact,
      registered_count: 0,
    });
  } catch (err) {}
  return tournament;
}

export function updateTournament(idOrSlug: string, updates: Partial<Tournament>): Tournament | null {
  const tournaments = readTournamentsFromFile();
  const index = tournaments.findIndex(
    (t) => t.id === idOrSlug || t.slug.toLowerCase() === idOrSlug.toLowerCase()
  );

  if (index === -1) return null;

  tournaments[index] = {
    ...tournaments[index],
    ...updates,
  };

  saveTournamentsToFile([...tournaments]);

  // Update in Supabase
  const dbUpdates: any = {};
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.tagline !== undefined) dbUpdates.tagline = updates.tagline;
  if (updates.city !== undefined) dbUpdates.city = updates.city;
  if (updates.venue !== undefined) dbUpdates.venue = updates.venue;
  if (updates.bannerUrl !== undefined) dbUpdates.banner_url = updates.bannerUrl;
  if (updates.registrationDeadline !== undefined) dbUpdates.registration_deadline = updates.registrationDeadline;
  if (updates.auctionDate !== undefined) dbUpdates.auction_date = updates.auctionDate;
  if (updates.isPaid !== undefined) dbUpdates.is_paid = updates.isPaid;
  if (updates.entryFee !== undefined) dbUpdates.entry_fee = updates.entryFee;
  if (updates.googleSheetUrl !== undefined) dbUpdates.google_sheet_url = updates.googleSheetUrl;
  if (updates.organizerName !== undefined) dbUpdates.organizer_name = updates.organizerName;
  if (updates.organizerContact !== undefined) dbUpdates.organizer_contact = updates.organizerContact;
  if (updates.registeredCount !== undefined) dbUpdates.registered_count = updates.registeredCount;

  if (Object.keys(dbUpdates).length > 0) {
    fireAndForget(
      supabase
        .from('tournaments')
        .update(dbUpdates)
        .or(`id.eq.${idOrSlug},slug.eq.${idOrSlug}`)
    );
  }

  return tournaments[index];
}

export async function deleteTournamentAsync(idOrSlug: string): Promise<boolean> {
  const tournaments = readTournamentsFromFile();
  const filtered = tournaments.filter(
    (t) => t.id !== idOrSlug && t.slug.toLowerCase() !== idOrSlug.toLowerCase()
  );
  saveTournamentsToFile(filtered);

  try {
    const { error } = await supabase
      .from('tournaments')
      .delete()
      .or(`id.eq.${idOrSlug},slug.ilike.${idOrSlug}`);

    if (error) {
      console.error('Supabase delete tournament error:', error);
    }
  } catch (err) {
    console.error('Supabase delete tournament error:', err);
  }

  return true;
}

export function deleteTournament(idOrSlug: string): boolean {
  const tournaments = readTournamentsFromFile();
  const filtered = tournaments.filter(
    (t) => t.id !== idOrSlug && t.slug.toLowerCase() !== idOrSlug.toLowerCase()
  );
  saveTournamentsToFile(filtered);

  fireAndForget(
    supabase
      .from('tournaments')
      .delete()
      .or(`id.eq.${idOrSlug},slug.ilike.${idOrSlug}`)
  );

  return true;
}

export async function incrementRegistrationCountAsync(slug: string): Promise<number> {
  const tournaments = readTournamentsFromFile();
  const tournament = tournaments.find((t) => t.slug.toLowerCase() === slug.toLowerCase());
  if (tournament) {
    tournament.registeredCount = (tournament.registeredCount || 0) + 1;
    saveTournamentsToFile([...tournaments]);

    try {
      await supabase
        .from('tournaments')
        .update({ registered_count: tournament.registeredCount })
        .ilike('slug', slug);
    } catch (err) {
      console.error('Supabase increment count error:', err);
    }

    return tournament.registeredCount;
  }
  return 0;
}

export function incrementRegistrationCount(slug: string): number {
  fireAndForget(incrementRegistrationCountAsync(slug));
  const tournaments = readTournamentsFromFile();
  const tournament = tournaments.find((t) => t.slug.toLowerCase() === slug.toLowerCase());
  if (tournament) {
    tournament.registeredCount = (tournament.registeredCount || 0) + 1;
    saveTournamentsToFile([...tournaments]);
    return tournament.registeredCount;
  }
  return 0;
}

// =============================================================================
// PLAYER REGISTRATIONS APIS (Supabase Cloud + Local Fallback)
// =============================================================================

export async function savePlayerRegistrationAsync(player: RegistrationSubmission): Promise<void> {
  const players = readPlayersFromFile();
  const existingIdx = players.findIndex((p) => p.registrationId === player.registrationId);
  if (existingIdx >= 0) {
    players[existingIdx] = player;
  } else {
    players.unshift(player);
  }
  savePlayersToFile(players);

  try {
    const { error } = await supabase
      .from('players')
      .upsert({
        registration_id: player.registrationId,
        tournament_slug: player.tournamentSlug,
        tournament_title: player.tournamentTitle || '',
        full_name: player.fullName,
        phone: player.phone,
        age: String(player.age),
        role: player.role,
        batting_style: player.battingStyle,
        bowling_style: player.bowlingStyle,
        stats: player.stats || '',
        photo_url: player.photoUrl || '',
        payment_id: player.paymentId || '',
        order_id: player.orderId || '',
        payment_status: player.paymentStatus || 'FREE',
        amount: Number(player.amount) || 0,
        timestamp: player.timestamp || new Date().toISOString(),
      });
    if (error) {
      console.error('Supabase player save error:', error);
    }
  } catch (err) {
    console.error('Supabase player save exception:', err);
  }
}

export function savePlayerRegistration(player: RegistrationSubmission): void {
  fireAndForget(savePlayerRegistrationAsync(player));
}

export function getPlayersByTournament(slug: string): RegistrationSubmission[] {
  const players = readPlayersFromFile();
  return players.filter(
    (p) => p.tournamentSlug && p.tournamentSlug.toLowerCase() === slug.toLowerCase()
  );
}

export async function getPlayersByTournamentAsync(slug: string): Promise<RegistrationSubmission[]> {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .ilike('tournament_slug', slug)
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const mapped = data.map(mapDbPlayerToModel);
      return mapped;
    }
  } catch (err) {}

  return getPlayersByTournament(slug);
}

export function getAllPlayers(): RegistrationSubmission[] {
  return readPlayersFromFile();
}

export async function getAllPlayersAsync(): Promise<RegistrationSubmission[]> {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data)) {
      const mapped = data.map(mapDbPlayerToModel);
      savePlayersToFile(mapped);
      return mapped;
    }
  } catch (err) {}

  return readPlayersFromFile();
}

export async function updatePlayerAsync(
  registrationId: string,
  updates: Partial<RegistrationSubmission>
): Promise<RegistrationSubmission | null> {
  const players = readPlayersFromFile();
  const index = players.findIndex((p) => p.registrationId === registrationId);
  if (index === -1) return null;

  players[index] = {
    ...players[index],
    ...updates,
  };

  savePlayersToFile([...players]);

  const dbUpdates: any = {};
  if (updates.fullName !== undefined) dbUpdates.full_name = updates.fullName;
  if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
  if (updates.age !== undefined) dbUpdates.age = String(updates.age);
  if (updates.role !== undefined) dbUpdates.role = updates.role;
  if (updates.battingStyle !== undefined) dbUpdates.batting_style = updates.battingStyle;
  if (updates.bowlingStyle !== undefined) dbUpdates.bowling_style = updates.bowlingStyle;
  if (updates.stats !== undefined) dbUpdates.stats = updates.stats;
  if (updates.paymentStatus !== undefined) dbUpdates.payment_status = updates.paymentStatus;
  if (updates.amount !== undefined) dbUpdates.amount = Number(updates.amount);
  if (updates.photoUrl !== undefined) dbUpdates.photo_url = updates.photoUrl;

  if (Object.keys(dbUpdates).length > 0) {
    try {
      await supabase
        .from('players')
        .update(dbUpdates)
        .eq('registration_id', registrationId);
    } catch (err) {
      console.error('Supabase player update error:', err);
    }
  }

  return players[index];
}

export function updatePlayer(
  registrationId: string,
  updates: Partial<RegistrationSubmission>
): RegistrationSubmission | null {
  fireAndForget(updatePlayerAsync(registrationId, updates));
  const players = readPlayersFromFile();
  const index = players.findIndex((p) => p.registrationId === registrationId);
  if (index === -1) return null;
  players[index] = { ...players[index], ...updates };
  savePlayersToFile([...players]);
  return players[index];
}

export async function deletePlayerAsync(registrationId: string): Promise<boolean> {
  const players = readPlayersFromFile();
  const target = players.find((p) => p.registrationId === registrationId);
  if (!target) return false;

  const filtered = players.filter((p) => p.registrationId !== registrationId);
  savePlayersToFile(filtered);

  try {
    await supabase
      .from('players')
      .delete()
      .eq('registration_id', registrationId);
  } catch (err) {
    console.error('Supabase player delete error:', err);
  }

  // Decrement tournament registration count if applicable
  if (target.tournamentSlug) {
    const tournaments = readTournamentsFromFile();
    const tourney = tournaments.find(
      (t) => t.slug.toLowerCase() === target.tournamentSlug.toLowerCase()
    );
    if (tourney && tourney.registeredCount && tourney.registeredCount > 0) {
      tourney.registeredCount = tourney.registeredCount - 1;
      saveTournamentsToFile([...tournaments]);

      try {
        await supabase
          .from('tournaments')
          .update({ registered_count: tourney.registeredCount })
          .ilike('slug', target.tournamentSlug);
      } catch (err) {}
    }
  }

  return true;
}

export function deletePlayer(registrationId: string): boolean {
  const players = readPlayersFromFile();
  const target = players.find((p) => p.registrationId === registrationId);
  if (!target) return false;

  const filtered = players.filter((p) => p.registrationId !== registrationId);
  savePlayersToFile(filtered);

  fireAndForget(
    supabase
      .from('players')
      .delete()
      .eq('registration_id', registrationId)
  );

  if (target.tournamentSlug) {
    const tournaments = readTournamentsFromFile();
    const tourney = tournaments.find(
      (t) => t.slug.toLowerCase() === target.tournamentSlug.toLowerCase()
    );
    if (tourney && tourney.registeredCount && tourney.registeredCount > 0) {
      tourney.registeredCount = tourney.registeredCount - 1;
      saveTournamentsToFile([...tournaments]);

      fireAndForget(
        supabase
          .from('tournaments')
          .update({ registered_count: tourney.registeredCount })
          .ilike('slug', target.tournamentSlug)
      );
    }
  }

  return true;
}
