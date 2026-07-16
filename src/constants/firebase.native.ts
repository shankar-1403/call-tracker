import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, initializeAuth, type Auth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

import { createAsyncStoragePersistence } from './authPersistence';
import { firebaseConfig } from './firebase.config';

const app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig);

function createAuth(): Auth {
  try {
    return initializeAuth(app, {
      persistence: createAsyncStoragePersistence(AsyncStorage),
    });
  } catch (error) {
    // Fast Refresh / already initialized
    console.log('[Firebase] Auth already initialized, reusing instance', error);
    return getAuth(app);
  }
}

export const auth = createAuth();
export const db = getDatabase(app);
