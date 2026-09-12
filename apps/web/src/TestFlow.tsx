import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  STEPS,
  TOTAL_INPUTS,
  answeredCount,
  anketaRequiredFilled,
  questionId,
  loadState,
  newState,
  saveState,
  type TestState,
} from './session.js';
import { IntroScreen } from './screens/IntroScreen.js';
import { ConsentScreen } from './screens/ConsentScreen.js';
import { AnketaScreen } from './screens/AnketaScreen.js';
import { ClosedQuestionScreen, OpenQuestionScreen } from './screens/QuestionScreen.js';
import { WaitingScreen } from './screens/WaitingScreen.js';

export function TestFlow() {
  const navigate = useNavigate();
  const [state, setState] = useState<TestState>(() => loadState() ?? newState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const step = STEPS[state.stepIndex]!;

  // Экран ожидания — генерируем отчёт ОДИН раз, сохраняем на сервере, уходим на /report/<slug>.
  const genStarted = useRef(false);
  useEffect(() => {
    if (step.kind !== 'waiting' || genStarted.current) return;
    genStarted.current = true;

    // Демо-режим: показываем образец отчёта (без вызова LLM), с короткой паузой на «генерацию».
    if (import.meta.env.VITE_DEMO) {
      const t = setTimeout(() => navigate('/report/demo'), 1400);
      return () => clearTimeout(t);
    }

    const slugKey = `profai.slug.${state.sessionId}`;
    // уже сгенерировано для этой сессии (например, вернулись/обновили) — не платим повторно
    let existing: string | null = null;
    try {
      existing = localStorage.getItem(slugKey);
    } catch {
      /* ignore */
    }
    if (existing) {
      navigate(`/report/${existing}`);
      return;
    }

    (async () => {
      try {
        const res = await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile: state.profile,
            openAnswers: state.openAnswers,
            closedAnswers: state.closedAnswers,
          }),
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = await res.json();
        try {
          localStorage.setItem(
            `profai.report.${data.slug}`,
            JSON.stringify({ report: data.report, professions: data.professions, request: data.request }),
          );
          localStorage.setItem(slugKey, data.slug);
        } catch {
          /* ignore */
        }
        navigate(`/report/${data.slug}`);
      } catch {
        navigate('/report/demo'); // сервер недоступен — показываем демо
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind]);

  const patch = (p: Partial<TestState>) => setState((s) => ({ ...s, ...p }));
  const setProfile = (key: string, value: string) =>
    setState((s) => ({ ...s, profile: { ...s.profile, [key]: value } }));
  const setOpen = (key: string, value: string) =>
    setState((s) => ({ ...s, openAnswers: { ...s.openAnswers, [key]: value } }));
  const setClosed = (qid: string, value: number) =>
    setState((s) => ({ ...s, closedAnswers: { ...s.closedAnswers, [qid]: value } }));

  const canNext = useMemo(() => {
    switch (step.kind) {
      case 'intro':
        return true;
      case 'consent':
        return !!state.consentAt;
      case 'anketa':
        return anketaRequiredFilled(state);
      case 'open':
        return (state.openAnswers[step.question.key] ?? '').trim() !== '';
      case 'closed':
        return state.closedAnswers[questionId(step.question)] !== undefined;
      default:
        return true;
    }
  }, [step, state]);

  const progress = Math.round((answeredCount(state) / TOTAL_INPUTS) * 100);

  const goNext = () => patch({ stepIndex: Math.min(state.stepIndex + 1, STEPS.length - 1) });
  const goBack = () => patch({ stepIndex: Math.max(state.stepIndex - 1, 0) });

  const nextIsWaiting = STEPS[state.stepIndex + 1]?.kind === 'waiting';
  const nextLabel = step.kind === 'intro' ? 'Начать' : nextIsWaiting ? 'Завершить' : 'Далее';

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            prof<span>AI</span>
          </div>
          <div className="progress" aria-label="Прогресс теста">
            <div className="progress__fill" style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
          <div className="progress__label">{progress}%</div>
        </div>
      </div>

      <div className="main">
        {/* key по шагу — контент проигрывает enter-анимацию при каждом переходе */}
        <div className="screen" key={state.stepIndex}>
          {step.kind === 'intro' && <IntroScreen />}
          {step.kind === 'consent' && (
            <ConsentScreen
              consented={!!state.consentAt}
              onToggle={(v) => patch({ consentAt: v ? new Date().toISOString() : undefined })}
            />
          )}
          {step.kind === 'anketa' && <AnketaScreen profile={state.profile} onChange={setProfile} />}
          {step.kind === 'open' && (
            <OpenQuestionScreen
              question={step.question}
              section={step.section}
              idx={step.idx}
              total={step.total}
              value={state.openAnswers[step.question.key] ?? ''}
              onChange={(text) => setOpen(step.question.key, text)}
            />
          )}
          {step.kind === 'closed' && (
            <ClosedQuestionScreen
              question={step.question}
              section={step.section}
              idx={step.idx}
              total={step.total}
              value={state.closedAnswers[questionId(step.question)]}
              onAnswer={(v) => setClosed(questionId(step.question), v)}
            />
          )}
          {step.kind === 'waiting' && <WaitingScreen />}
        </div>
      </div>

      {step.kind !== 'waiting' && (
        <div className="footer-actions">
          <div className="footer-actions__inner">
            <button className="btn btn--ghost" onClick={goBack} disabled={state.stepIndex === 0}>
              Назад
            </button>
            <button className="btn btn--primary" onClick={goNext} disabled={!canNext}>
              {nextLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
