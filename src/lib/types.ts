export type PlayingRole =
  | 'Pure Batsman'
  | 'Fast Bowler'
  | 'Spin Bowler'
  | 'Batting All-Rounder'
  | 'Bowling All-Rounder'
  | 'Wicketkeeper-Batsman';

export type BattingStyle = 'Right-hand' | 'Left-hand';

export type BowlingStyle =
  | 'Right-arm Fast'
  | 'Right-arm Spin'
  | 'Left-arm Fast'
  | 'Left-arm Spin'
  | 'None';

export interface PlayerFormData {
  fullName: string;
  phone: string;
  age: string;
  role: PlayingRole;
  battingStyle: BattingStyle;
  bowlingStyle: BowlingStyle;
  stats: string;
  photoUrl: string; // Base64 data URL
}

export interface RegistrationSubmission extends PlayerFormData {
  registrationId: string;
  tournamentSlug: string;
  tournamentTitle: string;
  timestamp: string;
  paymentId: string;
  orderId?: string;
  paymentStatus: 'PAID' | 'FREE' | 'PENDING' | 'FAILED' | 'PENDING_PAYMENT';
  amount: number;
}

export interface Tournament {
  id: string;
  slug: string;
  title: string;
  tagline?: string;
  city: string;
  venue: string;
  bannerUrl: string;
  registrationDeadline: string;
  auctionDate: string;
  googleSheetUrl: string;
  isPaid: boolean; // false = Free Registration Mode, true = Paid Mode
  entryFee: number; // e.g. 0 for Free, 499 for Paid
  razorpayKeyId?: string; // Optional custom override
  razorpayKeySecret?: string; // Optional custom override
  organizerName: string;
  organizerContact: string;
  registeredCount: number;
  featured?: boolean;
  createdAt: string;
}

export interface RazorpayOrderResponse {
  success: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  keyId?: string;
  isMock?: boolean;
  message?: string;
}
