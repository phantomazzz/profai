import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { SEED_QUESTIONS } from '@profai/shared';

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));

interface ProfessionRaw {
  id: string;
  title: string;
  riasec_code: string;
  income: { start: number; mid: number; max: number };
  source_note: string;
  growth_path: string;
  skills: string[];
  companies: string[];
  trait_tags: string[];
  motivation_tags: string[];
  first_steps: string[];
}

async function seedQuestions() {
  await prisma.question.deleteMany();
  for (const q of SEED_QUESTIONS) {
    await prisma.question.create({
      data: {
        block: q.block,
        scaleKey: q.scaleKey,
        text: q.text,
        orderIndex: q.orderIndex,
        isReverse: q.isReverse,
        scaleType: q.scaleType,
      },
    });
  }
  const total = await prisma.question.count();
  console.log(`✓ questions: ${total} (ожидается 124)`);
  if (total !== 124) throw new Error(`Ожидалось 124 вопроса, засеяно ${total}`);
}

async function seedProfessions() {
  const raw = JSON.parse(
    readFileSync(join(__dirname, 'seed-data', 'professions.json'), 'utf-8'),
  ) as { professions: ProfessionRaw[] };

  await prisma.profession.deleteMany();
  for (const p of raw.professions) {
    await prisma.profession.create({
      data: {
        id: p.id,
        title: p.title,
        riasecCode: p.riasec_code,
        incomeStart: p.income.start,
        incomeMid: p.income.mid,
        incomeMax: p.income.max,
        sourceNote: p.source_note,
        growthPath: p.growth_path,
        skills: p.skills,
        companies: p.companies,
        traitTags: p.trait_tags,
        motivationTags: p.motivation_tags,
        firstSteps: p.first_steps,
      },
    });
  }
  const total = await prisma.profession.count();
  console.log(`✓ professions: ${total} (стартовая база, todo: расширить до 40-60)`);
}

async function main() {
  console.log('Сидинг profAI…');
  await seedQuestions();
  await seedProfessions();
  console.log('Готово. (books_library пока пуст — по спеке, наполнить перед продом)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
