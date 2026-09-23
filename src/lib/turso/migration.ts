import { randomBytes } from 'node:crypto';
import { tursoExecute, tursoTransaction } from '@/lib/turso/client';
import { createMigratedUser, hashPassword } from '@/lib/auth/turso-auth';

export type FirebaseBackup = {
  app?: string;
  version?: number;
  createdAt?: string;
  data?: Record<string, any>;
  meta?: any;
};

const COLLECTION_TABLES: Record<string, string> = {
  productos: 'productos',
  movimientos: 'movimientos',
  ventas: 'ventas',
  cxc: 'cxc',
  cxp: 'cxp',
  clientes: 'clientes',
  proveedores: 'proveedores',
  devoluciones: 'devoluciones',
  anulaciones: 'anulaciones',
  terminales: 'terminales',
  libroDiario: 'libro_diario',
  reportesZ: 'reportes_z',
  cashHistory: 'caja',
  compras: 'compras',
};

const CATALOG_KEYS = [
  'categorias', 'departamentos', 'marcas', 'presentaciones',
  'productCategories', 'productUnits', 'productColors', 'productSizes',
  'brands', 'groups', 'subgroups', 'lines', 'suppliers',
];

const AUXILIARY_TABLES: Record<string, string> = {
  operaciones: 'operaciones',
  auditoriaSistema: 'auditoria_sistema',
};

function asRows(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function rowId(row: any, index: number) {
  return String(row?.id ?? row?.uid ?? `legacy_${index}`);
}

function extractFecha(row: any) {
  const value = row?.fecha ?? row?.createdAt ?? row?.fechaCreacion ?? row?.created_at ?? null;
  return value == null ? null : String(value);
}

function safeJson(value: any) {
  return JSON.stringify(value ?? {});
}

function generatedPassword() {
  return 'PV-' + randomBytes(18).toString('base64url');
}

export function validateFirebaseBackup(backup: FirebaseBackup) {
  if (!backup || backup.app !== 'posven-pro' || !backup.data || typeof backup.data !== 'object') {
    throw new Error('El archivo no es un respaldo válido de POSVEN-Pro.');
  }
  return {
    version: Number(backup.version || 0),
    createdAt: backup.createdAt || null,
    users: asRows(backup.data.users).length,
    terminales: asRows(backup.data.terminales).length,
    ventas: asRows(backup.data.ventas).length,
    movimientos: asRows(backup.data.movimientos).length,
    caja: asRows(backup.data.cashHistory).length,
    reportesZ: asRows(backup.data.reportesZ).length,
  };
}

export async function importarRespaldoFirebase(
  backup: FirebaseBackup,
  options: {
    passwordByFirebaseUid?: Record<string, string>;
    dryRun?: boolean;
  } = {},
) {
  const summary = validateFirebaseBackup(backup);
  const data = backup.data!;
  const dryRun = options.dryRun !== false;

  if (dryRun) return { mode: 'dry-run', ...summary };

  const runId = 'migration_' + Date.now().toString(36) + '_' + randomBytes(6).toString('hex');
  const startedAt = new Date().toISOString();

  await tursoExecute({
    sql: `INSERT INTO migration_runs (id, source, backup_version, started_at, status, counts_json)
      VALUES (?, 'firebase', ?, ?, 'running', ?)`,
    args: [runId, Number(backup.version || 0), startedAt, safeJson(summary)],
    wantRows: false,
  });

  try {
    // Primero perfiles: conservar Firebase UID como identidad primaria cuando no haya conflicto.
    for (const row of asRows(data.users)) {
      const firebaseUid = String(row.uid || row.firebaseUid || row.id || '').trim();
      if (!firebaseUid) continue;

      const username = String(
        row.username ||
        row.usuario ||
        row.email?.split('@')[0] ||
        ('cajero_' + firebaseUid.slice(0, 8))
      ).trim().toLowerCase();

      const password = options.passwordByFirebaseUid?.[firebaseUid] || generatedPassword();
      const user = await createMigratedUser({
        firebaseUid,
        username,
        email: row.email || null,
        nombre: String(row.nombre || username).trim(),
        password,
        rol: row.rol === 'administrador' ? 'administrador' : 'cajero',
        fechaCreacion: row.fechaCreacion || null,
        dataJson: safeJson(row),
      });

      await tursoExecute({
        sql: `INSERT INTO user_identity_map (source, legacy_user_id, user_id, firebase_uid)
          VALUES ('firebase', ?, ?, ?)
          ON CONFLICT(source, legacy_user_id) DO UPDATE SET
            user_id=excluded.user_id, firebase_uid=excluded.firebase_uid`,
        args: [String(row.id || firebaseUid), user?.id || firebaseUid, firebaseUid],
        wantRows: false,
      });
    }

    for (const [key, table] of Object.entries(COLLECTION_TABLES)) {
      const rows = asRows(data[key]);
      for (let index = 0; index < rows.length; index++) {
        const row = rows[index];
        const id = rowId(row, index);
        await tursoExecute({
          sql: `INSERT INTO ${table} (id, data_json, fecha, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
              data_json=excluded.data_json,
              fecha=excluded.fecha,
              updated_at=CURRENT_TIMESTAMP`,
          args: [id, safeJson(row), extractFecha(row)],
          wantRows: false,
        });
      }
    }

    for (const key of CATALOG_KEYS) {
      const rows = asRows(data[key]);
      await tursoExecute({
        sql: `INSERT INTO catalogos (nombre, lista_json, data_json, updated_at)
          VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(nombre) DO UPDATE SET
            lista_json=excluded.lista_json,
            data_json=excluded.data_json,
            updated_at=CURRENT_TIMESTAMP`,
        args: [key, safeJson(rows), safeJson({ nombre: key, lista: rows })],
        wantRows: false,
      });
    }

    for (const [key, table] of Object.entries(AUXILIARY_TABLES)) {
      for (let index = 0; index < asRows(data[key]).length; index++) {
        const row = asRows(data[key])[index];
        const id = rowId(row, index);
        if (table === 'operaciones') {
          await tursoExecute({
            sql: `INSERT INTO operaciones (id, prefijo, operation_id, data_json)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                prefijo=excluded.prefijo, operation_id=excluded.operation_id, data_json=excluded.data_json`,
            args: [
              id,
              String(row.prefijo || row.prefix || 'legacy'),
              String(row.operationId || row.operation_id || id),
              safeJson(row),
            ],
            wantRows: false,
          });
        } else {
          await tursoExecute({
            sql: `INSERT INTO auditoria_sistema (id, tipo, terminal_id, usuario_id, fecha, data_json)
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT(id) DO UPDATE SET
                tipo=excluded.tipo, terminal_id=excluded.terminal_id,
                usuario_id=excluded.usuario_id, fecha=excluded.fecha,
                data_json=excluded.data_json`,
            args: [
              id,
              row.tipo || null,
              row.terminalId || row.terminal_id || null,
              row.usuarioId || row.usuario_id || row.uid || null,
              extractFecha(row),
              safeJson(row),
            ],
            wantRows: false,
          });
        }
      }
    }

    for (const [path, value] of Object.entries(data)) {
      if (path === 'pos_system_data/state' || path === 'data/state') {
        await tursoExecute({
          sql: `INSERT INTO legacy_documents (path, data_json, present)
            VALUES (?, ?, 1)
            ON CONFLICT(path) DO UPDATE SET data_json=excluded.data_json, present=1, imported_at=CURRENT_TIMESTAMP`,
          args: [path, safeJson(value)],
          wantRows: false,
        });
      }
    }

    await tursoExecute({
      sql: `UPDATE migration_runs SET finished_at=?, status='completed', counts_json=? WHERE id=?`,
      args: [new Date().toISOString(), safeJson(summary), runId],
      wantRows: false,
    });

    return { mode: 'imported', runId, ...summary };
  } catch (error: any) {
    await tursoExecute({
      sql: `UPDATE migration_runs SET finished_at=?, status='failed', notes=? WHERE id=?`,
      args: [new Date().toISOString(), String(error?.message || error), runId],
      wantRows: false,
    }).catch(() => {});
    throw error;
  }
}

export async function verificarMigracionFirebase(backup: FirebaseBackup) {
  const expected = validateFirebaseBackup(backup);
  const data = backup.data || {};
  const counts: Record<string, number> = {};
  for (const table of Object.values(COLLECTION_TABLES)) {
    const result = await tursoExecute({ sql: `SELECT COUNT(*) AS total FROM ${table}` });
    counts[table] = Number(result.rows[0]?.total || 0);
  }
  const users = await tursoExecute({ sql: 'SELECT COUNT(*) AS total FROM users WHERE firebase_uid IS NOT NULL' });
  const identities = await tursoExecute({ sql: "SELECT COUNT(*) AS total FROM user_identity_map WHERE source='firebase'" });
  const identityRows = await tursoExecute({
    sql: `SELECT json_extract(data_json,'$.usuarioId') AS usuario_id FROM terminales
      WHERE json_extract(data_json,'$.usuarioId') IS NOT NULL`,
  });
  let terminalIdentityMissing = 0;
  for (const row of identityRows.rows) {
    const uid = String(row.usuario_id || '');
    const found = await tursoExecute({
      sql: 'SELECT 1 FROM users WHERE id=? OR firebase_uid=? LIMIT 1',
      args: [uid, uid],
    });
    if (!found.rows.length) terminalIdentityMissing++;
  }

  const expectedCounts = {
    users: asRows(data.users).length,
    terminales: asRows(data.terminales).length,
    ventas: asRows(data.ventas).length,
    movimientos: asRows(data.movimientos).length,
    caja: asRows(data.cashHistory).length,
    reportesZ: asRows(data.reportesZ).length,
  };
  const checks = {
    usersCount: Number(users.rows[0]?.total || 0) >= expectedCounts.users,
    terminalesCount: counts.terminales >= expectedCounts.terminales,
    ventasCount: counts.ventas >= expectedCounts.ventas,
    movimientosCount: counts.movimientos >= expectedCounts.movimientos,
    cajaCount: counts.caja >= expectedCounts.caja,
    reportesZCount: counts.reportes_z >= expectedCounts.reportesZ,
    identityMap: Number(identities.rows[0]?.total || 0) >= expectedCounts.users,
    terminalUserReferences: terminalIdentityMissing === 0,
  };
  return {
    expected: expectedCounts,
    actual: {
      users: Number(users.rows[0]?.total || 0),
      terminales: counts.terminales,
      ventas: counts.ventas,
      movimientos: counts.movimientos,
      caja: counts.caja,
      reportesZ: counts.reportes_z,
      firebaseIdentityMap: Number(identities.rows[0]?.total || 0),
    },
    terminalIdentityMissing,
    checks,
    ok: Object.values(checks).every(Boolean),
  };
}
