import { RegistrationSubmission, PlayingRole, BattingStyle, BowlingStyle } from './types';

export type AuctionRoomStatus = 'WAITING' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';
export type PlayerAuctionStatus = 'PENDING' | 'IN_AUCTION' | 'SOLD' | 'UNSOLD';

export interface TournamentTeam {
  id: string;
  tournamentId?: string;
  tournamentSlug: string;
  name: string;
  shortName: string;
  logoUrl: string;
  color?: string;
  totalPurse: number;
  remainingPurse: number;
  secretPin: string;
  maxPlayers: number;
  boughtPlayersCount: number;
  createdAt?: string;
}

export interface AuctionRoom {
  id: string;
  tournamentId?: string;
  tournamentSlug: string;
  status: AuctionRoomStatus;
  currentPlayerId: string | null;
  currentBid: number;
  currentBiddingTeamId: string | null;
  timerSeconds: number;
  timerRunning: boolean;
  timerExpiresAt?: number | null;
  basePrice: number;
  bidIncrement: number;
  lastAction?: 'NEW_BID' | 'SOLD' | 'UNSOLD' | 'NEXT' | 'PAUSE' | 'RESUME' | 'RESET' | 'INIT' | 'UNDO' | 'EDIT' | 'HAMMER_5S' | 'CANCEL_HAMMER';
  lastActionTimestamp?: number;
  updatedAt: string;
}

export interface AuctionBid {
  id: string;
  auctionId: string;
  tournamentSlug: string;
  playerId: string;
  teamId: string;
  teamName: string;
  teamShortName?: string;
  teamLogoUrl?: string;
  amount: number;
  createdAt: string;
}

export interface AuctionPlayerState {
  playerId: string;
  tournamentSlug: string;
  status: PlayerAuctionStatus;
  basePrice: number;
  soldPrice?: number | null;
  soldToTeamId?: string | null;
  soldToTeamName?: string | null;
  soldToTeamLogo?: string | null;
  updatedAt?: string;
}

export interface SoldRecord {
  player: RegistrationSubmission;
  soldPrice: number;
  team: TournamentTeam;
  soldAt: string;
}

export interface FullAuctionState {
  room: AuctionRoom;
  teams: TournamentTeam[];
  currentBiddingTeam: TournamentTeam | null;
  currentPlayer: RegistrationSubmission | null;
  currentPlayerState: AuctionPlayerState | null;
  recentBids: AuctionBid[];
  soldHistory: SoldRecord[];
  playersQueue: {
    player: RegistrationSubmission;
    status: PlayerAuctionStatus;
    basePrice: number;
    soldPrice?: number | null;
    soldTeamName?: string | null;
    soldToTeamId?: string | null;
  }[];
}
