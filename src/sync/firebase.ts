'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

/**
 * Firebase, loaded only if it is configured.
 *
 * The app has to keep working with no backend at all — that is how it runs on a
 * fresh clone, and how it keeps running if a project is ever misconfigured. So
 * nothing here is imported at module scope by the rest of the app; callers ask
 * `firebaseReady()` first and take the local-only path when it is false.
 *
 * These values are not secrets. A Firebase web config is public by design; what
 * protects the data is the security rules in firestore.rules, which allow a
 * signed-in user to touch nothing but their own documents.
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function firebaseReady(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId && config.storageBucket);
}

/** Which keys are missing, so the Profile screen can say something useful. */
export function missingFirebaseConfig(): string[] {
  return Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => `NEXT_PUBLIC_FIREBASE_${key.replace(/[A-Z]/g, (c) => `_${c}`).toUpperCase()}`);
}

let app: FirebaseApp | null = null;

function firebaseApp(): FirebaseApp {
  if (!firebaseReady()) throw new Error('Firebase is not configured');
  if (!app) app = getApps().length ? getApp() : initializeApp(config as Record<string, string>);
  return app;
}

export function auth(): Auth {
  return getAuth(firebaseApp());
}

export function firestore(): Firestore {
  return getFirestore(firebaseApp());
}

export function storage(): FirebaseStorage {
  return getStorage(firebaseApp());
}

/** Turn Firebase's error codes into something a person can act on. */
export function describeAuthError(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That does not look like an email address.';
    case 'auth/missing-password':
      return 'Enter a password.';
    case 'auth/weak-password':
      return 'Use at least six characters.';
    case 'auth/email-already-in-use':
      return 'There is already an account with that email. Sign in instead.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password do not match an account.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Your wardrobe is safe on this device — try again when you are online.';
    case 'auth/operation-not-allowed':
      return 'Email sign-in is not switched on in the Firebase project yet.';
    default:
      return (error as Error)?.message ?? 'Something went wrong signing in.';
  }
}
