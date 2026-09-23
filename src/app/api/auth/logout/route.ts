import { NextRequest, NextResponse } from 'next/server';
import { revokeSession } from '@/lib/auth/turso-auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await revokeSession(request.cookies.get('posven_session')?.value);
  } finally {
    const response = NextResponse.json({ ok: true });
    response.cookies.set('posven_session', '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
    return response;
  }
}
