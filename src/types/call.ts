export type TrackedCallState = 'IDLE' | 'RINGING' | 'OFFHOOK';

export interface TrackedCall {
  phoneNumber: string;
  contactName: string | null;
  callType: string;
  startedAt: number;
  liveDurationSeconds: number;
}

export interface StoredCallRecord {
  id: string;
  phoneNumber: string;
  contactName: string | null;
  callType: string;
  durationSeconds: number;
  liveDurationSeconds: number;
  timestamp: number;
  syncedToSheets: boolean;
}
