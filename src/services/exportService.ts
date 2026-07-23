import { getLeadField } from '@/services/leadAnalysisService';
import type { LeadWithAnalysis } from '@/types/lead';
import { formatMinutes, getLeadSheetStatus } from '@/utils/leadInsights';
import { cacheDirectory, writeAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

function escapeCsvValue(value: string | number | null | undefined): string {
  const stringValue = value == null ? '' : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function formatDate(timestamp: number | null): string {
  if (!timestamp) {
    return '';
  }

  return new Date(timestamp).toLocaleString();
}

const CALL_ANALYSIS_HEADERS = [
  'Matched To Lead Sheet',
  'Call Status',
  'Times Called',
  'Incoming Calls',
  'Outgoing Calls',
  'Connected Calls',
  'Missed Calls',
  'Total Duration',
  'Last Call Date',
  'Last Call Type',
] as const;

function buildAnalysisCells(lead: LeadWithAnalysis): (string | number)[] {
  return [
    lead.status === 'not_called' ? 'No' : 'Yes',
    lead.status,
    lead.callCount,
    lead.incomingCallCount,
    lead.outgoingCallCount,
    lead.connectedCount,
    lead.missedCount,
    formatMinutes(lead.totalDurationSeconds),
    formatDate(lead.lastCalledAt),
    lead.lastCallType ?? '',
  ];
}

export type ExportLeadAnalysisOptions = {
  leads: LeadWithAnalysis[];
  sheetHeaders: string[];
  /** Shown in summary, e.g. date range + sheet status */
  filterLabel?: string;
};

export function buildLeadAnalysisCsv(options: ExportLeadAnalysisOptions): string {
  const sheetHeaders =
    options.sheetHeaders.length > 0 ? options.sheetHeaders : ['Name', 'Phone Number'];

  const headers = [...sheetHeaders, ...CALL_ANALYSIS_HEADERS];

  // Caller should already pass dialed + date/status-filtered leads
  const leads = options.leads.filter((lead) => !lead.isDuplicate);

  const rows = leads.map((lead) => [
    ...sheetHeaders.map((header) => getLeadField(lead, header)),
    ...buildAnalysisCells(lead),
  ]);

  const dialedConnected = leads.filter((lead) => lead.status === 'connected').length;
  const dialedMissed = leads.filter((lead) => lead.status === 'missed').length;
  const dialedTalkTime = formatMinutes(
    leads.reduce((total, lead) => total + lead.totalDurationSeconds, 0),
  );

  const sheetStatusCounts = new Map<string, number>();
  for (const lead of leads) {
    const status = getLeadSheetStatus(lead) || 'No status';
    sheetStatusCounts.set(status, (sheetStatusCounts.get(status) ?? 0) + 1);
  }

  const sheetStatusRows = Array.from(sheetStatusCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([status, count]) => [status, count] as (string | number)[]);

  const summaryRows: (string | number)[][] = [
    [],
    ['Summary (filtered dialed leads)'],
    ...(options.filterLabel ? [['Applied filters', options.filterLabel]] : []),
    ['Dialed & Matched Rows', leads.length],
    ['Connected', dialedConnected],
    ['Missed', dialedMissed],
    ['Total Talk Time', dialedTalkTime],
    [],
    ['Count by sheet Status'],
    ['Status', 'Count'],
    ...sheetStatusRows,
  ];

  return [headers, ...rows, ...summaryRows]
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(','))
    .join('\n');
}

export async function exportLeadAnalysisToExcel(
  options: ExportLeadAnalysisOptions,
): Promise<string> {
  const csv = buildLeadAnalysisCsv(options);
  const fileName = `call-analysis-${new Date().toISOString().slice(0, 10)}.csv`;

  if (!cacheDirectory) {
    throw new Error('File storage is not available on this device.');
  }

  const fileUri = `${cacheDirectory}${fileName}`;
  await writeAsStringAsync(fileUri, csv, { encoding: 'utf8' });

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error('Sharing is not available on this device.');
  }

  await Sharing.shareAsync(fileUri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export call analysis',
    UTI: 'public.comma-separated-values-text',
  });

  return fileUri;
}
