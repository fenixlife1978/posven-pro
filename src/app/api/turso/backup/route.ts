import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createSession, getSessionUser, hashPassword } from '@/lib/auth/turso-auth';
import { tursoInteractiveTransaction } from '@/lib/turso/client';
import {
  assertTursoReady,
  factoryResetTransaction,
  upsertRecords,
  patchAppConfig,
  patchCatalog,
  type TursoStoreTable,
} from '@/lib/turso/pos-store';

export const runtime = 'nodejs';

const TABLES = [
  'productos','movimientos','ventas','cxc','cxp','clientes','proveedores',
  'devoluciones','anulaciones','terminales','libroDiario','reportesZ','caja','compras',
] as const;

const CATALOGS = [
  'categorias','departamentos','marcas','presentaciones',
  'productCategories','productUnits','productColors','productSizes',
  'brands','groups','subgroups','lines','suppliers',
] as const;

type TableName = typeof TABLES[number];
type CatalogName = typeof CATALOGS[number];

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
    const user = await requireAdmin();
    const body = await request.json();
    const action = String(body?.action || '');

    if (action === 'reset') {
      const result = await factoryResetTransaction({ user });
      // El reset elimina las sesiones para limpiar completamente la base de datos.
      // Debemos crear inmediatamente una nueva sesión para que los siguientes
      // bloques del respaldo sigan autenticados sin obligar al usuario a volver a entrar.
      const session = await createSession(String(result.seedAdmin.id));
      const response = NextResponse.json({ ok: true, action, ...result });
      response.cookies.set('posven_session', session.id, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        expires: new Date(session.expires),
      });
      return response;
    }

    if (action === 'table') {
      const table = String(body?.table || '') as TableName;
      if (!TABLES.includes(table)) throw new Error('Tabla de respaldo no permitida.');
      const rows = Array.isArray(body?.rows) ? body.rows : [];
      if (rows.length > 450) throw new Error('El lote supera el límite seguro de 450 registros.');
      const result = await upsertRecords(table as TursoStoreTable, rows);
      return NextResponse.json({ ok: true, action, table, count: result.count });
    }

    if (action === 'catalog') {
      const name = String(body?.name || '') as CatalogName;
      if (!CATALOGS.includes(name)) throw new Error('Catálogo de respaldo no permitido.');
      const rows = Array.isArray(body?.rows) ? body.rows : [];
      await patchCatalog(name, rows);
      return NextResponse.json({ ok: true, action, name, count: rows.length });
    }

    if (action === 'config') {
      const config = body?.config;
      if (!config || typeof config !== 'object' || Array.isArray(config)) {
        throw new Error('Configuración de respaldo inválida.');
      }
      await patchAppConfig(config);
      return NextResponse.json({ ok: true, action });
    }


    if (action === 'users') {
      const rows = Array.isArray(body?.rows) ? body.rows : [];
      if (rows.length > 300) throw new Error('El respaldo contiene más de 300 usuarios; divida la restauración en lotes.');
      const prepared = rows.map((row: any) => {
        const username = String(row?.username || '').trim().toLowerCase();
        const nombre = String(row?.nombre || '').trim();
        const rol = String(row?.rol || '').toLowerCase();
        if (!username || !nombre || !['administrador', 'cajero'].includes(rol)) {
          throw new Error('El respaldo contiene un usuario sin nombre, usuario o rol válido. No se importó ningún usuario.');
        }
        return {
          id: String(row?.id || ('usr_' + randomBytes(18).toString('hex'))),
          username,
          email: row?.email ? String(row.email).trim().toLowerCase() : null,
          nombre,
          rol,
          blocked: row?.accesoBloqueado === true || Number(row?.acceso_bloqueado || 0) === 1,
          created: row?.fechaCreacion ? String(row.fechaCreacion) : new Date().toISOString(),
          password: randomBytes(15).toString('base64url'),
        };
      }).filter((row: any) => row.username !== 'admin');

      const credentials: Array<{ username: string; password: string; rol: string }> = [];
      const now = new Date().toISOString();
      await tursoInteractiveTransaction(async tx => {
        const seed = await tx.execute({
          sql: "SELECT id FROM users WHERE username='admin' AND is_seed_admin=1 LIMIT 1",
        });
        if (!seed.rows.length) throw new Error('No existe el administrador semilla de Turso; se cancela la recuperación de usuarios.');

        for (const row of prepared) {
          const byId = await tx.execute({ sql: 'SELECT id, username, is_seed_admin FROM users WHERE id=? LIMIT 1', args: [row.id] });
          const byUsername = await tx.execute({ sql: 'SELECT id, is_seed_admin FROM users WHERE lower(username)=? LIMIT 1', args: [row.username] });
          const existing = byId.rows[0] || byUsername.rows[0];
          if (existing && Number(existing.is_seed_admin || 0) === 1) continue;
          if (existing && String(existing.id) !== row.id) {
            throw new Error('Conflicto de identidad para el usuario ' + row.username + '. Se canceló toda la importación para evitar romper referencias históricas.');
          }

          const emailConflict = row.email
            ? await tx.execute({ sql: 'SELECT id FROM users WHERE lower(email)=? AND id<>? LIMIT 1', args: [row.email, row.id] })
            : { rows: [] };
          if (emailConflict.rows.length) {
            throw new Error('El correo del usuario ' + row.username + ' ya pertenece a otra cuenta. Se canceló toda la importación.');
          }

          const passwordHash = hashPassword(row.password);
          await tx.execute({
            sql: `INSERT INTO users
              (id, username, email, nombre, rol, password_hash, acceso_bloqueado, is_seed_admin, fecha_creacion, data_json, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, '{}', ?)
              ON CONFLICT(id) DO UPDATE SET
                username=excluded.username, email=excluded.email, nombre=excluded.nombre,
                rol=excluded.rol, password_hash=excluded.password_hash,
                acceso_bloqueado=excluded.acceso_bloqueado,
                fecha_creacion=excluded.fecha_creacion, updated_at=excluded.updated_at
            `,
            args: [row.id, row.username, row.email, row.nombre, row.rol, passwordHash, row.blocked ? 1 : 0, row.created, now],
            wantRows: false,
          });
          await tx.execute({
            sql: 'DELETE FROM sessions WHERE user_id=?',
            args: [row.id],
            wantRows: false,
          });
          credentials.push({ username: row.username, password: row.password, rol: row.rol });
        }
      });
      return NextResponse.json({ ok: true, action, restored: credentials.length, credentials });
    }

    if (action === 'finish') {
      return NextResponse.json({
        ok: true,
        action,
        skipped: ['operaciones','auditoriaSistema','legacy_documents','rtdb_productos'],
        note: 'Usuarios del respaldo procesados; se conserva el administrador semilla de Turso.',
      });
    }

    throw new Error('Acción de restauración no reconocida.');
  } catch (error: any) {
    const message = String(error?.message || error);
    const status = Number(error?.status) || (
      message.includes('no está configurado') ? 503 :
      message.includes('No autenticado') ? 401 :
      message.includes('Se requiere administrador') ? 403 : 400
    );
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
