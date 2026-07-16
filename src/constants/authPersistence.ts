/**
 * Firebase Auth persistence for React Native using AsyncStorage.
 * Mirrors Firebase's getReactNativePersistence so login survives app restarts
 * even when Metro resolves the browser Firebase Auth bundle.
 */
import type { Persistence } from 'firebase/auth';

const STORAGE_AVAILABLE_KEY = 'firebase-heartbeat-storage-available';

type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

export function createAsyncStoragePersistence(storage: AsyncStorageLike): Persistence {
  // Firebase expects a constructable Persistence class with empty constructor.
  const PersistenceClass = class {
    static type: 'LOCAL' = 'LOCAL';
    readonly type = 'LOCAL' as const;

    async _isAvailable(): Promise<boolean> {
      try {
        await storage.setItem(STORAGE_AVAILABLE_KEY, '1');
        await storage.removeItem(STORAGE_AVAILABLE_KEY);
        return true;
      } catch {
        return false;
      }
    }

    _set(key: string, value: unknown): Promise<void> {
      return storage.setItem(key, JSON.stringify(value));
    }

    async _get<T>(key: string): Promise<T | null> {
      const json = await storage.getItem(key);
      return json ? (JSON.parse(json) as T) : null;
    }

    _remove(key: string): Promise<void> {
      return storage.removeItem(key);
    }

    _addListener(_key: string, _listener: unknown): void {
      return;
    }

    _removeListener(_key: string, _listener: unknown): void {
      return;
    }
  };

  return PersistenceClass as unknown as Persistence;
}
