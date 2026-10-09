import { useEffect, useMemo, useState } from 'react';
import type { CityId, ProjectId, Task, TaskStep } from './types';

export type MatrixQuadrant =
  | 'urgent-important'
  | 'important-not-urgent'
  | 'urgent-not-important'
  | 'not-urgent-not-important';

export type MatrixAssignments = Record<string, MatrixQuadrant>;
export type MatrixCityFilter = 'all' | CityId;

export const MATRIX_STORAGE_KEY = 'today-eisenhower-v1';

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

const QUADRANTS: Array<{
  id: MatrixQuadrant;
  number: number;
  title: string;
  subtitle: string;
  target: string;
}> = [
  { id: 'urgent-important', number: 1, title: 'Срочно + важно', subtitle: 'Главное, что двигаю сегодня', target: '→ Сегодня' },
  { id: 'urgent-not-important', number: 2, title: 'Срочно + не важно', subtitle: 'Текучка, которую надо закрыть', target: '→ Сегодня · ОП' },
  { id: 'important-not-urgent', number: 3, title: 'Важно + не срочно', subtitle: 'Системная работа и развитие', target: '→ Неделя' },
  { id: 'not-urgent-not-important', number: 4, title: 'Не срочно + не важно', subtitle: 'Не должно занимать внимание сейчас', target: '→ Долгий ящик' },
];

const projectLabel = (project: ProjectId) => project === 'pasta' ? 'Паста' : project === 'kvep' ? 'КВЭП' : '';
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
  quadrant,
  onDragStart,
  openTask,
  updateTask,
  addStep,
}: {
  number: number;
  task: Task;
  quadrant?: MatrixQuadrant;
  onDragStart: () => void;
  openTask: (taskId: string) => void;
  updateTask: (taskId: string, patch: Partial<Task>) => void;
  addStep: (taskId: string, text: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [newStep, setNewStep] = useState('');
  const visibleSteps = expanded ? task.steps : task.steps.slice(-2);

  return <article className={`matrix-task ${quadrant ? 'is-classified' : 'is-inbox'}`} draggable onDragStart={onDragStart}>
    <button className="matrix-task-number" type="button" onClick={() => openTask(task.id)} title="Открыть задачу">{number}</button>
    <div className="matrix-task-body">
      <div className="matrix-task-main">
        <div className="matrix-task-title-wrap">
          <span className={`matrix-project-dot ${task.project}`} />
          <button type="button" className="matrix-task-title" onClick={() => openTask(task.id)}>{task.title}</button>
        </div>
        <div className="matrix-task-meta">
          {projectLabel(task.project) && <span>{projectLabel(task.project)}</span>}
          {task.columnId === 'delegated' && <span>делегировано</span>}
          {task.deadline && <span className={task.deadline < Date.now() ? 'deadline overdue' : 'deadline'}>до {formatDeadline(task.deadline)}</span>}
        </div>
      </div>

      {visibleSteps.length > 0 && <div className="matrix-task-steps">
        {visibleSteps.map((step: TaskStep) => <button type="button" key={step.id} onClick={() => openTask(task.id)}><span>↳</span>{step.text}</button>)}
        {!expanded && task.steps.length > 2 && <button type="button" className="matrix-more-steps" onClick={() => setExpanded(true)}>ещё {task.steps.length - 2}</button>}
      </div>}

      {expanded && <div className="matrix-task-details">
        <label>
          <span>Дедлайн</span>
          <input type="datetime-local" value={toDateTimeLocal(task.deadline)} onChange={(event) => updateTask(task.id, { deadline: fromDateTimeLocal(event.target.value) })} />
        </label>
        <form onSubmit={(event) => {
          event.preventDefault();
          if (!newStep.trim()) return;
          addStep(task.id, newStep);
          setNewStep('');
        }}>
          <input value={newStep} onChange={(event) => setNewStep(event.target.value)} placeholder="Добавить пункт / комментарий..." />
          <button>＋</button>
        </form>
      </div>}
    </div>
    <button type="button" className="matrix-expand" onClick={() => setExpanded((value) => !value)} title={expanded ? 'Свернуть' : 'Детали'}>{expanded ? '−' : '···'}</button>
  </article>;
}

export function MatrixPage({
  tasks,
  city,
  setCity,
  assignments,
  assignTask,
  clearAssignment,
  createTask,
  updateTask,
  addStep,
  openTask,
}: {
  tasks: Task[];
  city: MatrixCityFilter;
  setCity: (city: MatrixCityFilter) => void;
  assignments: MatrixAssignments;
  assignTask: (taskId: string, quadrant: MatrixQuadrant) => void;
  clearAssignment: (taskId: string) => void;
  createTask: (title: string, city: CityId, project: ProjectId) => string | null;
  updateTask: (taskId: string, patch: Partial<Task>) => void;
  addStep: (taskId: string, text: string) => void;
  openTask: (taskId: string) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [manual, setManual] = useState<Record<MatrixQuadrant, string>>({
    'urgent-important': '',
    'important-not-urgent': '',
    'urgent-not-important': '',
    'not-urgent-not-important': '',
  });
  const [newTitle, setNewTitle] = useState('');
  const [newProject, setNewProject] = useState<ProjectId>('none');
  const [newCity, setNewCity] = useState<CityId>(city === 'krasnodar' ? 'krasnodar' : 'spb');

  useEffect(() => {
    if (city !== 'all') setNewCity(city);
  }, [city]);

  const visibleTasks = useMemo(() => {
    const rank: Record<string, number> = { today: 0, week: 1, month: 2, pool: 3, delegated: 4, done: 5 };
    return tasks
      .filter((task) => task.columnId !== 'done' && (city === 'all' || task.city === city))
      .sort((a, b) => {
        const classified = Number(Boolean(assignments[a.id])) - Number(Boolean(assignments[b.id]));
        if (classified !== 0) return classified;
        const column = (rank[a.columnId] ?? 9) - (rank[b.columnId] ?? 9);
        if (column !== 0) return column;
        return a.boardOrder - b.boardOrder || a.createdAt - b.createdAt;
      });
  }, [tasks, city, assignments]);

  const numberById = useMemo(() => new Map(visibleTasks.map((task, index) => [task.id, index + 1])), [visibleTasks]);
  const unclassified = visibleTasks.filter((task) => !assignments[task.id]).length;

  const applyNumbers = (quadrant: MatrixQuadrant) => {
    const indexes = manual[quadrant]
      .split(/[\s,;]+/)
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0 && value <= visibleTasks.length);
    [...new Set(indexes)].forEach((number) => assignTask(visibleTasks[number - 1].id, quadrant));
    setManual((current) => ({ ...current, [quadrant]: '' }));
  };

  const submitNew = () => {
    const id = createTask(newTitle, newCity, newProject);
    if (!id) return;
    setNewTitle('');
  };

  return <main className="matrix-page">
    <div className="matrix-heading">
      <div>
        <h1>Матрица</h1>
        <p>Сначала расставь приоритеты. Доска перестроится сама.</p>
      </div>
      <div className="matrix-city-switch">
        <button className={city === 'all' ? 'active' : ''} onClick={() => setCity('all')}>Все</button>
        <button className={city === 'spb' ? 'active' : ''} onClick={() => setCity('spb')}>СПб</button>
        <button className={city === 'krasnodar' ? 'active' : ''} onClick={() => setCity('krasnodar')}>Краснодар</button>
      </div>
    </div>

    <section className="matrix-inbox">
      <div className="matrix-section-head">
        <div><strong>Задачи</strong><span>{visibleTasks.length}</span></div>
        <small>{unclassified > 0 ? `Нужно разобрать · ${unclassified}` : 'Всё разложено'}</small>
      </div>

      <form className="matrix-add" onSubmit={(event) => { event.preventDefault(); submitNew(); }}>
        <span>＋</span>
        <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Выгрузить задачу..." />
        <div className="matrix-project-picker">
          {(['none', 'pasta', 'kvep'] as ProjectId[]).map((project) => <button key={project} type="button" className={newProject === project ? 'active' : ''} onClick={() => setNewProject(project)}>{project === 'none' ? 'Без проекта' : projectLabel(project)}</button>)}
        </div>
        {city === 'all' && <select value={newCity} onChange={(event) => setNewCity(event.target.value as CityId)}><option value="spb">СПб</option><option value="krasnodar">Краснодар</option></select>}
        <button className="matrix-add-submit">Enter</button>
      </form>

      <div className="matrix-task-list">
        {visibleTasks.length === 0
          ? <div className="matrix-empty-list">Здесь пока нет открытых задач.</div>
          : visibleTasks.map((task, index) => <MatrixTaskRow
              key={task.id}
              number={index + 1}
              task={task}
              quadrant={assignments[task.id]}
              onDragStart={() => setDragId(task.id)}
              openTask={openTask}
              updateTask={updateTask}
              addStep={addStep}
            />)}
      </div>
    </section>

    <section className="matrix-board">
      <div className="matrix-axis matrix-axis-top"><span>ВАЖНО</span><span>НЕ ВАЖНО</span></div>
      <div className="matrix-axis matrix-axis-side"><span>СРОЧНО</span><span>НЕ СРОЧНО</span></div>
      <div className="matrix-quadrants">
        {QUADRANTS.map((quadrant) => {
          const assigned = visibleTasks.filter((task) => assignments[task.id] === quadrant.id);
          return <section
            key={quadrant.id}
            className={`matrix-quadrant q-${quadrant.id}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => { if (dragId) assignTask(dragId, quadrant.id); setDragId(null); }}
          >
            <header>
              <div><span className="matrix-q-number">{quadrant.number}</span><div><strong>{quadrant.title}</strong><small>{quadrant.subtitle}</small></div></div>
              <em>{quadrant.target}</em>
            </header>

            <div className="matrix-q-tasks">
              {assigned.map((task) => <article key={task.id} className="matrix-q-task">
                <button type="button" className="matrix-q-task-main" onClick={() => openTask(task.id)}>
                  <b>{numberById.get(task.id)}</b>
                  <span>{task.title}</span>
                </button>
                <button type="button" className="matrix-q-remove" title="Убрать из матрицы" onClick={() => clearAssignment(task.id)}>×</button>
              </article>)}
              {assigned.length === 0 && <div className="matrix-q-placeholder">Перетащи задачу сюда</div>}
            </div>

            <form className="matrix-manual" onSubmit={(event) => { event.preventDefault(); applyNumbers(quadrant.id); }}>
              <input value={manual[quadrant.id]} onChange={(event) => setManual((current) => ({ ...current, [quadrant.id]: event.target.value }))} placeholder="№ 1, 4, 7" />
              <button>Enter</button>
            </form>
          </section>;
        })}
      </div>
    </section>

    <div className="matrix-footnote">
      <span>Перетащи задачу или введи её номер.</span>
      <span><i className="matrix-op-sample" /> Операционка остаётся в «Сегодня», но отмечается отдельно.</span>
    </div>
  </main>;
}
