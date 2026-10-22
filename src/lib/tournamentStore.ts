import fs from 'fs';
import path from 'path';
import { Tournament } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const TOURNAMENTS_FILE = path.join(DATA_DIR, 'tournaments.json');

const INITIAL_TOURNAMENTS: Tournament[] = [
  {
    id: 'tourn_mpl_2026',
    slug: 'mumbai-premier-league-2026',
    title: 'Mumbai Premier League 2026',
    tagline: 'Season 4 • Mega Star Player Auction',
    city: 'Mumbai',
    venue: 'Wankhede Cricket Stadium Complex',
    bannerUrl: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop',
    registrationDeadline: '2026-11-15',
    auctionDate: '2026-11-20',
    googleSheetUrl: '',
    isPaid: true,
    entryFee: 499,
    organizerName: 'Mumbai Cricket Council',
    organizerContact: '+919876543210',
    registeredCount: 42,
    featured: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tourn_blr_sixes',
    slug: 'bangalore-t20-super-sixes',
    title: 'Bangalore T20 Super Sixes',
    tagline: 'Corporate & Club Championship 2026',
    city: 'Bengaluru',
    venue: 'Chinnaswamy Sports Arena',
    bannerUrl: 'https://images.unsplash.com/photo-1531415074868-036b1c57e3ce?q=80&w=1200&auto=format&fit=crop',
    registrationDeadline: '2026-11-25',
    auctionDate: '2026-12-01',
    googleSheetUrl: '',
    isPaid: false,
    entryFee: 0,
    organizerName: 'Bangalore T20 League',
    organizerContact: '+919812345678',
    registeredCount: 28,
    featured: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tourn_delhi_cup',
    slug: 'delhi-capital-cup-2026',
    title: 'Delhi Capital Cup 2026',
    tagline: 'National Talent Hunt & Player Draft',
    city: 'New Delhi',
    venue: 'Arun Jaitley Cricket Pavilion',
    bannerUrl: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?q=80&w=1200&auto=format&fit=crop',
    registrationDeadline: '2026-11-30',
    auctionDate: '2026-12-05',
    googleSheetUrl: '',
    isPaid: true,
    entryFee: 399,
    organizerName: 'Capital Cricket Board',
    organizerContact: '+919899887766',
    registeredCount: 64,
    featured: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'tourn_kolkata_cup',
    slug: 'kolkata-club-trophy-2026',
    title: 'Kolkata Club Trophy 2026',
    tagline: 'Grassroots Talent Draft & T20 Carnival',
    city: 'Kolkata',
    venue: 'Eden Gardens Outer Grounds',
    bannerUrl: 'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?q=80&w=1200&auto=format&fit=crop',
    registrationDeadline: '2026-12-10',
    auctionDate: '2026-12-15',
    googleSheetUrl: '',
    isPaid: false,
    entryFee: 0,
    organizerName: 'Bengal Cricket Club',
    organizerContact: '+919833445566',
    registeredCount: 19,
    featured: false,
    createdAt: new Date().toISOString(),
  },
];

function ensureFileExists(): Tournament[] {
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
    return INITIAL_TOURNAMENTS;
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

export function getAllTournaments(): Tournament[] {
  return ensureFileExists();
}

export function getTournamentBySlug(slug: string): Tournament | null {
  const tournaments = ensureFileExists();
  return tournaments.find((t) => t.slug.toLowerCase() === slug.toLowerCase()) || null;
}

export function getTournamentById(id: string): Tournament | null {
  const tournaments = ensureFileExists();
  return tournaments.find((t) => t.id === id) || null;
}

export function createTournament(
  input: Omit<Tournament, 'id' | 'slug' | 'registeredCount' | 'createdAt'> & { slug?: string }
): Tournament {
  const tournaments = ensureFileExists();

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
  const tournaments = ensureFileExists();
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
  const tournaments = ensureFileExists();
  const tournament = tournaments.find((t) => t.slug.toLowerCase() === slug.toLowerCase());
  if (tournament) {
    tournament.registeredCount = (tournament.registeredCount || 0) + 1;
    saveTournaments(tournaments);
    return tournament.registeredCount;
  }
  return 0;
}
