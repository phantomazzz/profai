/**
 * Сборка промптов для обоих вызовов. Реальный провайдер отправит именно это;
 * мок берёт данные из context, но промпты всё равно строятся и тестируются
 * (гарантируем, что в них попадают нужные данные и guardrails).
 */
import type { ReportContext, FinalSection } from './report-generator.js';

/** Общие ограничения (product_context.md §9): без гарантий дохода, id из БД, реальные персоны. */
export const GUARDRAILS = [
  'Не давай формулировок-гарантий дохода («вы будете зарабатывать X»). Только рыночные ориентиры и диапазоны.',
  'В полях profession_id и book_recommendation_id используй ТОЛЬКО id из переданных списков. Не выдумывай новые id.',
  'role_model_example — реальный, проверяемый человек с похожим путём. Не выдумывай персон.',
  'Отчёт — инструмент самопознания, а не клиническая психодиагностика. Избегай диагнозов.',
  'Пиши на русском, по делу, уважительно, без обесценивания.',
].join('\n- ');

export interface OpenAnswerForPrompt {
  question: string;
  text: string;
}

export function buildDraftPersonaPrompt(input: {
  openAnswers: OpenAnswerForPrompt[];
  personalRequest: string;
  profileHint?: string;
}): { system: string; user: string } {
  const system = [
    'Ты — карьерный аналитик. По открытым ответам пользователя составь ЧЕРНОВОЙ портрет.',
    'Это предварительные гипотезы: их подтвердят количественные баллы на втором этапе.',
    'Верни строго JSON по заданной схеме.',
    `Ограничения:\n- ${GUARDRAILS}`,
  ].join('\n');

  const answers = input.openAnswers
    .map((a, i) => `${i + 1}. ${a.question}\n   Ответ: ${a.text || '—'}`)
    .join('\n');

  const user = [
    `Личный запрос (якорь отчёта): ${input.personalRequest || '—'}`,
    input.profileHint ? `Контекст анкеты: ${input.profileHint}` : '',
    '',
    'Открытые ответы:',
    answers,
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}

const SECTION_INSTRUCTIONS: Record<FinalSection, string> = {
  personality:
    'Разбор личности: связный портрет, 16 факторов (percent берётся из данных, не меняй его), сильные стороны и зоны роста.',
  career:
    'Разбор карьеры: интерпретация профиля RIASEC, подходящие/неподходящие профессии СТРОГО по переданному шорт-листу (по profession_id).',
  meaning: 'Смысловой разбор: миссия, ориентация на цель, реальная ролевая модель, чего избегать, скрытые таланты.',
  motivation: 'Разбор мотивации (Герчиков + мотиваторы Пинка): ведущий тип, поддерживающие, разбор по типам.',
  next_steps:
    'План действий: шаг на 24 часа, план на 4 недели, типичные ловушки. Всё явно привязать к исходному запросу.',
};

/** Промпт для единого финального вызова (весь отчёт за один запрос). */
export function buildFinalReportPrompt(ctx: ReportContext): { system: string; user: string } {
  const system = [
    'Ты — вдумчивый карьерный аналитик. Составь ПОЛНЫЙ персональный отчёт по профориентации на русском.',
    'Разделы: разбор личности (16 факторов), потенциал, смыслы, мотивация (Герчиков + драйверы Пинка), карьера (RIASEC, профессии), план действий.',
    'Пиши тепло, конкретно и по-человечески, обращайся на «ты». Опирайся на переданные баллы и цитаты, всё увязывай с исходным запросом пользователя.',
    'Проценты бери из переданных чисел; профессии — строго по переданному шорт-листу (по profession_id).',
    'Верни данные строго по схеме отчёта, вызвав инструмент.',
    `Ограничения:\n- ${GUARDRAILS}`,
  ].join('\n');

  const scoresBrief = ctx.scores.map((s) => `${s.category}/${s.scaleKey}: ${s.percent}%`).join(', ');
  const suitable = ctx.suitable.map((p) => `${p.id} (${p.title})`).join('; ');
  const unsuitable = ctx.unsuitable.map((p) => `${p.id} (${p.title})`).join('; ');

  const user = [
    `Исходный запрос пользователя: «${ctx.personalRequest}»`,
    `Черновой психологический портрет: тип «${ctx.draftPersona.predicted_type}», тон — ${ctx.draftPersona.tone_notes}.`,
    `Темы из ответов: ${ctx.draftPersona.tentative_themes.join(', ')}`,
    ctx.age ? `Возраст: ${ctx.age}` : '',
    `Код Холланда: ${ctx.hollandCode}`,
    `Баллы (0-100%): ${scoresBrief}`,
    `Подходящие профессии (используй ТОЛЬКО эти id, 4-6 шт): ${suitable}`,
    `Неподходящие профессии (ТОЛЬКО эти id, 2-3 шт): ${unsuitable}`,
    ctx.draftPersona.notable_quotes?.length
      ? `Цитаты пользователя для персонализации: ${ctx.draftPersona.notable_quotes.join(' | ')}`
      : '',
    'book_recommendation_id оставляй пустой строкой — библиотека книг пока не подключена.',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}

export function buildSectionPrompt(
  section: FinalSection,
  ctx: ReportContext,
): { system: string; user: string } {
  const system = [
    `Ты — карьерный аналитик. Сгенерируй секцию отчёта: «${section}».`,
    SECTION_INSTRUCTIONS[section],
    'Верни строго JSON по заданной схеме секции.',
    `Ограничения:\n- ${GUARDRAILS}`,
  ].join('\n');

  const scoresBrief = ctx.scores
    .map((s) => `${s.category}/${s.scaleKey}: ${s.percent}%`)
    .join(', ');

  const suitable = ctx.suitable.map((p) => `${p.id} (${p.title})`).join('; ');
  const unsuitable = ctx.unsuitable.map((p) => `${p.id} (${p.title})`).join('; ');

  const user = [
    `Исходный запрос пользователя: «${ctx.personalRequest}»`,
    `Черновой портрет (тип): ${ctx.draftPersona.predicted_type}. Тон: ${ctx.draftPersona.tone_notes}`,
    `Код Холланда: ${ctx.hollandCode}`,
    `Баллы (0-100%): ${scoresBrief}`,
    `Подходящие профессии (только эти id): ${suitable}`,
    `Неподходящие профессии (только эти id): ${unsuitable}`,
    ctx.draftPersona.notable_quotes?.length
      ? `Цитаты для персонализации: ${ctx.draftPersona.notable_quotes.join(' | ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  return { system, user };
}
