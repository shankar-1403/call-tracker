import { get, ref } from 'firebase/database';

import { db } from '@/constants/firebase';

export type AdminSheetConfig = {
  id: string;
  heading: string;
  sheet_link_id: string;
  active?: boolean;
  createdAt?: number;
};

/**
 * Accept a raw spreadsheet ID or a full Google Sheets URL and return the ID.
 */
export function extractSpreadsheetId(input: string | null | undefined): string {
  const trimmed = String(input || '').trim();
  if (!trimmed) {
    return '';
  }

  const fromPath = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (fromPath?.[1]) {
    return fromPath[1];
  }

  const fromQuery = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (fromQuery?.[1]) {
    return fromQuery[1];
  }

  return trimmed.split(/[/?#]/)[0] ?? '';
}

function mapSheetEntry(id: string, data: Record<string, unknown>): AdminSheetConfig | null {
  const sheetLinkId = extractSpreadsheetId(
    typeof data.sheet_link_id === 'string' ? data.sheet_link_id : '',
  );
  if (!sheetLinkId) {
    return null;
  }

  return {
    id,
    heading: typeof data.heading === 'string' ? data.heading : 'Untitled sheet',
    sheet_link_id: sheetLinkId,
    active: data.active === true,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : undefined,
  };
}

/**
 * Load sheet configs written by aksh-admin under Firebase RTDB `sheets/`.
 */
export async function fetchAdminSheets(): Promise<AdminSheetConfig[]> {
  const snap = await get(ref(db, 'sheets'));
  const value = snap.val() as Record<string, Record<string, unknown>> | null;
  if (!value) {
    return [];
  }

  return Object.entries(value)
    .map(([id, data]) => mapSheetEntry(id, data ?? {}))
    .filter((sheet): sheet is AdminSheetConfig => sheet != null)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

/**
 * Prefer the sheet marked active in aksh-admin; otherwise the newest sheet.
 */
export async function resolveActiveSheetConfig(): Promise<AdminSheetConfig | null> {
  const sheets = await fetchAdminSheets();
  if (sheets.length === 0) {
    return null;
  }

  return sheets.find((sheet) => sheet.active) ?? sheets[sheets.length - 1] ?? null;
}
