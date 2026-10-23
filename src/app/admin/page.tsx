'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Tournament, RegistrationSubmission } from '@/lib/types';
import {
  ShieldAlert,
  Lock,
  Unlock,
  CreditCard,
  CheckCircle2,
  DollarSign,
  KeyRound,
  ExternalLink,
  RefreshCw,
  Trophy,
  Save,
  Sliders,
  Users,
  Eye,
  EyeOff,
  Settings2,
  PlusCircle,
  Trash2,
  Edit,
  X,
  Search,
  Check,
  AlertTriangle,
  Calendar,
  MapPin,
  Sparkles,
  Phone,
  User,
  Filter,
  FileSpreadsheet,
  Download,
  Upload,
  Camera,
} from 'lucide-react';
import { compressImage } from '@/lib/utils';

const PRESET_BANNERS = [
  {
    name: 'Night Floodlights Arena',
    url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Day Stadium Atmosphere',
    url: 'https://images.unsplash.com/photo-1531415074868-036b1c57e3ce?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Red Turf Pitch & Stumps',
    url: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Leather Cricket Ball in Action',
    url: 'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?q=80&w=1200&auto=format&fit=crop',
  },
];

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [players, setPlayers] = useState<RegistrationSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Active Admin View Tab: 'tournaments' | 'players'
  const [activeTab, setActiveTab] = useState<'tournaments' | 'players'>('tournaments');

  // Players filtering
  const [selectedTournamentFilter, setSelectedTournamentFilter] = useState<string>('all');
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [deletingTournament, setDeletingTournament] = useState<Tournament | null>(null);
  const [editingPlayer, setEditingPlayer] = useState<RegistrationSubmission | null>(null);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);

  // Create Tournament Form State
  const [isUploadingAdminBanner, setIsUploadingAdminBanner] = useState(false);
  const fileInputAdminCreateRef = React.useRef<HTMLInputElement>(null);
  const fileInputAdminEditRef = React.useRef<HTMLInputElement>(null);

  const [createForm, setCreateForm] = useState({
    title: '',
    tagline: '',
    city: '',
    venue: '',
    bannerUrl: PRESET_BANNERS[0].url,
    registrationDeadline: '2026-12-15',
    auctionDate: '2026-12-20',
    isPaid: true,
    entryFee: 150,
    organizerName: 'Tournament Host',
    organizerContact: '',
  });

  const handleAdminBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload a valid image file (JPG, PNG, WEBP)');
      return;
    }

    try {
      setIsUploadingAdminBanner(true);
      const base64 = await compressImage(file, 1000, 560, 0.75);
      if (isEditMode && editingTournament) {
        setEditingTournament((prev) => prev ? ({ ...prev, bannerUrl: base64 }) : null);
      } else {
        setCreateForm((prev) => ({ ...prev, bannerUrl: base64 }));
      }
    } catch (err) {
      console.error('Admin banner upload error:', err);
      alert('Failed to process image. Please try another photo.');
    } finally {
      setIsUploadingAdminBanner(false);
    }
  };

  // Check auth via secure server session
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const res = await fetch('/api/admin/auth');
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated) {
            setIsAuthenticated(true);
            fetchTournaments();
            fetchAllPlayers();
            return;
          }
        }
      } catch (err) {}

      // Fallback check session storage
      if (typeof window !== 'undefined') {
        const auth = sessionStorage.getItem('cricbid_admin_auth');
        if (auth === 'true') {
          setIsAuthenticated(true);
          fetchTournaments();
          fetchAllPlayers();
        }
      }
    };

    verifyAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) {
      setPasswordError('Please enter administrator password');
      return;
    }

    try {
      setLoading(true);
      setPasswordError('');

      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput.trim() }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('cricbid_admin_auth', 'true');
        }
        setIsAuthenticated(true);
        setPasswordError('');
        fetchTournaments();
        fetchAllPlayers();
      } else {
        setPasswordError(data.error || 'Invalid administrator password. Access denied.');
      }
    } catch (err: any) {
      setPasswordError(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/auth', { method: 'DELETE' });
    } catch (e) {}

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('cricbid_admin_auth');
    }
    setIsAuthenticated(false);
  };

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tournaments', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.tournaments)) {
          setTournaments(data.tournaments);
        }
      }
    } catch (e) {
      console.error('Error fetching tournaments:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPlayers = async () => {
    try {
      const res = await fetch('/api/admin/players', {
        cache: 'no-store',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.players)) {
          setPlayers(data.players);
        }
      }
    } catch (e) {
      console.error('Error fetching players:', e);
    }
  };

  // Toggle Free vs Paid mode
  const handleTogglePayment = async (tournament: Tournament) => {
    try {
      setUpdatingId(tournament.id);
      const newIsPaid = !tournament.isPaid;
      const newFee = newIsPaid && (!tournament.entryFee || tournament.entryFee === 0) ? 150 : tournament.entryFee;

      const res = await fetch(`/api/tournaments/${tournament.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          isPaid: newIsPaid,
          entryFee: newFee,
        }),
      });

      if (res.ok) {
        setTournaments((prev) =>
          prev.map((t) => (t.id === tournament.id ? { ...t, isPaid: newIsPaid, entryFee: newFee } : t))
        );
        fetchTournaments();
      }
    } catch (err) {
      console.error('Error toggling payment:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Update Entry Fee
  const handleUpdateFee = async (tournament: Tournament, newFee: number) => {
    try {
      setUpdatingId(tournament.id);
      const res = await fetch(`/api/tournaments/${tournament.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entryFee: newFee }),
      });
      if (res.ok) {
        setTournaments((prev) =>
          prev.map((t) => (t.id === tournament.id ? { ...t, entryFee: newFee } : t))
        );
        fetchTournaments();
      }
    } catch (err) {
      console.error('Error updating fee:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // Create Tournament (Direct Paid / Free)
  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.city.trim() || !createForm.venue.trim()) {
      alert('Title, City, and Venue are required');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsCreateModalOpen(false);
        // Reset form
        setCreateForm({
          title: '',
          tagline: '',
          city: '',
          venue: '',
          bannerUrl: PRESET_BANNERS[0].url,
          registrationDeadline: '2026-12-15',
          auctionDate: '2026-12-20',
          isPaid: true,
          entryFee: 150,
          organizerName: 'Tournament Host',
          organizerContact: '',
        });
        await fetchTournaments();
        alert('Tournament created successfully!');
      } else {
        alert(data.error || 'Failed to create tournament');
      }
    } catch (err: any) {
      alert(err.message || 'Error creating tournament');
    } finally {
      setLoading(false);
    }
  };

  // Save Edited Tournament
  const handleSaveTournamentEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTournament) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/tournaments/${editingTournament.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editingTournament),
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        const updated = data.tournament || editingTournament;
        setTournaments((prev) =>
          prev.map((t) => (t.id === updated.id || t.slug === updated.slug ? updated : t))
        );
        setEditingTournament(null);
        alert('Tournament updated successfully!');
        await fetchTournaments();
      } else {
        alert(data?.error || `Failed to update tournament (Status: ${res.status})`);
      }
    } catch (err: any) {
      alert(err.message || 'Error updating tournament');
    } finally {
      setLoading(false);
    }
  };

  // Delete Tournament
  const handleConfirmDeleteTournament = async () => {
    if (!deletingTournament) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/tournaments/${deletingTournament.slug}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTournaments((prev) =>
          prev.filter((t) => t.id !== deletingTournament.id && t.slug !== deletingTournament.slug)
        );
        setDeletingTournament(null);
        try {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('cricbid_client_tournaments');
          }
        } catch (e) {}
        alert('Tournament deleted successfully');
      } else {
        alert(data.error || 'Failed to delete tournament');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting tournament');
    } finally {
      setLoading(false);
    }
  };

  // Save Edited Player
  const handleSavePlayerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;

    try {
      setLoading(true);
      const res = await fetch('/api/admin/players', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registrationId: editingPlayer.registrationId,
          updates: editingPlayer,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPlayers((prev) =>
          prev.map((p) => (p.registrationId === editingPlayer.registrationId ? editingPlayer : p))
        );
        setEditingPlayer(null);
        alert('Player entry updated successfully!');
      } else {
        alert(data.error || 'Failed to update player');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating player');
    } finally {
      setLoading(false);
    }
  };

  // Delete Player
  const handleConfirmDeletePlayer = async (registrationId: string) => {
    if (!confirm('Are you sure you want to permanently delete this player registration?')) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/admin/players?registrationId=${encodeURIComponent(registrationId)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setPlayers((prev) => prev.filter((p) => p.registrationId !== registrationId));
        fetchTournaments(); // Refresh counts
        alert('Player entry deleted successfully');
      } else {
        alert(data.error || 'Failed to delete player');
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting player');
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen stadium-bg flex flex-col text-slate-100">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#090f1e] rounded-3xl border border-amber-500/40 p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.25)] text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black uppercase text-white font-sans">
              Super Admin Authentication
            </h2>
            <p className="text-xs text-slate-400 mt-1 mb-6">
              Enter master administrator password to access tournament controls.
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter Admin Password"
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  autoFocus
                  className="w-full px-4 pr-10 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-center font-mono tracking-wider text-sm focus:outline-none focus:border-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {passwordError && (
                <p className="text-xs text-rose-400 font-medium">{passwordError}</p>
              )}

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg"
              >
                Access Admin Dashboard
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const totalRegistered = tournaments.reduce((acc, t) => acc + (t.registeredCount || 0), 0);
  const paidCount = tournaments.filter((t) => t.isPaid).length;
  const freeCount = tournaments.filter((t) => !t.isPaid).length;
  const verifiedPaidPlayers = players.filter((p) => p.paymentStatus === 'PAID');
  const totalVerifiedRevenue = verifiedPaidPlayers.reduce(
    (acc, p) => acc + (Number(p.amount) || 0),
    0
  );

  const filteredPlayers = players.filter((p) => {
    if (selectedTournamentFilter !== 'all') {
      const matchSlug = p.tournamentSlug?.toLowerCase() === selectedTournamentFilter.toLowerCase();
      const matchTitle = p.tournamentTitle?.toLowerCase().includes(selectedTournamentFilter.toLowerCase());
      if (!matchSlug && !matchTitle) return false;
    }

    if (playerSearchQuery.trim()) {
      const query = playerSearchQuery.toLowerCase();
      const matchesName = p.fullName?.toLowerCase().includes(query);
      const matchesPhone = p.phone?.toLowerCase().includes(query);
      const matchesRegId = p.registrationId?.toLowerCase().includes(query);
      if (!matchesName && !matchesPhone && !matchesRegId) return false;
    }

    return true;
  });

  const handleExportToExcel = () => {
    if (filteredPlayers.length === 0) {
      alert('No player registrations found to export.');
      return;
    }

    const headers = [
      'Registration ID',
      'Full Name',
      'Mobile / WhatsApp',
      'Age',
      'Role',
      'Batting Hand',
      'Bowling Style',
      'Tournament Title',
      'Tournament Slug',
      'Payment Status',
      'Entry Fee (INR)',
      'Payment ID',
      'Order ID',
      'Registration Timestamp',
      'Player Stats / Achievements',
    ];

    const escapeCSV = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [
      headers.join(','),
      ...filteredPlayers.map((p) =>
        [
          escapeCSV(p.registrationId),
          escapeCSV(p.fullName),
          escapeCSV(p.phone),
          escapeCSV(p.age),
          escapeCSV(p.role),
          escapeCSV(p.battingStyle),
          escapeCSV(p.bowlingStyle),
          escapeCSV(p.tournamentTitle || ''),
          escapeCSV(p.tournamentSlug),
          escapeCSV(p.paymentStatus),
          escapeCSV(p.amount || 0),
          escapeCSV(p.paymentId || ''),
          escapeCSV(p.orderId || ''),
          escapeCSV(p.timestamp),
          escapeCSV(p.stats || ''),
        ].join(',')
      ),
    ];

    // UTF-8 BOM so Microsoft Excel renders Hindi, English, and accents perfectly
    const csvContent = '\uFEFF' + csvRows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    const tourneyName =
      selectedTournamentFilter === 'all' ? 'All_Tournaments' : selectedTournamentFilter;
    const dateStr = new Date().toISOString().split('T')[0];

    link.setAttribute('href', url);
    link.setAttribute('download', `CricBid_Players_${tourneyName}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen stadium-bg flex flex-col text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 z-10">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                Authorized Super Admin
              </span>
              <span className="text-xs text-slate-400 font-mono">Real Master Session</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase text-white font-sans mt-1">
              Admin Gateway & Database Controls
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Manage tournaments, toggle Free vs Paid tiers, adjust exact entry fees, and edit or delete player entries.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Tournament</span>
            </button>
            <button
              onClick={() => {
                fetchTournaments();
                fetchAllPlayers();
              }}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-2 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-xs font-bold text-rose-400 transition-colors"
            >
              Lock / Exit
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Tournaments</span>
            <span className="text-2xl sm:text-3xl font-black text-white font-sans">{tournaments.length}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Paid Tournaments</span>
            <span className="text-2xl sm:text-3xl font-black text-amber-400 font-sans">{paidCount}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Free Tournaments</span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-sans">{freeCount}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Players Drafted</span>
            <span className="text-2xl sm:text-3xl font-black text-cyan-400 font-sans">{players.length || totalRegistered}</span>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 col-span-2 sm:col-span-1">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Verified Revenue</span>
            <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-sans">
              ₹{totalVerifiedRevenue.toLocaleString('en-IN')}
            </span>
          </div>
        </div>

        {/* View Switcher Tabs (Tournaments vs Registered Players) */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-2">
          <button
            onClick={() => setActiveTab('tournaments')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
              activeTab === 'tournaments'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Tournaments ({tournaments.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('players');
              fetchAllPlayers();
            }}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
              activeTab === 'players'
                ? 'bg-emerald-400 text-slate-950 shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Registered Players ({players.length})</span>
          </button>
        </div>

        {/* TAB 1: TOURNAMENTS MANAGEMENT */}
        {activeTab === 'tournaments' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              {tournaments.map((tournament) => {
                const isUpdating = updatingId === tournament.id;
                return (
                  <div
                    key={tournament.id}
                    className="rounded-3xl bg-slate-900/70 border border-slate-800 p-5 sm:p-6 backdrop-blur-md transition-all hover:border-slate-700 shadow-xl"
                  >
                    <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                      
                      {/* Left: Tournament Identity */}
                      <div className="flex items-start gap-4 min-w-0 flex-1">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-slate-800 shrink-0 relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={tournament.bannerUrl}
                            alt={tournament.title}
                            className="w-full h-full object-cover"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                                tournament.isPaid
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              }`}
                            >
                              {tournament.isPaid ? `PAID ENTRY (₹${tournament.entryFee})` : 'FREE REGISTRATION'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {tournament.city} • {tournament.venue}
                            </span>
                          </div>

                          <h3 className="text-lg font-black text-white uppercase tracking-tight truncate">
                            {tournament.title}
                          </h3>
                          {tournament.tagline && (
                            <p className="text-xs text-slate-400 truncate">{tournament.tagline}</p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                            <span>Auction: {tournament.auctionDate}</span>
                            <span>•</span>
                            <span className="text-amber-400 font-bold">
                              🔥 {tournament.registeredCount || 0} Registered
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Controls & Actions */}
                      <div className="flex flex-wrap items-center gap-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 w-full lg:w-auto justify-between lg:justify-start">
                        
                        {/* One-click Payment Toggle */}
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                            Payment Mode
                          </span>
                          <button
                            type="button"
                            onClick={() => handleTogglePayment(tournament)}
                            disabled={isUpdating}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                              tournament.isPaid
                                ? 'bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                                : 'bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,232,123,0.3)]'
                            }`}
                          >
                            {tournament.isPaid ? (
                              <>
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Switch to FREE</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>Enable PAID</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Quick Fee Editor */}
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                            Fee (₹)
                          </span>
                          <input
                            type="number"
                            disabled={!tournament.isPaid || isUpdating}
                            defaultValue={tournament.entryFee || 150}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (val !== tournament.entryFee) {
                                handleUpdateFee(tournament, val);
                              }
                            }}
                            className="w-20 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold focus:outline-none focus:border-amber-400 disabled:opacity-40"
                          />
                        </div>

                        {/* Edit Button */}
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                            Edit
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingTournament({ ...tournament })}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 border border-slate-700"
                            title="Edit Tournament Details"
                          >
                            <Edit className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Edit</span>
                          </button>
                        </div>

                        {/* Delete Button */}
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                            Delete
                          </span>
                          <button
                            type="button"
                            onClick={() => setDeletingTournament(tournament)}
                            className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-1 border border-rose-500/30"
                            title="Delete Tournament"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>

                        {/* View Link */}
                        <div>
                          <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                            Live Page
                          </span>
                          <Link
                            href={`/tournament/${tournament.slug}/register`}
                            target="_blank"
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 border border-slate-700"
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-400" />
                            <span>View</span>
                            <ExternalLink className="w-3 h-3 text-slate-500" />
                          </Link>
                        </div>

                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: REGISTERED PLAYERS MANAGEMENT */}
        {activeTab === 'players' && (
          <div className="space-y-4">
            
            {/* Filter & Search Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
              
              {/* Tournament Filter */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-bold text-slate-400 uppercase">Filter:</span>
                <select
                  value={selectedTournamentFilter}
                  onChange={(e) => setSelectedTournamentFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-amber-400"
                >
                  <option value="all">All Tournaments ({players.length})</option>
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.slug}>
                      {t.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Player & Export Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search name, phone, ID..."
                    value={playerSearchQuery}
                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleExportToExcel}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 text-slate-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all transform active:scale-95 shrink-0"
                  title="Download players list as an Excel CSV file"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-950" />
                  <span>Download Excel ({filteredPlayers.length})</span>
                </button>
              </div>

            </div>

            {/* Players Table / Cards */}
            {filteredPlayers.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-slate-800">
                <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-400">No registered players found</p>
                <p className="text-xs text-slate-500 mt-1">Registrations will appear here in real-time as players sign up.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredPlayers.map((player) => (
                  <div
                    key={player.registrationId}
                    className="p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-amber-400 font-bold shrink-0 overflow-hidden">
                        {player.photoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={player.photoUrl}
                            alt={player.fullName}
                            className="w-full h-full object-cover"
                          />
                        ) : player.fullName ? (
                          player.fullName.charAt(0).toUpperCase()
                        ) : (
                          'P'
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-black text-white">{player.fullName}</h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {player.role}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black ${
                              player.paymentStatus === 'PAID'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-slate-800 text-slate-400'
                            }`}
                          >
                            {player.paymentStatus} {player.amount ? `(₹${player.amount})` : ''}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 mt-1">
                          <span className="text-slate-300 font-mono">📱 {player.phone}</span>
                          <span>•</span>
                          <span>Age: {player.age}</span>
                          <span>•</span>
                          <span>Bat: {player.battingStyle}</span>
                          <span>•</span>
                          <span>Bowl: {player.bowlingStyle}</span>
                        </div>

                        <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                          <span className="font-mono text-cyan-400">{player.registrationId}</span>
                          <span>•</span>
                          <span className="truncate max-w-xs text-slate-400">{player.tournamentTitle || player.tournamentSlug}</span>
                          <span>•</span>
                          <span>{player.timestamp}</span>
                        </div>
                      </div>
                    </div>

                    {/* Player Action Buttons */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingPlayer({ ...player })}
                        className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5"
                      >
                        <Edit className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleConfirmDeletePlayer(player.registrationId)}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 text-rose-400 text-xs font-bold flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}

          </div>
        )}

      </main>

      {/* ==================================================================== */}
      {/* MODAL 1: CREATE TOURNAMENT (ADMIN DIRECT PAID / FREE) */}
      {/* ==================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-2xl w-full bg-[#090f1e] border border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.25)] relative my-8">
            <button
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900 border border-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-black uppercase text-white font-sans flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-amber-400" />
              <span>Create Tournament (Admin Direct)</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 mb-6">
              Create an official cricket auction portal with direct control over Paid vs Free mode and entry fee.
            </p>

            <form onSubmit={handleCreateTournament} className="space-y-4">
              
              {/* Payment Mode Selector */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-bold uppercase text-slate-400 block mb-2">Registration Mode</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, isPaid: true })}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                      createForm.isPaid
                        ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Paid Mode</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateForm({ ...createForm, isPaid: false, entryFee: 0 })}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                      !createForm.isPaid
                        ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Free Mode</span>
                  </button>
                </div>

                {createForm.isPaid && (
                  <div className="mt-3 pt-3 border-t border-slate-800">
                    <label className="text-xs text-slate-300 font-bold block mb-1">
                      Entry Fee Amount (₹ INR)
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={createForm.entryFee}
                      onChange={(e) => setCreateForm({ ...createForm, entryFee: Number(e.target.value) })}
                      placeholder="e.g. 1, 150, 499"
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-mono font-bold focus:outline-none focus:border-amber-400"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Razorpay will charge players exactly this amount during registration.
                    </p>
                  </div>
                )}
              </div>

              {/* Title & Tagline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Tournament Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. YMPL 2026 Season 2"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Tagline / Edition</label>
                  <input
                    type="text"
                    placeholder="e.g. Organised by SR 11"
                    value={createForm.tagline}
                    onChange={(e) => setCreateForm({ ...createForm, tagline: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* City & Venue */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">City *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Yavatmal"
                    value={createForm.city}
                    onChange={(e) => setCreateForm({ ...createForm, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Venue / Ground *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jaiswal ground Yavatmal"
                    value={createForm.venue}
                    onChange={(e) => setCreateForm({ ...createForm, venue: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Cover Photo / Banner Selection & Upload */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-300 font-bold block">
                    Tournament Cover Photo / Banner
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputAdminCreateRef.current?.click()}
                    disabled={isUploadingAdminBanner}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-all"
                  >
                    {isUploadingAdminBanner ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Compressing...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3" />
                        <span>Upload From Gallery</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Banner Preview */}
                <div className="relative w-full h-24 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 mb-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={createForm.bannerUrl}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 text-[11px] font-bold text-white truncate max-w-[80%]">
                    {createForm.title || 'Tournament Title Preview'}
                  </div>
                </div>

                <input
                  ref={fileInputAdminCreateRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleAdminBannerUpload(e, false)}
                  className="hidden"
                />

                {/* Presets Grid */}
                <div className="grid grid-cols-4 gap-1.5">
                  {PRESET_BANNERS.map((preset) => {
                    const isSelected = createForm.bannerUrl === preset.url;
                    return (
                      <button
                        type="button"
                        key={preset.name}
                        onClick={() => setCreateForm({ ...createForm, bannerUrl: preset.url })}
                        className={`relative rounded-lg overflow-hidden border transition-all text-left ${
                          isSelected
                            ? 'border-amber-400 ring-2 ring-amber-400/50'
                            : 'border-slate-800 hover:border-slate-700 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="h-9 w-full relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Registration Deadline</label>
                  <input
                    type="date"
                    value={createForm.registrationDeadline}
                    onChange={(e) => setCreateForm({ ...createForm, registrationDeadline: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Auction Date</label>
                  <input
                    type="date"
                    value={createForm.auctionDate}
                    onChange={(e) => setCreateForm({ ...createForm, auctionDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {/* Organizer Name & Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Organizer Name</label>
                  <input
                    type="text"
                    placeholder="e.g. SR 11 Committee"
                    value={createForm.organizerName}
                    onChange={(e) => setCreateForm({ ...createForm, organizerName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Organizer WhatsApp Phone</label>
                  <input
                    type="tel"
                    placeholder="e.g. +919876543210"
                    value={createForm.organizerContact}
                    onChange={(e) => setCreateForm({ ...createForm, organizerContact: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-slate-300 text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save & Publish Tournament</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: EDIT TOURNAMENT MODAL */}
      {/* ==================================================================== */}
      {editingTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-2xl w-full bg-[#090f1e] border border-cyan-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(6,182,212,0.25)] relative my-8">
            <button
              onClick={() => setEditingTournament(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900 border border-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-black uppercase text-white font-sans flex items-center gap-2">
              <Edit className="w-5 h-5 text-cyan-400" />
              <span>Edit Tournament Details</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 mb-6">
              Update fee amount, payment mode, venue, or auction dates for &quot;{editingTournament.title}&quot;.
            </p>

            <form onSubmit={handleSaveTournamentEdit} className="space-y-4">
              
              {/* Payment Mode & Fee */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                <span className="text-xs font-bold uppercase text-slate-400 block mb-2">Payment Mode & Fee</span>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setEditingTournament({ ...editingTournament, isPaid: true })}
                    className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                      editingTournament.isPaid
                        ? 'bg-amber-400 text-slate-950 border-amber-400 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Paid Mode</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEditingTournament({ ...editingTournament, isPaid: false, entryFee: 0 })}
                    className={`py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition-all ${
                      !editingTournament.isPaid
                        ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md'
                        : 'bg-slate-900 text-slate-400 border-slate-800'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Free Mode</span>
                  </button>
                </div>

                {editingTournament.isPaid && (
                  <div>
                    <label className="text-xs text-slate-300 font-bold block mb-1">
                      Registration Fee (₹ INR)
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={editingTournament.entryFee}
                      onChange={(e) => setEditingTournament({ ...editingTournament, entryFee: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm font-mono font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>
                )}
              </div>

              {/* Title & Tagline */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Tournament Title</label>
                  <input
                    type="text"
                    required
                    value={editingTournament.title}
                    onChange={(e) => setEditingTournament({ ...editingTournament, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Tagline</label>
                  <input
                    type="text"
                    value={editingTournament.tagline || ''}
                    onChange={(e) => setEditingTournament({ ...editingTournament, tagline: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* City & Venue */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={editingTournament.city}
                    onChange={(e) => setEditingTournament({ ...editingTournament, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Venue / Ground</label>
                  <input
                    type="text"
                    required
                    value={editingTournament.venue}
                    onChange={(e) => setEditingTournament({ ...editingTournament, venue: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Registration Deadline</label>
                  <input
                    type="date"
                    value={editingTournament.registrationDeadline}
                    onChange={(e) => setEditingTournament({ ...editingTournament, registrationDeadline: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Auction Date</label>
                  <input
                    type="date"
                    value={editingTournament.auctionDate}
                    onChange={(e) => setEditingTournament({ ...editingTournament, auctionDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Cover Photo / Banner Selection & Upload */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-300 font-bold block">
                    Tournament Cover Photo / Banner
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputAdminEditRef.current?.click()}
                    disabled={isUploadingAdminBanner}
                    className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-all"
                  >
                    {isUploadingAdminBanner ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Compressing...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3 h-3" />
                        <span>Upload From Gallery</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Banner Preview */}
                <div className="relative w-full h-24 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 mb-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editingTournament.bannerUrl}
                    alt="Cover preview"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 text-[11px] font-bold text-white truncate max-w-[80%]">
                    {editingTournament.title || 'Tournament Title Preview'}
                  </div>
                </div>

                <input
                  ref={fileInputAdminEditRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleAdminBannerUpload(e, true)}
                  className="hidden"
                />

                {/* Presets Grid */}
                <div className="grid grid-cols-4 gap-1.5">
                  {PRESET_BANNERS.map((preset) => {
                    const isSelected = editingTournament.bannerUrl === preset.url;
                    return (
                      <button
                        type="button"
                        key={preset.name}
                        onClick={() => setEditingTournament({ ...editingTournament, bannerUrl: preset.url })}
                        className={`relative rounded-lg overflow-hidden border transition-all text-left ${
                          isSelected
                            ? 'border-cyan-400 ring-2 ring-cyan-400/50'
                            : 'border-slate-800 hover:border-slate-700 opacity-60 hover:opacity-100'
                        }`}
                      >
                        <div className="h-9 w-full relative">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTournament(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-slate-300 text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Changes</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: DELETE TOURNAMENT CONFIRMATION */}
      {/* ==================================================================== */}
      {deletingTournament && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="max-w-md w-full bg-[#090f1e] border border-rose-500/40 rounded-3xl p-6 sm:p-8 text-center shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black uppercase text-white font-sans">
              Delete Tournament?
            </h3>
            <p className="text-xs text-slate-300 mt-2 mb-6">
              Are you sure you want to permanently delete <br />
              <strong className="text-white">&quot;{deletingTournament.title}&quot;</strong>?
              This action cannot be undone.
            </p>

            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeletingTournament(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTournament}
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Yes, Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: EDIT PLAYER ENTRY */}
      {/* ==================================================================== */}
      {editingPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="max-w-xl w-full bg-[#090f1e] border border-cyan-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative my-8">
            <button
              onClick={() => setEditingPlayer(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900 border border-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-black uppercase text-white font-sans flex items-center gap-2">
              <Edit className="w-5 h-5 text-cyan-400" />
              <span>Edit Player Entry</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5 mb-6">
              Update player details, role, or payment status ({editingPlayer.registrationId}).
            </p>

            <form onSubmit={handleSavePlayerEdit} className="space-y-4">
              
              {/* Full Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editingPlayer.fullName}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, fullName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Phone / WhatsApp</label>
                  <input
                    type="tel"
                    required
                    value={editingPlayer.phone}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Player Photo Upload */}
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <label className="text-xs text-slate-400 font-bold block mb-2">Player Passport / Profile Photo</label>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                    {editingPlayer.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={editingPlayer.photoUrl} alt="Player" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-7 h-7 text-slate-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      type="file"
                      id="admin-player-photo-input"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const compressed = await compressImage(file, 600, 600, 0.85);
                          setEditingPlayer({ ...editingPlayer, photoUrl: compressed });
                        } catch (err) {
                          alert('Failed to process image');
                        }
                      }}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor="admin-player-photo-input"
                        className="px-3.5 py-1.5 rounded-xl bg-cyan-500/20 border border-cyan-500/40 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>{editingPlayer.photoUrl ? 'Change Photo from Gallery' : 'Upload from Gallery'}</span>
                      </label>
                      {editingPlayer.photoUrl && (
                        <button
                          type="button"
                          onClick={() => setEditingPlayer({ ...editingPlayer, photoUrl: '' })}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Select photo from phone gallery or PC. Displays on pass and tournament player card.
                    </p>
                  </div>
                </div>
              </div>

              {/* Age & Role */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Age</label>
                  <input
                    type="number"
                    value={editingPlayer.age}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, age: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Playing Role</label>
                  <select
                    value={editingPlayer.role}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, role: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    <option value="Pure Batsman">Pure Batsman</option>
                    <option value="Fast Bowler">Fast Bowler</option>
                    <option value="Spin Bowler">Spin Bowler</option>
                    <option value="Batting All-Rounder">Batting All-Rounder</option>
                    <option value="Bowling All-Rounder">Bowling All-Rounder</option>
                    <option value="Wicketkeeper-Batsman">Wicketkeeper-Batsman</option>
                  </select>
                </div>
              </div>

              {/* Payment Status & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Payment Status</label>
                  <select
                    value={editingPlayer.paymentStatus}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, paymentStatus: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    <option value="PAID">PAID</option>
                    <option value="FREE">FREE</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold block mb-1">Fee Amount (₹)</label>
                  <input
                    type="number"
                    value={editingPlayer.amount || 0}
                    onChange={(e) => setEditingPlayer({ ...editingPlayer, amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Stats */}
              <div>
                <label className="text-xs text-slate-400 font-bold block mb-1">Previous Stats & Achievements</label>
                <textarea
                  rows={3}
                  value={editingPlayer.stats || ''}
                  onChange={(e) => setEditingPlayer({ ...editingPlayer, stats: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingPlayer(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 text-slate-300 text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Player Details</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
