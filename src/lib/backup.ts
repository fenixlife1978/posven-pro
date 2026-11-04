'use client';

const COLLECTION_KEYS = [
  'productos', 'movimientos', 'ventas', 'cxc', 'cxp', 'clientes', 'proveedores',
  'devoluciones', 'anulaciones', 'terminales', 'libroDiario', 'reportesZ',
  'cashHistory', 'compras',
] as const;

const TABLE_MAP: Record<string, string> = {
  cashHistory: 'caja',
};

const CATALOG_KEYS = [
  'categorias', 'departamentos', 'marcas', 'presentaciones',
  'productCategories', 'productUnits', 'productColors', 'productSizes',
  'brands', 'groups', 'subgroups', 'lines', 'suppliers',
] as const;

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
  meta?: {
    tursoTables: Record<string, number>;
    catalogs: Record<string, number>;
    source: 'turso';
  };
}

async function readTursoTable(table: string, pageSize = 10000): Promise<any[]> {
  const request = async (params: URLSearchParams) => {
    const response = await fetch('/api/turso/store?' + params.toString(), {
      credentials: 'include',
      cache: 'no-store',
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) {
      throw new Error(body?.error || 'No se pudo leer la tabla ' + table + ' desde Turso.');
    }
    return body;
  };

  // El total se consulta por separado para no confundir el límite máximo de
  // una página con el total real de registros de la tabla.
  const count = await request(new URLSearchParams({ table, special: 'count' }));
  const expected = Number(count?.total);
  if (!Number.isSafeInteger(expected) || expected < 0) {
    throw new Error('Turso devolvió un total inválido para la tabla ' + table + '.');
  }

  const records: any[] = [];
  for (let offset = 0; offset < expected; offset += pageSize) {
    const params = new URLSearchParams({
      table,
      limit: String(Math.min(pageSize, expected - offset)),
      offset: String(offset),
    });
    const page = await request(params);
    const rows = Array.isArray(page?.records) ? page.records : [];
    if (!rows.length) {
      throw new Error('El respaldo de ' + table + ' quedó incompleto: se esperaban ' + expected + ' registros y la lectura se detuvo en ' + records.length + '.');
    }
    records.push(...rows);
  }

  // Detecta altas/bajas concurrentes durante la exportación en vez de entregar
  // silenciosamente un respaldo con un conteo inconsistente.
  const finalCount = await request(new URLSearchParams({ table, special: 'count' }));
  if (Number(finalCount?.total) !== expected || records.length !== expected) {
    throw new Error('La tabla ' + table + ' cambió mientras se generaba el respaldo. Vuelva a generar la copia para evitar datos incompletos.');
  }
  return records;
}

async function readTursoSpecial(kind: 'config' | 'catalog', name = ''): Promise<any> {
  const params = new URLSearchParams({ special: kind });
  if (name) params.set('name', name);
  const response = await fetch('/api/turso/store?' + params.toString(), {
    credentials: 'include',
    cache: 'no-store',
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.error || 'No se pudo leer ' + kind + ' desde Turso.');
  }
  return kind === 'config' ? (body.config || {}) : (Array.isArray(body.lista) ? body.lista : []);
}

export async function crearRespaldo(): Promise<BackupFile> {
  const data: Record<string, unknown> = {};
  const tursoTables: Record<string, number> = {};
  const catalogs: Record<string, number> = {};

  for (const key of COLLECTION_KEYS) {
    const table = TABLE_MAP[key] || key;
    const rows = await readTursoTable(table);
    data[key] = rows;
    tursoTables[table] = rows.length;
  }

  for (const key of CATALOG_KEYS) {
    const rows = await readTursoSpecial('catalog', key);
    data[key] = rows;
    catalogs[key] = rows.length;
  }

  const config = await readTursoSpecial('config');
  for (const key of CONFIG_KEYS) {
    if (config[key] !== undefined) data[key] = config[key];
  }

  const usersResponse = await fetch('/api/users', { credentials: 'include', cache: 'no-store' });
  const usersBody = await usersResponse.json().catch(() => ({}));
  if (usersResponse.ok) {
    const users = Array.isArray(usersBody?.usuarios) ? usersBody.usuarios : (Array.isArray(usersBody?.users) ? usersBody.users : []);
    data.users = users;
    tursoTables.users = users.length;
  }

  return {
    app: 'posven-pro',
    version: 3,
    createdAt: new Date().toISOString(),
    data,
    meta: { tursoTables, catalogs, source: 'turso' },
  };
}

function descargarCredencialesTemporales(credentials: Array<{ username: string; password: string; rol: string }>) {
  if (!credentials.length) return;
  const lines = [
    'POSVEN PRO - CREDENCIALES TEMPORALES DE USUARIOS RESTAURADOS',
    'Cambie cada contraseña después del primer inicio de sesión.',
    'Guarde este archivo en un lugar privado y elimínelo cuando ya no lo necesite.',
    '',
    'Usuario | Rol | Contraseña temporal',
    ...credentials.map(item => item.username + ' | ' + item.rol + ' | ' + item.password),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'POSVEN_credenciales_temporales.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function descargarRespaldo(backup: BackupFile) {
  const nombre = 'Respaldo_POSVEN_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
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

export async function leerArchivoRespaldo(file: File): Promise<BackupFile | null> {
  if (!file) return null;
  const text = await file.text();
  const parsed = JSON.parse(text) as BackupFile;
  if (!parsed || parsed.app !== 'posven-pro' || typeof parsed.data !== 'object') {
    throw new Error('El archivo no es un respaldo válido de POSVEN-Pro.');
  }
  return parsed;
}

async function restaurarBackupTurso(
  backup: BackupFile,
  onProgress?: (progress: { percent: number; stage: string; detail: string }) => void,
): Promise<void> {
  const TABLES = [
    'productos','movimientos','ventas','cxc','cxp','clientes','proveedores',
    'devoluciones','anulaciones','terminales','libroDiario','reportesZ','caja','compras',
  ] as const;
  const CATALOGS = CATALOG_KEYS;
  const BATCH_SIZE = 450;

  const backupRowsForTable = (name: typeof TABLES[number]): any[] => {
    const source = name === 'caja' ? backup.data.cashHistory ?? backup.data.caja : backup.data[name];
    return Array.isArray(source) ? source as any[] : [];
  };

  const backupUsers = Array.isArray(backup.data.users) ? backup.data.users as any[] : [];
  const totalRows = TABLES.reduce((sum, name) => sum + backupRowsForTable(name).length, 0)
    + CATALOGS.reduce((sum, name) => sum + (Array.isArray(backup.data[name]) ? (backup.data[name] as any[]).length : 0), 0)
    + backupUsers.length + 1;
  let completed = 0;

  const report = (stage: string, detail: string) => {
    const percent = Math.min(99, Math.round((completed / Math.max(totalRows, 1)) * 100));
    onProgress?.({ percent, stage, detail });
  };

  const post = async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/turso/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      cache: 'no-store',
      body: JSON.stringify(payload),
    });
    const raw = await response.text();
    let body: any = {};
    try { body = raw ? JSON.parse(raw) : {}; } catch { body = { error: raw || 'Respuesta no válida.' }; }
    if (!response.ok || body?.ok === false) throw new Error(body?.error || ('Error HTTP ' + response.status + ' al restaurar el respaldo.'));
    return body;
  };

  report('Preparando', 'Conectando con Turso…');
  await post({ action: 'reset' });

  for (const name of TABLES) {
    const rows = backupRowsForTable(name);
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      if (!batch.length) continue;
      await post({ action: 'table', table: name, rows: batch });
      completed += batch.length;
      report('Datos', name + ': ' + Math.min(i + batch.length, rows.length) + ' de ' + rows.length);
    }
  }

  for (const name of CATALOGS) {
    const rows = Array.isArray(backup.data[name]) ? backup.data[name] as any[] : [];
    await post({ action: 'catalog', name, rows });
    completed += rows.length;
    report('Catálogos', name + ': ' + rows.length + ' registros');
  }

  const config: Record<string, unknown> = {};
  for (const key of CONFIG_KEYS) if (backup.data[key] !== undefined) config[key] = backup.data[key];
  if (Object.keys(config).length) await post({ action: 'config', config });
  let restoredUsers = 0;
  if (backupUsers.length) {
    const result = await post({ action: 'users', rows: backupUsers });
    const credentials = Array.isArray(result?.credentials) ? result.credentials : [];
    restoredUsers = Number(result?.restored || 0);
    descargarCredencialesTemporales(credentials);
    completed += backupUsers.length;
    report('Usuarios', restoredUsers + ' cuentas recuperadas. Se descargó el archivo privado de contraseñas temporales.');
  }
  await post({ action: 'finish' });
  onProgress?.({ percent: 100, stage: 'Completado', detail: 'Restauración finalizada en Turso. Usuarios recuperados: ' + restoredUsers + '. Revise el archivo de credenciales temporales descargado.' });
}

export async function restaurarRespaldo(backup: BackupFile): Promise<void> {
  await restaurarBackupTurso(backup);
}

export async function cargarRespaldoDesdeArchivo(
  file: File,
  onProgress?: (progress: { percent: number; stage: string; detail: string }) => void,
): Promise<void> {
  const backup = await leerArchivoRespaldo(file);
  if (!backup) return;
  await restaurarBackupTurso(backup, onProgress);
}
