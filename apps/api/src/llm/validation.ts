/**
 * Валидация ответов LLM против JSON-схем (llm_schemas.json).
 * Оба вызова обязаны возвращать строго структурированный JSON — иначе фронт
 * не сможет надёжно рендерить отчёт (product_context.md §5).
 */
import { Ajv, type ValidateFunction } from 'ajv';
import { draftPersonaSchema, finalReportSchema, sectionSchemas, type SectionName } from './schemas.js';

// strict:false — в схемах есть служебные ключи "_comment", это не ошибка.
const ajv = new Ajv({ allErrors: true, strict: false });

const validators: Record<string, ValidateFunction> = {
  draft_persona: ajv.compile(draftPersonaSchema),
  final_report: ajv.compile(finalReportSchema),
};

const sectionValidators = Object.fromEntries(
  Object.entries(sectionSchemas).map(([name, schema]) => [name, ajv.compile(schema)]),
) as Record<SectionName, ValidateFunction>;

/** Проверяет данные секции; возвращает список ошибок (пустой — валидно). */
export function validateSectionData(section: SectionName, data: unknown): string[] {
  const validate = sectionValidators[section];
  if (validate(data)) return [];
  return (validate.errors ?? []).map((e) => `${e.instancePath || '(root)'} ${e.message ?? ''}`.trim());
}

export type SchemaName = keyof typeof validators;

export class SchemaValidationError extends Error {
  constructor(
    public schemaName: SchemaName,
    public errors: string[],
  ) {
    super(`LLM-ответ не прошёл валидацию по схеме «${schemaName}»:\n${errors.join('\n')}`);
    this.name = 'SchemaValidationError';
  }
}

/** Бросает SchemaValidationError, если данные не соответствуют схеме. */
export function validateAgainstSchema<T>(schemaName: SchemaName, data: unknown): T {
  const validate = validators[schemaName];
  if (!validate) throw new Error(`Неизвестная схема: ${schemaName}`);
  if (!validate(data)) {
    const errors = (validate.errors ?? []).map(
      (e) => `${e.instancePath || '(root)'} ${e.message ?? ''}`.trim(),
    );
    throw new SchemaValidationError(schemaName, errors);
  }
  return data as T;
}
