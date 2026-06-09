import { NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth';
import { db } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = currentUser();
  if (!user) return unauthorized();
  const notifications = db().notifications.filter((n) => n.memberId === user.id);
  return NextResponse.json({ notifications, unread: notifications.filter((n) => !n.read).length });
}

export async function POST() {
  const user = currentUser();
  if (!user) return unauthorized();
  for (const n of db().notifications) if (n.memberId === user.id) n.read = true;
  return NextResponse.json({ ok: true });
}
