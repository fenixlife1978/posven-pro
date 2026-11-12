const LEGACY_QUEUE_KEY = 'posven_pro_offline_operations_v1';
const DB_NAME = 'posven_pro_offline_queue';
const DB_VERSION = 1;
const STORE_NAME = 'operations';
const META_STORE = 'meta';

export type OfflineOperation = {
  operationId: string;
  type: string;
  payload: any;
  createdAt: string;
  status: 'pending' | 'processing' | 'processed' | 'conflict';
  attempts: number;
  lastError?: string;
  processedAt?: string;
};

type Processor = (op: OfflineOperation) => Promise<void>;
let processor: Processor | null = null;
let processing = false;
let dbPromise: Promise<IDBDatabase> | null = null;
let migrationPromise: Promise<void> | null = null;
const listeners = new Set<(items: OfflineOperation[]) => void>();

function openQueueDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('Este navegador no ofrece almacenamiento IndexedDB para conservar la cola offline.'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'operationId' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir la cola offline.'));
    request.onblocked = () => reject(new Error('La cola offline está bloqueada por otra pestaña. Cierre las pestañas antiguas y vuelva a intentar.'));
  }).catch(error => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

function transactionComplete(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('No se pudo confirmar el almacenamiento offline.'));
    tx.onabort = () => reject(tx.error || new Error('Se canceló el almacenamiento offline.'));
  });
}

async function migrateLegacyQueue(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (migrationPromise) return migrationPromise;
  migrationPromise = (async () => {
    const db = await openQueueDb();
    const checkTx = db.transaction(META_STORE, 'readonly');
    const check = checkTx.objectStore(META_STORE).get('legacyLocalStorageMigrated');
    const migrated = await new Promise<boolean>((resolve, reject) => {
      check.onsuccess = () => resolve(check.result === true);
      check.onerror = () => reject(check.error);
    });
    await transactionComplete(checkTx);
    if (migrated) return;

    let legacy: OfflineOperation[] = [];
    try {
      const raw = localStorage.getItem(LEGACY_QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) legacy = parsed.filter(item => item && item.operationId && item.type);
    } catch (error) {
      console.error('[offline-queue] No se pudo leer la cola local anterior:', error);
    }

    const tx = db.transaction([STORE_NAME, META_STORE], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    legacy.forEach(item => {
      const normalized: OfflineOperation = {
        ...item,
        status: item.status === 'processing' ? 'pending' : item.status || 'pending',
        attempts: Number(item.attempts) || 0,
      };
      store.put(normalized);
    });
    tx.objectStore(META_STORE).put(true, 'legacyLocalStorageMigrated');
    await transactionComplete(tx);
    try { localStorage.removeItem(LEGACY_QUEUE_KEY); } catch {}
  })().catch(error => {
    migrationPromise = null;
    throw error;
  });
  return migrationPromise;
}

async function readAll(): Promise<OfflineOperation[]> {
  if (typeof window === 'undefined') return [];
  await migrateLegacyQueue();
  const db = await openQueueDb();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const request = tx.objectStore(STORE_NAME).getAll();
  const items = await new Promise<OfflineOperation[]>((resolve, reject) => {
    request.onsuccess = () => resolve((request.result || []) as OfflineOperation[]);
    request.onerror = () => reject(request.error || new Error('No se pudo leer la cola offline.'));
  });
  await transactionComplete(tx);
  return items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function putOne(item: OfflineOperation): Promise<void> {
  await migrateLegacyQueue();
  const db = await openQueueDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).put(item);
  await transactionComplete(tx);
  await notifyListeners();
}

async function deleteOne(operationId: string): Promise<void> {
  const db = await openQueueDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(operationId);
  await transactionComplete(tx);
  await notifyListeners();
}

async function notifyListeners(): Promise<void> {
  const items = await readAll();
  listeners.forEach(fn => { try { fn(items); } catch {} });
}

export async function getOfflineQueue(): Promise<OfflineOperation[]> { return readAll(); }
export function onOfflineQueueChange(fn: (items: OfflineOperation[]) => void): () => void {
  listeners.add(fn);
  if (typeof window !== 'undefined') void readAll().then(items => fn(items)).catch(error => console.error('[offline-queue] No se pudo consultar la cola:', error));
  return () => listeners.delete(fn);
}

export async function enqueueOfflineOperation(type: string, payload: any, operationId: string): Promise<OfflineOperation> {
  if (!operationId) throw new Error('La operación offline necesita un identificador único.');
  const items = await readAll();
  const existing = items.find(item => item.operationId === operationId);
  if (existing) return existing;
  const item: OfflineOperation = {
    operationId,
    type,
    payload,
    createdAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
  };
  await putOne(item);
  // La promesa solo resuelve después del commit de IndexedDB: el POS puede
  // informar que quedó en cola únicamente cuando el navegador confirmó el guardado.
  return item;
}

export function registerOfflineProcessor(fn: Processor) { processor = fn; }

export async function processOfflineQueue(): Promise<void> {
  if (processing || !processor || typeof window === 'undefined' || !navigator.onLine) return;
  processing = true;
  try {
    for (;;) {
      const current = await readAll();
      const item = current.find(entry => entry.status === 'pending' || entry.status === 'processing');
      if (!item) break;

      const processingItem = { ...item, status: 'processing' as const, attempts: (Number(item.attempts) || 0) + 1 };
      await putOne(processingItem);
      try {
        await processor(processingItem);
        await deleteOne(item.operationId);
      } catch (error: any) {
        const latest = (await readAll()).find(entry => entry.operationId === item.operationId);
        if (latest) {
          const message = String(error?.message || error || 'Error de sincronización');
          const networkFailure = !navigator.onLine || /sin conexión|no se pudo contactar|network|fetch failed|timeout/i.test(message);
          await putOne({
            ...latest,
            status: networkFailure ? 'pending' : 'conflict',
            lastError: message,
          });
        }
        if (!navigator.onLine) break;
        // Un conflicto no bloquea el resto de la cola; queda visible para revisión.
        continue;
      }
    }
  } catch (error) {
    // Nunca se borra una operación por fallar IndexedDB o su lectura.
    console.error('[offline-queue] No se pudo procesar la cola durable:', error);
  } finally {
    processing = false;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { void processOfflineQueue(); });
  window.setTimeout(() => { void processOfflineQueue(); }, 1500);
  window.setInterval(() => { void processOfflineQueue(); }, 15000);
}
