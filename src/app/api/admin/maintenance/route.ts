import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { getRequestSessionId, getSessionUser } from '@/lib/auth/turso-auth';
import { isTursoConfigured, tursoInteractiveTransaction } from '@/lib/turso/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Herramienta de mantenimiento deliberadamente limitada.
// Nunca acepta SQL arbitrario ni expone tablas de autenticación/sesiones.
const READ_TABLES: Record<string, string> = {
  productos: 'productos',
  movimientos: 'movimientos',
  ventas: 'ventas',
  compras: 'compras',
  cxc: 'cxc',
  cxp: 'cxp',
  clientes: 'clientes',
  proveedores: 'proveedores',
  terminales: 'terminales',
  caja: 'caja',
  libroDiario: 'libro_diario',
  reportesZ: 'reportes_z',
  devoluciones: 'devoluciones',
  anulaciones: 'anulaciones',
};

function normalize(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[\\u200B-\\u200D\\uFEFF]/g, '')
    .replace(/\\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('es');
}

async function requireAdmin(request: Request) {
  const user = await getSessionUser(getRequestSessionId(request));
  if (!user || user.rol !== 'administrador') {
    throw new Error('Se requiere una sesión activa de administrador POSVEN.');
  }
  return user;
}

function statusFor(error: unknown) {
  const message = String((error as any)?.message || error);
  return {
    message,
    status: message.includes('Turso no está configurado') ? 503
      : message.includes('Se requiere una sesión') ? 403 : 400,
  };
}

export async function GET(request: Request) {
  try {
    if (!isTursoConfigured()) throw new Error('Turso no está configurado.');
    await requireAdmin(request);
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'inventory-summary';

    if (action === 'inventory-summary') {
      const result = await tursoInteractiveTransaction(async tx => {
        const products = await tx.execute({
          sql: 'SELECT id,data_json,updated_at FROM productos ORDER BY id',
          args: [],
        });
        const rows = products.rows.map((row: any) => {
          let data: any = {};
          try { data = JSON.parse(String(row.data_json || '{}')); } catch {}
          return { ...data, id: String(row.id), updated_at: row.updated_at ?? null };
        });
        const groups = new Map<string, { departamento: string; categoria: string; total: number; activos: number; stock: number }>();
        for (const p of rows) {
          const departamento = String(p.departamento ?? '');
          const categoria = String(p.categoria ?? '');
          const key = normalize(departamento) + '|' + normalize(categoria);
          const group = groups.get(key) || { departamento, categoria, total: 0, activos: 0, stock: 0 };
          group.total++;
          if (p.activo) group.activos++;
          group.stock += Number(p.stock) || 0;
          groups.set(key, group);
        }
        return {
          totalProductos: rows.length,
          grupos: [...groups.values()].sort((a, b) => a.departamento.localeCompare(b.departamento) || a.categoria.localeCompare(b.categoria)),
          munchy: rows.filter(p => normalize(p.categoria) === 'MUNCHY').map(p => ({
            id: p.id, codigo: p.codigo ?? null, nombre: p.nombre ?? null,
            departamento: p.departamento ?? null, categoria: p.categoria ?? null,
            activo: p.activo ?? null, stock: p.stock ?? null, costoUSD: p.costoUSD ?? null,
          })),
        };
      });
      return NextResponse.json({ ok: true, action, ...result }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const tableKey = String(url.searchParams.get('table') || '');
    const table = READ_TABLES[tableKey];
    if (!table) throw new Error('Tabla no autorizada para lectura.');
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get('limit') || 100)));
    const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));
    const result = await tursoInteractiveTransaction(async tx => {
      const rows = await tx.execute({
        sql: `SELECT id,data_json,fecha,updated_at FROM ${table} ORDER BY COALESCE(fecha,updated_at,'') DESC,id DESC LIMIT ? OFFSET ?`,
        args: [limit, offset],
      });
      return rows.rows.map((row: any) => {
        let data: any = {};
        try { data = JSON.parse(String(row.data_json || '{}')); } catch {}
        return { ...data, id: String(row.id), ...(row.fecha ? { _fecha: row.fecha } : {}), ...(row.updated_at ? { _updatedAt: row.updated_at } : {}) };
      });
    });
    return NextResponse.json({ ok: true, table: tableKey, limit, offset, count: result.length, records: result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { message, status } = statusFor(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    if (!isTursoConfigured()) throw new Error('Turso no está configurado.');
    const user = await requireAdmin(request);
    const body = await request.json();
    if (body?.operation !== 'reclassify-products') {
      throw new Error('Operación de mantenimiento no autorizada.');
    }
    const fromDepartment = String(body.fromDepartment ?? '').trim();
    const toDepartment = String(body.toDepartment ?? '').trim();
    const category = String(body.category ?? '').trim();
    const dryRun = body.dryRun !== false;
    if (!fromDepartment || !toDepartment || !category) {
      throw new Error('Departamento de origen, destino y categoría son obligatorios.');
    }
    if (normalize(fromDepartment) === normalize(toDepartment)) {
      throw new Error('El departamento de origen y destino son iguales.');
    }
    if (!dryRun && body.confirm !== 'CONFIRMAR_RECLASIFICACION_POSVEN') {
      throw new Error('Falta confirmación explícita CONFIRMAR_RECLASIFICACION_POSVEN.');
    }

    const result = await tursoInteractiveTransaction(async tx => {
      const selected = await tx.execute({ sql: 'SELECT id,data_json FROM productos ORDER BY id', args: [] });
      const matches: any[] = [];
      for (const row of selected.rows) {
        let data: any = {};
        try { data = JSON.parse(String(row.data_json || '{}')); } catch {}
        if (normalize(data.departamento) === normalize(fromDepartment) &&
            normalize(data.categoria) === normalize(category)) {
          matches.push({ id: String(row.id), data });
        }
      }

      if (!dryRun) {
        for (const match of matches) {
          const updated = { ...match.data, id: match.id, departamento: toDepartment };
          await tx.execute({
            sql: 'UPDATE productos SET data_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',
            args: [JSON.stringify(updated), match.id],
            wantRows: false,
          });
        }
        const auditId = 'AUD-MAINT-' + randomUUID();
        await tx.execute({
          sql: 'INSERT INTO auditoria_sistema(id,tipo,terminal_id,usuario_id,fecha,data_json,created_at) VALUES(?,?,?,?,?,?,CURRENT_TIMESTAMP)',
          args: [auditId, 'RECLASIFICACION_DEPARTAMENTO', null, user.id, new Date().toISOString(), JSON.stringify({
            operacion: 'reclassify-products',
            fromDepartment, toDepartment, category,
            affectedCount: matches.length,
            affectedProducts: matches.map(p => ({ id: p.id, codigo: p.data.codigo ?? null, nombre: p.data.nombre ?? null })),
          })],
          wantRows: false,
        });
      }
      return {
        dryRun,
        fromDepartment,
        toDepartment,
        category,
        affectedCount: matches.length,
        products: matches.map(p => ({ id: p.id, codigo: p.data.codigo ?? null, nombre: p.data.nombre ?? null, departamentoActual: p.data.departamento ?? null, categoria: p.data.categoria ?? null })),
      };
    });

    return NextResponse.json({ ok: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const { message, status } = statusFor(error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
