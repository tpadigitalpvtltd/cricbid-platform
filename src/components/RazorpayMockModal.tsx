'use client';

import React, { useState } from 'react';
import {
  CreditCard,
  QrCode,
  Building2,
  Lock,
  CheckCircle2,
  X,
  AlertTriangle,
  Smartphone,
  ShieldCheck,
} from 'lucide-react';

interface RazorpayMockModalProps {
  isOpen: boolean;
  amount: number;
  playerName: string;
  phone: string;
  onSuccess: (paymentId: string) => void;
  onCancel: () => void;
}

export const RazorpayMockModal: React.FC<RazorpayMockModalProps> = ({
  isOpen,
  amount,
  playerName,
  phone,
  onSuccess,
  onCancel,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSimulateSuccess = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const mockPayId = `pay_mock_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
      setIsProcessing(false);
      onSuccess(mockPayId);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-[#0a1222] rounded-2xl border border-blue-500/30 shadow-[0_0_50px_rgba(59,130,246,0.3)] text-slate-100 overflow-hidden">
        
        {/* Top Razorpay Header Bar */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white p-1 flex items-center justify-center shadow-md">
              <span className="text-blue-700 font-black text-sm tracking-tighter">Rzp</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm font-black tracking-wide">Razorpay Checkout</h3>
                <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded">
                  Demo Mode
                </span>
              </div>
              <p className="text-[11px] text-blue-200">Local Testing & Preview Gateway</p>
            </div>
          </div>

          <button
            onClick={onCancel}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Amount & Merchant Overview */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Paying for
            </span>
            <p className="text-xs font-bold text-white truncate max-w-[200px]">
              {playerName || 'Player'} Registration
            </p>
            <p className="text-[11px] text-slate-400 font-mono">+91 {phone}</p>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</span>
            <div className="text-xl font-black text-emerald-400 font-sans">₹{amount}</div>
          </div>
        </div>

        {/* Demo Notice Banner */}
        <div className="px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-start gap-2 text-amber-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>Local Test Mode Active:</strong> You can test the payment and submission flow without real cards or UPI. Real keys can be added to <code className="bg-amber-950/80 px-1 rounded text-amber-200">.env.local</code> anytime.
          </span>
        </div>

        {/* Payment Methods Simulation */}
        <div className="p-4 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
            Select Test Payment Option
          </span>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setSelectedMethod('upi')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold ${
                selectedMethod === 'upi'
                  ? 'border-emerald-400 bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-400/40'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Smartphone className="w-5 h-5 text-emerald-400" />
              <span>UPI / QR</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('card')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold ${
                selectedMethod === 'card'
                  ? 'border-blue-400 bg-blue-500/10 text-blue-300 ring-1 ring-blue-400/40'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <CreditCard className="w-5 h-5 text-blue-400" />
              <span>Card</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedMethod('netbanking')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold ${
                selectedMethod === 'netbanking'
                  ? 'border-purple-400 bg-purple-500/10 text-purple-300 ring-1 ring-purple-400/40'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              <Building2 className="w-5 h-5 text-purple-400" />
              <span>NetBanking</span>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-emerald-400" />
              <span>Simulated {selectedMethod.toUpperCase()} Gateway Ready</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
              INSTANT
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-900/60 border-t border-slate-800 space-y-2">
          <button
            type="button"
            onClick={handleSimulateSuccess}
            disabled={isProcessing}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-slate-950 font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,232,123,0.3)] transition-all disabled:opacity-60"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Simulating Payment Verification...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Simulate Successful Payment (₹{amount})</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-rose-400 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            <span>Simulate Payment Cancellation / Close</span>
          </button>
        </div>

        {/* Razorpay Footer */}
        <div className="px-4 py-2 bg-slate-950 text-center text-[10px] text-slate-500 border-t border-slate-900 flex items-center justify-center gap-1">
          <Lock className="w-2.5 h-2.5" />
          <span>Razorpay 256-Bit SSL Encrypted Testbed</span>
        </div>

      </div>
    </div>
  );
};
