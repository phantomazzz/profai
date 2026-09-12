/**
 * Мок-провайдер: заменяет реальную модель, пока нет API-ключа.
 * Отдаёт структурно-валидный JSON, собранный из фактических данных скоринга
 * (через report-generator). Позволяет гонять весь пайплайн и разрабатывать фронт.
 */
import type { LlmProvider, LlmRequest } from '../provider.js';
import {
  buildDraftPersona,
  buildSection,
  buildFullReport,
  type ReportContext,
  type FinalSection,
} from '../report-generator.js';

export type MockContext =
  | { kind: 'draft'; openAnswers: { question: string; text: string }[]; personalRequest: string }
  | { kind: 'section'; section: FinalSection; reportContext: ReportContext }
  | { kind: 'full'; reportContext: ReportContext };

export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';

  async generateStructured(req: LlmRequest): Promise<unknown> {
    const ctx = req.context as MockContext | undefined;
    if (!ctx) throw new Error('MockLlmProvider: не передан context');

    if (ctx.kind === 'draft') {
      return buildDraftPersona({
        openAnswers: ctx.openAnswers,
        personalRequest: ctx.personalRequest,
      });
    }
    if (ctx.kind === 'full') {
      return buildFullReport(ctx.reportContext);
    }
    return buildSection(ctx.section, ctx.reportContext);
  }
}
