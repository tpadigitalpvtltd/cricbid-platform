-- =============================================================================
-- CRICBID LIVE AUCTION ENGINE - SUPABASE SCHEMA MIGRATION
-- Run this script in the Supabase Dashboard SQL Editor (https://supabase.com/dashboard)
-- =============================================================================

-- 1. TOURNAMENT TEAMS TABLE
CREATE TABLE IF NOT EXISTS public.tournament_teams (
  id TEXT PRIMARY KEY,
  tournament_id TEXT,
  tournament_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  logo_url TEXT,
  color TEXT DEFAULT '#f59e0b',
  total_purse NUMERIC NOT NULL DEFAULT 100000,
  remaining_purse NUMERIC NOT NULL DEFAULT 100000,
  secret_pin TEXT NOT NULL DEFAULT '1234',
  max_players INT NOT NULL DEFAULT 15,
  bought_players_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_teams_slug ON public.tournament_teams(tournament_slug);

-- 2. AUCTION ROOMS TABLE
CREATE TABLE IF NOT EXISTS public.auction_rooms (
  id TEXT PRIMARY KEY,
  tournament_id TEXT,
  tournament_slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'WAITING', -- 'WAITING', 'ACTIVE', 'PAUSED', 'COMPLETED'
  current_player_id TEXT,
  current_bid NUMERIC NOT NULL DEFAULT 0,
  current_bidding_team_id TEXT,
  timer_seconds INT NOT NULL DEFAULT 10,
  timer_running BOOLEAN NOT NULL DEFAULT false,
  timer_expires_at BIGINT,
  base_price NUMERIC NOT NULL DEFAULT 1000,
  bid_increment NUMERIC NOT NULL DEFAULT 500,
  last_action TEXT DEFAULT 'INIT',
  last_action_timestamp BIGINT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_rooms_slug ON public.auction_rooms(tournament_slug);

-- 3. AUCTION BIDS TABLE (AUDIT TRAIL)
CREATE TABLE IF NOT EXISTS public.auction_bids (
  id TEXT PRIMARY KEY,
  auction_id TEXT NOT NULL,
  tournament_slug TEXT NOT NULL,
  player_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  team_short_name TEXT,
  team_logo_url TEXT,
  amount NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_bids_slug ON public.auction_bids(tournament_slug);
CREATE INDEX IF NOT EXISTS idx_auction_bids_created ON public.auction_bids(created_at DESC);

-- 4. AUCTION PLAYERS STATE TABLE
CREATE TABLE IF NOT EXISTS public.auction_players (
  id TEXT PRIMARY KEY, -- usually `${tournament_slug}_${player_id}`
  tournament_slug TEXT NOT NULL,
  player_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'IN_AUCTION', 'SOLD', 'UNSOLD'
  base_price NUMERIC NOT NULL DEFAULT 1000,
  sold_price NUMERIC,
  sold_to_team_id TEXT,
  sold_to_team_name TEXT,
  sold_to_team_logo TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auction_players_slug ON public.auction_players(tournament_slug);
CREATE INDEX IF NOT EXISTS idx_auction_players_status ON public.auction_players(status);

-- 5. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_players ENABLE ROW LEVEL SECURITY;

-- Permissive read policy for realtime displays
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read tournament_teams') THEN
    CREATE POLICY "Public Read tournament_teams" ON public.tournament_teams FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read auction_rooms') THEN
    CREATE POLICY "Public Read auction_rooms" ON public.auction_rooms FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read auction_bids') THEN
    CREATE POLICY "Public Read auction_bids" ON public.auction_bids FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public Read auction_players') THEN
    CREATE POLICY "Public Read auction_players" ON public.auction_players FOR SELECT USING (true);
  END IF;
END $$;

-- Service Role full access policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service Role tournament_teams') THEN
    CREATE POLICY "Service Role tournament_teams" ON public.tournament_teams FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service Role auction_rooms') THEN
    CREATE POLICY "Service Role auction_rooms" ON public.auction_rooms FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service Role auction_bids') THEN
    CREATE POLICY "Service Role auction_bids" ON public.auction_bids FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service Role auction_players') THEN
    CREATE POLICY "Service Role auction_players" ON public.auction_players FOR ALL USING (true);
  END IF;
END $$;

-- 6. ENABLE SUPABASE REALTIME REPLICATION (For instant sub-100ms multi-screen sync)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_rooms;
  EXCEPTION WHEN duplicate_object THEN
    -- already added
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_bids;
  EXCEPTION WHEN duplicate_object THEN
    -- already added
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tournament_teams;
  EXCEPTION WHEN duplicate_object THEN
    -- already added
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_players;
  EXCEPTION WHEN duplicate_object THEN
    -- already added
  END;
END $$;
