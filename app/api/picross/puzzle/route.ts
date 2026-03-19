import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/picross/puzzle?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  if (!dateStr) return new Response("Missing date", { status: 400 });
  const date = new Date(dateStr);
  const puzzle = await prisma.picrossPuzzle.findUnique({ where: { date } });
  if (!puzzle) return new Response("Not found", { status: 404 });
  return Response.json(puzzle);
}
