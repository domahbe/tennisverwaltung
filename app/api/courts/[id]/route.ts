import { NextRequest, NextResponse } from 'next/server';
import { currentUser, forbidden, unauthorized } from '@/lib/auth';
import { audit, db } from '@/lib/store';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = currentUser();
  if (!user) return unauthorized();
  if (user.role !== 'admin' && user.role !== 'trainer') return forbidden();

  const court = db().courts.find((c) => c.id === params.id);
  if (!court) return NextResponse.json({ error: 'Platz nicht gefunden' }, { status: 404 });

  const body = await req.json();
  if (typeof body.blocked === 'boolean') {
    court.blocked = body.blocked;
    court.blockedReason = body.blocked ? (body.reason ?? 'Gesperrt') : undefined;
    court.maintenanceUntil = body.blocked ? body.until : undefined;
    audit(user.name, `${court.name} ${body.blocked ? 'gesperrt' : 'freigegeben'}`);
  }
  return NextResponse.json({ court });
}
