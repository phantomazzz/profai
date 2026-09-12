/**
 * Детерминированный генератор структурно-валидного отчёта из реальных данных.
 * Используется мок-провайдером (пока нет ключа к модели) и как аварийный
 * фолбэк. Текст — шаблонный (место модели), но проценты, id профессий, код
 * Холланда берутся из фактических вычислений — пайплайн работает end-to-end.
 */
import {
  PERSONALITY_FACTORS,
  GERCHIKOV_TYPES,
  PINK_TYPES,
  RIASEC_TYPES,
  type DraftPersona,
  type FinalReport,
  type PersonalityMap,
  type PersonalityTrait,
  type Potential,
  type Meaning,
  type Motivation,
  type Career,
  type NextSteps,
} from '@profai/shared';

const label = (defs: { key: string; label: string }[], key: string) =>
  defs.find((d) => d.key === key)?.label ?? key;

export interface ScoreLite {
  category: 'RIASEC' | 'PERSONALITY' | 'GERCHIKOV' | 'PINK';
  scaleKey: string;
  percent: number;
  percentAbsolute?: number;
}

export interface ProfContext {
  id: string;
  title: string;
  letterMatch: number;
  traitOverlap: number;
}

export interface ReportContext {
  personalRequest: string;
  draftPersona: DraftPersona;
  scores: ScoreLite[];
  hollandCode: string;
  suitable: ProfContext[];
  unsuitable: ProfContext[];
  age?: number;
}

const byCat = (scores: ScoreLite[], cat: ScoreLite['category']) =>
  scores.filter((s) => s.category === cat);

const sortedDesc = (arr: ScoreLite[]) => [...arr].sort((a, b) => b.percent - a.percent);

// ─────────────────────── Секции ───────────────────────

export function buildDraftPersona(input: {
  openAnswers: { question: string; text: string }[];
  personalRequest: string;
}): DraftPersona {
  const firstQuote = input.openAnswers.find((a) => a.text.trim().length > 0);
  return {
    predicted_type: 'Аналитик-практик',
    reframed_request:
      input.personalRequest.trim() ||
      'Найти направление, где сильные стороны конвертируются в доход и смысл.',
    current_situation_summary:
      'Пользователь на этапе переоценки карьеры, ищет более осмысленное применение навыков. (черновой портрет — заполнит модель)',
    tentative_themes: ['поиск смысла в работе', 'потребность в росте дохода', 'запрос на автономию'],
    tentative_strengths: ['системное мышление', 'ответственность', 'обучаемость'],
    tentative_concerns: ['неопределённость направления', 'страх ошибки при смене пути'],
    notable_quotes: firstQuote ? [firstQuote.text.slice(0, 160)] : [],
    tone_notes: 'прямой, по делу, без сюсюканья',
  };
}

function personalitySection(ctx: ReportContext): {
  personality_map: PersonalityMap;
  personality_traits: PersonalityTrait[];
  personality_summary: string;
  life_stages: FinalReport['life_stages'];
  potential: Potential;
} {
  const traits = sortedDesc(byCat(ctx.scores, 'PERSONALITY'));

  const personality_traits: PersonalityTrait[] = byCat(ctx.scores, 'PERSONALITY').map((s) => ({
    factor_key: s.scaleKey,
    percent: s.percent,
    description: `Фактор «${label(PERSONALITY_FACTORS, s.scaleKey)}» — ${s.percent}%.`,
    interpretation:
      s.percent >= 50
        ? `Выраженный уровень: ${label(PERSONALITY_FACTORS, s.scaleKey)} проявляется заметно.`
        : `Умеренный/низкий уровень по фактору «${label(PERSONALITY_FACTORS, s.scaleKey)}».`,
    recommendations: [
      'Обратить внимание на ситуации, где этот фактор помогает или мешает.',
      'Использовать сильную сторону как опору при выборе задач.',
    ],
  }));

  const top4 = traits.slice(0, 4);
  const personality_map: PersonalityMap = {
    narrative:
      'Портрет объединяет ведущие черты в связный образ. (2-3 абзаца синтеза заполнит модель.)',
    life_stage: ctx.age ? `${ctx.age} лет — этап осознанного выбора` : 'этап осознанного выбора',
    core_request_reflected: `Запрос пользователя: «${ctx.personalRequest}» — учтён в разборе.`,
    direction: 'Сфера, сочетающая анализ и работу с результатом.',
    key_characteristics: top4.map((s) => ({
      title: label(PERSONALITY_FACTORS, s.scaleKey),
      explanation: `Одна из ведущих черт (${s.percent}%).`,
      example: 'Проявляется в том, как человек подходит к задачам.',
    })),
  };

  const strengthsSrc = traits.slice(0, 3);
  const growthSrc = sortedDesc(byCat(ctx.scores, 'PERSONALITY')).slice(-2);
  const potential: Potential = {
    strengths: strengthsSrc.map((s) => ({
      title: label(PERSONALITY_FACTORS, s.scaleKey),
      meaning: `Сильная сторона: ${label(PERSONALITY_FACTORS, s.scaleKey)}.`,
      where_it_shows: 'В рабочих ситуациях, требующих этого качества.',
      how_to_use: 'Выбирать роли, где эта черта — ключевая.',
      how_to_strengthen: ['практика в реальных задачах', 'обратная связь от коллег'],
      book_recommendation_id: '', // books_library пока пуст (todo спеки)
    })),
    growth_areas: growthSrc.map((s) => ({
      title: label(PERSONALITY_FACTORS, s.scaleKey),
      description_with_example: `Зона роста по фактору «${label(PERSONALITY_FACTORS, s.scaleKey)}» (${s.percent}%).`,
      how_to_work: ['небольшие эксперименты', 'рефлексия результата'],
      action_today: 'Сделать один небольшой шаг в этом направлении сегодня.',
      book_recommendation_id: '',
    })),
  };

  return {
    personality_map,
    personality_traits,
    personality_summary:
      'Итог по личности: сочетание аналитичности и ответственности при умеренной социальной активности. (заполнит модель)',
    potential,
    life_stages: [
      {
        age: ctx.age ?? 30,
        title: 'Текущий этап',
        narrative: 'Переоценка направления и поиск опоры в сильных сторонах.',
        growth_zone: 'Определённость в выборе.',
        recommendation: 'Сузить фокус до 1-2 гипотез и проверить их на практике.',
      },
    ],
  };
}

function motivationSection(ctx: ReportContext): Motivation {
  const g = sortedDesc(byCat(ctx.scores, 'GERCHIKOV'));
  const pink = byCat(ctx.scores, 'PINK');
  const pinkVal = (key: string) => pink.find((p) => p.scaleKey === key)?.percent ?? 0;

  return {
    leading_type: label(GERCHIKOV_TYPES, g[0]?.scaleKey ?? 'professional'),
    supporting_types: g.slice(1, 3).map((s) => label(GERCHIKOV_TYPES, s.scaleKey)),
    breakdown: byCat(ctx.scores, 'GERCHIKOV').map((s) => ({
      type_key: s.scaleKey,
      percent: s.percent,
      description: `Тип «${label(GERCHIKOV_TYPES, s.scaleKey)}» — ${s.percent}%.`,
    })),
    motivators: {
      autonomy_percent: pinkVal('autonomy'),
      mastery_percent: pinkVal('mastery'),
      purpose_percent: pinkVal('purpose'),
      narrative: 'Мотиваторы по Пинку: баланс автономии, мастерства и цели. (заполнит модель)',
    },
    narrative: 'Ведущая мотивация определяет, какие условия работы будут поддерживающими.',
    suitable_directions: ['проекты с измеримым результатом', 'роли с автономией'],
  };
}

function careerSection(ctx: ReportContext): Career {
  const riasec = byCat(ctx.scores, 'RIASEC');
  const fitProbability = (p: ProfContext) => Math.min(100, p.letterMatch * 20 + p.traitOverlap * 5);

  return {
    riasec_profile: RIASEC_TYPES.map((t) => ({
      type_key: t.key,
      percent: riasec.find((s) => s.scaleKey === t.key)?.percent ?? 0,
    })),
    holland_code: ctx.hollandCode,
    narrative: `Код Холланда ${ctx.hollandCode} задаёт ключ подбора профессий. (нарратив заполнит модель)`,
    suitable_professions: ctx.suitable.map((p) => ({
      profession_id: p.id,
      why_it_fits: `Совпадение по коду Холланда (${p.letterMatch}/3 букв) и чертам (${p.traitOverlap}).`,
      reflection_questions: [
        'Что в этой роли откликается лично тебе?',
        'Какой первый шаг можно сделать за неделю?',
        'Что может оказаться неожиданно сложным?',
      ],
    })),
    unsuitable_professions: ctx.unsuitable.map((p) => ({
      profession_id: p.id,
      fit_probability: fitProbability(p),
      why_not: `Слабое пересечение с профилем интересов и черт (совпадение ${p.letterMatch}/3).`,
    })),
    ideal_team: [
      { role: 'Интегратор/координатор', why: 'Компенсирует фокус на деталях.' },
      { role: 'Визионер', why: 'Задаёт направление и смысл.' },
    ],
    business_directions: ['консалтинг по своей экспертизе', 'образовательные продукты'],
  };
}

function meaningSection(ctx: ReportContext): Meaning {
  return {
    mission: `Применять сильные стороны так, чтобы это отвечало на запрос: «${ctx.personalRequest}».`,
    purpose_orientation: 'Ориентация на осмысленный результат, а не только на процесс.',
    role_model_example:
      '(подбирается моделью: реальный человек с проверяемым именем и похожим путём)',
    what_to_avoid: 'Роли без автономии и без видимого результата труда.',
    hidden_talents: [
      {
        title: 'Структурирование хаоса',
        evidence: 'Из открытых ответов виден навык наводить порядок.',
        career_application: 'Аналитика, операционные процессы, управление данными.',
      },
      {
        title: 'Объяснение сложного просто',
        evidence: 'Склонность разбираться до сути.',
        career_application: 'Наставничество, продуктовые роли, преподавание.',
      },
    ],
  };
}

function nextStepsSection(ctx: ReportContext): NextSteps {
  return {
    action_24h: 'Выписать 3 направления из отчёта, которые вызвали наибольший отклик.',
    weekly_plan: [
      { week: 1, title: 'Прояснение', goal: 'Сузить выбор до 2 гипотез', actions: ['перечитать разбор карьеры', 'выбрать 2 профессии для изучения'], watch_out: 'не распыляться на всё сразу' },
      { week: 2, title: 'Разведка', goal: 'Поговорить с людьми из сферы', actions: ['найти 2-3 специалиста', 'задать вопросы о реальной работе'], watch_out: 'не принимать один мнение за истину' },
      { week: 3, title: 'Проба', goal: 'Сделать мини-проект', actions: ['выбрать небольшую задачу', 'довести до результата'], watch_out: 'не гнаться за идеалом' },
      { week: 4, title: 'Решение', goal: 'Выбрать направление и план', actions: ['сравнить впечатления', 'зафиксировать следующий шаг'], watch_out: 'не откладывать решение бесконечно' },
    ],
    traps: [
      { title: 'Паралич анализа', description: 'Бесконечный сбор информации вместо действия.', antidote: 'Ограничить исследование сроком в неделю.' },
      { title: 'Синдром самозванца', description: 'Обесценивание своих сильных сторон.', antidote: 'Опираться на факты из этого отчёта.' },
    ],
    tied_to_core_request: `Этот план напрямую отвечает на исходный запрос: «${ctx.personalRequest}».`,
  };
}

export type FinalSection = 'personality' | 'career' | 'meaning' | 'motivation' | 'next_steps';

/** Генерирует данные одной секции финального отчёта. */
export function buildSection(section: FinalSection, ctx: ReportContext): Record<string, unknown> {
  switch (section) {
    case 'personality':
      return personalitySection(ctx);
    case 'career':
      return { career: careerSection(ctx) };
    case 'meaning':
      return { meaning: meaningSection(ctx) };
    case 'motivation':
      return { motivation: motivationSection(ctx) };
    case 'next_steps':
      return { next_steps: nextStepsSection(ctx) };
  }
}

export const FINAL_SECTIONS: FinalSection[] = [
  'personality',
  'career',
  'meaning',
  'motivation',
  'next_steps',
];

/** Полный отчёт из всех секций (мок-путь и запасной вариант). */
export function buildFullReport(ctx: ReportContext): FinalReport {
  const merged = FINAL_SECTIONS.reduce<Record<string, unknown>>(
    (acc, s) => Object.assign(acc, buildSection(s, ctx)),
    {},
  );
  return merged as unknown as FinalReport;
}
