const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.argv[2];

if (!connectionString) {
  console.error('DATABASE_URL is required as environment variable or argument.');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function setup() {
  console.log('Connecting to Supabase PostgreSQL database...');
  await client.connect();
  console.log('Connected successfully!');

  // 1. Create Tournaments Table
  console.log('Creating tournaments table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.tournaments (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      tagline TEXT,
      city TEXT NOT NULL,
      venue TEXT NOT NULL,
      banner_url TEXT,
      registration_deadline TEXT,
      auction_date TEXT,
      is_paid BOOLEAN NOT NULL DEFAULT false,
      entry_fee NUMERIC NOT NULL DEFAULT 0,
      google_sheet_url TEXT,
      organizer_name TEXT,
      organizer_contact TEXT,
      registered_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 2. Create Players Table
  console.log('Creating players table...');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.players (
      registration_id TEXT PRIMARY KEY,
      tournament_slug TEXT NOT NULL,
      tournament_title TEXT NOT NULL,
      full_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      age TEXT NOT NULL,
      role TEXT NOT NULL,
      batting_style TEXT NOT NULL,
      bowling_style TEXT NOT NULL,
      stats TEXT,
      photo_url TEXT,
      payment_id TEXT,
      order_id TEXT,
      payment_status TEXT NOT NULL DEFAULT 'FREE',
      amount NUMERIC NOT NULL DEFAULT 0,
      timestamp TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // 3. Create Indexes
  console.log('Creating database indexes...');
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_players_tournament ON public.players(tournament_slug);
    CREATE INDEX IF NOT EXISTS idx_players_phone ON public.players(phone);
    CREATE INDEX IF NOT EXISTS idx_tournaments_slug ON public.tournaments(slug);
  `);

  // 4. Migrate local tournaments
  const tournamentsPath = path.join(process.cwd(), 'data', 'tournaments.json');
  if (fs.existsSync(tournamentsPath)) {
    const raw = fs.readFileSync(tournamentsPath, 'utf-8');
    const tournaments = JSON.parse(raw);
    console.log(`Migrating ${tournaments.length} existing tournaments...`);

    for (const t of tournaments) {
      await client.query(
        `
        INSERT INTO public.tournaments (
          id, slug, title, tagline, city, venue, banner_url,
          registration_deadline, auction_date, is_paid, entry_fee,
          google_sheet_url, organizer_name, organizer_contact, registered_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (slug) DO UPDATE SET
          title = EXCLUDED.title,
          is_paid = EXCLUDED.is_paid,
          entry_fee = EXCLUDED.entry_fee,
          registered_count = EXCLUDED.registered_count;
      `,
        [
          t.id,
          t.slug,
          t.title,
          t.tagline || '',
          t.city,
          t.venue,
          t.bannerUrl || '',
          t.registrationDeadline || '',
          t.auctionDate || '',
          Boolean(t.isPaid),
          Number(t.entryFee) || 0,
          t.googleSheetUrl || '',
          t.organizerName || '',
          t.organizerContact || '',
          Number(t.registeredCount) || 0,
        ]
      );
    }
  }

  // 5. Migrate local players
  const playersPath = path.join(process.cwd(), 'data', 'players.json');
  if (fs.existsSync(playersPath)) {
    const raw = fs.readFileSync(playersPath, 'utf-8');
    const players = JSON.parse(raw);
    console.log(`Migrating ${players.length} existing players...`);

    for (const p of players) {
      await client.query(
        `
        INSERT INTO public.players (
          registration_id, tournament_slug, tournament_title,
          full_name, phone, age, role, batting_style, bowling_style,
          stats, photo_url, payment_id, order_id, payment_status, amount, timestamp
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (registration_id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          phone = EXCLUDED.phone,
          payment_status = EXCLUDED.payment_status,
          amount = EXCLUDED.amount;
      `,
        [
          p.registrationId,
          p.tournamentSlug,
          p.tournamentTitle || '',
          p.fullName,
          p.phone,
          String(p.age || '20'),
          p.role,
          p.battingStyle,
          p.bowlingStyle,
          p.stats || '',
          p.photoUrl || '',
          p.paymentId || '',
          p.orderId || '',
          p.paymentStatus || 'FREE',
          Number(p.amount) || 0,
          p.timestamp || new Date().toISOString(),
        ]
      );
    }
  }

  // Verification Query
  const tournCountRes = await client.query('SELECT count(*) FROM public.tournaments;');
  const playCountRes = await client.query('SELECT count(*) FROM public.players;');

  console.log('\n--- SUPABASE DATABASE SETUP COMPLETE ---');
  console.log(`Total Tournaments in Supabase: ${tournCountRes.rows[0].count}`);
  console.log(`Total Players in Supabase: ${playCountRes.rows[0].count}`);

  await client.end();
}

setup().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
