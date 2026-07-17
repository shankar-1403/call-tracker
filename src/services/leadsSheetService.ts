import type { SheetLead } from '@/types/lead';
import { normalizePhoneNumber } from '@/utils/phoneNumber';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LEADS_CACHE_KEY = '@aksh/leads_cache_v2';
const TAB_CONCURRENCY = 2;
const TABS_TIMEOUT_MS = 45000;
const TAB_TIMEOUT_MS = 60000;
const ALL_TABS_TIMEOUT_MS = 120000;

function getWebhookBaseUrl(): string | null {
  const webhookUrl = process.env.EXPO_PUBLIC_GOOGLE_SHEETS_WEBHOOK_URL?.trim();
  if (!webhookUrl) {
    return null;
  }

  if (webhookUrl.includes('docs.google.com/spreadsheets')) {
    return null;
  }

  return webhookUrl.replace(/\/$/, '');
}

function buildUrl(
  action: string,
  params: Record<string, string> = {},
  options?: { bustCache?: boolean },
): string | null {
  const base = getWebhookBaseUrl();
  if (!base) {
    return null;
  }

  const query = new URLSearchParams({ action, slim: '1', ...params });
  // Bust HTTP / CDN caches so new Google Sheet rows appear on refresh
  if (options?.bustCache !== false) {
    query.set('_t', String(Date.now()));
  }
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${query.toString()}`;
}

export function isLeadsSheetConfigured(): boolean {
  return getWebhookBaseUrl() !== null;
}

interface LeadsApiResponse {
  success?: boolean;
  error?: string;
  headers?: string[];
  tabs?: Array<{ sheet?: string; gid?: string; count?: number; rows?: number }>;
  leads?: Array<{
    rowNumber?: number;
    sheetName?: string;
    name?: string;
    phoneNumber?: string;
    normalizedPhone?: string;
    raw?: Record<string, string>;
  }>;
}

interface TabsApiResponse {
  success?: boolean;
  error?: string;
  tabs?: Array<{ sheet?: string; gid?: string; rows?: number }>;
}

export interface FetchLeadsResult {
  leads: SheetLead[];
  sheetHeaders: string[];
  tabsLoaded: string[];
  fromCache?: boolean;
}

export type LeadsProgressCallback = ( partial: FetchLeadsResult & { loadedCount: number }) => void;

function pickRawValue(raw: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    if (raw[key]?.trim()) {
      return raw[key].trim();
    }
  }

  const lowered = Object.entries(raw);
  for (const key of keys) {
    const match = lowered.find(([header]) => header.toLowerCase() === key.toLowerCase());
    if (match?.[1]?.trim()) {
      return match[1].trim();
    }
  }

  return '';
}

function looksLikeHtml(body: string): boolean {
  return (
    body.includes('<!DOCTYPE html') ||
    body.includes('<!doctype html') ||
    body.includes('Sign in') ||
    body.includes('accounts.google.com')
  );
}

function isCanceledOrTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    error.name === 'AbortError' ||
    message.includes('canceled') ||
    message.includes('cancelled') ||
    message.includes('timed out') ||
    message.includes('timeout')
  );
}

export function isOfflineError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('unknownhostexception') ||
    message.includes('unable to resolve host') ||
    message.includes('network request failed') ||
    message.includes('no address associated with hostname') ||
    message.includes('software caused connection abort') ||
    message.includes('failed to connect')
  );
}

/**
 * Avoid AbortController on React Native — aborting often surfaces as
 * "Fetch request has been canceled" and breaks Apps Script cold starts.
 */
async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const fetchPromise = (async () => {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
    } catch (networkError) {
      if (isOfflineError(networkError)) {
        throw new Error(
          'No internet connection. Check Wi-Fi or mobile data, then pull to refresh.',
        );
      }
      throw networkError;
    }

    const body = await response.text();

    if (!response.ok) {
      throw new Error(`Failed to fetch leads (${response.status}).`);
    }

    if (looksLikeHtml(body)) {
      throw new Error(
        'Apps Script returned Google sign-in HTML. Set appsscript.json webapp.access to ANYONE_ANONYMOUS, create a New deployment, update .env /exec URL, test in Incognito.',
      );
    }

    try {
      return (body ? JSON.parse(body) : {}) as T;
    } catch {
      throw new Error('Apps Script did not return JSON. Redeploy the latest Code.gs.');
    }
  })();

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(
          `Lead sheet request timed out after ${Math.round(timeoutMs / 1000)}s. Pull to refresh.`,
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function fetchJsonWithRetry<T>(
  url: string,
  timeoutMs: number,
  retries = 1,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetchJson<T>(url, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt < retries && isCanceledOrTimeout(error)) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}

function mapApiLeads(apiLeads: NonNullable<LeadsApiResponse['leads']>): SheetLead[] {
  return apiLeads
    .filter((lead) => lead.phoneNumber)
    .map((lead) => {
      const raw = { ...(lead.raw ?? {}) };
      const phoneNumber = lead.phoneNumber!.trim();
      const sheetName = lead.sheetName?.trim() || raw['Sheet Tab']?.trim() || undefined;

      if (sheetName && !raw['Sheet Tab']) {
        raw['Sheet Tab'] = sheetName;
      }

      const displayName =
        pickRawValue(raw, [
          'full name',
          'fullname',
          'company_name',
          'company name',
          'Name',
          'name',
        ]) ||
        lead.name?.trim() ||
        'Unknown';

      return {
        rowNumber: lead.rowNumber ?? 0,
        sheetName,
        name: displayName,
        phoneNumber,
        normalizedPhone: normalizePhoneNumber(phoneNumber),
        raw,
      };
    })
    .filter((lead) => lead.normalizedPhone.length >= 8);
}

function mergeHeaders(parts: string[][]): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const headers of parts) {
    for (const header of headers) {
      if (header && !seen.has(header)) {
        seen.add(header);
        merged.push(header);
      }
    }
  }
  return merged;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current], current);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () =>
    runWorker(),
  );
  await Promise.all(runners);
  return results;
}

async function saveLeadsCache(result: FetchLeadsResult): Promise<void> {
  try {
    await AsyncStorage.setItem(
      LEADS_CACHE_KEY,
      JSON.stringify({
        savedAt: Date.now(),
        ...result,
        fromCache: undefined,
      }),
    );
  } catch (error) {
    console.warn('[Leads] Failed to cache leads', error);
  }
}

export async function clearLeadsCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LEADS_CACHE_KEY);
  } catch (error) {
    console.warn('[Leads] Failed to clear leads cache', error);
  }
}

export async function loadLeadsCache(): Promise<FetchLeadsResult | null> {
  try {
    const raw = await AsyncStorage.getItem(LEADS_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as FetchLeadsResult & { savedAt?: number };
    if (!parsed.leads?.length) {
      return null;
    }

    return {
      leads: parsed.leads,
      sheetHeaders: parsed.sheetHeaders ?? [],
      tabsLoaded: parsed.tabsLoaded ?? [],
      fromCache: true,
    };
  } catch {
    return null;
  }
}

async function fetchSingleTab(gid?: string, sheetName?: string): Promise<FetchLeadsResult> {
  const params: Record<string, string> = { all: '0' };
  if (gid) {
    params.gid = gid;
  } else if (sheetName) {
    params.sheet = sheetName;
  } else {
    throw new Error('Tab gid or sheet name is required.');
  }

  const url = buildUrl('leads', params);
  if (!url) {
    throw new Error('Webhook URL is missing.');
  }

  const result = await fetchJsonWithRetry<LeadsApiResponse>(url, TAB_TIMEOUT_MS, 1);
  if (result.success === false) {
    throw new Error(result.error || 'Leads API returned success=false.');
  }

  const leads = mapApiLeads(result.leads ?? []);
  const sheetHeaders = result.headers?.filter((header) => !!header.trim()) ?? [];
  const tabsLoaded =
    result.tabs?.map((tab) => tab.sheet).filter((name): name is string => !!name) ??
    (leads[0]?.sheetName ? [leads[0].sheetName] : []);

  return { leads, sheetHeaders, tabsLoaded };
}

async function fetchAllTabsCombined(): Promise<FetchLeadsResult> {
  const allUrl = buildUrl('leads', { all: '1' });
  if (!allUrl) {
    throw new Error('Webhook URL is missing.');
  }

  const result = await fetchJsonWithRetry<LeadsApiResponse>(allUrl, ALL_TABS_TIMEOUT_MS, 1);
  if (result.success === false) {
    throw new Error(result.error || 'Leads API returned success=false.');
  }

  const leads = mapApiLeads(result.leads ?? []);
  return {
    leads,
    sheetHeaders: result.headers?.filter((header) => !!header.trim()) ?? [],
    tabsLoaded:
      result.tabs?.map((tab) => tab.sheet).filter((name): name is string => !!name) ?? [],
  };
}

async function fetchAllTabsInParallel(
  onProgress?: LeadsProgressCallback,
): Promise<FetchLeadsResult> {
  const tabsUrl = buildUrl('tabs');
  if (!tabsUrl) {
    throw new Error('Webhook URL is missing.');
  }

  try {
    const listed = await fetchJsonWithRetry<TabsApiResponse>(tabsUrl, TABS_TIMEOUT_MS, 1);
    if (listed.success === false) {
      throw new Error(listed.error || 'Tabs API failed.');
    }

    const tabs = listed.tabs ?? [];
    if (tabs.length === 0) {
      return { leads: [], sheetHeaders: [], tabsLoaded: [] };
    }

    // Load tabs one-by-one and report progress so UI can update without freezing
    const allLeads: SheetLead[] = [];
    const headerParts: string[][] = [];
    const tabsLoaded: string[] = [];

    for (const tab of tabs) {
      if (!tab.gid && !tab.sheet) {
        continue;
      }
      try {
        const part = await fetchSingleTab(tab.gid, tab.sheet);
        allLeads.push(...part.leads);
        headerParts.push(part.sheetHeaders);
        tabsLoaded.push(...part.tabsLoaded);
        onProgress?.({
          leads: [...allLeads],
          sheetHeaders: mergeHeaders(headerParts),
          tabsLoaded: [...tabsLoaded],
          loadedCount: allLeads.length,
        });
        // Yield to JS thread between tabs
        await new Promise((resolve) => setTimeout(resolve, 0));
      } catch (error) {
        console.warn(`[Leads] Failed tab ${tab.sheet ?? tab.gid}`, error);
      }
    }

    if (allLeads.length === 0) {
      return fetchAllTabsCombined();
    }

    const sheetHeaders = mergeHeaders(headerParts);
    if (!sheetHeaders.includes('Sheet Tab') && allLeads.some((lead) => lead.sheetName)) {
      sheetHeaders.push('Sheet Tab');
    }

    return {
      leads: allLeads,
      sheetHeaders,
      tabsLoaded: tabsLoaded.filter((name, index, arr) => name && arr.indexOf(name) === index),
    };
  } catch {
    return fetchAllTabsCombined();
  }
}

let inFlightFetch: Promise<FetchLeadsResult> | null = null;

export type FetchLeadsOptions = {
  /** Skip shared in-flight request, clear local cache, always hit the sheet. */
  forceRefresh?: boolean;
};

export async function fetchLeadsFromGoogleSheet(
  onProgress?: LeadsProgressCallback,
  options?: FetchLeadsOptions,
): Promise<FetchLeadsResult> {
  if (!getWebhookBaseUrl()) {
    throw new Error(
      'Set EXPO_PUBLIC_GOOGLE_SHEETS_WEBHOOK_URL to your Apps Script /exec URL (not the spreadsheet link).',
    );
  }

  const forceRefresh = options?.forceRefresh === true;

  if (forceRefresh) {
    inFlightFetch = null;
    await clearLeadsCache();
  } else if (inFlightFetch && !onProgress) {
    return inFlightFetch;
  }

  const run = async () => {
    const gid = process.env.EXPO_PUBLIC_GOOGLE_SHEETS_LEADS_GID?.trim();
    const sheetName = process.env.EXPO_PUBLIC_GOOGLE_SHEETS_LEADS_SHEET_NAME?.trim();

    let result: FetchLeadsResult;

    if (gid || sheetName) {
      result = await fetchSingleTab(gid, sheetName);
      onProgress?.({ ...result, loadedCount: result.leads.length });
    } else {
      result = await fetchAllTabsInParallel(onProgress);
    }

    // Keep local cache in sync so counts stay fresh after pull-to-refresh.
    // Skip only when the payload is huge (can freeze AsyncStorage on some devices).
    if (result.leads.length <= 4000) {
      await saveLeadsCache(result);
    } else if (forceRefresh) {
      await clearLeadsCache();
    }

    return result;
  };

  if (!onProgress && !forceRefresh) {
    inFlightFetch = run();
    try {
      return await inFlightFetch;
    } finally {
      inFlightFetch = null;
    }
  }

  return run();
}
