import CallLogs, { type CallLog } from 'react-native-call-log';

import type { StoredCallRecord } from '@/types/call';

import { hasCallLogPermissions } from './callLogPermissions';

function mapCallLog(log: CallLog): StoredCallRecord {
  return {
    id: log.id,
    phoneNumber: log.phoneNumber || log.formattedNumber || 'Unknown',
    contactName: log.name ?? null,
    callType: log.type,
    durationSeconds: Number(log.duration) || 0,
    liveDurationSeconds: Number(log.duration) || 0,
    timestamp: Number(log.timestamp) || Date.now(),
    syncedToSheets: false,
  };
}

export async function loadRecentCalls(limit = 20): Promise<StoredCallRecord[]> {
  return loadCallHistory(limit);
}

export async function loadCallHistory(limit = 500): Promise<StoredCallRecord[]> {
  const granted = await hasCallLogPermissions();
  if (!granted) {
    return [];
  }

  const logs = limit > 0 ? await CallLogs.load(limit) : await CallLogs.loadAll();
  return logs.map(mapCallLog);
}

export async function loadLatestCall(): Promise<StoredCallRecord | null> {
  const logs = await loadRecentCalls(1);
  return logs[0] ?? null;
}

export async function waitForLatestCall(
  startedAfterMs: number,
  retries = 6,
  delayMs = 1000,
): Promise<StoredCallRecord | null> {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    const latest = await loadLatestCall();
    if (latest && latest.timestamp >= startedAfterMs - 5000) {
      return latest;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return null;
}
