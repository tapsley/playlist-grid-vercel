import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const easy = await prisma.picrossProgress.count({ where: { userId: session.user.id, easyComplete: true } });
  const medium = await prisma.picrossProgress.count({ where: { userId: session.user.id, mediumComplete: true } });
  const hard = await prisma.picrossProgress.count({ where: { userId: session.user.id, hardComplete: true } });

  return new Response(JSON.stringify({ easy, medium, hard }), { status: 200, headers: { "Content-Type": "application/json" } });
}
