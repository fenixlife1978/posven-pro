import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, Firestore } from "firebase/firestore";
import { getDatabase, Database } from "firebase/database";

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// Validar configuración mínima para evitar bloqueos
const isConfigValid = typeof window !== "undefined" && !!firebaseConfig.apiKey;

let app: FirebaseApp | null = null;
if (isConfigValid) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Error initializing Firebase App:", e);
  }
}

export const auth = app ? getAuth(app) : null;

// Inicializar Firestore con persistencia solo si estamos en el cliente
export const db = app 
  ? (typeof window !== "undefined" 
      ? initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager()
          })
        })
      : getFirestore(app))
  : null;

export const rtdb = app ? getDatabase(app) : null;
export default app;
