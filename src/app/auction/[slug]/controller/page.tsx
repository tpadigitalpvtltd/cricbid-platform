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
  UserPlus,
} from 'lucide-react';
import { FullAuctionState, TournamentTeam, PlayerAuctionStatus, SoldRecord } from '@/lib/auctionTypes';
import { PlayingRole, BattingStyle, BowlingStyle } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/utils';

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


function isRealRasterDataUri(url?: string | null): boolean {
  return Boolean(url && url.startsWith('data:image/') && !url.startsWith('data:image/svg+xml'));
}

function getLocalCustomPlayersMap(slug?: string): Record<string, any> {
  if (!slug || typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(`cricbid_custom_players_${slug.toLowerCase()}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {}
  return {};
}

function isStateUnchanged(prev: FullAuctionState | null, incoming: FullAuctionState | null): boolean {
  if (prev === incoming) return true;
  if (!prev || !incoming) return false;

  const pr = prev.room;
  const ir = incoming.room;
  if (!pr || !ir) return false;

  if (
    pr.status !== ir.status ||
    pr.currentPlayerId !== ir.currentPlayerId ||
    pr.currentBid !== ir.currentBid ||
    pr.currentBiddingTeamId !== ir.currentBiddingTeamId ||
    pr.lastAction !== ir.lastAction ||
    pr.lastActionTimestamp !== ir.lastActionTimestamp ||
    pr.timerSeconds !== ir.timerSeconds ||
    pr.timerRunning !== ir.timerRunning
  ) {
    return false;
  }

  if (
    prev.currentPlayer?.registrationId !== incoming.currentPlayer?.registrationId ||
    prev.currentPlayer?.fullName !== incoming.currentPlayer?.fullName ||
    prev.currentPlayer?.role !== incoming.currentPlayer?.role ||
    prev.currentPlayer?.photoUrl !== incoming.currentPlayer?.photoUrl ||
    (prev.playersQueue?.length || 0) !== (incoming.playersQueue?.length || 0) ||
    prev.playersQueue?.[0]?.player?.photoUrl !== incoming.playersQueue?.[0]?.player?.photoUrl
  ) {
    return false;
  }

  if (
    (prev.teams?.length || 0) !== (incoming.teams?.length || 0) ||
    (prev.soldHistory?.length || 0) !== (incoming.soldHistory?.length || 0) ||
    (prev.recentBids?.length || 0) !== (incoming.recentBids?.length || 0)
  ) {
    return false;
  }

  if (prev.recentBids?.[0]?.id !== incoming.recentBids?.[0]?.id) {
    return false;
  }

  return true;
}

function mergeStateSafe(prev: FullAuctionState | null, incoming: FullAuctionState): FullAuctionState {
  if (!prev) return incoming;

  // 1. If data is identical, return the EXACT same object reference (prev)
  // This completely stops React re-renders and eliminates screen blinking/flashing!
  if (isStateUnchanged(prev, incoming)) {
    return prev;
  }

  const cleanSlug = (incoming.room?.tournamentSlug || prev.room?.tournamentSlug || '').toLowerCase();
  const customPlayersMap = getLocalCustomPlayersMap(cleanSlug);

  // 2. Protect against dropping current player during active bidding
  let resolvedPlayer = incoming.currentPlayer;
  let resolvedPlayerState = incoming.currentPlayerState;

  if (!resolvedPlayer && prev.currentPlayer && incoming.room?.status === 'ACTIVE') {
    resolvedPlayer = prev.currentPlayer;
    resolvedPlayerState = prev.currentPlayerState;
  }

  // 3. Maintain queue and hydrate real photos + custom edited player names/roles
  const incomingQueue = incoming.playersQueue || [];
  const prevQueue = prev.playersQueue || [];
  const baseQueue = incomingQueue.length >= prevQueue.length ? incomingQueue : prevQueue;
  const secondaryQueue = incomingQueue.length >= prevQueue.length ? prevQueue : incomingQueue;
  const secondaryPlayerMap = new Map<string, any>();
  secondaryQueue.forEach((pq: any) => {
    const pid = pq?.player?.registrationId;
    if (pid) {
      secondaryPlayerMap.set(pid, pq.player);
    }
  });

  let currentQueue = baseQueue.map((pq: any) => {
    const pid = pq?.player?.registrationId;
    if (!pid) return pq;
    const secPlayer = secondaryPlayerMap.get(pid);
    const customEntry = customPlayersMap[pid];
    const curUrl = pq?.player?.photoUrl || '';
    const secUrl = secPlayer?.photoUrl || '';
    const customUrl = customEntry?.photoUrl || '';

    // Always prefer real uploaded raster photo (JPEG/PNG/WebP) over generated SVG avatar or URL
    let bestPhoto = curUrl;
    if (isRealRasterDataUri(customUrl)) {
      bestPhoto = customUrl;
    } else if (!isRealRasterDataUri(curUrl) && isRealRasterDataUri(secUrl)) {
      bestPhoto = secUrl;
    } else if (!curUrl.startsWith('data:image/') && secUrl.startsWith('data:image/')) {
      bestPhoto = secUrl;
    }

    return {
      ...pq,
      basePrice: customEntry?.basePrice || pq.basePrice,
      player: {
        ...pq.player,
        fullName: customEntry?.fullName || pq.player.fullName,
        role: customEntry?.role || pq.player.role,
        age: customEntry?.age || pq.player.age,
        battingStyle: customEntry?.battingStyle || pq.player.battingStyle,
        bowlingStyle: customEntry?.bowlingStyle || pq.player.bowlingStyle,
        photoUrl: bestPhoto,
      },
    };
  });

  // Ensure any manually added players in customPlayersMap are never dropped if a cold-start poll arrives
  const queueIds = new Set(currentQueue.map((pq: any) => pq?.player?.registrationId));
  Object.values(customPlayersMap).forEach((cp: any) => {
    if (cp && cp.isManuallyAdded && cp.registrationId && !queueIds.has(cp.registrationId)) {
      currentQueue = [
        {
          player: {
            registrationId: cp.registrationId,
            tournamentSlug: cleanSlug,
            tournamentTitle: cleanSlug,
            fullName: cp.fullName,
            phone: cp.phone || '9876543210',
            age: String(cp.age || '24'),
            role: cp.role || 'Batting All-Rounder',
            battingStyle: cp.battingStyle || 'Right-hand',
            bowlingStyle: cp.bowlingStyle || 'Right-arm Fast',
            stats: cp.stats || 'Added by Admin',
            photoUrl: cp.photoUrl || '',
            paymentId: 'ADMIN_MANUAL',
            orderId: 'ADMIN_MANUAL',
            paymentStatus: 'PAID',
            amount: 0,
            timestamp: cp.timestamp || new Date().toISOString(),
          },
          status: 'PENDING',
          basePrice: cp.basePrice || 1000,
          soldPrice: null,
          soldTeamName: null,
          soldToTeamId: null,
        },
        ...currentQueue,
      ];
      queueIds.add(cp.registrationId);
    }
  });

  // Also ensure resolvedPlayer gets custom edited name/role and real raster data:image/ photoUrl
  if (resolvedPlayer) {
    const pid = resolvedPlayer.registrationId;
    const customEntry = customPlayersMap[pid];
    const matchedInQueue = currentQueue.find(
      (pq: any) => pq?.player?.registrationId === pid
    );
    let bestStagePhoto = resolvedPlayer.photoUrl || '';
    if (isRealRasterDataUri(customEntry?.photoUrl)) {
      bestStagePhoto = customEntry.photoUrl;
    } else if (!isRealRasterDataUri(bestStagePhoto) && isRealRasterDataUri(matchedInQueue?.player?.photoUrl)) {
      bestStagePhoto = matchedInQueue.player.photoUrl;
    } else if (
      !isRealRasterDataUri(bestStagePhoto) &&
      prev.currentPlayer?.registrationId === pid &&
      isRealRasterDataUri(prev.currentPlayer?.photoUrl)
    ) {
      bestStagePhoto = prev.currentPlayer!.photoUrl!;
    } else if (!bestStagePhoto.startsWith('data:image/') && matchedInQueue?.player?.photoUrl?.startsWith('data:image/')) {
      bestStagePhoto = matchedInQueue.player.photoUrl;
    }

    resolvedPlayer = {
      ...resolvedPlayer,
      fullName: customEntry?.fullName || matchedInQueue?.player?.fullName || resolvedPlayer.fullName,
      role: customEntry?.role || matchedInQueue?.player?.role || resolvedPlayer.role,
      age: customEntry?.age || matchedInQueue?.player?.age || resolvedPlayer.age,
      battingStyle: customEntry?.battingStyle || matchedInQueue?.player?.battingStyle || resolvedPlayer.battingStyle,
      bowlingStyle: customEntry?.bowlingStyle || matchedInQueue?.player?.bowlingStyle || resolvedPlayer.bowlingStyle,
      photoUrl: bestStagePhoto,
    };
  }

  const hydratedSoldHistory = (incoming.soldHistory && incoming.soldHistory.length > 0
    ? incoming.soldHistory
    : (prev.soldHistory || [])
  ).map((sh: any) => {
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
  let resolvedBiddingTeam = incoming.currentBiddingTeam;

  // Stale packet protection: only block incoming poll if user triggered a local action within the last 8 seconds!
  // Always allow currentQueue & photo upgrades so localStorage never traps stale player counts or missing photos.
  if (
    prevActionTime > incomingActionTime &&
    prev.room?.lastAction !== 'INIT' &&
    Date.now() - prevActionTime < 8000
  ) {
    return {
      ...prev,
      currentPlayer: resolvedPlayer || prev.currentPlayer,
      playersQueue: currentQueue,
    };
  } else {
    // BID PROTECTION: Never downgrade the bid on the same player unless explicit UNDO/RESET
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
    teams: incoming.teams && incoming.teams.length > 0 ? incoming.teams : (prev.teams || []),
    room: resolvedRoom,
    currentPlayer: resolvedPlayer,
    currentPlayerState: resolvedPlayerState,
    currentBiddingTeam: resolvedBiddingTeam,
    playersQueue: currentQueue,
    soldHistory: hydratedSoldHistory,
  };
}


export default function AuctioneerControllerPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [adminPin, setAdminPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState('');

  const [state, setState] = useState<FullAuctionState | null>(null);
  const stateRef = useRef<FullAuctionState | null>(null);
  const [loading, setLoading] = useState(true);
  const isFetchingStateRef = useRef(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Keep stateRef synchronized at all times
  useEffect(() => {
    if (state) {
      stateRef.current = state;
    }
  }, [state]);

  // Active view tab in controller
  const [activeTab, setActiveTab] = useState<'control' | 'players' | 'teams' | 'settings'>('control');

  // Filters for players queue
  const [roleFilter, setRoleFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SOLD' | 'UNSOLD'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Manual bid amount
  const [customBidAmount, setCustomBidAmount] = useState<number | ''>('');
  const [selectedTeamForBid, setSelectedTeamForBid] = useState<string>('');
  const [selectedIncrement, setSelectedIncrement] = useState<number>(1000);

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

  const serverOfflineUntilRef = useRef<number>(0);

  // Remote Projector Photo Zoom & Pan State (synced 0ms from Controller to Projector)
  const [photoZoomScale, setPhotoZoomScale] = useState<number>(1);
  const [photoPanY, setPhotoPanY] = useState<number>(0);
  const [photoFit, setPhotoFit] = useState<'contain' | 'cover'>('contain');

  const broadcastPhotoTransform = (scale: number, panY: number, fit: 'contain' | 'cover') => {
    setPhotoZoomScale(scale);
    setPhotoPanY(panY);
    setPhotoFit(fit);
    if (!slug) return;
    const cleanSlug = slug.toLowerCase();
    const packet = { type: 'PHOTO_TRANSFORM', zoomScale: scale, panY, photoFit: fit, ts: Date.now() };
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage(packet);
      } catch {}
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(`cricbid_photo_transform_${cleanSlug}`, JSON.stringify(packet));
      } catch {}
    }
    if (typeof window !== 'undefined') {
      try {
        const ntfyTopic = `cricbid_live_${cleanSlug.replace(/[^a-z0-9]/g, '_').slice(0, 48)}`;
        fetch(`https://ntfy.sh/${ntfyTopic}`, {
          method: 'POST',
          body: JSON.stringify(packet),
        }).catch(() => {});
      } catch {}
    }
  };

  const fetchState = async () => {
    if (!slug || isFetchingStateRef.current) return;
    if (Date.now() < serverOfflineUntilRef.current && stateRef.current) {
      setLoading(false);
      return;
    }
    isFetchingStateRef.current = true;
    try {
      const res = await fetch(`/api/auction/${slug}?t=${Date.now()}`, { cache: 'no-store' });
      if (res.status === 503 || res.status === 504) {
        serverOfflineUntilRef.current = Date.now() + 45000;
        if (!stateRef.current) {
          const seedRes = await fetch('/seed/ympl-state.json').catch(() => null);
          if (seedRes && seedRes.ok) {
            const seedJson = await seedRes.json();
            if (seedJson?.state) {
              setState(seedJson.state);
              stateRef.current = seedJson.state;
            }
          }
        }
        return;
      }
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.state) {
          const prevLocal = stateRef.current;
          const serverTs = Number(json.state.room?.lastActionTimestamp) || 0;
          const localTs = Number(prevLocal?.room?.lastActionTimestamp) || 0;

          setState((prev) => {
            const merged = mergeStateSafe(prev, json.state);
            stateRef.current = merged;
            return merged;
          });

          // If a cold-started serverless instance is behind our active controller state, heal it immediately
          if (prevLocal && localTs > serverTs && prevLocal.room?.lastAction !== 'INIT') {
            fetch(`/api/auction/${slug}/action`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'SYNC_FULL_STATE',
                adminPin: adminPin || 'Shoaib@55',
                clientSync: buildClientSyncPayload(prevLocal),
              }),
            }).catch(() => {});
          }

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
      if (!stateRef.current) {
        try {
          const seedRes = await fetch('/seed/ympl-state.json');
          if (seedRes.ok) {
            const seedJson = await seedRes.json();
            if (seedJson?.state) {
              setState(seedJson.state);
              stateRef.current = seedJson.state;
            }
          }
        } catch {}
      }
    } finally {
      isFetchingStateRef.current = false;
      setLoading(false);
    }
  };

  const saveCustomPlayerLocal = (playerData: {
    registrationId: string;
    fullName?: string;
    role?: string;
    age?: string | number;
    battingStyle?: string;
    bowlingStyle?: string;
    stats?: string;
    basePrice?: number;
    photoUrl?: string;
    isManuallyAdded?: boolean;
  }) => {
    if (!slug || !playerData.registrationId || typeof window === 'undefined' || !window.localStorage) return;
    try {
      const cleanSlug = slug.toLowerCase();
      const key = `cricbid_custom_players_${cleanSlug}`;
      const existing = getLocalCustomPlayersMap(cleanSlug);
      const prevEntry = existing[playerData.registrationId] || {};
      existing[playerData.registrationId] = {
        ...prevEntry,
        ...playerData,
        photoUrl: isRealRasterDataUri(playerData.photoUrl)
          ? playerData.photoUrl
          : prevEntry.photoUrl || playerData.photoUrl || '',
        updatedAt: Date.now(),
      };
      window.localStorage.setItem(key, JSON.stringify(existing));
    } catch {}
  };

  // Build compact authoritative state snapshot to keep serverless containers 100% in sync
  const buildClientSyncPayload = (s: FullAuctionState | null) => {
    if (!s) return undefined;
    const playerStatesMap: Record<string, any> = {};
    if (Array.isArray(s.playersQueue)) {
      s.playersQueue.forEach((pq: any) => {
        const pid = pq.player?.registrationId;
        if (!pid) return;
        if (pq.status !== 'PENDING' || (pq.basePrice && pq.basePrice !== 1000)) {
          playerStatesMap[pid] = {
            playerId: pid,
            tournamentSlug: slug,
            status: pq.status,
            basePrice: pq.basePrice || 1000,
            soldPrice: pq.soldPrice || null,
            soldToTeamId: pq.soldToTeamId || null,
            soldToTeamName: pq.soldTeamName || pq.soldToTeamName || null,
          };
        }
      });
    }
    const customMap = getLocalCustomPlayersMap(slug);
    const customPlayers = Object.values(customMap);
    return {
      room: s.room,
      teams: s.teams,
      playerStates: playerStatesMap,
      customPlayers: customPlayers.length > 0 ? customPlayers : undefined,
    };
  };

  // Toast notification state (replaces blocking alerts)
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' | 'info' } | null>(null);

  const showToast = (message: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
    }, 3500);
  };

  // Ultra-Fast Bid Queue & Concurrency Controls
  const isBidInFlightRef = useRef(false);
  const nextQueuedBidRef = useRef<{ teamId: string; amount: number } | null>(null);
  const hammerCancelledRef = useRef(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const supabaseChannelRef = useRef<any>(null);

  // Initialize native cross-tab BroadcastChannel + localStorage hydration for 0ms instantaneous projector sync
  useEffect(() => {
    if (!slug || typeof window === 'undefined') return;
    const cleanSlug = slug.toLowerCase();

    // Hydrate controller immediately from localStorage if available
    try {
      const savedFull = window.localStorage.getItem(`cricbid_controller_full_${cleanSlug}`);
      if (savedFull) {
        const parsed = JSON.parse(savedFull);
        if (parsed?.state?.room && Array.isArray(parsed.state.playersQueue) && parsed.state.playersQueue.length > 0) {
          setState(parsed.state);
          stateRef.current = parsed.state;
          setLoading(false);
        }
      }
    } catch {}

    let bc: BroadcastChannel | null = null;
    if ('BroadcastChannel' in window) {
      bc = new BroadcastChannel(`cricbid_auction_${cleanSlug}`);
      bc.onmessage = (evt) => {
        if (evt.data?.type === 'STATE_UPDATE' && evt.data?.state) {
          setState((prev) => {
            const merged = mergeStateSafe(prev, evt.data.state);
            stateRef.current = merged;
            return merged;
          });
        }
      };
      broadcastChannelRef.current = bc;
    }

    // Connect to SSE stream (/api/auction/[slug]/stream) for <2ms server push (e.g. mobile team owner bids)
    let es: EventSource | null = null;
    if ('EventSource' in window) {
      try {
        es = new EventSource(`/api/auction/${slug}/stream`);
        es.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data?.state?.room) {
              setState((prev) => {
                const merged = mergeStateSafe(prev, data.state);
                stateRef.current = merged;
                return merged;
              });
            }
          } catch {}
        };
      } catch {}
    }

    return () => {
      if (bc) bc.close();
      broadcastChannelRef.current = null;
      if (es) es.close();
    };
  }, [slug]);

  // Multi-Layer Broadcast Helper: Mirrors state in 0ms (Same Device) & <50ms (Cross-Device)
  const broadcastStateToScreens = (newState: FullAuctionState) => {
    if (!newState || !slug) return;
    const now = Date.now();
    const cleanSlug = slug.toLowerCase();

    // 1. Native cross-tab BroadcastChannel (0.05ms delay on same laptop/browser)
    if (broadcastChannelRef.current) {
      try {
        broadcastChannelRef.current.postMessage({ type: 'STATE_UPDATE', state: newState, ts: now });
      } catch (e) {}
    }

    // 2. Native localStorage storage event (0.1ms delay across all windows/popups + persists across refresh)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const leanForStorage: FullAuctionState = {
          ...newState,
          playersQueue: [],
        };
        window.localStorage.setItem(
          `cricbid_live_state_${cleanSlug}`,
          JSON.stringify({ state: leanForStorage, ts: now })
        );
        window.localStorage.setItem(
          `cricbid_controller_full_${cleanSlug}`,
          JSON.stringify({ state: newState, ts: now })
        );
      } catch (e) {}
    }

    // 3. Cross-Device Instant Push via public WebSocket Relay (ntfy.sh) — strictly < 2.2KB so ntfy never turns it into an attachment!
    if (typeof window !== 'undefined') {
      try {
        const ntfyTopic = `cricbid_live_${cleanSlug.replace(/[^a-z0-9]/g, '_').slice(0, 48)}`;
        const cp = newState.currentPlayer;
        const cbt = newState.currentBiddingTeam;
        const ultraCompactState = {
          room: newState.room,
          currentPlayer: cp
            ? {
                registrationId: cp.registrationId,
                fullName: cp.fullName,
                age: cp.age,
                role: cp.role,
                battingStyle: cp.battingStyle,
                bowlingStyle: cp.bowlingStyle,
                photoUrl: cp.photoUrl && cp.photoUrl.startsWith('data:') ? `/api/player-photo/${cp.registrationId}` : cp.photoUrl,
                tournamentTitle: cp.tournamentTitle,
              }
            : null,
          currentPlayerState: newState.currentPlayerState,
          currentBiddingTeam: cbt
            ? {
                id: cbt.id,
                name: cbt.name,
                shortName: cbt.shortName,
                color: cbt.color,
                logoUrl: cbt.logoUrl && cbt.logoUrl.startsWith('data:') ? `/api/team-logo/${cbt.id}` : cbt.logoUrl,
                remainingPurse: cbt.remainingPurse,
                totalPurse: cbt.totalPurse,
                maxPlayers: cbt.maxPlayers,
                boughtPlayersCount: cbt.boughtPlayersCount,
              }
            : null,
          teams: (newState.teams || []).map((t) => ({
            id: t.id,
            name: t.name,
            shortName: t.shortName,
            color: t.color,
            logoUrl: t.logoUrl && t.logoUrl.startsWith('data:') ? `/api/team-logo/${t.id}` : t.logoUrl,
            totalPurse: t.totalPurse,
            remainingPurse: t.remainingPurse,
            maxPlayers: t.maxPlayers,
            boughtPlayersCount: t.boughtPlayersCount,
          })),
          recentBids: (newState.recentBids || []).slice(0, 3),
          soldHistory: (newState.soldHistory || []).slice(0, 3),
          playersQueue: [],
        };
        fetch(`https://ntfy.sh/${ntfyTopic}`, {
          method: 'POST',
          body: JSON.stringify({ type: 'STATE_UPDATE', state: ultraCompactState, ts: now }),
        }).catch(() => {});
      } catch (e) {}
    }

    // 4. Supabase WebSocket (if available)
    if (supabaseChannelRef.current) {
      try {
        supabaseChannelRef.current.send({
          type: 'broadcast',
          event: 'STATE_UPDATE',
          payload: { state: { ...newState, playersQueue: [] } },
        }).catch(() => {});
      } catch (e) {}
    }
  };

  // Synchronous 0ms Optimistic Updater + Immediate Screen Broadcast
  const applyOptimisticAndBroadcast = (
    updater: (prev: FullAuctionState) => FullAuctionState
  ): FullAuctionState | null => {
    const baseState = stateRef.current || state;
    if (!baseState) return null;
    const nextState = updater(baseState);
    stateRef.current = nextState;
    setState(nextState);
    broadcastStateToScreens(nextState);
    return nextState;
  };

  useEffect(() => {
    fetchState();
    // 1500ms lightweight polling fallback
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchState();
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [slug]);

  // Realtime subscription (instant state update in <30ms without round-trip HTTP)
  useEffect(() => {
    if (!slug) return;
    const channel = supabase.channel(`auction_${slug.toLowerCase()}`);
    supabaseChannelRef.current = channel;

    const onIncoming = (msg: any) => {
      if (msg?.payload?.state) {
        setState((prev) => {
          const merged = mergeStateSafe(prev, msg.payload.state);
          stateRef.current = merged;
          return merged;
        });
      } else {
        fetchState();
      }
    };

    channel
      .on('broadcast', { event: 'BID_PLACED' }, onIncoming)
      .on('broadcast', { event: 'STATE_UPDATE' }, onIncoming)
      .on('broadcast', { event: '*' }, onIncoming)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabaseChannelRef.current = null;
    };
  }, [slug]);

  // Manual Player Edit Modal State
  const [showPlayerEditModal, setShowPlayerEditModal] = useState(false);
  const [editingPlayerObj, setEditingPlayerObj] = useState<any | null>(null);
  const [playerEditFullName, setPlayerEditFullName] = useState<string>('');
  const [playerEditRole, setPlayerEditRole] = useState<string>('Batting All-Rounder');
  const [playerEditAge, setPlayerEditAge] = useState<string>('24');
  const [playerEditBatting, setPlayerEditBatting] = useState<string>('Right-hand');
  const [playerEditBowling, setPlayerEditBowling] = useState<string>('Right-arm Fast');
  const [playerEditStatus, setPlayerEditStatus] = useState<string>('PENDING');
  const [playerEditBasePrice, setPlayerEditBasePrice] = useState<number | string>(1000);
  const [playerEditSoldPrice, setPlayerEditSoldPrice] = useState<number | string>('');
  const [playerEditSoldTeamId, setPlayerEditSoldTeamId] = useState<string>('');
  const [playerEditPhotoUrl, setPlayerEditPhotoUrl] = useState<string>('');
  const editPlayerPhotoInputRef = useRef<HTMLInputElement>(null);
  const [isPhotoCompressing, setIsPhotoCompressing] = useState<boolean>(false);

  // Manual Add Player State
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [addPlayerName, setAddPlayerName] = useState('');
  const [addPlayerPhone, setAddPlayerPhone] = useState('');
  const [addPlayerAge, setAddPlayerAge] = useState<number | string>(24);
  const [addPlayerRole, setAddPlayerRole] = useState<PlayingRole>('Batting All-Rounder');
  const [addPlayerBatting, setAddPlayerBatting] = useState<BattingStyle>('Right-hand');
  const [addPlayerBowling, setAddPlayerBowling] = useState<BowlingStyle>('Right-arm Fast');
  const [addPlayerStats, setAddPlayerStats] = useState('');
  const [addPlayerBasePrice, setAddPlayerBasePrice] = useState<number | string>(1000);
  const [addPlayerPhotoUrl, setAddPlayerPhotoUrl] = useState('');
  const [addPlayerLoading, setAddPlayerLoading] = useState(false);
  const playerPhotoInputRef = useRef<HTMLInputElement>(null);

  // Auto-Next Player State & Timers (Defaults to FALSE for full Manual Auctioneer Control)
  const [isAutoNextEnabled, setIsAutoNextEnabled] = useState<boolean>(true);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const autoNextTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoNextIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 5-Second Final Call Hammer Countdown State
  const [hammerSecondsLeft, setHammerSecondsLeft] = useState<number | null>(null);
  const hammerTimerRef = useRef<NodeJS.Timeout | null>(null);

  const cancelHammerCountdown = () => {
    hammerCancelledRef.current = true;
    if (hammerTimerRef.current) {
      clearInterval(hammerTimerRef.current);
      hammerTimerRef.current = null;
    }
    setHammerSecondsLeft(null);
    applyOptimisticAndBroadcast((prev) => ({
      ...prev,
      room: {
        ...prev.room,
        timerRunning: false,
        lastAction: 'CANCEL_HAMMER',
        lastActionTimestamp: Date.now(),
      },
    }));
    executeAction('CANCEL_HAMMER').catch(() => {});
  };

  const startHammerCountdown = () => {
    if (!currentPlayer) {
      showToast('Please load an active player on stage first.', 'error');
      return;
    }
    if (hammerTimerRef.current) {
      cancelHammerCountdown();
      return;
    }

    hammerCancelledRef.current = false;
    setHammerSecondsLeft(5);
    applyOptimisticAndBroadcast((prev) => ({
      ...prev,
      room: {
        ...prev.room,
        timerSeconds: 5,
        timerRunning: true,
        lastAction: 'HAMMER_5S',
        lastActionTimestamp: Date.now(),
      },
    }));
    executeAction('START_HAMMER_5S').catch(() => {});

    let count = 5;
    hammerTimerRef.current = setInterval(() => {
      if (hammerCancelledRef.current) {
        if (hammerTimerRef.current) {
          clearInterval(hammerTimerRef.current);
          hammerTimerRef.current = null;
        }
        setHammerSecondsLeft(null);
        return;
      }

      count -= 1;
      if (count <= 0) {
        if (hammerTimerRef.current) {
          clearInterval(hammerTimerRef.current);
          hammerTimerRef.current = null;
        }
        setHammerSecondsLeft(null);

        if (hammerCancelledRef.current) return;

        // Auto action on 0s ONLY if hammer genuinely completed:
        if (stateRef.current?.currentBiddingTeam || currentBiddingTeam) {
          handleMarkSold();
        } else {
          handleMarkUnsold();
        }
      } else {
        setHammerSecondsLeft(count);
      }
    }, 1000);
  };

  const clearAutoNextTimers = () => {
    if (autoNextTimerRef.current) {
      clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    if (autoNextIntervalRef.current) {
      clearInterval(autoNextIntervalRef.current);
      autoNextIntervalRef.current = null;
    }
    setAutoNextCountdown(null);
    if (hammerTimerRef.current) {
      clearInterval(hammerTimerRef.current);
      hammerTimerRef.current = null;
      setHammerSecondsLeft(null);
    }
  };

  useEffect(() => {
    return () => {
      clearAutoNextTimers();
    };
  }, []);

  const executeAction = async (action: string, payload?: any) => {
    if (!slug) return;

    // Instant 0ms optimistic broadcast for direct status/player actions
    const now = Date.now();
    if (action === 'PAUSE') {
      applyOptimisticAndBroadcast((prev) => ({
        ...prev,
        room: { ...prev.room, status: 'PAUSED', timerRunning: false, lastAction: 'PAUSE', lastActionTimestamp: now },
      }));
    } else if (action === 'RESUME' || action === 'START') {
      applyOptimisticAndBroadcast((prev) => ({
        ...prev,
        room: { ...prev.room, status: 'ACTIVE', timerRunning: true, lastAction: 'RESUME', lastActionTimestamp: now },
      }));
    } else if (action === 'RESET_TIMER') {
      applyOptimisticAndBroadcast((prev) => ({
        ...prev,
        room: { ...prev.room, timerSeconds: 10, timerRunning: false, lastAction: 'RESET', lastActionTimestamp: now },
      }));
    } else if ((action === 'SET_PLAYER' || action === 'REAUCTION_PLAYER') && payload?.playerId) {
      applyOptimisticAndBroadcast((prev) => {
        const matched = prev.playersQueue.find((pq) => pq.player.registrationId === payload.playerId);
        if (!matched) return prev;
        const bp = Number(payload.basePrice) || matched.basePrice || prev.room.basePrice || 1000;
        return {
          ...prev,
          currentPlayer: matched.player,
          currentPlayerState: {
            playerId: matched.player.registrationId,
            tournamentSlug: slug,
            status: 'IN_AUCTION',
            basePrice: bp,
            updatedAt: new Date().toISOString(),
          },
          room: {
            ...prev.room,
            currentPlayerId: matched.player.registrationId,
            currentBid: bp,
            currentBiddingTeamId: null,
            timerSeconds: 10,
            timerRunning: prev.room.status === 'ACTIVE',
            lastAction: 'NEXT',
            lastActionTimestamp: now,
          },
          currentBiddingTeam: null,
        };
      });
    }

    if (Date.now() < serverOfflineUntilRef.current) {
      return { success: true };
    }

    try {
      setActionLoading(true);
      const res = await fetch(`/api/auction/${slug}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          payload,
          adminPin: adminPin || 'Shoaib@55',
          clientSync: buildClientSyncPayload(stateRef.current),
        }),
      });

      if (res.status === 503 || res.status === 504) {
        serverOfflineUntilRef.current = Date.now() + 45000;
        return { success: true };
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        if (res.status === 401) {
          showToast(json.error || 'Failed to execute action', 'error');
          setIsAuthenticated(false);
          setPinError('Session expired. Please enter Admin PIN again.');
        }
      } else if (json.state) {
        setState((prev) => {
          const merged = mergeStateSafe(prev, json.state);
          stateRef.current = merged;
          broadcastStateToScreens(merged);
          return merged;
        });
      }
      return json;
    } catch (e: any) {
      console.warn('Action network warning (auto-recovering):', e?.message);
      return { success: true };
    } finally {
      setActionLoading(false);
    }
  };

  // Ultra-Fast Bid Request Dispatcher with in-flight queue serialization
  const dispatchBidRequest = async (teamId: string, amount: number) => {
    if (Date.now() < serverOfflineUntilRef.current) {
      isBidInFlightRef.current = false;
      return;
    }
    isBidInFlightRef.current = true;
    try {
      const res = await fetch(`/api/auction/${slug}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          amount,
          clientSync: buildClientSyncPayload(stateRef.current),
        }),
      });

      if (res.status === 503 || res.status === 504) {
        serverOfflineUntilRef.current = Date.now() + 45000;
        return;
      }

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        if (json.error && !json.error.includes('must be higher') && !json.error.includes('exceeded')) {
          showToast(json.error || 'Unable to place bid', 'error');
        }
      } else if (json.state) {
        setState((prev) => {
          const merged = mergeStateSafe(prev, json.state);
          stateRef.current = merged;
          broadcastStateToScreens(merged);
          return merged;
        });
        setCustomBidAmount('');
      }
    } catch (e: any) {
      console.warn('Bid dispatch network warning (auto-recovering):', e?.message);
    } finally {
      isBidInFlightRef.current = false;
      // If a newer bid tap was queued while this request was in-flight, dispatch it immediately!
      if (nextQueuedBidRef.current) {
        const next = nextQueuedBidRef.current;
        nextQueuedBidRef.current = null;
        dispatchBidRequest(next.teamId, next.amount);
      }
    }
  };

  const handlePlaceFloorBid = async (teamId: string, amount: number) => {
    if (!slug || !teamId || !amount) return;

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(40);
    }

    // Cancel any running 5-second hammer countdown on new bid
    hammerCancelledRef.current = true;
    if (hammerTimerRef.current) {
      clearInterval(hammerTimerRef.current);
      hammerTimerRef.current = null;
      setHammerSecondsLeft(null);
    }

    // Instant 0ms synchronous optimistic update + immediate broadcast to Projector!
    const now = Date.now();
    const team = teams.find((t) => t.id === teamId);
    applyOptimisticAndBroadcast((prev) => {
      const newBidEntry = {
        id: `bid_${now}`,
        auctionId: prev.room.id,
        tournamentSlug: slug,
        playerId: prev.currentPlayer?.registrationId || prev.room.currentPlayerId || '',
        teamId,
        teamName: team?.name || 'Team',
        teamShortName: team?.shortName || 'TM',
        teamLogoUrl: team?.logoUrl || '',
        amount,
        createdAt: new Date(now).toISOString(),
      };
      return {
        ...prev,
        room: {
          ...prev.room,
          currentBid: amount,
          currentBiddingTeamId: teamId,
          timerSeconds: 10,
          timerRunning: false,
          lastAction: 'NEW_BID',
          lastActionTimestamp: now,
        },
        currentBiddingTeam: team || prev.currentBiddingTeam,
        recentBids: [newBidEntry, ...(prev.recentBids || [])].slice(0, 15),
      };
    });

    if (isBidInFlightRef.current) {
      nextQueuedBidRef.current = { teamId, amount };
    } else {
      dispatchBidRequest(teamId, amount);
    }
  };

  // Instant 1-Tap Direct Team Bidding (+₹1,000)
  const handleDirectTeamBid = async (teamId: string) => {
    if (!currentPlayer) {
      showToast('Please load a player on stage first.', 'error');
      return;
    }
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;

    if (currentBiddingTeam?.id === teamId) {
      showToast(`${team.name} is already the leading bidder!`, 'info');
      return;
    }

    let bidAmount: number;
    if (!currentBiddingTeam || currentBid === 0) {
      bidAmount = state?.currentPlayerState?.basePrice || room.basePrice || 1000;
    } else {
      bidAmount = currentBid + 1000;
    }

    if (team.remainingPurse < bidAmount) {
      showToast(`Insufficient balance! ${team.name} has only ₹${team.remainingPurse.toLocaleString('en-IN')}`, 'error');
      return;
    }

    if (team.boughtPlayersCount >= team.maxPlayers) {
      showToast(`${team.name} has already filled their max squad limit of ${team.maxPlayers} players!`, 'error');
      return;
    }

    handlePlaceFloorBid(teamId, bidAmount);
  };

  // 0ms INSTANT OPTIMISTIC PLAYER NAVIGATION (Prefers next un-auctioned PENDING player)
  const handleNextPlayerOptimistic = (preferPending: boolean | any = true) => {
    const isPrefer = typeof preferPending === 'boolean' ? preferPending : true;
    clearAutoNextTimers();
    const activeState = stateRef.current || state;
    const queue = activeState?.playersQueue || playersQueue;
    if (queue.length === 0) return;
    const currId = activeState?.currentPlayer?.registrationId || currentPlayer?.registrationId;
    const currIdx = queue.findIndex((pq) => pq.player.registrationId === currId);

    let nextItem: any = null;
    if (isPrefer) {
      const pendingList = queue.filter(
        (pq) => pq.status === 'PENDING' && pq.player.registrationId !== currId
      );
      if (pendingList.length > 0) {
        const randIdx = Math.floor(Math.random() * pendingList.length);
        nextItem = pendingList[randIdx];
      }
    }

    if (!nextItem && !isPrefer) {
      const nextIdx = currIdx >= 0 && currIdx < queue.length - 1 ? currIdx + 1 : 0;
      nextItem = queue[nextIdx];
    }

    if (!nextItem) {
      const soldCount = queue.filter((pq) => pq.status === 'SOLD').length;
      const unsoldCount = queue.filter((pq) => pq.status === 'UNSOLD').length;
      setLastDecisionMsg({
        type: 'SOLD',
        text: `🏆 All ${queue.length} players in the draft pool have been auctioned! (${soldCount} Sold, ${unsoldCount} Unsold)`,
      });
      return;
    }

    const basePrice = nextItem.basePrice || room.basePrice || 1000;
    const now = Date.now();

    // 0ms instant synchronous update + broadcast to Projector
    applyOptimisticAndBroadcast((prev) => ({
      ...prev,
      currentPlayer: nextItem.player,
      currentPlayerState: {
        playerId: nextItem.player.registrationId,
        tournamentSlug: slug,
        status: 'IN_AUCTION',
        basePrice,
        updatedAt: new Date(now).toISOString(),
      },
      room: {
        ...prev.room,
        currentPlayerId: nextItem.player.registrationId,
        currentBid: basePrice,
        currentBiddingTeamId: null,
        timerSeconds: 10,
        timerRunning: prev.room.status === 'ACTIVE',
        lastAction: 'NEXT',
        lastActionTimestamp: now,
      },
      currentBiddingTeam: null,
    }));

    executeAction('NEXT_PLAYER', { playerId: nextItem.player.registrationId }).catch((e) => console.error(e));
  };

  const handlePrevPlayerOptimistic = () => {
    clearAutoNextTimers();
    const activeState = stateRef.current || state;
    const queue = activeState?.playersQueue || playersQueue;
    if (queue.length === 0) return;
    const currId = activeState?.currentPlayer?.registrationId || currentPlayer?.registrationId;
    const currIdx = queue.findIndex((pq) => pq.player.registrationId === currId);
    const prevIdx = currIdx > 0 ? currIdx - 1 : queue.length - 1;
    const prevItem = queue[prevIdx];
    if (!prevItem) return;

    const basePrice = prevItem.basePrice || room.basePrice || 1000;
    const now = Date.now();

    // 0ms instant synchronous update + broadcast to Projector
    applyOptimisticAndBroadcast((prev) => ({
      ...prev,
      currentPlayer: prevItem.player,
      currentPlayerState: {
        playerId: prevItem.player.registrationId,
        tournamentSlug: slug,
        status: 'IN_AUCTION',
        basePrice,
        updatedAt: new Date(now).toISOString(),
      },
      room: {
        ...prev.room,
        currentPlayerId: prevItem.player.registrationId,
        currentBid: basePrice,
        currentBiddingTeamId: null,
        timerSeconds: 10,
        timerRunning: prev.room.status === 'ACTIVE',
        lastAction: 'NEXT',
        lastActionTimestamp: now,
      },
      currentBiddingTeam: null,
    }));

    executeAction('PREV_PLAYER', { playerId: prevItem.player.registrationId }).catch((e) => console.error(e));
  };

  // Skip Player to Pool with instant 0ms optimistic transition
  const handleSkipPlayer = async () => {
    clearAutoNextTimers();
    const activeState = stateRef.current || state;
    const queue = activeState?.playersQueue || playersQueue;
    if (queue.length === 0) return;
    const currId = activeState?.currentPlayer?.registrationId || currentPlayer?.registrationId;
    const currIdx = queue.findIndex((pq) => pq.player.registrationId === currId);
    const pendingList = queue.filter(
      (pq) => pq.status === 'PENDING' && pq.player.registrationId !== currId
    );
    let nextItem: any = null;
    if (pendingList.length > 0) {
      const randomIdx = Math.floor(Math.random() * pendingList.length);
      nextItem = pendingList[randomIdx];
    }
    if (!nextItem) {
      const nextIdx = currIdx >= 0 && currIdx < queue.length - 1 ? currIdx + 1 : 0;
      nextItem = queue[nextIdx];
    }
    if (!nextItem) return;

    const basePrice = nextItem.basePrice || room.basePrice || 1000;
    const now = Date.now();

    // 0ms instant synchronous update + broadcast to Projector
    applyOptimisticAndBroadcast((prev) => ({
      ...prev,
      currentPlayer: nextItem.player,
      currentPlayerState: {
        playerId: nextItem.player.registrationId,
        tournamentSlug: slug,
        status: 'IN_AUCTION',
        basePrice,
        updatedAt: new Date(now).toISOString(),
      },
      room: {
        ...prev.room,
        currentPlayerId: nextItem.player.registrationId,
        currentBid: basePrice,
        currentBiddingTeamId: null,
        timerSeconds: 10,
        timerRunning: prev.room.status === 'ACTIVE',
        lastAction: 'NEXT',
        lastActionTimestamp: now,
      },
      currentBiddingTeam: null,
    }));

    setLastDecisionMsg({
      type: 'UNSOLD',
      text: `⏩ Player skipped to draft pool.`,
    });
    setTimeout(() => setLastDecisionMsg(null), 4000);

    executeAction('SKIP_PLAYER', { playerId: nextItem.player.registrationId }).catch((e) => console.error(e));
  };

  // Decision Handler: SOLD
  const handleMarkSold = async () => {
    const activeState = stateRef.current || state;
    const activePlayer = activeState?.currentPlayer || currentPlayer;
    const activeBidTeam = activeState?.currentBiddingTeam || currentBiddingTeam;
    const activeBidAmount = activeState?.room?.currentBid || currentBid;

    if (!activePlayer) return;
    if (!activeBidTeam) {
      showToast('Cannot mark as SOLD: No franchise has placed a bid yet! Select a team and place at least one bid.', 'error');
      return;
    }
    clearAutoNextTimers();

    const soldPrice = activeBidAmount;
    const soldTeamName = activeBidTeam.name;
    const playerName = activePlayer.fullName;
    const now = Date.now();

    // Instant 0ms synchronous update + broadcast to Projector (triggers SOLD modal + confetti immediately!)
    applyOptimisticAndBroadcast((prev) => {
      const updatedPlayersQueue = prev.playersQueue.map((pq) =>
        pq.player.registrationId === activePlayer.registrationId
          ? {
              ...pq,
              status: 'SOLD' as const,
              soldPrice,
              soldToTeamId: activeBidTeam.id,
              soldTeamName: activeBidTeam.name,
              soldToTeamName: activeBidTeam.name,
            }
          : pq
      );
      const updatedTeams = prev.teams.map((t) =>
        t.id === activeBidTeam.id
          ? {
              ...t,
              remainingPurse: Math.max(0, t.remainingPurse - soldPrice),
              boughtPlayersCount: (t.boughtPlayersCount || 0) + 1,
            }
          : t
      );
      const newSoldRecord = {
        player: activePlayer,
        soldPrice,
        team: activeBidTeam,
        soldAt: new Date(now).toISOString(),
      };
      return {
        ...prev,
        room: {
          ...prev.room,
          lastAction: 'SOLD',
          lastActionTimestamp: now,
          timerRunning: false,
        },
        playersQueue: updatedPlayersQueue,
        teams: updatedTeams,
        soldHistory: [
          newSoldRecord,
          ...(prev.soldHistory || []).filter((sh) => sh.player?.registrationId !== activePlayer.registrationId),
        ],
      };
    });

    setLastDecisionMsg({
      type: 'SOLD',
      text: `🎉 SOLD! ${playerName} sold to ${soldTeamName} for ₹${soldPrice.toLocaleString('en-IN')}!`,
    });

    executeAction('MARK_SOLD').catch((err) => console.error(err));

    // Auto-advance to next un-auctioned player after 2.4 seconds
    if (isAutoNextEnabled) {
      setAutoNextCountdown(2);
      autoNextIntervalRef.current = setInterval(() => {
        setAutoNextCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (autoNextIntervalRef.current) clearInterval(autoNextIntervalRef.current);
            return null;
          }
          return prev - 1;
        });
      }, 1000);

      autoNextTimerRef.current = setTimeout(() => {
        clearAutoNextTimers();
        handleNextPlayerOptimistic(true);
      }, 2400);
    } else {
      setTimeout(() => setLastDecisionMsg(null), 8000);
    }
  };

  // Decision Handler: UNSOLD
  const handleMarkUnsold = async () => {
    const activeState = stateRef.current || state;
    const activePlayer = activeState?.currentPlayer || currentPlayer;
    if (!activePlayer) return;
    clearAutoNextTimers();

    const playerName = activePlayer.fullName;
    const now = Date.now();

    // Instant 0ms synchronous update + broadcast to Projector (triggers UNSOLD modal + buzzer immediately!)
    applyOptimisticAndBroadcast((prev) => {
      const updatedPlayersQueue = prev.playersQueue.map((pq) =>
        pq.player.registrationId === activePlayer.registrationId
          ? {
              ...pq,
              status: 'UNSOLD' as const,
              soldPrice: null,
              soldToTeamId: null,
              soldTeamName: null,
              soldToTeamName: null,
            }
          : pq
      );
      return {
        ...prev,
        room: {
          ...prev.room,
          lastAction: 'UNSOLD',
          lastActionTimestamp: now,
          timerRunning: false,
          currentBiddingTeamId: null,
        },
        playersQueue: updatedPlayersQueue,
        currentBiddingTeam: null,
      };
    });

    setLastDecisionMsg({
      type: 'UNSOLD',
      text: `⚠️ ${playerName} marked as UNSOLD.`,
    });

    executeAction('MARK_UNSOLD').catch((err) => console.error(err));

    // Auto-advance to next un-auctioned player after 1.8 seconds
    if (isAutoNextEnabled) {
      setAutoNextCountdown(2);
      autoNextIntervalRef.current = setInterval(() => {
        setAutoNextCountdown((prev) => {
          if (prev === null || prev <= 1) {
            if (autoNextIntervalRef.current) clearInterval(autoNextIntervalRef.current);
            return null;
          }
          return prev - 1;
        });
      }, 900);

      autoNextTimerRef.current = setTimeout(() => {
        clearAutoNextTimers();
        handleNextPlayerOptimistic(true);
      }, 1800);
    } else {
      setTimeout(() => setLastDecisionMsg(null), 6000);
    }
  };

  // Open Manual Player Edit Modal
  const handleOpenManualEditPlayer = (
    player: any,
    currentStatus: string,
    basePrice?: number,
    soldPrice?: number | null,
    soldTeamName?: string | null
  ) => {
    setEditingPlayerObj(player);
    setPlayerEditFullName(player.fullName || '');
    setPlayerEditRole(player.role || 'Batting All-Rounder');
    setPlayerEditAge(String(player.age || '24'));
    setPlayerEditBatting(player.battingStyle || 'Right-hand');
    setPlayerEditBowling(player.bowlingStyle || 'Right-arm Fast');
    setPlayerEditStatus(currentStatus || 'PENDING');
    setPlayerEditBasePrice(basePrice || 1000);
    setPlayerEditSoldPrice(soldPrice !== undefined && soldPrice !== null ? soldPrice : '');
    setPlayerEditPhotoUrl(player.photoUrl || '');
    const currentTeam = teams.find((t) => t.name === soldTeamName);
    setPlayerEditSoldTeamId(currentTeam ? currentTeam.id : '');
    setShowPlayerEditModal(true);
  };

  // Upload/Change Player Photo in Edit Modal with high-speed compression
  const handleEditPlayerPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsPhotoCompressing(true);
      const dataUrl = await compressImage(file, 600, 600, 0.85);
      setPlayerEditPhotoUrl(dataUrl);
      showToast('Player photo compressed & ready to save!', 'success');
    } catch (err) {
      console.error('Photo compression error:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setPlayerEditPhotoUrl(event.target.result as string);
          showToast('Photo uploaded!', 'success');
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsPhotoCompressing(false);
    }
  };

  // Save Manual Player Edit
  const handleSaveManualEditPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayerObj) return;

    const updatedName = playerEditFullName.trim() || editingPlayerObj.fullName;
    const updatedRole = playerEditRole || editingPlayerObj.role || 'Batting All-Rounder';
    const updatedAge = String(playerEditAge || editingPlayerObj.age || '24');
    const updatedBatting = playerEditBatting || editingPlayerObj.battingStyle || 'Right-hand';
    const updatedBowling = playerEditBowling || editingPlayerObj.bowlingStyle || 'Right-arm Fast';
    const updatedPhoto = playerEditPhotoUrl || editingPlayerObj.photoUrl || '';

    const baseP = Number(playerEditBasePrice) > 0 ? Number(playerEditBasePrice) : 1000;
    const isSold = playerEditStatus === 'SOLD';
    const soldP = isSold ? (playerEditSoldPrice !== '' ? Number(playerEditSoldPrice) : baseP) : undefined;
    const soldTeamId = isSold ? playerEditSoldTeamId : undefined;

    if (isSold && !soldTeamId) {
      showToast('Please select the Franchise to which this player is SOLD.', 'error');
      return;
    }

    const now = Date.now();
    const targetPid = editingPlayerObj.registrationId;

    // 1. Persist locally so background polls never revert this player's name, role, or photo
    saveCustomPlayerLocal({
      registrationId: targetPid,
      fullName: updatedName,
      role: updatedRole,
      age: updatedAge,
      battingStyle: updatedBatting,
      bowlingStyle: updatedBowling,
      basePrice: baseP,
      photoUrl: updatedPhoto,
    });

    // 2. 0ms instant optimistic update + broadcast to Projector TV
    applyOptimisticAndBroadcast((prev) => ({
      ...prev,
      room: {
        ...prev.room,
        basePrice: prev.room.currentPlayerId === targetPid ? baseP : prev.room.basePrice,
        currentBid:
          prev.room.currentPlayerId === targetPid && !prev.room.currentBiddingTeamId
            ? baseP
            : prev.room.currentBid,
        lastActionTimestamp: now,
      },
      currentPlayer:
        prev.currentPlayer && prev.currentPlayer.registrationId === targetPid
          ? {
              ...prev.currentPlayer,
              fullName: updatedName,
              role: updatedRole as any,
              age: updatedAge,
              battingStyle: updatedBatting as any,
              bowlingStyle: updatedBowling as any,
              photoUrl: updatedPhoto,
            }
          : prev.currentPlayer,
      playersQueue: (prev.playersQueue || []).map((pq) =>
        pq.player.registrationId === targetPid
          ? {
              ...pq,
              status: playerEditStatus as any,
              basePrice: baseP,
              soldPrice: soldP || null,
              player: {
                ...pq.player,
                fullName: updatedName,
                role: updatedRole as any,
                age: updatedAge,
                battingStyle: updatedBatting as any,
                bowlingStyle: updatedBowling as any,
                photoUrl: updatedPhoto,
              },
            }
          : pq
      ),
    }));

    // Also broadcast dedicated PLAYER_PHOTO packet if photo is a real raster Data URI
    if (isRealRasterDataUri(updatedPhoto) && slug && typeof window !== 'undefined') {
      const cleanSlug = slug.toLowerCase();
      const photoPkt = { type: 'PLAYER_PHOTO', playerId: targetPid, photoUrl: updatedPhoto, ts: now };
      if (broadcastChannelRef.current) {
        try {
          broadcastChannelRef.current.postMessage(photoPkt);
        } catch {}
      }
      try {
        window.localStorage.setItem(`cricbid_stage_photo_${cleanSlug}`, JSON.stringify(photoPkt));
      } catch {}
    }

    setShowPlayerEditModal(false);
    setEditingPlayerObj(null);
    showToast(`✅ Saved "${updatedName}" (Name + Photo + Details)!`, 'success');

    await executeAction('MANUAL_EDIT_PLAYER_AUCTION', {
      playerId: targetPid,
      fullName: updatedName,
      role: updatedRole,
      age: updatedAge,
      battingStyle: updatedBatting,
      bowlingStyle: updatedBowling,
      status: playerEditStatus,
      basePrice: baseP,
      soldPrice: soldP,
      soldToTeamId: soldTeamId,
      photoUrl: updatedPhoto || undefined,
    });
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
    clearAutoNextTimers();
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

  // Release / Mark Unsold a specific player directly from a team card
  const handleReleasePlayerFromTeam = async (player: any, team: TournamentTeam, soldPrice: number) => {
    const confirmMsg = `Kya aap "${player.fullName}" ko "${team.name}" se nikal kar UNSOLD karna chahte hain?\n\n₹${soldPrice.toLocaleString('en-IN')} automatically "${team.name}" ke purse me wapas add (refund) ho jayenge.`;
    if (!confirm(confirmMsg)) return;

    // Instant optimistic UI update (0ms latency)
    setState((prev) => {
      if (!prev) return prev;
      const updatedSoldHistory = prev.soldHistory.filter((sh) => sh.player.registrationId !== player.registrationId);
      const updatedTeams = prev.teams.map((t) => {
        if (t.id === team.id) {
          return {
            ...t,
            remainingPurse: t.remainingPurse + soldPrice,
            boughtPlayersCount: Math.max(0, (t.boughtPlayersCount || 1) - 1),
          };
        }
        return t;
      });
      const updatedPlayersQueue = prev.playersQueue.map((pq) => {
        if (pq.player.registrationId === player.registrationId) {
          return {
            ...pq,
            status: 'UNSOLD' as PlayerAuctionStatus,
            soldPrice: undefined,
            soldTeamName: undefined,
            soldToTeamId: undefined,
          };
        }
        return pq;
      });

      return {
        ...prev,
        teams: updatedTeams,
        soldHistory: updatedSoldHistory,
        playersQueue: updatedPlayersQueue,
      };
    });

    setLastDecisionMsg({
      type: 'UNSOLD',
      text: `↩️ ${player.fullName} released from ${team.name} back to UNSOLD. ₹${soldPrice.toLocaleString('en-IN')} refunded to purse.`,
    });
    setTimeout(() => setLastDecisionMsg(null), 6000);

    const res = await executeAction('MARK_UNSOLD', { playerId: player.registrationId });
    if (!res?.success) {
      fetchState();
    }
  };

  // Re-Auction a player directly from a team card
  const handleReAuctionFromTeam = async (player: any, team: TournamentTeam, soldPrice: number) => {
    const confirmMsg = `Kya aap "${player.fullName}" ko wapas Live Stage par la kar RE-AUCTION karna chahte hain?\n\nIsse "${team.name}" ka ₹${soldPrice.toLocaleString('en-IN')} purse refund ho jayega aur player live stage par aa jayega.`;
    if (!confirm(confirmMsg)) return;

    const res = await executeAction('REAUCTION_PLAYER', { playerId: player.registrationId });
    if (res?.success) {
      setActiveTab('control'); // Switch directly to live auction stage
      setLastDecisionMsg({
        type: 'SOLD',
        text: `🔥 ${player.fullName} is now LIVE on the bidding stage for Re-Auction!`,
      });
      setTimeout(() => setLastDecisionMsg(null), 6000);
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
      showToast('Please select an image file (PNG, JPG, WEBP)', 'error');
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
      showToast('Please enter Franchise Name', 'error');
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

  // Delete team with instant optimistic UI update
  const handleDeleteTeam = async (team: TournamentTeam) => {
    if (confirm(`Are you sure you want to remove franchise "${team.name}" from the auction?`)) {
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          teams: prev.teams.filter((t) => t.id !== team.id),
        };
      });
      showToast(`Franchise "${team.name}" removed from auction.`, 'success');
      await executeAction('DELETE_TEAM', { teamId: team.id });
    }
  };

  const stagePhotoInputRef = useRef<HTMLInputElement>(null);

  // Instant 1-Click Photo Upload right on the Active Stage Player Card (0ms Sync to Projector TV)
  const handleStageQuickPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const activePlayer = stateRef.current?.currentPlayer || currentPlayer;
    if (!file || !activePlayer) return;

    try {
      setIsPhotoCompressing(true);
      const dataUrl = await compressImage(file, 520, 520, 0.84);
      const now = Date.now();
      const pid = activePlayer.registrationId;

      saveCustomPlayerLocal({
        registrationId: pid,
        fullName: activePlayer.fullName,
        role: activePlayer.role,
        age: activePlayer.age,
        battingStyle: activePlayer.battingStyle,
        bowlingStyle: activePlayer.bowlingStyle,
        photoUrl: dataUrl,
      });

      applyOptimisticAndBroadcast((prev) => ({
        ...prev,
        room: {
          ...prev.room,
          lastActionTimestamp: now,
        },
        currentPlayer: prev.currentPlayer
          ? { ...prev.currentPlayer, photoUrl: dataUrl }
          : prev.currentPlayer,
        playersQueue: (prev.playersQueue || []).map((pq) =>
          pq.player.registrationId === pid
            ? { ...pq, player: { ...pq.player, photoUrl: dataUrl } }
            : pq
        ),
      }));

      // Also broadcast dedicated PLAYER_PHOTO packet for cross-device / localStorage cache
      if (slug && typeof window !== 'undefined') {
        const cleanSlug = slug.toLowerCase();
        const photoPkt = { type: 'PLAYER_PHOTO', playerId: pid, photoUrl: dataUrl, ts: now };
        if (broadcastChannelRef.current) {
          try {
            broadcastChannelRef.current.postMessage(photoPkt);
          } catch {}
        }
        try {
          window.localStorage.setItem(`cricbid_stage_photo_${cleanSlug}`, JSON.stringify(photoPkt));
        } catch {}
        try {
          const ntfyTopic = `cricbid_live_${cleanSlug.replace(/[^a-z0-9]/g, '_').slice(0, 48)}`;
          fetch(`https://ntfy.sh/${ntfyTopic}`, {
            method: 'POST',
            body: JSON.stringify(photoPkt),
          }).catch(() => {});
        } catch {}
      }

      showToast(`📸 Photo updated on Live Projector for ${activePlayer.fullName}!`, 'success');
      executeAction('MANUAL_EDIT_PLAYER_AUCTION', {
        playerId: pid,
        photoUrl: dataUrl,
      }).catch(() => {});
    } catch (err) {
      showToast('Could not process photo', 'error');
    } finally {
      setIsPhotoCompressing(false);
      if (e.target) e.target.value = '';
    }
  };

  // Add New Player Photo Upload with automatic compression
  const handlePlayerPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsPhotoCompressing(true);
      const dataUrl = await compressImage(file, 520, 520, 0.84);
      setAddPlayerPhotoUrl(dataUrl);
      showToast('Photo uploaded & optimized successfully!', 'success');
    } catch (err) {
      console.error('Photo compression error:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAddPlayerPhotoUrl(event.target.result as string);
          showToast('Photo uploaded!', 'success');
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsPhotoCompressing(false);
    }
  };

  // Save New Player Action Handler (0ms Instant Direct Save + Optional Direct Stage Load)
  const handleSaveNewPlayer = async (e?: React.FormEvent, loadOnStage: boolean = false) => {
    if (e) e.preventDefault();
    if (!addPlayerName.trim()) {
      showToast('Please enter Player Name', 'error');
      return;
    }

    const now = Date.now();
    const tempRegId = `CRIC-2026-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const basePrice = Number(addPlayerBasePrice) || 1000;
    const playerName = addPlayerName.trim();
    const playerPhone = addPlayerPhone.trim() || '9876543210';
    const playerAge = String(addPlayerAge || '24');
    const playerStats = addPlayerStats.trim() || 'Added by Admin';
    const playerPhoto = addPlayerPhotoUrl || '';

    const newPlayerObj = {
      registrationId: tempRegId,
      tournamentSlug: slug,
      tournamentTitle: state?.room?.tournamentSlug || slug,
      fullName: playerName,
      phone: playerPhone,
      age: playerAge,
      role: addPlayerRole,
      battingStyle: addPlayerBatting,
      bowlingStyle: addPlayerBowling,
      stats: playerStats,
      photoUrl: playerPhoto,
      paymentId: 'ADMIN_MANUAL',
      orderId: 'ADMIN_MANUAL',
      paymentStatus: 'PAID' as const,
      amount: 0,
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    };

    const newPlayerItem: FullAuctionState['playersQueue'][0] = {
      player: newPlayerObj,
      status: loadOnStage ? 'IN_AUCTION' : 'PENDING',
      basePrice,
      soldPrice: null,
      soldTeamName: null,
      soldToTeamId: null,
    };

    saveCustomPlayerLocal({
      registrationId: tempRegId,
      fullName: playerName,
      role: addPlayerRole,
      age: playerAge,
      battingStyle: addPlayerBatting,
      bowlingStyle: addPlayerBowling,
      stats: playerStats,
      basePrice,
      photoUrl: playerPhoto,
      isManuallyAdded: true,
    });

    // 0ms instant optimistic update + immediate broadcast to Projector TV!
    applyOptimisticAndBroadcast((prev) => {
      const currentQueue = prev.playersQueue || [];
      if (loadOnStage) {
        return {
          ...prev,
          currentPlayer: newPlayerObj,
          currentPlayerState: {
            playerId: tempRegId,
            tournamentSlug: slug,
            status: 'IN_AUCTION',
            basePrice,
            updatedAt: new Date(now).toISOString(),
          },
          currentBiddingTeam: null,
          room: {
            ...prev.room,
            currentPlayerId: tempRegId,
            currentBid: basePrice,
            currentBiddingTeamId: null,
            timerSeconds: 10,
            timerRunning: prev.room.status === 'ACTIVE',
            lastAction: 'NEXT',
            lastActionTimestamp: now,
          },
          playersQueue: [newPlayerItem, ...currentQueue],
        };
      }
      return {
        ...prev,
        room: {
          ...prev.room,
          lastActionTimestamp: now,
        },
        playersQueue: [newPlayerItem, ...currentQueue],
      };
    });

    if (playerPhoto && slug && typeof window !== 'undefined') {
      const cleanSlug = slug.toLowerCase();
      const photoPkt = { type: 'PLAYER_PHOTO', playerId: tempRegId, photoUrl: playerPhoto, ts: now };
      try {
        window.localStorage.setItem(`cricbid_stage_photo_${cleanSlug}`, JSON.stringify(photoPkt));
      } catch {}
    }

    if (loadOnStage) {
      setActiveTab('control');
      showToast(`🔥 "${playerName}" saved & loaded LIVE on Bidding Stage!`, 'success');
    } else {
      showToast(`✅ Player "${playerName}" saved directly to tournament pool!`, 'success');
    }

    // Reset modal & close immediately in 0ms - no waiting!
    setShowAddPlayerModal(false);
    setAddPlayerName('');
    setAddPlayerPhone('');
    setAddPlayerAge(24);
    setAddPlayerRole('Batting All-Rounder');
    setAddPlayerBatting('Right-hand');
    setAddPlayerBowling('Right-arm Fast');
    setAddPlayerStats('');
    setAddPlayerBasePrice(1000);
    setAddPlayerPhotoUrl('');

    // Persist to backend in background
    try {
      setAddPlayerLoading(true);
      await executeAction('ADD_PLAYER', {
        loadOnStage,
        player: {
          registrationId: tempRegId,
          fullName: playerName,
          phone: playerPhone,
          age: playerAge,
          role: addPlayerRole,
          battingStyle: addPlayerBatting,
          bowlingStyle: addPlayerBowling,
          stats: playerStats,
          basePrice,
          photoUrl: playerPhoto,
        },
      });
    } catch (err: any) {
      console.warn('Background add player sync notice:', err?.message);
    } finally {
      setAddPlayerLoading(false);
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
      showToast('Please enter a valid base price', 'error');
      return;
    }
    await executeAction('UPDATE_PLAYER_BASE_PRICE', {
      playerId,
      basePrice: price,
    });
    showToast(`Base price updated to ₹${price.toLocaleString('en-IN')}`, 'success');
  };

  // Load a player onto stage and switch tab to Bidding Desk immediately
  const handleLoadOnStage = async (playerId: string, basePrice: number) => {
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

  const { room, currentPlayer, currentBiddingTeam, teams, playersQueue, soldHistory = [] } = state || {
    room: { status: 'WAITING', currentBid: 0, basePrice: 1000, bidIncrement: 500, timerSeconds: 10 },
    currentPlayer: null,
    currentBiddingTeam: null,
    teams: [],
    playersQueue: [],
    soldHistory: [],
  };

  const currentBid = room.currentBid || room.basePrice || 1000;
  const currentIncrement = selectedIncrement || room.bidIncrement || 1000;
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
    <div className="min-h-screen bg-[#070b16] text-white flex flex-col font-sans relative">
      
      {/* Sleek Floating Toast Notification (Non-blocking replacement for browser alerts) */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] sm:w-full animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`p-3.5 rounded-2xl shadow-2xl border flex items-center justify-between gap-3 backdrop-blur-xl ${
              toast.type === 'error'
                ? 'bg-rose-950/95 border-rose-500/50 text-rose-200 shadow-rose-950/60'
                : toast.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200 shadow-emerald-950/60'
                : 'bg-slate-900/95 border-slate-700 text-slate-200 shadow-black/80'
            }`}
          >
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
              <span>{toast.type === 'error' ? '⚠️' : toast.type === 'success' ? '✅' : 'ℹ️'}</span>
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-xs font-bold opacity-70 hover:opacity-100 px-1 py-0.5 rounded"
            >
              ✕
            </button>
          </div>
        </div>
      )}

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
          <button
            type="button"
            onClick={() => setShowAddPlayerModal(true)}
            className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black uppercase flex items-center gap-1.5 transition-all shadow-md"
            title="Manually Add New Player (0ms Direct Save)"
          >
            <UserPlus className="w-3.5 h-3.5" /> + Add Player
          </button>

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
            onClick={() => {
              if (stateRef.current) broadcastStateToScreens(stateRef.current);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-400 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <Tv className="w-3.5 h-3.5" /> Projector [TV]
          </Link>

          <button
            type="button"
            onClick={() => {
              if (stateRef.current) broadcastStateToScreens(stateRef.current);
              window.open(`/auction/${slug}`, 'CricBidProjectorTV', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no');
            }}
            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1 transition-colors"
            title="Open Dedicated 0ms Instant Projector Window (Drag to 2nd Screen / HDMI)"
          >
            <ExternalLink className="w-3.5 h-3.5" /> 0ms Popup TV
          </button>

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

          <button
            type="button"
            onClick={() => setIsAutoNextEnabled(!isAutoNextEnabled)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm ${
              isAutoNextEnabled
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 ring-1 ring-emerald-500/30'
                : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="Automatically load the next un-auctioned player after Sold/Unsold"
          >
            <Zap className={`w-3.5 h-3.5 ${isAutoNextEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span>Auto-Next: {isAutoNextEnabled ? 'ON' : 'OFF'}</span>
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
                    type="button"
                    onClick={() => setShowAddPlayerModal(true)}
                    className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-colors flex items-center gap-1 shadow"
                    title="Manually Add New Player (0ms Save)"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> + Add Player
                  </button>
                  <button
                    onClick={handleSkipPlayer}
                    disabled={actionLoading}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 text-xs font-bold transition-colors flex items-center gap-1"
                    title="Skip player to pool"
                  >
                    <SkipForward className="w-3.5 h-3.5" /> Skip
                  </button>
                  <button
                    onClick={handlePrevPlayerOptimistic}
                    disabled={actionLoading}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Previous Player"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleNextPlayerOptimistic(true)}
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
                    {autoNextCountdown !== null && (
                      <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                        <Zap className="w-3 h-3 text-yellow-300" /> Next in {autoNextCountdown}s...
                      </span>
                    )}
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
                      onClick={() => handleNextPlayerOptimistic(true)}
                      disabled={actionLoading}
                      className="px-3 py-1.5 rounded-xl bg-white text-slate-950 font-black text-xs uppercase tracking-wider shrink-0 hover:bg-slate-200 transition-colors shadow flex items-center gap-1"
                    >
                      <span>Next Player</span>
                      <SkipForward className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {currentPlayer ? (
                <div className="flex items-center gap-5 mb-5">
                  <div className="relative group shrink-0">
                    <input
                      type="file"
                      ref={stagePhotoInputRef}
                      onChange={handleStageQuickPhotoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl p-[2px] bg-gradient-to-tr from-amber-400 to-emerald-400 shadow-lg">
                      <div className="w-full h-full rounded-[14px] bg-slate-950 overflow-hidden flex items-center justify-center relative">
                        {currentPlayer.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={`${currentPlayer.registrationId}_${currentPlayer.photoUrl.slice(-24)}`}
                            src={currentPlayer.photoUrl}
                            alt={currentPlayer.fullName}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                              const parent = (e.target as HTMLElement).parentElement;
                              if (parent) {
                                const fallback = parent.querySelector('.stage-initials-badge');
                                if (fallback) (fallback as HTMLElement).style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div
                          className="stage-initials-badge w-full h-full bg-slate-900 flex items-center justify-center font-black text-amber-400 text-2xl"
                          style={{ display: currentPlayer.photoUrl ? 'none' : 'flex' }}
                        >
                          {getInitials(currentPlayer.fullName)}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => stagePhotoInputRef.current?.click()}
                      disabled={isPhotoCompressing}
                      className="mt-1.5 w-full py-1 px-2 rounded-lg bg-slate-800 hover:bg-amber-400 text-amber-300 hover:text-slate-950 border border-amber-400/30 text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-all shadow"
                      title="Upload or change photo for this player (Instant 0ms sync to Projector TV)"
                    >
                      <Upload className="w-3 h-3" />
                      <span>{isPhotoCompressing ? 'Wait...' : '📷 Photo'}</span>
                    </button>
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
                    <div className="flex flex-wrap items-center gap-2 mt-2">
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
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenManualEditPlayer(
                            currentPlayer,
                            state?.currentPlayerState?.status || 'IN_AUCTION',
                            room.basePrice
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-amber-400/15 hover:bg-amber-400 text-amber-300 hover:text-slate-950 border border-amber-400/40 text-[11px] font-black uppercase flex items-center gap-1 transition-all shadow-sm"
                        title="Edit Player Name, Role, Base Price & Photo"
                      >
                        <Edit className="w-3 h-3" /> Edit Name / Photo
                      </button>
                    </div>

                    {/* Remote Projector Photo Zoom & Fit Controls (0ms Sync to TV) */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-800/80">
                      <span className="text-[10px] font-black uppercase text-slate-400 mr-1">TV Photo:</span>
                      <button
                        type="button"
                        onClick={() => broadcastPhotoTransform(Math.max(0.6, +(photoZoomScale - 0.15).toFixed(2)), photoPanY, photoFit)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold border border-slate-700"
                        title="Zoom Out Photo on Projector"
                      >
                        - Zoom
                      </button>
                      <span className="text-[10px] font-mono text-amber-400 font-bold px-1">
                        {Math.round(photoZoomScale * 100)}%
                      </span>
                      <button
                        type="button"
                        onClick={() => broadcastPhotoTransform(Math.min(2.5, +(photoZoomScale + 0.15).toFixed(2)), photoPanY, photoFit)}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-bold border border-slate-700"
                        title="Zoom In Photo on Projector"
                      >
                        + Zoom
                      </button>
                      <button
                        type="button"
                        onClick={() => broadcastPhotoTransform(photoZoomScale, photoPanY - 8, photoFit)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold border border-slate-700"
                        title="Move Photo Up on Projector"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={() => broadcastPhotoTransform(photoZoomScale, photoPanY + 8, photoFit)}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold border border-slate-700"
                        title="Move Photo Down on Projector"
                      >
                        ▼
                      </button>
                      <button
                        type="button"
                        onClick={() => broadcastPhotoTransform(photoZoomScale, photoPanY, photoFit === 'contain' ? 'cover' : 'contain')}
                        className="px-2 py-0.5 rounded bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 text-[10px] font-black uppercase border border-amber-400/30"
                      >
                        {photoFit === 'contain' ? 'Full Fit' : 'Fill Box'}
                      </button>
                      <button
                        type="button"
                        onClick={() => broadcastPhotoTransform(1, 0, 'contain')}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-rose-500/30 text-slate-300 hover:text-rose-200 text-[10px] font-bold border border-slate-700"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-xs">No active player loaded on auction block</p>
                  <button
                    onClick={() => handleNextPlayerOptimistic(true)}
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

            {/* 5-SECOND FINAL CALL HAMMER BUTTON */}
            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={hammerSecondsLeft !== null ? cancelHammerCountdown : startHammerCountdown}
                disabled={actionLoading || !currentPlayer || autoNextCountdown !== null}
                className={`w-full py-4 px-4 rounded-2xl font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-95 cursor-pointer ${
                  hammerSecondsLeft !== null
                    ? 'bg-rose-600 hover:bg-rose-500 text-white animate-pulse border-2 border-amber-300 shadow-[0_0_30px_rgba(244,63,94,0.6)]'
                    : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                }`}
              >
                <Gavel className="w-5 h-5 stroke-[2.5]" />
                {hammerSecondsLeft !== null ? (
                  <span className="flex items-center gap-2">
                    <span>⚠️ FINAL CALL ACTIVE:</span>
                    <span className="px-2 py-0.5 rounded-md bg-black text-amber-400 font-mono text-sm font-black">
                      {hammerSecondsLeft}s
                    </span>
                    <span className="text-[11px] underline ml-1">(CLICK TO CANCEL)</span>
                  </span>
                ) : (
                  <span>⚡ 5s FINAL CALL &rarr; AUTO SOLD (GOING ONCE, TWICE...)</span>
                )}
              </button>
            </div>

            {/* BIG DECISION BUTTONS: MARK SOLD / UNSOLD */}
            <div className="grid grid-cols-2 gap-3 pt-3">
              <button
                onClick={handleMarkSold}
                disabled={actionLoading || !currentBiddingTeam || autoNextCountdown !== null}
                className="py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
                <span>MARK AS SOLD</span>
              </button>

              <button
                onClick={handleMarkUnsold}
                disabled={actionLoading || !currentPlayer || autoNextCountdown !== null}
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

              {/* DIRECT 1-TAP FRANCHISE BIDDING (+₹1,000 PER CLICK) */}
              <div className="mb-2">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-amber-400 block">
                      Franchises (Tap Any Team to Place Bid)
                    </label>
                    <span className="text-[11px] text-slate-400">
                      Direct 1-tap bidding: each click advances bid by <strong className="text-amber-300">+₹1,000</strong>
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    ⚡ 1-Tap Active
                  </span>
                </div>

                {teams.length === 0 ? (
                  <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-500">
                    No franchises registered yet. Go to <strong className="text-amber-400">Franchises & Purse</strong> tab to add teams.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {teams.map((t) => {
                      const isCurrentHolding = currentBiddingTeam?.id === t.id;
                      const nextAmount = !currentBiddingTeam || currentBid === 0
                        ? (state?.currentPlayerState?.basePrice || room.basePrice || 1000)
                        : (currentBid + 1000);
                      const canAfford = t.remainingPurse >= nextAmount;
                      const hasSquadRoom = t.boughtPlayersCount < t.maxPlayers;
                      const canBid = canAfford && hasSquadRoom && !isCurrentHolding && Boolean(currentPlayer);

                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleDirectTeamBid(t.id)}
                          disabled={actionLoading || !canBid}
                          className={`p-3.5 rounded-2xl border text-left transition-all relative transform active:scale-95 cursor-pointer shadow-md flex flex-col justify-between ${
                            isCurrentHolding
                              ? 'border-emerald-400 bg-emerald-500/20 ring-2 ring-emerald-400/50 shadow-[0_0_20px_rgba(16,185,129,0.25)]'
                              : canAfford && hasSquadRoom
                              ? 'border-slate-800 bg-slate-950 hover:border-amber-400 hover:bg-slate-900/90'
                              : 'border-slate-900 bg-slate-950/60 opacity-40 cursor-not-allowed'
                          }`}
                        >
                          <div>
                            <div className="flex items-center gap-2.5 mb-2">
                              <div
                                className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center font-black text-xs text-slate-950 shrink-0 shadow"
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
                                <span className="text-xs font-black text-white truncate block">
                                  {t.name}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  Purse: <strong className={!canAfford ? 'text-rose-400' : 'text-amber-300'}>₹{t.remainingPurse.toLocaleString('en-IN')}</strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Direct Tap Action Pill */}
                          <div className="pt-2 border-t border-slate-800/80">
                            {isCurrentHolding ? (
                              <span className="w-full py-2 rounded-xl text-xs font-black uppercase bg-emerald-500 text-slate-950 flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                                <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" /> Leading Bidder
                              </span>
                            ) : !canAfford ? (
                              <span className="w-full py-2 rounded-xl text-[11px] font-black uppercase bg-rose-950/60 border border-rose-900/80 text-rose-300 flex items-center justify-center gap-1">
                                ⚠️ Insufficient Purse
                              </span>
                            ) : !hasSquadRoom ? (
                              <span className="w-full py-2 rounded-xl text-[11px] font-black uppercase bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center gap-1">
                                Squad Full ({t.maxPlayers})
                              </span>
                            ) : (
                              <span className="w-full py-2 rounded-xl text-xs font-black uppercase bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-slate-950 flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/20 font-mono">
                                {!currentBiddingTeam ? `Open ₹${nextAmount.toLocaleString('en-IN')}` : `+ Bid ₹${nextAmount.toLocaleString('en-IN')}`}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
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
                <button
                  type="button"
                  onClick={() => setShowAddPlayerModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-amber-500/20 transition-all shrink-0 ml-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Add Player</span>
                </button>
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
                        <div className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center shadow relative">
                          {player.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={player.photoUrl}
                              alt={player.fullName}
                              loading="lazy"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                                const parent = (e.target as HTMLElement).parentElement;
                                if (parent) {
                                  const fallback = parent.querySelector('.initials-badge');
                                  if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}
                          <span
                            className="initials-badge font-black text-amber-400 text-xs flex items-center justify-center w-full h-full"
                            style={{ display: player.photoUrl ? 'none' : 'flex' }}
                          >
                            {getInitials(player.fullName)}
                          </span>
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
                      showToast('Owner Bidding Link copied to clipboard!', 'success');
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
                  const teamSoldPlayers = (soldHistory as SoldRecord[]).filter(
                    (sh: SoldRecord) =>
                      sh.team?.id === t.id ||
                      (sh.team?.name && t.name && sh.team.name.trim().toLowerCase() === t.name.trim().toLowerCase())
                  );
                  const squadCount = teamSoldPlayers.length;
                  const totalTeamSpent = teamSoldPlayers.reduce((sum: number, sp: SoldRecord) => sum + (sp.soldPrice || 0), 0);

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
                                Squad: <strong className="text-white">{squadCount}</strong> / {t.maxPlayers || 15} Players
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

                        {/* Bought Squad Players Section */}
                        <div className="mt-3 pt-3 border-t border-slate-900">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[11px] font-black uppercase text-slate-300 tracking-wider flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-amber-400" />
                              Squad Players ({squadCount})
                            </span>
                            {squadCount > 0 && (
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                Spent: ₹{totalTeamSpent.toLocaleString('en-IN')}
                              </span>
                            )}
                          </div>

                          {squadCount === 0 ? (
                            <div className="p-3 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center">
                              <p className="text-[11px] text-slate-500 font-medium">
                                No players bought yet. Sold players will appear here.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                              {teamSoldPlayers.map((record: SoldRecord) => {
                                const p = record.player;
                                const photo =
                                  p.photoUrl ||
                                  playersQueue.find((pq) => pq.player.registrationId === p.registrationId)?.player.photoUrl;

                                return (
                                  <div
                                    key={p.registrationId}
                                    className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 flex items-center justify-between gap-2 transition-all"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div className="w-9 h-9 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                                        {photo ? (
                                          // eslint-disable-next-line @next/next/no-img-element
                                          <img src={photo} alt={p.fullName} className="w-full h-full object-cover" />
                                        ) : (
                                          <span className="text-[10px] font-black text-amber-400">
                                            {getInitials(p.fullName)}
                                          </span>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <h5 className="text-xs font-black text-white uppercase truncate leading-tight">
                                          {p.fullName}
                                        </h5>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="text-[9px] font-bold text-amber-400 uppercase bg-amber-400/10 px-1.5 py-0.2 rounded">
                                            {p.role}
                                          </span>
                                          <span className="text-[10px] font-black font-mono text-emerald-400">
                                            ₹{record.soldPrice.toLocaleString('en-IN')}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleReleasePlayerFromTeam(p, t, record.soldPrice)}
                                        disabled={actionLoading}
                                        className="px-2 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 hover:border-rose-500/40 text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                                        title={`Mark ${p.fullName} as UNSOLD and refund ₹${record.soldPrice.toLocaleString('en-IN')} to ${t.name}`}
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        <span>Unsold</span>
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleReAuctionFromTeam(p, t, record.soldPrice)}
                                        disabled={actionLoading}
                                        className="p-1 rounded-lg bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/20 text-[10px] font-black transition-all"
                                        title={`Bring ${p.fullName} back to live stage for Re-Auction`}
                                      >
                                        <Gavel className="w-3 h-3" />
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => handleOpenManualEditPlayer(p, 'SOLD', undefined, record.soldPrice, t.name)}
                                        className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
                                        title="Edit Player Details"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
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
                                showToast(`Invitation message for ${t.name} copied to clipboard!`, 'success');
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

            <form onSubmit={handleSaveManualEditPlayer} className="space-y-3.5 max-h-[80vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-400 block mb-1 uppercase">
                    Player Full Name *
                  </label>
                  <input
                    type="text"
                    value={playerEditFullName}
                    onChange={(e) => setPlayerEditFullName(e.target.value)}
                    placeholder="Enter full name"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1 uppercase">
                    Playing Role
                  </label>
                  <select
                    value={playerEditRole}
                    onChange={(e) => setPlayerEditRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-bold focus:outline-none focus:border-amber-400"
                  >
                    <option value="Batting All-Rounder">Batting All-Rounder</option>
                    <option value="Bowling All-Rounder">Bowling All-Rounder</option>
                    <option value="Pure Batsman">Pure Batsman</option>
                    <option value="Pure Bowler">Pure Bowler</option>
                    <option value="Wicket Keeper Batsman">Wicket Keeper Batsman</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1 uppercase">
                    Age (Years)
                  </label>
                  <input
                    type="number"
                    value={playerEditAge}
                    onChange={(e) => setPlayerEditAge(e.target.value)}
                    min={10}
                    max={75}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

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

              {/* Player Photo Upload & Preview */}
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1 uppercase">
                  Player Photo (Upload Image / Camera)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow relative">
                    {playerEditPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={playerEditPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      ref={editPlayerPhotoInputRef}
                      onChange={handleEditPlayerPhotoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isPhotoCompressing}
                      onClick={() => editPlayerPhotoInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isPhotoCompressing ? 'Optimizing...' : playerEditPhotoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>
                    {playerEditPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setPlayerEditPhotoUrl('')}
                        className="text-[11px] text-rose-400 hover:underline mt-1 block"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
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

      {/* MODAL: MANUAL ADD PLAYER TO TOURNAMENT POOL */}
      {showAddPlayerModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 max-w-lg w-full shadow-2xl animate-in zoom-in-95 my-8 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center font-black shadow">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase text-white">Add Player to Tournament</h3>
                  <p className="text-[11px] text-amber-400 font-bold">Admin Manual Registration</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPlayerModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveNewPlayer} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1 uppercase">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={addPlayerName}
                  onChange={(e) => setAddPlayerName(e.target.value)}
                  placeholder="e.g. Rohit Sharma"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Mobile Phone */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1 uppercase">
                  Mobile Number (Optional)
                </label>
                <input
                  type="tel"
                  value={addPlayerPhone}
                  onChange={(e) => setAddPlayerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit number e.g. 9876543210"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Age and Base Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1 uppercase">
                    Age <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={addPlayerAge}
                    onChange={(e) => setAddPlayerAge(e.target.value)}
                    min={12}
                    max={60}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1 uppercase">
                    Base Price (₹) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={addPlayerBasePrice}
                    onChange={(e) => setAddPlayerBasePrice(e.target.value)}
                    step={100}
                    min={100}
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Playing Role */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1 uppercase">
                  Playing Role <span className="text-rose-400">*</span>
                </label>
                <select
                  value={addPlayerRole}
                  onChange={(e) => setAddPlayerRole(e.target.value as PlayingRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="Batting All-Rounder">Batting All-Rounder</option>
                  <option value="Bowling All-Rounder">Bowling All-Rounder</option>
                  <option value="Pure Batsman">Pure Batsman</option>
                  <option value="Fast Bowler">Fast Bowler</option>
                  <option value="Spin Bowler">Spin Bowler</option>
                  <option value="Wicketkeeper-Batsman">Wicketkeeper-Batsman</option>
                </select>
              </div>

              {/* Batting & Bowling Styles */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1 uppercase">
                    Batting Style
                  </label>
                  <select
                    value={addPlayerBatting}
                    onChange={(e) => setAddPlayerBatting(e.target.value as BattingStyle)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="Right-hand">Right-hand</option>
                    <option value="Left-hand">Left-hand</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1 uppercase">
                    Bowling Style
                  </label>
                  <select
                    value={addPlayerBowling}
                    onChange={(e) => setAddPlayerBowling(e.target.value as BowlingStyle)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="Right-arm Fast">Right-arm Fast</option>
                    <option value="Right-arm Spin">Right-arm Spin</option>
                    <option value="Left-arm Fast">Left-arm Fast</option>
                    <option value="Left-arm Spin">Left-arm Spin</option>
                    <option value="None">None</option>
                  </select>
                </div>
              </div>

              {/* Player Photo Upload */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1 uppercase">
                  Player Photo (Upload Image / Camera)
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0 shadow">
                    {addPlayerPhotoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={addPlayerPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      ref={playerPhotoInputRef}
                      onChange={handlePlayerPhotoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isPhotoCompressing}
                      onClick={() => playerPhotoInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isPhotoCompressing ? 'Optimizing photo...' : addPlayerPhotoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                    </button>
                    {addPlayerPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setAddPlayerPhotoUrl('')}
                        className="text-[11px] text-rose-400 hover:underline mt-1 block"
                      >
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Stats / Past Experience */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1 uppercase">
                  Experience / Past Stats (Optional)
                </label>
                <input
                  type="text"
                  value={addPlayerStats}
                  onChange={(e) => setAddPlayerStats(e.target.value)}
                  placeholder="e.g. Club level top-order batsman, played division league"
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Form Buttons */}
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPlayerModal(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addPlayerLoading || isPhotoCompressing}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-amber-500/40 text-amber-300 text-xs font-black uppercase tracking-wider shadow-lg disabled:opacity-40 flex items-center gap-1.5"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isPhotoCompressing ? 'Optimizing...' : addPlayerLoading ? 'Saving...' : '➕ Direct Save to Pool'}</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleSaveNewPlayer(e, true)}
                  disabled={addPlayerLoading || isPhotoCompressing}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Zap className="w-4 h-4" />
                  <span>{isPhotoCompressing ? 'Optimizing...' : addPlayerLoading ? 'Saving...' : '⚡ Save & Put on Stage'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
