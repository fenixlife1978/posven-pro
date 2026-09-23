import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth/turso-auth';
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

const BATCH_SIZE = 450;

export async function POST(request: Request) {
  try {
    assertTursoReady();
    const cookieStore = await cookies();
    const user = await getSessionUser(cookieStore.get('posven_session')?.value);
    if (!user) return NextResponse.json({ ok: false, error: 'No autenticado.' }, { status: 401 });
    if (user.rol !== 'administrador') {
      return NextResponse.json({ ok: false, error: 'Se requiere administrador.' }, { status: 403 });
    }

    const body = await request.json();
    const backup = body?.backup;
    if (!backup || backup.app !== 'posven-pro' || !backup.data || typeof backup.data !== 'object') {
      throw new Error('El archivo no es un respaldo válido de POSVEN-Pro.');
    }

    // El respaldo reemplaza el contenido actual de la base de pruebas.
    // El administrador semilla se conserva para garantizar el acceso posterior.
    await factoryResetTransaction({ user });

    const restored: Record<string, number> = {};
    for (const name of TABLES) {
      const rows = Array.isArray(backup.data[name]) ? backup.data[name] : [];
      let count = 0;
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        if (!batch.length) continue;
        const result = await upsertRecords(name as TursoStoreTable, batch);
        count += result.count;
      }
      restored[name] = count;
    }

    for (const name of CATALOGS) {
      const value = Array.isArray(backup.data[name]) ? backup.data[name] : [];
      await patchCatalog(name, value);
    }

    const config: Record<string, unknown> = {};
    const configKeys = [
      'tasa','pinDevolucion','isInitialized','empresa',
      'proximoRecibo','proximaDevolucion','proximaAnulacion',
      'ultimoZ','fechaUltimoZ','acumuladoHistorico',
      'fondoCajaHoyUSD','fondoCajaHoyBS','isCashOpen','cashData','config',
    ];
    for (const key of configKeys) {
      if (backup.data[key] !== undefined) config[key] = backup.data[key];
    }
    if (Object.keys(config).length) await patchAppConfig(config);

    return NextResponse.json({
      ok: true,
      restored,
      catalogs: CATALOGS.length,
      skipped: ['users','operaciones','auditoriaSistema','legacy_documents','rtdb_productos'],
      note: 'Los perfiles de usuarios del respaldo no se restauran porque el respaldo original no contiene credenciales de autenticación. Se conserva el administrador semilla de Turso.',
    });
  } catch (error: any) {
    const message = String(error?.message || error);
    const status = message.includes('no está configurado') ? 503
      : message.includes('No autenticado') ? 401
      : message.includes('Se requiere administrador') ? 403 : 400;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
