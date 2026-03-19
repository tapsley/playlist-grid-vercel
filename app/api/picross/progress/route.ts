import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/picross/progress?date=YYYY-MM-DD
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  if (!dateStr) return new Response("Missing date", { status: 400 });
  const date = new Date(dateStr);
  const progress = await prisma.picrossProgress.findUnique({
    where: { userId_date: { userId: session.user.id, date } },
  });
  return Response.json(progress);
}

// POST /api/picross/progress
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const body = await req.json();
  const { date, easy, medium, hard, easyComplete, mediumComplete, hardComplete } = body;
  if (!date) return new Response("Missing date", { status: 400 });
  // If a progress row exists, only update the difficulties provided in the request.
  const existing = await prisma.picrossProgress.findUnique({
    where: { userId_date: { userId: session.user.id, date: new Date(date) } },
  });

  const defaultEasy = Array(5).fill(0).map(() => Array(5).fill(0));
  const defaultMedium = Array(10).fill(0).map(() => Array(10).fill(0));
  const defaultHard = Array(15).fill(0).map(() => Array(15).fill(0));

  const easyGrid = easy ?? (existing?.easy as any) ?? defaultEasy;
  const mediumGrid = medium ?? (existing?.medium as any) ?? defaultMedium;
  const hardGrid = hard ?? (existing?.hard as any) ?? defaultHard;

  const easyCompleteFlag = typeof easyComplete === "boolean" ? easyComplete : (existing?.easyComplete ?? false);
  const mediumCompleteFlag = typeof mediumComplete === "boolean" ? mediumComplete : (existing?.mediumComplete ?? false);
  const hardCompleteFlag = typeof hardComplete === "boolean" ? hardComplete : (existing?.hardComplete ?? false);

  let progress;
  if (existing) {
    progress = await prisma.picrossProgress.update({
      where: { id: existing.id },
      data: {
        easy: easyGrid,
        medium: mediumGrid,
        hard: hardGrid,
        easyComplete: easyCompleteFlag,
        mediumComplete: mediumCompleteFlag,
        hardComplete: hardCompleteFlag,
      },
    });
  } else {
    progress = await prisma.picrossProgress.create({
      data: {
        user: { connect: { id: session.user.id } },
        date: new Date(date),
        easy: easyGrid,
        medium: mediumGrid,
        hard: hardGrid,
        easyComplete: easyCompleteFlag,
        mediumComplete: mediumCompleteFlag,
        hardComplete: hardCompleteFlag,
      },
    });
  }
  return Response.json(progress);
}
