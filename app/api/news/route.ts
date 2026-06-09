import { NextResponse } from 'next/server';
import { currentUser, unauthorized } from '@/lib/auth';
import { db } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!currentUser()) return unauthorized();
  const news = db()
    .news.slice()
    .sort((a, b) => (a.pinned === b.pinned ? b.date.localeCompare(a.date) : a.pinned ? -1 : 1));
  return NextResponse.json({ news });
}
