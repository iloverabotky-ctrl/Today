import type { BoardColumnId, ColumnId, Store, Task } from './types';

// Keep the same key so the current test data survives the v3 redesign.
export const STORAGE_KEY = 'today-cockpit-v2';

export const defaultColumnTitles: Record<BoardColumnId, string> = {
  today: 'Сегодня',
  week: 'Неделя',
  month: 'Месяц',
  delegated: 'Делегировано команде',
  done: 'Готово',
};

const now = Date.now();

const makeTask = (
  id: string,
  title: string,
  columnId: ColumnId,
  boardOrder: number,
  inNotebook = false,
  notebookOrder = 0,
  steps: string[] = [],
  waitingPerson = '',
  returnAt: number | null = null,
): Task => ({
  id,
  title,
  columnId,
  boardOrder,
  inNotebook,
  notebookOrder,
  steps: steps.map((text, index) => ({
    id: `${id}-step-${index}`,
    text,
    createdAt: now - (steps.length - index) * 18 * 60 * 1000,
  })),
  waitingPerson,
  returnAt,
  createdAt: now - boardOrder * 60_000,
  completedAt: columnId === 'done' ? now : null,
});

export const demo: Store = {
  columnTitles: defaultColumnTitles,
  activeTaskId: 'kpi',
  tasks: [
    makeTask('kpi', 'Поставить KPI Пасты', 'today', 0, true, 0, [
      'Написал Наталье задачу по постановке KPI',
      'Зашёл в GPT и начал собирать KPI для ребят',
      'Жду ОС от Наташи',
    ], 'Наташа', now + 24 * 60 * 60 * 1000),
    makeTask('market', 'Позвонить организатору Маркета у моря', 'today', 1, true, 1, [
      'Нашёл контакт организатора',
    ]),
    makeTask('events', 'Разобрать мероприятия на сентябрь', 'week', 0),
    makeTask('suppliers', 'Проверить поставщиков на новый привоз', 'month', 0),
    makeTask('breakfasts', 'Собрать ОС по завтракам', 'delegated', 0, false, 0, [
      'Передал задачу команде и жду обратную связь',
    ], 'Команда'),
    makeTask('idea', 'Идея: новый формат выездных продаж', 'pool', 0),
  ],
};
