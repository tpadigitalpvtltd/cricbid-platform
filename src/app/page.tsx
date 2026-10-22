'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/Navbar';
import { Tournament } from '@/lib/types';
import {
  Trophy,
  MapPin,
  Calendar,
  Users,
  Flame,
  ArrowRight,
  PlusCircle,
  Search,
  Sparkles,
  Zap,
  Lock,
} from 'lucide-react';

export default function HomePage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'free' | 'paid'>('all');

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        setLoading(true);
        // Clear any old stale client tournaments from localStorage
        try {
          localStorage.removeItem('cricbid_client_tournaments');
        } catch (e) {}

        const res = await fetch('/api/tournaments');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.tournaments)) {
            setTournaments(data.tournaments);
          } else {
            setTournaments([]);
          }
        } else {
          setTournaments([]);
        }
      } catch (e) {
        console.error('Error fetching tournaments:', e);
        setTournaments([]);
      } finally {
        setLoading(false);
      }
    };
    fetchTournaments();
  }, []);

  const filteredTournaments = tournaments.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.venue.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (filterType === 'free') return !t.isPaid;
    if (filterType === 'paid') return t.isPaid;
    return true;
  });

  const totalRegistered = tournaments.reduce((acc, t) => acc + (t.registeredCount || 0), 0);

  return (
    <div className="min-h-screen stadium-bg flex flex-col text-slate-100 selection:bg-amber-400 selection:text-slate-950">
      <Navbar />

      {/* Hero Section */}
      <section className="relative pt-12 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/15 via-emerald-500/15 to-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black uppercase tracking-widest mb-6 animate-pulse shadow-[0_0_20px_rgba(245,158,11,0.2)]">
          <Flame className="w-3.5 h-3.5 text-amber-400 fill-current" />
          <span>India&apos;s Premier Cricket Auction & Draft Hub</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black uppercase tracking-tight text-white font-sans max-w-4xl mx-auto leading-none">
          Draft Your Squad. <br className="hidden sm:inline" />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400">
            Dominate The Mega Auction.
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto mt-4 leading-relaxed">
          CricBid connects cricket tournament organizers and aspiring players. Host free tournaments with instant Google Sheets sync or register for high-stakes IPL-style player auctions.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mt-8">
          <Link
            href="/host"
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(16,232,123,0.4)] transition-all flex items-center justify-center gap-2 transform active:scale-95"
          >
            <PlusCircle className="w-4 h-4 text-slate-950" />
            <span>+ Host Free Auction</span>
          </Link>

          <a
            href="#explore"
            className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-amber-400 hover:text-amber-300 font-black text-xs uppercase tracking-wider shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Explore Live Tournaments</span>
          </a>
        </div>

        {/* Live Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-4xl mx-auto mt-12 pt-8 border-t border-slate-800/80">
          <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Tournaments</span>
            <span className="text-xl sm:text-2xl font-black text-white">{tournaments.length}</span>
          </div>
          <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Registrations</span>
            <span className="text-xl sm:text-2xl font-black text-amber-400">{totalRegistered}</span>
          </div>
          <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Organizer Tier</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400">100% FREE</span>
          </div>
          <div className="p-3 bg-slate-900/40 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Razorpay Live</span>
            <span className="text-xl sm:text-2xl font-black text-cyan-400">Active</span>
          </div>
        </div>
      </section>

      {/* Explore Tournaments Grid Section */}
      <section id="explore" className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full z-10">
        
        {/* Filter & Search Header */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search tournament, city, or venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 self-start md:self-auto overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                filterType === 'all'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              All Tournaments ({tournaments.length})
            </button>

            <button
              onClick={() => setFilterType('free')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                filterType === 'free'
                  ? 'bg-emerald-400 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Zap className="w-3 h-3" /> Free Entry
            </button>

            <button
              onClick={() => setFilterType('paid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 ${
                filterType === 'paid'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <Lock className="w-3 h-3" /> Paid Entry
            </button>
          </div>
        </div>

        {/* Tournaments Grid */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-xs uppercase font-bold text-slate-400">Loading Tournaments...</p>
          </div>
        ) : filteredTournaments.length === 0 ? (
          <div className="py-16 text-center bg-slate-900/30 rounded-3xl border border-slate-800/80 p-8 sm:p-12">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Trophy className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-tight font-sans">
              No Tournaments Hosted Yet
            </h3>
            <p className="text-xs text-slate-400 mt-1.5 max-w-md mx-auto leading-relaxed">
              All demo data has been cleared. Be the very first organizer to launch a cricket tournament and auction pool on CricBid!
            </p>
            <Link
              href="/host"
              className="inline-flex items-center gap-2 mt-5 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg transform active:scale-95 transition-all"
            >
              <PlusCircle className="w-4 h-4 text-slate-950" />
              <span>+ Host Free Tournament Now</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.map((tournament) => {
              const isFree = !tournament.isPaid;
              return (
                <div
                  key={tournament.id}
                  className="rounded-3xl bg-slate-900/70 border border-slate-800 overflow-hidden flex flex-col group hover:border-amber-500/40 transition-all duration-300 shadow-xl hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                >
                  {/* Thumbnail Banner */}
                  <div className="relative h-44 w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tournament.bannerUrl}
                      alt={tournament.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                    {/* Top Tier Badge */}
                    <div className="absolute top-3 left-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1 ${
                          isFree
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-amber-400 text-slate-950'
                        }`}
                      >
                        {isFree ? (
                          <>
                            <Zap className="w-3 h-3 fill-current" /> FREE ENTRY
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3" /> ENTRY: ₹{tournament.entryFee}
                          </>
                        )}
                      </span>
                    </div>

                    {/* Live Count Pill */}
                    <div className="absolute top-3 right-3">
                      <span className="px-2 py-1 rounded-full bg-slate-950/80 backdrop-blur-sm border border-slate-700 text-amber-300 text-[10px] font-bold flex items-center gap-1">
                        <Flame className="w-3 h-3 text-rose-500 fill-current animate-pulse" />
                        <span>{tournament.registeredCount || 0} Registered</span>
                      </span>
                    </div>

                    {/* City / Venue at bottom of image */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center gap-1 text-[11px] text-slate-300 font-semibold drop-shadow-md truncate">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="truncate">{tournament.city} • {tournament.venue}</span>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tight line-clamp-1 group-hover:text-amber-400 transition-colors">
                        {tournament.title}
                      </h3>
                      {tournament.tagline && (
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                          {tournament.tagline}
                        </p>
                      )}

                      <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-xs text-slate-300">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">
                            Registration Closes
                          </span>
                          <span className="font-semibold text-slate-300">{tournament.registrationDeadline}</span>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">
                            Auction Date
                          </span>
                          <span className="font-semibold text-emerald-400">{tournament.auctionDate}</span>
                        </div>
                      </div>
                    </div>

                    {/* Register CTA Button */}
                    <div className="mt-5 pt-3 border-t border-slate-800">
                      <Link
                        href={`/tournament/${tournament.slug}/register`}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                          isFree
                            ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,232,123,0.3)]'
                            : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        }`}
                      >
                        <span>{isFree ? 'Register Free as Player' : `Register (₹${tournament.entryFee})`}</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        )}

      </section>

      {/* Host CTA Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="relative rounded-3xl p-8 sm:p-12 overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-[#0c182b] border border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.15)] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-xl text-center md:text-left">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30 inline-block mb-2">
              For Tournament Committees & Clubs
            </span>
            <h2 className="text-2xl sm:text-3xl font-black uppercase text-white font-sans">
              Organizing A Cricket Tournament?
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
              Launch your auction pool registration portal in under 2 minutes. Sync all player photos and stats straight into your Google Sheet without writing a single line of backend code.
            </p>
          </div>

          <Link
            href="/host"
            className="px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-400 hover:from-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(16,232,123,0.4)] transition-all shrink-0 flex items-center gap-2 transform active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Host Free Tournament Now</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-slate-950/80 py-8 text-center text-xs text-slate-500 z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 justify-center sm:justify-start">
            <span className="text-sm font-black text-white uppercase">Cric<span className="text-amber-400">Bid</span></span>
            <span>•</span>
            <span>Multi-Tournament Auction Draft Platform</span>
          </div>
          <div className="flex items-center gap-4 text-[11px]">
            <Link href="/" className="hover:text-slate-300">Explore Auctions</Link>
            <span>•</span>
            <Link href="/host" className="hover:text-slate-300">+ Host Tournament</Link>
            <span>•</span>
            <Link href="/admin" className="text-amber-400 hover:text-amber-300 font-bold">Admin Panel</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
