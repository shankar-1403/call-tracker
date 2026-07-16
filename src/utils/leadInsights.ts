import type { LeadCallStatus, LeadFilter, LeadWithAnalysis } from '@/types/lead';

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

export type DateRangePreset = 'all' | 'today' | '7d' | '30d' | 'month';

export interface DateRange {
  from: number | null;
  to: number | null;
  preset: DateRangePreset;
}

export function getDateRangePreset(preset: DateRangePreset, now = new Date()): DateRange {
  const todayStart = startOfDay(now).getTime();
  const todayEnd = endOfDay(now).getTime();

  switch (preset) {
    case 'today':
      return { preset, from: todayStart, to: todayEnd };
    case '7d': {
      const from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)).getTime();
      return { preset, from, to: todayEnd };
    }
    case '30d': {
      const from = startOfDay(new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000)).getTime();
      return { preset, from, to: todayEnd };
    }
    case 'month': {
      const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)).getTime();
      return { preset, from, to: todayEnd };
    }
    default:
      return { preset: 'all', from: null, to: null };
  }
}

/** Parse lead sheet Date / last call timestamp for filtering */
export function getLeadActivityTimestamp(lead: LeadWithAnalysis): number | null {
  if (lead.lastCalledAt) {
    return lead.lastCalledAt;
  }

  const rawDate =
    lead.raw.Date ||
    lead.raw.date ||
    Object.entries(lead.raw).find(([key]) => key.toLowerCase() === 'date')?.[1];

  if (!rawDate?.trim()) {
    return null;
  }

  const parsed = Date.parse(rawDate);
  if (!Number.isNaN(parsed)) {
    return parsed;
  }

  // dd/mm/yyyy or dd-mm-yyyy
  const match = rawDate.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]) - 1;
    let year = Number(match[3]);
    if (year < 100) {
      year += 2000;
    }
    const date = new Date(year, month, day);
    if (!Number.isNaN(date.getTime())) {
      return date.getTime();
    }
  }

  return null;
}

export function leadMatchesDateRange(lead: LeadWithAnalysis, range: DateRange): boolean {
  if (range.from == null && range.to == null) {
    return true;
  }

  const timestamp = getLeadActivityTimestamp(lead);
  if (timestamp == null) {
    // Not-called leads without a sheet date: only show in "all"
    return false;
  }

  if (range.from != null && timestamp < range.from) {
    return false;
  }
  if (range.to != null && timestamp > range.to) {
    return false;
  }

  return true;
}

export function leadMatchesStatusFilter(lead: LeadWithAnalysis, filter: LeadFilter): boolean {
  if (lead.isDuplicate) {
    return false;
  }

  switch (filter) {
    case 'not_called':
      return lead.status === 'not_called';
    case 'called':
      return lead.status !== 'not_called';
    case 'connected':
      return lead.status === 'connected';
    case 'missed':
      return lead.status === 'missed';
    default:
      return true;
  }
}

export function getLeadSheetStatus(lead: LeadWithAnalysis): string {
  const direct = lead.raw.Status || lead.raw.status;
  if (direct?.trim()) {
    return direct.trim();
  }

  const match = Object.entries(lead.raw).find(([key]) => key.toLowerCase() === 'status');
  return match?.[1]?.trim() ?? '';
}

export function leadMatchesSheetStatus(
  lead: LeadWithAnalysis,
  sheetStatus: string,
): boolean {
  if (!sheetStatus || sheetStatus === 'all') {
    return true;
  }

  const value = getLeadSheetStatus(lead);
  if (!value) {
    return false;
  }

  return value.toLowerCase() === sheetStatus.toLowerCase();
}

export function filterLeadsForInsights(
  leads: LeadWithAnalysis[],
  statusFilter: LeadFilter,
  dateRange: DateRange,
  sheetStatus: string = 'all',
): LeadWithAnalysis[] {
  return leads.filter(
    (lead) =>
      leadMatchesStatusFilter(lead, statusFilter) &&
      leadMatchesDateRange(lead, dateRange) &&
      leadMatchesSheetStatus(lead, sheetStatus),
  );
}

export interface StatusBreakdown {
  status: LeadCallStatus;
  label: string;
  count: number;
  color: string;
}

export function buildStatusBreakdown(leads: LeadWithAnalysis[]): StatusBreakdown[] {
  const unique = leads.filter((lead) => !lead.isDuplicate);
  const counts: Record<LeadCallStatus, number> = {
    not_called: 0,
    called: 0,
    connected: 0,
    missed: 0,
  };

  for (const lead of unique) {
    counts[lead.status] += 1;
  }

  return [
    { status: 'connected', label: 'Connected', count: counts.connected, color: '#12B76A' },
    { status: 'called', label: 'Called', count: counts.called, color: '#2E5CFF' },
    { status: 'missed', label: 'Missed', count: counts.missed, color: '#F79009' },
    { status: 'not_called', label: 'Not Called', count: counts.not_called, color: '#98A2B3' },
  ];
}

export function formatMinutes(totalSeconds: number): string {
  const minutes = Math.round((totalSeconds / 60) * 10) / 10;
  return `${minutes} min`;
}
