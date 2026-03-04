import { prisma } from "../../../lib/prisma";
import { authOptions } from "../auth/[...nextauth]/route";
import { getServerSession } from "next-auth/next";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions as any);
  console.log('session in /api/notes GET:', session);
  if (!session || !session.user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const ym = url.searchParams.get("ym"); // format: YYYY-MM
  

  if (ym) {
    const [yStr, mStr] = ym.split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    if (Number.isNaN(y) || Number.isNaN(m)) {
      return new Response("Invalid ym parameter", { status: 400 });
    }
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);
    const notes = await prisma.note.findMany({
      where: { userId: session.user.id, date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
    });
    const payload = notes.map((n) => ({ id: n.id, date: n.date.toISOString().slice(0, 10), title: n.title, body: n.body }));
    return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
  }

  const notes = await prisma.note.findMany({ where: { userId: session.user.id }, orderBy: { date: "asc" } });
  const payload = notes.map((n) => ({ id: n.id, date: n.date.toISOString().slice(0, 10), title: n.title, body: n.body }));
  return new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session || !session.user) return new Response("Unauthorized", { status: 401 });

  const body = await req.json();
  const { date, title, body: content } = body as { date?: string; title?: string; body?: string };
  if (!date) return new Response("Missing date", { status: 400 });
  const dateObj = new Date(date);

  // upsert by composite unique (userId + date)
  const note = await prisma.note.upsert({
    where: { userId_date: { userId: session.user.id, date: dateObj } as any },
    update: { title: title ?? null, body: content ?? null },
    create: { userId: session.user.id, date: dateObj, title: title ?? null, body: content ?? null },
  });

  return new Response(JSON.stringify({ id: note.id, date: note.date.toISOString().slice(0, 10), title: note.title, body: note.body }), { headers: { "Content-Type": "application/json" } });
}
