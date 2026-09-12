/**
 * Выбор LLM-провайдера по окружению.
 * Без ключа (или LLM_PROVIDER=mock) — используется мок, чтобы пайплайн
 * и фронт работали end-to-end до интеграции реальной модели.
 */
import type { LlmProvider } from './provider.js';
import { MockLlmProvider } from './providers/mock.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { OpenAiProvider } from './providers/openai.js';

export function createLlmProvider(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  const provider = (env.LLM_PROVIDER ?? 'mock').toLowerCase();
  const apiKey = env.LLM_API_KEY ?? '';
  const finalModel = env.LLM_MODEL ?? 'claude-sonnet-5';
  const draftModel = env.LLM_MODEL_DRAFT ?? 'claude-haiku-4-5';

  if (!apiKey || provider === 'mock') {
    return new MockLlmProvider();
  }
  switch (provider) {
    case 'anthropic':
      return new AnthropicProvider(apiKey, finalModel, draftModel);
    case 'openai':
      return new OpenAiProvider(apiKey, finalModel);
    default:
      return new MockLlmProvider();
  }
}
