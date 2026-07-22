import {
  analyzeLeads,
  filterLeads,
} from '@/services/leadAnalysisService';
import { loadCallHistory } from '@/services/callLogService';
import { exportLeadAnalysisToExcel } from '@/services/exportService';
import {
  fetchLeadsFromGoogleSheet,
  isLeadsSheetConfigured,
  loadLeadsCache,
} from '@/services/leadsSheetService';
import { resolveActiveSheetConfig } from '@/services/sheetsConfigService';
import type { LeadAnalysisResult, LeadFilter, LeadWithAnalysis } from '@/types/lead';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/** Yield to the UI thread before heavy work (InteractionManager is deprecated). */
function waitForIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => resolve(), { timeout: 500 });
    } else {
      setTimeout(resolve, 0);
    }
  });
}

export function useLeadAnalysis(enabled: boolean) {
  const [analysis, setAnalysis] = useState<LeadAnalysisResult | null>(null);
  const [filter, setFilter] = useState<LeadFilter>('called');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const callsRef = useRef<Awaited<ReturnType<typeof loadCallHistory>> | null>(null);

  const applyLeads = useCallback(
    async (
      sheetLeads: Awaited<ReturnType<typeof fetchLeadsFromGoogleSheet>>['leads'],
      sheetHeaders: string[],
      tabsLoaded: string[],
      fromCache?: boolean,
      loadedCount?: number,
      sheetHeading?: string,
    ) => {
      if (!callsRef.current) {
        callsRef.current = await loadCallHistory(300);
      }

      await waitForIdle();

      const nextAnalysis = analyzeLeads(sheetLeads, callsRef.current, sheetHeaders);
      setAnalysis(nextAnalysis);

      const tabsNote =
        tabsLoaded.length > 0 ? ` across ${tabsLoaded.length} sheet tab(s)` : '';
      const countLabel = loadedCount ?? nextAnalysis.summary.uniqueLeads;
      const sheetNote = sheetHeading ? ` · ${sheetHeading}` : '';

      setStatusMessage(
        fromCache
          ? `Showing cached leads (${nextAnalysis.summary.uniqueLeads} unique)${sheetNote}. Refreshing…`
          : `Loaded ${countLabel} sheet rows → ${nextAnalysis.summary.uniqueLeads} unique numbers${tabsNote}${sheetNote}. Dialed: ${nextAnalysis.summary.calledCount}.`,
      );
    },
    [],
  );

  const refreshAnalysis = useCallback(async () => {
    if (!enabled) {
      return;
    }

    if (!isLeadsSheetConfigured()) {
      setError(
        'Set EXPO_PUBLIC_GOOGLE_SHEETS_WEBHOOK_URL to the Apps Script /exec URL, then rebuild.',
      );
      return;
    }

    setIsRefreshing(true);
    setError(null);
    setLoadProgress(0);
    setStatusMessage('Refreshing leads from Google Sheet…');
    callsRef.current = null;

    try {
      const result = await fetchLeadsFromGoogleSheet(
        async (partial) => {
          setLoadProgress(partial.loadedCount);
          await applyLeads(
            partial.leads,
            partial.sheetHeaders,
            partial.tabsLoaded,
            false,
            partial.loadedCount,
            partial.sheetHeading,
          );
        },
        { forceRefresh: true },
      );
      await applyLeads(
        result.leads,
        result.sheetHeaders,
        result.tabsLoaded,
        false,
        undefined,
        result.sheetHeading,
      );
      setLoadProgress(null);
    } catch (refreshError) {
      console.error('[LeadAnalysis] Refresh failed', refreshError);
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : 'Failed to load leads from Google Sheets.',
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setLoadProgress(null);
    }
  }, [enabled, applyLeads]);

  useEffect(() => {
    if (!enabled || !isLeadsSheetConfigured()) {
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      setError(null);

      try {
        const cached = await loadLeadsCache();
        let useCache = Boolean(cached?.leads?.length);
        if (useCache && cached) {
          try {
            const active = await resolveActiveSheetConfig();
            const activeId = active?.sheet_link_id;
            if (
              activeId &&
              cached.spreadsheetId &&
              cached.spreadsheetId !== activeId
            ) {
              useCache = false;
            }
          } catch {
            // Keep cache if Firebase sheet lookup fails offline.
          }
        }

        if (!cancelled && useCache && cached) {
          await applyLeads(
            cached.leads,
            cached.sheetHeaders,
            cached.tabsLoaded,
            true,
            undefined,
            cached.sheetHeading,
          );
          setIsLoading(false);
          setIsRefreshing(true);
        }

        const fresh = await fetchLeadsFromGoogleSheet(async (partial) => {
          if (cancelled) {
            return;
          }
          setLoadProgress(partial.loadedCount);
          await applyLeads(
            partial.leads,
            partial.sheetHeaders,
            partial.tabsLoaded,
            false,
            partial.loadedCount,
            partial.sheetHeading,
          );
          setIsLoading(false);
          setIsRefreshing(true);
        });

        if (!cancelled) {
          await applyLeads(
            fresh.leads,
            fresh.sheetHeaders,
            fresh.tabsLoaded,
            false,
            undefined,
            fresh.sheetHeading,
          );
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          console.error('[LeadAnalysis] Load failed', loadError);
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Failed to load leads from Google Sheets.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsRefreshing(false);
          setLoadProgress(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, applyLeads]);

  const filteredLeads = useMemo<LeadWithAnalysis[]>(() => {
    if (!analysis) {
      return [];
    }

    return filterLeads(analysis.leads, filter);
  }, [analysis, filter]);

  const exportAnalysis = useCallback(async () => {
    if (!analysis) {
      setError('Load lead analysis before exporting.');
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      await exportLeadAnalysisToExcel(analysis);
      setStatusMessage(
        'Exported dialed numbers only (matched to lead sheet). Open the CSV in Excel.',
      );
    } catch (exportError) {
      console.error('[LeadAnalysis] Export failed', exportError);
      setError(
        exportError instanceof Error ? exportError.message : 'Failed to export analysis.',
      );
    } finally {
      setIsExporting(false);
    }
  }, [analysis]);

  return {
    analysis,
    filteredLeads,
    filter,
    setFilter,
    isLoading,
    isRefreshingLeads: isRefreshing,
    isExporting,
    error,
    statusMessage,
    loadProgress,
    leadsConfigured: isLeadsSheetConfigured(),
    refreshAnalysis,
    exportAnalysis,
  };
}
