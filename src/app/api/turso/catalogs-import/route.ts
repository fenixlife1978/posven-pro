import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth/turso-auth';
import { assertTursoReady } from '@/lib/turso/pos-store';
import { tursoInteractiveTransaction } from '@/lib/turso/client';

export const runtime = 'nodejs';

const CATALOGS = ['departamentos', 'categorias'] as const;
type CatalogName = typeof CATALOGS[number];

function normalizeLabel(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('es');
}

function validateBackup(backup: any): Record<CatalogName, string[]> {
  if (!backup || backup.app !== 'posven-pro' || backup.type !== 'catalogs-only' ||
      !backup.data || typeof backup.data !== 'object' || Array.isArray(backup.data)) {
    throw new Error('El archivo no es un respaldo exclusivo de catálogos POSVEN.');
  }
  const keys = Object.keys(backup.data).sort();
  if (keys.length !== 2 || keys[0] !== 'categorias' || keys[1] !== 'departamentos') {
    throw new Error('El archivo debe contener únicamente departamentos y categorías.');
  }
  const output = {} as Record<CatalogName, string[]>;
  for (const name of CATALOGS) {
    const list = backup.data[name];
    if (!Array.isArray(list) || list.length > 100) throw new Error('El catálogo ' + name + ' debe ser una lista de máximo 100 elementos.');
    if (list.some((item: unknown) => typeof item !== 'string' || !String(item).trim() || String(item).length > 120)) {
      throw new Error('El catálogo ' + name + ' contiene valores vacíos o inválidos.');
    }
    output[name] = list.map((item: string) => item.trim());
  }
  return output;
}

function mergeList(current: unknown[], incoming: string[]) {
  const values: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...current, ...incoming]) {
    if (typeof raw !== 'string') continue;
    const value = raw.trim();
    const key = normalizeLabel(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    values.push(value);
  }
  const currentKeys = new Set(current.filter((x): x is string => typeof x === 'string').map(normalizeLabel).filter(Boolean));
  const importedKeys = incoming.map(normalizeLabel).filter(Boolean);
  return {
    values,
    before: current.length,
    imported: incoming.length,
    added: new Set(importedKeys.filter(key => !currentKeys.has(key))).size,
    duplicates: importedKeys.length - new Set(importedKeys).size,
    after: values.length,
  };
}

async function readCatalog(tx: { execute: (statement: { sql: string; args?: unknown[] }) => Promise<any> }, name: CatalogName): Promise<unknown[]> {
  const result = await tx.execute({ sql: 'SELECT lista_json FROM catalogos WHERE nombre=? LIMIT 1', args: [name] });
  if (!result.rows?.length) return [];
  try {
    const parsed = JSON.parse(String(result.rows[0].lista_json || '[]'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error('El catálogo actual ' + name + ' contiene JSON inválido; no se modificó nada.');
  }
}

async function requireAdmin() {
  assertTursoReady();
  const cookieStore = await cookies();
  const user = await getSessionUser(cookieStore.get('posven_session')?.value);
  if (!user) throw Object.assign(new Error('No autenticado.'), { status: 401 });
  if (user.rol !== 'administrador') throw Object.assign(new Error('Se requiere administrador.'), { status: 403 });
  return user;
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) return NextResponse.json({ ok: false, error: 'Solicitud de origen no permitido.' }, { status: 403 });
    await requireAdmin();
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 65536) return NextResponse.json({ ok: false, error: 'El archivo supera el límite de 64 KB.' }, { status: 413 });
    const body = JSON.parse(raw);
    const action = String(body?.action || '');
    const incoming = validateBackup(body?.backup);
    if (action !== 'preview' && action !== 'import') throw new Error('Acción de importación no reconocida.');
    if (action === 'import' && body?.confirmation !== 'IMPORTAR_SOLO_CATALOGOS') throw new Error('Falta la confirmación explícita de importación.');

    const result = await tursoInteractiveTransaction(async tx => {
      const plan = {} as Record<CatalogName, ReturnType<typeof mergeList>>;
      for (const name of CATALOGS) plan[name] = mergeList(await readCatalog(tx, name), incoming[name]);
      if (action === 'import') {
        for (const name of CATALOGS) await tx.execute({
          sql: 'INSERT INTO catalogos(nombre,lista_json,data_json,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(nombre) DO UPDATE SET lista_json=excluded.lista_json, updated_at=CURRENT_TIMESTAMP',
          args: [name, JSON.stringify(plan[name].values), '{}'],
        });
      }
      return { plan, catalogs: { departamentos: plan.departamentos.values, categorias: plan.categorias.values } };
    });

    return NextResponse.json({ ok: true, action, ...result, protectedScope: ['catalogos.departamentos', 'catalogos.categorias'], untouched: ['productos', 'movimientos', 'ventas', 'compras', 'caja', 'clientes', 'proveedores', 'usuarios', 'demás catálogos'] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: any) {
    const message = String(error?.message || error);
    const status = Number(error?.status) || (message.includes('no está configurado') ? 503 : message.includes('No autenticado') ? 401 : message.includes('Se requiere administrador') ? 403 : 400);
    return NextResponse.json({ ok: false, error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
