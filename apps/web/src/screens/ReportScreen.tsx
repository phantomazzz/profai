import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { FinalReport } from '@profai/shared';
import { loadState } from '../session.js';
import { ReportView } from '../report/ReportView.js';
import { MOCK_REPORT, type ProfInfo } from '../report/mockReport.js';

/** Запрос по умолчанию для демо-отчёта (когда тест не проходили) — под текст MOCK_REPORT. */
const DEMO_REQUEST =
  'Хочу сменить сферу на более осмысленную и выйти на более высокий доход, занимаясь тем, что мне действительно даётся.';

type Mode = 'loading' | 'live' | 'mock';
interface ReportPayload {
  report: FinalReport;
  professions?: Record<string, ProfInfo>;
  request?: string;
}

export function ReportScreen() {
  const { slug } = useParams();
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [mode, setMode] = useState<Mode>('loading');

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (slug === 'demo' || !slug) {
        setPayload({ report: MOCK_REPORT, request: loadState()?.profile.personalRequest || DEMO_REQUEST });
        setMode('mock');
        return;
      }
      // локальный кэш по slug — мгновенно и без сети
      const cacheKey = `profai.report.${slug}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setPayload(JSON.parse(cached));
          setMode('live');
          return;
        }
      } catch {
        /* ignore */
      }
      // читаем сохранённый отчёт с сервера (LLM не вызывается)
      try {
        const res = await fetch(`/api/report/${slug}`);
        if (!res.ok) throw new Error(`status ${res.status}`);
        const data = (await res.json()) as ReportPayload;
        if (cancelled) return;
        setPayload(data);
        setMode('live');
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data));
        } catch {
          /* ignore */
        }
      } catch {
        if (cancelled) return;
        setPayload({ report: MOCK_REPORT, request: loadState()?.profile.personalRequest });
        setMode('mock');
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="app">
      <div className="topbar">
        <div className="topbar__inner">
          <div className="brand mono">
            prof<span>AI</span>
          </div>
          <div className="progress__label mono" style={{ marginLeft: 'auto' }}>
            /report/{slug}
          </div>
        </div>
      </div>

      <div className="main">
        {mode === 'loading' && (
          <div className="container center">
            <div className="spinner" />
            <p className="lead">Загружаем отчёт…</p>
          </div>
        )}
        {payload && mode !== 'loading' && (
          <div className="container container--report screen">
            {mode === 'mock' && (
              <div className="demo-note mono">
                {import.meta.env.VITE_DEMO
                  ? 'пример отчёта'
                  : 'демо-данные · запусти сервер отчётов, чтобы увидеть отчёт по своим ответам'}
              </div>
            )}
            <ReportView report={payload.report} request={payload.request} professions={payload.professions} />
            <p style={{ marginTop: 24 }}>
              <Link className="btn btn--ghost" to="/">← На главную</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
