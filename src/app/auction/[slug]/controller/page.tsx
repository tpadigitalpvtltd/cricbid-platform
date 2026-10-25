'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
  Tv,
  Settings as SettingsIcon,
  Trash2,
  Edit,
  Copy,
  Check,
  ExternalLink,
  DollarSign,
  AlertCircle
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

const PRESET_COLORS = [
  '#f59e0b', // Amber / Gold
  '#3b82f6', // Blue
  '#ef4444', // Red
  '#10b981', // Emerald
  '#8b5cf6', // Purple
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#ec4899', // Pink
];

export default function AuctioneerControllerPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [adminPin, setAdminPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState('');

  const [state, setState] = useState<FullAuctionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Active view tab in controller
  const [activeTab, setActiveTab] = useState<'control' | 'players' | 'teams' | 'settings'>('control');

  // Filters for players queue
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SOLD' | 'UNSOLD'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Manual bid amount
  const [customBidAmount, setCustomBidAmount] = useState<number | ''>('');
  const [selectedTeamForBid, setSelectedTeamForBid] = useState<string>('');

  // Individual player base price editing map { playerId: price }
  const [playerBasePrices, setPlayerBasePrices] = useState<Record<string, number>>({});

  // Global settings form state
  const [settingsBasePrice, setSettingsBasePrice] = useState<number>(1000);
  const [settingsBidIncrement, setSettingsBidIncrement] = useState<number>(500);
  const [settingsTimerSeconds, setSettingsTimerSeconds] = useState<number>(10);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  // Franchise Modal State (Add / Edit)
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TournamentTeam | null>(null);
  const [teamFormName, setTeamFormName] = useState('');
  const [teamFormShortName, setTeamFormShortName] = useState('');
  const [teamFormLogoUrl, setTeamFormLogoUrl] = useState('');
  const [teamFormColor, setTeamFormColor] = useState('#f59e0b');
  const [teamFormTotalPurse, setTeamFormTotalPurse] = useState<number>(100000);
  const [teamFormRemainingPurse, setTeamFormRemainingPurse] = useState<number>(100000);
  const [teamFormMaxPlayers, setTeamFormMaxPlayers] = useState<number>(15);
  const [teamFormSecretPin, setTeamFormSecretPin] = useState('');
  const [copiedPinId, setCopiedPinId] = useState<string | null>(null);

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
          // Sync settings state if available
          if (json.state.room) {
            setSettingsBasePrice(json.state.room.basePrice || 1000);
            setSettingsBidIncrement(json.state.room.bidIncrement || 500);
            setSettingsTimerSeconds(json.state.room.timerSeconds || 10);
          }
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

  // Open modal for Adding a new team
  const handleOpenAddTeam = () => {
    setEditingTeam(null);
    setTeamFormName('');
    setTeamFormShortName('');
    setTeamFormLogoUrl('');
    setTeamFormColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    setTeamFormTotalPurse(100000);
    setTeamFormRemainingPurse(100000);
    setTeamFormMaxPlayers(15);
    setTeamFormSecretPin(String(Math.floor(1000 + Math.random() * 9000)));
    setShowTeamModal(true);
  };

  // Open modal for Editing an existing team
  const handleOpenEditTeam = (team: TournamentTeam) => {
    setEditingTeam(team);
    setTeamFormName(team.name);
    setTeamFormShortName(team.shortName);
    setTeamFormLogoUrl(team.logoUrl || '');
    setTeamFormColor(team.color || '#f59e0b');
    setTeamFormTotalPurse(team.totalPurse || 100000);
    setTeamFormRemainingPurse(team.remainingPurse !== undefined ? team.remainingPurse : team.totalPurse);
    setTeamFormMaxPlayers(team.maxPlayers || 15);
    setTeamFormSecretPin(team.secretPin || '1111');
    setShowTeamModal(true);
  };

  // Save Franchise (Add / Edit)
  const handleSaveTeamModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamFormName.trim()) {
      alert('Please enter Franchise Name');
      return;
    }
    const shortCode = (teamFormShortName.trim() || teamFormName.slice(0, 3)).toUpperCase();
    const pin = teamFormSecretPin.trim() || String(Math.floor(1000 + Math.random() * 9000));

    const teamPayload: Partial<TournamentTeam> = {
      id: editingTeam ? editingTeam.id : undefined,
      name: teamFormName.trim(),
      shortName: shortCode,
      logoUrl: teamFormLogoUrl.trim(),
      color: teamFormColor,
      totalPurse: Number(teamFormTotalPurse) || 100000,
      remainingPurse: Number(teamFormRemainingPurse) || Number(teamFormTotalPurse) || 100000,
      maxPlayers: Number(teamFormMaxPlayers) || 15,
      secretPin: pin,
      boughtPlayersCount: editingTeam ? editingTeam.boughtPlayersCount : 0,
    };

    await executeAction('SAVE_TEAM', { team: teamPayload });
    setShowTeamModal(false);
  };

  // Delete team
  const handleDeleteTeam = async (team: TournamentTeam) => {
    if (confirm(`Are you sure you want to remove franchise "${team.name}" from the auction?`)) {
      await executeAction('DELETE_TEAM', { teamId: team.id });
    }
  };

  // Copy PIN to clipboard
  const handleCopyPin = (pin: string, teamId: string) => {
    try {
      navigator.clipboard.writeText(pin);
      setCopiedPinId(teamId);
      setTimeout(() => setCopiedPinId(null), 2000);
    } catch (e) {}
  };

  // Save Global Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeAction('UPDATE_SETTINGS', {
      basePrice: Number(settingsBasePrice),
      bidIncrement: Number(settingsBidIncrement),
      timerSeconds: Number(settingsTimerSeconds),
    });
    setSettingsSavedMsg(true);
    setTimeout(() => setSettingsSavedMsg(false), 3000);
  };

  // Update Individual Player Base Price
  const handleUpdatePlayerBasePrice = async (playerId: string) => {
    const price = playerBasePrices[playerId];
    if (!price || price <= 0) {
      alert('Please enter a valid base price');
      return;
    }
    await executeAction('UPDATE_PLAYER_BASE_PRICE', {
      playerId,
      basePrice: price,
    });
    alert(`Base price updated to ₹${price.toLocaleString('en-IN')}`);
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
            Enter Admin PIN to manage live bids, franchises, purse, and player base prices
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
    room: { status: 'WAITING', currentBid: 0, basePrice: 1000, bidIncrement: 500, timerSeconds: 10 },
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

  // Teams totals
  const totalPursePool = teams.reduce((acc, t) => acc + (t.totalPurse || 0), 0);
  const remainingPursePool = teams.reduce((acc, t) => acc + (t.remainingPurse || 0), 0);
  const spentPursePool = totalPursePool - remainingPursePool;

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
              Slug: {slug} • Status:{' '}
              <strong className={room.status === 'ACTIVE' ? 'text-emerald-400' : 'text-amber-400'}>
                {room.status}
              </strong>
            </span>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
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
            Draft Pool & Base Prices ({playersQueue.length})
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'teams' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            Franchises & Purse ({teams.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'settings' ? 'bg-amber-400 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5 inline mr-1" /> Settings
          </button>
        </div>

        {/* Master Room Controls & TV Link */}
        <div className="flex items-center gap-2">
          <Link
            href={`/auction/${slug}`}
            target="_blank"
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-400 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Tv className="w-3.5 h-3.5" /> Projector [TV]
          </Link>

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
            <RotateCcw className="w-3.5 h-3.5" /> Reset ({room.timerSeconds || 10}s)
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
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs text-amber-300 font-mono font-bold">
                        Base Price: ₹ {room.basePrice.toLocaleString('en-IN')}
                      </span>
                      {!currentBiddingTeam && (
                        <button
                          onClick={() => {
                            const val = prompt('Set starting base price for this player (₹):', String(room.basePrice));
                            if (val && Number(val) > 0) {
                              executeAction('SET_PLAYER', { playerId: currentPlayer.registrationId, basePrice: Number(val) });
                            }
                          }}
                          className="text-[10px] text-amber-400 underline hover:text-amber-300 font-bold"
                        >
                          Change
                        </button>
                      )}
                    </div>
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
                <span className="text-[11px] text-slate-400 font-mono">
                  {teams.length} Franchises Registered
                </span>
              </div>

              {/* Team Selector Grid */}
              <div className="mb-4">
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-2">
                  1. Select Bidding Team
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                  {teams.map((t) => {
                    const isSelected = selectedTeamForBid === t.id;
                    const isCurrentHolding = currentBiddingTeam?.id === t.id;
                    const canAfford = t.remainingPurse >= currentBid + (room.bidIncrement || 500);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTeamForBid(t.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'border-amber-400 bg-amber-400/20 text-white ring-2 ring-amber-400/40'
                            : isCurrentHolding
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                            : 'border-slate-800 bg-slate-950 hover:border-slate-700 text-slate-300'
                        } ${!canAfford ? 'opacity-50' : ''}`}
                      >
                        <div
                          className="w-7 h-7 rounded-lg shrink-0 flex items-center justify-center font-black text-xs text-slate-950 overflow-hidden"
                          style={{ backgroundColor: t.color || '#f59e0b' }}
                        >
                          {t.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={t.logoUrl} alt={t.name} className="w-full h-full object-cover" />
                          ) : (
                            t.shortName
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold truncate uppercase">{t.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono truncate">
                            ₹{t.remainingPurse.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Increment Bids */}
              <div className="mb-4">
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-2">
                  2. Choose Quick Increment
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

      {/* TAB 2: PLAYER QUEUE MANAGEMENT & BASE PRICES */}
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

                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none"
                >
                  <option value="All">All Roles</option>
                  <option value="Pure Batsman">Pure Batsman</option>
                  <option value="Bowler">Bowler</option>
                  <option value="All-Rounder">All-Rounder</option>
                  <option value="Wicket Keeper">Wicket Keeper</option>
                </select>

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[650px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredPlayers.map(({ player, status, basePrice, soldPrice, soldTeamName }) => {
                const isCurrentlyActive = currentPlayer?.registrationId === player.registrationId;
                const localBasePrice = playerBasePrices[player.registrationId] !== undefined
                  ? playerBasePrices[player.registrationId]
                  : basePrice;

                return (
                  <div
                    key={player.registrationId}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                      isCurrentlyActive
                        ? 'border-amber-400 bg-amber-400/15 ring-2 ring-amber-400/30'
                        : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                        {player.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={player.photoUrl} alt={player.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-black text-amber-400 text-xs">{getInitials(player.fullName)}</span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
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
                            <span className="text-emerald-300 font-bold">
                              ₹{soldPrice.toLocaleString('en-IN')} {soldTeamName ? `(${soldTeamName})` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Base Price & Actions Row */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 uppercase font-black">Base ₹</span>
                        <input
                          type="number"
                          value={localBasePrice}
                          onChange={(e) => {
                            const val = e.target.value ? Number(e.target.value) : 0;
                            setPlayerBasePrices((prev) => ({
                              ...prev,
                              [player.registrationId]: val,
                            }));
                          }}
                          disabled={status === 'SOLD'}
                          className="w-20 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400 disabled:opacity-40"
                        />
                        {localBasePrice !== basePrice && status !== 'SOLD' && (
                          <button
                            type="button"
                            onClick={() => handleUpdatePlayerBasePrice(player.registrationId)}
                            className="px-2 py-1 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-black uppercase"
                          >
                            Save
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => executeAction('SET_PLAYER', { playerId: player.registrationId, basePrice: localBasePrice })}
                        disabled={isCurrentlyActive || actionLoading}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-xs font-bold text-slate-300 transition-colors shrink-0 disabled:opacity-40"
                      >
                        {isCurrentlyActive ? 'On Block' : status === 'UNSOLD' ? 'Re-Auction' : 'Load on Stage'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}

      {/* TAB 3: FRANCHISES & PURSE MANAGEMENT */}
      {activeTab === 'teams' && (
        <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full">
          <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6">
            
            {/* Header & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-6 border-b border-slate-800">
              <div>
                <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  Franchises, Purse Budgets & Mobile PINs
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Set franchise names, team logos, total purse budget, and share the 4-digit PIN for smartphone live bidding.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAddTeam}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 shadow-lg"
                >
                  <Plus className="w-4 h-4 stroke-[3]" /> Add New Franchise
                </button>

                <button
                  onClick={() => {
                    if (confirm('Reset franchises back to 6 starter default teams? Any custom franchises will be reset.')) {
                      executeAction('SEED_TEAMS');
                    }
                  }}
                  disabled={actionLoading}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
                >
                  Reset Default Teams
                </button>
              </div>
            </div>

            {/* Purse Statistics Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 p-4 rounded-2xl bg-slate-950 border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black block">Total Franchises</span>
                <span className="text-lg font-black text-white">{teams.length} Teams</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black block">Total Purse Pool</span>
                <span className="text-lg font-black text-amber-400 font-mono">₹{totalPursePool.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black block">Purse Spent (Sold)</span>
                <span className="text-lg font-black text-emerald-400 font-mono">₹{spentPursePool.toLocaleString('en-IN')}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-black block">Remaining Purse</span>
                <span className="text-lg font-black text-slate-200 font-mono">₹{remainingPursePool.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Franchise Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teams.map((t) => {
                const pursePercent = Math.max(0, Math.min(100, Math.round((t.remainingPurse / (t.totalPurse || 1)) * 100)));
                const isCopied = copiedPinId === t.id;

                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* Top: Logo, Name & Actions */}
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-12 h-12 rounded-xl shrink-0 overflow-hidden flex items-center justify-center font-black text-sm text-slate-950 shadow-md"
                            style={{ backgroundColor: t.color || '#f59e0b' }}
                          >
                            {t.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={t.logoUrl} alt={t.name} className="w-full h-full object-cover" />
                            ) : (
                              t.shortName
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-sm font-black uppercase text-white truncate">{t.name}</h4>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-bold">
                                {t.shortName}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                              Squad: <strong className="text-white">{t.boughtPlayersCount || 0}</strong> / {t.maxPlayers || 15} Players
                            </p>
                          </div>
                        </div>

                        {/* Edit & Delete Buttons */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTeam(t)}
                            className="p-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition-colors"
                            title="Edit Franchise"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTeam(t)}
                            className="p-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                            title="Delete Franchise"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Purse Progress Bar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs font-mono mb-1">
                          <span className="text-slate-400">Remaining Purse:</span>
                          <span className="font-bold text-amber-400">
                            ₹{t.remainingPurse.toLocaleString('en-IN')}{' '}
                            <span className="text-slate-500 font-normal">/ ₹{t.totalPurse.toLocaleString('en-IN')}</span>
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pursePercent}%`,
                              backgroundColor: t.color || '#f59e0b',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Mobile Login PIN */}
                    <div className="pt-3 border-t border-slate-900 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400 uppercase font-black">
                        Mobile Bidding PIN
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span className="px-3 py-1 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-400 font-mono font-black text-sm tracking-widest">
                          {t.secretPin}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyPin(t.secretPin, t.id)}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white"
                          title="Copy PIN"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        </div>
      )}

      {/* TAB 4: GLOBAL AUCTION SETTINGS */}
      {activeTab === 'settings' && (
        <div className="flex-1 p-4 sm:p-6 max-w-3xl mx-auto w-full">
          <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6">
            <div className="flex items-center gap-2 pb-4 mb-6 border-b border-slate-800">
              <SettingsIcon className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-black uppercase text-white">
                Live Auction Room Settings
              </h3>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* Default Base Price */}
              <div>
                <label className="text-xs font-black uppercase text-slate-300 block mb-1.5">
                  Default Player Starting Base Price (₹)
                </label>
                <input
                  type="number"
                  value={settingsBasePrice}
                  onChange={(e) => setSettingsBasePrice(Number(e.target.value))}
                  min={100}
                  step={100}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  When a player is loaded onto the auction block without an individual price, this starting price applies.
                </p>
              </div>

              {/* Default Bid Increment */}
              <div>
                <label className="text-xs font-black uppercase text-slate-300 block mb-1.5">
                  Default Bid Increment (₹)
                </label>
                <input
                  type="number"
                  value={settingsBidIncrement}
                  onChange={(e) => setSettingsBidIncrement(Number(e.target.value))}
                  min={50}
                  step={50}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Minimum increment amount required for each successive bid by team owners.
                </p>
              </div>

              {/* Timer Countdown Duration */}
              <div>
                <label className="text-xs font-black uppercase text-slate-300 block mb-1.5">
                  Countdown Timer Duration (Seconds)
                </label>
                <input
                  type="number"
                  value={settingsTimerSeconds}
                  onChange={(e) => setSettingsTimerSeconds(Number(e.target.value))}
                  min={5}
                  max={60}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  The countdown timer resets to this duration every time a new bid is placed.
                </p>
              </div>

              {settingsSavedMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Room settings saved successfully! Projector and mobile synced.
                </div>
              )}

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg hover:bg-amber-300 disabled:opacity-40"
              >
                Save Room Settings
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT FRANCHISE */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-black uppercase text-white mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
              {editingTeam ? 'Edit Franchise Details' : 'Add New Franchise'}
            </h3>

            <form onSubmit={handleSaveTeamModal} className="space-y-4">
              {/* Franchise Name */}
              <div>
                <label className="text-xs font-black uppercase text-slate-300 block mb-1">
                  Franchise Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Royal Challengers"
                  value={teamFormName}
                  onChange={(e) => {
                    setTeamFormName(e.target.value);
                    if (!editingTeam && !teamFormShortName) {
                      setTeamFormShortName(e.target.value.slice(0, 3).toUpperCase());
                    }
                  }}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Short Name & Color */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase text-slate-300 block mb-1">
                    Short Code (2-4 letters)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. RC"
                    value={teamFormShortName}
                    onChange={(e) => setTeamFormShortName(e.target.value.toUpperCase())}
                    maxLength={5}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono uppercase focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-300 block mb-1">
                    Brand Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={teamFormColor}
                      onChange={(e) => setTeamFormColor(e.target.value)}
                      className="w-9 h-9 rounded-xl bg-transparent cursor-pointer border border-slate-700"
                    />
                    <div className="flex items-center gap-1">
                      {PRESET_COLORS.slice(0, 4).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setTeamFormColor(c)}
                          className="w-5 h-5 rounded-full border border-white/20"
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Team Logo URL with Live Preview */}
              <div>
                <label className="text-xs font-black uppercase text-slate-300 block mb-1">
                  Logo URL (Optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={teamFormLogoUrl}
                    onChange={(e) => setTeamFormLogoUrl(e.target.value)}
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                  <div
                    className="w-10 h-10 rounded-xl shrink-0 overflow-hidden flex items-center justify-center font-black text-xs text-slate-950 shadow"
                    style={{ backgroundColor: teamFormColor }}
                  >
                    {teamFormLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={teamFormLogoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      teamFormShortName || 'RC'
                    )}
                  </div>
                </div>
              </div>

              {/* Purse Budget & Max Players */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-black uppercase text-slate-300 block mb-1">
                    Total Purse Budget (₹) *
                  </label>
                  <input
                    type="number"
                    value={teamFormTotalPurse}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTeamFormTotalPurse(val);
                      if (!editingTeam) setTeamFormRemainingPurse(val);
                    }}
                    min={1000}
                    step={5000}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-300 block mb-1">
                    Max Squad Size
                  </label>
                  <input
                    type="number"
                    value={teamFormMaxPlayers}
                    onChange={(e) => setTeamFormMaxPlayers(Number(e.target.value))}
                    min={5}
                    max={30}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* If editing, allow remaining purse adjustment */}
              {editingTeam && (
                <div>
                  <label className="text-xs font-black uppercase text-slate-300 block mb-1">
                    Remaining Purse Balance (₹)
                  </label>
                  <input
                    type="number"
                    value={teamFormRemainingPurse}
                    onChange={(e) => setTeamFormRemainingPurse(Number(e.target.value))}
                    min={0}
                    step={1000}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Adjust only if correcting manual penalties or awards.
                  </p>
                </div>
              )}

              {/* 4-Digit Secret Login PIN */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-black uppercase text-slate-300">
                    4-Digit Mobile Login PIN *
                  </label>
                  <button
                    type="button"
                    onClick={() => setTeamFormSecretPin(String(Math.floor(1000 + Math.random() * 9000)))}
                    className="text-[10px] text-amber-400 hover:text-amber-300 underline font-bold"
                  >
                    Random PIN
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 1111"
                  value={teamFormSecretPin}
                  onChange={(e) => setTeamFormSecretPin(e.target.value)}
                  maxLength={6}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 text-sm font-mono tracking-widest text-center focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTeamModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs uppercase shadow-lg hover:bg-amber-300"
                >
                  {editingTeam ? 'Save Changes' : 'Create Franchise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
