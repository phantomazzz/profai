/**
 * Провайдер Anthropic. Структурированный вывод — через forced tool_use:
 * модель обязана вызвать инструмент, чей input_schema = наша JSON-схема,
 * и мы читаем tool_use.input как готовый объект.
 *
 * Модель: финальный отчёт → LLM_MODEL (claude-sonnet-5), черновой портрет →
 * LLM_MODEL_DRAFT (claude-haiku-4-5) — дешевле для внутреннего черновика.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider, LlmRequest } from '../provider.js';

/** Журнал расхода токенов по вызовам (для локальной проверки стоимости). */
export interface UsageEntry {
  model: string;
  schemaName: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  ms: number;
}
export const usageLog: UsageEntry[] = [];

/** Убирает служебные ключи "_comment" из JSON-схемы (не JSON-Schema-ключевое слово). */
function stripComments(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(stripComments);
  if (node && typeof node === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === '_comment') continue;
      out[k] = stripComments(v);
    }
    return out;
  }
  return node;
}

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly finalModel: string,
    private readonly draftModel: string,
  ) {
    this.client = new Anthropic({ apiKey });
  }

  async generateStructured(req: LlmRequest): Promise<unknown> {
    const model = req.schemaName === 'draft_persona' ? this.draftModel : this.finalModel;
    const toolName = req.schemaName;
    const inputSchema = stripComments(req.jsonSchema) as Anthropic.Tool.InputSchema;

    const t0 = Date.now();
    const res = await this.client.messages.create({
      model,
      max_tokens: 16000,
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      tools: [
        {
          name: toolName,
          description: `Верни данные строго по этой схеме, вызвав инструмент ${toolName}.`,
          input_schema: inputSchema,
        },
      ],
      tool_choice: { type: 'tool', name: toolName },
      messages: [{ role: 'user', content: req.user }],
    });

    usageLog.push({
      model,
      schemaName: req.schemaName,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      cacheReadTokens: res.usage.cache_read_input_tokens ?? 0,
      ms: Date.now() - t0,
    });

    const block = res.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      throw new Error(`Anthropic: в ответе нет tool_use (stop_reason=${res.stop_reason})`);
    }
    return block.input;
  }
}
