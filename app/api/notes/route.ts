import { prisma } from "../../../lib/prisma";
import { authOptions } from "../auth/[...nextauth]/route";
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

function parseYmToUtcRange(ym: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!year || month < 1 || month > 12) return null;
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
  };
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session || !(session as any).user) return new Response("Unauthorized", { status: 401 }) as any;

  const url = new URL(req.url);
  const ym = url.searchParams.get("ym"); // format: YYYY-MM
  
  const userId = (session as any).user.id;

  if (ym) {
    const range = parseYmToUtcRange(ym);
    if (!range) {
      return new Response("Invalid ym parameter", { status: 400 });
    }
    const notes = await prisma.note.findMany({
      where: { userId: userId, date: { gte: range.start, lt: range.end } },
      orderBy: { date: "asc" },
    });
    const payload = notes.map((n) => ({ id: n.id, date: n.date.toISOString().slice(0, 10), title: n.title, body: n.body }));
    return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
  }

  const notes = await prisma.note.findMany({ where: { userId: (session as any).user.id }, orderBy: { date: "asc" } });
  const payload = notes.map((n) => ({ id: n.id, date: n.date.toISOString().slice(0, 10), title: n.title, body: n.body }));
  return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session || !(session as any).user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { date, title, body: content } = body as { date?: string; title?: string; body?: string };
  if (!date) return new Response("Missing date", { status: 400 });
  const dateObj = parseDateOnlyToUtc(date);
  if (!dateObj) return new Response("Invalid date", { status: 400 });

  // upsert by composite unique (userId + date)
  const note = await prisma.note.upsert({
    where: { userId_date: { userId: (session as any).user.id, date: dateObj } as any },
    update: { title: title ?? null, body: content ?? null },
    create: { userId: (session as any).user.id, date: dateObj, title: title ?? null, body: content ?? null },
  });

  return new Response(JSON.stringify({ id: note.id, date: note.date.toISOString().slice(0, 10), title: note.title, body: note.body }), { headers: { "Content-Type": "application/json" } });
}
