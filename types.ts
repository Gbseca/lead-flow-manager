

export type HistoryEventType = 'creation' | 'attempt' | 'result' | 'note' | 'status_change' | 'import' | 'manual_update';

export interface HistoryEvent {
  id: string;
  type: HistoryEventType;
  timestamp: number;
  details: string;
  data?: any;
}

export interface AudioNote {
  id: string;
  url: string; //
  duration: number;
  createdAt: number;
  transcript?: string;
}

export type TriggerType =
    | 'status_change'
    | 'new_attempt'
    | 'added_to_persistent'
    | 'tag_added'
    | 'on_hold_for_days'
    | 'lead_imported';

export type ActionType =
    | 'add_tag'
    | 'remove_tag'
    | 'move_to_persistent'
    | 'set_schedule'
    | 'set_priority'
    | 'clear_schedule';

export interface Trigger {
    type: TriggerType;
    value?: string | number; // e.g., status ID, attempt number, tag name, number of days
}

export interface Action {
    id: string;
    type: ActionType;
    value?: string | number; // e.g., tag name, schedule string ('tomorrow_9am'), priority number
}

export interface Workflow {
    id: string;
    name: string;
    trigger: Trigger;
    actions: Action[];
}


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
  result: string; // Now a CustomStatus ID
  locked: boolean;
  note: string;
  favorite: boolean;
  scheduleISO: string;
  onHold: boolean;
  onHoldSince?: number;
  createdAt: number;
  lastUpdatedAt: number;
  priority: number;
  overdue?: boolean;
  history: HistoryEvent[];
  aiScore?: number;
  aiJustification?: string;
  audioNotes: AudioNote[];
  tags?: string[];
  historySummary?: string;
}

export interface PersistentLead extends Omit<Lead, 'id' | 'favorite'> {
  // The 'wa' link is used as the unique key for persistent leads.
}

export enum AttemptResult {
  Voicemail = 'voicemail',
}

export type TabKey = 'all' | 'voicemail' | 'interested' | 'refused' | 'onHold' | 'persistent' | 'overdue' | 'international';

export interface SaveSlot {
  leads: Lead[];
  createdAt: number;
}

export interface CustomStatus {
    id: string;
    label: string;
    color: string;
    isPositive: boolean;
}

export interface Settings {
    theme: string;
    operatorPrefix: string;
    hideRJ: boolean;
    defaultWaMessage: string;
    persistentOrder: 'createdAt' | 'priority' | 'scheduleISO' | 'name';
    customStatuses: CustomStatus[];
    workflows: Workflow[];
    dailyGoals: {
        calls: number;
        positives: number;
    };
}

// Power Hour Types
export interface PowerHourGoal {
    calls: number;
    positives: number;
}

export interface PowerHourProgress {
    calls: number;
    positives: number;
}

export interface PowerHourSession {
    isActive: boolean;
    startTime: number;
    duration: number; // in minutes
    goals: PowerHourGoal;
    progress: PowerHourProgress;
    leadQueue: string[]; // array of lead IDs
    coachMessages: { id: number, text: string }[];
}

export interface SuccessInsight {
    winningPhrases: string[];
    effectiveFollowups: string[];
    topLeadProfiles: string[];
    strategicSummary: string;
}