import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import type { Session } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// GET /api/user/settings -> returns user's settings JSON
export async function GET(req: NextRequest) {
  const sessionRaw: unknown = await getServerSession(authOptions as any);
  const session = sessionRaw as Session | null;
  if (!session || !session.user || !session.user.email) return new Response('Unauthorized', { status: 401 });
  const email = session.user.email;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    const settings = (user && (user as any).settings) || null;
    return Response.json({ settings });
  } catch (err) {
    console.debug('fetch user settings failed', err);
    return new Response('Server error', { status: 500 });
  }
}

// POST /api/user/settings -> body: { settings: {...} }
export async function POST(req: NextRequest) {
  const sessionRaw: unknown = await getServerSession(authOptions as any);
  const session = sessionRaw as Session | null;
  if (!session || !session.user || !session.user.email) return new Response('Unauthorized', { status: 401 });
  const email = session.user.email;
  try {
    const body = await req.json();
    const settings = body?.settings ?? null;
    if (settings === null) {
      // allow clearing
      await prisma.user.update({ where: { email }, data: { settings: Prisma.DbNull } });
      return new Response(null, { status: 204 });
    }
    // basic validation: only allow known keys
    const allowed: Record<string, boolean> = { playStartAnimation: true, showTimer: true };
    const filtered: any = {};
    for (const k of Object.keys(settings || {})) {
      if (allowed[k]) filtered[k] = settings[k];
    }
    await prisma.user.update({ where: { email }, data: { settings: filtered } });
    return new Response(null, { status: 204 });
  } catch (err) {
    console.debug('save user settings failed', err);
    return new Response('Server error', { status: 500 });
  }
}
