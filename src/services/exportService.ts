import { getLeadField } from '@/services/leadAnalysisService';
import type { LeadAnalysisResult, LeadWithAnalysis } from '@/types/lead';
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

function secondsToMinutes(seconds: number): number {
  return Math.round((seconds / 60) * 100) / 100;
}

const CALL_ANALYSIS_HEADERS = [
  'Matched To Lead Sheet',
  'Call Status',
  'Times Called',
  'Connected Calls',
  'Missed Calls',
  'Total Duration (min)',
  'Last Call Date',
  'Last Call Type',
] as const;

function buildAnalysisCells(lead: LeadWithAnalysis): (string | number)[] {
  return [
    lead.status === 'not_called' ? 'No' : 'Yes',
    lead.status,
    lead.callCount,
    lead.connectedCount,
    lead.missedCount,
    secondsToMinutes(lead.totalDurationSeconds),
    formatDate(lead.lastCalledAt),
    lead.lastCallType ?? '',
  ];
}

export function buildLeadAnalysisCsv(analysis: LeadAnalysisResult): string {
  const sheetHeaders =
    analysis.sheetHeaders.length > 0
      ? analysis.sheetHeaders
      : ['Name', 'Phone Number'];

  const headers = [...sheetHeaders, ...CALL_ANALYSIS_HEADERS];

  // Only dialed numbers that matched the lead sheet
  const dialedLeads = analysis.leads.filter(
    (lead) => !lead.isDuplicate && lead.status !== 'not_called',
  );

  const rows = dialedLeads.map((lead) => [
    ...sheetHeaders.map((header) => getLeadField(lead, header)),
    ...buildAnalysisCells(lead),
  ]);

  const dialedConnected = dialedLeads.filter((lead) => lead.status === 'connected').length;
  const dialedMissed = dialedLeads.filter((lead) => lead.status === 'missed').length;
  const dialedTalkTimeMinutes = secondsToMinutes(
    dialedLeads.reduce((total, lead) => total + lead.totalDurationSeconds, 0),
  );

  const summaryRows: (string | number)[][] = [
    [],
    ['Summary (dialed numbers only)'],
    ['Dialed & Matched Rows', dialedLeads.length],
    ['Connected', dialedConnected],
    ['Missed', dialedMissed],
    ['Total Talk Time (min)', dialedTalkTimeMinutes],
  ];

  return [headers, ...rows, ...summaryRows]
    .map((row) => row.map((cell) => escapeCsvValue(cell)).join(','))
    .join('\n');
}

export async function exportLeadAnalysisToExcel(
  analysis: LeadAnalysisResult,
): Promise<string> {
  const csv = buildLeadAnalysisCsv(analysis);
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
