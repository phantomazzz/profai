/**
 * Абстракция LLM-провайдера. Бизнес-логика (оркестратор) зависит только
 * от этого интерфейса — сменить Anthropic/OpenAI/мок можно без переписывания
 * (важно и для 152-ФЗ: при необходимости уходим на российского провайдера).
 */
import type { SchemaName } from './validation.js';

export interface LlmRequest {
  system: string;
  user: string;
  /** JSON-схема ожидаемого ответа (structured outputs у провайдера). */
  jsonSchema: object;
  schemaName: SchemaName;
  /**
   * Контекст для детерминированной генерации в мок-провайдере
   * (реальные провайдеры его игнорируют — данные уже в user-промпте).
   */
  context?: unknown;
  model?: string;
}

export interface LlmProvider {
  readonly name: string;
  /** Возвращает распарсенный (но ещё не провалидированный) JSON-объект. */
  generateStructured(req: LlmRequest): Promise<unknown>;
}
