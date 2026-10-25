'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Gavel,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  SkipBack,
  CheckCircle2,
  XCircle,
  Coins,
  ShieldCheck,
  Users,
  Search,
  Filter,
  Lock,
  Plus,
  RefreshCw,
  Sparkles,
  Award,
  ChevronRight,
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

export default function AuctioneerControllerPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [adminPin, setAdminPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState('');

  const [state, setState] = useState<FullAuctionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Filters
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SOLD' | 'UNSOLD'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Manual bid amount
  const [customBidAmount, setCustomBidAmount] = useState<number | ''>('');
  const [selectedTeamForBid, setSelectedTeamForBid] = useState<string>('');

  // Active view tab in controller
  const [activeTab, setActiveTab] = useState<'control' | 'players' | 'teams'>('control');

  // Check saved admin PIN in sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('cricbid_auction_pin');
      if (saved) {
        setAdminPin(saved);
        setIsAuthenticated(true);
      }
    } catch (e) {}
  }, []);

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPin.trim()) {
      setPinError('Please enter Admin PIN');
      return;
    }
    try {
      sessionStorage.setItem('cricbid_auction_pin', adminPin);
    } catch (e) {}
    setIsAuthenticated(true);
    setPinError('');
  };

  const fetchState = async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/auction/${slug}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.state) {
          setState(json.state);
        }
      }
    } catch (e) {
      console.error('Fetch controller state error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2500);
    return () => clearInterval(interval);
  }, [slug]);

  // Realtime subscription
  useEffect(() => {
    if (!slug) return;
    const channel = supabase.channel(`auction_${slug.toLowerCase()}`);
    channel.on('broadcast', { event: '*' }, () => fetchState()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug]);

  const executeAction = async (action: string, payload?: any) => {
    if (!slug) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/auction/${slug}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          payload,
          adminPin,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Failed to execute action');
        if (res.status === 401) {
          setIsAuthenticated(false);
          setPinError('Session expired. Please enter Admin PIN again.');
        }
      } else if (json.state) {
        setState(json.state);
      }
    } catch (e: any) {
      alert(e.message || 'Action error');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlaceFloorBid = async (teamId: string, amount: number) => {
    if (!slug || !teamId || !amount) return;
    try {
      setActionLoading(true);
      const res = await fetch(`/api/auction/${slug}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          amount,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        alert(json.error || 'Unable to place bid');
      } else if (json.state) {
        setState(json.state);
      }
    } catch (e: any) {
      alert(e.message || 'Error placing bid');
    } finally {
      setActionLoading(false);
    }
  };

  // If PIN authentication required
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#080d1a] text-white flex items-center justify-center p-4">
        <form
          onSubmit={handlePinSubmit}
          className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 mx-auto mb-4 shadow-lg">
            <Lock className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black uppercase text-white tracking-wide">
            Auctioneer Control Room
          </h2>
          <p className="text-xs text-slate-400 mt-1 mb-6">
            Enter Admin PIN to manage live bids, sold decisions, and player queue
          </p>

          <input
            type="password"
            placeholder="Enter Admin PIN"
            value={adminPin}
            onChange={(e) => setAdminPin(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-center text-lg font-mono text-white focus:outline-none focus:border-amber-400 mb-3"
            autoFocus
          />

          {pinError && <p className="text-xs text-rose-400 font-bold mb-3">{pinError}</p>}

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg hover:from-amber-300 hover:to-yellow-300"
          >
            Access Controller
          </button>
        </form>
      </div>
    );
  }

  const { room, currentPlayer, currentBiddingTeam, teams, playersQueue } = state || {
    room: { status: 'WAITING', currentBid: 0, basePrice: 1000 },
    currentPlayer: null,
    currentBiddingTeam: null,
    teams: [],
    playersQueue: [],
  };

  const currentBid = room.currentBid || room.basePrice || 1000;
  const quickIncrements = [100, 500, 1000, 2000, 5000];

  // Filtered queue
  const filteredPlayers = playersQueue.filter((pq) => {
    if (roleFilter !== 'All' && pq.player.role !== roleFilter) return false;
    if (statusFilter !== 'ALL' && pq.status !== statusFilter) return false;
    if (searchQuery.trim() && !pq.player.fullName.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-[#070b16] text-white flex flex-col font-sans">
      
      {/* CONTROLLER TOP NAVIGATION */}
      <header className="px-4 sm:px-6 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black">
            <Gavel className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black uppercase text-white">
              Auctioneer Desk
            </h1>
            <span className="text-[10px] text-slate-400 font-mono">
              Slug: {slug} • Status: <strong className="text-amber-400">{room.status}</strong>
            </span>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('control')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'control' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Bidding Desk
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'players' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Player Queue ({playersQueue.length})
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'teams' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Franchise PINs ({teams.length})
          </button>
        </div>

        {/* Master Room Controls */}
        <div className="flex items-center gap-2">
          {room.status === 'ACTIVE' ? (
            <button
              onClick={() => executeAction('PAUSE')}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5"
            >
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
          ) : (
            <button
              onClick={() => executeAction('RESUME')}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" /> Start / Resume
            </button>
          )}

          <button
            onClick={() => executeAction('RESET_TIMER')}
            disabled={actionLoading}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset (10s)
          </button>
        </div>
      </header>

      {/* TAB 1: MAIN BIDDING CONTROLLER DESK */}
      {activeTab === 'control' && (
        <div className="flex-1 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto w-full">
          
          {/* LEFT: ACTIVE PLAYER ON STAGE (6 Cols) */}
          <div className="lg:col-span-6 bg-slate-900/80 rounded-3xl border border-slate-800 p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Current Player on Block
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => executeAction('PREV_PLAYER')}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="Previous Player"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => executeAction('NEXT_PLAYER')}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                    title="Next Player"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {currentPlayer ? (
                <div className="flex items-center gap-5 mb-5">
                  <div className="w-24 h-24 rounded-2xl p-[2px] bg-gradient-to-tr from-amber-400 to-emerald-400 shrink-0">
                    <div className="w-full h-full rounded-[14px] bg-slate-950 overflow-hidden flex items-center justify-center">
                      {currentPlayer.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={currentPlayer.photoUrl}
                          alt={currentPlayer.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center font-black text-amber-400 text-xl">
                          {getInitials(currentPlayer.fullName)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                      {currentPlayer.role}
                    </span>
                    <h2 className="text-2xl font-black uppercase text-white mt-1">
                      {currentPlayer.fullName}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Age: {currentPlayer.age} yrs • {currentPlayer.battingStyle}
                      {currentPlayer.role !== 'Pure Batsman' && currentPlayer.bowlingStyle && currentPlayer.bowlingStyle !== 'None' ? ` • ${currentPlayer.bowlingStyle}` : ''}
                    </p>
                    <span className="text-xs text-amber-300 font-mono font-bold block mt-1">
                      Base Price: ₹ {room.basePrice.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No active player loaded</p>
                  <button
                    onClick={() => executeAction('NEXT_PLAYER')}
                    className="mt-3 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-black uppercase"
                  >
                    Load First Player
                  </button>
                </div>
              )}

              {/* CURRENT BID DISPLAY */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                      CURRENT STAGE BID
                    </span>
                    <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono">
                      ₹ {currentBid.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                      HOLDING TEAM
                    </span>
                    {currentBiddingTeam ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-black text-white uppercase">
                          {currentBiddingTeam.name}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500 italic block mt-1">No bids yet</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* BIG DECISION BUTTONS: MARK SOLD / UNSOLD */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
              <button
                onClick={() => executeAction('MARK_SOLD')}
                disabled={actionLoading || !currentBiddingTeam}
                className="py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                <span>MARK AS SOLD</span>
              </button>

              <button
                onClick={() => executeAction('MARK_UNSOLD')}
                disabled={actionLoading || !currentPlayer}
                className="py-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <XCircle className="w-5 h-5 stroke-[2.5]" />
                <span>MARK AS UNSOLD</span>
              </button>
            </div>
          </div>

          {/* RIGHT: FLOOR BIDDING CONTROLS & TEAMS GRID (6 Cols) */}
          <div className="lg:col-span-6 bg-slate-900/80 rounded-3xl border border-slate-800 p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Floor Bidder (Place Bid on Behalf of Floor)
                </span>
                <span className="text-[11px] text-slate-400">
                  Select Team then Increment
                </span>
              </div>

              {/* Team Selector Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
                {teams.map((t) => {
                  const isSelected = selectedTeamForBid === t.id;
                  const isLeading = currentBiddingTeam?.id === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTeamForBid(t.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'border-amber-400 bg-amber-400/20 text-white font-bold ring-2 ring-amber-400/40'
                          : isLeading
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase truncate">{t.shortName}</span>
                        {isLeading && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>}
                      </div>
                      <span className="text-[10px] text-amber-300 font-mono block">
                        ₹{t.remainingPurse.toLocaleString('en-IN')}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Quick Increment Buttons */}
              <div className="mb-4">
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-2">
                  Quick Bid Increments
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {quickIncrements.map((inc) => {
                    const nextVal = currentBid + inc;
                    return (
                      <button
                        key={inc}
                        type="button"
                        onClick={() => {
                          if (!selectedTeamForBid) {
                            alert('Please select a team first from above grid');
                            return;
                          }
                          handlePlaceFloorBid(selectedTeamForBid, nextVal);
                        }}
                        disabled={actionLoading || !selectedTeamForBid}
                        className="py-2.5 px-1 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-center text-xs font-black text-amber-400 disabled:opacity-40"
                      >
                        +₹{inc}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Bid Amount */}
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 mb-4">
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-1.5">
                  Custom Bid Amount
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder={`e.g. ${currentBid + 1000}`}
                    value={customBidAmount}
                    onChange={(e) => setCustomBidAmount(e.target.value ? Number(e.target.value) : '')}
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedTeamForBid) {
                        alert('Please select a team from the grid first');
                        return;
                      }
                      if (!customBidAmount || customBidAmount <= currentBid) {
                        alert(`Custom bid must be greater than ₹${currentBid}`);
                        return;
                      }
                      handlePlaceFloorBid(selectedTeamForBid, Number(customBidAmount));
                      setCustomBidAmount('');
                    }}
                    disabled={actionLoading || !selectedTeamForBid || !customBidAmount}
                    className="px-4 py-2 rounded-xl bg-amber-400 text-slate-950 font-black text-xs uppercase disabled:opacity-40"
                  >
                    Set Bid
                  </button>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 text-center italic">
              Floor bids instantly reflect across 4K Projector and Team Owner mobile screens.
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: PLAYER QUEUE MANAGEMENT */}
      {activeTab === 'players' && (
        <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
          <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6">
            
            {/* Search & Filter Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-black uppercase text-white">
                  Tournament Draft Pool ({filteredPlayers.length} Players)
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <input
                  type="text"
                  placeholder="Search player name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="SOLD">Sold</option>
                  <option value="UNSOLD">Unsold</option>
                </select>
              </div>
            </div>

            {/* Players Table / Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredPlayers.map(({ player, status, basePrice, soldPrice, soldTeamName }) => {
                const isCurrentlyActive = currentPlayer?.registrationId === player.registrationId;
                return (
                  <div
                    key={player.registrationId}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                      isCurrentlyActive
                        ? 'border-amber-400 bg-amber-400/15 ring-2 ring-amber-400/30'
                        : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                        {player.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={player.photoUrl} alt={player.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-black text-amber-400 text-xs">{getInitials(player.fullName)}</span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <span className="text-[9px] font-bold text-amber-400 uppercase block truncate">
                          {player.role}
                        </span>
                        <h4 className="text-xs font-black text-white uppercase truncate">
                          {player.fullName}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] font-mono mt-0.5">
                          <span
                            className={`px-1.5 py-0.2 rounded font-bold ${
                              status === 'SOLD'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : status === 'UNSOLD'
                                ? 'bg-rose-500/20 text-rose-400'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {status}
                          </span>
                          {status === 'SOLD' && soldPrice && (
                            <span className="text-slate-400">₹{soldPrice.toLocaleString('en-IN')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => executeAction('SET_PLAYER', { playerId: player.registrationId, basePrice })}
                      disabled={isCurrentlyActive || actionLoading}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-xs font-bold text-slate-300 transition-colors shrink-0 disabled:opacity-40"
                    >
                      {isCurrentlyActive ? 'On Block' : 'Load'}
                    </button>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: TEAMS & 4-DIGIT PINS */}
      {activeTab === 'teams' && (
        <div className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">
          <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6">
            <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
              <div>
                <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  Franchise Secret PINs & Budgets
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Provide these 4-digit PINs to Team Owners so they can bid via mobile at{' '}
                  <span className="text-amber-400 font-mono">/auction/{slug}/bid</span>
                </p>
              </div>

              <button
                onClick={() => executeAction('SEED_TEAMS')}
                disabled={actionLoading}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Reset Default Teams
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.map((t) => (
                <div key={t.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {t.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={t.logoUrl} alt={t.name} className="w-12 h-12 rounded-xl object-cover bg-slate-900" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center">
                        {t.shortName}
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-black uppercase text-white">{t.name}</h4>
                      <p className="text-xs text-slate-400 font-mono">
                        Purse: ₹{t.remainingPurse.toLocaleString('en-IN')} / ₹{t.totalPurse.toLocaleString('en-IN')}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-black block">
                      MOBILE LOGIN PIN
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 font-mono font-black text-sm tracking-widest inline-block mt-0.5">
                      {t.secretPin}
                    </span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
