export type LeadCallStatus = 'not_called' | 'called' | 'connected' | 'missed';

export interface SheetLead {
  rowNumber: number;
  name: string;
  phoneNumber: string;
  normalizedPhone: string;
  /** Source Google Sheet tab name (when reading all tabs) */
  sheetName?: string;
  /** All original Lead sheet columns, keyed by header name */
  raw: Record<string, string>;
}

export interface LeadWithAnalysis extends SheetLead {
  status: LeadCallStatus;
  callCount: number;
  incomingCallCount: number;
  incomingDurationSeconds: number;
  outgoingCallCount: number;
  outgoingDurationSeconds: number;
  connectedCount: number;
  missedCount: number;
  totalDurationSeconds: number;
  lastCalledAt: number | null;
  lastCallType: string | null;
  isDuplicate: boolean;
}

export interface LeadAnalysisSummary {
  totalRows: number;
  uniqueLeads: number;
  duplicateRows: number;
  incomingCallCount: number;
  incomingDurationSeconds: number;
  outgoingCallCount: number;
  outgoingDurationSeconds: number;
  calledCount: number;
  notCalledCount: number;
  connectedCount: number;
  missedCount: number;
  connectionRate: number;
  totalTalkTimeSeconds: number;
}

export interface LeadAnalysisResult {
  summary: LeadAnalysisSummary;
  leads: LeadWithAnalysis[];
  /** Lead sheet header order for Excel export */
  sheetHeaders: string[];
}

export type LeadFilter = 'all' | 'not_called' | 'called' | 'connected' | 'missed';

/** Lead sheet Status column values (exact labels from your sheet) */
export const SHEET_LEAD_STATUSES = [
  'Active',
  'Ringing/not connected',
  'Low cibil',
  'Document issue',
  'Private/Startup Funding',
  'High enquiries',
  'Not interested',
  'Doc list send',
  'Location issue',
  'Logged in',
  'not eligible',
  'language barrier',
  'Negative profile',
  'Docs received',
  'forwarded to pooja mam',
  'duplicate',
  'Rejected',
  'CALL BACK CUST OK',
  'DSA',
  'Meeting done',
  'Mandate signed',
  'switch off',
] as const;

export type SheetLeadStatus = (typeof SHEET_LEAD_STATUSES)[number];
export type SheetStatusFilter = 'all' | SheetLeadStatus;

/** Preferred Lead sheet columns (from your MSME sheet) for display/export order */
export const PREFERRED_LEAD_HEADERS = [
  'Date',
  'what_is_your_turnover?',
  'what_is_your_cibil_score?',
  'how_old_is_your_business?',
  'what_is_your_loan_requirement?',
  'company_name',
  'full name',
  'phone_number',
  'email',
  'city',
  'Name',
  'Status',
  'Remarks',
  'PROFILE',
  'prop/ pvt/ partner',
  'TURN OVER',
  'VINTAGE',
  'Cibil',
  'CMR',
  'RUNNING LOAN',
  'EMI',
  'COLLETRAL',
  'REQUIRNMENT',
  'LOCATION',
  'Sheet Tab',
] as const;
