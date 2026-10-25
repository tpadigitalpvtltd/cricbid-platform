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
      const res = await fetch(`/api/auction/${slug}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.state) {
          setState(json.state);
          // Sync current team purse
          if (currentTeam) {
            const updated = json.state.teams.find((t: TournamentTeam) => t.id === currentTeam.id);
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
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [slug, currentTeam?.id]);

  // Realtime Supabase listener
  useEffect(() => {
    if (!slug) return;
    const channel = supabase.channel(`auction_${slug.toLowerCase()}`);
    channel.on('broadcast', { event: '*' }, () => fetchState()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug]);

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

  // Place Bid with Haptic Feedback
  const handlePlaceBid = async (amount: number) => {
    if (!slug || !currentTeam) return;

    // Haptic vibration feedback
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(60);
    }

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
      } else if (json.state) {
        setState(json.state);
      }
    } catch (e: any) {
      setBidError(e.message || 'Bidding error');
    } finally {
      setBiddingLoading(false);
    }
  };

  const { room, currentPlayer, currentBiddingTeam, teams } = state || {
    room: { status: 'WAITING', currentBid: 0, basePrice: 1000, bidIncrement: 500 },
    currentPlayer: null,
    currentBiddingTeam: null,
    teams: [],
  };

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
            <span className="text-[10px] text-slate-400 font-mono">
              Squad: <strong className="text-emerald-400">{currentTeam.boughtPlayersCount}</strong>/{currentTeam.maxPlayers}
            </span>
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
                <div className="w-full h-full rounded-[14px] bg-slate-950 overflow-hidden flex items-center justify-center">
                  {currentPlayer.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={currentPlayer.photoUrl} alt={currentPlayer.fullName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-black text-amber-400 text-xl">{getInitials(currentPlayer.fullName)}</span>
                  )}
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

            {/* STAGE BID & LEADING STATUS */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/90 text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                CURRENT STAGE BID
              </span>
              <div className="text-4xl font-black text-amber-400 font-mono tracking-tight">
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
                  disabled={biddingLoading || !isAuctionActive || !canAfford || isSquadFull}
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
              !currentPlayer
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

    </div>
  );
}
