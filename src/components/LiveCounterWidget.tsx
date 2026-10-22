'use client';

import React, { useEffect, useState } from 'react';
import { Flame, Radio, RefreshCw, Users, ShieldCheck } from 'lucide-react';

interface LiveCounterWidgetProps {
  tournamentSlug: string;
  initialCount?: number;
}

export const LiveCounterWidget: React.FC<LiveCounterWidgetProps> = ({
  tournamentSlug,
  initialCount = 0,
}) => {
  const [count, setCount] = useState<number>(initialCount);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [source, setSource] = useState<'google_sheet' | 'local_store'>('local_store');

  const fetchLiveCount = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(`/api/tournaments/${tournamentSlug}/stats`);
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data.registeredCount === 'number') {
          setCount(data.registeredCount);
          if (data.source) setSource(data.source);
        }
      }
    } catch (err) {
      console.error('Failed to fetch live counter:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveCount();
    // Refresh every 20 seconds for real-time auction draft hype
    const interval = setInterval(fetchLiveCount, 20000);
    return () => clearInterval(interval);
  }, [tournamentSlug]);

  return (
    <div className="w-full rounded-2xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-emerald-500/10 border border-amber-500/30 p-3 sm:p-4 backdrop-blur-md shadow-[0_0_30px_rgba(245,158,11,0.15)] flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in">
      
      {/* Left: Dynamic Live Counter */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse">
            <Flame className="w-6 h-6 fill-current text-yellow-300" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border-2 border-[#080d1a]"></span>
          </span>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 uppercase tracking-widest flex items-center gap-1">
              <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE DRAFT POOL
            </span>
            {source === 'google_sheet' && (
              <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Synced to Sheet
              </span>
            )}
          </div>
          
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl sm:text-2xl font-black text-white font-sans tracking-tight">
              🔥 <span className="text-amber-400">{count}</span> Players Already Registered!
            </span>
          </div>
        </div>
      </div>

      {/* Right: Refresh button and status */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="hidden md:inline font-mono text-[11px]">Auto-refreshing</span>
        <button
          type="button"
          onClick={fetchLiveCount}
          disabled={isRefreshing}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-[11px]"
          title="Refresh Live Count"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>

    </div>
  );
};
