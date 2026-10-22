import fs from 'fs';
import path from 'path';
import { Tournament, RegistrationSubmission } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const TOURNAMENTS_FILE = path.join(DATA_DIR, 'tournaments.json');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');

// Empty initial state - No fake or demo data! Real tournaments will be added by users/admin
const INITIAL_TOURNAMENTS: Tournament[] = [];

function ensureTournamentsFile(): Tournament[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(TOURNAMENTS_FILE)) {
      fs.writeFileSync(TOURNAMENTS_FILE, JSON.stringify(INITIAL_TOURNAMENTS, null, 2), 'utf-8');
      return INITIAL_TOURNAMENTS;
    }
    const raw = fs.readFileSync(TOURNAMENTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error reading tournaments file:', error);
    return [];
  }
}

function saveTournaments(tournaments: Tournament[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(TOURNAMENTS_FILE, JSON.stringify(tournaments, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving tournaments file:', error);
  }
}

function ensurePlayersFile(): RegistrationSubmission[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(PLAYERS_FILE)) {
      fs.writeFileSync(PLAYERS_FILE, JSON.stringify([], null, 2), 'utf-8');
      return [];
    }
    const raw = fs.readFileSync(PLAYERS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error reading players file:', error);
    return [];
  }
}

function savePlayers(players: RegistrationSubmission[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving players file:', error);
  }
}

export function getAllTournaments(): Tournament[] {
  return ensureTournamentsFile();
}

export function getTournamentBySlug(slug: string): Tournament | null {
  const tournaments = ensureTournamentsFile();
  return tournaments.find((t) => t.slug.toLowerCase() === slug.toLowerCase()) || null;
}

export function getTournamentById(id: string): Tournament | null {
  const tournaments = ensureTournamentsFile();
  return tournaments.find((t) => t.id === id) || null;
}

export function createTournament(
  input: Omit<Tournament, 'id' | 'slug' | 'registeredCount' | 'createdAt'> & { slug?: string }
): Tournament {
  const tournaments = ensureTournamentsFile();

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

  tournaments.unshift(newTournament);
  saveTournaments(tournaments);
  return newTournament;
}

export function updateTournament(idOrSlug: string, updates: Partial<Tournament>): Tournament | null {
  const tournaments = ensureTournamentsFile();
  const index = tournaments.findIndex(
    (t) => t.id === idOrSlug || t.slug.toLowerCase() === idOrSlug.toLowerCase()
  );

  if (index === -1) return null;

  tournaments[index] = {
    ...tournaments[index],
    ...updates,
  };

  saveTournaments(tournaments);
  return tournaments[index];
}

export function incrementRegistrationCount(slug: string): number {
  const tournaments = ensureTournamentsFile();
  const tournament = tournaments.find((t) => t.slug.toLowerCase() === slug.toLowerCase());
  if (tournament) {
    tournament.registeredCount = (tournament.registeredCount || 0) + 1;
    saveTournaments(tournaments);
    return tournament.registeredCount;
  }
  return 0;
}

// Player Registrations Management
export function savePlayerRegistration(player: RegistrationSubmission): void {
  const players = ensurePlayersFile();
  players.unshift(player);
  savePlayers(players);
}

export function getPlayersByTournament(slug: string): RegistrationSubmission[] {
  const players = ensurePlayersFile();
  return players.filter(
    (p) => p.tournamentSlug && p.tournamentSlug.toLowerCase() === slug.toLowerCase()
  );
}
