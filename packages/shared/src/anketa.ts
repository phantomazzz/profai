// Вступительная анкета — 7 полей (adult_test_questions_full.md §0).
// Намеренно урезана ради приватности: доход только диапазоном, без города рождения,
// семейный статус заменён мягким вопросом про поддержку.

export type AnketaFieldType = 'number' | 'text' | 'select' | 'longtext';

export interface AnketaField {
  key: string;
  label: string;
  type: AnketaFieldType;
  required: boolean;
  hint?: string;
  options?: string[];
}

export const ANKETA_FIELDS: AnketaField[] = [
  { key: 'age', label: 'Возраст', type: 'number', required: true },
  {
    key: 'city',
    label: 'Текущий город',
    type: 'text',
    required: true,
    hint: 'Нужен для рекомендаций по вакансиям и зарплатам в регионе.',
  },
  {
    key: 'education',
    label: 'Образование',
    type: 'select',
    required: true,
    options: ['среднее', 'среднее специальное', 'неоконченное высшее', 'высшее', 'учёная степень'],
  },
  {
    key: 'occupation',
    label: 'Текущая сфера деятельности / профессия',
    type: 'text',
    required: true,
  },
  {
    key: 'incomeRange',
    label: 'Доход',
    type: 'select',
    required: true,
    options: [
      'до 50 тыс',
      '50–100 тыс',
      '100–200 тыс',
      '200–400 тыс',
      'более 400 тыс',
      'предпочитаю не указывать',
    ],
  },
  {
    key: 'supportLevel',
    label: 'Есть ли на кого опереться в сложный период?',
    type: 'select',
    required: false,
    options: ['да', 'скорее да', 'скорее нет', 'нет', 'предпочитаю не отвечать'],
  },
  {
    key: 'personalRequest',
    label: 'Что сейчас больше всего беспокоит тебя в карьере или доходе? Что хочешь изменить?',
    type: 'longtext',
    required: true,
    hint: 'Это якорь всего отчёта — постарайся ответить честно.',
  },
];
