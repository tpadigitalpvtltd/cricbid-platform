'use client';

import React from 'react';
import { Trophy, ShieldCheck, Flame, Radio, Zap } from 'lucide-react';

interface HeaderProps {
  tournamentName?: string;
  edition?: string;
  fee?: number;
}

export const Header: React.FC<HeaderProps> = ({
  tournamentName = process.env.NEXT_PUBLIC_TOURNAMENT_NAME || 'PREMIER CRICKET LEAGUE 2026',
  edition = process.env.NEXT_PUBLIC_TOURNAMENT_EDITION || 'SEASON 4 • MEGA PLAYER AUCTION',
  fee = Number(process.env.NEXT_PUBLIC_REGISTRATION_FEE) || 499,
}) => {
  return (
    <header className="relative w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl z-20">
      {/* Broadcast Live Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-yellow-500 to-emerald-500 text-slate-950 font-black text-[11px] tracking-widest uppercase py-1 px-4 text-center flex items-center justify-center gap-3 overflow-hidden">
        <span className="flex items-center gap-1.5 animate-pulse">
          <span className="w-2 h-2 rounded-full bg-red-600"></span>
          OFFICIAL DRAFT WINDOW OPEN
        </span>
        <span className="hidden sm:inline">•</span>
        <span className="hidden sm:inline">ALL CRICKET ROLES INVITED</span>
        <span className="hidden sm:inline">•</span>
        <span className="font-extrabold flex items-center gap-1">
          <Zap className="w-3 h-3 fill-current" /> AUCTION ENTRY FEE: ₹{fee}
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Left: Tournament Identity */}
        <div className="flex items-center gap-4 text-center sm:text-left">
          <div className="relative group">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-600 p-[2px] shadow-[0_0_20px_rgba(245,158,11,0.4)]">
              <div className="w-full h-full bg-[#080d1a] rounded-[14px] flex items-center justify-center relative overflow-hidden">
                <Trophy className="w-8 h-8 text-amber-400 group-hover:scale-110 transition-transform duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-amber-500/20 to-transparent pointer-events-none"></div>
              </div>
            </div>
            {/* Live indicator dot */}
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-[#080d1a]"></span>
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase flex items-center gap-1">
                <Radio className="w-3 h-3 animate-pulse text-emerald-400" /> Live Draft
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase">
                Verified Pool
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white uppercase font-sans mt-0.5">
              {tournamentName}
            </h1>
            <p className="text-xs sm:text-sm font-semibold tracking-wide text-slate-400 flex items-center gap-1.5 justify-center sm:justify-start">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>{edition}</span>
            </p>
          </div>
        </div>

        {/* Right: Security & Registration Info */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap justify-center">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="font-medium">Razorpay 256-bit Secure</span>
          </div>

          <div className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/30 text-amber-300 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
            <span>Entry Fee:</span>
            <span className="text-white text-base sm:text-lg font-black tracking-tight">₹{fee}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
