'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PlayerFormData, RegistrationSubmission, Tournament } from '@/lib/types';
import { Navbar } from '@/components/Navbar';
import { RegistrationForm } from '@/components/RegistrationForm';
import { PlayerPreviewCard } from '@/components/PlayerPreviewCard';
import { SuccessModal } from '@/components/SuccessModal';
import { RazorpayMockModal } from '@/components/RazorpayMockModal';
import { LiveCounterWidget } from '@/components/LiveCounterWidget';
import { PlayersDirectory } from '@/components/PlayersDirectory';
import { TournamentShareBar } from '@/components/TournamentShareBar';
import { Toast, ToastMessage, ToastType } from '@/components/Toast';
import {
  Trophy,
  MapPin,
  Calendar,
  Users,
  Eye,
  UserPlus,
  Phone,
} from 'lucide-react';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const INITIAL_FORM_STATE: PlayerFormData = {
  fullName: '',
  phone: '',
  age: '',
  role: 'Pure Batsman',
  battingStyle: 'Right-hand',
  bowlingStyle: 'Right-arm Fast',
  stats: '',
  photoUrl: '',
};

export default function TournamentRegistrationPage() {
  const params = useParams();
  const router = useRouter();
  const slug = (params?.slug as string) || '';

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loadingTournament, setLoadingTournament] = useState(true);
  const [formData, setFormData] = useState<PlayerFormData>(INITIAL_FORM_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [registeredData, setRegisteredData] = useState<RegistrationSubmission | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'form' | 'preview'>('form');

  // View state: 'register' | 'players'
  const [activeView, setActiveView] = useState<'register' | 'players'>('register');
  const [registeredPlayers, setRegisteredPlayers] = useState<RegistrationSubmission[]>([]);

  // Test mode modal
  const [isMockModalOpen, setIsMockModalOpen] = useState(false);
  const [currentMockOrder, setCurrentMockOrder] = useState<{ orderId: string } | null>(null);

  const addToast = (type: ToastType, title: string, message?: string, duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message, duration }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchRegisteredPlayers = async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/tournaments/${slug}/players`);
      if (res.ok) {
        const data = await res.json();
        if (data.players) {
          setRegisteredPlayers(data.players);
        }
      }
    } catch (e) {
      console.error('Error fetching registered players:', e);
    }
  };

  // Fetch tournament info & players
  useEffect(() => {
    if (!slug) return;
    const fetchTournament = async (retryCount = 0) => {
      try {
        setLoadingTournament(true);

        // 1. Fetch individual slug
        const res = await fetch(`/api/tournaments/${slug}`);
        if (res.ok) {
          const data = await res.json();
          if (data.tournament) {
            setTournament(data.tournament);
            return;
          }
        }

        // 2. Fallback: Search in all tournaments
        try {
          const allRes = await fetch('/api/tournaments');
          if (allRes.ok) {
            const allData = await allRes.json();
            if (Array.isArray(allData.tournaments)) {
              const found = allData.tournaments.find(
                (t: any) => t.slug?.toLowerCase() === slug.toLowerCase()
              );
              if (found) {
                setTournament(found);
                return;
              }
            }
          }
        } catch (e) {}

        // 3. Retry once after delay if first attempt missed cold lambda
        if (retryCount < 1) {
          setTimeout(() => fetchTournament(retryCount + 1), 1200);
          return;
        }

        addToast('error', 'Not Found', 'Tournament details could not be found.');
      } catch (err) {
        console.error('Error fetching tournament:', err);
      } finally {
        setLoadingTournament(false);
      }
    };

    fetchTournament();
    fetchRegisteredPlayers();
  }, [slug]);

  const handleFormChange = (updated: Partial<PlayerFormData>) => {
    setFormData((prev) => ({ ...prev, ...updated }));
  };

  // Final submission to backend / Google Sheet
  const handleFinalSubmission = async (
    paymentDetails: {
      paymentId: string;
      orderId?: string;
      signature?: string;
    },
    overrideData?: PlayerFormData
  ) => {
    const dataToSubmit = overrideData || formData;
    try {
      addToast('info', 'Submitting Registration', 'Logging player record into tournament pool...');

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...dataToSubmit,
          ...paymentDetails,
          tournamentSlug: slug,
          amount: tournament?.isPaid ? entryFee : 0,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setRegisteredData({
          ...dataToSubmit,
          registrationId: result.registration.registrationId,
          tournamentSlug: slug,
          tournamentTitle: tournament?.title || 'Cricket Tournament 2026',
          timestamp: result.registration.timestamp,
          paymentId: paymentDetails.paymentId,
          orderId: paymentDetails.orderId,
          paymentStatus: tournament?.isPaid ? 'PAID' : 'FREE',
          amount: tournament?.isPaid ? tournament.entryFee : 0,
        });

        // Re-fetch players list
        fetchRegisteredPlayers();

        if (result.sheetSync?.synced) {
          addToast('success', 'Google Sheet Synced', 'Player record successfully added to Google Sheet!');
        }

        addToast(
          'success',
          'Registration Confirmed',
          tournament?.isPaid ? 'Payment verified and ticket pass issued!' : 'Free entry ticket confirmed!'
        );
      } else {
        throw new Error(result.error || 'Failed to complete registration');
      }
    } catch (err: any) {
      console.error('Final submission error:', err);
      addToast(
        'error',
        'Submission Error',
        err.message || 'Registration encountered an error. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Check for Razorpay Payment Link return (after successful payment on rzp.io)
  useEffect(() => {
    if (typeof window === 'undefined' || !slug || !tournament) return;
    const urlParams = new URLSearchParams(window.location.search);
    const isPaymentSuccess = urlParams.get('payment_success') === 'true';
    const razorpayPaymentId =
      urlParams.get('razorpay_payment_id') ||
      urlParams.get('razorpay_payment_link_id');

    if (razorpayPaymentId) {
      try {
        const stored =
          sessionStorage.getItem('cricbid_pending_registration') ||
          localStorage.getItem(`cricbid_pending_reg_${slug}`);

        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.fullName) {
            setFormData(parsed);
            handleFinalSubmission(
              {
                paymentId: razorpayPaymentId,
                orderId: urlParams.get('razorpay_order_id') || urlParams.get('razorpay_payment_link_id') || 'N/A',
                signature: urlParams.get('razorpay_signature') || undefined,
              },
              parsed
            );
            sessionStorage.removeItem('cricbid_pending_registration');
            localStorage.removeItem(`cricbid_pending_reg_${slug}`);
            window.history.replaceState({}, '', window.location.pathname);
            return;
          }
        }

        // Fallback if browser wiped storage during UPI app switch:
        // Submit with paymentId and tournamentSlug, server will recover details from Razorpay notes!
        handleFinalSubmission({
          paymentId: razorpayPaymentId,
          orderId: urlParams.get('razorpay_order_id') || urlParams.get('razorpay_payment_link_id') || 'N/A',
          signature: urlParams.get('razorpay_signature') || undefined,
        });
        window.history.replaceState({}, '', window.location.pathname);
      } catch (err) {
        console.error('Error handling payment return:', err);
      }
    } else if (isPaymentSuccess) {
      addToast(
        'warning',
        'Payment Verification Pending',
        'Redirected from payment gateway. Waiting for payment reference.'
      );
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [slug, tournament]);

  // Submit Action with Conditional Payment Logic
  const handleProceedToPayment = async () => {
    if (!tournament) return;

    // CONDITIONAL LOGIC 1: FREE REGISTRATION
    if (!tournament.isPaid) {
      setIsLoading(true);
      await handleFinalSubmission({
        paymentId: 'FREE_REGISTRATION',
      });
      return;
    }

    // CONDITIONAL LOGIC 2: PAID TOURNAMENT
    setIsLoading(true);

    try {
      // 1. Create order on server
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tournamentSlug: slug,
          fullName: formData.fullName,
          phone: formData.phone,
          amount: entryFee,
        }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || 'Unable to initialize Razorpay payment');
      }

      // Check if running in demo / mock mode
      if (orderData.isMock) {
        setIsLoading(false);
        setCurrentMockOrder({ orderId: orderData.orderId });
        setIsMockModalOpen(true);
        return;
      }

      // If Razorpay Hosted Payment Link (rzp.io) is available, redirect directly to bypass domain block!
      if (orderData.paymentLinkUrl && orderData.paymentLinkUrl.startsWith('http')) {
        try {
          const payloadToSave = JSON.stringify({
            ...formData,
            tournamentSlug: slug,
            amount: entryFee,
          });
          sessionStorage.setItem('cricbid_pending_registration', payloadToSave);
          localStorage.setItem(`cricbid_pending_reg_${slug}`, payloadToSave);
        } catch (e) {}

        addToast('info', 'Opening Payment Gateway', 'Redirecting to Razorpay secure checkout...');
        window.location.href = orderData.paymentLinkUrl;
        return;
      }

      // Real Razorpay Checkout Fallback
      if (typeof window === 'undefined' || !window.Razorpay) {
        throw new Error('Razorpay Checkout SDK is not loaded. Check internet connection.');
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: tournament.title,
        description: `Player Registration Fee - ${formData.fullName}`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          await handleFinalSubmission({
            paymentId: response.razorpay_payment_id,
            orderId: response.razorpay_order_id,
            signature: response.razorpay_signature,
          });
        },
        prefill: {
          name: formData.fullName,
          contact: formData.phone,
        },
        theme: {
          color: '#080d1a',
        },
        modal: {
          ondismiss: function () {
            setIsLoading(false);
            addToast(
              'warning',
              'Payment Cancelled',
              'Payment was cancelled or closed. Your registration has not been submitted.'
            );
          },
        },
      };

      const razorpayInstance = new window.Razorpay(options);

      razorpayInstance.on('payment.failed', function (response: any) {
        setIsLoading(false);
        addToast(
          'error',
          'Payment Failed',
          response.error?.description || 'Your payment was declined or failed. Please retry.'
        );
      });

      razorpayInstance.open();
    } catch (error: any) {
      console.error('Payment initialization error:', error);
      setIsLoading(false);
      addToast(
        'error',
        'Payment Initialization Failed',
        error?.message || 'Could not launch payment gateway.'
      );
    }
  };

  const handleMockPaymentSuccess = async (mockPaymentId: string) => {
    setIsMockModalOpen(false);
    setIsLoading(true);
    await handleFinalSubmission({
      paymentId: mockPaymentId,
      orderId: currentMockOrder?.orderId || `order_mock_${Date.now()}`,
      signature: 'sig_mock_verified',
    });
  };

  const handleMockPaymentCancel = () => {
    setIsMockModalOpen(false);
    setIsLoading(false);
    addToast(
      'warning',
      'Payment Cancelled',
      'Payment was cancelled or closed. Registration was not submitted.'
    );
  };

  const handleReset = () => {
    setRegisteredData(null);
    setFormData(INITIAL_FORM_STATE);
  };

  if (loadingTournament) {
    return (
      <div className="min-h-screen stadium-bg flex flex-col items-center justify-center text-white">
        <div className="w-8 h-8 border-3 border-amber-400 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-xs uppercase font-bold tracking-wider text-slate-400">
          Loading CricBid Tournament Details...
        </p>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen stadium-bg flex flex-col text-slate-100">
        <Toast toasts={toasts} onDismiss={removeToast} />
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#090f1e]/90 border border-slate-800 rounded-3xl p-6 sm:p-8 text-center shadow-2xl backdrop-blur-md">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-black uppercase text-white font-sans">
              Tournament Not Found
            </h2>
            <p className="text-xs text-slate-400 mt-2 mb-6">
              Could not load tournament details for &quot;{slug}&quot;. The link might be expired or still syncing.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg"
              >
                Retry Loading
              </button>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="w-full py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold uppercase tracking-wider"
              >
                Explore All Tournaments
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isFree = !tournament?.isPaid;
  const entryFee = tournament?.entryFee || 0;

  return (
    <div className="min-h-screen stadium-bg flex flex-col relative selection:bg-amber-400 selection:text-slate-950">
      <Toast toasts={toasts} onDismiss={removeToast} />
      <Navbar />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 z-10">
        
        {/* Tournament Hero Header Card */}
        <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-950/80 mb-6 shadow-2xl">
          <div className="h-36 sm:h-48 w-full relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={tournament?.bannerUrl}
              alt={tournament?.title}
              className="w-full h-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#080d1a] via-[#080d1a]/70 to-transparent" />
          </div>

          <div className="p-5 sm:p-6 -mt-16 sm:-mt-20 relative z-10 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                    isFree
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {isFree ? '⚡ Free Registration Mode' : `🎟️ Entry Fee: ₹${entryFee}`}
                </span>

                <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-[10px] font-bold flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  <span>{tournament?.city}</span>
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black uppercase text-white font-sans tracking-tight">
                {tournament?.title}
              </h1>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-slate-400 mt-2">
                <span className="flex items-center gap-1">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" /> {tournament?.venue}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" /> Auction: {tournament?.auctionDate}
                </span>
                {tournament?.organizerContact && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono text-slate-300">
                      <Phone className="w-3.5 h-3.5 text-cyan-400" /> {tournament.organizerContact}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Quick Status Pill */}
            <div className="shrink-0">
              <div className="px-4 py-2 rounded-2xl bg-slate-900/90 border border-slate-800 text-right">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Registration Fee</span>
                <span className={`text-xl sm:text-2xl font-black ${isFree ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {isFree ? 'FREE (₹0)' : `₹${entryFee}`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated Tournament Share Bar (Players specific link) */}
        {tournament && (
          <div className="mb-6">
            <TournamentShareBar
              tournamentTitle={tournament.title}
              city={tournament.city}
              venue={tournament.venue}
              auctionDate={tournament.auctionDate}
              isFree={isFree}
              entryFee={entryFee}
              slug={tournament.slug}
            />
          </div>
        )}

        {/* Live Registration Counter Widget */}
        <div className="mb-6">
          <LiveCounterWidget
            tournamentSlug={slug}
            initialCount={tournament?.registeredCount || 0}
          />
        </div>

        {/* View Toggle Bar (Register Form vs Registered Players Pool) */}
        <div className="flex items-center justify-between gap-3 mb-6 bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveView('register')}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeView === 'register'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-slate-950/60 text-slate-300 hover:text-white'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Register as Player</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveView('players');
                fetchRegisteredPlayers();
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeView === 'players'
                  ? 'bg-emerald-400 text-slate-950 shadow-md'
                  : 'bg-slate-950/60 text-slate-300 hover:text-white'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>View All Added Players ({registeredPlayers.length})</span>
            </button>
          </div>
        </div>

        {/* View 1: Registration Form + Live Card Preview */}
        {activeView === 'register' && (
          <>
            {/* Mobile Tab Switcher */}
            <div className="lg:hidden sticky top-16 z-30 bg-[#080d1a]/95 backdrop-blur-md border-b border-slate-800 px-4 py-2 flex items-center justify-center gap-2 mb-6">
              <button
                type="button"
                onClick={() => setActiveMobileTab('form')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  activeMobileTab === 'form'
                    ? 'bg-amber-400 text-slate-950 shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Registration Form</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveMobileTab('preview')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  activeMobileTab === 'preview'
                    ? 'bg-emerald-400 text-slate-950 shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Live Card Preview</span>
              </button>
            </div>

            {/* Desktop Split Layout (Form 60% : Preview 40%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
              {/* Form Column */}
              <div
                className={`lg:col-span-7 ${
                  activeMobileTab === 'form' ? 'block' : 'hidden lg:block'
                }`}
              >
                <RegistrationForm
                  formData={formData}
                  onChange={handleFormChange}
                  onSubmit={handleProceedToPayment}
                  isLoading={isLoading}
                  registrationFee={entryFee}
                />
              </div>

              {/* Live Preview Card Column */}
              <div
                className={`lg:col-span-5 ${
                  activeMobileTab === 'preview' ? 'block' : 'hidden lg:block'
                }`}
              >
                <PlayerPreviewCard
                  formData={formData}
                  registrationFee={entryFee}
                />
              </div>
            </div>
          </>
        )}

        {/* View 2: All Added Players Directory */}
        {(activeView === 'players' || registeredPlayers.length > 0) && (
          <div className="mt-8">
            <PlayersDirectory
              players={registeredPlayers}
              tournamentTitle={tournament?.title || 'Cricket Tournament'}
            />
          </div>
        )}

      </main>

      {/* Razorpay Mock Test Mode Modal */}
      <RazorpayMockModal
        isOpen={isMockModalOpen}
        amount={entryFee}
        playerName={formData.fullName}
        phone={formData.phone}
        onSuccess={handleMockPaymentSuccess}
        onCancel={handleMockPaymentCancel}
      />

      {/* Success Modal with Ticket & WhatsApp Share */}
      {registeredData && (
        <SuccessModal
          registration={registeredData}
          onReset={handleReset}
          tournamentName={tournament?.title}
        />
      )}
    </div>
  );
}
