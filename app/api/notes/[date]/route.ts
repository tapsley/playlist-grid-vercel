import { prisma } from "../../../../lib/prisma";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getServerSession } from "next-auth/next";

function parseDateOnlyToUtc(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

function getDateStrFromPath(req: Request): string {
  const url = new URL(req.url);
  const pathname = url.pathname;
  const parts = pathname.split("/");
  return decodeURIComponent(parts[parts.length - 1]);
}

export async function GET(_req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session || !(session as any).user) return new Response("Unauthorized", { status: 401 });

  const dateStr = getDateStrFromPath(_req);
  const dateObj = parseDateOnlyToUtc(dateStr);
  if (!dateObj) return new Response("Invalid date", { status: 400 });

  const note = await prisma.note.findUnique({ where: { userId_date: { userId: (session as any).user.id, date: dateObj } as any } });
  if (!note) return new Response(null, { status: 404 });
  return new Response(JSON.stringify({ id: note.id, date: note.date.toISOString().slice(0, 10), title: note.title, body: note.body }), { headers: { "Content-Type": "application/json" } });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session || !(session as any).user) return new Response("Unauthorized", { status: 401 });

  const dateStr = getDateStrFromPath(req);
  const payload = await req.json();
  const { title, body: content } = payload as { title?: string; body?: string };
  const dateObj = parseDateOnlyToUtc(dateStr);
  if (!dateObj) return new Response("Invalid date", { status: 400 });

  const updated = await prisma.note.upsert({
    where: { userId_date: { userId: (session as any).user.id, date: dateObj } as any },
    update: { title: title ?? null, body: content ?? null },
    create: { userId: (session as any).user.id, date: dateObj, title: title ?? null, body: content ?? null },
  });

  return new Response(JSON.stringify({ id: updated.id, date: updated.date.toISOString().slice(0, 10), title: updated.title, body: updated.body }), { headers: { "Content-Type": "application/json" } });
}

export async function DELETE(_req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session || !(session as any).user) return new Response("Unauthorized", { status: 401 });

  const dateStr = getDateStrFromPath(_req);
  const dateObj = parseDateOnlyToUtc(dateStr);
  if (!dateObj) return new Response("Invalid date", { status: 400 });

  await prisma.note.deleteMany({ where: { userId: (session as any).user.id, date: dateObj } });
  return new Response(null, { status: 204 });
}
