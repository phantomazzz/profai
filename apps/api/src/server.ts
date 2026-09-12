/**
 * Минимальный stateless-сервер генерации отчёта (без БД).
 * POST /api/report  { profile, openAnswers, closedAnswers }
 *   → { report: FinalReport, professions: {id: {...}} }
 * Считает баллы, фильтрует профессии, гоняет LLM (Sonnet 5 / Haiku) через адаптер.
 */
import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, normalize } from 'node:path';
import { SEED_QUESTIONS, OPEN_QUESTIONS } from '@profai/shared';
import { computeScores, type AnsweredQuestion } from './scoring/index.js';
import { filterProfessions, type ProfessionLike } from './professions/filter.js';
import { createLlmProvider } from './llm/factory.js';
import { runDraftPersona, runFinalReport } from './llm/orchestrator.js';
import type { ReportContext } from './llm/report-generator.js';
import { makeSlug, saveReport, readReport } from './store.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface ProfessionRaw {
  id: string;
  title: string;
  riasec_code: string;
  income: { start: number; mid: number; max: number };
  growth_path: string;
  skills: string[];
  companies: string[];
  trait_tags: string[];
}
const professionsRaw = (
  JSON.parse(readFileSync(join(__dirname, '..', 'prisma', 'seed-data', 'professions.json'), 'utf-8')) as {
    professions: ProfessionRaw[];
  }
).professions;

const professionsLike: ProfessionLike[] = professionsRaw.map((p) => ({
  id: p.id,
  riasecCode: p.riasec_code,
  traitTags: p.trait_tags,
}));
const profById = new Map(professionsRaw.map((p) => [p.id, p]));

const questionId = (q: (typeof SEED_QUESTIONS)[number]) => `${q.block}:${q.scaleKey}:${q.orderIndex}`;

const provider = createLlmProvider();

interface ReportRequestBody {
  profile: Record<string, string>;
  openAnswers: Record<string, string>;
  closedAnswers: Record<string, number>;
}

async function generate(body: ReportRequestBody) {
  // 1. Закрытые ответы → баллы
  const answers: AnsweredQuestion[] = [];
  for (const q of SEED_QUESTIONS) {
    const raw = body.closedAnswers[questionId(q)];
    if (typeof raw === 'number') {
      answers.push({ block: q.block, scaleKey: q.scaleKey, isReverse: q.isReverse, rawValue: raw });
    }
  }
  const scoring = computeScores(answers);

  // 2. Шорт-лист профессий
  const shortlist = filterProfessions(professionsLike, scoring.hollandCode, scoring.topFactorKeys);
  const toProf = (s: { professionId: string; letterMatch: number; traitOverlap: number }) => ({
    id: s.professionId,
    title: profById.get(s.professionId)?.title ?? s.professionId,
    letterMatch: s.letterMatch,
    traitOverlap: s.traitOverlap,
  });

  // 3. Черновой портрет (Job 1)
  const openForPrompt = OPEN_QUESTIONS.map((q) => ({ question: q.text, text: body.openAnswers[q.key] ?? '' }));
  const personalRequest = body.profile.personalRequest ?? '';
  const draftPersona = await runDraftPersona(provider, { openAnswers: openForPrompt, personalRequest });

  // 4. Финальный отчёт (Job 2)
  const ctx: ReportContext = {
    personalRequest,
    draftPersona,
    scores: scoring.scores,
    hollandCode: scoring.hollandCode,
    suitable: shortlist.suitable.map(toProf),
    unsuitable: shortlist.unsuitable.map(toProf),
    age: body.profile.age ? Number(body.profile.age) : undefined,
  };
  const report = await runFinalReport(provider, ctx);

  // 5. Справочник профессий для рендера карточек
  const referenced = [...ctx.suitable, ...ctx.unsuitable].map((p) => p.id);
  const professions: Record<string, unknown> = {};
  for (const id of referenced) {
    const p = profById.get(id);
    if (p) professions[id] = { title: p.title, income: p.income, growthPath: p.growth_path, skills: p.skills, companies: p.companies };
  }

  return { report, professions, request: personalRequest };
}

const CORS = {
  'Access-Control-Allow-Origin': process.env.WEB_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// ── Раздача собранного фронта (single-origin деплой) ─────────────────────────
// В продакшене этот же сервер отдаёт apps/web/dist, поэтому фронт ходит в /api
// без CORS и без прокси. В dev фронт живёт на vite:5173 — dist может отсутствовать.
const WEB_DIST = join(__dirname, '..', '..', 'web', 'dist');
const HAS_WEB = existsSync(join(WEB_DIST, 'index.html'));
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};

/** Отдаёт статический файл из dist, а на неизвестный путь — index.html (SPA-роутинг). */
function serveStatic(urlPath: string, res: http.ServerResponse): void {
  const clean = decodeURIComponent(urlPath.split(/[?#]/)[0] ?? '/');
  const rel = normalize(clean).replace(/^(\.\.[/\\])+/, ''); // без path traversal
  let file = join(WEB_DIST, rel);
  if (!file.startsWith(WEB_DIST) || !existsSync(file) || clean === '/') {
    file = join(WEB_DIST, 'index.html'); // SPA-фолбэк (в т.ч. /report/<slug>)
  }
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  // index.html не кэшируем (чтобы деплой сразу подхватывался), ассеты — надолго.
  const cache = file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': cache }).end(readFileSync(file));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS).end();
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS }).end(JSON.stringify({ ok: true, provider: provider.name }));
    return;
  }

  // Чтение сохранённого отчёта по slug (LLM не вызывается).
  if (req.method === 'GET' && req.url?.startsWith('/api/report/')) {
    const slug = req.url.slice('/api/report/'.length).split(/[?#]/)[0] ?? '';
    const stored = readReport(slug);
    if (!stored) {
      res.writeHead(404, { 'Content-Type': 'application/json', ...CORS }).end(JSON.stringify({ error: 'not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS }).end(JSON.stringify(stored));
    return;
  }

  // Генерация нового отчёта: считает, зовёт LLM, СОХРАНЯЕТ и возвращает slug.
  if (req.method === 'POST' && req.url === '/api/report') {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', async () => {
      try {
        const body = JSON.parse(raw || '{}') as ReportRequestBody;
        const t0 = Date.now();
        const result = await generate(body);
        const slug = makeSlug();
        saveReport(slug, result);
        console.log(`✓ отчёт ${slug} сгенерирован за ${Date.now() - t0}мс (провайдер ${provider.name})`);
        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS }).end(JSON.stringify({ slug, ...result }));
      } catch (e) {
        console.error('Ошибка генерации:', e);
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS }).end(
          JSON.stringify({ error: e instanceof Error ? e.message : 'unknown' }),
        );
      }
    });
    return;
  }

  // Всё остальное (GET) — статика фронта / SPA-фолбэк, если dist собран.
  if (req.method === 'GET' && HAS_WEB) {
    serveStatic(req.url ?? '/', res);
    return;
  }
  res.writeHead(404, CORS).end();
});

// Render/облачные хосты передают порт через PORT; локально — API_PORT/3001.
const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3001);
server.listen(port, () => {
  console.log(
    `profAI server → http://localhost:${port}  (LLM: ${provider.name}${HAS_WEB ? ', + фронт из web/dist' : ', API-only'})`,
  );
});
