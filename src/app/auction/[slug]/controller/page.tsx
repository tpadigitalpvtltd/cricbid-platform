'use client';

import React, { useEffect, useState, useRef } from 'react';
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
  AlertCircle,
  Upload,
  Image as ImageIcon,
  ArrowLeft,
  Flame,
  Zap,
  Smartphone,
  Share2,
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

const ROLE_OPTIONS = [
  { label: 'All Roles', value: 'All' },
  { label: 'Pure Batsman', value: 'Pure Batsman' },
  { label: 'Fast Bowlers', value: 'Fast Bowler' },
  { label: 'Spin Bowlers', value: 'Spin Bowler' },
  { label: 'Batting All-Rounders', value: 'Batting All-Rounder' },
  { label: 'Bowling All-Rounders', value: 'Bowling All-Rounder' },
  { label: 'Wicket Keepers', value: 'Wicket Keeper Batsman' },
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
  const hasInitializedSettings = useRef(false);
  const [settingsBasePrice, setSettingsBasePrice] = useState<number>(1000);
  const [settingsBidIncrement, setSettingsBidIncrement] = useState<number>(500);
  const [settingsTimerSeconds, setSettingsTimerSeconds] = useState<number>(10);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState(false);

  // Decision toast announcement in Bidding Desk
  const [lastDecisionMsg, setLastDecisionMsg] = useState<{
    type: 'SOLD' | 'UNSOLD';
    text: string;
  } | null>(null);

  // Franchise Modal State (Add / Edit)
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<TournamentTeam | null>(null);
  const [teamFormName, setTeamFormName] = useState('');
  const [teamFormShortName, setTeamFormShortName] = useState('');
  const [teamFormLogoUrl, setTeamFormLogoUrl] = useState('');
  const [teamFormColor, setTeamFormColor] = useState('#f59e0b');
  const [teamFormTotalPurse, setTeamFormTotalPurse] = useState<number | string>(100000);
  const [teamFormRemainingPurse, setTeamFormRemainingPurse] = useState<number | string>(100000);
  const [teamFormMaxPlayers, setTeamFormMaxPlayers] = useState<number | string>(15);
  const [teamFormSecretPin, setTeamFormSecretPin] = useState('');
  const [copiedPinId, setCopiedPinId] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

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
      const res = await fetch(`/api/auction/${slug}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.state) {
          setState(json.state);
          // Sync settings state only on first load so background polling doesn't overwrite admin typing
          if (json.state.room && !hasInitializedSettings.current) {
            setSettingsBasePrice(json.state.room.basePrice || 1000);
            setSettingsBidIncrement(json.state.room.bidIncrement || 500);
            setSettingsTimerSeconds(json.state.room.timerSeconds || 10);
            hasInitializedSettings.current = true;
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
    // 3.5s fast fallback polling when tab is active (Supabase WebSocket handles sub-50ms instant updates)
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchState();
      }
    }, 3500);
    return () => clearInterval(interval);
  }, [slug]);

  // Realtime subscription (instant state update in <50ms without round-trip HTTP)
  useEffect(() => {
    if (!slug) return;
    const channel = supabase.channel(`auction_${slug.toLowerCase()}`);
    channel.on('broadcast', { event: '*' }, (msg: any) => {
      if (msg?.payload?.state) {
        const incoming = msg.payload.state;
        setState((prev) => {
          if (!prev) return incoming;
          return {
            ...incoming,
            playersQueue:
              incoming.playersQueue && incoming.playersQueue.length > 0
                ? incoming.playersQueue
                : prev.playersQueue,
          };
        });
      } else {
        fetchState();
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug]);

  // Manual Player Edit Modal State
  const [showPlayerEditModal, setShowPlayerEditModal] = useState(false);
  const [editingPlayerObj, setEditingPlayerObj] = useState<any | null>(null);
  const [playerEditStatus, setPlayerEditStatus] = useState<string>('PENDING');
  const [playerEditBasePrice, setPlayerEditBasePrice] = useState<number | string>(1000);
  const [playerEditSoldPrice, setPlayerEditSoldPrice] = useState<number | string>('');
  const [playerEditSoldTeamId, setPlayerEditSoldTeamId] = useState<string>('');

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
      return json;
    } catch (e: any) {
      alert(e.message || 'Action error');
      return null;
    } finally {
      setActionLoading(false);
    }
  };

  const handlePlaceFloorBid = async (teamId: string, amount: number) => {
    if (!slug || !teamId || !amount) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
      // Instant optimistic feedback
      setState((prev) => {
        if (!prev) return prev;
        const team = prev.teams.find((t) => t.id === teamId);
        return {
          ...prev,
          room: {
            ...prev.room,
            currentBid: amount,
            currentBiddingTeamId: teamId,
            timerSeconds: 10,
            timerRunning: true,
          },
          currentBiddingTeam: team || prev.currentBiddingTeam,
        };
      });

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
        fetchState();
      } else if (json.state) {
        setState(json.state);
        setCustomBidAmount('');
      }
    } catch (e: any) {
      alert(e.message || 'Error placing bid');
      fetchState();
    }
  };

  // Decision Handler: SOLD
  const handleMarkSold = async () => {
    if (!currentPlayer) return;
    if (!currentBiddingTeam) {
      alert('Cannot mark as SOLD: No franchise has placed a bid yet! Select a team and place at least one bid.');
      return;
    }
    const soldPrice = currentBid;
    const soldTeamName = currentBiddingTeam.name;
    const playerName = currentPlayer.fullName;

    // Instant optimistic update on controller screen (0ms)
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        room: {
          ...prev.room,
          lastAction: 'SOLD',
          timerRunning: false,
        },
        teams: prev.teams.map((t) =>
          t.id === currentBiddingTeam.id
            ? {
                ...t,
                remainingPurse: Math.max(0, t.remainingPurse - soldPrice),
                boughtPlayersCount: (t.boughtPlayersCount || 0) + 1,
              }
            : t
        ),
      };
    });

    setLastDecisionMsg({
      type: 'SOLD',
      text: `🎉 SOLD! ${playerName} sold to ${soldTeamName} for ₹${soldPrice.toLocaleString('en-IN')}!`,
    });
    setTimeout(() => setLastDecisionMsg(null), 8000);

    const res = await executeAction('MARK_SOLD');
    if (!res?.success) {
      fetchState();
    }
  };

  // Decision Handler: UNSOLD
  const handleMarkUnsold = async () => {
    if (!currentPlayer) return;
    const playerName = currentPlayer.fullName;

    // Instant optimistic update on controller screen (0ms)
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        room: {
          ...prev.room,
          lastAction: 'UNSOLD',
          timerRunning: false,
          currentBiddingTeamId: null,
        },
        currentBiddingTeam: null,
      };
    });

    setLastDecisionMsg({
      type: 'UNSOLD',
      text: `⚠️ ${playerName} marked as UNSOLD.`,
    });
    setTimeout(() => setLastDecisionMsg(null), 6000);

    const res = await executeAction('MARK_UNSOLD');
    if (!res?.success) {
      fetchState();
    }
  };

  // Open Manual Player Edit Modal
  const handleOpenManualEditPlayer = (
    player: any,
    currentStatus: string,
    basePrice: number,
    soldPrice?: number | null,
    soldTeamName?: string | null
  ) => {
    setEditingPlayerObj(player);
    setPlayerEditStatus(currentStatus || 'PENDING');
    setPlayerEditBasePrice(basePrice || 1000);
    setPlayerEditSoldPrice(soldPrice !== undefined && soldPrice !== null ? soldPrice : '');
    const currentTeam = teams.find((t) => t.name === soldTeamName);
    setPlayerEditSoldTeamId(currentTeam ? currentTeam.id : '');
    setShowPlayerEditModal(true);
  };

  // Save Manual Player Edit
  const handleSaveManualEditPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayerObj) return;

    const baseP = Number(playerEditBasePrice) > 0 ? Number(playerEditBasePrice) : 1000;
    const isSold = playerEditStatus === 'SOLD';
    const soldP = isSold ? (playerEditSoldPrice !== '' ? Number(playerEditSoldPrice) : baseP) : undefined;
    const soldTeamId = isSold ? playerEditSoldTeamId : undefined;

    if (isSold && !soldTeamId) {
      alert('Please select the Franchise to which this player is SOLD.');
      return;
    }

    const res = await executeAction('MANUAL_EDIT_PLAYER_AUCTION', {
      playerId: editingPlayerObj.registrationId,
      status: playerEditStatus,
      basePrice: baseP,
      soldPrice: soldP,
      soldToTeamId: soldTeamId,
    });

    if (res?.success) {
      setShowPlayerEditModal(false);
      setEditingPlayerObj(null);
      setLastDecisionMsg({
        type: 'SOLD',
        text: `✅ Player record for ${editingPlayerObj.fullName} updated manually!`,
      });
      setTimeout(() => setLastDecisionMsg(null), 5000);
    }
  };

  // Re-Auction a player (works for any player whether SOLD, UNSOLD, or PENDING)
  const handleReAuctionPlayer = async (playerId: string) => {
    const p = playersQueue.find((pq) => pq.player.registrationId === playerId);
    const name = p?.player.fullName || 'Player';
    if (confirm(`Do you want to put ${name} back on the auction block for Re-Auction? (If sold, previous franchise purse will be refunded automatically).`)) {
      const res = await executeAction('REAUCTION_PLAYER', { playerId });
      if (res?.success) {
        setActiveTab('control');
        setLastDecisionMsg({
          type: 'SOLD',
          text: `🔥 ${name} is now LIVE on the bidding stage for Re-Auction!`,
        });
        setTimeout(() => setLastDecisionMsg(null), 6000);
      }
    }
  };

  // Undo Last Sold Decision
  const handleUndoSold = async () => {
    if (confirm('Undo the last sold decision? This will refund the franchise purse and put the player back on the bidding stage.')) {
      const res = await executeAction('UNDO_SOLD');
      if (res?.success) {
        setLastDecisionMsg({
          type: 'UNSOLD',
          text: `↩️ Reverted! Franchise purse refunded and player returned to bidding stage.`,
        });
        setTimeout(() => setLastDecisionMsg(null), 6000);
      }
    }
  };

  // Skip Player to Pool
  const handleSkipPlayer = async () => {
    const res = await executeAction('SKIP_PLAYER');
    if (res?.success) {
      setLastDecisionMsg({
        type: 'UNSOLD',
        text: `⏩ Player skipped to draft pool.`,
      });
      setTimeout(() => setLastDecisionMsg(null), 4000);
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

  // Handle Logo Upload from Device Gallery (converts to compressed base64)
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file (PNG, JPG, WEBP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new (window as any).Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 360;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/png', 0.88);
        setTeamFormLogoUrl(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
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

    const totalPurseNum = teamFormTotalPurse === '' ? 100000 : Number(teamFormTotalPurse);
    const parsedTotalPurse = isNaN(totalPurseNum) ? 100000 : Math.max(0, totalPurseNum);

    const remainingPurseNum = teamFormRemainingPurse === '' ? parsedTotalPurse : Number(teamFormRemainingPurse);
    const parsedRemainingPurse = isNaN(remainingPurseNum) ? parsedTotalPurse : Math.max(0, remainingPurseNum);

    const maxPlayersNum = teamFormMaxPlayers === '' ? 15 : Number(teamFormMaxPlayers);
    const parsedMaxPlayers = isNaN(maxPlayersNum) ? 15 : Math.max(1, maxPlayersNum);

    const teamPayload: Partial<TournamentTeam> = {
      id: editingTeam ? editingTeam.id : undefined,
      name: teamFormName.trim(),
      shortName: shortCode,
      logoUrl: teamFormLogoUrl.trim(),
      color: teamFormColor,
      totalPurse: parsedTotalPurse,
      remainingPurse: parsedRemainingPurse,
      maxPlayers: parsedMaxPlayers,
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
    const baseP = Number(settingsBasePrice) || 1000;
    const bidInc = Number(settingsBidIncrement) || 500;
    const timerS = Number(settingsTimerSeconds) || 10;

    await executeAction('UPDATE_SETTINGS', {
      basePrice: baseP,
      bidIncrement: bidInc,
      timerSeconds: timerS,
    });
    setSettingsSavedMsg(true);
    setTimeout(() => setSettingsSavedMsg(false), 3500);
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

  // Load a player onto stage and switch tab to Bidding Desk immediately
  const handleLoadOnStage = async (playerId: string, basePrice: number) => {
    const targetPlayer = playersQueue.find((pq) => pq.player.registrationId === playerId);
    if (targetPlayer) {
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentPlayer: targetPlayer.player,
          room: {
            ...prev.room,
            currentPlayerId: playerId,
            currentBid: basePrice,
            currentBiddingTeamId: null,
            lastAction: 'NEXT',
          },
          currentBiddingTeam: null,
        };
      });
    }
    setActiveTab('control');
    await executeAction('SET_PLAYER', { playerId, basePrice });
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
  const currentIncrement = room.bidIncrement || 500;
  const quickIncrements = [100, 500, 1000, 2000, 5000, 10000];

  // Filtered queue
  const filteredPlayers = playersQueue.filter((pq) => {
    if (roleFilter !== 'All') {
      const pRole = (pq.player.role || '').toLowerCase();
      if (roleFilter === 'Fast Bowler' && !pRole.includes('fast')) return false;
      if (roleFilter === 'Spin Bowler' && !pRole.includes('spin')) return false;
      if (roleFilter === 'Batting All-Rounder' && !pRole.includes('batting all')) return false;
      if (roleFilter === 'Bowling All-Rounder' && !pRole.includes('bowling all')) return false;
      if (roleFilter === 'Wicket Keeper Batsman' && !pRole.includes('keeper')) return false;
      if (roleFilter === 'Pure Batsman' && pq.player.role !== 'Pure Batsman') return false;
    }
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
          <div className="w-8 h-8 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-md">
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
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab('control')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'control' ? 'bg-amber-400 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Bidding Desk
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'players' ? 'bg-amber-400 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Draft Pool & Base Prices ({playersQueue.length})
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'teams' ? 'bg-amber-400 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            Franchises & Purse ({teams.length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === 'settings' ? 'bg-amber-400 text-slate-950 font-black shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <SettingsIcon className="w-3.5 h-3.5 inline mr-1" /> Settings
          </button>
        </div>

        {/* Master Room Controls, TV & Mobile Owner Links */}
        <div className="flex items-center gap-2">
          <Link
            href={`/auction/${slug}/bid`}
            target="_blank"
            className="px-3 py-1.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <Smartphone className="w-3.5 h-3.5" /> Owner Bidding [Mobile]
          </Link>

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
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 hover:bg-amber-500/30 transition-colors"
            >
              <Pause className="w-3.5 h-3.5" /> Pause
            </button>
          ) : (
            <button
              onClick={() => executeAction('RESUME')}
              disabled={actionLoading}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-500/30 transition-colors"
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
          <div className="lg:col-span-6 bg-slate-900/80 rounded-3xl border border-slate-800 p-5 sm:p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-amber-400" /> Current Player on Block
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleSkipPlayer}
                    disabled={actionLoading}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 text-xs font-bold transition-colors flex items-center gap-1"
                    title="Skip player to pool"
                  >
                    <SkipForward className="w-3.5 h-3.5" /> Skip
                  </button>
                  <button
                    onClick={() => executeAction('PREV_PLAYER')}
                    disabled={actionLoading}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Previous Player"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => executeAction('NEXT_PLAYER')}
                    disabled={actionLoading}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Next Player"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Decision Announcement Banner */}
              {lastDecisionMsg && (
                <div
                  className={`p-3.5 rounded-2xl mb-4 border font-bold text-xs flex flex-wrap items-center justify-between gap-2 shadow-lg animate-in fade-in ${
                    lastDecisionMsg.type === 'SOLD'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {lastDecisionMsg.type === 'SOLD' ? (
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 shrink-0" />
                    )}
                    <span>{lastDecisionMsg.text}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleUndoSold}
                      disabled={actionLoading}
                      className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shrink-0 transition-colors shadow flex items-center gap-1"
                      title="Undo this decision and refund purse"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Undo
                    </button>
                    <button
                      onClick={() => executeAction('NEXT_PLAYER')}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-xl bg-white text-slate-950 font-black text-xs uppercase tracking-wider shrink-0 hover:bg-slate-200 transition-colors shadow"
                    >
                      Next Player &rarr;
                    </button>
                  </div>
                </div>
              )}

              {currentPlayer ? (
                <div className="flex items-center gap-5 mb-5">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl p-[2px] bg-gradient-to-tr from-amber-400 to-emerald-400 shrink-0 shadow-lg">
                    <div className="w-full h-full rounded-[14px] bg-slate-950 overflow-hidden flex items-center justify-center">
                      {currentPlayer.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={currentPlayer.photoUrl}
                          alt={currentPlayer.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-900 flex items-center justify-center font-black text-amber-400 text-2xl">
                          {getInitials(currentPlayer.fullName)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 inline-block">
                      {currentPlayer.role}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-black uppercase text-white mt-1 truncate">
                      {currentPlayer.fullName}
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Age: {currentPlayer.age} yrs • {currentPlayer.battingStyle}
                      {currentPlayer.role !== 'Pure Batsman' && currentPlayer.bowlingStyle && currentPlayer.bowlingStyle !== 'None' ? ` • ${currentPlayer.bowlingStyle}` : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-amber-300 font-mono font-bold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
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
                          className="text-[11px] text-amber-400 underline hover:text-amber-300 font-bold"
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
                  <p className="text-xs">No active player loaded on auction block</p>
                  <button
                    onClick={() => executeAction('NEXT_PLAYER')}
                    disabled={actionLoading}
                    className="mt-3 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-black uppercase shadow-lg hover:bg-amber-300"
                  >
                    Load First Player
                  </button>
                </div>
              )}

              {/* CURRENT BID DISPLAY */}
              <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-slate-800 mb-6 shadow-inner">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                      CURRENT STAGE BID
                    </span>
                    <div className="text-3xl sm:text-4xl font-black text-amber-400 font-mono tracking-tight">
                      ₹ {currentBid.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">
                      HOLDING TEAM
                    </span>
                    {currentBiddingTeam ? (
                      <div className="flex items-center gap-2 mt-1 justify-end">
                        <div
                          className="w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center font-black text-[10px] text-slate-950 shadow"
                          style={{ backgroundColor: currentBiddingTeam.color || '#f59e0b' }}
                        >
                          {currentBiddingTeam.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={currentBiddingTeam.logoUrl} alt={currentBiddingTeam.name} className="w-full h-full object-cover" />
                          ) : (
                            currentBiddingTeam.shortName || 'TM'
                          )}
                        </div>
                        <span className="text-sm font-black text-white uppercase truncate max-w-[150px]">
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
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={handleMarkSold}
                disabled={actionLoading || !currentBiddingTeam}
                className="py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                <span>MARK AS SOLD</span>
              </button>

              <button
                onClick={handleMarkUnsold}
                disabled={actionLoading || !currentPlayer}
                className="py-3.5 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <XCircle className="w-5 h-5 stroke-[2.5]" />
                <span>MARK AS UNSOLD</span>
              </button>
            </div>

            {/* MANUAL CONTROLS ROW: UNDO / SKIP / MANUAL EDIT */}
            <div className="grid grid-cols-3 gap-2 pt-3">
              <button
                type="button"
                onClick={handleUndoSold}
                disabled={actionLoading}
                className="py-2.5 px-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-amber-300 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all shadow"
                title="Undo last sold player (refunds purse and resets to stage)"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Undo Sold</span>
              </button>

              <button
                type="button"
                onClick={handleSkipPlayer}
                disabled={actionLoading}
                className="py-2.5 px-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all shadow"
                title="Skip to next player without marking sold or unsold"
              >
                <SkipForward className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>Skip Player</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (currentPlayer) {
                    const st = playersQueue.find((pq) => pq.player.registrationId === currentPlayer.registrationId);
                    handleOpenManualEditPlayer(currentPlayer, st?.status || 'IN_AUCTION', currentBid, st?.soldPrice, currentBiddingTeam?.name);
                  }
                }}
                disabled={!currentPlayer}
                className="py-2.5 px-2 rounded-xl bg-slate-950 hover:bg-amber-400 hover:text-slate-950 border border-slate-700 text-slate-300 font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all shadow disabled:opacity-40"
                title="Manually edit any field for this player"
              >
                <Edit className="w-3.5 h-3.5 shrink-0" />
                <span>Manual Edit</span>
              </button>
            </div>
          </div>

          {/* RIGHT: FLOOR BIDDING CONTROLS & TEAMS GRID (6 Cols) */}
          <div className="lg:col-span-6 bg-slate-900/80 rounded-3xl border border-slate-800 p-5 sm:p-6 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" /> Floor Bidder (Place Bid on Behalf of Floor)
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {teams.length} Franchises
                </span>
              </div>

              {/* Team Selector Grid */}
              <div className="mb-4">
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-2">
                  1. Select Bidding Team
                </label>
                {teams.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
                    No franchises registered yet. Go to <strong className="text-amber-400">Franchises & Purse</strong> tab to add teams.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {teams.map((t) => {
                      const isSelected = selectedTeamForBid === t.id;
                      const isCurrentHolding = currentBiddingTeam?.id === t.id;
                      const canAfford = t.remainingPurse >= currentBid + currentIncrement;

                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTeamForBid(t.id)}
                          className={`p-2.5 rounded-xl border text-left transition-all relative ${
                            isSelected
                              ? 'border-amber-400 bg-amber-400/20 ring-2 ring-amber-400/30'
                              : isCurrentHolding
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                          } ${!canAfford ? 'opacity-40' : ''}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <div
                              className="w-5 h-5 rounded-md overflow-hidden flex items-center justify-center font-black text-[9px] text-slate-950 shrink-0"
                              style={{ backgroundColor: t.color || '#f59e0b' }}
                            >
                              {t.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={t.logoUrl} alt={t.name} className="w-full h-full object-cover" />
                              ) : (
                                t.shortName || 'TM'
                              )}
                            </div>
                            <span className="text-xs font-bold text-white truncate flex-1">
                              {t.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-amber-300/80 font-mono block">
                            Purse: ₹{t.remainingPurse.toLocaleString('en-IN')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick Increment Bid Buttons */}
              <div className="mb-4">
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-2">
                  2. One-Tap Quick Increments
                </label>

                {/* Primary Raise Increment Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedTeamForBid) {
                      alert('Please select a franchise first from the team grid above.');
                      return;
                    }
                    handlePlaceFloorBid(selectedTeamForBid, currentBid + currentIncrement);
                  }}
                  disabled={actionLoading || !selectedTeamForBid}
                  className="w-full py-3 mb-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg hover:from-amber-300 hover:to-yellow-300 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
                >
                  <Coins className="w-4 h-4" />
                  <span>
                    Raise Bid (+₹{currentIncrement.toLocaleString('en-IN')}) &rarr; ₹{(currentBid + currentIncrement).toLocaleString('en-IN')}
                  </span>
                </button>

                {/* Secondary Quick Increase Pill Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {quickIncrements.map((inc) => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => {
                        if (!selectedTeamForBid) {
                          alert('Please select a franchise first from the team grid above.');
                          return;
                        }
                        handlePlaceFloorBid(selectedTeamForBid, currentBid + inc);
                      }}
                      disabled={actionLoading || !selectedTeamForBid}
                      className="py-2 rounded-xl bg-slate-950 border border-slate-700 hover:border-amber-400 text-amber-400 hover:text-white text-xs font-mono font-bold text-center transition-all disabled:opacity-30"
                    >
                      +₹{inc >= 1000 ? `${inc / 1000}k` : inc}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Bid Input */}
              <div className="mb-4 pt-3 border-t border-slate-800">
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-1.5">
                  3. Or Enter Custom Bid Amount (₹)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder={`Min: ₹${(currentBid + currentIncrement).toLocaleString('en-IN')}`}
                    value={customBidAmount}
                    onChange={(e) => setCustomBidAmount(e.target.value ? Number(e.target.value) : '')}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedTeamForBid) {
                        alert('Please select a franchise first');
                        return;
                      }
                      if (!customBidAmount || customBidAmount <= currentBid) {
                        alert(`Bid must be higher than current stage bid (₹${currentBid.toLocaleString('en-IN')})`);
                        return;
                      }
                      handlePlaceFloorBid(selectedTeamForBid, customBidAmount);
                    }}
                    disabled={actionLoading || !selectedTeamForBid || !customBidAmount}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-black uppercase tracking-wider disabled:opacity-40 transition-colors"
                  >
                    Place Bid
                  </button>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 text-center italic mt-2">
              All floor bids sync in sub-100ms across 4K Projector [TV] and Team Owner mobile screens.
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: PLAYER QUEUE MANAGEMENT & BASE PRICES */}
      {activeTab === 'players' && (
        <div className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
          <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6 shadow-xl">
            
            {/* Search & Filter Header */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab('control')}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-xs font-bold"
                  title="Return to Bidding Desk"
                >
                  <ArrowLeft className="w-4 h-4" /> Desk
                </button>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-amber-400" />
                  <h3 className="text-base font-black uppercase text-white">
                    Tournament Draft Pool ({filteredPlayers.length} Players)
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search player name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>

                {/* Role Filter */}
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="ALL">All Status</option>
                  <option value="PENDING">Pending (Ready)</option>
                  <option value="SOLD">Sold</option>
                  <option value="UNSOLD">Unsold</option>
                </select>
              </div>
            </div>

            {/* Players Table / Grid */}
            {filteredPlayers.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-bold">No players found matching your filters</p>
                <button
                  onClick={() => {
                    setRoleFilter('All');
                    setStatusFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="mt-3 px-3 py-1.5 rounded-xl bg-slate-800 text-amber-400 text-xs font-bold"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 max-h-[650px] overflow-y-auto pr-1 scrollbar-thin">
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
                          ? 'border-amber-400 bg-amber-400/15 ring-2 ring-amber-400/30 shadow-lg'
                          : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center shadow">
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
                              className={`px-1.5 py-0.5 rounded font-bold ${
                                status === 'SOLD'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : status === 'UNSOLD'
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {status}
                            </span>
                            {status === 'SOLD' && soldPrice && (
                              <span className="text-emerald-300 font-bold truncate">
                                ₹{soldPrice.toLocaleString('en-IN')} {soldTeamName ? `(${soldTeamName})` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Base Price & Actions Row */}
                      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
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
                            step={100}
                            className="w-20 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-400"
                          />
                          {localBasePrice !== basePrice && (
                            <button
                              type="button"
                              onClick={() => handleUpdatePlayerBasePrice(player.registrationId)}
                              className="px-2 py-1 rounded-lg bg-amber-400 text-slate-950 text-[10px] font-black uppercase shadow"
                            >
                              Save
                            </button>
                          )}
                        </div>

                        {/* Player Action Buttons */}
                        <div className="flex items-center gap-1.5">
                          {status === 'SOLD' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleReAuctionPlayer(player.registrationId)}
                                disabled={isCurrentlyActive || actionLoading}
                                className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500 hover:text-slate-950 text-[11px] font-bold text-amber-300 transition-colors shrink-0 shadow flex items-center gap-1"
                                title="Re-Auction player (refunds franchise purse)"
                              >
                                <RotateCcw className="w-3 h-3" />
                                Re-Auction
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Mark ${player.fullName} as UNSOLD? (This will refund ₹${soldPrice?.toLocaleString('en-IN') || 0} to ${soldTeamName || 'the franchise'}).`)) {
                                    executeAction('MARK_UNSOLD', { playerId: player.registrationId });
                                  }
                                }}
                                disabled={actionLoading}
                                className="px-2 py-1.5 rounded-xl bg-rose-500/20 border border-rose-500/40 hover:bg-rose-500 hover:text-white text-[11px] font-bold text-rose-300 transition-colors shrink-0 shadow"
                                title="Mark Unsold & Refund Purse"
                              >
                                Unsold
                              </button>
                            </>
                          ) : status === 'UNSOLD' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleLoadOnStage(player.registrationId, localBasePrice)}
                                disabled={isCurrentlyActive || actionLoading}
                                className="px-2.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-[11px] font-black uppercase hover:bg-amber-300 transition-colors shrink-0 shadow flex items-center gap-1"
                              >
                                <Flame className="w-3 h-3" />
                                Re-Auction
                              </button>
                              <button
                                type="button"
                                onClick={() => executeAction('MANUAL_EDIT_PLAYER_AUCTION', { playerId: player.registrationId, status: 'PENDING', basePrice: localBasePrice })}
                                disabled={actionLoading}
                                className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 transition-colors shrink-0"
                                title="Reset to Pending"
                              >
                                Reset
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleLoadOnStage(player.registrationId, localBasePrice)}
                              disabled={isCurrentlyActive || actionLoading}
                              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-amber-400 hover:text-slate-950 text-[11px] font-bold text-slate-300 transition-colors shrink-0 shadow"
                            >
                              {isCurrentlyActive ? 'On Block' : 'Load on Stage'}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenManualEditPlayer(player, status, localBasePrice, soldPrice, soldTeamName)}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-amber-400 transition-colors"
                            title="Edit Player Details & Status"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      )}

      {/* TAB 3: FRANCHISES & PURSE MANAGEMENT */}
      {activeTab === 'teams' && (
        <div className="flex-1 p-4 sm:p-6 max-w-6xl mx-auto w-full">
          <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6 shadow-xl">
            
            {/* Header & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-800">
              <div>
                <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-400" />
                  Franchises, Purse Budgets & Mobile PINs
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Set franchise names, team logos (from gallery or URL), purse budget, and share the 4-digit PIN for smartphone live bidding.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenAddTeam}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 shadow-lg hover:from-amber-300 hover:to-yellow-300"
                >
                  <Plus className="w-4 h-4 stroke-[3]" /> Add New Franchise
                </button>

                <button
                  onClick={() => {
                    if (confirm('Reset franchises back to 6 starter default teams? Any custom franchises will be overwritten.')) {
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

            {/* TEAM OWNER DIRECT BIDDING LINK SHARE BANNER */}
            <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-400/15 via-amber-400/5 to-slate-950 border border-amber-400/30 flex flex-wrap items-center justify-between gap-4 shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shrink-0 shadow">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider">
                    Team Owner Mobile Bidding Link
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5 font-mono select-all break-all">
                    {typeof window !== 'undefined' ? `${window.location.origin}/auction/${slug}/bid` : `/auction/${slug}/bid`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const link = typeof window !== 'undefined' ? `${window.location.origin}/auction/${slug}/bid` : `/auction/${slug}/bid`;
                    if (navigator?.clipboard) {
                      navigator.clipboard.writeText(link);
                      alert('Owner Bidding Link copied to clipboard!\n\n' + link);
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black uppercase flex items-center gap-1.5 shadow transition-all"
                >
                  <Copy className="w-3.5 h-3.5" /> Copy Owner Link
                </button>

                <Link
                  href={`/auction/${slug}/bid`}
                  target="_blank"
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Screen
                </Link>
              </div>
            </div>

            {/* Overall Purse Statistics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 bg-slate-950 p-4 rounded-2xl border border-slate-800">
              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">
                  TOTAL FRANCHISES
                </span>
                <div className="text-xl font-black text-white mt-0.5">
                  {teams.length} Teams
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  Purse Spent (Sold): ₹{spentPursePool.toLocaleString('en-IN')}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">
                  TOTAL PURSE POOL
                </span>
                <div className="text-xl font-black text-amber-400 font-mono mt-0.5">
                  ₹{totalPursePool.toLocaleString('en-IN')}
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">
                  REMAINING PURSE
                </span>
                <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">
                  ₹{remainingPursePool.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Franchise Cards List */}
            {teams.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <ShieldCheck className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-bold">No franchises created yet</p>
                <p className="text-xs text-slate-500 mt-1">
                  Click &quot;Add New Franchise&quot; above to create your own custom teams, or click &quot;Reset Default Teams&quot; to restore defaults.
                </p>
                <button
                  onClick={handleOpenAddTeam}
                  className="mt-4 px-4 py-2 rounded-xl bg-amber-400 text-slate-950 text-xs font-black uppercase shadow-lg hover:bg-amber-300"
                >
                  + Add Franchise
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((t) => {
                  const pursePct = Math.round(((t.remainingPurse || 0) / (t.totalPurse || 1)) * 100);

                  return (
                    <div
                      key={t.id}
                      className="p-4 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between shadow"
                    >
                      <div>
                        {/* Top Row: Logo, Name, Edit, Delete */}
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center font-black text-sm text-slate-950 shrink-0 shadow"
                              style={{ backgroundColor: t.color || '#f59e0b' }}
                            >
                              {t.logoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={t.logoUrl} alt={t.name} className="w-full h-full object-cover" />
                              ) : (
                                t.shortName || 'TM'
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-black text-white uppercase truncate flex items-center gap-2">
                                {t.name}
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-400">
                                  {t.shortName}
                                </span>
                              </h4>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Squad: <strong className="text-white">{t.boughtPlayersCount || 0}</strong> / {t.maxPlayers || 15} Players
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditTeam(t)}
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                              title="Edit Franchise"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTeam(t)}
                              className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
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
                            <span className="text-amber-300 font-bold">
                              ₹{t.remainingPurse.toLocaleString('en-IN')}{' '}
                              <span className="text-slate-500 font-normal">/ ₹{t.totalPurse.toLocaleString('en-IN')}</span>
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.max(0, Math.min(100, pursePct))}%`,
                                backgroundColor: t.color || '#f59e0b',
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Bottom Row: Mobile Bidding 4-Digit PIN & Share Invite */}
                      <div className="pt-2.5 border-t border-slate-900 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase text-slate-400">
                          MOBILE BIDDING PIN
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-lg bg-amber-400/15 border border-amber-400/30 text-amber-300 font-mono font-bold text-xs tracking-wider">
                            {t.secretPin}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyPin(t.secretPin, t.id)}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                            title="Copy PIN"
                          >
                            {copiedPinId === t.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const origin = typeof window !== 'undefined' ? window.location.origin : '';
                              const inviteText = `🏏 *CricBid Live Auction Invite - ${t.name}*\n\nApne mobile par live boli lagane ke liye is link ko open karein:\n🔗 ${origin}/auction/${slug}/bid\n\n📌 *Team:* ${t.name}\n🔑 *Secret 4-Digit PIN:* ${t.secretPin}\n\nIs link par ja kar apni team select karein aur PIN enter karke live auction me boli lagayein!`;
                              if (navigator?.clipboard) {
                                navigator.clipboard.writeText(inviteText);
                                alert(`Invitation message for ${t.name} copied to clipboard!\n\nAb WhatsApp par paste karke Owner/Captain ko bhej dijiye.`);
                              }
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center gap-1 transition-colors shadow-sm"
                            title="Copy WhatsApp Invite for this Team"
                          >
                            <Share2 className="w-3 h-3" />
                            <span>Share Invite</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </div>
      )}

      {/* TAB 4: ROOM & AUCTION SETTINGS */}
      {activeTab === 'settings' && (
        <div className="flex-1 p-4 sm:p-6 max-w-2xl mx-auto w-full">
          <div className="bg-slate-900/80 rounded-3xl border border-slate-800 p-6 shadow-xl">
            <h3 className="text-base font-black uppercase text-white mb-2 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5 text-amber-400" />
              Auction Rules & Default Stage Settings
            </h3>
            <p className="text-xs text-slate-400 mb-6">
              Configure default base price, bid increments, and countdown timer duration. All changes instantly reflect across Projector [TV] and mobile live screens.
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              {/* Default Starting Base Price */}
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
                  required
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
                  required
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
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-amber-400"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  The countdown timer resets to this duration every time a new bid is placed.
                </p>
              </div>

              {settingsSavedMsg && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-2 shadow">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> Room settings saved successfully! Projector and mobile synced.
                </div>
              )}

              <button
                type="submit"
                disabled={actionLoading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg hover:from-amber-300 hover:to-yellow-300 disabled:opacity-40 transition-all"
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

              {/* Team Logo Upload from Gallery */}
              <div>
                <label className="text-xs font-black uppercase text-slate-300 block mb-1.5">
                  Franchise Logo (Upload from Gallery)
                </label>

                <div className="flex items-center gap-3">
                  {/* Live Preview Avatar */}
                  <div
                    className="w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center font-black text-sm text-slate-950 shrink-0 border border-slate-700 shadow"
                    style={{ backgroundColor: teamFormColor }}
                  >
                    {teamFormLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={teamFormLogoUrl} alt="Logo preview" className="w-full h-full object-cover" />
                    ) : (
                      teamFormShortName || 'TM'
                    )}
                  </div>

                  {/* Upload from Gallery Button */}
                  <div className="flex-1">
                    <input
                      type="file"
                      ref={logoFileInputRef}
                      onChange={handleLogoFileUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => logoFileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition-colors shadow"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload from Gallery</span>
                    </button>
                    {teamFormLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setTeamFormLogoUrl('')}
                        className="text-[10px] text-rose-400 hover:underline mt-1 block"
                      >
                        Remove Logo
                      </button>
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
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      setTeamFormTotalPurse(val);
                      if (!editingTeam) setTeamFormRemainingPurse(val);
                    }}
                    min={0}
                    step="any"
                    required
                    placeholder="e.g. 100000"
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
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      setTeamFormMaxPlayers(val);
                    }}
                    min={1}
                    max={100}
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
                    onChange={(e) => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      setTeamFormRemainingPurse(val);
                    }}
                    min={0}
                    step="any"
                    placeholder="e.g. 100000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono focus:outline-none focus:border-amber-400"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Adjust only if correcting manual penalties or floor purchases.
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
                    Generate Random PIN
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 1111"
                  value={teamFormSecretPin}
                  onChange={(e) => setTeamFormSecretPin(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  maxLength={6}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-amber-400 text-sm font-mono tracking-widest text-center focus:outline-none focus:border-amber-400 font-bold"
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
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 font-black text-xs uppercase shadow-lg hover:from-amber-300 hover:to-yellow-300 transition-all"
                >
                  {editingTeam ? 'Save Changes' : 'Create Franchise'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MANUAL EDIT PLAYER AUCTION RECORD */}
      {showPlayerEditModal && editingPlayerObj && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-white">Manual Edit Player</h3>
                  <p className="text-xs text-amber-400 font-bold">{editingPlayerObj.fullName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPlayerEditModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveManualEditPlayer} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1.5 uppercase">
                  Auction Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['PENDING', 'IN_AUCTION', 'SOLD', 'UNSOLD'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setPlayerEditStatus(st)}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        playerEditStatus === st
                          ? st === 'SOLD'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 ring-2 ring-emerald-500/30'
                            : st === 'UNSOLD'
                            ? 'bg-rose-500/20 border-rose-500 text-rose-300 ring-2 ring-rose-500/30'
                            : 'bg-amber-500/20 border-amber-500 text-amber-300 ring-2 ring-amber-500/30'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      {st === 'PENDING' ? 'Pending (Pool)' : st === 'IN_AUCTION' ? 'In Auction (Block)' : st === 'SOLD' ? 'SOLD' : 'UNSOLD'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1 uppercase">
                  Base Price (₹)
                </label>
                <input
                  type="number"
                  value={playerEditBasePrice}
                  onChange={(e) => setPlayerEditBasePrice(e.target.value)}
                  step={100}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              {playerEditStatus === 'SOLD' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1 uppercase">
                      Sold Price (₹)
                    </label>
                    <input
                      type="number"
                      value={playerEditSoldPrice}
                      onChange={(e) => setPlayerEditSoldPrice(e.target.value)}
                      placeholder="Enter sold amount"
                      step={100}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-emerald-300 font-mono font-bold focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-400 block mb-1 uppercase">
                      Sold To Franchise
                    </label>
                    <select
                      value={playerEditSoldTeamId}
                      onChange={(e) => setPlayerEditSoldTeamId(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-400"
                    >
                      <option value="">-- Select Franchise --</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (Remaining Purse: ₹{t.remainingPurse?.toLocaleString('en-IN')})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowPlayerEditModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black uppercase shadow-lg disabled:opacity-40"
                >
                  Save & Apply Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
