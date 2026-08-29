import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './status-separators.css';
import './waiting-picker.css';
import './team-oneonone.css';
import './work-chat.css';
import { initWorkChatExperience } from './work-chat';

const STORAGE_KEY = 'today-cockpit-v2';

try {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const replaceTerm = (value: unknown): unknown => {
      if (typeof value === 'string') {
        return value
          .replace(/Стимулятор/g, 'Сигнал')
          .replace(/стимулятор/g, 'сигнал');
      }
      if (Array.isArray(value)) return value.map(replaceTerm);
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, replaceTerm(item)]),
        );
      }
      return value;
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(replaceTerm(JSON.parse(raw))));
  }
} catch {
  // Keep loading TODAY even if old local data is malformed.
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);

// Start the notebook enhancement only after React has committed the initial UI.
// The management workspace observer is temporarily disabled here because its
// self-triggering DOM observer could lock the browser in an infinite loop.
window.setTimeout(() => initWorkChatExperience(), 0);
