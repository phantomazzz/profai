/** Загрузка JSON-схем из llm_schemas.json (единый источник для валидации и промптов). */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const raw = require('./schemas/llm_schemas.json') as {
  draft_persona_schema: object;
  final_report_schema: object;
};

export const draftPersonaSchema = raw.draft_persona_schema;
export const finalReportSchema = raw.final_report_schema;

const P = (finalReportSchema as { properties: Record<string, object> }).properties;
const obj = (props: string[], required: string[]) => ({
  type: 'object',
  properties: Object.fromEntries(props.map((k) => [k, P[k]])),
  required,
});

/** Схемы отдельных секций финального отчёта (для посекционных вызовов LLM). */
export const sectionSchemas = {
  personality: obj(
    ['personality_map', 'personality_traits', 'personality_summary', 'life_stages', 'potential'],
    ['personality_map', 'personality_traits', 'personality_summary', 'potential'],
  ),
  career: obj(['career'], ['career']),
  meaning: obj(['meaning'], ['meaning']),
  motivation: obj(['motivation'], ['motivation']),
  next_steps: obj(['next_steps'], ['next_steps']),
} as const;

export type SectionName = keyof typeof sectionSchemas;
