import { useAuth } from '@/context/AuthContext';
import {
  loadRecentCalls,
  waitForLatestCall,
} from '@/services/callLogService';
import {
  hasCallLogPermissions,
  requestCallLogPermissions,
} from '@/services/callLogPermissions';
import type { StoredCallRecord, TrackedCall, TrackedCallState } from '@/types/call';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { AppState, Platform } from 'react-native';
import CallDetection, {
  type CallStateEvent,
} from 'react-native-call-detection-android';

type CallListenerSubscription = ReturnType<typeof CallDetection.addCallStateListener>;

interface UseCallTrackerOptions {
  onCallCompletedRef?: RefObject<(() => void) | null>;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function useCallTracker(options?: UseCallTrackerOptions) {
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [callState, setCallState] = useState<TrackedCallState>('IDLE');
  const [activeCall, setActiveCall] = useState<TrackedCall | null>(null);
  const [recentCalls, setRecentCalls] = useState<StoredCallRecord[]>([]);
  const [callNotice, setCallNotice] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeCallRef = useRef<TrackedCall | null>(null);
  const callStartedAtRef = useRef<number | null>(null);
  const wasOffhookRef = useRef(false);
  const lastPhoneNumberRef = useRef<string>('Unknown');
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gsmSubscriptionRef = useRef<CallListenerSubscription | null>(null);
  const isAndroid = Platform.OS === 'android';

  const clearDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  const refreshRecentCalls = useCallback(async () => {
    if (!isAndroid) {
      return;
    }

    setIsRefreshing(true);
    try {
      const calls = await loadRecentCalls(20);
      setRecentCalls(calls);
    } catch (error) {
      console.error('[CallTracker] Failed to load call logs', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [isAndroid]);

  const recordCompletedCall = useCallback(
    async (liveDurationSeconds: number, startedAt: number) => {
      const latestCall = await waitForLatestCall(startedAt);
      const fallbackCall: StoredCallRecord = {
        id: `live-${startedAt}`,
        phoneNumber: lastPhoneNumberRef.current,
        contactName: null,
        callType: 'OUTGOING',
        durationSeconds: liveDurationSeconds,
        liveDurationSeconds,
        timestamp: startedAt,
        syncedToSheets: false,
      };

      const recordedCall = latestCall ?? fallbackCall;

      setRecentCalls((current) => {
        const withoutDuplicate = current.filter((item) => item.id !== recordedCall.id);
        return [recordedCall, ...withoutDuplicate].slice(0, 20);
      });

      setCallNotice('Call recorded on this device.');
      options?.onCallCompletedRef?.current?.();
    },
    [options?.onCallCompletedRef],
  );

  const startLiveTimer = useCallback(() => {
    clearDurationTimer();

    durationTimerRef.current = setInterval(() => {
      const currentCall = activeCallRef.current;
      if (!currentCall) {
        return;
      }

      const elapsedSeconds = Math.max(
        0,
        Math.floor((Date.now() - currentCall.startedAt) / 1000),
      );

      const nextCall = {
        ...currentCall,
        liveDurationSeconds: elapsedSeconds,
      };

      activeCallRef.current = nextCall;
      setActiveCall(nextCall);
    }, 1000);
  }, [clearDurationTimer]);

  const handleCallStateChange = useCallback(
    (event: CallStateEvent) => {
      const phoneNumber = event.phoneNumber?.trim() || lastPhoneNumberRef.current;
      if (event.phoneNumber?.trim()) {
        lastPhoneNumberRef.current = event.phoneNumber.trim();
      }

      setCallState(event.state === 'UNKNOWN' ? 'IDLE' : event.state);

      if (event.state === 'RINGING') {
        const ringingCall: TrackedCall = {
          phoneNumber,
          contactName: null,
          callType: 'INCOMING',
          startedAt: Date.now(),
          liveDurationSeconds: 0,
        };
        activeCallRef.current = ringingCall;
        setActiveCall(ringingCall);
        return;
      }

      if (event.state === 'OFFHOOK') {
        wasOffhookRef.current = true;
        const startedAt =
          callStartedAtRef.current ?? activeCallRef.current?.startedAt ?? Date.now();
        callStartedAtRef.current = startedAt;

        const inProgressCall: TrackedCall = {
          phoneNumber,
          contactName: null,
          callType: activeCallRef.current?.callType ?? 'OUTGOING',
          startedAt,
          liveDurationSeconds: Math.max(
            0,
            Math.floor((Date.now() - startedAt) / 1000),
          ),
        };

        activeCallRef.current = inProgressCall;
        setActiveCall(inProgressCall);
        startLiveTimer();
        return;
      }

      if (event.state === 'UNKNOWN') {
        return;
      }

      if (event.state === 'IDLE') {
        clearDurationTimer();

        const startedAt = callStartedAtRef.current;
        const hadActiveCall = wasOffhookRef.current;
        const liveDurationSeconds = startedAt
          ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
          : activeCallRef.current?.liveDurationSeconds ?? 0;

        activeCallRef.current = null;
        callStartedAtRef.current = null;
        wasOffhookRef.current = false;
        setActiveCall(null);

        if (hadActiveCall && startedAt) {
          void recordCompletedCall(liveDurationSeconds, startedAt);
        }
      }
    },
    [clearDurationTimer, recordCompletedCall, startLiveTimer],
  );

  const startCallDetection = useCallback(async () => {
    if (!isAndroid) {
      return;
    }

    try {
      await CallDetection.startListener();
      gsmSubscriptionRef.current = CallDetection.addCallStateListener(
        handleCallStateChange,
      );
    } catch (error) {
      console.error('[CallTracker] Failed to start call detection', error);
      setPermissionError('Unable to start live call detection on this device.');
    }
  }, [handleCallStateChange, isAndroid]);

  const stopCallDetection = useCallback(() => {
    clearDurationTimer();
    gsmSubscriptionRef.current?.remove();
    gsmSubscriptionRef.current = null;

    if (isAndroid) {
      void CallDetection.stopListener();
    }
  }, [clearDurationTimer, isAndroid]);

  const requestPermissions = useCallback(async () => {
    if (!isAndroid) {
      setPermissionError('Call log tracking is only available on Android.');
      return false;
    }

    setPermissionError(null);
    const granted = await requestCallLogPermissions();
    setPermissionsGranted(granted);

    if (!granted) {
      setPermissionError('Call log and phone permissions are required to track calls.');
      return false;
    }

    await refreshRecentCalls();
    await startCallDetection();
    return true;
  }, [isAndroid, refreshRecentCalls, startCallDetection]);

  useEffect(() => {
    if (!isAndroid) {
      return;
    }

    let isMounted = true;

    const bootstrap = async () => {
      const granted = await hasCallLogPermissions();
      if (!isMounted) {
        return;
      }

      setPermissionsGranted(granted);
      if (!granted) {
        return;
      }

      await refreshRecentCalls();
      await startCallDetection();
    };

    void bootstrap();

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshRecentCalls();
        options?.onCallCompletedRef?.current?.();
      }
    });

    return () => {
      isMounted = false;
      appStateSubscription.remove();
      stopCallDetection();
    };
  }, [isAndroid, options?.onCallCompletedRef, refreshRecentCalls, startCallDetection, stopCallDetection]);

  return {
    isAndroid,
    permissionsGranted,
    permissionError,
    requestPermissions,
    callState,
    activeCall,
    activeCallLabel: activeCall ? formatDuration(activeCall.liveDurationSeconds) : '0:00',
    recentCalls,
    callNotice,
    isRefreshing,
    refreshRecentCalls,
  };
}
