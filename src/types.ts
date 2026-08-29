export type ColumnId = 'today' | 'week' | 'month' | 'delegated' | 'done';

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
  createdAt: number;
  completedAt: number | null;
}

export interface Store {
  tasks: Task[];
  columnTitles: Record<ColumnId, string>;
}
