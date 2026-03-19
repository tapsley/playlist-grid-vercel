import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const date = new Date(dateStr);

  // Example puzzles (replace with your own!):
  const easy = [
    [false, true, false, true, false],
    [true, true, true, true, true],
    [true, true, true, true, true],
    [false, true, true, true, false],
    [false, false, true, false, false],
  ];
  const medium = Array(10).fill(0).map(() => Array(10).fill(true));
  const hard = Array(15).fill(0).map(() => Array(15).fill(true));

  await prisma.picrossPuzzle.upsert({
    where: { date },
    update: { easy, medium, hard },
    create: { date, easy, medium, hard },
  });
  console.log('Seeded PicrossPuzzle for', dateStr);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
