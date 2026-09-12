/**
 * Провайдер OpenAI — ЗАГЛУШКА до появления API-ключа.
 *
 * Реализация (когда будет ключ):
 *   - POST https://api.openai.com/v1/chat/completions (или Responses API)
 *   - response_format: { type:'json_schema', json_schema:{ name:schemaName, schema:jsonSchema, strict:true } }
 *   - вернуть JSON.parse(choices[0].message.content)
 */
import type { LlmProvider, LlmRequest } from '../provider.js';

export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async generateStructured(_req: LlmRequest): Promise<unknown> {
    if (!this.apiKey) {
      throw new Error(
        'OpenAiProvider: LLM_API_KEY не задан. Пока используйте LLM_PROVIDER=mock.',
      );
    }
    // TODO: реальный вызов OpenAI со structured outputs (json_schema, strict:true).
    throw new Error('OpenAiProvider.generateStructured пока не реализован (ждём ключ и интеграцию).');
  }
}
