import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { get, ref } from "firebase/database";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { auth, db } from "../constants/firebase";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const SESSION_STORAGE_KEY = "call_tracking";

interface SessionRecord {
  uid: string;
  startMs: number;
}

interface UserProfile {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
  createdAt?: number;
  createdByAdminUid?: string | null;
  [key: string]: any;
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

async function readSessionRecord(): Promise<SessionRecord | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;

    const record = JSON.parse(raw);

    if (
      record &&
      typeof record.uid === "string" &&
      typeof record.startMs === "number"
    ) {
      return record;
    }
  } catch {}

  return null;
}

async function writeSessionRecord(uid: string, startMs: number) {
  try {
    await AsyncStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        uid,
        startMs,
      })
    );
  } catch (error) {
    console.error(error);
  }
}

async function clearSessionRecord() {
  try {
    await AsyncStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {}
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileIssue, setProfileIssue] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

      if (!data?.role || String(data.role).trim() === "") {
        return merged;
      }

      return merged;
    } catch (error) {
      console.error(
        `[CMS] Could not read users/${uid}. Check database rules.`,
        error
      );
      setProfile(null);
      setProfileIssue("Unable to load profile.");
      return null;
    }
  }, []);

  useEffect(() => {
     console.log("AuthContext: subscribing");

    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser) => {
        console.log("onAuthStateChanged fired", firebaseUser?.email);

        try {
          setUser(firebaseUser);

          if (firebaseUser) {
            await loadProfile(firebaseUser.uid);
          } else {
            setProfile(null);
            setProfileIssue(null);
          }
        } catch (error) {
          console.error("[Auth] Failed to resolve auth state", error);
          setProfile(null);
          setProfileIssue("Unable to load session.");
        } finally {
          console.log("Setting loading false");
          setLoading(false);
        }
      },
      (error) => {
        console.error("[Auth] onAuthStateChanged error", error);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [loadProfile]);

  useEffect(() => {
    if (!user) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    let intervalId: ReturnType<typeof setInterval>;

    const initSession = async () => {
      const uid = user.uid;

      let record = await readSessionRecord();

      if (!record || record.uid !== uid) {
        const startMs = Date.now();
        await writeSessionRecord(uid, startMs);
        record = { uid, startMs };
      }

      const signOutIfExpired = async () => {
        const session = await readSessionRecord();

        if (!session || session.uid !== uid) return;

        if (Date.now() - session.startMs >= SESSION_DURATION_MS) {
          await clearSessionRecord();
          await signOut(auth);
        }
      };

      const elapsed = Date.now() - record.startMs;

      if (elapsed >= SESSION_DURATION_MS) {
        await clearSessionRecord();
        await signOut(auth);
        return;
      }

      const remaining = SESSION_DURATION_MS - elapsed;

      timeoutId = setTimeout(() => {
        signOutIfExpired();
      }, remaining);

      intervalId = setInterval(() => {
        signOutIfExpired();
      }, 60_000);
    };

    initSession();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const logout = useCallback(async () => {
    await clearSessionRecord();
    await signOut(auth);
  }, []);
  
  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!user) return null;
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
    [
      user,
      profile,
      profileIssue,
      loading,
      login,
      logout,
      refreshProfile,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}