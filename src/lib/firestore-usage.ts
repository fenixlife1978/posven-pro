'use client';

export type FirestoreUsageCategory =
  | 'Ventas' | 'Inventario' | 'CxC' | 'CxP' | 'Compras'
  | 'Clientes' | 'Proveedores' | 'Reportes' | 'Configuración' | 'Otros';

export interface FirestoreUsageStats {
  reads: number;
  writes: number;
  deletes: number;
  realtimeReads: number;
  byCategory: Record<string, { reads: number; writes: number; deletes: number }>;
  periodStart: string;
  updatedAt: string;
}

const KEY = 'posven_firestore_usage_v1';

const empty = (): FirestoreUsageStats => ({
  reads: 0, writes: 0, deletes: 0, realtimeReads: 0,
  byCategory: {}, periodStart: new Date().toISOString(), updatedAt: new Date().toISOString()
});

function load(): FirestoreUsageStats {
  if (typeof window === 'undefined') return empty();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return empty();
    return { ...empty(), ...parsed, byCategory: parsed.byCategory || {} };
  } catch { return empty(); }
}

function save(stats: FirestoreUsageStats) {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(KEY, JSON.stringify(stats)); } catch {}
}

function normalizeCategory(value?: string): FirestoreUsageCategory {
  const s = String(value || '').toLowerCase();
  if (s.includes('venta') || s === 'ventas') return 'Ventas';
  if (s.includes('invent')) return 'Inventario';
  if (s.includes('cxc') || s.includes('cliente') || s.includes('cobrar')) return 'CxC';
  if (s.includes('cxp') || s.includes('proveedor') || s.includes('pagar')) return 'CxP';
  if (s.includes('compra')) return 'Compras';
  if (s.includes('reporte') || s.includes('z')) return 'Reportes';
  if (s.includes('config')) return 'Configuración';
  return 'Otros';
}

export const FirestoreUsage = {
  get(): FirestoreUsageStats { return load(); },

  record(kind: 'read' | 'write' | 'delete' | 'realtimeRead', count = 1, category?: string) {
    if (!Number.isFinite(count) || count <= 0) return;
    const s = load();
    const n = Math.max(0, Math.round(count));
    if (kind === 'read') s.reads += n;
    if (kind === 'write') s.writes += n;
    if (kind === 'delete') s.deletes += n;
    if (kind === 'realtimeRead') { s.realtimeReads += n; s.reads += n; }
    const c = normalizeCategory(category);
    s.byCategory[c] = s.byCategory[c] || { reads: 0, writes: 0, deletes: 0 };
    if (kind === 'read' || kind === 'realtimeRead') s.byCategory[c].reads += n;
    if (kind === 'write') s.byCategory[c].writes += n;
    if (kind === 'delete') s.byCategory[c].deletes += n;
    s.updatedAt = new Date().toISOString();
    save(s);
  },

  reset() {
    if (typeof window !== 'undefined') localStorage.removeItem(KEY);
  },

  // Referencia visual para el administrador. No pretende sustituir el Usage
  // Dashboard de Firebase/Google Cloud, que es la fuente oficial.
  dailyQuota: { reads: 50000, writes: 20000, deletes: 20000 }
};
