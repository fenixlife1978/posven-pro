import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/turso-auth';
import { isTursoConfigured } from '@/lib/turso/client';
import { importarRespaldoFirebase, validateFirebaseBackup } from '@/lib/turso/migration';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isTursoConfigured()) return NextResponse.json({ error: 'Turso no está configurado.' }, { status: 503 });
  const cookie = request.headers.get('cookie') || '';
  const sessionId = cookie.match(/(?:^|;\s*)posven_session=([^;]+)/)?.[1] || null;
  const user = await getSessionUser(sessionId);
  if (!user || user.rol !== 'administrador') {
    return NextResponse.json({ error: 'Se requiere un administrador Turso.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const backup = body?.backup;
    const validation = validateFirebaseBackup(backup);
    if (body?.dryRun !== false) return NextResponse.json({ ok: true, ...validation, mode: 'dry-run' });
    if (body?.confirm !== 'MIGRAR_FIREBASE_A_TURSO') {
      return NextResponse.json({ error: 'Falta confirmación explícita MIGRAR_FIREBASE_A_TURSO.' }, { status: 400 });
    }

    const result = await importarRespaldoFirebase(backup, {
      dryRun: false,
      passwordByFirebaseUid: body?.passwordByFirebaseUid || {},
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'No se pudo ejecutar la migración.' }, { status: 400 });
  }
}
