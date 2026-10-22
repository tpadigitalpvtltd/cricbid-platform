'use client';

import React from 'react';
import { PlayingRole } from '@/lib/types';
import {
  Swords,
  Flame,
  RotateCw,
  Sparkles,
  Target,
  Shield,
  CheckCircle2,
} from 'lucide-react';

interface RoleOption {
  id: PlayingRole;
  title: string;
  tagline: string;
  badge: string;
  icon: React.ReactNode;
}

const ROLES: RoleOption[] = [
  {
    id: 'Pure Batsman',
    title: 'Pure Batsman',
    tagline: 'Top/Middle order run-machine & boundary specialist',
    badge: 'BATSMAN',
    icon: <Swords className="w-5 h-5" />,
  },
  {
    id: 'Fast Bowler',
    title: 'Fast Bowler',
    tagline: 'Express pace, swing, seam & yorker specialist',
    badge: 'PACER',
    icon: <Flame className="w-5 h-5" />,
  },
  {
    id: 'Spin Bowler',
    title: 'Spin Bowler',
    tagline: 'Deceptive turn, flight, bounce & mystery variations',
    badge: 'SPINNER',
    icon: <RotateCw className="w-5 h-5" />,
  },
  {
    id: 'Batting All-Rounder',
    title: 'Batting All-Rounder',
    tagline: 'Heavy impact with the bat + reliable overs in hand',
    badge: 'BAT-ALL',
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    id: 'Bowling All-Rounder',
    title: 'Bowling All-Rounder',
    tagline: 'Strike bowler + explosive lower-order firepower',
    badge: 'BOWL-ALL',
    icon: <Target className="w-5 h-5" />,
  },
  {
    id: 'Wicketkeeper-Batsman',
    title: 'Wicketkeeper-Batsman',
    tagline: 'Safe hands behind the stumps + clinical match finisher',
    badge: 'WK-BAT',
    icon: <Shield className="w-5 h-5" />,
  },
];

interface RoleSelectorProps {
  selectedRole: PlayingRole;
  onChange: (role: PlayingRole) => void;
  error?: string;
}

export const RoleSelector: React.FC<RoleSelectorProps> = ({
  selectedRole,
  onChange,
  error,
}) => {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2.5">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
          Primary Playing Role <span className="text-amber-400">*</span>
        </label>
        <span className="text-[11px] text-slate-400 font-medium">Select 1 Role</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {ROLES.map((role) => {
          const isSelected = selectedRole === role.id;
          return (
            <button
              type="button"
              key={role.id}
              onClick={() => onChange(role.id)}
              className={`relative flex flex-col items-start p-3.5 rounded-xl border text-left transition-all duration-200 group overflow-hidden ${
                isSelected
                  ? 'border-amber-400 bg-gradient-to-br from-amber-500/15 via-slate-900/90 to-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/50'
                  : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/90'
              }`}
            >
              {/* Top Accent Strip */}
              <div
                className={`absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-200 ${
                  isSelected ? 'bg-gradient-to-r from-amber-400 to-yellow-500 opacity-100' : 'opacity-0'
                }`}
              />

              <div className="flex items-center justify-between w-full mb-2">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                      : 'bg-slate-800 text-slate-400 group-hover:text-amber-400 group-hover:bg-slate-800/80'
                  }`}
                >
                  {role.icon}
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded tracking-wider ${
                      isSelected
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {role.badge}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                  )}
                </div>
              </div>

              <h4
                className={`text-sm font-bold tracking-tight transition-colors ${
                  isSelected ? 'text-white' : 'text-slate-200 group-hover:text-white'
                }`}
              >
                {role.title}
              </h4>

              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {role.tagline}
              </p>
            </button>
          );
        })}
      </div>

      {error && <p className="text-xs text-rose-400 mt-1.5 font-medium">{error}</p>}
    </div>
  );
};
