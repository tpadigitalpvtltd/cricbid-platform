'use client';

import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  MessageCircle,
  QrCode,
  Sparkles,
  Smartphone,
  ExternalLink,
  X,
  Download,
} from 'lucide-react';

interface TournamentShareBarProps {
  tournamentTitle: string;
  city: string;
  venue: string;
  auctionDate: string;
  isFree: boolean;
  entryFee: number;
  slug: string;
}

export const TournamentShareBar: React.FC<TournamentShareBarProps> = ({
  tournamentTitle,
  city,
  venue,
  auctionDate,
  isFree,
  entryFee,
  slug,
}) => {
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Get full tournament registration link
  const getShareUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/tournament/${slug}/register`;
    }
    return `https://cricbid-platform.vercel.app/tournament/${slug}/register`;
  };

  const shareUrl = getShareUrl();

  // WhatsApp pre-formatted viral share message
  const whatsappMessage =
    `🏏 *OFFICIAL PLAYER REGISTRATION OPEN!* 🏏\n\n` +
    `🏆 *Tournament:* ${tournamentTitle}\n` +
    `📍 *Venue:* ${city} • ${venue}\n` +
    `📅 *Auction Date:* ${auctionDate}\n` +
    `🎟️ *Entry Fee:* ${isFree ? 'FREE ENTRY (₹0)' : `₹${entryFee}`}\n\n` +
    `👉 *Click here to Register & Get Pass:* \n${shareUrl}\n\n` +
    `⚡ Register now to enter the auction draft pool!`;

  const whatsappHref = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

  // Copy link handler
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Failed to copy link', e);
    }
  };

  // Native Mobile Web Share API
  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${tournamentTitle} - Player Registration`,
          text: `Register for ${tournamentTitle} (${city}). Entry: ${isFree ? 'FREE' : `₹${entryFee}`}`,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed, fallback to copy
      }
    } else {
      handleCopyLink();
    }
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(shareUrl)}`;

  return (
    <>
      <div className="w-full rounded-3xl bg-[#090f1e]/95 border border-amber-500/30 p-5 sm:p-6 shadow-[0_0_35px_rgba(245,158,11,0.12)] relative overflow-hidden backdrop-blur-xl">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-amber-500/10 via-emerald-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-5">
          
          {/* Left: Branding & Info */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500/20 via-yellow-500/20 to-emerald-500/20 border border-amber-500/40 p-2.5 shrink-0 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Share2 className="w-6 h-6 stroke-[2.2]" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Official Share Link
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">Direct Player Portal</span>
              </div>
              <h3 className="text-base sm:text-lg font-black uppercase text-white tracking-tight">
                Invite Players to Register
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Share in WhatsApp groups, Instagram bio, or teams to join the auction draft pool.
              </p>
            </div>
          </div>

          {/* Right: Modern Share Buttons Group */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            
            {/* Primary WhatsApp Share Button */}
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2.5 shadow-[0_0_20px_rgba(16,185,129,0.35)] transition-all transform active:scale-95 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-current stroke-none" />
              <span>Share on WhatsApp</span>
            </a>

            {/* Native Mobile Share Button */}
            <button
              type="button"
              onClick={handleNativeShare}
              className="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer"
              title="Share via device apps"
            >
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>Share via App</span>
            </button>

            {/* Copy Direct Link Button */}
            <button
              type="button"
              onClick={handleCopyLink}
              className={`px-4 py-3 rounded-2xl border font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer ${
                copied
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-700/80 text-slate-200 hover:text-white'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="font-black text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-amber-400" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            {/* QR Code Toggle Button */}
            <button
              type="button"
              onClick={() => setShowQrModal(true)}
              className="px-3.5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-amber-400 hover:text-amber-300 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all transform active:scale-95 cursor-pointer"
              title="Show QR Code for ground posters or live scanning"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">QR Code</span>
            </button>

          </div>

        </div>

        {/* Link Input Bar for Easy Visual Reference */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80 flex items-center gap-2">
          <div className="flex-1 px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono text-[11px] text-slate-400 truncate select-all">
            {shareUrl}
          </div>
          <button
            type="button"
            onClick={handleCopyLink}
            className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold uppercase tracking-wider shrink-0 transition-colors"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

      </div>

      {/* QR Code Modal for Ground Posters / Live Scanning */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="max-w-sm w-full bg-[#090f1e] border border-amber-500/40 rounded-3xl p-6 sm:p-7 shadow-[0_0_50px_rgba(245,158,11,0.25)] text-center relative">
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900 border border-slate-800"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-6 h-6" />
            </div>

            <h3 className="text-base font-black uppercase text-white tracking-tight">
              Scan to Register
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 mb-5 truncate px-2">
              {tournamentTitle}
            </p>

            {/* QR Code Card Frame */}
            <div className="bg-white p-4 rounded-2xl inline-block shadow-2xl mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="Registration QR Code"
                className="w-48 h-48 sm:w-56 sm:h-56 object-contain"
              />
            </div>

            <p className="text-[11px] text-slate-400 mb-5">
              Scan with any mobile camera or Google Lens to open the registration pass form instantly.
            </p>

            <div className="flex items-center gap-2">
              <a
                href={qrImageUrl}
                download={`${slug}-qr-code.png`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span>Save QR Code</span>
              </a>

              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 text-xs font-bold uppercase tracking-wider"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
