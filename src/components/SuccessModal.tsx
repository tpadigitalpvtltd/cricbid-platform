'use client';

import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { RegistrationSubmission } from '@/lib/types';
import {
  CheckCircle,
  Share2,
  Printer,
  ShieldCheck,
  User,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface SuccessModalProps {
  registration: RegistrationSubmission;
  onReset: () => void;
  tournamentName?: string;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  registration,
  onReset,
  tournamentName = process.env.NEXT_PUBLIC_TOURNAMENT_NAME || 'CricBid Tournament 2026',
}) => {
  useEffect(() => {
    // Fire celebratory confetti on mount
    try {
      const duration = 2.5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const interval: any = setInterval(function () {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          return clearInterval(interval);
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#f59e0b', '#10e87b', '#3b82f6', '#ffffff'],
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#f59e0b', '#10e87b', '#3b82f6', '#ffffff'],
        });
      }, 250);

      return () => clearInterval(interval);
    } catch (e) {
      console.log('Confetti initialization error:', e);
    }
  }, []);

  function randomInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  // Construct WhatsApp share text
  const shareText = encodeURIComponent(
    `🏏 *REGISTRATION CONFIRMED!*\n\nI have registered for *${tournamentName}* on CricBid!\n\n` +
      `👤 *Player:* ${registration.fullName}\n` +
      `⚡ *Role:* ${registration.role}\n` +
      `🎫 *Player Ticket ID:* ${registration.registrationId}\n` +
      `✅ *Payment Status:* ${registration.paymentStatus === 'PAID' ? `Verified Paid (Ref: ${registration.paymentId})` : 'Free Entry Verified'}\n\n` +
      `See you at the Mega Player Auction! 🔥🏏`
  );

  const whatsappUrl = `https://api.whatsapp.com/send?text=${shareText}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
      <div className="relative w-full max-w-xl bg-[#090f1e] rounded-3xl border border-amber-500/40 p-6 sm:p-8 shadow-[0_0_50px_rgba(245,158,11,0.25)] text-slate-100 overflow-hidden">
        
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Animated Confirmation Header */}
        <div className="text-center relative mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/15 border-2 border-emerald-400 text-emerald-400 mb-3 shadow-[0_0_25px_rgba(16,232,123,0.4)] animate-bounce">
            <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12" />
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-black uppercase tracking-wider mb-1">
            Registration Verified & Profile Logged
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight font-sans">
            Registration Confirmed!
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Welcome to the official player draft pool. Your ticket pass is active.
          </p>
        </div>

        {/* Printable Player Passport / Ticket Card */}
        <div
          id="printable-ticket"
          className="relative rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-700/80 p-5 shadow-2xl mb-6 overflow-hidden"
        >
          {/* Card Top Strip with CricBid Logo */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="CricBid" className="w-5 h-5 object-contain" />
              <span className="text-xs font-black text-white uppercase tracking-wider">
                {tournamentName}
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20 font-bold uppercase">
              Official Auction Pass
            </span>
          </div>

          {/* Ticket Body */}
          <div className="flex items-center gap-4 mb-4">
            {/* Player Photo */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl p-[2px] bg-gradient-to-tr from-amber-400 to-emerald-400 shrink-0">
              <div className="w-full h-full rounded-[10px] bg-slate-900 overflow-hidden flex items-center justify-center">
                {registration.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={registration.photoUrl}
                    alt={registration.fullName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-8 h-8 text-slate-500" />
                )}
              </div>
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">
                {registration.role}
              </span>
              <h3 className="text-lg sm:text-xl font-black text-white uppercase truncate">
                {registration.fullName}
              </h3>
              <p className="text-xs text-slate-400">
                Age: {registration.age} • {registration.battingStyle} • {registration.bowlingStyle}
              </p>
            </div>
          </div>

          {/* Grid of Ticket Details */}
          <div className="grid grid-cols-2 gap-3 bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 text-xs mb-3">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Player Ticket ID
              </span>
              <span className="font-mono font-black text-amber-400 text-sm tracking-wide">
                {registration.registrationId}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Payment Reference ID
              </span>
              <span className="font-mono text-slate-300 text-xs truncate block" title={registration.paymentId}>
                {registration.paymentId}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Registered Phone
              </span>
              <span className="text-slate-300 font-mono">
                +91 {registration.phone}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                Payment Status
              </span>
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> {registration.paymentStatus === 'PAID' ? `PAID (₹${registration.amount})` : 'FREE ENTRY'}
              </span>
            </div>
          </div>

          {/* Barcode styling */}
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pt-2 border-t border-slate-800">
            <span>TIMESTAMP: {registration.timestamp}</span>
            <span className="tracking-widest">||||| | |||| || |||||</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* WhatsApp Share Button */}
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,232,123,0.3)] transition-all"
          >
            <Share2 className="w-4 h-4 fill-current" />
            <span>Share My Pass on WhatsApp</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Print Pass Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="w-full sm:w-auto py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-sm border border-slate-700 flex items-center justify-center gap-2 transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Pass</span>
          </button>
        </div>

        {/* Register Another Player Link */}
        <div className="text-center mt-5 pt-4 border-t border-slate-800/80">
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-bold text-slate-400 hover:text-amber-400 flex items-center justify-center gap-1.5 mx-auto transition-colors"
          >
            <span>Register Another Player for Draft</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
