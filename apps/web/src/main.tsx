import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import './styles.css';
import { TestFlow } from './TestFlow.js';
import { ReportScreen } from './screens/ReportScreen.js';

// Демо-сборка (для статик-хостинга/ссылки заказчику) — HashRouter: работает на
// любом хостинге и в ссылке-артефакте без настройки редиректов.
const Router = import.meta.env.VITE_DEMO ? HashRouter : BrowserRouter;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<TestFlow />} />
        <Route path="/report/:slug" element={<ReportScreen />} />
      </Routes>
    </Router>
  </React.StrictMode>,
);
