'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Coins,
  ShieldCheck,
  Swords,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Lock,
  LogOut,
  Zap,
  Clock,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import { FullAuctionState, TournamentTeam } from '@/lib/auctionTypes';
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

export default function MobileBiddingPage() {
  const params = useParams();
  const slug = params?.slug as string;

  // Team authentication state
  const [currentTeam, setCurrentTeam] = useState<TournamentTeam | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Auction State
  const [state, setState] = useState<FullAuctionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [biddingLoading, setBiddingLoading] = useState(false);
  const [bidError, setBidError] = useState('');
  const [showMySquadModal, setShowMySquadModal] = useState(false);

  // Check persisted team session
  useEffect(() => {
    if (!slug) return;
    try {
      const stored = localStorage.getItem(`cricbid_team_session_${slug}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.id) {
          setCurrentTeam(parsed);
        }
      }
    } catch (e) {}
  }, [slug]);

  const fetchState = async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/auction/${slug}?view=bid&t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.state) {
          setState((prev) => mergeStateSafe(prev, json.state));
          // Sync current team purse
          if (currentTeam) {
            const updated = json.state.teams?.find((t: TournamentTeam) => t.id === currentTeam.id);
            if (updated) {
              setCurrentTeam(updated);
              localStorage.setItem(`cricbid_team_session_${slug}`, JSON.stringify(updated));
            }
          }
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
  }, [slug, currentTeam?.id]);

  // Realtime Supabase listener (instant state update in <50ms without round-trip HTTP)
  useEffect(() => {
    if (!slug) return;
    const channel = supabase.channel(`auction_${slug.toLowerCase()}`);
    channel.on('broadcast', { event: '*' }, (msg: any) => {
      if (msg?.payload?.state) {
        setState((prev) => mergeStateSafe(prev, msg.payload.state));

        if (currentTeam) {
          const updated = msg.payload.state.teams?.find((t: TournamentTeam) => t.id === currentTeam.id);
          if (updated) {
            setCurrentTeam(updated);
            try {
              localStorage.setItem(`cricbid_team_session_${slug}`, JSON.stringify(updated));
            } catch (e) {}
          }
        }
      } else {
        fetchState();
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug, currentTeam?.id]);

  // Login handler
  const handleTeamLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeamId || !pinInput) {
      setLoginError('Please select your team and enter your 4-digit PIN');
      return;
    }

    try {
      setLoginLoading(true);
      setLoginError('');
      const res = await fetch(`/api/auction/${slug}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeamId,
          secretPin: pinInput,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setLoginError(json.error || 'Authentication failed');
      } else if (json.team) {
        setCurrentTeam(json.team);
        localStorage.setItem(`cricbid_team_session_${slug}`, JSON.stringify(json.team));
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login error');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentTeam(null);
    try {
      localStorage.removeItem(`cricbid_team_session_${slug}`);
    } catch (e) {}
  };

  // Place Bid with Haptic Feedback and instant optimistic update
  const handlePlaceBid = async (amount: number) => {
    if (!slug || !currentTeam) return;

    // Haptic vibration feedback
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(60);
    }

    // Instant optimistic feedback in 0ms!
    const now = Date.now();
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        room: {
          ...prev.room,
          currentBid: amount,
          currentBiddingTeamId: currentTeam.id,
          timerSeconds: 10,
          timerRunning: true,
          lastAction: 'NEW_BID',
          lastActionTimestamp: now,
        },
        currentBiddingTeam: currentTeam,
      };
    });

    try {
      setBiddingLoading(true);
      setBidError('');
      const res = await fetch(`/api/auction/${slug}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: currentTeam.id,
          amount,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setBidError(json.error || 'Bid rejected');
        fetchState();
      } else if (json.state) {
        setState((prev) => mergeStateSafe(prev, json.state));
      }
    } catch (e: any) {
      setBidError(e.message || 'Bidding error');
      fetchState();
    } finally {
      setBiddingLoading(false);
    }
  };

  const { room, currentPlayer, currentBiddingTeam, teams, soldHistory = [], playersQueue = [] } = state || {
    room: { status: 'WAITING', currentBid: 0, basePrice: 1000, bidIncrement: 500 },
    currentPlayer: null,
    currentBiddingTeam: null,
    teams: [],
    soldHistory: [],
    playersQueue: [],
  };

  const mySquad = currentTeam
    ? (soldHistory || []).filter(
        (sh) =>
          sh.team.id === currentTeam.id ||
          (sh.team.name && currentTeam.name && sh.team.name.toLowerCase() === currentTeam.name.toLowerCase())
      )
    : [];
  const myTotalSpent = mySquad.reduce((sum, sp) => sum + (sp.soldPrice || 0), 0);

  // LOGIN SCREEN
  if (!currentTeam) {
    return (
      <div className="min-h-screen bg-[#070b16] text-white flex items-center justify-center p-4 font-sans">
        <form
          onSubmit={handleTeamLogin}
          className="w-full max-w-sm bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-2xl text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 mx-auto mb-3 shadow-lg">
            <Coins className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-black uppercase text-white tracking-wide">
            Team Owner Portal
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 mb-5">
            Select your franchise and enter your 4-digit PIN to bid live
          </p>

          {/* Team Dropdown */}
          <div className="mb-3 text-left">
            <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
              Select Franchise
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-bold focus:outline-none focus:border-amber-400"
            >
              <option value="">-- Choose Your Team --</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} (Purse: ₹{t.remainingPurse.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
          </div>

          {/* 4-Digit PIN */}
          <div className="mb-4 text-left">
            <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
              4-Digit Team PIN
            </label>
            <input
              type="password"
              placeholder="e.g. 1111"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-center font-mono text-lg text-white tracking-widest focus:outline-none focus:border-amber-400"
            />
          </div>

          {loginError && <p className="text-xs text-rose-400 font-bold mb-3">{loginError}</p>}

          <button
            type="submit"
            disabled={loginLoading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
          >
            {loginLoading ? 'Verifying PIN...' : 'Enter Auction Arena'}
          </button>
        </form>
      </div>
    );
  }

  // Calculate Next Bid Amount
  const currentBid = room.currentBid || room.basePrice || 1000;
  const bidStep = room.bidIncrement || 500;
  const nextMinBid = room.currentBiddingTeamId ? currentBid + bidStep : currentBid;

  const isLeadingBidder = currentBiddingTeam?.id === currentTeam.id;
  const hasEnoughPurse = currentTeam.remainingPurse >= nextMinBid;
  const isSquadFull = currentTeam.boughtPlayersCount >= currentTeam.maxPlayers;
  const isAuctionActive = room.status === 'ACTIVE';

  return (
    <div className="min-h-screen bg-[#070b16] text-white flex flex-col justify-between font-sans selection:bg-amber-400 selection:text-slate-950">
      
      {/* TOP STICKY BAR: FRANCHISE IDENTITY & PURSE */}
      <header className="sticky top-0 z-30 px-4 py-3 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {currentTeam.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentTeam.logoUrl} alt={currentTeam.name} className="w-10 h-10 rounded-xl object-cover bg-slate-900 border border-slate-800" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-xs">
              {currentTeam.shortName}
            </div>
          )}
          <div>
            <h2 className="text-sm font-black uppercase text-white truncate max-w-[140px] sm:max-w-xs">
              {currentTeam.name}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[10px] text-slate-400 font-mono">
                Squad: <strong className="text-emerald-400">{mySquad.length}</strong>/{currentTeam.maxPlayers}
              </span>
              <button
                type="button"
                onClick={() => setShowMySquadModal(true)}
                className="px-1.5 py-0.5 rounded bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 font-black text-[9px] uppercase border border-amber-400/30 flex items-center gap-1 shadow-sm"
              >
                <Users className="w-2.5 h-2.5" />
                <span>Squad ({mySquad.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Dynamic Remaining Purse Display */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[9px] uppercase font-black text-slate-400 tracking-wider block">
              PURSE BALANCE
            </span>
            <span className="text-sm sm:text-base font-black text-amber-400 font-mono">
              ₹ {currentTeam.remainingPurse.toLocaleString('en-IN')}
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400"
            title="Log out team"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN BIDDING ARENA */}
      <main className="flex-1 p-4 max-w-md mx-auto w-full flex flex-col justify-between">
        
        {/* ACTIVE PLAYER CARD */}
        {currentPlayer ? (
          <div className="bg-slate-900/90 rounded-3xl border border-slate-800 p-4 sm:p-5 shadow-xl relative overflow-hidden mb-4">
            
            <div className="flex items-center gap-4 mb-3">
              <div className="w-20 h-20 rounded-2xl p-[2px] bg-gradient-to-tr from-amber-400 to-emerald-400 shrink-0">
                <div className="w-full h-full rounded-[14px] bg-slate-950 overflow-hidden flex items-center justify-center relative">
                  {currentPlayer.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentPlayer.photoUrl}
                      alt={currentPlayer.fullName}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        const parent = (e.target as HTMLElement).parentElement;
                        if (parent) {
                          const fallback = parent.querySelector('.bid-initials-badge');
                          if (fallback) (fallback as HTMLElement).style.display = 'flex';
                        }
                      }}
                    />
                  ) : null}
                  <span
                    className="bid-initials-badge font-black text-amber-400 text-xl flex items-center justify-center w-full h-full"
                    style={{ display: currentPlayer.photoUrl ? 'none' : 'flex' }}
                  >
                    {getInitials(currentPlayer.fullName)}
                  </span>
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-400 text-slate-950">
                  {currentPlayer.role}
                </span>
                <h3 className="text-lg font-black uppercase text-white truncate mt-1">
                  {currentPlayer.fullName}
                </h3>
                <p className="text-xs text-slate-400">
                  {currentPlayer.age} yrs • {currentPlayer.battingStyle}
                  {currentPlayer.role !== 'Pure Batsman' && currentPlayer.bowlingStyle && currentPlayer.bowlingStyle !== 'None' ? ` • ${currentPlayer.bowlingStyle}` : ''}
                </p>
                <span className="text-[11px] text-amber-300 font-mono font-bold block mt-0.5">
                  Base Price: ₹ {room.basePrice.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {/* STAGE BID & LEADING STATUS OR SOLD BANNER */}
            {room.lastAction === 'SOLD' && currentBiddingTeam ? (
              <div className="bg-gradient-to-b from-emerald-950/90 via-slate-950 to-emerald-950/90 p-5 rounded-2xl border-2 border-emerald-500 text-center mb-4 shadow-2xl animate-in zoom-in-95">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 block mb-1">
                  🎉 AUCTION CLOSED - SOLD!
                </span>
                <div className="text-4xl font-black text-emerald-400 font-mono">
                  ₹ {currentBid.toLocaleString('en-IN')}
                </div>
                <div className="mt-3 pt-3 border-t border-emerald-500/30">
                  {currentBiddingTeam.id === currentTeam.id ? (
                    <div className="py-2 px-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow">
                      <CheckCircle2 className="w-4 h-4" />
                      CONGRATULATIONS! YOUR FRANCHISE BOUGHT THIS PLAYER!
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-slate-300">
                      Sold to <strong className="text-white uppercase">{currentBiddingTeam.name}</strong>
                    </span>
                  )}
                </div>
              </div>
            ) : room.lastAction === 'UNSOLD' ? (
              <div className="bg-gradient-to-b from-rose-950/80 via-slate-950 to-rose-950/80 p-5 rounded-2xl border-2 border-rose-500 text-center mb-4 shadow-2xl animate-in zoom-in-95">
                <span className="text-xs font-black uppercase tracking-widest text-rose-400 block mb-1">
                  ⚠️ AUCTION RESULT
                </span>
                <div className="text-3xl font-black text-rose-400 font-mono tracking-wider">
                  PLAYER UNSOLD
                </div>
                <p className="text-xs text-slate-400 mt-2">Returned to draft pool</p>
              </div>
            ) : (
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/90 text-center">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                  CURRENT STAGE BID
                </span>
                <div key={currentBid} className="text-4xl font-black text-amber-400 font-mono tracking-tight animate-in zoom-in-95">
                  ₹ {currentBid.toLocaleString('en-IN')}
                </div>

                {/* Status Banner */}
                <div className="mt-3">
                  {isLeadingBidder ? (
                    <div className="py-1.5 px-3 rounded-xl bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 animate-pulse">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>YOU ARE THE HIGHEST BIDDER!</span>
                    </div>
                  ) : currentBiddingTeam ? (
                    <div className="py-1.5 px-3 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <span>Outbid by {currentBiddingTeam.name}</span>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">Awaiting opening bid</div>
                  )}
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="py-20 text-center text-slate-500 bg-slate-900/60 rounded-3xl p-6 border border-slate-800">
            <User className="w-12 h-12 mx-auto mb-2 opacity-40 animate-pulse" />
            <h3 className="text-lg font-black uppercase text-slate-300">Awaiting Next Player</h3>
            <p className="text-xs text-slate-500 mt-1">Please hold on, auctioneer is preparing the next draft.</p>
          </div>
        )}

        {/* BOTTOM GIANT BIDDING BUTTONS */}
        <div className="space-y-3 pb-4">
          
          {bidError && (
            <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-bold text-center">
              {bidError}
            </div>
          )}

          {/* Quick Increment Row */}
          <div className="grid grid-cols-3 gap-2">
            {[500, 1000, 2000].map((inc) => {
              const targetAmount = currentBid + inc;
              const canAfford = currentTeam.remainingPurse >= targetAmount;
              return (
                <button
                  key={inc}
                  type="button"
                  onClick={() => handlePlaceBid(targetAmount)}
                  disabled={biddingLoading || !isAuctionActive || !canAfford || isSquadFull || room.lastAction === 'SOLD' || room.lastAction === 'UNSOLD'}
                  className="py-2.5 px-1 rounded-xl bg-slate-900 border border-slate-700 text-center text-xs font-black text-amber-400 hover:border-amber-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  +₹{inc.toLocaleString('en-IN')}
                </button>
              );
            })}
          </div>

          {/* MAIN GIANT BID ACTION */}
          <button
            type="button"
            onClick={() => handlePlaceBid(nextMinBid)}
            disabled={
              biddingLoading ||
              !isAuctionActive ||
              !hasEnoughPurse ||
              isSquadFull ||
              isLeadingBidder ||
              !currentPlayer ||
              room.lastAction === 'SOLD' ||
              room.lastAction === 'UNSOLD'
            }
            className={`w-full py-5 rounded-2xl font-black text-lg uppercase tracking-wider shadow-2xl flex items-center justify-center gap-3 transition-all transform active:scale-95 ${
              isLeadingBidder
                ? 'bg-emerald-600 text-white cursor-default opacity-90'
                : !hasEnoughPurse
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : isSquadFull
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : !isAuctionActive
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.5)]'
            }`}
          >
            {biddingLoading ? (
              <span>Submitting Bid...</span>
            ) : isLeadingBidder ? (
              <>
                <CheckCircle2 className="w-6 h-6 text-white" />
                <span>You Hold Leading Bid</span>
              </>
            ) : !hasEnoughPurse ? (
              <span>Insufficient Purse Budget</span>
            ) : isSquadFull ? (
              <span>Squad Limit Reached ({currentTeam.maxPlayers})</span>
            ) : !isAuctionActive ? (
              <span>Auction Currently Paused</span>
            ) : (
              <>
                <Zap className="w-6 h-6 fill-slate-950" />
                <span>RAISE BID TO ₹ {nextMinBid.toLocaleString('en-IN')}</span>
              </>
            )}
          </button>

          <p className="text-[10px] text-slate-500 text-center font-mono">
            Tapping button transmits bid atomically via Supabase Realtime
          </p>
        </div>

      </main>

      {/* MY SQUAD MODAL */}
      {showMySquadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-black uppercase text-white">
                    {currentTeam.name} Squad
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {mySquad.length} / {currentTeam.maxPlayers} Players • Total Spent: ₹{myTotalSpent.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setShowMySquadModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {mySquad.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs font-bold">No players bought yet</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    When your team wins a bid in the live auction, players will be listed here.
                  </p>
                </div>
              ) : (
                mySquad.map((record, idx) => {
                  const p = record.player;
                  const photo =
                    p.photoUrl ||
                    playersQueue.find((pq) => pq.player?.registrationId === p.registrationId)?.player?.photoUrl;
                  return (
                    <div
                      key={idx}
                      className="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                          {photo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photo} alt={p.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-black text-amber-400">
                              {getInitials(p.fullName)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black uppercase text-white truncate">
                            {p.fullName}
                          </h4>
                          <span className="text-[9px] font-bold text-amber-400 uppercase bg-amber-400/10 px-1.5 py-0.2 rounded mt-0.5 inline-block">
                            {p.role}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black font-mono text-emerald-400 block">
                          ₹{record.soldPrice.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[8px] font-bold uppercase text-emerald-500 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                          BOUGHT
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400">Purse Remaining:</span>
              <span className="font-mono font-black text-amber-300">
                ₹{currentTeam.remainingPurse.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
