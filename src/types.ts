export type Place = 'pool' | 'week' | 'today' | 'now' | 'done';
export type TaskState = 'waiting' | 'delegated' | 'blocked' | null;
export interface Task {
  id: string; title: string; place: Place; state: TaskState;
  stoppedAt: string; nextStep: string; waitingFor: string; result: string;
  attentionAt: string | null; order: number; createdAt: number; completedAt: number | null;
}
export interface Store { tasks: Task[]; }
