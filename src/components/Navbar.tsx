'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Trophy,
  PlusCircle,
  Lock,
  Menu,
  X,
  Zap,
} from 'lucide-react';
import { AdminPinModal } from './AdminPinModal';

export const Navbar: React.FC = () => {
  const pathname = usePathname();
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      {/* Broadcast Live Top Ticker */}
      <div className="bg-gradient-to-r from-amber-600 via-yellow-500 to-emerald-500 text-slate-950 font-black text-[11px] tracking-widest uppercase py-1 px-4 text-center flex items-center justify-center gap-3 overflow-hidden select-none">
        <span className="flex items-center gap-1.5 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-red-600"></span>
          CRICBID LIVE AUCTION PLATFORM
        </span>
        <span className="hidden md:inline">•</span>
        <span className="hidden md:inline">HOST FREE TOURNAMENTS WITH GOOGLE SHEETS</span>
        <span className="hidden md:inline">•</span>
        <span className="flex items-center gap-1 font-extrabold">
          <Zap className="w-3 h-3 fill-current" /> OFFICIAL DRAFT POOL
        </span>
      </div>

      {/* Main Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#080d1a]/95 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4 py-2.5">
          
          {/* Brand Logo with Official CricBid Logo Image */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-tr from-amber-400 via-yellow-400 to-emerald-400 p-[2px] shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                <div className="w-full h-full bg-[#080d1a] rounded-[10px] flex items-center justify-center p-1 overflow-hidden group-hover:scale-105 transition-transform duration-300">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/logo.png"
                    alt="CricBid Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-[#080d1a]"></span>
              </span>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase font-sans">
                  Cric<span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-yellow-300">Bid</span>
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-black tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                  PRO
                </span>
              </div>
              <p className="text-[10px] font-bold tracking-wider text-slate-400 uppercase hidden sm:block">
                Cricket Auctions & Player Drafts
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 lg:gap-2">
            <Link
              href="/"
              className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${
                pathname === '/'
                  ? 'bg-amber-400/10 text-amber-300 border border-amber-400/30'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>Explore Auctions</span>
            </Link>

            <Link
              href="/host"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(16,232,123,0.3)] transition-all flex items-center gap-2 group transform active:scale-95"
            >
              <PlusCircle className="w-4 h-4 text-slate-950 group-hover:rotate-90 transition-transform duration-300" />
              <span>+ Host Free Auction</span>
            </Link>

            {/* Admin Access Lock Button */}
            <button
              type="button"
              onClick={() => setIsAdminModalOpen(true)}
              className="ml-1 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-amber-300 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 hover:border-amber-500/40"
              title="Super Admin Dashboard"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>Admin Access</span>
            </button>
          </nav>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setIsAdminModalOpen(true)}
              className="p-2 rounded-lg border border-slate-800 bg-slate-900 text-amber-400"
              aria-label="Admin Access"
            >
              <Lock className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800/80 bg-slate-950/95 px-4 py-4 space-y-2 animate-in slide-in-from-top-2">
            <Link
              href="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-slate-900/60 text-slate-200 text-xs font-bold uppercase tracking-wider"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Explore Auctions</span>
            </Link>

            <Link
              href="/host"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Host Free Auction</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsAdminModalOpen(true);
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 text-xs font-bold uppercase tracking-wider"
            >
              <Lock className="w-4 h-4" />
              <span>Admin Access Panel</span>
            </button>
          </div>
        )}
      </header>

      {/* Admin PIN Dialog */}
      <AdminPinModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
      />
    </>
  );
};
