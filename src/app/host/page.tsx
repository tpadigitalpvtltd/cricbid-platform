'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import {
  Trophy,
  MapPin,
  Calendar,
  Image as ImageIcon,
  FileSpreadsheet,
  Lock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Info,
  ExternalLink,
  Flame,
} from 'lucide-react';

const PRESET_BANNERS = [
  {
    name: 'Floodlit Stadium Night',
    url: 'https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Day Match Arena',
    url: 'https://images.unsplash.com/photo-1531415074868-036b1c57e3ce?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Turf Pitch Sunset',
    url: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Championship Ground',
    url: 'https://images.unsplash.com/photo-1624526267942-ab0ff8a3e972?q=80&w=1200&auto=format&fit=crop',
  },
];

export default function HostTournamentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    tagline: '',
    city: '',
    venue: '',
    bannerUrl: PRESET_BANNERS[0].url,
    registrationDeadline: '2026-11-30',
    auctionDate: '2026-12-05',
    googleSheetUrl: '',
    organizerName: '',
    organizerContact: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!form.title.trim()) newErrors.title = 'Tournament title is required';
    if (!form.city.trim()) newErrors.city = 'City is required';
    if (!form.venue.trim()) newErrors.venue = 'Venue or stadium is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (res.ok && data.success && data.tournament) {
        // Save locally on client as well to guarantee zero data loss across cold starts
        try {
          const stored = localStorage.getItem('cricbid_client_tournaments');
          const list = stored ? JSON.parse(stored) : [];
          const exists = list.some((t: any) => t.slug === data.tournament.slug);
          if (!exists) {
            list.unshift(data.tournament);
            localStorage.setItem('cricbid_client_tournaments', JSON.stringify(list));
          }
        } catch (e) {
          // ignore localStorage failure
        }
        setCreatedSlug(data.tournament.slug);
      } else {
        alert(data.error || 'Failed to create tournament');
      }
    } catch (err: any) {
      alert(err.message || 'Error occurred while creating tournament');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen stadium-bg flex flex-col relative text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 z-10">
        
        {/* Header Hero */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Public Organizer Tier • 100% Free
          </div>
          <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white font-sans">
            Host Your Cricket Tournament
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl mx-auto">
            Create an auction portal, collect player applications, and sync registrations directly to your Google Sheet.
          </p>
        </div>

        {/* Creation Success Modal / Banner */}
        {createdSlug && (
          <div className="mb-8 p-6 rounded-3xl bg-emerald-950/80 border-2 border-emerald-500/50 shadow-[0_0_30px_rgba(16,232,123,0.3)] text-center animate-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">
              Tournament Created Successfully!
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Your free player registration page is ready to accept players.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-4">
              <button
                type="button"
                onClick={() => router.push(`/tournament/${createdSlug}/register`)}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2"
              >
                <span>View Registration Page</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider"
              >
                Back to Explore Auctions
              </button>
            </div>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Section 1: Tournament Essentials */}
          <div className="bg-slate-900/60 rounded-3xl p-5 sm:p-7 border border-slate-800 backdrop-blur-md shadow-xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                1
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Tournament Essentials
              </h3>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Tournament Title <span className="text-amber-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Pune T20 Super Cup 2026"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-400 transition-all placeholder:text-slate-600"
                  />
                </div>
                {errors.title && <p className="text-xs text-rose-400 mt-1">{errors.title}</p>}
              </div>

              {/* Tagline */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Tagline / Edition (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Season 2 • Night Floodlight Championship"
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-400 transition-all placeholder:text-slate-600"
                />
              </div>

              {/* City & Venue */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    City / Region <span className="text-amber-400">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. Pune"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-400 transition-all placeholder:text-slate-600"
                    />
                  </div>
                  {errors.city && <p className="text-xs text-rose-400 mt-1">{errors.city}</p>}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Ground / Stadium Venue <span className="text-amber-400">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MCA Stadium Complex"
                    value={form.venue}
                    onChange={(e) => setForm({ ...form, venue: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-400 transition-all placeholder:text-slate-600"
                  />
                  {errors.venue && <p className="text-xs text-rose-400 mt-1">{errors.venue}</p>}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Banner & Schedule */}
          <div className="bg-slate-900/60 rounded-3xl p-5 sm:p-7 border border-slate-800 backdrop-blur-md shadow-xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
                2
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Banner & Important Dates
              </h3>
            </div>

            {/* Banner Presets */}
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
                Select Banner / Cover Image
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PRESET_BANNERS.map((preset) => {
                  const isSelected = form.bannerUrl === preset.url;
                  return (
                    <button
                      type="button"
                      key={preset.name}
                      onClick={() => setForm({ ...form, bannerUrl: preset.url })}
                      className={`relative rounded-xl overflow-hidden border transition-all text-left group ${
                        isSelected
                          ? 'border-amber-400 ring-2 ring-amber-400/40 shadow-lg'
                          : 'border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="h-16 w-full relative">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preset.url}
                          alt={preset.name}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      </div>
                      <div className="p-1.5 bg-slate-950 text-[10px] font-bold text-slate-300 truncate">
                        {preset.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Registration Deadline
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="date"
                    value={form.registrationDeadline}
                    onChange={(e) => setForm({ ...form, registrationDeadline: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-400 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Mega Auction Date
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <input
                    type="date"
                    value={form.auctionDate}
                    onChange={(e) => setForm({ ...form, auctionDate: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-400 transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Google Sheets & Organizer Contact */}
          <div className="bg-slate-900/60 rounded-3xl p-5 sm:p-7 border border-slate-800 backdrop-blur-md shadow-xl">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
                3
              </div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Google Sheet Webhook (Optional)
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                  Your Google Apps Script Web App URL
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  </div>
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    value={form.googleSheetUrl}
                    onChange={(e) => setForm({ ...form, googleSheetUrl: e.target.value })}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-400 transition-all placeholder:text-slate-600 font-mono text-xs"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
                  Every player registration is automatically appended into this spreadsheet in real time. (Leave blank to use default portal sheet).
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Organizer Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra Sports Club"
                    value={form.organizerName}
                    onChange={(e) => setForm({ ...form, organizerName: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-400 transition-all placeholder:text-slate-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
                    Organizer WhatsApp / Helpline
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    value={form.organizerContact}
                    onChange={(e) => setForm({ ...form, organizerContact: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-400 transition-all placeholder:text-slate-600 font-mono"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Tiered Model Badge (LOCKED / DISABLED) */}
          <div className="bg-gradient-to-br from-slate-900/90 to-slate-950 rounded-3xl p-5 sm:p-7 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,232,123,0.1)] relative overflow-hidden">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Free Registration Mode
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-400" /> Razorpay Locked
                  </span>
                </div>
                <h4 className="text-base font-extrabold text-white">
                  Public Tournament Tier (Zero Platform Fees)
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xl">
                  Public host tournaments allow players to register completely free. If you want to charge a player entry fee (₹) via Razorpay, it can be unlocked by the Super Admin in the Admin Panel.
                </p>
              </div>

              <div className="px-4 py-2 rounded-xl bg-slate-950/80 border border-slate-800 text-center shrink-0">
                <span className="text-[10px] font-bold uppercase text-slate-500 block">Entry Fee</span>
                <span className="text-lg font-black text-emerald-400">₹0 (FREE)</span>
              </div>
            </div>
          </div>

          {/* Launch Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500 hover:from-emerald-400 hover:to-green-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-[0_0_25px_rgba(16,232,123,0.4)] transition-all transform active:scale-95 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isSubmitting ? (
              <span>Deploying Tournament...</span>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>Publish Free Tournament & Open Registrations</span>
                <ArrowRight className="w-4 h-4 text-slate-950" />
              </>
            )}
          </button>

        </form>
      </main>
    </div>
  );
}
