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

function mergeStateSafe(prev: FullAuctionState | null, incoming: FullAuctionState): FullAuctionState {
  if (!prev) return incoming;

  const currentQueue =
    incoming.playersQueue && incoming.playersQueue.length > 0
      ? incoming.playersQueue
      : prev.playersQueue;

  const hydratedSoldHistory = (incoming.soldHistory || []).map((sh: any) => {
    if (!sh.player?.photoUrl) {
      const matched = currentQueue?.find((pq: any) => pq.player?.registrationId === sh.player?.registrationId);
      if (matched?.player?.photoUrl) {
        return {
          ...sh,
          player: {
            ...sh.player,
            photoUrl: matched.player.photoUrl,
          },
        };
      }
    }
    return sh;
  });

  const prevActionTime = prev.room?.lastActionTimestamp || 0;
  const incomingActionTime = incoming.room?.lastActionTimestamp || 0;

  let resolvedRoom = { ...incoming.room };
  let resolvedCurrentPlayer = incoming.currentPlayer;
  let resolvedCurrentPlayerState = incoming.currentPlayerState;
  let resolvedBiddingTeam = incoming.currentBiddingTeam;

  if (prevActionTime > incomingActionTime && prev.room?.lastAction !== 'INIT') {
    resolvedRoom = {
      ...incoming.room,
      currentPlayerId: prev.room.currentPlayerId,
      currentBid: prev.room.currentBid,
      currentBiddingTeamId: prev.room.currentBiddingTeamId,
      timerSeconds: prev.room.timerSeconds,
      timerRunning: prev.room.timerRunning,
      lastAction: prev.room.lastAction,
      lastActionTimestamp: prev.room.lastActionTimestamp,
    };
    resolvedCurrentPlayer = prev.currentPlayer;
    resolvedCurrentPlayerState = prev.currentPlayerState;
    resolvedBiddingTeam = prev.currentBiddingTeam;
  } else {
    const isSamePlayer =
      prev.room?.currentPlayerId &&
      incoming.room?.currentPlayerId &&
      prev.room.currentPlayerId === incoming.room.currentPlayerId;

    if (
      isSamePlayer &&
      incoming.room.currentBid < prev.room.currentBid &&
      incoming.room.lastAction !== 'UNDO' &&
      incoming.room.lastAction !== 'RESET' &&
      incoming.room.lastAction !== 'NEXT'
    ) {
      resolvedRoom.currentBid = prev.room.currentBid;
      resolvedRoom.currentBiddingTeamId = prev.room.currentBiddingTeamId;
      resolvedBiddingTeam = prev.currentBiddingTeam || incoming.currentBiddingTeam;
    }
  }

  return {
    ...incoming,
    room: resolvedRoom,
    currentPlayer: resolvedCurrentPlayer,
    currentPlayerState: resolvedCurrentPlayerState,
    currentBiddingTeam: resolvedBiddingTeam,
    playersQueue: currentQueue,
    soldHistory: hydratedSoldHistory,
  };
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
      const res = await fetch(`/api/auction/${slug}?view=live&t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.state) {
          setState((prev) => mergeStateSafe(prev, json.state));
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
    // 1200ms lightweight fallback polling when tab is active (Supabase WebSocket handles sub-30ms instant updates)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchState();
      }
    }, 1200);
    return () => clearInterval(interval);
  }, [slug]);

  // Realtime Supabase listener (instant state update in <50ms without round-trip HTTP)
  useEffect(() => {
    if (!slug) return;
    const channel = supabase.channel(`auction_${slug.toLowerCase()}`);
    channel.on('broadcast', { event: '*' }, (msg: any) => {
      if (msg?.payload?.state) {
        setState((prev) => mergeStateSafe(prev, msg.payload.state));
      } else {
        fetchState();
      }
    }).subscribe();
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
              <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-4 sm:p-5 shadow-2xl space-y-4">
                
                {/* 5-SECOND FINAL CALL ALERT */}
                {room.lastAction === 'HAMMER_5S' && (
                  <div className="bg-red-950 border-2 border-amber-400 rounded-2xl p-3 text-center shadow-lg animate-pulse">
                    <span className="text-xs font-black uppercase text-amber-300 tracking-widest block">
                      ⚡ FINAL CALL! 5s HAMMER DOWN!
                    </span>
                    <span className="text-[11px] text-slate-300">
                      Going once, going twice... place final bid now!
                    </span>
                  </div>
                )}

                {/* Hero Player Frame with Caution Tape Bidding Bar */}
                <div className="w-full h-80 sm:h-96 rounded-2xl border-2 border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.3)] relative overflow-hidden bg-slate-950 flex flex-col justify-end">
                  {/* Photo */}
                  {currentPlayer.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentPlayer.photoUrl}
                      alt={currentPlayer.fullName}
                      className="absolute inset-0 w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950 flex items-center justify-center font-black text-amber-400 text-6xl">
                      {getInitials(currentPlayer.fullName)}
                    </div>
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-90 pointer-events-none" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-[10px] uppercase shadow">
                      {currentPlayer.role}
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950/90 border border-amber-400/50 text-amber-300 font-mono text-[10px] font-black">
                      ₹{room.basePrice.toLocaleString('en-IN')}
                    </span>
                  </div>

                  {/* Caution-Tape Bidding Ribbon Across Lower Portion */}
                  <div className="relative z-20 w-full border-t-2 border-amber-400 bg-slate-950/95 backdrop-blur-md p-3 shadow-lg">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
                          CURRENT BID
                        </span>
                        <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                          ₹ {currentBid.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider block">
                          HOLDING TEAM
                        </span>
                        {currentBiddingTeam ? (
                          <div className="flex items-center gap-1.5 justify-end mt-0.5">
                            <span className="text-xs font-black uppercase text-white bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-lg text-emerald-300">
                              {currentBiddingTeam.name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-300 font-bold">Awaiting Bid</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Player Identity Info */}
                <div className="px-1">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-xl font-black uppercase text-white truncate">
                      {currentPlayer.fullName}
                    </h3>
                    <span className="text-xs font-mono text-amber-400 font-bold">
                      {currentPlayer.age} YRS
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                    <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[11px] font-bold text-amber-300">
                      {currentPlayer.battingStyle}
                    </span>
                    {!isPureBatsman && currentPlayer.bowlingStyle && currentPlayer.bowlingStyle !== 'None' && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[11px] font-bold text-emerald-300">
                        {currentPlayer.bowlingStyle}
                      </span>
                    )}
                  </div>

                  {currentPlayer.stats && currentPlayer.stats !== 'No previous achievements provided' && (
                    <div className="mt-2.5 p-2.5 bg-slate-950/70 rounded-xl border border-slate-800 text-xs text-slate-300 italic">
                      &ldquo;{currentPlayer.stats}&rdquo;
                    </div>
                  )}
                </div>

                {/* Sold / Unsold Notification Banner */}
                {room.lastAction === 'SOLD' && currentBiddingTeam && (
                  <div className="bg-emerald-950/90 border-2 border-emerald-400 p-3 rounded-2xl text-center shadow-lg animate-in zoom-in-95">
                    <span className="text-[10px] font-black uppercase bg-emerald-400 text-slate-950 px-2 py-0.5 rounded-full inline-block mb-1">
                      OFFICIALLY SOLD
                    </span>
                    <h4 className="text-base font-black text-white uppercase">
                      {currentPlayer.fullName} &rarr; {currentBiddingTeam.name}
                    </h4>
                    <span className="text-lg font-mono font-black text-amber-400">
                      ₹ {currentBid.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}

                {room.lastAction === 'UNSOLD' && (
                  <div className="bg-rose-950/90 border-2 border-rose-500 p-3 rounded-2xl text-center shadow-lg animate-in zoom-in-95">
                    <span className="text-xs font-black uppercase text-rose-300">
                      PLAYER UNSOLD
                    </span>
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
            {teams.map((t) => {
              const teamSold = (soldHistory || []).filter(
                (s) => s.team.id === t.id || (s.team.name && s.team.name.toLowerCase() === t.name.toLowerCase())
              );
              return (
                <div key={t.id} className="p-3.5 bg-slate-900 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between">
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
                          Squad: {teamSold.length}/{t.maxPlayers} players
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

                  {/* Bought Squad Players for this franchise */}
                  {teamSold.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1">
                      <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">
                        Squad Players ({teamSold.length}):
                      </span>
                      <div className="grid grid-cols-1 gap-1">
                        {teamSold.map((sp, sIdx) => (
                          <div
                            key={sIdx}
                            className="px-2 py-1 rounded-lg bg-slate-950/60 border border-slate-800/60 flex items-center justify-between text-xs"
                          >
                            <span className="font-bold text-slate-200 truncate max-w-[180px]">
                              {sp.player.fullName} <span className="text-amber-400 text-[10px]">({sp.player.role})</span>
                            </span>
                            <span className="font-mono font-black text-emerald-400 shrink-0">
                              ₹{sp.soldPrice.toLocaleString('en-IN')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
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
