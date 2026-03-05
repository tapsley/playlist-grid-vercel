import { prisma } from "../../../../lib/prisma";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getServerSession } from "next-auth/next";

export async function GET(_req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session || !(session as any).user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(_req.url);
  const pathname = url.pathname; // format: /api/notes/YYYY-MM-DD
  const parts = pathname.split("/");
  const dateStr = parts[parts.length - 1];
  
  const dateObj = new Date(dateStr);

  const note = await prisma.note.findUnique({ where: { userId_date: { userId: (session as any).user.id, date: dateObj } as any } });
  if (!note) return new Response(null, { status: 404 });
  return new Response(JSON.stringify({ id: note.id, date: note.date.toISOString().slice(0, 10), title: note.title, body: note.body }), { headers: { "Content-Type": "application/json" } });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions as any);
  if (!session || !(session as any).user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const pathname = url.pathname; // format: /api/notes/YYYY-MM-DD
  const parts = pathname.split("/");
  const dateStr = parts[parts.length - 1];
  const payload = await req.json();
  const { title, body: content } = payload as { title?: string; body?: string };
  const dateObj = new Date(dateStr);

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

  const url = new URL(_req.url);
  const pathname = url.pathname; // format: /api/notes/YYYY-MM-DD
  const parts = pathname.split("/");
  const dateStr = parts[parts.length - 1];
  const dateObj = new Date(dateStr);

  await prisma.note.deleteMany({ where: { userId: (session as any).user.id, date: dateObj } });
  return new Response(null, { status: 204 });
}
