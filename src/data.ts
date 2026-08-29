import type { ColumnId, Store, Task } from './types';

export const STORAGE_KEY = 'today-cockpit-v2';

export const defaultColumnTitles: Record<ColumnId, string> = {
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
  createdAt: now - boardOrder * 60_000,
  completedAt: columnId === 'done' ? now : null,
});

export const demo: Store = {
  columnTitles: defaultColumnTitles,
  tasks: [
    makeTask('kpi', 'Поставить KPI Пасты', 'today', 0, true, 0, [
      'Написал Наталье задачу по постановке KPI',
      'Зашёл в GPT и начал собирать KPI для ребят',
      'Жду ОС от Наташи',
    ]),
    makeTask('market', 'Позвонить организатору Маркета у моря', 'today', 1, true, 1, [
      'Нашёл контакт организатора',
    ]),
    makeTask('events', 'Разобрать мероприятия на сентябрь', 'week', 0),
    makeTask('suppliers', 'Проверить поставщиков на новый привоз', 'month', 0),
    makeTask('breakfasts', 'Собрать ОС по завтракам', 'delegated', 0),
  ],
};
