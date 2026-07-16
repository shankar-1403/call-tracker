import * as SplashScreen from 'expo-splash-screen';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { get, ref } from 'firebase/database';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { auth, db } from '../constants/firebase';

SplashScreen.preventAutoHideAsync().catch(() => {});

const AUTH_READY_TIMEOUT_MS = 8000;

interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
  createdAt?: number;
  createdByAdminUid?: string | null;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  profileIssue: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileIssue, setProfileIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const hideSplash = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  const loadProfile = useCallback(async (uid: string): Promise<UserProfile | null> => {
    setProfileIssue(null);

    try {
      const snap = await get(ref(db, `users/${uid}`));

      if (!snap.exists()) {
        setProfile(null);
        return null;
      }

      const data = snap.val();
      const merged: UserProfile = {
        uid,
        ...data,
      };

      setProfile(merged);
      return merged;
    } catch (error) {
      console.error(`[Auth] Could not read users/${uid}. Check database rules.`, error);
      setProfile(null);
      setProfileIssue('Unable to load profile.');
      return null;
    }
  }, []);

  useEffect(() => {
    let settled = false;

    const finishLoading = () => {
      if (settled) {
        return;
      }
      settled = true;
      setLoading(false);
      hideSplash();
    };

    // Never stay stuck on splash/logo if auth restore hangs
    const timeoutId = setTimeout(() => {
      console.warn('[Auth] Auth restore timed out; continuing to UI');
      finishLoading();
    }, AUTH_READY_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(
      auth,
      (firebaseUser) => {
        setUser(firebaseUser);

        // Unlock UI immediately — do not wait for profile network call
        finishLoading();

        if (firebaseUser) {
          void loadProfile(firebaseUser.uid);
        } else {
          setProfile(null);
          setProfileIssue(null);
        }
      },
      (error) => {
        console.error('[Auth] onAuthStateChanged error', error);
        setUser(null);
        setProfile(null);
        finishLoading();
      },
    );

    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [hideSplash, loadProfile]);

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!user) {
      return null;
    }
    return loadProfile(user.uid);
  }, [user, loadProfile]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      profile,
      profileIssue,
      loading,
      login,
      logout,
      refreshProfile,
    }),
    [user, profile, profileIssue, loading, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
