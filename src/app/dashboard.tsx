import { LeadInsightsPanel } from '@/components/LeadInsightsPanel';
import { useAuth } from '@/context/AuthContext';
import { useCallTracker } from '@/hooks/useCallTracker';
import { useLeadAnalysis } from '@/hooks/useLeadAnalysis';
import type { LeadCallStatus, LeadFilter } from '@/types/lead';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type DashboardTab = 'activity' | 'insights';

const FILTERS: Array<{ id: LeadFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'not_called', label: 'Not Called' },
  { id: 'called', label: 'Called' },
  { id: 'connected', label: 'Connected' },
  { id: 'missed', label: 'Missed' },
];

function formatCallTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function getStatusLabel(status: LeadCallStatus): string {
  switch (status) {
    case 'not_called':
      return 'Not Called';
    case 'called':
      return 'Called';
    case 'connected':
      return 'Connected';
    case 'missed':
      return 'Missed';
    default:
      return status;
  }
}

function getStatusStyle(status: LeadCallStatus) {
  switch (status) {
    case 'connected':
      return styles.statusConnected;
    case 'called':
      return styles.statusCalled;
    case 'missed':
      return styles.statusMissed;
    default:
      return styles.statusPending;
  }
}

export default function Dashboard() {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<DashboardTab>('activity');
  const onCallCompletedRef = useRef<(() => void) | null>(null);
  const {
    isAndroid,
    permissionsGranted,
    permissionError,
    requestPermissions,
    callState,
    activeCall,
    activeCallLabel,
    recentCalls,
    callNotice,
    isRefreshing,
    refreshRecentCalls,
  } = useCallTracker({ onCallCompletedRef });

  const {
    analysis,
    filteredLeads,
    filter,
    setFilter,
    isLoading: isLeadLoading,
    isRefreshingLeads,
    isExporting,
    error: leadError,
    statusMessage: leadStatusMessage,
    loadProgress,
    leadsConfigured,
    refreshAnalysis,
    exportAnalysis,
  } = useLeadAnalysis(isAndroid && permissionsGranted);

  const [leadPageSize, setLeadPageSize] = useState(40);

  onCallCompletedRef.current = refreshAnalysis;

  const isRefreshingAll = isRefreshing || isLeadLoading || isRefreshingLeads;
  const summary = analysis?.summary;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={isRefreshingAll}
            onRefresh={() => {
              void refreshRecentCalls();
              void refreshAnalysis();
            }}
          />
        }>
        <View style={styles.headerFlex}>
          <Text style={styles.header}>Dashboard</Text>
          <TouchableOpacity style={styles.button} onPress={logout} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Logout</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'activity' && styles.tabButtonActive]}
            onPress={() => setActiveTab('activity')}
            activeOpacity={0.85}>
            <Text style={[styles.tabText, activeTab === 'activity' && styles.tabTextActive]}>
              Activity
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'insights' && styles.tabButtonActive]}
            onPress={() => setActiveTab('insights')}
            activeOpacity={0.85}>
            <Text style={[styles.tabText, activeTab === 'insights' && styles.tabTextActive]}>
              Insights
            </Text>
          </TouchableOpacity>
        </View>

        {!isAndroid ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Android only</Text>
            <Text style={styles.bannerText}>
              Lead analysis, call tracking, and export are available on Android devices.
            </Text>
          </View>
        ) : null}

        {isAndroid && !permissionsGranted ? (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Permissions required</Text>
            <Text style={styles.bannerText}>
              Allow call log and phone state access to fetch leads, track calls, and export
              analysis.
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                void requestPermissions();
              }}
              activeOpacity={0.85}>
              <Text style={styles.primaryButtonText}>Grant permissions</Text>
            </TouchableOpacity>
            {permissionError ? <Text style={styles.errorText}>{permissionError}</Text> : null}
          </View>
        ) : null}

        {isAndroid && permissionsGranted && activeCall ? (
          <View style={styles.liveCard}>
            <View style={styles.liveHeader}>
              <Text style={styles.liveTitle}>Live call</Text>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>{callState}</Text>
              </View>
            </View>
            <Text style={styles.liveNumber}>{activeCall.phoneNumber}</Text>
            <Text style={styles.liveDuration}>{activeCallLabel}</Text>
            <Text style={styles.liveHint}>Duration updates while the call is active.</Text>
          </View>
        ) : null}

        {callNotice ? (
          <View style={styles.syncBanner}>
            <Text style={styles.syncText}>{callNotice}</Text>
          </View>
        ) : null}

        {leadStatusMessage ? (
          <View style={styles.syncBanner}>
            <Text style={styles.syncText}>{leadStatusMessage}</Text>
            {loadProgress != null ? (
              <Text style={[styles.syncText, { marginTop: 4 }]}>
                Loading… {loadProgress.toLocaleString()} rows
              </Text>
            ) : null}
            {isRefreshingLeads ? (
              <ActivityIndicator color="#074C70" style={{ marginTop: 8 }} />
            ) : null}
          </View>
        ) : null}

        {leadError ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{leadError}</Text>
          </View>
        ) : null}

        {isAndroid && permissionsGranted && !leadsConfigured ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              Add EXPO_PUBLIC_GOOGLE_SHEETS_WEBHOOK_URL (/exec) in .env. Leave
              EXPO_PUBLIC_GOOGLE_SHEETS_LEADS_GID empty to load every sheet tab.
              Deploy Apps Script as Execute as: Me, Who has access: Anyone.
            </Text>
          </View>
        ) : null}

        {activeTab === 'insights' ? (
          <View style={styles.section}>
            {isLeadLoading && !analysis ? (
              <ActivityIndicator color="#2E5CFF" style={styles.loader} />
            ) : null}
            {analysis ? <LeadInsightsPanel leads={analysis.leads} /> : null}
            {!isLeadLoading && !analysis ? (
              <Text style={styles.emptyText}>Load leads to see insights.</Text>
            ) : null}
          </View>
        ) : null}

        {activeTab === 'activity' && summary ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Lead Analysis</Text>
              <TouchableOpacity
                style={[styles.exportButton, isExporting && styles.buttonDisabled]}
                onPress={() => {
                  void exportAnalysis();
                }}
                disabled={isExporting}
                activeOpacity={0.85}>
                <Text style={styles.exportButtonText}>
                  {isExporting ? 'Exporting...' : 'Export Excel'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{summary.totalRows}</Text>
                <Text style={styles.statLabel}>Sheet Rows</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{summary.uniqueLeads}</Text>
                <Text style={styles.statLabel}>Unique Numbers</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{summary.calledCount}</Text>
                <Text style={styles.statLabel}>Called</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{summary.notCalledCount}</Text>
                <Text style={styles.statLabel}>Not Called</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{summary.connectedCount}</Text>
                <Text style={styles.statLabel}>Connected</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{summary.duplicateRows}</Text>
                <Text style={styles.statLabel}>Duplicates Removed</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
              {FILTERS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.filterChip, filter === item.id && styles.filterChipActive]}
                  onPress={() => {
                    setFilter(item.id);
                    setLeadPageSize(40);
                  }}
                  activeOpacity={0.85}>
                  <Text
                    style={[
                      styles.filterChipText,
                      filter === item.id && styles.filterChipTextActive,
                    ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {isLeadLoading && filteredLeads.length === 0 ? (
              <ActivityIndicator color="#2E5CFF" style={styles.loader} />
            ) : null}

            {!isLeadLoading && filteredLeads.length === 0 ? (
              <Text style={styles.emptyText}>No leads found for this filter.</Text>
            ) : null}

            {filteredLeads.length > 0 ? (
              <Text style={styles.emptyText}>
                Showing {Math.min(leadPageSize, filteredLeads.length)} of{' '}
                {filteredLeads.length.toLocaleString()}
                {filter === 'all' ? ' (tip: use Dialed for a faster list)' : ''}
              </Text>
            ) : null}

            {filteredLeads.slice(0, leadPageSize).map((lead) => {
              const company =
                lead.raw.company_name ||
                Object.entries(lead.raw).find(
                  ([key]) => key.toLowerCase() === 'company_name',
                )?.[1];
              const city =
                lead.raw.city ||
                Object.entries(lead.raw).find(([key]) => key.toLowerCase() === 'city')?.[1];

              return (
                <View
                  key={`${lead.sheetName ?? 'sheet'}-${lead.rowNumber}-${lead.normalizedPhone}`}
                  style={styles.leadRow}>
                  <View style={styles.callDetails}>
                    <Text style={styles.callName}>{lead.name}</Text>
                    <Text style={styles.callNumber}>{lead.phoneNumber}</Text>
                    {company ? (
                      <Text style={styles.callMeta} numberOfLines={1}>
                        {company}
                        {city ? ` · ${city}` : ''}
                      </Text>
                    ) : null}
                    {lead.sheetName ? (
                      <Text style={styles.callMeta}>Tab: {lead.sheetName}</Text>
                    ) : null}
                    <Text style={styles.callMeta}>
                      {lead.callCount} call(s)
                      {lead.lastCalledAt
                        ? ` · Last: ${formatCallTime(lead.lastCalledAt)}`
                        : ' · Not called yet'}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, getStatusStyle(lead.status)]}>
                    <Text style={styles.statusBadgeText}>{getStatusLabel(lead.status)}</Text>
                  </View>
                </View>
              );
            })}

            {leadPageSize < filteredLeads.length ? (
              <TouchableOpacity
                style={styles.exportButton}
                onPress={() => setLeadPageSize((size) => size + 40)}
                activeOpacity={0.85}>
                <Text style={styles.exportButtonText}>
                  Show more ({filteredLeads.length - leadPageSize} left)
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {activeTab === 'activity' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Device Calls</Text>

            {isRefreshing && recentCalls.length === 0 ? (
              <ActivityIndicator color="#2E5CFF" style={styles.loader} />
            ) : null}

            {!isRefreshing && recentCalls.length === 0 ? (
              <Text style={styles.emptyText}>
                {permissionsGranted
                  ? 'No calls found yet. Make or receive a call to start tracking.'
                  : 'Grant permissions to load your call history.'}
              </Text>
            ) : null}

            {recentCalls.map((call) => (
              <View key={call.id} style={styles.callRow}>
                <View style={styles.callDetails}>
                  <Text style={styles.callName}>{call.contactName || 'Unknown contact'}</Text>
                  <Text style={styles.callNumber}>{call.phoneNumber}</Text>
                  <Text style={styles.callMeta}>
                    {formatCallTime(call.timestamp)} · {formatDuration(call.durationSeconds)}
                  </Text>
                </View>
                <Text style={styles.callStatus}>{call.callType}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6FA' },
  header: { fontSize: 24, fontWeight: '700', color: '#1A1A1A' },
  headerFlex: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 16,
  },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: '#E8EEF2',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#074C70',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667085',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2E5CFF',
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  filters: {
    marginBottom: 12,
  },
  filterChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  filterChipActive: {
    backgroundColor: '#074C70',
    borderColor: '#074C70',
  },
  filterChipText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  leadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  callRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  callDetails: {
    flex: 1,
    paddingRight: 12,
  },
  callName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  callNumber: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  callMeta: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  callStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2E5CFF',
    textTransform: 'capitalize',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusPending: {
    backgroundColor: '#98A2B3',
  },
  statusCalled: {
    backgroundColor: '#2E5CFF',
  },
  statusConnected: {
    backgroundColor: '#12B76A',
  },
  statusMissed: {
    backgroundColor: '#F79009',
  },
  button: {
    backgroundColor: '#208AEF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  exportButton: {
    backgroundColor: '#074C70',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  primaryButton: {
    marginTop: 12,
    backgroundColor: '#074C70',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  banner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 6,
  },
  bannerText: {
    color: '#666',
    lineHeight: 20,
  },
  liveCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#074C70',
    borderRadius: 16,
    padding: 18,
  },
  liveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  liveTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  liveBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  liveNumber: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
  },
  liveDuration: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '700',
    marginTop: 8,
  },
  liveHint: {
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
  },
  syncBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#E8F4FF',
    borderRadius: 10,
    padding: 12,
  },
  syncText: {
    color: '#074C70',
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FEE4E2',
    borderRadius: 10,
    padding: 12,
  },
  errorBannerText: {
    color: '#B42318',
  },
  warningBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#FFF7E6',
    borderRadius: 10,
    padding: 12,
  },
  warningText: {
    color: '#8A5A00',
    lineHeight: 20,
  },
  errorText: {
    color: '#B00020',
    marginTop: 8,
  },
  emptyText: {
    color: '#666',
    marginBottom: 8,
  },
  loader: {
    marginVertical: 16,
  },
});
