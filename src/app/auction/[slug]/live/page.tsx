'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Radio,
  Trophy,
  Swords,
  Flame,
  Coins,
  CheckCircle2,
  Clock,
  Users,
  Sparkles,
  User,
} from 'lucide-react';
import { FullAuctionState } from '@/lib/auctionTypes';
import { supabase } from '@/lib/supabase';

function getInitials(name: string): string {
  if (!name) return 'PL';
  const clean = name.replace(/[()[\]{}]/g, ' ').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'PL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MobileSpectatorLivePage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [state, setState] = useState<FullAuctionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'stage' | 'sold' | 'teams'>('stage');

  const fetchState = async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/auction/${slug}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.state) {
          setState(json.state);
        }
      }
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [slug]);

  // Realtime Supabase listener
  useEffect(() => {
    if (!slug) return;
    const channel = supabase.channel(`auction_${slug.toLowerCase()}`);
    channel.on('broadcast', { event: '*' }, () => fetchState()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug]);

  if (loading && !state) {
    return (
      <div className="min-h-screen bg-[#070b16] text-white flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs text-slate-400 uppercase font-black tracking-widest">
          Joining Live Spectator Stream...
        </p>
      </div>
    );
  }

  const { room, currentPlayer, currentBiddingTeam, teams, soldHistory } = state || {
    room: { status: 'WAITING', currentBid: 0, basePrice: 1000 },
    currentPlayer: null,
    currentBiddingTeam: null,
    teams: [],
    soldHistory: [],
  };

  const isPureBatsman = currentPlayer?.role === 'Pure Batsman';
  const currentBid = room.currentBid || room.basePrice || 1000;

  return (
    <div className="min-h-screen bg-[#070b16] text-white flex flex-col justify-between font-sans selection:bg-amber-400 selection:text-slate-950">
      
      {/* HEADER */}
      <header className="px-4 py-3 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
          <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-rose-500/30">
            <Radio className="w-3 h-3" /> LIVE STREAM
          </span>
          <h1 className="text-xs font-black uppercase text-white truncate max-w-[150px] sm:max-w-xs">
            {currentPlayer?.tournamentTitle || 'Live Auction'}
          </h1>
        </div>

        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
            room.status === 'ACTIVE'
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          }`}
        >
          {room.status}
        </span>
      </header>

      {/* VIEW SELECTOR PILLS */}
      <div className="px-4 pt-3 flex items-center gap-2 max-w-md mx-auto w-full">
        <button
          onClick={() => setActiveTab('stage')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'stage' ? 'bg-amber-400 text-slate-950 font-black shadow' : 'bg-slate-900 text-slate-400'
          }`}
        >
          Live Stage
        </button>
        <button
          onClick={() => setActiveTab('sold')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'sold' ? 'bg-amber-400 text-slate-950 font-black shadow' : 'bg-slate-900 text-slate-400'
          }`}
        >
          Sold Feed ({soldHistory.length})
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'teams' ? 'bg-amber-400 text-slate-950 font-black shadow' : 'bg-slate-900 text-slate-400'
          }`}
        >
          Teams ({teams.length})
        </button>
      </div>

      {/* CONTENT ARENA */}
      <main className="flex-1 p-4 max-w-md mx-auto w-full">
        
        {/* TAB 1: LIVE STAGE */}
        {activeTab === 'stage' && (
          <div>
            {currentPlayer ? (
              <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-5 shadow-2xl">
                
                {/* Active Player Card */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-24 h-24 rounded-2xl p-[2px] bg-gradient-to-tr from-amber-400 via-yellow-300 to-emerald-400 shrink-0">
                    <div className="w-full h-full rounded-[14px] bg-slate-950 overflow-hidden flex items-center justify-center">
                      {currentPlayer.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={currentPlayer.photoUrl} alt={currentPlayer.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-black text-amber-400 text-2xl">{getInitials(currentPlayer.fullName)}</span>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-400 text-slate-950">
                      {currentPlayer.role}
                    </span>
                    <h3 className="text-xl font-black uppercase text-white truncate mt-1">
                      {currentPlayer.fullName}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Age: {currentPlayer.age} yrs • {currentPlayer.battingStyle}
                      {!isPureBatsman && currentPlayer.bowlingStyle && currentPlayer.bowlingStyle !== 'None' ? ` • ${currentPlayer.bowlingStyle}` : ''}
                    </p>
                    <span className="text-[11px] text-amber-300 font-mono font-bold block mt-1">
                      Base Price: ₹ {room.basePrice.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>

                {/* Current Bid Display */}
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 text-center mb-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
                    CURRENT BID
                  </span>
                  <div className="text-4xl font-black text-amber-400 font-mono drop-shadow">
                    ₹ {currentBid.toLocaleString('en-IN')}
                  </div>

                  {/* Leading Franchise */}
                  <div className="mt-4 pt-3 border-t border-slate-900 flex items-center justify-center gap-2">
                    {currentBiddingTeam ? (
                      <>
                        <span className="text-xs text-slate-400">Held by:</span>
                        <span className="text-xs font-black uppercase text-white bg-slate-900 px-3 py-1 rounded-xl border border-amber-400/30">
                          {currentBiddingTeam.name}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 italic">No bids placed yet</span>
                    )}
                  </div>
                </div>

                {/* Achievements note */}
                {currentPlayer.stats && currentPlayer.stats !== 'No previous achievements provided' && (
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-300 italic">
                    &ldquo;{currentPlayer.stats}&rdquo;
                  </div>
                )}

              </div>
            ) : (
              <div className="py-24 text-center text-slate-500 bg-slate-900/60 rounded-3xl p-6 border border-slate-800">
                <User className="w-12 h-12 mx-auto mb-2 opacity-40 animate-pulse" />
                <h3 className="text-lg font-black uppercase text-slate-300">Awaiting Next Player</h3>
                <p className="text-xs text-slate-500 mt-1">The auctioneer will load the next player on the block shortly.</p>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SOLD PLAYERS FEED */}
        {activeTab === 'sold' && (
          <div className="space-y-3">
            {soldHistory.length > 0 ? (
              soldHistory.map((s, idx) => (
                <div key={idx} className="p-3.5 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                      {s.player.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.player.photoUrl} alt={s.player.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-black text-amber-400 text-xs">{getInitials(s.player.fullName)}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-amber-400 uppercase">{s.player.role}</span>
                      <h4 className="text-xs font-black uppercase text-white truncate max-w-[140px]">{s.player.fullName}</h4>
                      <span className="text-[10px] text-slate-400">Sold to: <strong className="text-slate-200">{s.team.name}</strong></span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-sm font-black text-emerald-400 font-mono block">
                      ₹ {s.soldPrice.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-500 uppercase bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      SOLD
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16 text-slate-500 text-xs">
                No players have been sold yet. Sales will stream here live.
              </div>
            )}
          </div>
        )}

        {/* TAB 3: TEAMS & PURSES */}
        {activeTab === 'teams' && (
          <div className="space-y-3">
            {teams.map((t) => (
              <div key={t.id} className="p-3.5 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {t.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={t.logoUrl} alt={t.name} className="w-10 h-10 rounded-xl object-cover bg-slate-950" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xs">
                      {t.shortName}
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-black uppercase text-white truncate max-w-[150px]">{t.name}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Squad: {t.boughtPlayersCount}/{t.maxPlayers} players
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xs sm:text-sm font-black text-amber-400 font-mono block">
                    ₹ {t.remainingPurse.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[9px] text-slate-500 uppercase font-bold">Purse Remaining</span>
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="py-3 text-center text-[10px] text-slate-500 border-t border-slate-900 font-mono">
        CricBid Realtime Spectator Stream • Auto-updating
      </footer>

    </div>
  );
}
