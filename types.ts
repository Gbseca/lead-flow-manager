
export interface Lead {
  id: string;
  name: string;
  original: string;
  display: string;
  tel: string;
  wa: string;
  ddd?: string;
  local?: string;
  international: boolean;
  internationalDigits?: string;
  attempts: [boolean, boolean, boolean];
  attemptsResults: [AttemptResult | null, AttemptResult | null, AttemptResult | null];
  currentAttempt: number;
  result: FinalResult | '';
  locked: boolean;
  note: string;
  favorite: boolean;
  scheduleISO: string;
  onHold: boolean;
  createdAt: number;
  priority: number;
  overdue?: boolean;
}

export interface PersistentLead extends Omit<Lead, 'id' | 'favorite'> {
  // The 'wa' link is used as the unique key for persistent leads.
  noteHistory?: { timestamp: number; text: string }[];
}

export enum AttemptResult {
  Voicemail = 'voicemail',
}

export enum FinalResult {
  Interested = 'interested',
  Refused = 'refused',
}

export type TabKey = 'all' | 'voicemail' | 'interested' | 'refused' | 'onHold' | 'persistent' | 'overdue' | 'international';

export interface SaveSlot {
  leads: Lead[];
  createdAt: number;
}