import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

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

// POST /api/picross/puzzle
// body: { date: 'YYYY-MM-DD', difficulty: 'easy'|'medium'|'hard', puzzle: boolean[][] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { date: dateStr, difficulty, puzzle } = body as { date?: string; difficulty?: string; puzzle?: unknown };
    if (!dateStr || !difficulty || !Array.isArray(puzzle)) {
      return new Response("Invalid body", { status: 400 });
    }
    const date = new Date(dateStr);

    // Ensure difficulty is one of the expected
    const allowed = new Set(["easy", "medium", "hard"]);
    if (!allowed.has(difficulty)) return new Response("Invalid difficulty", { status: 400 });

    // Upsert: if row exists update only the provided difficulty field, otherwise create a row
    const existing = await prisma.picrossPuzzle.findUnique({ where: { date } });
    if (existing) {
      const updateData: any = {};
      updateData[difficulty] = puzzle;
      await prisma.picrossPuzzle.update({ where: { date }, data: updateData });
      return new Response(null, { status: 204 });
    }

    // Create a new row: set the provided difficulty and fill other difficulties with empty arrays sized appropriately
    const defaults: Record<string, any> = {
      easy: Array(5).fill(0).map(() => Array(5).fill(false)),
      medium: Array(10).fill(0).map(() => Array(10).fill(false)),
      hard: Array(15).fill(0).map(() => Array(15).fill(false)),
    };
    const createData: any = { date };
    for (const d of Object.keys(defaults)) createData[d] = defaults[d];
    createData[difficulty] = puzzle;

    await prisma.picrossPuzzle.create({ data: createData });
    return new Response(null, { status: 201 });
  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500 });
  }
}
