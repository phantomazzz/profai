/**
 * TypeScript-типы для двух LLM-вызовов.
 * Соответствуют llm_schemas.json (draft_persona_schema / final_report_schema).
 * Эти же типы фронт использует для рендера страницы отчёта.
 */

/** Вызов 1 — фоновый черновой портрет по открытым ответам. */
export interface DraftPersona {
  predicted_type: string;
  reframed_request: string;
  current_situation_summary: string;
  tentative_themes: string[];
  tentative_strengths: string[];
  tentative_concerns: string[];
  notable_quotes?: string[];
  tone_notes: string;
}

export interface KeyCharacteristic {
  title: string;
  explanation: string;
  example: string;
}

export interface PersonalityMap {
  narrative: string;
  life_stage: string;
  core_request_reflected: string;
  direction: string;
  key_characteristics: KeyCharacteristic[];
}

export interface PersonalityTrait {
  factor_key: string;
  percent: number;
  description: string;
  interpretation: string;
  recommendations: string[];
}

export interface LifeStage {
  age: number;
  title: string;
  narrative: string;
  growth_zone: string;
  recommendation: string;
}

export interface Strength {
  title: string;
  meaning: string;
  where_it_shows: string;
  how_to_use: string;
  how_to_strengthen: string[];
  book_recommendation_id: string;
}

export interface GrowthArea {
  title: string;
  description_with_example: string;
  how_to_work: string[];
  action_today: string;
  book_recommendation_id: string;
}

export interface Potential {
  strengths: Strength[];
  growth_areas: GrowthArea[];
}

export interface HiddenTalent {
  title: string;
  evidence: string;
  career_application: string;
}

export interface Meaning {
  mission: string;
  purpose_orientation: string;
  role_model_example: string;
  what_to_avoid: string;
  hidden_talents: HiddenTalent[];
}

export interface MotivationBreakdown {
  type_key: string;
  percent: number;
  description: string;
  example_person?: string;
}

export interface Motivation {
  leading_type: string;
  supporting_types: string[];
  breakdown: MotivationBreakdown[];
  motivators: {
    autonomy_percent: number;
    mastery_percent: number;
    purpose_percent: number;
    narrative: string;
  };
  narrative: string;
  suitable_directions?: string[];
}

export interface RiasecProfileItem {
  type_key: string;
  percent: number;
}

export interface SuitableProfession {
  profession_id: string;
  why_it_fits: string;
  reflection_questions: string[];
}

export interface UnsuitableProfession {
  profession_id: string;
  fit_probability: number;
  why_not: string;
}

export interface Career {
  riasec_profile: RiasecProfileItem[];
  holland_code: string;
  narrative: string;
  suitable_professions: SuitableProfession[];
  unsuitable_professions: UnsuitableProfession[];
  ideal_team?: { role: string; why: string }[];
  business_directions?: string[];
}

export interface WeeklyPlanItem {
  week: number;
  title: string;
  goal: string;
  actions: string[];
  watch_out: string;
}

export interface Trap {
  title: string;
  description: string;
  antidote: string;
}

export interface NextSteps {
  action_24h: string;
  weekly_plan: WeeklyPlanItem[];
  traps: Trap[];
  tied_to_core_request: string;
}

/** Вызов 2 — финальный отчёт. */
export interface FinalReport {
  personality_map: PersonalityMap;
  personality_traits: PersonalityTrait[];
  personality_summary: string;
  life_stages?: LifeStage[];
  potential: Potential;
  meaning: Meaning;
  motivation: Motivation;
  career: Career;
  next_steps: NextSteps;
}
