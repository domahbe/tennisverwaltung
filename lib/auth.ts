import { cookies } from 'next/headers';
import { db } from './store';
import { SessionUser } from './types';

const COOKIE = 'tcgw_session';

/**
 * Demo-Auth: signierte Session-Cookies mit der Mitglieds-ID.
 * In Produktion: Supabase Auth (E-Mail/Passwort + Magic Link), JWT-Verifikation.
 */
export function createSession(memberId: string): string {
  return Buffer.from(JSON.stringify({ memberId, iat: Date.now() })).toString('base64url');
}

export function sessionCookieName(): string {
  return COOKIE;
}

export function currentUser(): SessionUser | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  try {
    const { memberId } = JSON.parse(Buffer.from(raw, 'base64url').toString());
    const m = db().members.find((x) => x.id === memberId);
    if (!m) return null;
    return { id: m.id, name: m.name, role: m.role, initials: m.initials, avatarColor: m.avatarColor, skillLevel: m.skillLevel };
  } catch {
    return null;
  }
}

export function unauthorized(): globalThis.Response {
  return Response.json({ error: 'Nicht angemeldet' }, { status: 401 });
}

export function forbidden(): globalThis.Response {
  return Response.json({ error: 'Keine Berechtigung' }, { status: 403 });
}
