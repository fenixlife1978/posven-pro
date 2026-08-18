'use client';

import { db } from '@/lib/firebase';
import { collection, getDocs, setDoc, doc, writeBatch } from 'firebase/firestore';
import { Store } from '@/lib/db-store';

// Claves de las colecciones persistidas (AppState -> colección en Firestore).
// Deben coincidir con COLLECTIONS en db-store.ts. Aquí se reutilizan para
// forzar la hidratación completa y para reconstruir el respaldo.
const COLLECTION_KEYS = [
  'productos', 'movimientos', 'ventas', 'cxc', 'cxp', 'clientes', 'proveedores',
  'devoluciones', 'anulaciones', 'terminales', 'libroDiario', 'reportesZ',
  'cashHistory', 'compras',
] as const;

// Claves de catálogos (catalogos/{nombre} con { lista }).
const CATALOG_KEYS = [
  'categorias', 'departamentos', 'marcas', 'presentaciones',
  'productCategories', 'productUnits', 'productColors', 'productSizes',
  'brands', 'groups', 'subgroups', 'lines', 'suppliers',
] as const;

// Claves de configuración (config/general).
const CONFIG_KEYS = [
  'tasa', 'pinDevolucion', 'isInitialized', 'empresa',
  'proximoRecibo', 'proximaDevolucion', 'proximaAnulacion',
  'ultimoZ', 'fechaUltimoZ', 'acumuladoHistorico',
  'fondoCajaHoyUSD', 'fondoCajaHoyBS', 'isCashOpen', 'cashData', 'config',
] as const;

export interface BackupFile {
  app: 'posven-pro';
  version: number;
  createdAt: string;
  data: Record<string, unknown>;
}

// Fuerza la carga completa de todas las colecciones para que el respaldo
// incluya TODO el histórico (ventas/libroDiario están completos, no solo lo
// posterior al último Z).
async function hidratarTodo(): Promise<void> {
  const jobs = COLLECTION_KEYS.map((k) => Store.ensureLoaded(k).catch(() => {}));
  await Promise.all(jobs);
}

// Crea el objeto de respaldo con el estado completo actual del sistema.
export async function crearRespaldo(): Promise<BackupFile> {
  await hidratarTodo();
  const state = Store.get() as Record<string, any>;

  const data: Record<string, unknown> = {};

  for (const k of COLLECTION_KEYS) data[k] = state[k] ?? [];
  for (const k of CATALOG_KEYS) data[k] = state[k] ?? [];
  for (const k of CONFIG_KEYS) data[k] = state[k];

  // Usuarios (ajenos a AppState): se leen de la colección `users`.
  try {
    const snap = await getDocs(collection(db, 'users'));
    data.users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('backup: no se pudieron leer usuarios', e);
    data.users = [];
  }

  return {
    app: 'posven-pro',
    version: 1,
    createdAt: new Date().toISOString(),
    data,
  };
}

// Descarga el respaldo como archivo .json en el navegador.
export function descargarRespaldo(backup: BackupFile) {
  const nombre = `Respaldo_POSVEN_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Lee y valida un archivo de respaldo subido.
export async function leerArchivoRespaldo(file: File): Promise<BackupFile | null> {
  if (!file) return null;
  const text = await file.text();
  const parsed = JSON.parse(text) as BackupFile;
  if (!parsed || parsed.app !== 'posven-pro' || typeof parsed.data !== 'object') {
    throw new Error('El archivo no es un respaldo válido de POSVEN-Pro.');
  }
  return parsed;
}

// Restaura completamente el sistema a partir de un respaldo: escribe todas
// las colecciones, catálogos, config y usuarios en Firestore vía Store.set.
export async function restaurarRespaldo(backup: BackupFile): Promise<void> {
  const d = backup.data || {};

  const patch: Record<string, any> = {};
  for (const k of COLLECTION_KEYS) patch[k] = (d[k] as any[]) ?? [];
  for (const k of CATALOG_KEYS) patch[k] = (d[k] as any[]) ?? [];
  for (const k of CONFIG_KEYS) patch[k] = d[k];

  // Se persiste todo de una vez (colecciones + catálogos + config).
  await Store.set(patch as any);

  // Usuarios: se reescriben por documento en la colección `users`.
  const users = (d.users as any[]) || [];
  if (users.length > 0) {
    const batch = writeBatch(db);
    for (const u of users) {
      const { id, ...perfil } = u;
      const ref = doc(db, 'users', String(id || perfil.uid || ''));
      batch.set(ref, perfil, { merge: true });
    }
    await batch.commit();
  }
}

// Restaura desde el botón "Cargar Respaldo" (recibe un File).
export async function cargarRespaldoDesdeArchivo(file: File): Promise<void> {
  const backup = await leerArchivoRespaldo(file);
  if (!backup) return;
  await restaurarRespaldo(backup);
}