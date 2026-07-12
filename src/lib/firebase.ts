import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, Firestore } from "firebase/firestore";
import { getDatabase, Database } from "firebase/database";

// ============================================================
// CONFIGURACIÓN DE FIREBASE
// ============================================================

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "dummy",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dummy",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "dummy",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "dummy",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "",
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
  // Fallback para evitar que el build falle por falta de app
  app = initializeApp({ apiKey: "dummy", projectId: "dummy" });
}

// ============================================================
// EXPORTAR SERVICIOS
// ============================================================

export const auth: Auth = getAuth(app);

export const db: Firestore = typeof window !== "undefined" && isConfigValid
  ? initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    })
  : getFirestore(app);

export const rtdb: Database = getDatabase(app);

export default app;

export const isFirebaseConfigured = isConfigValid;
export const isClient = typeof window !== "undefined";
