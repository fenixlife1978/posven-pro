'use client';

import { AppState } from './types';
import { db } from './firebase';
import { doc, setDoc, onSnapshot, collection, query, writeBatch, deleteField, runTransaction } from "firebase/firestore";

const STORAGE_KEY = 'posven_pro_session_data_cache';
const COLLECTION = 'pos_system_data';
const DOC_ID = 'state';

// ============================================================
// COLECCIONES RAÍZ: productos e inventario (movimientos) ya NO
// viven dentro de pos_system_data/state, tienen su propia colección.
// ============================================================
const PRODUCTOS_COLLECTION = 'productos';
const MOVIMIENTOS_COLLECTION = 'movimientos';

export const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  tasa: 36.50,
  pinDevolucion: '000000',
  isInitialized: false,
  productos: [],
  ventas: [],
  cxc: [],
  cxp: [],
  clientes: [],
  devoluciones: [],
  anulaciones: [],
  movimientos: [],
  libroDiario: [],
  carrito: [],
  terminales: [],
  reportesZ: [],
  ultimoZ: 0,
  proximoRecibo: 1,
  proximaDevolucion: 1,
  proximaAnulacion: 1,
  acumuladoHistorico: 0,
  fechaUltimoZ: '',
  fondoCajaHoyUSD: 0,
  fondoCajaHoyBS: 0,
  
  // ========== PROPIEDADES PARA CASH MODULE ==========
  isCashOpen: false,
  cashData: null,
  cashHistory: [],
  
  empresa: { 
    nombre: 'NOMBRE DE SU NEGOCIO', 
    rif: 'J-00000000-0', 
    direccion: 'DIRECCIÓN FISCAL', 
    telefono: '0000-0000000' 
  },
  // DEPARTAMENTOS Y CATEGORÍAS EXISTENTES
  departamentos: ['Licores', 'Viveres', 'Otros'],
  categorias: ['Ron', 'Vino', 'Cerveza', 'Whisky', 'Refrescos', 'Otros'],
  marcas: ['Genérica'],
  presentaciones: ['750ml', '1L', 'Unidad', 'Caja'],
  proveedores: [],
  
  // ========== NUEVAS PROPIEDADES PARA ProductForm ==========
  // Configuración general
  config: {
    exchangeRate: 36.50,
    ivaRate: 16,
    igtfRate: 3
  },
  
  // Listas para el formulario de productos
  productCategories: ['Repuesto', 'Lubricante', 'Filtro', 'Químico', 'Accesorio', 'Batería', 'Caucho', 'Freno', 'Suspensión', 'Motor', 'Eléctrico', 'Transmisión', 'Servicio'],
  productUnits: ['unidad', 'litro', 'galón', 'cuarto', 'paila', 'kit', 'juego', 'par', 'metro', 'kilogramo', 'gramo', 'tambor'],
  productColors: ['No Aplica', 'Negro', 'Gris', 'Cromo', 'Rojo', 'Azul', 'Blanco', 'Ámbar'],
  productSizes: ['N/A', 'Estándar', '0.10', '0.20', '0.30', '0.40', '0.50', '20', '30', '40', '50', '60'],
  
  // Colecciones para el formulario (con estructura de objetos con id)
  brands: [], // { id: 1, name: 'Toyota' }
  groups: [], // { id: 1, name: 'Tren Delantero' }
  subgroups: [], // { id: 1, name: 'Amortiguadores', groupId: 1 }
  lines: [], // { id: 1, name: 'Línea Pesada' }
  suppliers: [], // { id: 1, name: 'Proveedor XYZ', code: 'RIF-123' }
  
  // Para compatibilidad con código existente que usa arrays de strings
  // Estos se mantienen pero ahora también tenemos las versiones con objetos
  marcasString: ['Genérica'],
  proveedoresString: [],
  
  // Para almacenar los productos con estructura completa
  products: [],
};

let dirty = false;
let writeChain: Promise<unknown> = Promise.resolve();

// Últimas copias locales de las colecciones raíz (espejo para la UI)
let lastProductos: any[] = [];
let lastMovimientos: any[] = [];

// Datos legacy que aún pudieran estar dentro de pos_system_data/state
let legacyProductos: any[] | null = null;
let legacyMovimientos: any[] | null = null;
let productosEmpty = true;
let movimientosEmpty = true;
let migrationStarted = false;

// Campos que se persisten dentro del doc pos_system_data/state.
// NUNCA incluye productos ni movimientos (viven en sus propias colecciones).
function buildPersist(state: AppState) {
  return {
    tasa: state.tasa,
    pinDevolucion: state.pinDevolucion,
    isInitialized: state.isInitialized ?? true,
    ventas: state.ventas || [],
    cxc: state.cxc || [],
    cxp: state.cxp || [],
    clientes: state.clientes || [],
    devoluciones: state.devoluciones || [],
    anulaciones: state.anulaciones || [],
    libroDiario: state.libroDiario || [],
    terminales: state.terminales || [],
    empresa: state.empresa,
    departamentos: state.departamentos,
    categorias: state.categorias,
    marcas: state.marcas,
    presentaciones: state.presentaciones,
    proveedores: state.proveedores,
    reportesZ: state.reportesZ || [],
    ultimoZ: state.ultimoZ || 0,
    proximoRecibo: state.proximoRecibo || 1,
    proximaDevolucion: state.proximaDevolucion || 1,
    proximaAnulacion: state.proximaAnulacion || 1,
    acumuladoHistorico: state.acumuladoHistorico || 0,
    fechaUltimoZ: state.fechaUltimoZ || '',
    fondoCajaHoyUSD: state.fondoCajaHoyUSD || 0,
    fondoCajaHoyBS: state.fondoCajaHoyBS || 0,
    
    // ========== PROPIEDADES PARA CASH MODULE ==========
    isCashOpen: state.isCashOpen || false,
    cashData: state.cashData || null,
    cashHistory: state.cashHistory || [],
    
    // ========== NUEVAS PROPIEDADES PARA ProductForm ==========
    config: state.config || initialState.config,
    productCategories: state.productCategories || initialState.productCategories,
    productUnits: state.productUnits || initialState.productUnits,
    productColors: state.productColors || initialState.productColors,
    productSizes: state.productSizes || initialState.productSizes,
    brands: state.brands || [],
    groups: state.groups || [],
    subgroups: state.subgroups || [],
    lines: state.lines || [],
    suppliers: state.suppliers || [],
    products: state.products || [],
    marcasString: state.marcasString || state.marcas || [],
    proveedoresString: state.proveedoresString || state.proveedores || [],
  };
}

// Firestore rechaza undefined (y NaN/Infinity) en cualquier profundidad:
// los elimina/normaliza para que un solo dato inválido no tumbe TODA la escritura.
function sanitizeForFirestore(value: any): any {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeForFirestore).filter(v => v !== undefined);
  }
  if (typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value)) {
      const v = sanitizeForFirestore(value[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return value;
}

// Sincroniza un array espejo (productos / movimientos) con su colección raíz,
// escribiendo por documento (merge) y eliminando solo los que ya no existen.
function syncArrayToCollection(name: string, prevArr: any[] | undefined, newArr: any[] | undefined): Promise<void> {
  if (!db) return Promise.resolve();
  const prevList = prevArr || [];
  const newList = newArr || [];
  const prevById = new Map(prevList.filter(x => x && x.id).map(x => [String(x.id), x]));
  const newIds = new Set(newList.filter(x => x && x.id).map(x => String(x.id)));

  const batch = writeBatch(db);
  let ops = 0;
  newList.forEach(x => {
    if (!x || !x.id) return;
    const before = prevById.get(String(x.id));
    const clean = sanitizeForFirestore(x);
    if (!before || JSON.stringify(sanitizeForFirestore(before)) !== JSON.stringify(clean)) {
      batch.set(doc(db, name, String(x.id)), clean, { merge: true });
      ops++;
    }
  });
  prevById.forEach((_x, id) => {
    if (!newIds.has(id)) {
      batch.delete(doc(db, name, id));
      ops++;
    }
  });
  if (ops === 0) return Promise.resolve();
  return batch.commit();
}

// Sincroniza productos con su colección raíz de forma ATOMICA para el stock:
// calcula deltas por producto y los aplica con transacciones de Firestore para que
// dos o más cajas no se pisen el inventario entre sí (sin last-write-wins con pérdida).
function syncProductosTransactional(prevArr: any[] | undefined, newArr: any[] | undefined): Promise<void> {
  if (!db) return Promise.resolve();
  const prevList = prevArr || [];
  const newList = newArr || [];
  const prevById = new Map(prevList.filter(x => x && x.id).map(x => [String(x.id), x]));
  const newById = new Map(newList.filter(x => x && x.id).map(x => [String(x.id), x]));

  const createdIds = [...newById.keys()].filter(id => !prevById.has(id));
  const changedIds = [...newById.keys()].filter(id =>
    prevById.has(id) &&
    JSON.stringify(sanitizeForFirestore(prevById.get(id))) !== JSON.stringify(sanitizeForFirestore(newById.get(id)))
  );
  const removedIds = [...prevById.keys()].filter(id => !newById.has(id));

  if (createdIds.length === 0 && changedIds.length === 0 && removedIds.length === 0) return Promise.resolve();

  return runTransaction(db, async (tx) => {
    for (const id of createdIds) {
      tx.set(doc(db, PRODUCTOS_COLLECTION, id), sanitizeForFirestore(newById.get(id)), { merge: true });
    }
    for (const id of changedIds) {
      const prevP = prevById.get(id) || {};
      const newP = newById.get(id) || {};
      const prevStock = typeof prevP.stock === 'number' ? prevP.stock : 0;
      const newStock = typeof newP.stock === 'number' ? newP.stock : 0;
      const delta = newStock - prevStock;
      const ref = doc(db, PRODUCTOS_COLLECTION, id);
      const snap = await tx.get(ref);
      const remote = snap.exists() ? snap.data() : null;
      const baseStock = remote && typeof remote.stock === 'number' ? remote.stock : (delta === 0 ? newStock : 0);
      tx.set(ref, sanitizeForFirestore({ ...newP, stock: baseStock + delta }), { merge: true });
    }
    for (const id of removedIds) {
      tx.delete(doc(db, PRODUCTOS_COLLECTION, id));
    }
  }).catch((e) => {
    console.error("Error transaccional productos:", e);
    return syncArrayToCollection(PRODUCTOS_COLLECTION, prevArr, newArr);
  });
}

// Elimina del doc de state los campos legacy productos/movimientos.
function cleanupLegacyStateDoc(): Promise<void> {
  if (!db) return Promise.resolve();
  const docRef = doc(db, COLLECTION, DOC_ID);
  return setDoc(docRef, { productos: deleteField(), movimientos: deleteField() }, { merge: true })
    .catch((e) => console.warn("Cleanup legacy state:", e));
}

// Migración automática e idempotente: si la colección raíz está vacía pero hay
// datos actuales (en caché o en el doc legacy), los copia sin perder información.
function attemptMigration() {
  if (migrationStarted) return;
  const local = Store.get();
  const srcProds = ((local.productos && local.productos.length ? local.productos : legacyProductos) || []);
  const srcMovs = ((local.movimientos && local.movimientos.length ? local.movimientos : legacyMovimientos) || []);
  const migrateProds = productosEmpty && srcProds.length > 0;
  const migrateMovs = movimientosEmpty && srcMovs.length > 0;
  if (!migrateProds && !migrateMovs) return;
  migrationStarted = true;
  writeChain = writeChain
    .then(async () => {
      if (migrateProds) await syncArrayToCollection(PRODUCTOS_COLLECTION, [], srcProds);
      if (migrateMovs) await syncArrayToCollection(MOVIMIENTOS_COLLECTION, [], srcMovs);
      await cleanupLegacyStateDoc();
    })
    .catch((e) => console.error("Migración de colecciones:", e));
}

export const Store = {
  subscribe(callback: (state: Partial<AppState>) => void) {
    if (typeof window === 'undefined' || !db) return () => {};

    const docRef = doc(db, COLLECTION, DOC_ID);
    lastProductos = Store.get().productos || [];
    lastMovimientos = Store.get().movimientos || [];

    const unsubState = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const val = snapshot.data();
        if (Array.isArray(val?.productos)) legacyProductos = val.productos;
        if (Array.isArray(val?.movimientos)) legacyMovimientos = val.movimientos;

        const remote = { ...initialState, ...val };
        delete (remote as any).carrito;
        delete (remote as any).productos;
        delete (remote as any).movimientos;
        remote.productos = lastProductos;
        remote.movimientos = lastMovimientos;

        const local = Store.get();
        const localPersist = buildPersist(local);
        const remotePersist = buildPersist(remote);

        if (dirty && JSON.stringify(localPersist) !== JSON.stringify(remotePersist)) {
          writeChain = writeChain
            .then(() => setDoc(docRef, sanitizeForFirestore(localPersist), { merge: true }))
            .then(() => { dirty = false; })
            .catch((e) => console.error("Sync heal error:", e));
          const dbUpdate = { ...remote, ...localPersist };
          callback(dbUpdate);
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...dbUpdate, carrito: local.carrito }));
        } else {
          dirty = false;
          callback(remote);
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
            ...remote,
            carrito: local.carrito,
            productos: lastProductos,
            movimientos: lastMovimientos,
          }));
        }
      } else {
        const local = Store.get();
        callback(local);

        const { carrito, ...toPersist } = initialState;
        if (db) setDoc(docRef, sanitizeForFirestore(toPersist), { merge: true }).catch(e => console.error("Error init firestore:", e));
      }
      attemptMigration();
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.warn("Firestore Sync Warning:", error);
      }
      callback(Store.get());
    });

    const unsubProductos = onSnapshot(query(collection(db, PRODUCTOS_COLLECTION)), (snap) => {
      const items = snap.docs.map(d => sanitizeForFirestore(d.data())).filter(Boolean);
      productosEmpty = items.length === 0;

      let result = items;
      if (items.length === 0) {
        const local = Store.get();
        if ((local.productos || []).length > 0) {
          result = local.productos; // local gana mientras no haya datos remotos (migración/offline)
        }
      }
      lastProductos = result;
      callback({ productos: result });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...Store.get(), productos: result, movimientos: lastMovimientos }));
      attemptMigration();
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.warn("Sync productos:", error);
      }
      callback({ productos: Store.get().productos || [] });
    });

    const unsubMovimientos = onSnapshot(query(collection(db, MOVIMIENTOS_COLLECTION)), (snap) => {
      const items = snap.docs.map(d => sanitizeForFirestore(d.data())).filter(Boolean);
      movimientosEmpty = items.length === 0;

      let result = items;
      if (items.length === 0) {
        const local = Store.get();
        if ((local.movimientos || []).length > 0) {
          result = local.movimientos;
        }
      }
      lastMovimientos = result;
      callback({ movimientos: result });
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...Store.get(), movimientos: result, productos: lastProductos }));
      attemptMigration();
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.warn("Sync movimientos:", error);
      }
      callback({ movimientos: Store.get().movimientos || [] });
    });

    return () => {
      unsubState();
      unsubProductos();
      unsubMovimientos();
    };
  },

  get(): AppState {
    if (typeof window === 'undefined') return initialState;
    const d = sessionStorage.getItem(STORAGE_KEY);
    if (!d) return initialState;
    try {
      const parsed = JSON.parse(d);
      return { ...initialState, ...parsed };
    } catch {
      return initialState;
    }
  },

  async set(patch: Partial<AppState>) {
    if (typeof window === 'undefined') return;

    const prev = Store.get();
    const full = { ...initialState, ...prev, ...patch };

    // 1) Productos / movimientos → sus propias colecciones raíz (por documento).
    if (patch.productos !== undefined) {
      writeChain = writeChain
        .then(() => syncProductosTransactional(prev.productos, full.productos))
        .catch((e) => console.error("Error persistiendo productos:", e));
    }
    if (patch.movimientos !== undefined) {
      writeChain = writeChain
        .then(() => syncArrayToCollection(MOVIMIENTOS_COLLECTION, prev.movimientos, full.movimientos))
        .catch((e) => console.error("Error persistiendo movimientos:", e));
    }

    // 2) El resto de campos → pos_system_data/state (solo los que cambiaron, merge).
    const prevPersist = buildPersist(prev) as Record<string, any>;
    const fullPersist = buildPersist(full) as Record<string, any>;
    const toWrite: Record<string, any> = {};
    for (const k of Object.keys(fullPersist)) {
      if (JSON.stringify(prevPersist[k]) !== JSON.stringify(fullPersist[k])) {
        const clean = sanitizeForFirestore(fullPersist[k]);
        if (clean !== undefined) toWrite[k] = clean;
      }
    }

    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...full, ...fullPersist }));

    if (Object.keys(toWrite).length === 0) return writeChain;
    dirty = true;

    if (db) {
      const docRef = doc(db, COLLECTION, DOC_ID);
      writeChain = writeChain
        .then(() => setDoc(docRef, toWrite, { merge: true }))
        .catch((e) => console.error("Error persistiendo:", e));
      return writeChain;
    }
  },

  uid(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }
};

export const Utils = {
  getVzlaDate: () => {
    const d = new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZone: 'America/Caracas',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    const formatter = new Intl.DateTimeFormat('en-CA', options);
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;
    const ms = String(d.getMilliseconds()).padStart(3, '0');
    return `${getPart('year')}-${getPart('month')}-${getPart('day')}T${getPart('hour')}:${getPart('minute')}:${getPart('second')}.${ms}`;
  },
  hoy: () => Utils.getVzlaDate().slice(0, 10),
  ahora: () => Utils.getVzlaDate(),
  round: (v: any) => {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : Math.round((n + Number.EPSILON) * 100) / 100;
  },
  fmtUSD: (v: number) => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  fmtBS: (v: number, symbol = true) => (symbol ? 'Bs. ' : '') + Number(v).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  fmtMono: (v: number, prefix = false) => (prefix ? '$' : '') + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  fmtFecha: (f: string) => {
    if (!f) return '-';
    const datePart = f.includes('T') ? f.split('T')[0] : f;
    const p = datePart.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  },
  metodoLabel: (m: string) => {
    const map: Record<string, string> = { 
      efectivo_usd: 'Efectivo USD', 
      efectivo_bs: 'Efectivo Bs.', 
      punto_venta: 'Punto de Venta', 
      biopago: 'Biopago',
      pagomovil: 'PagoMovil',
      zelle: 'Zelle',
      credito: 'Crédito', 
      mixto: 'Mixto',
      nota_credito: 'Vale / Nota Crédito',
      otros: 'Otros'
    };
    return map[m] || m;
  }
};
