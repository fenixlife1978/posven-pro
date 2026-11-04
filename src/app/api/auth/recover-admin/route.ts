import { randomBytes, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSession, hashPassword } from '@/lib/auth/turso-auth';
import { ensureTursoSchema } from '@/lib/turso/schema-init';
import { tursoInteractiveTransaction } from '@/lib/turso/client';

export const runtime = 'nodejs';

function validRecoveryToken(received: string, expected: string) {
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  return a.length === b.length && a.length >= 32 && timingSafeEqual(a, b);
}

/**
 * One-time, environment-gated recovery for the existing EDWIN administrator.
 * Configure POSVEN_ADMIN_RECOVERY_TOKEN (32+ random characters) in Production,
 * invoke once with that token, then remove the environment variable.
 */
export async function POST(request: Request) {
  try {
    const expectedToken = String(process.env.POSVEN_ADMIN_RECOVERY_TOKEN || '');
    const body = await request.json().catch(() => ({}));
    const receivedToken = String(body?.recoveryToken || '');

    if (!expectedToken || !validRecoveryToken(receivedToken, expectedToken)) {
      return NextResponse.json({ error: 'Recuperación no autorizada.' }, { status: 401 });
    }

    await ensureTursoSchema();

    const temporaryPassword = randomBytes(18).toString('base64url');
    const passwordHash = hashPassword(temporaryPassword);
    const now = new Date().toISOString();

    const userId = await tursoInteractiveTransaction(async tx => {
      const used = await tx.execute({
        sql: "SELECT id FROM admin_recovery_state WHERE id='edwin' LIMIT 1",
      });
      if (used.rows.length) throw new Error('El procedimiento de recuperación ya fue utilizado.');

      const found = await tx.execute({
        sql: "SELECT id, rol FROM users WHERE lower(username)='edwin' LIMIT 1",
      });
      const user = found.rows[0];
      if (!user || String(user.rol) !== 'administrador') {
        throw new Error('No se encontró la cuenta EDWIN con rol de administrador. No se modificó ningún usuario.');
      }

      await tx.execute({
        sql: 'UPDATE users SET password_hash=?, acceso_bloqueado=0, updated_at=? WHERE id=?',
        args: [passwordHash, now, String(user.id)],
        wantRows: false,
      });
      await tx.execute({
        sql: 'UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL',
        args: [now, String(user.id)],
        wantRows: false,
      });
      await tx.execute({
        sql: "INSERT INTO admin_recovery_state (id, used_at) VALUES ('edwin', ?)",
        args: [now],
        wantRows: false,
      });
      return String(user.id);
    });

    const session = await createSession(userId);
    const response = NextResponse.json({
      ok: true,
      username: 'edwin',
      temporaryPassword,
      message: 'Contraseña temporal generada. Inicie sesión y cámbiela inmediatamente.',
    });
    response.cookies.set('posven_session', session.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(session.expires),
    });
    return response;
  } catch (error: any) {
    const message = String(error?.message || error);
    const status = message.includes('ya fue utilizado') ? 409
      : message.includes('No se encontró la cuenta') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
