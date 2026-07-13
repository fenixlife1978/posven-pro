import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentSingleTabManager, 
  getFirestore, 
  Firestore 
} from "firebase/firestore";
import { getDatabase, Database } from "firebase/database";

// ============================================================
// CONFIGURACIÓN DE FIREBASE
// ============================================================

const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "dummy",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dummy",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "dummy",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "dummy",
  ...(databaseURL && databaseURL.startsWith('https') ? { databaseURL } : {}),
};

// ============================================================
// VALIDAR CONFIGURACIÓN
// ============================================================

const isConfigValid = !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY && 
                       process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== "dummy";

// ============================================================
// INICIALIZAR APP
// ============================================================

let app: FirebaseApp;

try {
  if (getApps().length > 0) {
    app = getApp();
  } else {
    app = initializeApp(firebaseConfig);
  }
} catch (e) {
  console.error("Firebase init error:", e);
  app = initializeApp({ apiKey: "dummy", projectId: "dummy" });
}

// ============================================================
// EXPORTAR SERVICIOS (SINGLE TAB PERSISTENCE)
// ============================================================

export const auth: Auth = getAuth(app);

let dbInstance: Firestore;

if (typeof window !== "undefined" && isConfigValid) {
  try {
    // Usamos persistentSingleTabManager para evitar errores de lease en Electron/Dev
    dbInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager()
      })
    });
  } catch (e) {
    // Si ya está inicializado (por ejemplo en un Hot Reload), obtenemos la instancia actual
    dbInstance = getFirestore(app);
  }
} else {
  dbInstance = getFirestore(app);
}

export const db: Firestore = dbInstance;

// Inicialización segura de RTDB
export const rtdb: Database = getDatabase(app);

export default app;

export const isFirebaseConfigured = isConfigValid;
export const isClient = typeof window !== "undefined";
