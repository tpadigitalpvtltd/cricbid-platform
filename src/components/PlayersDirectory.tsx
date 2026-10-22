'use client';

import React, { useState } from 'react';
import { RegistrationSubmission, PlayingRole } from '@/lib/types';
import {
  Users,
  Search,
  Swords,
  Flame,
  RotateCw,
  Sparkles,
  Target,
  Shield,
  Activity,
  CheckCircle2,
  User,
  Filter,
} from 'lucide-react';

interface PlayersDirectoryProps {
  players: RegistrationSubmission[];
  tournamentTitle: string;
}

export const PlayersDirectory: React.FC<PlayersDirectoryProps> = ({
  players,
  tournamentTitle,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('All');

  const filteredPlayers = players.filter((p) => {
    const matchesSearch =
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.role.toLowerCase().includes(search.toLowerCase()) ||
      (p.stats && p.stats.toLowerCase().includes(search.toLowerCase()));

    if (!matchesSearch) return false;
    if (roleFilter !== 'All' && p.role !== roleFilter) return false;
    return true;
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Pure Batsman':
        return <Swords className="w-3.5 h-3.5 text-amber-400" />;
      case 'Fast Bowler':
        return <Flame className="w-3.5 h-3.5 text-rose-400" />;
      case 'Spin Bowler':
        return <RotateCw className="w-3.5 h-3.5 text-cyan-400" />;
      case 'Batting All-Rounder':
        return <Sparkles className="w-3.5 h-3.5 text-yellow-400" />;
      case 'Bowling All-Rounder':
        return <Target className="w-3.5 h-3.5 text-emerald-400" />;
      case 'Wicketkeeper-Batsman':
        return <Shield className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Users className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  const roles = [
    'All',
    'Pure Batsman',
    'Fast Bowler',
    'Spin Bowler',
    'Batting All-Rounder',
    'Bowling All-Rounder',
    'Wicketkeeper-Batsman',
  ];

  return (
    <div className="w-full bg-slate-900/60 rounded-3xl p-5 sm:p-7 border border-slate-800 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
              Official Auction Draft Pool
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black uppercase text-white font-sans tracking-tight">
            Registered Players ({players.length})
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Complete list of verified players participating in the upcoming player auction.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by player name..."
            value={search}
            onChange={(e) => setSearch}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400 placeholder:text-slate-600"
          />
        </div>
      </div>

      {/* Role Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-6 scrollbar-none">
        {roles.map((r) => {
          const isSelected = roleFilter === r;
          const count =
            r === 'All' ? players.length : players.filter((p) => p.role === r).length;

          return (
            <button
              type="button"
              key={r}
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-amber-400 text-slate-950 shadow-md font-black'
                  : 'bg-slate-950/80 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>{r}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-slate-950/20 text-slate-950 font-black' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Players List Grid */}
      {filteredPlayers.length === 0 ? (
        <div className="text-center py-12 bg-slate-950/40 rounded-2xl border border-slate-800/60 p-6">
          <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h4 className="text-sm font-bold text-white uppercase">
            {players.length === 0
              ? 'No Players Registered Yet'
              : 'No Players Match Your Filter'}
          </h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {players.length === 0
              ? 'Be the very first player to register and claim your ticket in the auction draft!'
              : 'Try selecting "All" roles or clearing your search term.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlayers.map((player) => (
            <div
              key={player.registrationId}
              className="rounded-2xl bg-slate-950/80 border border-slate-800 p-4 transition-all hover:border-amber-400/40 flex flex-col justify-between group"
            >
              <div>
                {/* Top Row: Role & Ticket */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800/80">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-400/10 text-amber-400 border border-amber-400/20 flex items-center gap-1">
                    {getRoleIcon(player.role)}
                    <span>{player.role}</span>
                  </span>

                  <span className="text-[10px] font-mono text-slate-400">
                    {player.registrationId}
                  </span>
                </div>

                {/* Player Profile Info */}
                <div className="flex items-center gap-3.5 mb-3">
                  {/* Photo Avatar */}
                  <div className="w-14 h-14 rounded-xl p-[2px] bg-gradient-to-tr from-amber-400 via-amber-500 to-emerald-400 shrink-0">
                    <div className="w-full h-full rounded-[10px] bg-slate-900 overflow-hidden flex items-center justify-center">
                      {player.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={player.photoUrl}
                          alt={player.fullName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="w-6 h-6 text-slate-500" />
                      )}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-black text-white uppercase tracking-tight truncate group-hover:text-amber-400 transition-colors">
                      {player.fullName}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Age: <span className="text-slate-200 font-semibold">{player.age} yrs</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {player.battingStyle}
                      </span>
                      <span className="text-[10px] text-slate-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                        {player.bowlingStyle}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Achievements / Bio */}
                {player.stats && player.stats !== 'No previous achievements provided' && (
                  <div className="bg-slate-900/60 rounded-xl p-2.5 border border-slate-800/80 text-[11px] text-slate-300 italic line-clamp-2 mb-2">
                    &ldquo;{player.stats}&rdquo;
                  </div>
                )}
              </div>

              {/* Card Footer: Verified Badge */}
              <div className="flex items-center justify-between text-[10px] pt-2 border-t border-slate-900 text-slate-400">
                <span className="flex items-center gap-1 text-emerald-400 font-bold">
                  <CheckCircle2 className="w-3 h-3" /> VERIFIED DRAFT ENTRY
                </span>
                <span className="font-mono text-slate-500">
                  {player.paymentStatus === 'PAID' ? 'PAID ENTRY' : 'FREE ENTRY'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
