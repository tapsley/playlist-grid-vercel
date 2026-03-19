import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Example: Add a 5x5 heart puzzle for 2026-03-18, easy
  await prisma.picrossPuzzle.create({
    data: {
      date: new Date('2026-03-19'),
      easy: Array(5).fill(0).map(() => Array(5).fill(true)),
      medium: Array(10).fill(0).map(() => Array(10).fill(true)),
      hard: Array(15).fill(0).map(() => Array(15).fill(true)),
    },
  });
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
