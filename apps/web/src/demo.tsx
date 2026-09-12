import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { ReportView } from './report/ReportView.js';
import { MOCK_REPORT } from './report/mockReport.js';

// Самодостаточный демо-отчёт (мок) — открывается без сервера и без прохождения теста.
const DEMO_REQUEST =
  'Хочу сменить сферу на более осмысленную и выйти на более высокий доход, занимаясь тем, что мне действительно даётся.';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="app">
      <div className="topbar">
        <div className="topbar__inner">
          <div className="brand">
            prof<span>AI</span>
          </div>
          <div className="progress__label mono" style={{ marginLeft: 'auto' }}>
            демо-отчёт
          </div>
        </div>
      </div>
      <div className="main">
        <div className="container container--report">
          <ReportView report={MOCK_REPORT} request={DEMO_REQUEST} />
        </div>
      </div>
    </div>
  </React.StrictMode>,
);
