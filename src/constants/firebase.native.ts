import AsyncStorage from '@react-native-async-storage/async-storage'
import { initializeApp } from 'firebase/app'
import { getAuth, initializeAuth, type Persistence } from 'firebase/auth'
import { getDatabase } from 'firebase/database'

import { firebaseConfig } from './firebase.config'

const { getReactNativePersistence } = require('firebase/auth') as {
  getReactNativePersistence: (storage: typeof AsyncStorage) => Persistence
}

const app = initializeApp(firebaseConfig)

function createAuth() {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    })
  } catch {
    return getAuth(app)
  }
}

export const auth = createAuth()
export const db = getDatabase(app)
