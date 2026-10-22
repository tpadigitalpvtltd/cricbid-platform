'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Tournament } from '@/lib/types';
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
  Settings2,
} from 'lucide-react';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Check auth
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const auth = sessionStorage.getItem('cricbid_admin_auth');
      if (auth === 'true') {
        setIsAuthenticated(true);
        fetchTournaments();
      }
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const validPin = process.env.NEXT_PUBLIC_ADMIN_PIN || 'admin123';
    if (pinInput.trim() === validPin) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('cricbid_admin_auth', 'true');
      }
      setIsAuthenticated(true);
      setPinError('');
      fetchTournaments();
    } else {
      setPinError('Invalid Admin PIN. (Default: admin123)');
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('cricbid_admin_auth');
    }
    setIsAuthenticated(false);
  };

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/tournaments');
      if (res.ok) {
        const data = await res.json();
        if (data.tournaments) {
          setTournaments(data.tournaments);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Toggle Free vs Paid mode
  const handleTogglePayment = async (tournament: Tournament) => {
    try {
      setUpdatingId(tournament.id);
      const newIsPaid = !tournament.isPaid;
      const newFee = newIsPaid && (!tournament.entryFee || tournament.entryFee === 0) ? 499 : tournament.entryFee;

      const res = await fetch(`/api/tournaments/${tournament.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isPaid: newIsPaid,
          entryFee: newFee,
        }),
      });

      if (res.ok) {
        setTournaments((prev) =>
          prev.map((t) => (t.id === tournament.id ? { ...t, isPaid: newIsPaid, entryFee: newFee } : t))
        );
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
        body: JSON.stringify({ entryFee: newFee }),
      });
      if (res.ok) {
        setTournaments((prev) =>
          prev.map((t) => (t.id === tournament.id ? { ...t, entryFee: newFee } : t))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
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
              Enter authorized administrator PIN to access tournament gateway controls.
            </p>

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="password"
                placeholder="Enter PIN (Default: admin123)"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-center font-mono tracking-widest text-sm focus:outline-none focus:border-amber-400"
              />
              {pinError && <p className="text-xs text-rose-400 font-medium">{pinError}</p>}
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

  return (
    <div className="min-h-screen stadium-bg flex flex-col text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 z-10">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                Authorized Super Admin
              </span>
              <span className="text-xs text-slate-400 font-mono">PIN Session Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase text-white font-sans mt-1">
              Tournament Gateway & Razorpay Controls
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Toggle Free vs Paid registration tiers and configure Razorpay fee amounts across all tournaments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={fetchTournaments}
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
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
            <span className="text-2xl sm:text-3xl font-black text-cyan-400 font-sans">{totalRegistered}</span>
          </div>
        </div>

        {/* Tournaments Management Grid */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-400" />
            <span>Tournament Payment Tiers & Configuration</span>
          </h2>

          <div className="grid grid-cols-1 gap-4">
            {tournaments.map((tournament) => {
              const isUpdating = updatingId === tournament.id;
              return (
                <div
                  key={tournament.id}
                  className="rounded-3xl bg-slate-900/70 border border-slate-800 p-5 sm:p-6 backdrop-blur-md transition-all hover:border-slate-700"
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                    
                    {/* Left: Tournament Identity */}
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-slate-800 shrink-0 relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={tournament.bannerUrl}
                          alt={tournament.title}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                              tournament.isPaid
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {tournament.isPaid ? 'PAID ENTRY (RAZORPAY)' : 'FREE REGISTRATION'}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {tournament.city} • {tournament.venue}
                          </span>
                        </div>

                        <h3 className="text-lg font-black text-white uppercase tracking-tight truncate">
                          {tournament.title}
                        </h3>

                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                          <span>Auction: {tournament.auctionDate}</span>
                          <span>•</span>
                          <span className="text-amber-400 font-bold">
                            🔥 {tournament.registeredCount || 0} Registered
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Fast Controls (Toggle Free vs Paid, and Entry Fee) */}
                    <div className="flex flex-wrap items-center gap-4 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80 w-full lg:w-auto justify-between lg:justify-start">
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
                              <span>Enable PAID Mode</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Entry Fee Editor */}
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                          Fee (₹)
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            disabled={!tournament.isPaid || isUpdating}
                            defaultValue={tournament.entryFee || 499}
                            onBlur={(e) => {
                              const val = Number(e.target.value);
                              if (val !== tournament.entryFee) {
                                handleUpdateFee(tournament, val);
                              }
                            }}
                            className="w-20 px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono font-bold focus:outline-none focus:border-amber-400 disabled:opacity-40"
                          />
                        </div>
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

      </main>
    </div>
  );
}
