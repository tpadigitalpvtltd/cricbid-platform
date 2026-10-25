'use client';

import React from 'react';
import { PlayerFormData } from '@/lib/types';
import {
  Trophy,
  ShieldCheck,
  Zap,
  Activity,
  Flame,
  User,
  Sparkles,
  Swords,
  Award,
  QrCode,
} from 'lucide-react';

interface PlayerPreviewCardProps {
  formData: PlayerFormData;
  registrationFee?: number;
}

export const PlayerPreviewCard: React.FC<PlayerPreviewCardProps> = ({
  formData,
  registrationFee = 0,
}) => {
  const {
    fullName,
    age,
    role,
    battingStyle,
    bowlingStyle,
    stats,
    photoUrl,
    phone,
  } = formData;

  const displayName = fullName.trim() || 'Player Name';
  const displayAge = age ? `${age} YRS` : 'Age --';
  const displayRole = role || 'Pure Batsman';

  // Mask phone for privacy in live preview
  const maskedPhone =
    phone.length >= 10
      ? `+91 ${phone.slice(0, 3)}•••••${phone.slice(-2)}`
      : phone.length > 0
      ? `+91 ${phone}`
      : '+91 ••••• •••••';

  const isFree = registrationFee === 0;

  return (
    <div className="w-full sticky top-6">
      
      {/* Live Badge Indicator */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 font-sans">
            Live Player Pass Preview
          </h3>
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/20">
          Official Draft Card
        </span>
      </div>

      {/* Broadcast Holographic Card Container */}
      <div className="relative rounded-3xl p-[2px] bg-gradient-to-b from-amber-400 via-amber-500/40 to-emerald-400/40 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.9)] overflow-hidden transition-all duration-300 group hover:shadow-[0_20px_60px_-10px_rgba(245,158,11,0.3)]">
        
        {/* Glow ambient background inside */}
        <div className="relative rounded-[22px] bg-[#080d1a] overflow-hidden text-slate-100 p-5 sm:p-6 border border-slate-800/90">
          
          {/* Top subtle shine / ambient lights */}
          <div className="absolute top-0 right-0 w-56 h-56 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-56 h-56 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
          
          {/* Card Broadcast Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3.5 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shadow-md">
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <span className="text-xs font-black tracking-wider text-amber-400 uppercase font-sans block leading-none">
                  CRICBID DRAFT PASS
                </span>
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  Season 2026 Edition
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-black text-emerald-400 uppercase tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Verified Athlete</span>
            </div>
          </div>

          {/* Player Photo + Profile Details */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 mb-5">
            
            {/* Avatar / Photo with luxury gold frame */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl p-[3px] bg-gradient-to-tr from-amber-400 via-yellow-300 to-emerald-400 shadow-[0_0_25px_rgba(245,158,11,0.35)]">
                <div className="w-full h-full rounded-[13px] bg-slate-950 overflow-hidden flex items-center justify-center relative">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl}
                      alt={displayName}
                      className="w-full h-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500 p-2 text-center">
                      <User className="w-10 h-10 text-slate-600 mb-1" />
                      <span className="text-[9px] uppercase font-black tracking-wider text-slate-500">
                        Passport Photo
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verified badge pill */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 fill-slate-950" />
                <span>CONFIRMED</span>
              </div>
            </div>

            {/* Core Info */}
            <div className="flex-1 text-center sm:text-left min-w-0 w-full">
              
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mb-1.5">
                <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-amber-400 text-slate-950 uppercase tracking-wider shadow-sm">
                  {displayRole}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-slate-900 border border-slate-800 text-slate-300 uppercase">
                  {displayAge}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white truncate drop-shadow font-sans">
                {displayName}
              </h2>

              <p className="text-xs text-slate-400 font-mono mt-0.5 font-semibold">
                {maskedPhone}
              </p>

              {/* Tactical Style Pills */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-bold text-amber-300">
                  <Swords className="w-3 h-3 text-amber-400" />
                  <span>{battingStyle}</span>
                </div>
                {role !== 'Pure Batsman' && bowlingStyle && bowlingStyle !== 'None' && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-bold text-emerald-300">
                    <Flame className="w-3 h-3 text-emerald-400" />
                    <span>{bowlingStyle}</span>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Highlights & Stats Quote Box */}
          <div className="bg-slate-950/80 rounded-2xl p-3.5 border border-slate-800 mb-4 shadow-inner">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
              <span className="flex items-center gap-1 text-amber-400">
                <Award className="w-3 h-3" /> Career Highlights & Stats
              </span>
              <span className="text-slate-500 font-mono">AUCTION PROFILE</span>
            </div>
            {stats.trim() ? (
              <p className="text-xs text-slate-200 line-clamp-3 leading-relaxed">
                &ldquo;{stats.trim()}&rdquo;
              </p>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Your stats and achievements will appear here.
              </p>
            )}
          </div>

          {/* Auction Financials Matrix */}
          <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80">
            <div className="bg-slate-950/90 rounded-xl p-2.5 text-center border border-slate-800">
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                Tournament Fee
              </span>
              <span className={`text-sm font-black ${isFree ? 'text-emerald-400' : 'text-amber-400'}`}>
                {isFree ? '₹0 FREE' : `₹${registrationFee}`}
              </span>
            </div>

            <div className="bg-slate-950/90 rounded-xl p-2.5 text-center border border-slate-800">
              <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">
                Draft Status
              </span>
              <span className="text-sm font-black text-emerald-400 flex items-center justify-center gap-1">
                <Zap className="w-3.5 h-3.5 fill-current" /> READY TO BID
              </span>
            </div>
          </div>

          {/* Simulated Barcode & Security Strip */}
          <div className="mt-4 pt-3 flex items-center justify-between text-[10px] text-slate-500 font-mono border-t border-slate-900">
            <div className="flex items-center gap-2">
              <div className="flex gap-[2px] h-4 items-center opacity-70">
                <div className="w-[2px] h-4 bg-slate-400" />
                <div className="w-[1px] h-4 bg-slate-400" />
                <div className="w-[3px] h-4 bg-slate-400" />
                <div className="w-[1px] h-4 bg-slate-400" />
                <div className="w-[2px] h-4 bg-slate-400" />
                <div className="w-[4px] h-4 bg-slate-400" />
                <div className="w-[1px] h-4 bg-slate-400" />
              </div>
              <span>CRIC-PASS-2026</span>
            </div>
            <span className="text-amber-400 font-black tracking-wider uppercase">
              100% VERIFIED ENTRY
            </span>
          </div>

        </div>
      </div>

    </div>
  );
};
