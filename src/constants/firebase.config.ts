export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
}

if (process.env.EXPO_PUBLIC_DEV) {
  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => v == null || String(v).trim() === '')
    .map(([k]) => k)
  if (missing.length) {
    console.error(
      '[Firebase] Missing or empty EXPO_PUBLIC_ env vars:',
      missing.join(', '),
      '— copy .env.example to .env and fill values, then restart npm run dev.',
    )
  }
}
