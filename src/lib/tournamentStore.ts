import fs from 'fs';
import path from 'path';
import os from 'os';
import { Tournament, RegistrationSubmission } from './types';

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
 * Ensure writable data directory exists without crashing
 */
function ensureStorageDir(): void {
  try {
    if (!fs.existsSync(STORAGE_DIR)) {
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
    }
  } catch (err) {
    // If mkdir fails on read-only system, memory cache will serve requests
  }
}

/**
 * Read tournaments with fallback order: Memory -> Writable Temp Disk -> Seed Disk
 */
function readTournamentsFromFile(): Tournament[] {
  // 1. Check in-memory cache
  if (globalThis.__CRICBID_TOURNAMENTS__ && globalThis.__CRICBID_TOURNAMENTS__.length > 0) {
    return globalThis.__CRICBID_TOURNAMENTS__;
  }

  // 2. Try reading from writable storage file
  try {
    if (fs.existsSync(TOURNAMENTS_FILE)) {
      const raw = fs.readFileSync(TOURNAMENTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        globalThis.__CRICBID_TOURNAMENTS__ = parsed;
        return parsed;
      }
    }
  } catch (err) {
    // Continue to seed fallback
  }

  // 3. Try reading from committed seed file
  try {
    if (fs.existsSync(SEED_TOURNAMENTS_FILE)) {
      const raw = fs.readFileSync(SEED_TOURNAMENTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        globalThis.__CRICBID_TOURNAMENTS__ = parsed;
        // Try caching to writable storage
        saveTournamentsToFile(parsed);
        return parsed;
      }
    }
  } catch (err) {
    // Fallback to empty array
  }

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
  } catch (err) {
    // Non-fatal on serverless if tmp is restricted; memory cache holds data
  }
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
// GOOGLE SHEETS CLOUD SYNCHRONIZATION HELPERS
// =============================================================================

/**
 * Sync tournament to Google Sheets webhook in background
 */
export async function syncTournamentToGoogleSheet(tournament: Tournament): Promise<boolean> {
  const targetUrl = tournament.googleSheetUrl || MASTER_GOOGLE_SHEET_URL;
  if (!targetUrl || !targetUrl.startsWith('http')) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_tournament',
        ...tournament,
      }),
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    return res.ok;
  } catch (err) {
    console.error('Google Sheet tournament sync error:', err);
    return false;
  }
}

/**
 * Update tournament in Google Sheet
 */
export async function syncUpdateToGoogleSheet(idOrSlug: string, updates: Partial<Tournament>): Promise<boolean> {
  const targetUrl = MASTER_GOOGLE_SHEET_URL;
  if (!targetUrl || !targetUrl.startsWith('http')) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_tournament',
        idOrSlug,
        ...updates,
      }),
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    return res.ok;
  } catch (err) {
    console.error('Google Sheet tournament update error:', err);
    return false;
  }
}

/**
 * Fetch all tournaments from Google Sheet cloud database
 */
export async function fetchTournamentsFromGoogleSheet(): Promise<Tournament[]> {
  const targetUrl = MASTER_GOOGLE_SHEET_URL;
  if (!targetUrl || !targetUrl.startsWith('http')) return [];

  try {
    const fetchUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=tournaments`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(fetchUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.status === 'success' && Array.isArray(data.tournaments) && data.tournaments.length > 0) {
        return data.tournaments;
      }
    }
  } catch (err) {
    // Fall back to local store
  }
  return [];
}

/**
 * Fetch players from Google Sheet for specific tournament or all
 */
export async function fetchPlayersFromGoogleSheet(slug?: string): Promise<RegistrationSubmission[]> {
  const targetUrl = MASTER_GOOGLE_SHEET_URL;
  if (!targetUrl || !targetUrl.startsWith('http')) return [];

  try {
    const fetchUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}action=players${slug ? '&slug=' + encodeURIComponent(slug) : ''}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(fetchUrl, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && data.status === 'success' && Array.isArray(data.players)) {
        return data.players;
      }
    }
  } catch (err) {}
  return [];
}

// =============================================================================
// PUBLIC TOURNAMENT APIS (Synchronous + Asynchronous)
// =============================================================================

export function getAllTournaments(): Tournament[] {
  return readTournamentsFromFile();
}

export async function getAllTournamentsAsync(): Promise<Tournament[]> {
  const localList = readTournamentsFromFile();

  // If local list has items, verify if remote sync is needed (every 30 seconds)
  const now = Date.now();
  const lastSync = globalThis.__CRICBID_LAST_SYNC__ || 0;
  if (localList.length > 0 && now - lastSync < 30000) {
    return localList;
  }

  // Fetch from Google Sheet to get latest hosted tournaments
  try {
    const remoteList = await fetchTournamentsFromGoogleSheet();
    if (remoteList.length > 0) {
      // Merge remote and local (local recent additions take priority)
      const mergedMap = new Map<string, Tournament>();
      remoteList.forEach((t) => mergedMap.set(t.slug.toLowerCase(), t));
      localList.forEach((t) => mergedMap.set(t.slug.toLowerCase(), t));

      const merged = Array.from(mergedMap.values());
      saveTournamentsToFile(merged);
      globalThis.__CRICBID_LAST_SYNC__ = now;
      return merged;
    }
  } catch (err) {}

  return localList;
}

export function getTournamentBySlug(slug: string): Tournament | null {
  const tournaments = readTournamentsFromFile();
  return tournaments.find((t) => t.slug.toLowerCase() === slug.toLowerCase()) || null;
}

export async function getTournamentBySlugAsync(slug: string): Promise<Tournament | null> {
  const found = getTournamentBySlug(slug);
  if (found) return found;

  // Try refreshing from Google Sheet
  const all = await getAllTournamentsAsync();
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

  // Add to head of tournaments
  const updated = [newTournament, ...tournaments.filter((t) => t.slug !== newTournament.slug)];
  saveTournamentsToFile(updated);

  // Background sync to Google Sheet
  syncTournamentToGoogleSheet(newTournament).catch((err) =>
    console.error('Async sheet sync error:', err)
  );

  return newTournament;
}

export async function createTournamentAsync(
  input: Omit<Tournament, 'id' | 'slug' | 'registeredCount' | 'createdAt'> & { slug?: string }
): Promise<Tournament> {
  const tournament = createTournament(input);
  // Await cloud sync for maximum reliability
  await syncTournamentToGoogleSheet(tournament).catch(() => null);
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

  // Background sync update to Google Sheet
  syncUpdateToGoogleSheet(idOrSlug, updates).catch(() => null);

  return tournaments[index];
}

export function incrementRegistrationCount(slug: string): number {
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
// PLAYER REGISTRATIONS APIS
// =============================================================================

export function savePlayerRegistration(player: RegistrationSubmission): void {
  const players = readPlayersFromFile();
  players.unshift(player);
  savePlayersToFile(players);
}

export function getPlayersByTournament(slug: string): RegistrationSubmission[] {
  const players = readPlayersFromFile();
  return players.filter(
    (p) => p.tournamentSlug && p.tournamentSlug.toLowerCase() === slug.toLowerCase()
  );
}

export async function getPlayersByTournamentAsync(slug: string): Promise<RegistrationSubmission[]> {
  const localPlayers = getPlayersByTournament(slug);

  try {
    const remotePlayers = await fetchPlayersFromGoogleSheet(slug);
    if (remotePlayers.length > 0) {
      // Merge unique by registrationId
      const map = new Map<string, RegistrationSubmission>();
      remotePlayers.forEach((p) => map.set(p.registrationId, p));
      localPlayers.forEach((p) => map.set(p.registrationId, p));

      const merged = Array.from(map.values());
      // Save merged to local cache
      savePlayersToFile(merged);
      return merged.filter((p) => p.tournamentSlug.toLowerCase() === slug.toLowerCase());
    }
  } catch (err) {}

  return localPlayers;
}
