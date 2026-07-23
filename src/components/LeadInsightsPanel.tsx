import { exportLeadAnalysisToExcel } from '@/services/exportService';
import { scopeLeadsToCallDateRange } from '@/services/leadAnalysisService';
import type { StoredCallRecord } from '@/types/call';
import type { LeadCallStatus, LeadWithAnalysis } from '@/types/lead';
import {
  collectSheetStatusOptions,
  filterLeadsForInsights,
  formatMinutes,
  getDateRangePreset,
  getLeadSheetStatus,
  type DateRange,
  type DateRangePreset,
} from '@/utils/leadInsights';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const DATE_PRESETS: Array<{ id: DateRangePreset; label: string }> = [
  { id: 'all', label: 'All time' },
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
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
  '#148F77',
  '#566573',
  '#D5D8DC',
  '#1ABC9C',
  '#6E2C00',
  '#2980B9',
  '#E67E22',
  '#16A085',
];

function hashStatusColor(status: string): string {
  let hash = 0;
  const value = status.toLowerCase();
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return SHEET_STATUS_COLORS[hash % SHEET_STATUS_COLORS.length];
}

function getSheetStatusColor(status: string, knownStatuses: string[] = []): string {
  const index = knownStatuses.findIndex(
    (item) => item.toLowerCase() === status.toLowerCase(),
  );
  if (index >= 0) {
    return SHEET_STATUS_COLORS[index % SHEET_STATUS_COLORS.length];
  }
  return hashStatusColor(status);
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

const HIDDEN_DETAIL_KEYS = new Set(['Sheet Tab']);

/** Prefer known MSME fields, then any other columns present on this sheet. */
function buildDetailRows(lead: LeadWithAnalysis): Array<{ field: string; value: string }> {
  const seen = new Set<string>();
  const rows: Array<{ field: string; value: string }> = [];

  for (const field of DETAIL_FIELDS) {
    const value = getRawField(lead, field);
    if (!value) {
      continue;
    }
    const actualKey =
      Object.keys(lead.raw).find((key) => key.toLowerCase() === field.toLowerCase()) ?? field;
    if (seen.has(actualKey.toLowerCase())) {
      continue;
    }
    seen.add(actualKey.toLowerCase());
    rows.push({ field: actualKey, value });
  }

  for (const [field, rawValue] of Object.entries(lead.raw)) {
    if (!field || HIDDEN_DETAIL_KEYS.has(field) || seen.has(field.toLowerCase())) {
      continue;
    }
    const value = String(rawValue || '').trim();
    if (!value) {
      continue;
    }
    seen.add(field.toLowerCase());
    rows.push({ field, value });
  }

  return rows;
}

interface LeadInsightsPanelProps {
  leads: LeadWithAnalysis[];
  calls?: StoredCallRecord[];
  sheetHeaders?: string[];
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

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
}

function parseDateInput(value: string, endOfDate = false): number | null {
  const match = value.trim().match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (!match) {
    return null;
  }

  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(endOfDate ? 23 : 0, endOfDate ? 59 : 0, endOfDate ? 59 : 0, endOfDate ? 999 : 0);
  return date.getTime();
}

export function LeadInsightsPanel({
  leads,
  calls = [],
  sheetHeaders = [],
}: LeadInsightsPanelProps) {
  const [sheetStatusFilter, setSheetStatusFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');
  const today = new Date();
  const [customFrom, setCustomFrom] = useState(() =>
    formatDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
  );
  const [customTo, setCustomTo] = useState(() => formatDateInput(today));
  const [customDateError, setCustomDateError] = useState<string | null>(null);
  const [customDateRange, setCustomDateRange] = useState<DateRange>(() => ({
    preset: 'custom',
    from: new Date(today.getFullYear(), today.getMonth(), 1).setHours(0, 0, 0, 0),
    to: new Date(today.getFullYear(), today.getMonth(), today.getDate()).setHours(
      23,
      59,
      59,
      999,
    ),
  }));
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [listLimit, setListLimit] = useState(30);
  const [isExporting, setIsExporting] = useState(false);
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

  const dateRange = useMemo(
    () => (datePreset === 'custom' ? customDateRange : getDateRangePreset(datePreset)),
    [datePreset, customDateRange],
  );

  // Recalculate Times Called / Incoming / Outgoing / Duration for the selected date range
  const dateScopedLeads = useMemo(() => {
    const hasRange = dateRange.from != null || dateRange.to != null;
    if (!hasRange || calls.length === 0) {
      return leads;
    }
    return scopeLeadsToCallDateRange(leads, calls, dateRange);
  }, [leads, calls, dateRange]);

  // Status options from dialed leads in the current date scope
  const calledLeads = useMemo(
    () => dateScopedLeads.filter((lead) => !lead.isDuplicate && lead.status !== 'not_called'),
    [dateScopedLeads],
  );

  const sheetStatuses = useMemo(
    () => collectSheetStatusOptions(calledLeads),
    [calledLeads],
  );

  const sheetStatusOptions = useMemo(
    () => [
      { id: 'all', label: 'All statuses' },
      ...sheetStatuses.map((status) => ({ id: status, label: status })),
    ],
    [sheetStatuses],
  );

  useEffect(() => {
    if (sheetStatusFilter === 'all') {
      return;
    }
    const stillValid = sheetStatuses.some(
      (status) => status.toLowerCase() === sheetStatusFilter.toLowerCase(),
    );
    if (!stillValid) {
      setSheetStatusFilter('all');
    }
  }, [sheetStatuses, sheetStatusFilter]);

  const selectedSheetStatusLabel =
    sheetStatusOptions.find((item) => item.id === sheetStatusFilter)?.label ??
    'All statuses';

  const openStatusDropdown = () => {
    dropdownTriggerRef.current?.measureInWindow((x, y, width, height) => {
      const screen = Dimensions.get('window');
      const estimatedMenuHeight = Math.min(sheetStatusOptions.length * 44 + 8, 360);
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

  const [datePickerTarget, setDatePickerTarget] = useState<'from' | 'to' | null>(null);

  const datePickerValue = useMemo(() => {
    const source = datePickerTarget === 'to' ? customTo : customFrom;
    const parsed = parseDateInput(source);
    return parsed != null ? new Date(parsed) : new Date();
  }, [datePickerTarget, customFrom, customTo]);

  const onDatePicked = (eventType: string, selected?: Date) => {
    setDatePickerTarget(null);
    if (eventType !== 'set' || !selected || !datePickerTarget) {
      return;
    }
    const formatted = formatDateInput(selected);
    if (datePickerTarget === 'from') {
      setCustomFrom(formatted);
    } else {
      setCustomTo(formatted);
    }
    setCustomDateError(null);
  };

  const applyCustomDateRange = () => {
    const from = parseDateInput(customFrom);
    const to = parseDateInput(customTo, true);

    if (from == null || to == null) {
      setCustomDateError('Enter valid dates in DD/MM/YYYY format.');
      return;
    }
    if (from > to) {
      setCustomDateError('From date must be before or equal to To date.');
      return;
    }

    setCustomDateError(null);
    setCustomDateRange({ preset: 'custom', from, to });
    setListLimit(30);
  };

  // 1) Date-scoped call metrics on each lead row  2) dialed in range  3) sheet Status
  const filtered = useMemo(() => {
    const allTimeRange: DateRange = { preset: 'all', from: null, to: null };
    // Date already applied via scopeLeadsToCallDateRange (metrics + which leads have calls)
    const rows = filterLeadsForInsights(
      dateScopedLeads,
      'called',
      allTimeRange,
      sheetStatusFilter,
    );
    return [...rows].sort((left, right) => {
      const leftStatus = getLeadSheetStatus(left);
      const rightStatus = getLeadSheetStatus(right);
      if (leftStatus !== rightStatus) {
        return leftStatus.localeCompare(rightStatus);
      }
      return left.name.localeCompare(right.name);
    });
  }, [dateScopedLeads, sheetStatusFilter]);

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
        color: getSheetStatusColor(status, sheetStatuses),
      }))
      .sort((a, b) => b.count - a.count);
  }, [filtered, sheetStatuses]);

  const maxCount = Math.max(1, ...sheetBreakdown.map((item) => item.count));
  const total = filtered.length;
  const dialed = filtered.filter((lead) => lead.status !== 'not_called').length;
  const connected = filtered.filter((lead) => lead.status === 'connected').length;
  const incomingCalls = filtered.reduce((sum, lead) => sum + lead.incomingCallCount, 0);
  const incomingSeconds = filtered.reduce(
    (sum, lead) => sum + lead.incomingDurationSeconds,
    0,
  );
  const outgoingCalls = filtered.reduce((sum, lead) => sum + lead.outgoingCallCount, 0);
  const outgoingSeconds = filtered.reduce(
    (sum, lead) => sum + lead.outgoingDurationSeconds,
    0,
  );
  const talkSeconds = filtered.reduce((sum, lead) => sum + lead.totalDurationSeconds, 0);
  const connectionRate = dialed > 0 ? Math.round((connected / dialed) * 100) : 0;

  const listTitle =
    sheetStatusFilter === 'all' ? 'Lead details by sheet status' : `${sheetStatusFilter}`;

  const filterLabel = useMemo(() => {
    let dateLabel: string;
    if (datePreset === 'custom' && dateRange.from != null && dateRange.to != null) {
      dateLabel = `Custom ${formatDateInput(new Date(dateRange.from))} - ${formatDateInput(new Date(dateRange.to))}`;
    } else {
      dateLabel =
        DATE_PRESETS.find((item) => item.id === datePreset)?.label ?? datePreset;
    }
    const statusLabel =
      sheetStatusFilter === 'all' ? 'All statuses' : sheetStatusFilter;
    return `${dateLabel} | ${statusLabel}`;
  }, [datePreset, dateRange, sheetStatusFilter]);

  const handleExport = async () => {
    if (filtered.length === 0) {
      Alert.alert('Nothing to export', 'No dialed leads match the current filters.');
      return;
    }

    setIsExporting(true);
    try {
      await exportLeadAnalysisToExcel({
        leads: filtered,
        sheetHeaders,
        filterLabel,
      });
    } catch (exportError) {
      Alert.alert(
        'Export failed',
        exportError instanceof Error ? exportError.message : 'Failed to export analysis.',
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <View>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.sectionTitle}>Insights</Text>
          <Text style={styles.subtitle}>
            Call counts and duration on each lead follow the selected date range, then sheet
            Status.
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
          onPress={() => {
            void handleExport();
          }}
          disabled={isExporting}
          activeOpacity={0.85}>
          <Text style={styles.exportButtonText}>
            {isExporting ? 'Exporting...' : 'Export Excel'}
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.filterLabel}>Date range</Text>
      <View style={styles.chipRow}>
        {DATE_PRESETS.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.chip, datePreset === item.id && styles.chipActive]}
            onPress={() => {
              setDatePreset(item.id);
              setListLimit(30);
            }}
            activeOpacity={0.85}>
            <Text style={[styles.chipText, datePreset === item.id && styles.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {datePreset === 'custom' ? (
        <View style={styles.customDateCard}>
          <View style={styles.customDateRow}>
            <View style={styles.customDateField}>
              <Text style={styles.customDateLabel}>From</Text>
              <View style={styles.customDateInputRow}>
                <TextInput
                  value={customFrom}
                  onChangeText={setCustomFrom}
                  placeholder="DD/MM/YYYY"
                  keyboardType="numbers-and-punctuation"
                  style={styles.customDateInput}
                />
                <TouchableOpacity
                  style={styles.calendarButton}
                  onPress={() => setDatePickerTarget('from')}
                  activeOpacity={0.85}>
                  <MaterialIcons name="calendar-today" size={18} color="#074C70" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.customDateField}>
              <Text style={styles.customDateLabel}>To</Text>
              <View style={styles.customDateInputRow}>
                <TextInput
                  value={customTo}
                  onChangeText={setCustomTo}
                  placeholder="DD/MM/YYYY"
                  keyboardType="numbers-and-punctuation"
                  style={styles.customDateInput}
                />
                <TouchableOpacity
                  style={styles.calendarButton}
                  onPress={() => setDatePickerTarget('to')}
                  activeOpacity={0.85}>
                  <MaterialIcons name="calendar-today" size={18} color="#074C70" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
          {datePickerTarget ? (
            <DateTimePicker
              value={datePickerValue}
              mode="date"
              display="calendar"
              onChange={(event, selected) => onDatePicked(event.type, selected)}
            />
          ) : null}
          {customDateError ? (
            <Text style={styles.customDateError}>{customDateError}</Text>
          ) : null}
          <TouchableOpacity
            style={styles.customDateApply}
            onPress={applyCustomDateRange}
            activeOpacity={0.85}>
            <Text style={styles.customDateApplyText}>Apply date range</Text>
          </TouchableOpacity>
        </View>
      ) : null}

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
            style={StyleSheet.absoluteFill}
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
              {sheetStatusOptions.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.dropdownOption,
                    index === sheetStatusOptions.length - 1 && styles.dropdownOptionLast,
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
          <Text style={styles.statValue}>Leads: {incomingCalls}</Text>
          <Text style={styles.statDuration}>Duration: {formatMinutes(incomingSeconds)}</Text>
          <Text style={styles.statLabel}>Incoming calls & duration</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>Leads: {outgoingCalls}</Text>
          <Text style={styles.statDuration}>Duration:{formatMinutes(outgoingSeconds)}</Text>
          <Text style={styles.statLabel}>Outgoing calls & duration</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatMinutes(talkSeconds)}</Text>
          <Text style={styles.statLabel}>Total talk time</Text>
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
                  if (item.status === 'No status') {
                    setSheetStatusFilter('all');
                    return;
                  }
                  const known = sheetStatuses.find(
                    (status) => status.toLowerCase() === item.status.toLowerCase(),
                  );
                  setSheetStatusFilter(known ?? item.status);
                  setListLimit(30);
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
          const detailRows = buildDetailRows(lead);

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
                    { backgroundColor: getSheetStatusColor(sheetStatus, sheetStatuses) },
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 4,
  },
  headerText: {
    flex: 1,
  },
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
  exportButton: {
    backgroundColor: '#074C70',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
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
  customDateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginTop: -4,
    marginBottom: 14,
  },
  customDateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  customDateField: {
    flex: 1,
  },
  customDateLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667085',
    marginBottom: 6,
  },
  customDateInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customDateInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    color: '#1A1A1A',
    fontSize: 14,
  },
  calendarButton: {
    borderWidth: 1,
    borderColor: '#D0D5DD',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customDateError: {
    color: '#D92D20',
    fontSize: 12,
    marginTop: 8,
  },
  customDateApply: {
    backgroundColor: '#074C70',
    borderRadius: 8,
    alignItems: 'center',
    paddingVertical: 10,
    marginTop: 10,
  },
  customDateApplyText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#074C70',
  },
  statDuration: {
    fontSize: 14,
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
