import type { LeadCallStatus, LeadWithAnalysis } from '@/types/lead';
import { SHEET_LEAD_STATUSES } from '@/types/lead';
import {
  filterLeadsForInsights,
  formatMinutes,
  getDateRangePreset,
  getLeadSheetStatus,
  type DateRangePreset,
} from '@/utils/leadInsights';
import { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const SHEET_STATUS_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All statuses' },
  ...SHEET_LEAD_STATUSES.map((status) => ({ id: status, label: status })),
];

const DATE_PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'month', label: 'This month' },
];

const SHEET_STATUS_COLORS = [
  '#F2C94C',
  '#C0392B',
  '#F5B7B1',
  '#D7BDE2',
  '#A04000',
  '#8E44AD',
  '#5D6D7E',
  '#27AE60',
  '#F5CBA7',
  '#BFC9CA',
  '#6C3483',
  '#AEB6BF',
  '#F5B7B1',
  '#148F77',
  '#F5B7B1',
  '#566573',
  '#D5D8DC',
  '#F5B7B1',
  '#566573',
  '#D7BDE2',
  '#1ABC9C',
  '#6E2C00',
];

function getSheetStatusColor(status: string): string {
  const index = SHEET_LEAD_STATUSES.findIndex(
    (item) => item.toLowerCase() === status.toLowerCase(),
  );
  if (index >= 0) {
    return SHEET_STATUS_COLORS[index % SHEET_STATUS_COLORS.length];
  }
  return '#98A2B3';
}

const DETAIL_FIELDS = [
  'company_name',
  'full name',
  'phone_number',
  'email',
  'city',
  'Date',
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
  'what_is_your_turnover?',
  'what_is_your_cibil_score?',
  'how_old_is_your_business?',
  'what_is_your_loan_requirement?',
  'Sheet Tab',
] as const;

interface LeadInsightsPanelProps {
  leads: LeadWithAnalysis[];
}

function getRawField(lead: LeadWithAnalysis, header: string): string {
  if (lead.raw[header]?.trim()) {
    return lead.raw[header].trim();
  }

  const match = Object.entries(lead.raw).find(
    ([key]) => key.toLowerCase() === header.toLowerCase(),
  );
  return match?.[1]?.trim() ?? '';
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

function formatCallTime(timestamp: number | null): string {
  if (!timestamp) {
    return 'Not called yet';
  }
  return new Date(timestamp).toLocaleString();
}

export function LeadInsightsPanel({ leads }: LeadInsightsPanelProps) {
  const [sheetStatusFilter, setSheetStatusFilter] = useState<string>('Active');
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [listLimit, setListLimit] = useState(30);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [dropdownAnchor, setDropdownAnchor] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    openUpward: false,
    maxHeight: 240,
  });
  const dropdownTriggerRef = useRef<View>(null);

  const dateRange = useMemo(() => getDateRangePreset(datePreset), [datePreset]);
  const selectedSheetStatusLabel =
    SHEET_STATUS_OPTIONS.find((item) => item.id === sheetStatusFilter)?.label ??
    'All statuses';

  const openStatusDropdown = () => {
    dropdownTriggerRef.current?.measureInWindow((x, y, width, height) => {
      const screen = Dimensions.get('window');
      const estimatedMenuHeight = Math.min(SHEET_STATUS_OPTIONS.length * 44 + 8, 360);
      const spaceBelow = screen.height - (y + height) - 12;
      const spaceAbove = y - 12;
      const openUpward = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;
      const available = openUpward ? spaceAbove : spaceBelow;

      setDropdownAnchor({
        x,
        y,
        width,
        height,
        openUpward,
        maxHeight: Math.max(160, Math.min(estimatedMenuHeight, available)),
      });
      setStatusDropdownOpen(true);
    });
  };

  const setSheetStatusAndClose = (next: string) => {
    setSheetStatusFilter(next);
    setListLimit(30);
    setStatusDropdownOpen(false);
  };

  // Details + charts follow sheet Status (+ date), not call result
  const filtered = useMemo(() => {
    const rows = filterLeadsForInsights(leads, 'all', dateRange, sheetStatusFilter);
    return [...rows].sort((left, right) => {
      const leftStatus = getLeadSheetStatus(left);
      const rightStatus = getLeadSheetStatus(right);
      if (leftStatus !== rightStatus) {
        return leftStatus.localeCompare(rightStatus);
      }
      return left.name.localeCompare(right.name);
    });
  }, [leads, dateRange, sheetStatusFilter]);

  const sheetBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const lead of filtered) {
      const status = getLeadSheetStatus(lead) || 'No status';
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([status, count]) => ({
        status,
        count,
        color: getSheetStatusColor(status),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filtered]);

  const maxCount = Math.max(1, ...sheetBreakdown.map((item) => item.count));
  const total = filtered.length;
  const dialed = filtered.filter((lead) => lead.status !== 'not_called').length;
  const connected = filtered.filter((lead) => lead.status === 'connected').length;
  const talkSeconds = filtered.reduce((sum, lead) => sum + lead.totalDurationSeconds, 0);
  const connectionRate = dialed > 0 ? Math.round((connected / dialed) * 100) : 0;

  const listTitle =
    sheetStatusFilter === 'all' ? 'Lead details by sheet status' : `${sheetStatusFilter}`;

  return (
    <View>
      <Text style={styles.sectionTitle}>Insights</Text>
      <Text style={styles.subtitle}>
        Lead details follow sheet Status. Use date range and status dropdown to filter.
      </Text>

      <Text style={styles.filterLabel}>Date range</Text>
      <View style={styles.chipRow}>
        {DATE_PRESETS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.chip, datePreset === item.id && styles.chipActive]}
            onPress={() => setDatePreset(item.id)}
            activeOpacity={0.85}>
            <Text style={[styles.chipText, datePreset === item.id && styles.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.filterLabel}>Sheet status</Text>
      <View ref={dropdownTriggerRef} collapsable={false} style={styles.dropdownWrap}>
        <TouchableOpacity
          style={styles.dropdownTrigger}
          activeOpacity={0.85}
          onPress={openStatusDropdown}>
          <Text style={styles.dropdownTriggerText} numberOfLines={1}>
            {selectedSheetStatusLabel}
          </Text>
          <Text style={styles.dropdownChevron}>▼</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={statusDropdownOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusDropdownOpen(false)}>
        <View style={styles.dropdownOverlay}>
          <Pressable
            style={StyleSheet.absoluteFillObject}
            onPress={() => setStatusDropdownOpen(false)}
          />
          <View
            style={[
              styles.dropdownMenu,
              {
                left: dropdownAnchor.x,
                width: dropdownAnchor.width,
                maxHeight: dropdownAnchor.maxHeight,
                ...(dropdownAnchor.openUpward
                  ? { bottom: Dimensions.get('window').height - dropdownAnchor.y + 4 }
                  : { top: dropdownAnchor.y + dropdownAnchor.height + 4 }),
              },
            ]}>
            <ScrollView
              bounces={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled">
              {SHEET_STATUS_OPTIONS.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.dropdownOption,
                    index === SHEET_STATUS_OPTIONS.length - 1 && styles.dropdownOptionLast,
                    sheetStatusFilter === item.id && styles.dropdownOptionActive,
                  ]}
                  activeOpacity={0.85}
                  onPress={() => setSheetStatusAndClose(item.id)}>
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      sheetStatusFilter === item.id && styles.dropdownOptionTextActive,
                    ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>Leads</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{dialed}</Text>
          <Text style={styles.statLabel}>Dialed</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{connectionRate}%</Text>
          <Text style={styles.statLabel}>Connect</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatMinutes(talkSeconds)}</Text>
          <Text style={styles.statLabel}>Talk time</Text>
        </View>
      </View>

      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Sheet status breakdown</Text>
        {total === 0 ? (
          <Text style={styles.emptyText}>No leads match these filters.</Text>
        ) : (
          sheetBreakdown.map((item) => {
            const widthPercent = (item.count / maxCount) * 100;
            return (
              <TouchableOpacity
                key={item.status}
                style={styles.barRow}
                activeOpacity={0.8}
                onPress={() => {
                  const known = SHEET_LEAD_STATUSES.find(
                    (status) => status.toLowerCase() === item.status.toLowerCase(),
                  );
                  setSheetStatusFilter(known ?? 'all');
                }}>
                <View style={styles.barLabelCol}>
                  <Text style={styles.barLabel}>{item.status}</Text>
                  <Text style={styles.barCount}>{item.count}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.max(item.count > 0 ? 6 : 0, widthPercent)}%`,
                        backgroundColor: item.color,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            );
          })
        )}
        <Text style={styles.hintText}>Tap a bar to filter details by that sheet status</Text>
      </View>

      <View style={styles.detailsHeader}>
        <Text style={styles.chartTitle}>{listTitle}</Text>
        <Text style={styles.detailsCount}>{filtered.length}</Text>
      </View>

      {filtered.length === 0 ? (
        <Text style={styles.emptyText}>
          No leads for this date range and sheet status.
        </Text>
      ) : (
        <>
          <Text style={styles.hintText}>
            Showing {Math.min(listLimit, filtered.length)} of {filtered.length.toLocaleString()}
          </Text>
          {filtered.slice(0, listLimit).map((lead) => {
          const key = `${lead.sheetName ?? 'sheet'}-${lead.rowNumber}-${lead.normalizedPhone}`;
          const expanded = expandedKey === key;
          const company = getRawField(lead, 'company_name');
          const city = getRawField(lead, 'city');
          const sheetStatus = getLeadSheetStatus(lead) || 'No status';
          const sheetTab = lead.sheetName || getRawField(lead, 'Sheet Tab');
          const detailRows = DETAIL_FIELDS.map((field) => ({
            field,
            value: getRawField(lead, field),
          })).filter((row) => row.value);

          return (
            <TouchableOpacity
              key={key}
              style={styles.leadCard}
              activeOpacity={0.9}
              onPress={() => setExpandedKey(expanded ? null : key)}>
              <View style={styles.leadTop}>
                <View style={styles.leadMain}>
                  <Text style={styles.leadName}>{lead.name}</Text>
                  <Text style={styles.leadPhone}>{lead.phoneNumber}</Text>
                  {company ? (
                    <Text style={styles.leadMeta} numberOfLines={1}>
                      {company}
                      {city ? ` · ${city}` : ''}
                    </Text>
                  ) : null}
                  {sheetTab ? (
                    <Text style={styles.leadMeta}>Tab: {sheetTab}</Text>
                  ) : null}
                  <Text style={styles.leadMeta}>
                    Call: {getStatusLabel(lead.status)}
                    {lead.callCount > 0
                      ? ` · ${lead.callCount} call(s) · ${formatCallTime(lead.lastCalledAt)}`
                      : ' · Not dialed yet'}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getSheetStatusColor(sheetStatus) },
                  ]}>
                  <Text style={styles.statusBadgeText} numberOfLines={2}>
                    {sheetStatus}
                  </Text>
                </View>
              </View>

              <Text style={styles.expandHint}>
                {expanded ? 'Hide details ▲' : 'View lead details ▼'}
              </Text>

              {expanded ? (
                <View style={styles.detailBlock}>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Sheet status</Text>
                    <Text style={styles.detailValue}>{sheetStatus}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Call status</Text>
                    <Text style={styles.detailValue}>{getStatusLabel(lead.status)}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Times called</Text>
                    <Text style={styles.detailValue}>{lead.callCount}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailKey}>Talk time</Text>
                    <Text style={styles.detailValue}>
                      {formatMinutes(lead.totalDurationSeconds)}
                    </Text>
                  </View>
                  {detailRows.map((row) => (
                    <View key={row.field} style={styles.detailRow}>
                      <Text style={styles.detailKey}>{row.field}</Text>
                      <Text style={styles.detailValue}>{row.value}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </TouchableOpacity>
          );
          })}
          {listLimit < filtered.length ? (
            <TouchableOpacity
              style={styles.dropdownTrigger}
              onPress={() => setListLimit((size) => size + 30)}
              activeOpacity={0.85}>
              <Text style={styles.dropdownTriggerText}>
                Show more ({filtered.length - listLimit} left)
              </Text>
            </TouchableOpacity>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    marginBottom: 14,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#667085',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 14,
    gap: 8,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E4E7EC',
  },
  chipActive: {
    backgroundColor: '#074C70',
    borderColor: '#074C70',
  },
  chipText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statBox: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#074C70',
  },
  statLabel: {
    fontSize: 12,
    color: '#667085',
    marginTop: 4,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 14,
  },
  barRow: {
    marginBottom: 12,
  },
  barLabelCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  barLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#344054',
  },
  barCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  barTrack: {
    height: 12,
    borderRadius: 999,
    backgroundColor: '#F2F4F7',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  hintText: {
    fontSize: 12,
    color: '#98A2B3',
    marginTop: 4,
  },
  rateTrack: {
    height: 14,
    borderRadius: 999,
    backgroundColor: '#F2F4F7',
    overflow: 'hidden',
  },
  rateFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#12B76A',
  },
  rateCaption: {
    marginTop: 10,
    fontSize: 13,
    color: '#667085',
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  detailsCount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#074C70',
    marginBottom: 14,
  },
  dropdownWrap: {
    marginBottom: 14,
  },
  dropdownTrigger: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownTriggerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  dropdownChevron: {
    fontSize: 12,
    color: '#667085',
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(16, 24, 40, 0.18)',
  },
  dropdownMenu: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E7EC',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  dropdownOption: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F2F4F7',
  },
  dropdownOptionLast: {
    borderBottomWidth: 0,
  },
  dropdownOptionActive: {
    backgroundColor: '#EAF2F7',
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#344054',
    fontWeight: '500',
  },
  dropdownOptionTextActive: {
    color: '#074C70',
    fontWeight: '700',
  },
  leadCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  leadTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leadMain: {
    flex: 1,
    paddingRight: 10,
  },
  leadName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  leadPhone: {
    fontSize: 13,
    color: '#667085',
    marginTop: 2,
  },
  leadMeta: {
    fontSize: 12,
    color: '#98A2B3',
    marginTop: 4,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: 120,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  expandHint: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '600',
    color: '#074C70',
  },
  detailBlock: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F2F4F7',
    paddingTop: 10,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  detailKey: {
    flex: 1,
    fontSize: 12,
    color: '#667085',
    fontWeight: '600',
  },
  detailValue: {
    flex: 1.4,
    fontSize: 12,
    color: '#1A1A1A',
    textAlign: 'right',
  },
  emptyText: {
    color: '#666',
    marginBottom: 12,
  },
});
