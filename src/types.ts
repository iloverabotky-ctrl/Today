export type BoardColumnId = 'today' | 'week' | 'month' | 'delegated' | 'done';
export type ColumnId = BoardColumnId | 'pool';
export type ProjectId = 'none' | 'pasta' | 'kvep';
export type CityId = 'spb' | 'krasnodar';

export interface TaskStep {
  id: string;
  text: string;
  createdAt: number;
  waitingPerson: string;
  remindAt: number | null;
}

export interface Task {
  id: string;
  title: string;
  columnId: ColumnId;
  boardOrder: number;
  inNotebook: boolean;
  notebookOrder: number;
  notebookAt: number | null;
  notebookCompleted: boolean;
  steps: TaskStep[];
  waitingPerson: string;
  returnAt: number | null;
  assignee: string;
  deadline: number | null;
  project: ProjectId;
  city: CityId;
  createdAt: number;
  completedAt: number | null;
}

export interface Store {
  tasks: Task[];
  columnTitles: Record<BoardColumnId, string>;
  activeTaskId: string | null;
}
