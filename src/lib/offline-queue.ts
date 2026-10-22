const QUEUE_KEY = 'posven_pro_offline_operations_v1';

export type OfflineOperation = {
  operationId: string;
  type: string;
  payload: any;
  createdAt: string;
  status: 'pending' | 'processing' | 'processed' | 'conflict';
  attempts: number;
  lastError?: string;
  processedAt?: string;
  nextAttemptAt?: string;
};

type Processor = (op: OfflineOperation) => Promise<void>;
let processor: Processor | null = null;
let processing = false;
const listeners = new Set<(items: OfflineOperation[]) => void>();

function load(): OfflineOperation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Recover operations interrupted by a browser/app crash while marked processing.
    let recovered = false;
    for (const item of parsed) {
      if (item && item.status === 'processing') {
        item.status = 'pending';
        recovered = true;
      }
    }
    if (recovered) {
      try { localStorage.setItem(QUEUE_KEY, JSON.stringify(parsed)); } catch {}
    }
    return parsed.filter((x: any) => x && typeof x.operationId === 'string' && typeof x.type === 'string');
  } catch { return []; }
}

function save(items: OfflineOperation[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch (e) {
    // Do not silently pretend the operation was durably queued.
    console.error('[offline-queue] No se pudo guardar la cola:', e);
  }
  listeners.forEach(fn => { try { fn(items); } catch {} });
}

export function getOfflineQueue(): OfflineOperation[] { return load(); }
export function onOfflineQueueChange(fn: (items: OfflineOperation[]) => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }

export function enqueueOfflineOperation(type: string, payload: any, operationId: string): OfflineOperation {
  const items = load();
  const existing = items.find(x => x.operationId === operationId);
  if (existing) return existing;
  const item: OfflineOperation = { operationId, type, payload, createdAt: new Date().toISOString(), status: 'pending', attempts: 0 };
  save([...items, item]);
  return item;
}

export function registerOfflineProcessor(fn: Processor) { processor = fn; }

function retryDelayMs(attempts: number): number {
  // Exponential backoff capped at five minutes to avoid hammering the API.
  return Math.min(5 * 60_000, 2_000 * (2 ** Math.min(Math.max(attempts - 1, 0), 7)));
}

function isPermanentRejection(error: any): boolean {
  const status = Number(error?.status ?? error?.statusCode ?? error?.response?.status);
  // Validation/authorization failures need operator attention; transient HTTP failures must retry.
  return status >= 400 && status < 500 && ![408, 409, 425, 429].includes(status);
}

export async function processOfflineQueue(): Promise<void> {
  if (processing || !processor || typeof window === 'undefined' || !navigator.onLine) return;
  processing = true;
  try {
    for (;;) {
      const current = load();
      const now = Date.now();
      const item = current.find(x =>
        (x.status === 'pending' || x.status === 'processing') &&
        (!x.nextAttemptAt || !Number.isFinite(Date.parse(x.nextAttemptAt)) || Date.parse(x.nextAttemptAt) <= now)
      );
      if (!item) break;
      item.status = 'processing';
      item.attempts = (Number(item.attempts) || 0) + 1;
      save(current);
      try {
        await processor(item);
        // Remove only after the processor confirms the server accepted the operation.
        save(load().filter(x => x.operationId !== item.operationId));
      } catch (e: any) {
        const latest = load();
        const target = latest.find(x => x.operationId === item.operationId);
        if (target) {
          target.lastError = String(e?.message || e || 'Error de sincronización');
          if (isPermanentRejection(e)) {
            target.status = 'conflict';
            delete target.nextAttemptAt;
          } else {
            target.status = 'pending';
            target.nextAttemptAt = new Date(Date.now() + retryDelayMs(target.attempts)).toISOString();
          }
        }
        save(latest);
        // Stop this pass after a transient error; the next scheduled/online pass retries with backoff.
        if (!isPermanentRejection(e) || !navigator.onLine) break;
        // Permanent conflicts remain visible for resolution but don't block unrelated operations.
      }
    }
  } finally { processing = false; }
}

if (typeof window !== 'undefined') {
  // Normalize interrupted operations as soon as this module is loaded.
  load();
  window.addEventListener('online', () => { void processOfflineQueue(); });
  window.setTimeout(() => { void processOfflineQueue(); }, 1500);
  window.setInterval(() => { void processOfflineQueue(); }, 15000);
}
