import { NextRequest, NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth';
import { db, uid } from '@/lib/store';

export async function POST(req: NextRequest) {
  const user = currentUser();
  if (!user) return unauthorized();
  const { courtId = null, date, startHour } = await req.json();
  const entry = { id: uid('w'), memberId: user.id, courtId, date, startHour, createdAt: new Date().toISOString() };
  db().waitlist.push(entry);
  return NextResponse.json({ entry }, { status: 201 });
}
