import { useEffect, useMemo, useState } from 'react';
import type { CityId, ProjectId, Task, TaskStep } from './types';

export type MatrixQuadrant =
  | 'urgent-important'
  | 'important-not-urgent'
  | 'urgent-not-important'
  | 'not-urgent-not-important';

export type MatrixAssignments = Record<string, MatrixQuadrant>;
export type MatrixTransferred = Record<string, boolean>;
export type MatrixCityFilter = 'all' | CityId;

export interface MatrixOrigin {
  columnId: Task['columnId'];
  boardOrder: number;
  inNotebook: boolean;
  notebookOrder: number;
  notebookAt: number | null;
  notebookCompleted: boolean;
}

export type MatrixOrigins = Record<string, MatrixOrigin>;
type MatrixSessions = Record<MatrixCityFilter, string[]>;

export const MATRIX_STORAGE_KEY = 'today-eisenhower-v1';
export const MATRIX_ORIGIN_STORAGE_KEY = 'today-eisenhower-origin-v1';
export const MATRIX_TRANSFERRED_STORAGE_KEY = 'today-eisenhower-transferred-v1';
const MATRIX_SESSION_KEY = 'today-eisenhower-session-v1';

export const loadMatrixAssignments = (): MatrixAssignments => {
  try {
    const parsed = JSON.parse(localStorage.getItem(MATRIX_STORAGE_KEY) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) =>
        ['urgent-important', 'important-not-urgent', 'urgent-not-important', 'not-urgent-not-important'].includes(String(value)),
      ),
    ) as MatrixAssignments;
  } catch {
    return {};
  }
};

export const loadMatrixOrigins = (): MatrixOrigins => {
  try {
    const parsed = JSON.parse(localStorage.getItem(MATRIX_ORIGIN_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as MatrixOrigins : {};
  } catch {
    return {};
  }
};

export const loadMatrixTransferred = (): MatrixTransferred => {
  try {
    const parsed = JSON.parse(localStorage.getItem(MATRIX_TRANSFERRED_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as MatrixTransferred : {};
  } catch {
    return {};
  }
};

const loadMatrixSessions = (): MatrixSessions => {
  const empty: MatrixSessions = { all: [], spb: [], krasnodar: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(MATRIX_SESSION_KEY) || '{}') as Partial<MatrixSessions>;
    return {
      all: Array.isArray(parsed.all) ? parsed.all.filter((id): id is string => typeof id === 'string') : [],
      spb: Array.isArray(parsed.spb) ? parsed.spb.filter((id): id is string => typeof id === 'string') : [],
      krasnodar: Array.isArray(parsed.krasnodar) ? parsed.krasnodar.filter((id): id is string => typeof id === 'string') : [],
    };
  } catch {
    return empty;
  }
};

const QUADRANTS: Array<{
  id: MatrixQuadrant;
  icon: string;
  title: string;
  target: string;
  rowLabel: string;
}> = [
  { id: 'urgent-important', icon: '🔥', title: 'Срочно + важно', target: 'Сегодня', rowLabel: 'Сегодня' },
  { id: 'urgent-not-important', icon: '⚡', title: 'Срочно + не важно', target: 'Сегодня · ОП', rowLabel: 'Сегодня · ОП' },
  { id: 'important-not-urgent', icon: '🍃', title: 'Не срочно + важно', target: 'Неделя', rowLabel: 'Неделя' },
  { id: 'not-urgent-not-important', icon: '◷', title: 'Не срочно + не важно', target: 'Долгий ящик', rowLabel: 'Долгий ящик' },
];

const quadrantMeta = (id?: MatrixQuadrant) => QUADRANTS.find((item) => item.id === id);
const projectLabel = (project: ProjectId) => project === 'pasta' ? 'Паста' : project === 'kvep' ? 'КВЭП' : '';
const cityLabel = (city: CityId) => city === 'spb' ? 'СПб' : 'Краснодар';
const formatDeadline = (timestamp: number | null) => timestamp
  ? new Date(timestamp).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '')
  : '';
const toDateTimeLocal = (timestamp: number | null) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromDateTimeLocal = (value: string) => value ? new Date(value).getTime() : null;

function MatrixTaskRow({
  number,
  task,
  assignment,
  onDragStart,
  onDragEnd,
  openSheet,
  updateTask,
  addStep,
  removeTask,
}: {
  number: number;
  task: Task;
  assignment?: MatrixQuadrant;
  onDragStart: () => void;
  onDragEnd: () => void;
  openSheet: () => void;
  updateTask: (taskId: string, patch: Partial<Task>) => void;
  addStep: (taskId: string, text: string) => void;
  removeTask: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newStep, setNewStep] = useState('');
  const current = task.steps.at(-1) || null;
  const assigned = quadrantMeta(assignment);

  return <article className={`matrix-task ${assignment ? 'is-assigned' : ''}`} draggable onDragStart={onDragStart} onDragEnd={onDragEnd}>
    <button className="matrix-task-number" type="button" onClick={openSheet}>{number}</button>
    <div className="matrix-task-body">
      <div className="matrix-task-main">
        <div className="matrix-task-title-wrap">
          <span className={`matrix-project-dot ${task.project}`} />
          <button type="button" className="matrix-task-title" onClick={openSheet}>{task.title}</button>
        </div>
        {current && <button className="matrix-task-current" type="button" onClick={openSheet}>{current.text}</button>}
        <div className="matrix-task-status">
          {assigned && <span className={`matrix-assignment qtag-${assignment}`}>{assigned.rowLabel}</span>}
          {task.deadline && <span className={task.deadline < Date.now() ? 'deadline overdue' : 'deadline'}>{formatDeadline(task.deadline)}</span>}
        </div>
      </div>

      {expanded && <div className="matrix-task-details">
        <label><span>Дедлайн</span><input type="datetime-local" value={toDateTimeLocal(task.deadline)} onChange={(event) => updateTask(task.id, { deadline: fromDateTimeLocal(event.target.value) })} /></label>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!newStep.trim()) return;
          addStep(task.id, newStep);
          setNewStep('');
        }}>
          <input value={newStep} onChange={(event) => setNewStep(event.target.value)} placeholder="Пункт / комментарий..." />
          <button>＋</button>
        </form>
      </div>}
    </div>
    <div className="matrix-task-tools">
      <button type="button" onClick={() => setExpanded((value) => !value)} title="Быстро изменить">{expanded ? '−' : '•••'}</button>
      <button type="button" className="delete" onClick={removeTask} title="Удалить задачу">×</button>
    </div>
  </article>;
}

function MatrixSheet({ task, number, close, openTask }: { task: Task; number: number; close: () => void; openTask: (taskId: string) => void }) {
  return <div className="matrix-sheet-backdrop" onMouseDown={(event) => event.target === event.currentTarget && close()}>
    <aside className="matrix-sheet">
      <div className="matrix-sheet-top"><span className="matrix-sheet-number">{number}</span><button type="button" onClick={close}>×</button></div>
      <h2>{task.title}</h2>
      {task.steps.at(-1) && <p className="matrix-sheet-current">{task.steps.at(-1)?.text}</p>}
      <div className="matrix-sheet-meta">
        {projectLabel(task.project) && <span>{projectLabel(task.project)}</span>}
        <span>{cityLabel(task.city)}</span>
        {task.deadline && <span>{formatDeadline(task.deadline)}</span>}
      </div>
      {task.steps.length > 0 && <div className="matrix-sheet-steps">
        {task.steps.slice(-4).map((step: TaskStep) => <div key={step.id}><i>↳</i><span>{step.text}</span></div>)}
      </div>}
      <button type="button" className="matrix-sheet-open" onClick={() => openTask(task.id)}>Открыть задачу →</button>
    </aside>
  </div>;
}

export function MatrixPage({
  tasks,
  city,
  setCity,
  assignments,
  transferred,
  assignTask,
  clearAssignment,
  transferQuadrant,
  createTask,
  updateTask,
  addStep,
  deleteTask,
  restoreTask,
  openTask,
}: {
  tasks: Task[];
  city: MatrixCityFilter;
  setCity: (city: MatrixCityFilter) => void;
  assignments: MatrixAssignments;
  transferred: MatrixTransferred;
  assignTask: (taskId: string, quadrant: MatrixQuadrant) => void;
  clearAssignment: (taskId: string) => void;
  transferQuadrant: (quadrant: MatrixQuadrant, taskIds: string[]) => void;
  createTask: (title: string, city: CityId, project: ProjectId) => string | null;
  updateTask: (taskId: string, patch: Partial<Task>) => void;
  addStep: (taskId: string, text: string) => void;
  deleteTask: (taskId: string) => Task | null;
  restoreTask: (task: Task, quadrant?: MatrixQuadrant) => void;
  openTask: (taskId: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverQuadrant, setDragOverQuadrant] = useState<MatrixQuadrant | null>(null);
  const [sessions, setSessions] = useState<MatrixSessions>(loadMatrixSessions);
  const [manual, setManual] = useState<Record<MatrixQuadrant, string>>({
    'urgent-important': '',
    'important-not-urgent': '',
    'urgent-not-important': '',
    'not-urgent-not-important': '',
  });
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newProject, setNewProject] = useState<ProjectId>('none');
  const [newCity, setNewCity] = useState<CityId>(city === 'krasnodar' ? 'krasnodar' : 'spb');
  const [inboxPage, setInboxPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleted, setDeleted] = useState<{ task: Task; quadrant?: MatrixQuadrant } | null>(null);

  useEffect(() => {
    if (city !== 'all') setNewCity(city);
    setInboxPage(0);
  }, [city]);

  useEffect(() => {
    localStorage.setItem(MATRIX_SESSION_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (!deleted) return;
    const timer = window.setTimeout(() => setDeleted(null), 5000);
    return () => window.clearTimeout(timer);
  }, [deleted]);

  const matrixTasks = useMemo(() => tasks
    .filter((task) =>
      task.columnId === 'pool'
      && !task.inNotebook
      && !transferred[task.id]
      && (city === 'all' || task.city === city),
    )
    .sort((a, b) => a.createdAt - b.createdAt), [tasks, city, transferred]);

  const matrixKey = matrixTasks.map((task) => task.id).join('|');
  useEffect(() => {
    const ids = matrixTasks.map((task) => task.id);
    setSessions((current) => {
      const currentOrder = current[city] || [];
      const valid = currentOrder.filter((id) => tasks.some((task) => task.id === id));
      const missing = ids.filter((id) => !valid.includes(id));
      const nextOrder = [...valid, ...missing];
      if (nextOrder.length === currentOrder.length && nextOrder.every((id, index) => id === currentOrder[index])) return current;
      return { ...current, [city]: nextOrder };
    });
  }, [city, matrixKey, tasks]);

  const sessionOrder = sessions[city] || [];
  const numberById = useMemo(() => new Map(sessionOrder.map((id, index) => [id, index + 1])), [sessionOrder]);
  const byId = useMemo(() => new Map(matrixTasks.map((task) => [task.id, task])), [matrixTasks]);
  const orderedTasks = useMemo(() => {
    const ordered = sessionOrder.map((id) => byId.get(id)).filter((task): task is Task => Boolean(task));
    const missing = matrixTasks.filter((task) => !sessionOrder.includes(task.id));
    return [...ordered, ...missing];
  }, [sessionOrder, byId, matrixTasks]);

  // Important UX rule: assigning to a quadrant does NOT remove the task from this list.
  // It disappears only after the explicit Transfer action.
  const inboxTasks = orderedTasks;
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(inboxTasks.length / pageSize));
  const safeInboxPage = Math.min(inboxPage, totalPages - 1);
  const visibleInbox = inboxTasks.slice(safeInboxPage * pageSize, safeInboxPage * pageSize + pageSize);
  const selectedTask = selectedId ? tasks.find((task) => task.id === selectedId) || null : null;
  const assignedCount = orderedTasks.filter((task) => Boolean(assignments[task.id])).length;

  useEffect(() => {
    if (inboxPage > totalPages - 1) setInboxPage(Math.max(0, totalPages - 1));
  }, [inboxTasks.length, inboxPage, totalPages]);

  const resetSession = () => {
    const ids = matrixTasks.map((task) => task.id);
    setSessions((current) => ({ ...current, [city]: ids }));
    setInboxPage(0);
  };

  const applyNumbers = (quadrant: MatrixQuadrant) => {
    const byNumber = new Map(sessionOrder.map((id, index) => [index + 1, id]));
    const indexes = manual[quadrant].split(/[\s,;]+/).map((value) => Number(value.trim())).filter(Number.isInteger);
    [...new Set(indexes)].forEach((number) => {
      const id = byNumber.get(number);
      if (id && byId.has(id)) assignTask(id, quadrant);
    });
    setManual((current) => ({ ...current, [quadrant]: '' }));
  };

  const submitNew = () => {
    const id = createTask(newTitle, newCity, newProject);
    if (!id) return;
    setNewTitle('');
    setNewTaskOpen(false);
  };

  const remove = (task: Task) => {
    const snapshot = deleteTask(task.id);
    if (snapshot) setDeleted({ task: snapshot, quadrant: assignments[task.id] });
    if (selectedId === task.id) setSelectedId(null);
  };

  const undoDelete = () => {
    if (!deleted) return;
    restoreTask(deleted.task, deleted.quadrant);
    setDeleted(null);
  };

  return <main className="matrix-page matrix-ios">
    <div className="matrix-heading">
      <div>
        <h1>Матрица</h1>
        <p>Сначала приоритет → потом перенос на Доску.</p>
      </div>
      <div className="matrix-heading-tools">
        <div className="matrix-city-switch">
          <button className={city === 'all' ? 'active' : ''} onClick={() => setCity('all')}>Все <span>{tasks.filter((task) => task.columnId === 'pool' && !task.inNotebook && !transferred[task.id]).length}</span></button>
          <button className={city === 'spb' ? 'active' : ''} onClick={() => setCity('spb')}>СПб</button>
          <button className={city === 'krasnodar' ? 'active' : ''} onClick={() => setCity('krasnodar')}>Краснодар</button>
        </div>
        <details className="matrix-more">
          <summary>•••</summary>
          <div><button type="button" onClick={resetSession}>Новый разбор</button></div>
        </details>
      </div>
    </div>

    <section className="matrix-inbox">
      <div className="matrix-section-head">
        <div><strong>Входящие</strong><span>{inboxTasks.length}</span>{assignedCount > 0 && <small>{assignedCount} распределено</small>}</div>
        <button type="button" className="matrix-inbox-add" onClick={() => setNewTaskOpen((value) => !value)}>＋</button>
      </div>

      {newTaskOpen && <form className="matrix-add" onSubmit={(event) => { event.preventDefault(); submitNew(); }}>
        <input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setNewTaskOpen(false); }} placeholder="Новая задача..." />
        <div className="matrix-project-picker">
          {(['none', 'pasta', 'kvep'] as ProjectId[]).map((project) => <button key={project} type="button" className={newProject === project ? 'active' : ''} onClick={() => setNewProject(project)}>{project === 'none' ? 'Без проекта' : projectLabel(project)}</button>)}
        </div>
        {city === 'all' && <select value={newCity} onChange={(event) => setNewCity(event.target.value as CityId)}><option value="spb">СПб</option><option value="krasnodar">Краснодар</option></select>}
        <button className="matrix-add-submit">Enter</button>
        <button type="button" className="matrix-add-close" onClick={() => setNewTaskOpen(false)}>×</button>
      </form>}

      <div className="matrix-task-list">
        {visibleInbox.length === 0
          ? <div className="matrix-empty-list">Здесь появятся новые задачи для разбора.</div>
          : visibleInbox.map((task) => <MatrixTaskRow
              key={task.id}
              number={numberById.get(task.id) || 0}
              task={task}
              assignment={assignments[task.id]}
              onDragStart={() => setDragId(task.id)}
              onDragEnd={() => { setDragId(null); setDragOverQuadrant(null); }}
              openSheet={() => setSelectedId(task.id)}
              updateTask={updateTask}
              addStep={addStep}
              removeTask={() => remove(task)}
            />)}
      </div>

      {inboxTasks.length > pageSize && <div className="matrix-inbox-pager">
        <button type="button" disabled={safeInboxPage === 0} onClick={() => setInboxPage((page) => Math.max(0, page - 1))}>‹</button>
        <span>{safeInboxPage * pageSize + 1}–{Math.min((safeInboxPage + 1) * pageSize, inboxTasks.length)} из {inboxTasks.length}</span>
        <button type="button" disabled={safeInboxPage >= totalPages - 1} onClick={() => setInboxPage((page) => Math.min(totalPages - 1, page + 1))}>›</button>
      </div>}
    </section>

    <section className="matrix-board">
      <div className="matrix-quadrants">
        {QUADRANTS.map((quadrant) => {
          const assigned = orderedTasks.filter((task) => assignments[task.id] === quadrant.id);
          const ids = assigned.map((task) => task.id);
          return <section
            key={quadrant.id}
            className={`matrix-quadrant q-${quadrant.id} ${dragOverQuadrant === quadrant.id ? 'is-drag-over' : ''}`}
            onDragEnter={(event) => { event.preventDefault(); if (dragId) setDragOverQuadrant(quadrant.id); }}
            onDragOver={(event) => { event.preventDefault(); if (dragId) setDragOverQuadrant(quadrant.id); }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragOverQuadrant(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragId) assignTask(dragId, quadrant.id);
              setDragId(null);
              setDragOverQuadrant(null);
            }}
          >
            <header>
              <div className="matrix-q-title"><span className="matrix-q-icon">{quadrant.icon}</span><strong>{quadrant.title}</strong><b>{assigned.length}</b></div>
              <small>→ {quadrant.target}</small>
            </header>

            <div className="matrix-q-body">
              <div className="matrix-number-cloud">
                {assigned.map((task) => <button
                  key={task.id}
                  type="button"
                  className="matrix-number-chip"
                  data-title={task.title}
                  onClick={() => setSelectedId(task.id)}
                  onContextMenu={(event) => { event.preventDefault(); clearAssignment(task.id); }}
                >{numberById.get(task.id)}</button>)}
                {assigned.length === 0 && <span className="matrix-q-placeholder">{dragId ? 'Отпусти здесь' : 'Перетащи задачу'}</span>}
              </div>
            </div>

            <div className="matrix-q-footer">
              <form className="matrix-manual" onSubmit={(event) => { event.preventDefault(); applyNumbers(quadrant.id); }}>
                <input value={manual[quadrant.id]} onChange={(event) => setManual((current) => ({ ...current, [quadrant.id]: event.target.value }))} placeholder="Добавить №" />
                <button>↵</button>
              </form>
              <button type="button" className="matrix-transfer" disabled={assigned.length === 0} onClick={() => transferQuadrant(quadrant.id, ids)}>
                Перенести {assigned.length || ''} → {quadrant.target}
              </button>
            </div>
          </section>;
        })}
      </div>
    </section>

    <div className="matrix-footnote"><span>Задача остаётся во «Входящих», пока ты не нажмёшь «Перенести».</span><span>ПКМ по номеру — снять приоритет.</span></div>

    {selectedTask && <MatrixSheet task={selectedTask} number={numberById.get(selectedTask.id) || 0} close={() => setSelectedId(null)} openTask={openTask} />}

    {deleted && <div className="matrix-undo-toast">
      <span>Задача удалена</span>
      <button type="button" onClick={undoDelete}>Отменить</button>
      <button type="button" className="close" onClick={() => setDeleted(null)}>×</button>
    </div>}
  </main>;
}
