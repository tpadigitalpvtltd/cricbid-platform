'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, KeyRound, X, ArrowRight, ShieldAlert, Eye, EyeOff } from 'lucide-react';

interface AdminPinModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminPinModal: React.FC<AdminPinModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validPassword = process.env.NEXT_PUBLIC_ADMIN_PIN || 'Shoaib@55';

    if (password.trim() === validPassword) {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('cricbid_admin_auth', 'true');
      }
      setError('');
      onClose();
      router.push('/admin');
    } else {
      setError('Invalid administrator password. Access denied.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-[#090f1e] rounded-3xl border border-amber-500/30 p-6 shadow-[0_0_50px_rgba(245,158,11,0.2)] text-slate-100 overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight font-sans">
            Super Admin Access
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Enter master administrator credentials to access platform controls
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <KeyRound className="w-4 h-4 text-amber-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter Admin Password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                autoFocus
                className="w-full pl-10 pr-10 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 font-mono tracking-wider placeholder:tracking-normal placeholder:text-slate-600 transition-all text-center"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && (
              <p className="text-xs text-rose-400 mt-2 flex items-center justify-center gap-1 font-medium">
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-95"
          >
            <span>Unlock Admin Panel</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
};
