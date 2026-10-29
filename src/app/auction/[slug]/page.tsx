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
  RotateCw,
  Target,
  Sparkles,
  Gavel,
  ShieldAlert,
  Coins,
  CheckCircle2,
  Clock,
  Zap,
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
  const [secondsLeft, setSecondsLeft] = useState(10);
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
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleIncomingState = (newState: FullAuctionState) => {
    setState((prevState) => {
      // 1. Check for new higher bid -> Play chime
      if (
        prevState &&
        newState.room.currentBid > prevBidAmountRef.current &&
        newState.room.currentBiddingTeamId
      ) {
        auctionAudio.playBidChime();
        setSecondsLeft(10);
      }
      prevBidAmountRef.current = newState.room.currentBid;

      // 2. Check for action changes (SOLD / UNSOLD)
      const currentActionKey = `${newState.room.lastAction}_${newState.room.lastActionTimestamp}`;
      if (prevActionRef.current !== currentActionKey) {
        prevActionRef.current = currentActionKey;

        if (newState.room.lastAction === 'SOLD' && newState.currentBiddingTeam) {
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

          // Confetti explosion
          try {
            confetti({
              particleCount: 150,
              spread: 100,
              origin: { y: 0.6 },
              colors: [winningTeam.color || '#f59e0b', '#10e87b', '#38bdf8', '#ffffff'],
            });
          } catch (err) {}

          setTimeout(() => setShowSoldModal(false), 5000);
        } else if (newState.room.lastAction === 'UNSOLD') {
          setShowUnsoldModal(true);
          setShowSoldModal(false);
          auctionAudio.playUnsoldBuzzer();
          setTimeout(() => setShowUnsoldModal(false), 3500);
        } else if (newState.room.lastAction === 'NEXT' || newState.room.lastAction === 'RESET') {
          setShowSoldModal(false);
          setShowUnsoldModal(false);
          setSecondsLeft(10);
        }
      }

      return newState;
    });
  };

  // Initial load & Polling fallback (reduced frequency to prevent serverless function quota drain)
  useEffect(() => {
    fetchState();
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchState();
      }
    }, 7000);
    return () => clearInterval(interval);
  }, [slug]);

  // Supabase Realtime broadcast listener for sub-50ms sync
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
    };
  }, [slug]);

  // Local Countdown Timer
  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    if (state?.room.status === 'ACTIVE' && state.room.timerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            return 0;
          }
          const next = prev - 1;
          if (next <= 3 && next > 0) {
            auctionAudio.playCountdownTick(next);
          }
          return next;
        });
      }, 1000);
    }

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [state?.room.status, state?.room.timerRunning, state?.room.lastActionTimestamp]);

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
      <div className="min-h-screen bg-[#050811] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_30px_rgba(245,158,11,0.5)]"></div>
        <h2 className="text-xl font-black uppercase tracking-widest text-amber-400">
          Connecting to CricBid Live Auction Broadcast...
        </h2>
        <p className="text-xs text-slate-400 mt-2 font-mono">Initializing 4K Projector Engine</p>
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

  // Timer label
  let timerStatusLabel = 'BID OPEN • ACCEPTING BIDS';
  let timerBadgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
  if (secondsLeft <= 3 && secondsLeft > 0) {
    timerStatusLabel = 'FAIR WARNING! FINAL CALL!';
    timerBadgeColor = 'text-rose-400 bg-rose-500/20 border-rose-500/50 animate-pulse';
  } else if (secondsLeft <= 6 && secondsLeft > 3) {
    timerStatusLabel = 'GOING TWICE...';
    timerBadgeColor = 'text-amber-400 bg-amber-500/15 border-amber-500/40';
  } else if (secondsLeft <= 8) {
    timerStatusLabel = 'GOING ONCE...';
  }

  return (
    <div className="min-h-screen bg-radial from-[#0d162e] via-[#080d1c] to-[#04060d] text-white flex flex-col justify-between overflow-x-hidden selection:bg-amber-400 selection:text-slate-950 font-sans relative">
      
      {/* Stadium Ambient Floodlight Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/4 right-0 w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[160px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-[600px] h-96 bg-emerald-500/10 rounded-full blur-[180px] pointer-events-none" />

      {/* TOP BROADCAST BAR */}
      <header className="relative z-20 flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 animate-ping"></span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-black tracking-widest uppercase">
              <Radio className="w-3.5 h-3.5" /> LIVE AUCTION
            </div>
          </div>
          <h1 className="text-lg sm:text-2xl font-black uppercase tracking-tight text-white drop-shadow">
            {currentPlayer?.tournamentTitle || 'CricBid Mega Player Auction 2026'}
          </h1>
        </div>

        {/* Status Pills & Controls */}
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
              room.status === 'ACTIVE'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                : room.status === 'PAUSED'
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
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
            title="Toggle Fullscreen (1080p/4K)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* MAIN BROADCAST ARENA */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 sm:p-8 items-center max-w-[1920px] mx-auto w-full">
        
        {/* CENTER STAGE: ACTIVE PLAYER SPOTLIGHT (7 Cols) */}
        <div className="lg:col-span-8 flex flex-col justify-between h-full bg-[#080d1a]/85 backdrop-blur-xl rounded-3xl border border-amber-500/30 p-6 sm:p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)] relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {currentPlayer ? (
            <div>
              {/* Header: Ticket & Role */}
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800/90">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                    {currentPlayer.role}
                  </span>
                  <span className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 font-mono text-xs font-bold">
                    {currentPlayer.registrationId}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-black uppercase text-amber-300">
                  <Coins className="w-4 h-4 text-amber-400" />
                  <span>Base Price: ₹ {room.basePrice.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Player Showcase: Photo & Identity */}
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6 sm:gap-8 mb-6">
                
                {/* 4K Player Portrait with Gold Lighting */}
                <div className="relative shrink-0">
                  <div className="w-44 h-44 sm:w-56 sm:h-56 rounded-3xl p-[4px] bg-gradient-to-tr from-amber-400 via-yellow-300 to-emerald-400 shadow-[0_0_35px_rgba(245,158,11,0.35)]">
                    <div className="w-full h-full rounded-[22px] bg-slate-950 overflow-hidden flex items-center justify-center relative">
                      {currentPlayer.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={currentPlayer.photoUrl}
                          alt={currentPlayer.fullName}
                          className="w-full h-full object-cover object-top"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/80 flex items-center justify-center font-black text-amber-400 text-4xl sm:text-5xl tracking-widest">
                          {getInitials(currentPlayer.fullName)}
                        </div>
                      )}
                    </div>
                  </div>

                  <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-slate-950 border border-amber-400 text-[10px] font-black uppercase tracking-wider text-amber-400 shadow-xl whitespace-nowrap">
                    OFFICIAL DRAFT ENTRY
                  </span>
                </div>

                {/* Name, Age, & Specs */}
                <div className="flex-1 text-center md:text-left min-w-0">
                  <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white drop-shadow-md leading-none mb-3">
                    {currentPlayer.fullName}
                  </h2>

                  <p className="text-sm sm:text-base text-slate-300 font-semibold mb-4">
                    Age: <span className="text-amber-400 font-bold">{currentPlayer.age} YRS</span>
                  </p>

                  {/* Tactical Attributes */}
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 mb-5">
                    <span className="px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Swords className="w-3.5 h-3.5" /> {currentPlayer.battingStyle}
                    </span>

                    {!isPureBatsman && currentPlayer.bowlingStyle && currentPlayer.bowlingStyle !== 'None' && (
                      <span className="px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5" /> {currentPlayer.bowlingStyle}
                      </span>
                    )}
                  </div>

                  {/* Stats Tag */}
                  {currentPlayer.stats && currentPlayer.stats !== 'No previous achievements provided' && (
                    <div className="bg-slate-950/70 rounded-2xl p-3.5 border border-slate-800/80 text-xs sm:text-sm text-slate-300 italic max-w-xl">
                      &ldquo;{currentPlayer.stats}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              {/* LIVE BIDDING STAGE & 10-SECOND COUNTDOWN */}
              <div className="mt-8 pt-6 border-t border-slate-800/80 bg-slate-950/60 rounded-2xl p-6 border border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                  
                  {/* Huge Current Bid Counter */}
                  <div className="md:col-span-6 text-center md:text-left">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-400 block mb-1">
                      CURRENT HIGHEST BID
                    </span>
                    <div className="text-4xl sm:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-200 drop-shadow-[0_0_25px_rgba(245,158,11,0.4)]">
                      ₹ {room.currentBid.toLocaleString('en-IN')}
                    </div>
                  </div>

                  {/* Leading Team Banner */}
                  <div className="md:col-span-6 flex flex-col items-center md:items-end justify-center">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                      HOLDING TEAM BID
                    </span>

                    {currentBiddingTeam ? (
                      <div className="flex items-center gap-3 bg-gradient-to-r from-slate-900 to-slate-950 p-2.5 px-4 rounded-2xl border border-amber-400/50 shadow-[0_0_20px_rgba(245,158,11,0.25)] animate-pulse">
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
                            {currentBiddingTeam.shortName}
                          </div>
                        )}
                        <div className="text-left">
                          <h4 className="text-base font-black uppercase text-white tracking-wide">
                            {currentBiddingTeam.name}
                          </h4>
                          <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                            HIGHEST BIDDER
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs font-bold text-slate-400 bg-slate-900/80 px-4 py-2 rounded-xl border border-slate-800">
                        Awaiting Opening Bid ({room.status === 'ACTIVE' ? 'Ready' : 'Paused'})
                      </div>
                    )}
                  </div>
                </div>

                {/* 10-Second Visual Progress Bar */}
                <div className="mt-5">
                  <div className="flex items-center justify-between text-xs font-black uppercase mb-1.5">
                    <span className={`px-2.5 py-0.5 rounded-full border text-[11px] font-black tracking-wider ${timerBadgeColor}`}>
                      {timerStatusLabel}
                    </span>
                    <span className="font-mono text-sm font-black text-amber-400">
                      {secondsLeft}s
                    </span>
                  </div>
                  <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                        secondsLeft <= 3
                          ? 'bg-gradient-to-r from-rose-500 to-red-600 shadow-[0_0_15px_rgba(244,63,94,0.7)]'
                          : secondsLeft <= 6
                          ? 'bg-gradient-to-r from-amber-400 to-yellow-400'
                          : 'bg-gradient-to-r from-emerald-400 to-teal-400'
                      }`}
                      style={{ width: `${Math.max(0, (secondsLeft / 10) * 100)}%` }}
                    />
                  </div>
                </div>

              </div>
            </div>
          ) : (
            <div className="text-center py-20">
              <Trophy className="w-16 h-16 text-slate-600 mx-auto mb-3 animate-pulse" />
              <h3 className="text-2xl font-black uppercase text-slate-300">
                Auction Waiting Room
              </h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
                The auctioneer will load the next player from the verified draft pool shortly.
              </p>
            </div>
          )}
        </div>

        {/* RIGHT SIDEBAR: TEAM PURSE TRACKER (4 Cols) */}
        <div className="lg:col-span-4 h-full flex flex-col justify-between bg-[#080d1a]/85 backdrop-blur-xl rounded-3xl border border-slate-800 p-6 shadow-2xl">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Coins className="w-4 h-4" /> Team Purse Budget
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                {teams.length} Franchises
              </span>
            </div>

            {/* Teams List */}
            <div className="space-y-3 overflow-y-auto max-h-[520px] pr-1 scrollbar-thin">
              {teams.map((t) => {
                const isLeading = currentBiddingTeam?.id === t.id;
                return (
                  <div
                    key={t.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between ${
                      isLeading
                        ? 'border-amber-400 bg-amber-400/10 shadow-[0_0_20px_rgba(245,158,11,0.25)] scale-[1.02]'
                        : 'border-slate-800/90 bg-slate-950/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {t.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.logoUrl}
                          alt={t.name}
                          className="w-10 h-10 rounded-xl object-cover bg-slate-900 border border-slate-800 shrink-0"
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs text-slate-950 shrink-0"
                          style={{ backgroundColor: t.color || '#f59e0b' }}
                        >
                          {t.shortName}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-black text-white uppercase truncate">
                          {t.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          Squad: <strong className="text-slate-200">{t.boughtPlayersCount}</strong>/{t.maxPlayers}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs sm:text-sm font-black text-amber-400 font-mono block">
                        ₹ {t.remainingPurse.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[9px] text-slate-500 uppercase font-bold">
                        Remaining
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </main>

      {/* BOTTOM TICKER: SOLD & TRADE FEED */}
      <footer className="relative z-20 border-t border-slate-800 bg-slate-950/90 py-3 px-6 overflow-hidden">
        <div className="flex items-center gap-4">
          <span className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-black uppercase tracking-wider shrink-0 shadow">
            AUCTION TICKER
          </span>

          <div className="flex-1 overflow-hidden whitespace-nowrap">
            {soldHistory.length > 0 ? (
              <div className="inline-block animate-marquee space-x-8 text-xs font-semibold text-slate-300">
                {soldHistory.map((s, idx) => (
                  <span key={idx} className="inline-flex items-center gap-2">
                    <span className="text-white font-black uppercase">{s.player.fullName}</span>
                    <span className="text-emerald-400 font-mono font-bold">₹ {s.soldPrice.toLocaleString('en-IN')}</span>
                    <span className="text-slate-500">to</span>
                    <span className="text-amber-400 font-black uppercase">{s.team.name}</span>
                    <span className="text-slate-700">•</span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-500 italic">
                Awaiting first player sale in the auction draft...
              </span>
            )}
          </div>
        </div>
      </footer>

      {/* SOLD / CELEBRATION MODAL OVERLAY */}
      {showSoldModal && lastSoldData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in zoom-in-95 duration-200">
          <div className="relative w-full max-w-2xl bg-gradient-to-b from-[#0a1226] to-[#040814] rounded-3xl border-2 border-emerald-400 p-8 text-center shadow-[0_0_100px_rgba(16,232,123,0.5)] overflow-hidden">
            
            {/* 3D Gavel Hammer Animation */}
            <div className="w-20 h-20 mx-auto mb-4 bg-emerald-500/20 border-2 border-emerald-400 rounded-3xl flex items-center justify-center text-emerald-400 shadow-[0_0_30px_rgba(16,232,123,0.6)] animate-bounce">
              <Gavel className="w-10 h-10 stroke-[2.5]" />
            </div>

            {/* Huge Rubber Stamp SOLD */}
            <div className="inline-block px-8 py-2 rounded-2xl bg-emerald-500 text-slate-950 font-black text-4xl sm:text-6xl uppercase tracking-widest shadow-[0_0_50px_rgba(16,232,123,0.8)] transform -rotate-2 mb-4">
              SOLD!
            </div>

            <h2 className="text-2xl sm:text-4xl font-black uppercase text-white tracking-tight mb-2">
              {lastSoldData.playerName}
            </h2>

            <p className="text-base text-slate-300 font-medium mb-5">
              Acquired for{' '}
              <strong className="text-emerald-400 font-mono text-2xl font-black">
                ₹ {lastSoldData.amount.toLocaleString('en-IN')}
              </strong>
            </p>

            {/* Team Banner */}
            <div className="inline-flex items-center gap-3 bg-slate-900 border border-slate-700 px-6 py-3 rounded-2xl shadow-xl">
              {lastSoldData.teamLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={lastSoldData.teamLogo}
                  alt={lastSoldData.teamName}
                  className="w-10 h-10 rounded-xl object-cover bg-slate-800"
                />
              )}
              <div className="text-left">
                <span className="text-[10px] text-slate-400 uppercase font-black tracking-wider block">
                  WINNING FRANCHISE
                </span>
                <span className="text-base sm:text-lg font-black text-amber-400 uppercase">
                  {lastSoldData.teamName}
                </span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* UNSOLD MODAL OVERLAY */}
      {showUnsoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in zoom-in-95 duration-200">
          <div className="relative w-full max-w-lg bg-[#140608] rounded-3xl border-2 border-rose-500 p-8 text-center shadow-[0_0_80px_rgba(244,63,94,0.5)]">
            <div className="inline-block px-8 py-2 rounded-2xl bg-rose-600 text-white font-black text-4xl sm:text-5xl uppercase tracking-widest shadow-2xl transform rotate-1 mb-4">
              UNSOLD
            </div>
            <h3 className="text-xl font-black uppercase text-white tracking-tight mb-1">
              {currentPlayer?.fullName || 'Player'}
            </h3>
            <p className="text-xs text-rose-300 font-bold">
              Player will re-enter the acceleration round later.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
