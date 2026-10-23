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
  Sparkles,
  Camera,
  CheckCircle2,
  Zap,
  ShieldCheck,
  Award,
  Swords,
  Flame,
  Check,
  CreditCard,
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

  const quickAgeOptions = ['18', '20', '22', '24', '26', '28'];

  const quickAchievementTags = [
    'District Level Player',
    'Top Order Batsman (SR 140+)',
    'Strike Bowler (4-over quota)',
    'Hard-hitting Finisher',
    '5-Wicket Haul in League',
    'Century in Local Tournament',
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
      setErrors((prev) => ({ ...prev, photo: 'Please select a valid image file (JPG, PNG, WEBP)' }));
      return;
    }

    try {
      setIsCompressing(true);
      const compressedBase64 = await compressImage(file, 600, 600, 0.85);
      onChange({ photoUrl: compressedBase64 });
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy.photo;
        return copy;
      });
    } catch (err) {
      console.error('Image compression failed:', err);
      setErrors((prev) => ({ ...prev, photo: 'Failed to process image. Try another photo.' }));
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

  const addAchievementTag = (tag: string) => {
    const current = formData.stats.trim();
    if (current.includes(tag)) return;
    const updated = current ? `${current}, ${tag}` : tag;
    if (updated.length <= 400) {
      onChange({ stats: updated });
    }
  };

  // Check section completion
  const isSection1Complete = Boolean(formData.fullName.trim() && formData.phone.trim() && formData.age);
  const isSection2Complete = Boolean(formData.role && formData.battingStyle && formData.bowlingStyle);

  return (
    <form onSubmit={validateAndSubmit} className="space-y-6">
      
      {/* Step Progress Header */}
      <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-3 sm:p-4 border border-slate-800 shadow-xl">
        <div className="grid grid-cols-4 gap-2 text-center">
          
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                isSection1Complete
                  ? 'bg-emerald-400 text-slate-950 shadow-[0_0_12px_rgba(16,232,123,0.5)]'
                  : 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
              }`}
            >
              {isSection1Complete ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 mt-1 hidden sm:block">
              Player Info
            </span>
          </div>

          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                isSection2Complete
                  ? 'bg-emerald-400 text-slate-950 shadow-[0_0_12px_rgba(16,232,123,0.5)]'
                  : isSection1Complete
                  ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)]'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {isSection2Complete ? <Check className="w-4 h-4 stroke-[3]" /> : '2'}
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 mt-1 hidden sm:block">
              Cricket Role
            </span>
          </div>

          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                formData.stats.trim()
                  ? 'bg-emerald-400 text-slate-950 shadow-[0_0_12px_rgba(16,232,123,0.5)]'
                  : isSection2Complete
                  ? 'bg-slate-700 text-white'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {formData.stats.trim() ? <Check className="w-4 h-4 stroke-[3]" /> : '3'}
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 mt-1 hidden sm:block">
              Experience
            </span>
          </div>

          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-amber-400 border border-amber-400/40 flex items-center justify-center text-xs font-black">
              {isFree ? <Zap className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 mt-1 hidden sm:block">
              {isFree ? 'Free Pass' : 'Pay & Pass'}
            </span>
          </div>

        </div>
      </div>

      {/* SECTION 1: Player Identity & Photo */}
      <div className="relative rounded-3xl p-[1px] bg-gradient-to-b from-amber-400/30 via-slate-800 to-slate-900 shadow-2xl">
        <div className="bg-[#090f1e]/95 backdrop-blur-xl rounded-[23px] p-5 sm:p-7">
          
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-slate-950 font-black shadow-lg">
                1
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-tight text-white font-sans">
                  Player Identity & Passport Photo
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Official name and photo as required for your digital player pass
                </p>
              </div>
            </div>

            {isSection1Complete && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready
              </span>
            )}
          </div>

          {/* Luxury Photo Uploader Box */}
          <div className="mb-6" id="field-photo">
            <label className="block text-xs font-black uppercase tracking-wider text-slate-200 mb-2.5">
              Player Passport Photo <span className="text-amber-400 font-normal">(Shows on Pass & Card)</span>
            </label>

            <div className="flex flex-col sm:flex-row items-center gap-5 p-4 sm:p-5 rounded-2xl border border-slate-800 bg-slate-950/70 hover:border-slate-700 transition-all">
              
              {/* Photo Avatar Frame */}
              <div className="relative group shrink-0">
                <div className="w-24 h-24 rounded-2xl p-[3px] bg-gradient-to-tr from-amber-400 via-yellow-300 to-emerald-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
                  <div className="w-full h-full rounded-[13px] bg-slate-900 overflow-hidden flex items-center justify-center relative">
                    {formData.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={formData.photoUrl}
                        alt="Player passport photo"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-10 h-10 text-slate-600" />
                    )}

                    {isCompressing && (
                      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-amber-400">
                        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mb-1"></div>
                        <span className="text-[9px] font-black uppercase">Compressing</span>
                      </div>
                    )}
                  </div>
                </div>

                {formData.photoUrl && (
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
                    title="Remove Photo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Action Buttons & Helpers */}
              <div className="flex-1 text-center sm:text-left">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                  id="player-photo-input"
                />

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isCompressing}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg transition-all transform active:scale-95 flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{formData.photoUrl ? 'Change Photo' : 'Select Photo from Phone'}</span>
                  </button>

                  {formData.photoUrl && (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Photo Attached
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-400 mt-2.5">
                  Tap to upload selfie or passport photo. Auto-compressed for instant pass generation.
                </p>
                {errors.photo && <p className="text-xs text-rose-400 font-bold mt-1.5">{errors.photo}</p>}
              </div>

            </div>
          </div>

          {/* Full Name & Phone & Age Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-5">
            
            {/* Full Name */}
            <div className="sm:col-span-12 md:col-span-6" id="field-fullName">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-200 mb-2">
                Player Full Name <span className="text-amber-400">*</span>
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
                  className={`w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border text-white text-sm focus:outline-none transition-all placeholder:text-slate-600 font-medium ${
                    errors.fullName
                      ? 'border-rose-500 ring-2 ring-rose-500/30'
                      : 'border-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20'
                  }`}
                />
              </div>
              {errors.fullName ? (
                <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3 h-3" /> {errors.fullName}
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 mt-1">Name printed on your official digital ticket</p>
              )}
            </div>

            {/* WhatsApp / Phone with Fixed +91 Badge */}
            <div className="sm:col-span-7 md:col-span-4" id="field-phone">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-200 mb-2">
                WhatsApp / Mobile <span className="text-amber-400">*</span>
              </label>
              <div className="relative flex rounded-xl border border-slate-800 bg-slate-950 overflow-hidden focus-within:border-amber-400 focus-within:ring-2 focus-within:ring-amber-400/20 transition-all">
                <div className="px-3 py-3 bg-slate-900 border-r border-slate-800 text-xs font-black text-amber-400 flex items-center gap-1 select-none shrink-0">
                  <span>🇮🇳</span>
                  <span>+91</span>
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
                  className="w-full px-3 py-3 bg-transparent text-white text-sm focus:outline-none placeholder:text-slate-600 font-mono font-bold tracking-wider"
                />
              </div>
              {errors.phone ? (
                <p className="text-xs text-rose-400 mt-1.5 flex items-center gap-1 font-semibold">
                  <AlertCircle className="w-3 h-3" /> {errors.phone}
                </p>
              ) : (
                <p className="text-[11px] text-slate-500 mt-1">Your player pass will be sent here</p>
              )}
            </div>

            {/* Age Input with Quick Chips */}
            <div className="sm:col-span-5 md:col-span-2" id="field-age">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-200 mb-2">
                Age <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={10}
                  max={70}
                  placeholder="24"
                  value={formData.age}
                  onChange={(e) => {
                    onChange({ age: e.target.value });
                    if (errors.age) setErrors((prev) => ({ ...prev, age: '' }));
                  }}
                  className={`w-full px-3 py-3 rounded-xl bg-slate-950 border text-white text-sm text-center focus:outline-none transition-all placeholder:text-slate-600 font-bold ${
                    errors.age
                      ? 'border-rose-500 ring-2 ring-rose-500/30'
                      : 'border-slate-800 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20'
                  }`}
                />
              </div>

              {/* Quick Age Select Chips */}
              <div className="flex items-center gap-1 mt-1.5 overflow-x-auto scrollbar-none">
                {quickAgeOptions.map((qAge) => (
                  <button
                    type="button"
                    key={qAge}
                    onClick={() => {
                      onChange({ age: qAge });
                      if (errors.age) setErrors((prev) => ({ ...prev, age: '' }));
                    }}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      formData.age === qAge
                        ? 'bg-amber-400 text-slate-950 font-black'
                        : 'bg-slate-900 text-slate-400 hover:text-white'
                    }`}
                  >
                    {qAge}
                  </button>
                ))}
              </div>
              {errors.age && <p className="text-xs text-rose-400 mt-1 font-semibold">{errors.age}</p>}
            </div>

          </div>

        </div>
      </div>

      {/* SECTION 2: Cricket Role & Playing Specialization */}
      <div className="relative rounded-3xl p-[1px] bg-gradient-to-b from-emerald-500/30 via-slate-800 to-slate-900 shadow-2xl">
        <div className="bg-[#090f1e]/95 backdrop-blur-xl rounded-[23px] p-5 sm:p-7">
          
          <div className="flex items-center justify-between pb-4 mb-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 font-black shadow-lg">
                2
              </div>
              <div>
                <h3 className="text-base font-black uppercase tracking-tight text-white font-sans">
                  Cricket Role & Tactical Style
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Select your primary role for the official auction draft list
                </p>
              </div>
            </div>

            {isSection2Complete && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Selected
              </span>
            )}
          </div>

          {/* Primary Role Selector */}
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

          {/* Batting Hand & Bowling Style Segmented Controls */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 pt-2">
            
            {/* Batting Hand (5 cols) */}
            <div className="md:col-span-5">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-200 mb-2">
                Batting Hand <span className="text-amber-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {battingStyles.map((style) => {
                  const isSelected = formData.battingStyle === style;
                  return (
                    <button
                      type="button"
                      key={style}
                      onClick={() => onChange({ battingStyle: style })}
                      className={`py-3 px-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                        isSelected
                          ? 'border-amber-400 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.35)] scale-[1.02]'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>{style}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bowling Style (7 cols) */}
            <div className="md:col-span-7">
              <label className="block text-xs font-black uppercase tracking-wider text-slate-200 mb-2">
                Bowling Specialization <span className="text-amber-400">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {bowlingStyles.map((style) => {
                  const isSelected = formData.bowlingStyle === style;
                  return (
                    <button
                      type="button"
                      key={style}
                      onClick={() => onChange({ bowlingStyle: style })}
                      className={`py-2.5 px-2 rounded-xl border text-[11px] font-black text-center transition-all ${
                        isSelected
                          ? 'border-emerald-400 bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 shadow-[0_0_15px_rgba(16,232,123,0.35)] scale-[1.02]'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:text-white'
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
      </div>

      {/* SECTION 3: Career Achievements & Quick Tags */}
      <div className="relative rounded-3xl p-[1px] bg-gradient-to-b from-cyan-500/30 via-slate-800 to-slate-900 shadow-2xl">
        <div className="bg-[#090f1e]/95 backdrop-blur-xl rounded-[23px] p-5 sm:p-7">
          
          <div className="flex items-center gap-3 pb-4 mb-4 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-400 flex items-center justify-center text-slate-950 font-black shadow-lg">
              3
            </div>
            <div>
              <h3 className="text-base font-black uppercase tracking-tight text-white font-sans">
                Career Stats & Standout Highlights <span className="text-slate-500 font-normal text-xs">(Optional)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Highlight your top scores, bowling figures, or club representations
              </p>
            </div>
          </div>

          {/* Quick Insert Badges */}
          <div className="mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
              💡 Quick Tap to Add to Your Profile:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {quickAchievementTags.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => addAchievementTag(tag)}
                  className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-cyan-400/50 text-slate-300 hover:text-cyan-300 text-[11px] font-medium transition-all active:scale-95"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <textarea
              rows={3}
              maxLength={400}
              placeholder="e.g. Highest score 92* off 44 balls. 5-wicket haul (5/18) in District Championship. Opening bowler for local club."
              value={formData.stats}
              onChange={(e) => onChange({ stats: e.target.value })}
              className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20 placeholder:text-slate-600 transition-all leading-relaxed"
            />
            <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1 px-1">
              <span>Teams & franchises review these stats during the auction bidding</span>
              <span>{formData.stats.length}/400</span>
            </div>
          </div>

        </div>
      </div>

      {/* SECTION 4: Final Payment & Instant Pass Issuance */}
      <div
        className={`relative rounded-3xl p-[1px] shadow-2xl transition-all ${
          isFree
            ? 'bg-gradient-to-r from-emerald-500 via-green-400 to-teal-500 shadow-[0_0_35px_rgba(16,232,123,0.2)]'
            : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 shadow-[0_0_35px_rgba(245,158,11,0.25)]'
        }`}
      >
        <div className="bg-[#090f1e]/98 backdrop-blur-2xl rounded-[23px] p-5 sm:p-7">
          
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                    isFree
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {isFree ? '⚡ 100% Free Entry' : '🔒 Verified Payment'}
                </span>
                <span className="text-[10px] text-slate-400">• Official Player Pass</span>
              </div>
              <h4 className="text-xl font-black text-white uppercase tracking-tight font-sans">
                {isFree ? 'Claim Free Auction Pass' : 'Complete Registration & Issue Ticket'}
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                {isFree
                  ? 'Zero registration charges. Instant player pass generated with WhatsApp share link.'
                  : 'Pay official entry fee via Razorpay UPI / Cards. Pass instantly generated upon verification.'}
              </p>
            </div>

            <div className="px-5 py-3 rounded-2xl bg-slate-950 border border-slate-800 text-center sm:text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Registration Fee
              </span>
              <span
                className={`text-3xl font-black font-sans ${
                  isFree ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {isFree ? '₹0 (FREE)' : `₹${registrationFee}`}
              </span>
            </div>
          </div>

          {/* Big Glowing Action Button */}
          {isFree ? (
            <button
              type="submit"
              disabled={isLoading || isCompressing}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500 hover:from-emerald-400 hover:to-green-400 text-slate-950 font-black text-base uppercase tracking-wider shadow-[0_0_25px_rgba(16,232,123,0.4)] transition-all transform active:scale-[0.99] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <div className="flex items-center gap-2.5">
                  <div className="w-5 h-5 border-3 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                  <span>Generating Official Player Pass...</span>
                </div>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 text-slate-950" />
                  <span>Confirm Free Registration & Get Pass (₹0)</span>
                  <ArrowRight className="w-5 h-5 text-slate-950 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <button
                type="submit"
                disabled={isLoading || isCompressing}
                className="w-full py-5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-emerald-400 hover:from-amber-300 hover:to-emerald-300 text-slate-950 font-black text-base sm:text-lg uppercase tracking-wider shadow-[0_0_35px_rgba(245,158,11,0.5)] border-2 border-yellow-200 transition-all transform active:scale-[0.99] flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 border-3 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                    <span>Connecting Razorpay Gateway...</span>
                  </div>
                ) : (
                  <>
                    <CreditCard className="w-6 h-6 text-slate-950 stroke-[2.5]" />
                    <span>PAY ₹{registrationFee} & ISSUE OFFICIAL PASS</span>
                    <ArrowRight className="w-6 h-6 text-slate-950 stroke-[2.5] group-hover:translate-x-1.5 transition-transform" />
                  </>
                )}
              </button>

              {/* Supported Payment Gateways / UPI Bar */}
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-300">
                <span className="font-bold text-amber-400">Supported:</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono">Google Pay</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono">PhonePe</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono">Paytm</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono">BHIM / UPI</span>
                <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono">Cards / NetBanking</span>
              </div>
            </div>
          )}

          {/* Trust & Guarantee Badges */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400">
            {isFree ? (
              <>
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <Zap className="w-3.5 h-3.5" /> Instant Confirmation
                </span>
                <span>•</span>
                <span>Cloud PostgreSQL Secured</span>
                <span>•</span>
                <span>Official Digital Pass Included</span>
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" /> Razorpay 256-Bit SSL Encrypted
                </span>
                <span>•</span>
                <span>UPI (GPay / PhonePe / Paytm)</span>
                <span>•</span>
                <span>Auto-Reconciled Cloud Storage</span>
              </>
            )}
          </div>

        </div>
      </div>

    </form>
  );
};
