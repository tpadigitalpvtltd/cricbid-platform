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
} from 'lucide-react';

interface PlayerPreviewCardProps {
  formData: PlayerFormData;
  registrationFee?: number;
}

export const PlayerPreviewCard: React.FC<PlayerPreviewCardProps> = ({
  formData,
  registrationFee = 499,
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

  const displayName = fullName.trim() || 'PLAYER NAME';
  const displayAge = age ? `${age} YRS` : 'AGE --';
  const displayRole = role || 'Pure Batsman';
  const displayStats =
    stats.trim() ||
    'Top performer with consistent strike rate, tactical match awareness, and tournament hunger.';

  // Mask phone for privacy in preview
  const maskedPhone =
    phone.length >= 10
      ? `+91 ${phone.slice(0, 3)}•••••${phone.slice(-2)}`
      : '+91 ••••• •••••';

  return (
    <div className="w-full sticky top-6">
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
          <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400">
            Live Player Card Preview
          </h3>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
          Auction Pass v2.4
        </span>
      </div>

      {/* Broadcast Holographic Card */}
      <div className="relative rounded-3xl p-[2px] bg-gradient-to-b from-amber-400 via-amber-500/40 to-emerald-500/30 shadow-[0_15px_40px_-10px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-300">
        
        {/* Glow ambient background inside */}
        <div className="relative rounded-[22px] bg-[#090f1e] overflow-hidden text-slate-100 p-5 sm:p-6 border border-slate-800/80">
          
          {/* Top subtle shine / ambient lights */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          {/* Card Broadcast Header Bar */}
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-amber-400/20 border border-amber-400/40 flex items-center justify-center">
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <span className="text-xs font-black tracking-wider text-amber-400 uppercase">
                PCL DRAFT POOL
              </span>
            </div>

            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-extrabold text-emerald-400 uppercase">
              <ShieldCheck className="w-3 h-3" />
              <span>Official Card</span>
            </div>
          </div>

          {/* Player Photo + Key Highlights */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 mb-5">
            {/* Avatar / Photo with broadcast golden ring */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl p-[3px] bg-gradient-to-tr from-amber-400 via-yellow-300 to-emerald-400 shadow-[0_0_20px_rgba(245,158,11,0.3)]">
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
                      <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500">
                        Upload Photo
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Verified badge pill */}
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5 fill-current" />
                <span>VERIFIED</span>
              </div>
            </div>

            {/* Core Info */}
            <div className="flex-1 text-center sm:text-left min-w-0 w-full">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mb-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-400 text-slate-950 uppercase tracking-wider">
                  {displayRole}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 uppercase">
                  {displayAge}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white truncate drop-shadow-sm font-sans">
                {displayName}
              </h2>

              <p className="text-xs text-slate-400 font-mono mt-0.5">
                {maskedPhone}
              </p>

              {/* Style Pills */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2.5">
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300">
                  <Activity className="w-3 h-3 text-amber-400" />
                  <span>{battingStyle}</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-medium text-slate-300">
                  <Flame className="w-3 h-3 text-emerald-400" />
                  <span>{bowlingStyle}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Achievements / Bio Section */}
          <div className="bg-slate-950/70 rounded-xl p-3 border border-slate-800/90 mb-4">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              <span>Career Highlights / Stats</span>
              <span className="text-amber-400">Profile Bio</span>
            </div>
            <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed italic">
              &ldquo;{displayStats}&rdquo;
            </p>
          </div>

          {/* Auction Financials Bar */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
            <div className="bg-slate-900/60 rounded-lg p-2 text-center border border-slate-800/60">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Entry Fee
              </span>
              <span className="text-sm font-black text-white">₹{registrationFee}</span>
            </div>
            <div className="bg-slate-900/60 rounded-lg p-2 text-center border border-slate-800/60">
              <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                Draft Status
              </span>
              <span className="text-sm font-black text-emerald-400 flex items-center justify-center gap-1">
                <Zap className="w-3 h-3 fill-current" /> ELIGIBLE
              </span>
            </div>
          </div>

          {/* Bottom Security Hologram Strip */}
          <div className="mt-4 pt-2.5 flex items-center justify-between text-[10px] text-slate-500 font-mono border-t border-slate-900">
            <span>SECURE DRAFT CODE: ••••</span>
            <span className="text-amber-500/80 font-bold uppercase">SEASON 2026 OFFICIAL</span>
          </div>

        </div>
      </div>
    </div>
  );
};
