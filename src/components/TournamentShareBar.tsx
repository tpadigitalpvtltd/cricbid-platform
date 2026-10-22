'use client';

import React, { useState } from 'react';
import {
  Share2,
  Copy,
  Check,
  Send,
  MessageCircle,
  ExternalLink,
  Flame,
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

  // Get full tournament registration link
  const getShareUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/tournament/${slug}/register`;
    }
    return `https://cricbid-platform.vercel.app/tournament/${slug}/register`;
  };

  const shareUrl = getShareUrl();

  // WhatsApp formatted share text
  const message =
    `🏏 *PLAYER REGISTRATION OPEN!* 🏏\n\n` +
    `🏆 *Tournament:* ${tournamentTitle}\n` +
    `📍 *Venue:* ${city} • ${venue}\n` +
    `📅 *Auction Date:* ${auctionDate}\n` +
    `🎟️ *Entry Fee:* ${isFree ? 'FREE ENTRY (₹0)' : `₹${entryFee}`}\n\n` +
    `👉 *Click to Register as Player:* \n${shareUrl}\n\n` +
    `🔥 Register now and enter the official player draft pool!`;

  const whatsappHref = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
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

  return (
    <div className="w-full rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-emerald-500/30 p-4 shadow-[0_0_25px_rgba(16,232,123,0.15)] flex flex-col md:flex-row items-center justify-between gap-4">
      
      {/* Left: Branding & Callout */}
      <div className="flex items-center gap-3 text-center md:text-left">
        <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 p-1 shrink-0 flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="CricBid" className="w-full h-full object-contain" />
        </div>
        <div>
          <div className="flex items-center justify-center md:justify-start gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
              <Share2 className="w-3 h-3" /> Share Tournament
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:inline">Direct Player Registration Link</span>
          </div>
          <h4 className="text-sm font-black uppercase text-white mt-0.5">
            Invite Players to Register for this Auction
          </h4>
        </div>
      </div>

      {/* Right: Action Buttons */}
      <div className="flex items-center gap-2.5 w-full md:w-auto justify-center">
        {/* WhatsApp Share Button */}
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(16,232,123,0.3)] transition-all transform active:scale-95"
        >
          <MessageCircle className="w-4 h-4 fill-current" />
          <span>Share on WhatsApp</span>
        </a>

        {/* Copy Tournament Link Button */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              <span className="text-emerald-400 font-black">Link Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 text-amber-400" />
              <span>Copy Link</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
};
