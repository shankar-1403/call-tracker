import type { StoredCallRecord } from '@/types/call';
import type {
  LeadAnalysisResult,
  LeadAnalysisSummary,
  LeadCallStatus,
  LeadWithAnalysis,
  SheetLead,
} from '@/types/lead';
import { PREFERRED_LEAD_HEADERS } from '@/types/lead';
import { normalizePhoneNumber } from '@/utils/phoneNumber';

function isConnectedCall(call: StoredCallRecord): boolean {
  return call.durationSeconds > 0 && call.callType !== 'MISSED' && call.callType !== 'REJECTED';
}

function getLeadStatus(calls: StoredCallRecord[]): LeadCallStatus {
  if (calls.length === 0) {
    return 'not_called';
  }

  if (calls.some(isConnectedCall)) {
    return 'connected';
  }

  if (calls.some((call) => call.callType === 'MISSED')) {
    return 'missed';
  }

  return 'called';
}

function buildUniqueLeads(leads: SheetLead[]): {
  uniqueLeads: SheetLead[];
  duplicateRows: number;
} {
  // Keep the newest row when the same phone appears more than once
  // (later sheet rows / later tabs win).
  const byPhone = new Map<string, SheetLead>();
  let duplicateRows = 0;

  for (const lead of leads) {
    if (byPhone.has(lead.normalizedPhone)) {
      duplicateRows += 1;
    }
    byPhone.set(lead.normalizedPhone, lead);
  }

  return { uniqueLeads: Array.from(byPhone.values()), duplicateRows };
}

function buildCallIndex(calls: StoredCallRecord[]): Map<string, StoredCallRecord[]> {
  const index = new Map<string, StoredCallRecord[]>();

  for (const call of calls) {
    const key = normalizePhoneNumber(call.phoneNumber);
    if (key.length < 8) {
      continue;
    }
    const existing = index.get(key);
    if (existing) {
      existing.push(call);
    } else {
      index.set(key, [call]);
    }
  }

  return index;
}

function getCallsForLeadFromIndex(
  lead: SheetLead,
  callIndex: Map<string, StoredCallRecord[]>,
): StoredCallRecord[] {
  return callIndex.get(lead.normalizedPhone) ?? [];
}

function buildSummary(
  totalRows: number,
  uniqueLeads: LeadWithAnalysis[],
  duplicateRows: number,
): LeadAnalysisSummary {
  let calledCount = 0;
  let connectedCount = 0;
  let missedCount = 0;
  let notCalledCount = 0;
  let totalTalkTimeSeconds = 0;

  for (const lead of uniqueLeads) {
    totalTalkTimeSeconds += lead.totalDurationSeconds;
    if (lead.status === 'not_called') {
      notCalledCount += 1;
    } else {
      calledCount += 1;
      if (lead.status === 'connected') {
        connectedCount += 1;
      } else if (lead.status === 'missed') {
        missedCount += 1;
      }
    }
  }

  const connectionRate = calledCount > 0 ? Math.round((connectedCount / calledCount) * 100) : 0;

  return {
    totalRows,
    uniqueLeads: uniqueLeads.length,
    duplicateRows,
    calledCount,
    notCalledCount,
    connectedCount,
    missedCount,
    connectionRate,
    totalTalkTimeSeconds,
  };
}

function findRawHeaderKey(leads: SheetLead[], header: string): string | null {
  for (const lead of leads) {
    const exact = Object.keys(lead.raw).find((key) => key === header);
    if (exact) {
      return exact;
    }
  }

  for (const lead of leads) {
    const match = Object.keys(lead.raw).find(
      (key) => key.toLowerCase() === header.toLowerCase(),
    );
    if (match) {
      return match;
    }
  }

  return null;
}

function collectSheetHeaders(leads: SheetLead[], preferred: readonly string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const header of preferred) {
    const actual = findRawHeaderKey(leads, header);
    if (actual && !seen.has(actual)) {
      seen.add(actual);
      ordered.push(actual);
    }
  }

  for (const lead of leads) {
    for (const key of Object.keys(lead.raw)) {
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      ordered.push(key);
    }
  }

  return ordered;
}

function getRawValue(raw: Record<string, string>, header: string): string {
  if (raw[header] != null) {
    return raw[header];
  }

  const match = Object.keys(raw).find((key) => key.toLowerCase() === header.toLowerCase());
  return match ? raw[match] : '';
}

export function getLeadField(lead: SheetLead, header: string): string {
  return getRawValue(lead.raw, header);
}

export function analyzeLeads(
  sheetLeads: SheetLead[],
  calls: StoredCallRecord[],
  apiHeaders: string[] = [],
): LeadAnalysisResult {
  const { uniqueLeads, duplicateRows } = buildUniqueLeads(sheetLeads);
  const callIndex = buildCallIndex(calls);

  const analyzedLeads: LeadWithAnalysis[] = uniqueLeads.map((lead) => {
    const matchedCalls = getCallsForLeadFromIndex(lead, callIndex);
    const connectedCalls = matchedCalls.filter(isConnectedCall);
    const missedCalls = matchedCalls.filter((call) => call.callType === 'MISSED');
    const lastCall = matchedCalls[0] ?? null;

    return {
      ...lead,
      status: getLeadStatus(matchedCalls),
      callCount: matchedCalls.length,
      connectedCount: connectedCalls.length,
      missedCount: missedCalls.length,
      totalDurationSeconds: matchedCalls.reduce(
        (total, call) => total + call.durationSeconds,
        0,
      ),
      lastCalledAt: lastCall?.timestamp ?? null,
      lastCallType: lastCall?.callType ?? null,
      isDuplicate: false,
    };
  });

  const summary = buildSummary(sheetLeads.length, analyzedLeads, duplicateRows);
  const collectedHeaders = collectSheetHeaders(
    uniqueLeads.length > 0 ? uniqueLeads.slice(0, 50) : sheetLeads.slice(0, 50),
    PREFERRED_LEAD_HEADERS,
  );
  const sheetHeaders =
    apiHeaders.length > 0
      ? mergeUniqueHeaders(apiHeaders, collectedHeaders)
      : collectedHeaders;

  // Keep dialed leads first for faster UI lists; avoid full name-sort of 6k rows
  analyzedLeads.sort((left, right) => {
    const leftDialed = left.status === 'not_called' ? 1 : 0;
    const rightDialed = right.status === 'not_called' ? 1 : 0;
    if (leftDialed !== rightDialed) {
      return leftDialed - rightDialed;
    }
    return (right.lastCalledAt ?? 0) - (left.lastCalledAt ?? 0);
  });

  return {
    summary,
    sheetHeaders,
    leads: analyzedLeads,
  };
}

function mergeUniqueHeaders(primary: string[], secondary: string[]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const header of [...primary, ...secondary]) {
    if (!header || seen.has(header)) {
      continue;
    }
    seen.add(header);
    merged.push(header);
  }
  return merged;
}

export function filterLeads(
  leads: LeadWithAnalysis[],
  filter: 'all' | 'not_called' | 'called' | 'connected' | 'missed',
): LeadWithAnalysis[] {
  const uniqueOnly = leads.filter((lead) => !lead.isDuplicate);

  switch (filter) {
    case 'not_called':
      return uniqueOnly.filter((lead) => lead.status === 'not_called');
    case 'called':
      return uniqueOnly.filter((lead) => lead.status !== 'not_called');
    case 'connected':
      return uniqueOnly.filter((lead) => lead.status === 'connected');
    case 'missed':
      return uniqueOnly.filter((lead) => lead.status === 'missed');
    default:
      return uniqueOnly;
  }
}

export function normalizeSheetPhone(value: string): string {
  return normalizePhoneNumber(value);
}
