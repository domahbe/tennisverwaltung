import { NextRequest, NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth';
import { db } from '@/lib/store';

export async function POST(req: NextRequest) {
  const user = currentUser();
  if (!user) return unauthorized();
  const { memberId } = await req.json();
  const me = db().members.find((m) => m.id === user.id);
  if (!me) return unauthorized();
  if (me.favorites.includes(memberId)) {
    me.favorites = me.favorites.filter((id) => id !== memberId);
  } else {
    me.favorites.push(memberId);
  }
  return NextResponse.json({ favorites: me.favorites });
}
