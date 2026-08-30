import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './team-oneonone.css';
import './v6.css';
import './v6-fixes.css';
import './notebook-classic.css';
import './notebook-stage-fix.css';
import './notebook-history.css';
import './task-focus.css';
import './notebook-calm.css';
import { initSafeManagementWorkspace } from './management-safe';

const STORAGE_KEY = 'today-cockpit-v2';

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const replaceTerm = (value: unknown): unknown => {
      if (typeof value === 'string') {
        return value.replace(/Стимулятор/g, 'Сигнал').replace(/стимулятор/g, 'сигнал');
      }
      if (Array.isArray(value)) return value.map(replaceTerm);
      if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, replaceTerm(item)]));
      }
      return value;
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(replaceTerm(JSON.parse(raw))));
  }
} catch {
  // Keep TODAY loading even if an old local backup is malformed.
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
window.setTimeout(() => initSafeManagementWorkspace(), 0);
