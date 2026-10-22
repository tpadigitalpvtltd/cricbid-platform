'use client';

import React, { useRef, useState } from 'react';
import { PlayerFormData, BattingStyle, BowlingStyle, PlayingRole } from '@/lib/types';
import { RoleSelector } from './RoleSelector';
import { compressImage, validatePhoneNumber, clean10DigitPhone } from '@/lib/utils';
import {
  Upload,
  User,
  Phone,
  Calendar,
  Lock,
  ArrowRight,
  Trash2,
  FileText,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Camera,
  CheckCircle2,
  Zap,
} from 'lucide-react';

interface RegistrationFormProps {
  formData: PlayerFormData;
  onChange: (updated: Partial<PlayerFormData>) => void;
  onSubmit: () => void;
  isLoading: boolean;
  registrationFee: number;
}

export const RegistrationForm: React.FC<RegistrationFormProps> = ({
  formData,
  onChange,
  onSubmit,
  isLoading,
  registrationFee,
}) => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const battingStyles: BattingStyle[] = ['Right-hand', 'Left-hand'];
  const bowlingStyles: BowlingStyle[] = [
    'Right-arm Fast',
    'Right-arm Spin',
    'Left-arm Fast',
    'Left-arm Spin',
    'None',
  ];

  const isFree = registrationFee === 0;

  // Validate entire form before triggering submission
  const validateAndSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full Name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'WhatsApp / Phone number is required';
    } else if (!validatePhoneNumber(formData.phone)) {
      newErrors.phone = 'Please enter a valid 10-digit mobile number';
    }

    const ageNum = Number(formData.age);
    if (!formData.age) {
      newErrors.age = 'Age is required';
    } else if (isNaN(ageNum) || ageNum < 10 || ageNum > 70) {
      newErrors.age = 'Valid age between 10 and 70 is required';
    }

    if (!formData.role) {
      newErrors.role = 'Please select your primary playing role';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onSubmit();
    } else {
      // Scroll to first error element
      const firstErrorField = Object.keys(newErrors)[0];
      const element = document.getElementById(`field-${firstErrorField}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // Handle Photo File Upload
  const handlePhotoUpload = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, photo: 'Please select a valid image file' }));
      return;
    }

    try {
      setIsCompressing(true);
      const compressedBase64 = await compressImage(file, 600, 600, 0.82);
      onChange({ photoUrl: compressedBase64 });
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.photo;
        return copy;
      });
    } catch (err) {
      console.error('Image compression failed:', err);
      setErrors((prev) => ({ ...prev, photo: 'Failed to process image. Try another image.' }));
    } finally {
      setIsCompressing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePhotoUpload(file);
    }
  };

  const removePhoto = () => {
    onChange({ photoUrl: '' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <form onSubmit={validateAndSubmit} className="space-y-6">
      {/* SECTION 1: Player Identity & Photo */}
      <div className="bg-slate-900/60 rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-lg">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
            1
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Player Identity & Photo
            </h3>
            <p className="text-xs text-slate-400">
              Personal details as appearing on official tournament documentation
            </p>
          </div>
        </div>

        {/* Photo Uploader */}
        <div className="mb-6" id="field-photo">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
            Player Passport Photo <span className="text-slate-400 font-normal">(Recommended)</span>
          </label>

          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl border border-slate-800/80 bg-slate-950/60">
            {/* Avatar Preview */}
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-2xl p-[2px] bg-gradient-to-tr from-amber-400 via-amber-500 to-emerald-400">
                <div className="w-full h-full rounded-[14px] bg-[#090f1e] overflow-hidden flex items-center justify-center relative">
                  {formData.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={formData.photoUrl}
                      alt="Player preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-slate-500" />
                  )}
                  {isCompressing && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </div>
              </div>

              {formData.photoUrl && (
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-500 shadow-md transition-colors"
                  title="Remove photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex-1 text-center sm:text-left">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                id="photo-file-input"
              />
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isCompressing}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all flex items-center gap-2 hover:text-white"
                >
                  <Camera className="w-3.5 h-3.5 text-amber-400" />
                  <span>{formData.photoUrl ? 'Change Photo' : 'Select Photo'}</span>
                </button>

                {formData.photoUrl && (
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Photo attached
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Supported formats: JPG, PNG, WEBP. Instant circular preview on card.
              </p>
              {errors.photo && <p className="text-xs text-rose-400 mt-1">{errors.photo}</p>}
            </div>
          </div>
        </div>

        {/* Full Name & Phone & Age Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
          {/* Full Name */}
          <div className="sm:col-span-12 md:col-span-6" id="field-fullName">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Full Name <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="e.g. Virat Sharma"
                value={formData.fullName}
                onChange={(e) => {
                  onChange({ fullName: e.target.value });
                  if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                }}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border text-white text-sm focus:outline-none transition-all placeholder:text-slate-600 ${
                  errors.fullName
                    ? 'border-rose-500 ring-1 ring-rose-500/50'
                    : 'border-slate-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40'
                }`}
              />
            </div>
            {errors.fullName && (
              <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.fullName}
              </p>
            )}
          </div>

          {/* WhatsApp / Phone Number */}
          <div className="sm:col-span-8 md:col-span-4" id="field-phone">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              WhatsApp / Mobile <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                maxLength={10}
                placeholder="10-digit number"
                value={formData.phone}
                onChange={(e) => {
                  const cleaned = clean10DigitPhone(e.target.value);
                  onChange({ phone: cleaned });
                  if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                }}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border text-white text-sm focus:outline-none transition-all placeholder:text-slate-600 font-mono ${
                  errors.phone
                    ? 'border-rose-500 ring-1 ring-rose-500/50'
                    : 'border-slate-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40'
                }`}
              />
            </div>
            {errors.phone ? (
              <p className="text-xs text-rose-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.phone}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 mt-1">10 digits without prefix (+91)</p>
            )}
          </div>

          {/* Age */}
          <div className="sm:col-span-4 md:col-span-2" id="field-age">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Age <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Calendar className="w-4 h-4" />
              </div>
              <input
                type="number"
                min={10}
                max={70}
                placeholder="Age"
                value={formData.age}
                onChange={(e) => {
                  onChange({ age: e.target.value });
                  if (errors.age) setErrors((prev) => ({ ...prev, age: '' }));
                }}
                className={`w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950/80 border text-white text-sm focus:outline-none transition-all placeholder:text-slate-600 ${
                  errors.age
                    ? 'border-rose-500 ring-1 ring-rose-500/50'
                    : 'border-slate-800 focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40'
                }`}
              />
            </div>
            {errors.age && <p className="text-xs text-rose-400 mt-1">{errors.age}</p>}
          </div>
        </div>
      </div>

      {/* SECTION 2: Playing Profile & Roles */}
      <div className="bg-slate-900/60 rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-lg">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-xs">
            2
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Cricket Specialization
            </h3>
            <p className="text-xs text-slate-400">
              Define your primary role and tactical skills for the auction list
            </p>
          </div>
        </div>

        {/* Primary Role Selector Component */}
        <div id="field-role" className="mb-6">
          <RoleSelector
            selectedRole={formData.role}
            onChange={(role: PlayingRole) => {
              onChange({ role });
              if (errors.role) setErrors((prev) => ({ ...prev, role: '' }));
            }}
            error={errors.role}
          />
        </div>

        {/* Batting Style & Bowling Style Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* Batting Style */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Batting Style <span className="text-amber-400">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {battingStyles.map((style) => {
                const isSelected = formData.battingStyle === style;
                return (
                  <button
                    type="button"
                    key={style}
                    onClick={() => onChange({ battingStyle: style })}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all ${
                      isSelected
                        ? 'border-amber-400 bg-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
                        : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {style}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bowling Style */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Bowling Style <span className="text-amber-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {bowlingStyles.map((style) => {
                const isSelected = formData.bowlingStyle === style;
                return (
                  <button
                    type="button"
                    key={style}
                    onClick={() => onChange({ bowlingStyle: style })}
                    className={`py-2 px-2 rounded-xl border text-[11px] font-bold text-center transition-all ${
                      isSelected
                        ? 'border-emerald-400 bg-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,232,123,0.3)]'
                        : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {style}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Stats & Achievements (Optional) */}
      <div className="bg-slate-900/60 rounded-2xl p-5 sm:p-6 border border-slate-800 shadow-lg">
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-800">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
            3
          </div>
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Previous Achievements & Stats
            </h3>
            <p className="text-xs text-slate-400">
              Optional career records, club affiliations, or standout performances
            </p>
          </div>
        </div>

        <div className="relative">
          <textarea
            rows={3}
            maxLength={400}
            placeholder="e.g. Played for Mumbai U-19 District team. Top score 114* off 56 balls. 5-wicket haul (5/18) in Corporate Trophy 2025."
            value={formData.stats}
            onChange={(e) => onChange({ stats: e.target.value })}
            className="w-full p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/40 placeholder:text-slate-600 transition-all leading-relaxed"
          />
          <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1 px-1">
            <span>Tip: Teams and franchises review this during the auction.</span>
            <span>{formData.stats.length}/400</span>
          </div>
        </div>
      </div>

      {/* SECTION 4: Payment Summary & Submission Trigger */}
      <div
        className={`rounded-2xl p-5 sm:p-6 border shadow-xl ${
          isFree
            ? 'bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/30 border-emerald-500/30 shadow-[0_0_30px_rgba(16,232,123,0.15)]'
            : 'bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-950 border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.15)]'
        }`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-4">
          <div>
            <span
              className={`text-[10px] font-extrabold uppercase tracking-widest ${
                isFree ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {isFree ? '⚡ Direct Entry' : '🔒 Verified Payment'}
            </span>
            <h4 className="text-base font-extrabold text-white">
              {isFree ? 'Free Tournament Registration' : 'Official Tournament Registration'}
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              {isFree
                ? 'Free entry mode. Profile immediately appended to Google Sheet with zero fee.'
                : 'Secure fee payment via Razorpay. Profile automatically saved upon payment verification.'}
            </p>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Registration Fee</span>
            <span
              className={`text-2xl sm:text-3xl font-black font-sans ${
                isFree ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {isFree ? '₹0 (FREE)' : `₹${registrationFee}`}
            </span>
          </div>
        </div>

        {/* Dynamic Conditional Submit Button */}
        {isFree ? (
          <button
            type="submit"
            disabled={isLoading || isCompressing}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500 hover:from-emerald-400 hover:to-green-400 text-slate-950 font-black text-base uppercase tracking-wider shadow-[0_0_25px_rgba(16,232,123,0.4)] transition-all transform active:scale-[0.99] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed group"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-3 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                <span>Confirming Free Registration...</span>
              </div>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 text-slate-950" />
                <span>Complete Free Registration (₹0)</span>
                <ArrowRight className="w-5 h-5 text-slate-950 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        ) : (
          <button
            type="submit"
            disabled={isLoading || isCompressing}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-base uppercase tracking-wider shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all transform active:scale-[0.99] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed group"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 border-3 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                <span>Initiating Razorpay Payment...</span>
              </div>
            ) : (
              <>
                <Lock className="w-5 h-5 text-slate-950" />
                <span>Proceed to Pay & Register (₹{registrationFee})</span>
                <ArrowRight className="w-5 h-5 text-slate-950 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        )}

        <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-slate-400">
          {isFree ? (
            <>
              <span className="flex items-center gap-1 text-emerald-400">
                <Zap className="w-3 h-3" /> 100% Free Entry
              </span>
              <span>•</span>
              <span>Instant Confirmation</span>
              <span>•</span>
              <span>Google Sheet Synced</span>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <Lock className="w-3 h-3 text-emerald-400" /> Razorpay 256-Bit SSL
              </span>
              <span>•</span>
              <span>UPI, Cards, NetBanking</span>
              <span>•</span>
              <span>Verified Payment Pass</span>
            </>
          )}
        </div>
      </div>
    </form>
  );
};
