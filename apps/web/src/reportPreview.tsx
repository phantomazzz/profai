import React from 'react';
import ReactDOM from 'react-dom/client';
import type { FinalReport } from '@profai/shared';
import './styles.css';
import { ReportView } from './report/ReportView.js';
import type { ProfInfo } from './report/mockReport.js';
import live from './report/live-sample.json';

// Превью страницы отчёта на РЕАЛЬНОМ ответе Sonnet 5 (сохранён при живом прогоне).
const sample = live as unknown as { report: FinalReport; professions: Record<string, ProfInfo> };

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="app">
      <div className="topbar">
        <div className="topbar__inner">
          <div className="brand mono">
            prof<span>AI</span>
          </div>
          <div className="progress__label mono" style={{ marginLeft: 'auto' }}>
            отчёт · Sonnet 5
          </div>
        </div>
      </div>
      <div className="main">
        <div className="container container--report">
          <ReportView
            report={sample.report}
            professions={sample.professions}
            request="Хочу сменить сферу на аналитику данных и вырасти в доходе, занимаясь осмысленным делом."
          />
        </div>
      </div>
    </div>
  </React.StrictMode>,
);
