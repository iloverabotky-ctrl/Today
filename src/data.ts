import type { BoardColumnId, ColumnId, Store, Task } from './types';

// Keep the v2 key so data from the previous test version migrates automatically.
export const STORAGE_KEY = 'today-cockpit-v2';

export const defaultColumnTitles: Record<BoardColumnId, string> = {
  today: 'Сегодня',
  week: 'Неделя',
  month: 'Месяц',
  delegated: 'Делегировано команде',
  done: 'Готово',
};

const now = Date.now();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const makeTask = (
  id: string,
  title: string,
  columnId: ColumnId,
  boardOrder: number,
  inNotebook = false,
  notebookOrder = 0,
  steps: Array<{ text: string; age: number }> = [],
  waitingPerson = '',
  returnAt: number | null = null,
): Task => ({
  id,
  title,
  columnId,
  boardOrder,
  inNotebook,
  notebookOrder,
  steps: steps.map((step, index) => ({
    id: `${id}-step-${index}`,
    text: step.text,
    createdAt: now - step.age,
  })),
  waitingPerson,
  returnAt,
  createdAt: now - (boardOrder + 1) * HOUR,
  completedAt: columnId === 'done' ? now : null,
});

export const demo: Store = {
  columnTitles: defaultColumnTitles,
  activeTaskId: 'kpi',
  tasks: [
    makeTask('kpi', 'Поставить KPI Пасты', 'today', 0, true, 0, [
      { text: 'Написал Наталье задачу по постановке KPI', age: 3 * HOUR },
      { text: 'Зашёл в GPT и собрал основу KPI для ребят', age: 2 * HOUR },
      { text: 'Жду ОС от Наташи', age: 45 * 60 * 1000 },
    ], 'Наташа', now + DAY),
    makeTask('market', 'Позвонить организатору Маркета у моря', 'today', 1, true, 1, [
      { text: 'Нашёл контакт организатора', age: 25 * 60 * 1000 },
    ]),
    makeTask('events', 'Разобрать мероприятия на сентябрь', 'today', 2, true, 2, [
      { text: 'Собрал длинный список событий', age: 3 * DAY },
    ]),
    makeTask('breakfasts', 'Собрать ОС по завтракам', 'delegated', 0, false, 0, [
      { text: 'Передал задачу команде', age: 5 * HOUR },
    ], 'Команда', now + 3 * DAY),
    makeTask('suppliers', 'Проверить поставщиков на новый привоз', 'month', 0),
    makeTask('content', 'Сценарий следующего Reels Пасты', 'week', 0),
    makeTask('idea', 'Идея: новый формат выездных продаж', 'pool', 0),
  ],
};
