'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import confetti from 'canvas-confetti';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Radio,
  Trophy,
  Swords,
  Flame,
  Coins,
  CheckCircle2,
  Gavel,
  ShieldAlert,
  Zap,
  Users,
} from 'lucide-react';
import { FullAuctionState, TournamentTeam } from '@/lib/auctionTypes';
import { auctionAudio } from '@/lib/audioSynthesizer';
import { supabase } from '@/lib/supabase';

function getInitials(name: string): string {
  if (!name) return 'PL';
  const clean = name.replace(/[()[\]{}]/g, ' ').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'PL';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function ProjectorAuctionPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [state, setState] = useState<FullAuctionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // 5-Second Final Call Hammer Timer State (NO automatic counting timer)
  const [hammerCountdown, setHammerCountdown] = useState<number | null>(null);
  const hammerTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sold / Unsold Celebration Modals
  const [showSoldModal, setShowSoldModal] = useState(false);
  const [showUnsoldModal, setShowUnsoldModal] = useState(false);
  const [lastSoldData, setLastSoldData] = useState<{
    playerName: string;
    teamName: string;
    teamLogo?: string;
    teamColor?: string;
    amount: number;
  } | null>(null);

  const prevBidAmountRef = useRef<number>(0);
  const prevActionRef = useRef<string>('');

  // Initialize sound mute state
  useEffect(() => {
    setIsMuted(auctionAudio.getIsMuted());
  }, []);

  // Fetch auction state
  const fetchState = async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/auction/${slug}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.state) {
          handleIncomingState(json.state);
        }
      }
    } catch (e) {
      console.error('Fetch auction error:', e);
    } finally {
      setLoading(false);
    }
  };

  const clearLocalHammerTimer = () => {
    if (hammerTimerRef.current) {
      clearInterval(hammerTimerRef.current);
      hammerTimerRef.current = null;
    }
    setHammerCountdown(null);
  };

  const startLocalHammerCountdown = () => {
    clearLocalHammerTimer();
    setHammerCountdown(5);
    auctionAudio.playCountdownTick(5);

    let count = 5;
    hammerTimerRef.current = setInterval(() => {
      count -= 1;
      if (count <= 0) {
        clearLocalHammerTimer();
      } else {
        setHammerCountdown(count);
        auctionAudio.playCountdownTick(count);
      }
    }, 1000);
  };

  const handleIncomingState = (newState: FullAuctionState) => {
    setState((prevState) => {
      // 1. Check for new higher bid -> Cancel hammer countdown and play chime
      if (
        prevState &&
        newState.room.currentBid > prevBidAmountRef.current &&
        newState.room.currentBiddingTeamId
      ) {
        clearLocalHammerTimer();
        auctionAudio.playBidChime();
      }
      prevBidAmountRef.current = newState.room.currentBid;

      // 2. Check for action changes
      const currentActionKey = `${newState.room.lastAction}_${newState.room.lastActionTimestamp}`;
      if (prevActionRef.current !== currentActionKey) {
        prevActionRef.current = currentActionKey;

        // 5-Second Hammer Final Call triggered by Auctioneer
        if (newState.room.lastAction === 'HAMMER_5S') {
          startLocalHammerCountdown();
        } else if (newState.room.lastAction === 'CANCEL_HAMMER' || newState.room.lastAction === 'NEW_BID') {
          clearLocalHammerTimer();
        } else if (newState.room.lastAction === 'SOLD' && newState.currentBiddingTeam) {
          clearLocalHammerTimer();
          const winningTeam = newState.currentBiddingTeam;
          const soldAmount = newState.room.currentBid;
          const pName = newState.currentPlayer?.fullName || 'Player';

          setLastSoldData({
            playerName: pName,
            teamName: winningTeam.name,
            teamLogo: winningTeam.logoUrl,
            teamColor: winningTeam.color || '#f59e0b',
            amount: soldAmount,
          });

          setShowSoldModal(true);
          setShowUnsoldModal(false);
          auctionAudio.playSoldHammer();

          // Confetti celebration
          try {
            confetti({
              particleCount: 160,
              spread: 110,
              origin: { y: 0.6 },
              colors: [winningTeam.color || '#f59e0b', '#10e87b', '#38bdf8', '#ffffff'],
            });
          } catch (err) {}

          setTimeout(() => setShowSoldModal(false), 5000);
        } else if (newState.room.lastAction === 'UNSOLD') {
          clearLocalHammerTimer();
          setShowUnsoldModal(true);
          setShowSoldModal(false);
          auctionAudio.playUnsoldBuzzer();
          setTimeout(() => setShowUnsoldModal(false), 3500);
        } else if (newState.room.lastAction === 'NEXT' || newState.room.lastAction === 'RESET') {
          clearLocalHammerTimer();
          setShowSoldModal(false);
          setShowUnsoldModal(false);
        }
      }

      return newState;
    });
  };

  // Polling fallback (lightweight 1200ms sync with <30KB payload)
  useEffect(() => {
    fetchState();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchState();
      }
    }, 1200);
    return () => clearInterval(interval);
  }, [slug]);

  // Supabase Realtime broadcast listener for instant sub-50ms sync
  useEffect(() => {
    if (!slug) return;
    const channelName = `auction_${slug.toLowerCase()}`;
    const channel = supabase.channel(channelName);

    channel
      .on('broadcast', { event: '*' }, (msg: any) => {
        if (msg?.payload?.state) {
          handleIncomingState(msg.payload.state);
        } else {
          fetchState();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearLocalHammerTimer();
    };
  }, [slug]);

  const toggleSound = () => {
    const muted = auctionAudio.toggleMute();
    setIsMuted(muted);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  if (loading && !state) {
    return (
      <div className="min-h-screen bg-[#040714] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_30px_rgba(245,158,11,0.5)]"></div>
        <h2 className="text-xl font-black uppercase tracking-widest text-amber-400">
          Connecting to CricBid Live 4K Projector Arena...
        </h2>
        <p className="text-xs text-slate-400 mt-2 font-mono">Initializing Broadcast VFX Engine</p>
      </div>
    );
  }

  const { room, currentPlayer, currentBiddingTeam, teams, recentBids } = state || {
    room: { status: 'WAITING', currentBid: 0, basePrice: 1000 },
    currentPlayer: null,
    currentBiddingTeam: null,
    teams: [],
    recentBids: [],
  };

  const isPureBatsman = currentPlayer?.role === 'Pure Batsman';
  const playerBids = (recentBids || []).filter(
    (b: any) => b.playerId === currentPlayer?.registrationId
  );

  return (
    <div className="min-h-screen bg-[#040714] text-white flex flex-col justify-between overflow-x-hidden selection:bg-amber-400 selection:text-slate-950 font-sans relative">
      
      {/* Stadium Ambient Floodlights */}
      <div className="absolute -top-32 -left-32 w-[550px] h-[550px] bg-amber-500/10 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[180px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[700px] h-[350px] bg-emerald-500/10 rounded-full blur-[180px] pointer-events-none" />

      {/* TOP BROADCAST BAR */}
      <header className="relative z-30 flex items-center justify-between px-6 sm:px-10 py-3.5 border-b border-amber-500/20 bg-slate-950/80 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping"></span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-black tracking-widest uppercase">
              <Radio className="w-3.5 h-3.5" /> LIVE AUCTION
            </div>
          </div>
          <h1 className="text-base sm:text-2xl font-black uppercase tracking-tight text-white truncate drop-shadow">
            {currentPlayer?.tournamentTitle || 'CricBid Mega Player Auction 2026'}
          </h1>
        </div>

        {/* Status & Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <span
            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border shadow-md ${
              room.status === 'ACTIVE'
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
                : room.status === 'PAUSED'
                ? 'bg-amber-500/15 border-amber-500/50 text-amber-400'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            {room.status}
          </span>

          <button
            onClick={toggleSound}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white transition-all shadow-md"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-amber-400 text-slate-300 hover:text-white transition-all shadow-md"
            title="Toggle Fullscreen 4K View"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* 5-SECOND FINAL CALL (HAMMER) VFX OVERLAY BANNER */}
      {hammerCountdown !== null && (
        <div className="relative z-40 w-full bg-gradient-to-r from-red-950 via-rose-900 to-red-950 border-y-4 border-amber-400 py-3.5 px-6 shadow-[0_0_50px_rgba(244,63,94,0.7)] animate-pulse">
          <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shrink-0">
                <Gavel className="w-7 h-7 animate-bounce stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-lg sm:text-2xl font-black uppercase tracking-widest text-amber-300">
                  ⚡ FINAL CALL! GOING ONCE... GOING TWICE...
                </h3>
                <p className="text-xs sm:text-sm text-slate-200 font-semibold">
                  {currentBiddingTeam ? `Holding: ${currentBiddingTeam.name} (₹${room.currentBid.toLocaleString('en-IN')})` : 'No bids placed yet'} • Raise now or gavel falls!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs sm:text-sm font-black uppercase text-amber-300 hidden sm:inline">HAMMER IN:</span>
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-black border-2 border-amber-400 text-amber-400 flex items-center justify-center font-mono font-black text-3xl sm:text-4xl shadow-[0_0_25px_rgba(245,158,11,0.6)]">
                {hammerCountdown}s
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN BROADCAST ARENA */}
      <main className="relative z-10 flex-1 px-4 sm:px-8 py-5 sm:py-7 max-w-[1920px] mx-auto w-full flex flex-col justify-center">
        {currentPlayer ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
            
            {/* LEFT / CENTER: HUGE HERO PLAYER STAGE CARD (7 Cols on desktop) */}
            <div className="lg:col-span-7 flex flex-col items-center">
              <div className="w-full max-w-xl lg:max-w-none h-[420px] sm:h-[500px] lg:h-[560px] rounded-3xl border-2 border-amber-400/80 shadow-[0_0_50px_rgba(245,158,11,0.35)] relative overflow-hidden bg-slate-950 flex flex-col justify-end">
                
                {/* Stadium Spotlight Behind Player */}
                <div className="absolute inset-0 bg-radial from-amber-500/20 via-transparent to-transparent opacity-80 pointer-events-none" />

                {/* Massive Hero Photo */}
                {currentPlayer.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentPlayer.photoUrl}
                    alt={currentPlayer.fullName}
                    className="absolute inset-0 w-full h-full object-cover object-top"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/80 flex items-center justify-center font-black text-amber-400 text-6xl sm:text-8xl tracking-widest">
                    {getInitials(currentPlayer.fullName)}
                  </div>
                )}

                {/* Subtle vignette gradient over photo */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent opacity-90 pointer-events-none" />

                {/* Top Badges Floating Over Photo */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-none">
                  <span className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                    👑 {currentPlayer.role}
                  </span>
                  <span className="px-3.5 py-1.5 rounded-xl bg-slate-950/90 border border-amber-400/60 text-amber-300 font-mono text-xs font-black shadow-lg">
                    💰 BASE: ₹{room.basePrice.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* BROADCAST CAUTION-TAPE / LOWER-THIRD BIDDING STRIP */}
                <div className="relative z-20 w-full border-t-2 border-amber-400 bg-gradient-to-r from-black/95 via-[#161005]/95 to-black/95 backdrop-blur-xl p-4 sm:p-5 shadow-[0_-10px_35px_rgba(0,0,0,0.8)]">
                  
                  {/* Caution Tape Hazard Strip Accent Top Border */}
                  <div className="absolute -top-1.5 left-0 right-0 h-1.5 bg-[repeating-linear-gradient(45deg,#f59e0b_0,#f59e0b_10px,#000_10px,#000_20px)] shadow-md" />

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
                    
                    {/* Current Bid Counter */}
                    <div className="text-center sm:text-left min-w-0">
                      <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 justify-center sm:justify-start">
                        <Coins className="w-3.5 h-3.5 text-amber-400" /> CURRENT HIGHEST BID
                      </span>
                      <div className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 drop-shadow-[0_0_25px_rgba(245,158,11,0.6)] font-mono leading-tight">
                        ₹ {room.currentBid.toLocaleString('en-IN')}
                      </div>
                    </div>

                    {/* Holding Team Banner */}
                    <div className="flex flex-col items-center sm:items-end justify-center shrink-0">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                        HOLDING TEAM BID
                      </span>

                      {currentBiddingTeam ? (
                        <div className="flex items-center gap-3 bg-slate-900/90 p-2.5 px-4 rounded-2xl border-2 border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.35)] animate-pulse">
                          {currentBiddingTeam.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={currentBiddingTeam.logoUrl}
                              alt={currentBiddingTeam.name}
                              className="w-10 h-10 rounded-xl object-cover bg-slate-800 p-0.5 border border-slate-700"
                            />
                          ) : (
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-slate-950 shadow"
                              style={{ backgroundColor: currentBiddingTeam.color || '#f59e0b' }}
                            >
                              {currentBiddingTeam.shortName || 'TM'}
                            </div>
                          )}
                          <div className="text-left">
                            <h4 className="text-base font-black uppercase text-white tracking-wide">
                              {currentBiddingTeam.name}
                            </h4>
                            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
                              👑 HIGHEST BIDDER
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-4 py-2 rounded-xl animate-pulse">
                          ⚠️ Awaiting Opening Bid ({room.status === 'ACTIVE' ? 'Ready' : 'Paused'})
                        </div>
                      )}
                    </div>

                  </div>
                </div>

              </div>
            </div>

            {/* RIGHT: PLAYER IDENTITY & STATS (5 Cols on desktop) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-5">
              
              {/* Header Box */}
              <div className="bg-[#080d1a]/85 backdrop-blur-xl rounded-3xl border border-amber-500/30 p-6 sm:p-7 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center gap-2 mb-2">
                  <span className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-700 text-amber-400 font-mono text-xs font-black">
                    {currentPlayer.registrationId}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">
                    Age: <strong className="text-white font-mono text-sm">{currentPlayer.age} YRS</strong>
                  </span>
                </div>

                <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white drop-shadow-[0_4px_25px_rgba(0,0,0,0.9)] leading-none mb-4">
                  {currentPlayer.fullName}
                </h2>

                {/* Attributes Row */}
                <div className="flex flex-wrap items-center gap-2.5 mb-4">
                  <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-amber-300 flex items-center gap-1.5 shadow">
                    <Swords className="w-4 h-4 text-amber-400" /> {currentPlayer.battingStyle}
                  </span>

                  {!isPureBatsman && currentPlayer.bowlingStyle && currentPlayer.bowlingStyle !== 'None' && (
                    <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-emerald-300 flex items-center gap-1.5 shadow">
                      <Flame className="w-4 h-4 text-emerald-400" /> {currentPlayer.bowlingStyle}
                    </span>
                  )}
                </div>

                {/* Achievement Quote */}
                {currentPlayer.stats && currentPlayer.stats !== 'No previous achievements provided' && (
                  <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 text-xs sm:text-sm text-slate-300 italic">
                    &ldquo;{currentPlayer.stats}&rdquo;
                  </div>
                )}
              </div>

              {/* Bidding Battle Feed / Log */}
              <div className="bg-[#080d1a]/85 backdrop-blur-xl rounded-3xl border border-slate-800 p-5 shadow-2xl">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                  <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-400" /> Live Bidding Momentum
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> FLOOR ACTIVE
                  </span>
                </div>

                {playerBids.length === 0 ? (
                  <div className="text-center py-5 text-xs text-slate-500 font-mono">
                    Awaiting bids from franchises...
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                    {playerBids.slice(0, 4).map((b: any, idx: number) => (
                      <div
                        key={b.id || idx}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                          idx === 0
                            ? 'bg-amber-400/10 border-amber-400/50 font-black text-amber-300 shadow'
                            : 'bg-slate-950/60 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-slate-500 text-[10px]">#{idx + 1}</span>
                          <span className="truncate font-bold uppercase">{b.teamName}</span>
                        </div>
                        <span className="font-mono font-black text-amber-400 shrink-0">
                          ₹ {b.amount.toLocaleString('en-IN')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

          </div>
        ) : (
          <div className="text-center py-24 bg-[#080d1a]/80 rounded-3xl border border-slate-800 max-w-xl mx-auto p-8 shadow-2xl">
            <Trophy className="w-20 h-20 text-amber-400 mx-auto mb-4 animate-pulse" />
            <h3 className="text-3xl font-black uppercase text-white tracking-wide">
              Auction Stage Waiting
            </h3>
            <p className="text-sm text-slate-400 mt-2">
              The auctioneer will load the next player from the draft pool shortly.
            </p>
          </div>
        )}
      </main>

      {/* BOTTOM FRANCHISES PURSE & SQUAD BAR (Full Width) */}
      <footer className="relative z-20 w-full bg-slate-950/90 border-t border-amber-500/20 px-6 sm:px-10 py-3 backdrop-blur-xl">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-4">
          <div className="text-[11px] font-black uppercase tracking-widest text-slate-400 shrink-0 hidden md:flex items-center gap-1.5">
            <Users className="w-4 h-4 text-amber-400" /> FRANCHISES ({teams.length}):
          </div>

          <div className="flex-1 flex items-center gap-3 overflow-x-auto scrollbar-none py-1">
            {teams.map((t) => {
              const isLeading = currentBiddingTeam?.id === t.id;
              return (
                <div
                  key={t.id}
                  className={`p-2 px-3.5 rounded-2xl border transition-all shrink-0 flex items-center gap-2.5 ${
                    isLeading
                      ? 'border-emerald-400 bg-emerald-500/20 ring-2 ring-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.3)] scale-105'
                      : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                  }`}
                >
                  <div
                    className="w-6 h-6 rounded-md overflow-hidden flex items-center justify-center font-black text-[9px] text-slate-950 shrink-0 shadow"
                    style={{ backgroundColor: t.color || '#f59e0b' }}
                  >
                    {t.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.logoUrl} alt={t.name} className="w-full h-full object-cover" />
                    ) : (
                      t.shortName || 'TM'
                    )}
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-white uppercase truncate max-w-[110px]">
                      {t.name}
                    </h5>
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className="text-amber-400 font-bold">₹{t.remainingPurse.toLocaleString('en-IN')}</span>
                      <span className="text-slate-500">• {t.boughtPlayersCount}/{t.maxPlayers}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </footer>

      {/* SOLD CELEBRATION MODAL */}
      {showSoldModal && lastSoldData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl animate-in zoom-in-95 duration-200">
          <div className="max-w-xl w-full bg-[#080d1a] border-4 border-emerald-400 rounded-3xl p-8 sm:p-10 text-center shadow-[0_0_100px_rgba(16,185,129,0.6)] relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-60 h-60 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="w-20 h-20 rounded-3xl bg-emerald-500/20 border-2 border-emerald-400 text-emerald-400 flex items-center justify-center mx-auto mb-4 shadow-xl">
              <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
            </div>

            <div className="inline-block px-6 py-1.5 rounded-full bg-emerald-500 text-slate-950 font-black text-sm uppercase tracking-widest shadow-lg mb-3">
              HAMMER FALLS • OFFICIALLY SOLD!
            </div>

            <h2 className="text-3xl sm:text-5xl font-black uppercase text-white tracking-tight mb-2">
              {lastSoldData.playerName}
            </h2>

            <div className="text-xs text-slate-400 uppercase tracking-widest mb-6">
              SOLD TO
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-700 inline-flex items-center gap-3 mb-6">
              {lastSoldData.teamLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={lastSoldData.teamLogo} alt={lastSoldData.teamName} className="w-10 h-10 rounded-xl object-cover" />
              ) : (
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-slate-950"
                  style={{ backgroundColor: lastSoldData.teamColor }}
                >
                  TM
                </div>
              )}
              <span className="text-xl sm:text-2xl font-black uppercase text-white">
                {lastSoldData.teamName}
              </span>
            </div>

            <div className="text-4xl sm:text-6xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-400 drop-shadow-[0_0_30px_rgba(245,158,11,0.6)]">
              ₹ {lastSoldData.amount.toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      )}

      {/* UNSOLD CELEBRATION MODAL */}
      {showUnsoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl animate-in zoom-in-95 duration-200">
          <div className="max-w-md w-full bg-[#080d1a] border-4 border-rose-500 rounded-3xl p-8 text-center shadow-[0_0_100px_rgba(244,63,94,0.6)]">
            <div className="w-20 h-20 rounded-3xl bg-rose-500/20 border-2 border-rose-500 text-rose-500 flex items-center justify-center mx-auto mb-4 shadow-xl">
              <ShieldAlert className="w-12 h-12 stroke-[2.5]" />
            </div>

            <div className="inline-block px-5 py-1.5 rounded-full bg-rose-500 text-white font-black text-xs uppercase tracking-widest shadow-lg mb-3">
              AUCTION RESULT
            </div>

            <h2 className="text-3xl sm:text-4xl font-black uppercase text-white tracking-tight mb-2">
              PLAYER UNSOLD
            </h2>
            <p className="text-xs text-slate-400">
              Returning to draft pool for accelerated round.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
