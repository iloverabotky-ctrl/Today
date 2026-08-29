export type BoardColumnId = 'today' | 'week' | 'month' | 'delegated' | 'done';
export type ColumnId = BoardColumnId | 'pool';

export interface TaskStep {
  id: string;
  text: string;
  createdAt: number;
}

export interface Task {
  id: string;
  title: string;
  columnId: ColumnId;
  boardOrder: number;
  inNotebook: boolean;
  notebookOrder: number;
  steps: TaskStep[];
  waitingPerson: string;
  returnAt: number | null;
  createdAt: number;
  completedAt: number | null;
}

export interface Store {
  tasks: Task[];
  columnTitles: Record<BoardColumnId, string>;
  activeTaskId: string | null;
}
