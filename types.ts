
export enum ServiceStatus {
  OFF = 'OFF',
  WORKING = 'WORKING',
  BREAK = 'BREAK'
}

export interface ActivityLog {
  id: string;
  action: string;
  time: string;
  timestamp: Date;
  location?: string;
  type: 'start' | 'end' | 'break' | 'resume';
}

export interface Break {
  id: string;
  start: string;
  end: string;
  duration: number;
  location: 'Entreprise' | 'Extérieur';
  isMeal?: boolean;
}

export interface Shift {
  id: string;
  day: string;
  start: string;
  end: string;
  crew: string;
  vehicle: string;
  breaks?: Break[];
  preciseStart?: string; // ISO string for exact start time
  isLeave?: boolean;
  leaveType?: 'CP' | 'MAL' | 'CSS' | 'AT';
  leaveDays?: number;
  endDate?: string;
  note?: string;
  isConge?: boolean;
}

export type AppTab = 'home' | 'planning' | 'paie' | 'profile';

export type UserRole = 'dea' | 'auxiliary' | 'taxi';

export interface UserProfile {
  firstName: string;
  lastName: string;
  companyName: string;
  onboarded: boolean;
  roles: UserRole[];
  primaryRole: UserRole;
  contractType: string;
  hoursBase: string;
  contractStartDate: string;
  autoGeo: boolean;
  pushEnabled: boolean;
  weeklyContractHours: number;
  overtimeMode: 'weekly' | 'biweekly' | 'modulation' | 'annualized';
  modulationWeeks?: number;
  modulationStartDate?: string;
  payRateMode: '100_percent' | '90_percent';
  supplementaryTaskType?: 'none' | 'type_1' | 'type_2' | 'type_3';
  initialCpBalance?: number;
  lastCpAccrualDate?: string; // Format: "YYYY-MM"
  hourlyRate?: number;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
}

export interface UserStats {
  lastActiveDay?: string;
  level: number;
  xp: number;
}

export interface PushNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  timestamp: Date;
  url?: string;
  action?: 'open_navigation';
  read?: boolean;
}
