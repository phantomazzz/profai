/**
 * Файловое хранилище отчётов: data/reports/<slug>.json.
 * Даёт постоянные ссылки /report/<slug> без БД (позже мигрируем в Postgres).
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, '..', 'data', 'reports');
mkdirSync(DIR, { recursive: true });

const SLUG_RE = /^[a-z0-9]{4,16}$/;

/** Короткий неугадываемый идентификатор отчёта (ключ доступа в MVP без авторизации). */
export function makeSlug(): string {
  let slug = '';
  do {
    slug = Math.random().toString(36).slice(2, 8);
  } while (existsSync(join(DIR, `${slug}.json`)));
  return slug;
}

export function saveReport(slug: string, data: unknown): void {
  if (!SLUG_RE.test(slug)) throw new Error('bad slug');
  writeFileSync(join(DIR, `${slug}.json`), JSON.stringify({ ...(data as object), createdAt: new Date().toISOString() }));
}

export function readReport(slug: string): unknown | null {
  if (!SLUG_RE.test(slug)) return null; // защита от path traversal
  const file = join(DIR, `${slug}.json`);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, 'utf-8'));
}
