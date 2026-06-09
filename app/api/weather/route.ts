import { NextRequest, NextResponse } from 'next/server';
import { weatherFor } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  return NextResponse.json({ weather: weatherFor(date) });
}
