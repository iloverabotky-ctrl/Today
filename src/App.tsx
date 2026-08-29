import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardColumnId, ColumnId, Store, Task } from './types';
import { defaultColumnTitles, demo, STORAGE_KEY } from './data';

const boardColumnIds: BoardColumnId[] = ['today', 'week', 'month', 'delegated', 'done'];
type Page = 'notebook' | 'board' | 'people';
const DAY = 24 * 60 * 60 * 1000;
const newId = () => crypto.randomUUID();

const normalizeStore = (value: unknown): Store => {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Store> & { tasks?: unknown[] };
  const tasks = Array.isArray(raw.tasks)
    ? raw.tasks.map((item, index) => {
        const task = (item && typeof item === 'object' ? item : {}) as Partial<Task>;
        const columnId: ColumnId = ['today', 'week', 'month', 'delegated', 'done', 'pool'].includes(String(task.columnId))
          ? (task.columnId as ColumnId)
          : 'pool';
        return {
          id: task.id || newId(),
          title: task.title || `Задача ${index + 1}`,
          columnId,
          boardOrder: Number.isFinite(task.boardOrder) ? Number(task.boardOrder) : index,
          inNotebook: Boolean(task.inNotebook),
          notebookOrder: Number.isFinite(task.notebookOrder) ? Number(task.notebookOrder) : index,
          steps: Array.isArray(task.steps) ? task.steps : [],
          waitingPerson: typeof task.waitingPerson === 'string' ? task.waitingPerson : '',
          returnAt: typeof task.returnAt === 'number' ? task.returnAt : null,
          createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.now(),
          completedAt: typeof task.completedAt === 'number' ? task.completedAt : null,
        } satisfies Task;
      })
    : demo.tasks;

  const activeTaskId = typeof raw.activeTaskId === 'string' && tasks.some((task) => task.id === raw.activeTaskId)
    ? raw.activeTaskId
    : null;

  return {
    tasks,
    columnTitles: { ...defaultColumnTitles, ...(raw.columnTitles || {}) },
    activeTaskId,
  };
};

const loadStore = (): Store => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeStore(JSON.parse(raw)) : demo;
  } catch {
    return demo;
  }
};

const nextBoardOrder = (tasks: Task[], columnId: ColumnId) =>
  Math.max(-1, ...tasks.filter((task) => task.columnId === columnId).map((task) => task.boardOrder)) + 1;

const nextNotebookOrder = (tasks: Task[]) =>
  Math.max(-1, ...tasks.filter((task) => task.inNotebook).map((task) => task.notebookOrder)) + 1;

const lastTouched = (task: Task) => task.steps.at(-1)?.createdAt ?? task.createdAt;

const ageLabel = (timestamp: number, now: number) => {
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return 'сейчас';
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'вчера' : `${days} дн`;
};

const returnLabel = (timestamp: number | null, now: number) => {
  if (!timestamp) return '';
  if (timestamp <= now) return 'вернуть сейчас';
  const diff = timestamp - now;
  const hours = Math.ceil(diff / (60 * 60 * 1000));
  if (hours <= 24) return `через ${hours} ч`;
  return `через ${Math.ceil(hours / 24)} дн`;
};

function App() {
  const [store, setStore] = useState<Store>(loadStore);
  const [page, setPage] = useState<Page>('notebook');
  const [dragBoardId, setDragBoardId] = useState<string | null>(null);
  const [dragNotebookId, setDragNotebookId] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [poolOpen, setPoolOpen] = useState(false);
  const [checkpointTarget, setCheckpointTarget] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const quickRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (quickOpen) window.setTimeout(() => quickRef.current?.focus(), 0);
  }, [quickOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (event.key === 'Escape' && quickOpen) {
        setQuickOpen(false);
        return;
      }
      if (typing) return;
      if (event.key.toLowerCase() === 'n') {
        event.preventDefault();
        setQuickOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        setPage('notebook');
        window.setTimeout(() => document.querySelector<HTMLInputElement>('#new-notebook-task')?.focus(), 0);
      }
      if (event.altKey && event.key === '1') setPage('notebook');
      if (event.altKey && event.key === '2') setPage('board');
      if (event.altKey && event.key === '3') setPage('people');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [quickOpen]);

  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.timeline-scroll').forEach((node) => {
      node.scrollLeft = node.scrollWidth;
    });
  }, [store.tasks]);

  const notebookTasks = useMemo(
    () => store.tasks.filter((task) => task.inNotebook && task.columnId === 'today').sort((a, b) => a.notebookOrder - b.notebookOrder),
    [store.tasks],
  );

  const waitingTasks = useMemo(
    () => store.tasks.filter((task) => task.waitingPerson.trim() && task.columnId !== 'done'),
    [store.tasks],
  );

  const dueTasks = useMemo(
    () => store.tasks.filter((task) => task.returnAt !== null && task.returnAt <= now && task.columnId !== 'done'),
    [store.tasks, now],
  );

  const staleTasks = useMemo(
    () => store.tasks.filter((task) => task.inNotebook && task.columnId === 'today' && now - lastTouched(task) >= 2 * DAY),
    [store.tasks, now],
  );

  const updateTask = (id: string, patch: Partial<Task>) => {
    setStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, ...patch } : task) }));
  };

  const createTask = (title: string, columnId: ColumnId = 'pool', inNotebook = false) => {
    const clean = title.trim();
    if (!clean) return;
    setStore((current) => {
      const actualColumn: ColumnId = inNotebook ? 'today' : columnId;
      const task: Task = {
        id: newId(),
        title: clean,
        columnId: actualColumn,
        boardOrder: nextBoardOrder(current.tasks, actualColumn),
        inNotebook,
        notebookOrder: inNotebook ? nextNotebookOrder(current.tasks) : 0,
        steps: [],
        waitingPerson: '',
        returnAt: null,
        createdAt: Date.now(),
        completedAt: actualColumn === 'done' ? Date.now() : null,
      };
      return { ...current, tasks: [...current.tasks, task] };
    });
  };

  const addStep = (taskId: string, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setStore((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId
        ? { ...task, steps: [...task.steps, { id: newId(), text: clean, createdAt: Date.now() }] }
        : task),
    }));
  };

  const addToNotebook = (taskId: string) => {
    setStore((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId
        ? {
            ...task,
            columnId: 'today',
            inNotebook: true,
            notebookOrder: task.inNotebook ? task.notebookOrder : nextNotebookOrder(current.tasks),
            boardOrder: nextBoardOrder(current.tasks, 'today'),
            completedAt: null,
          }
        : task),
    }));
    setPage('notebook');
  };

  const completeTask = (taskId: string) => {
    setStore((current) => ({
      ...current,
      activeTaskId: current.activeTaskId === taskId ? null : current.activeTaskId,
      tasks: current.tasks.map((task) => task.id === taskId
        ? {
            ...task,
            columnId: 'done',
            inNotebook: false,
            boardOrder: nextBoardOrder(current.tasks, 'done'),
            completedAt: Date.now(),
            waitingPerson: '',
            returnAt: null,
          }
        : task),
    }));
  };

  const moveBoardTask = (taskId: string, targetColumn: BoardColumnId, beforeId?: string) => {
    setStore((current) => {
      const moving = current.tasks.find((task) => task.id === taskId);
      if (!moving) return current;
      const targetTasks = current.tasks
        .filter((task) => task.columnId === targetColumn && task.id !== taskId)
        .sort((a, b) => a.boardOrder - b.boardOrder);
      const foundIndex = beforeId ? targetTasks.findIndex((task) => task.id === beforeId) : -1;
      const insertAt = foundIndex >= 0 ? foundIndex : targetTasks.length;
      const moved: Task = {
        ...moving,
        columnId: targetColumn,
        inNotebook: targetColumn === 'today' ? moving.inNotebook : false,
        completedAt: targetColumn === 'done' ? Date.now() : null,
      };
      targetTasks.splice(insertAt, 0, moved);
      const orders = new Map(targetTasks.map((task, index) => [task.id, index]));
      return {
        ...current,
        activeTaskId: targetColumn !== 'today' && current.activeTaskId === taskId ? null : current.activeTaskId,
        tasks: current.tasks.map((task) => {
          if (task.id === taskId) return { ...moved, boardOrder: orders.get(task.id) ?? 0 };
          const order = orders.get(task.id);
          return order === undefined ? task : { ...task, boardOrder: order };
        }),
      };
    });
    setDragBoardId(null);
  };

  const movePoolTask = (taskId: string, targetColumn: BoardColumnId) => moveBoardTask(taskId, targetColumn);

  const reorderNotebook = (taskId: string, beforeId?: string) => {
    setStore((current) => {
      const moving = current.tasks.find((task) => task.id === taskId);
      if (!moving) return current;
      const notebook = current.tasks
        .filter((task) => task.inNotebook && task.columnId === 'today' && task.id !== taskId)
        .sort((a, b) => a.notebookOrder - b.notebookOrder);
      const foundIndex = beforeId ? notebook.findIndex((task) => task.id === beforeId) : -1;
      notebook.splice(foundIndex >= 0 ? foundIndex : notebook.length, 0, moving);
      const orders = new Map(notebook.map((task, index) => [task.id, index]));
      return {
        ...current,
        tasks: current.tasks.map((task) => {
          const order = orders.get(task.id);
          return order === undefined ? task : { ...task, notebookOrder: order };
        }),
      };
    });
    setDragNotebookId(null);
  };

  const snoozeTask = (taskId: string, days: number) => updateTask(taskId, { returnAt: Date.now() + days * DAY });
  const clearWaiting = (taskId: string) => updateTask(taskId, { waitingPerson: '', returnAt: null });

  const requestActivate = (taskId: string) => {
    if (store.activeTaskId === taskId) return;
    const currentActive = store.tasks.find((task) => task.id === store.activeTaskId && task.columnId !== 'done');
    if (currentActive) setCheckpointTarget(taskId);
    else setStore((current) => ({ ...current, activeTaskId: taskId }));
  };

  const saveCheckpointAndSwitch = (text: string) => {
    const fromId = store.activeTaskId;
    const targetId = checkpointTarget;
    setStore((current) => ({
      ...current,
      activeTaskId: targetId,
      tasks: current.tasks.map((task) => task.id === fromId && text.trim()
        ? { ...task, steps: [...task.steps, { id: newId(), text: text.trim(), createdAt: Date.now() }] }
        : task),
    }));
    setCheckpointTarget(null);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `today-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importData = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        setStore(normalizeStore(JSON.parse(String(reader.result || '{}'))));
      } catch {
        window.alert('Не удалось прочитать резервную копию.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">T</span><strong>TODAY</strong></div>
        <nav className="page-switch" aria-label="Разделы">
          <button className={page === 'notebook' ? 'active' : ''} onClick={() => setPage('notebook')}>Рабочая тетрадь <span>{notebookTasks.length}</span></button>
          <button className={page === 'board' ? 'active' : ''} onClick={() => setPage('board')}>Доска</button>
          <button className={page === 'people' ? 'active' : ''} onClick={() => setPage('people')}>Жду людей <span>{waitingTasks.length}</span></button>
        </nav>
        <div className="top-actions">
          <button className="quick-button" onClick={() => setQuickOpen(true)}>＋ Быстро <kbd>N</kbd></button>
          <button className="ghost-button" onClick={exportData}>Экспорт</button>
          <label className="ghost-button import-button">Импорт<input type="file" accept="application/json" onChange={(event) => importData(event.target.files?.[0])} /></label>
        </div>
      </header>

      {page === 'notebook' && (
        <NotebookPage
          tasks={notebookTasks}
          activeTaskId={store.activeTaskId}
          dueTasks={dueTasks}
          waitingCount={waitingTasks.length}
          staleCount={staleTasks.length}
          now={now}
          dragId={dragNotebookId}
          setDragId={setDragNotebookId}
          createTask={(title) => createTask(title, 'today', true)}
          updateTask={updateTask}
          addStep={addStep}
          addToNotebook={addToNotebook}
          completeTask={completeTask}
          reorderNotebook={reorderNotebook}
          requestActivate={requestActivate}
          snoozeTask={snoozeTask}
          clearWaiting={clearWaiting}
        />
      )}

      {page === 'board' && (
        <BoardPage
          store={store}
          dragId={dragBoardId}
          setDragId={setDragBoardId}
          createTask={createTask}
          moveTask={moveBoardTask}
          movePoolTask={movePoolTask}
          addToNotebook={addToNotebook}
          completeTask={completeTask}
          poolOpen={poolOpen}
          setPoolOpen={setPoolOpen}
          deleteTask={(id) => setStore((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== id) }))}
          renameColumn={(columnId, title) => setStore((current) => ({
            ...current,
            columnTitles: { ...current.columnTitles, [columnId]: title.trim() || defaultColumnTitles[columnId] },
          }))}
        />
      )}

      {page === 'people' && (
        <PeoplePage
          tasks={waitingTasks}
          now={now}
          addToNotebook={addToNotebook}
          snoozeTask={snoozeTask}
          clearWaiting={clearWaiting}
        />
      )}

      {quickOpen && (
        <div className="quick-overlay" onMouseDown={(event) => event.target === event.currentTarget && setQuickOpen(false)}>
          <form className="quick-capture" onSubmit={(event) => {
            event.preventDefault();
            if (!quickText.trim()) return;
            createTask(quickText, 'pool');
            setQuickText('');
            setQuickOpen(false);
          }}>
            <span>＋</span>
            <input ref={quickRef} value={quickText} onChange={(event) => setQuickText(event.target.value)} placeholder="Что появилось? Сохраним в Пул и вернёмся к работе." />
            <small>Enter</small>
          </form>
        </div>
      )}

      {checkpointTarget && store.activeTaskId && (
        <CheckpointModal
          current={store.tasks.find((task) => task.id === store.activeTaskId)}
          target={store.tasks.find((task) => task.id === checkpointTarget)}
          close={() => setCheckpointTarget(null)}
          save={saveCheckpointAndSwitch}
        />
      )}
    </div>
  );
}

function NotebookPage({
  tasks, activeTaskId, dueTasks, waitingCount, staleCount, now, dragId, setDragId, createTask,
  updateTask, addStep, addToNotebook, completeTask, reorderNotebook, requestActivate, snoozeTask, clearWaiting,
}: {
  tasks: Task[]; activeTaskId: string | null; dueTasks: Task[]; waitingCount: number; staleCount: number; now: number;
  dragId: string | null; setDragId: (id: string | null) => void; createTask: (title: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void;
  addToNotebook: (id: string) => void; completeTask: (id: string) => void; reorderNotebook: (id: string, beforeId?: string) => void;
  requestActivate: (id: string) => void; snoozeTask: (id: string, days: number) => void; clearWaiting: (id: string) => void;
}) {
  const [newTask, setNewTask] = useState('');
  return (
    <main className="notebook-page">
      <div className="notebook-heading">
        <div><p>РАБОЧАЯ ТЕТРАДЬ</p><h1>Ход работы</h1></div>
        <span>Верхние 7 = передний край внимания</span>
      </div>

      <div className="attention-summary">
        <strong>Сводка внимания</strong>
        <span>{tasks.length} открытых процессов</span>
        <span>{waitingCount} ждут людей</span>
        <span className={dueTasks.length ? 'hot' : ''}>{dueTasks.length} вернулись во внимание</span>
        <span className={staleCount ? 'warm' : ''}>{staleCount} не трогали 2+ дня</span>
      </div>

      {dueTasks.length > 0 && (
        <div className="returned-strip">
          <b>Вернулись во внимание</b>
          <div>{dueTasks.map((task) => (
            <button key={task.id} onClick={() => {
              if (!task.inNotebook || task.columnId !== 'today') addToNotebook(task.id);
              window.setTimeout(() => document.getElementById(`task-${task.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            }}>{task.title}</button>
          ))}</div>
        </div>
      )}

      <form className="new-task-line" onSubmit={(event) => {
        event.preventDefault();
        createTask(newTask);
        setNewTask('');
      }}>
        <span>＋</span>
        <input id="new-notebook-task" value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="Новая задача в рабочую тетрадь..." autoComplete="off" />
        <small>Enter — добавить · Ctrl+Enter — сюда из любого экрана</small>
      </form>

      <section className="notebook-list" onDragOver={(event) => event.preventDefault()} onDrop={() => dragId && reorderNotebook(dragId)}>
        {tasks.map((task, index) => (
          <Fragment key={task.id}>
            {index === 0 && <div className="edge-label">ПЕРЕДНИЙ КРАЙ · 1–7</div>}
            {index === 7 && <div className="edge-divider"><span>ОСТАЛЬНЫЕ ОТКРЫТЫЕ ПРОЦЕССЫ</span></div>}
            <NotebookRow
              number={index + 1}
              task={task}
              now={now}
              active={activeTaskId === task.id}
              front={index < 7}
              onDragStart={() => setDragId(task.id)}
              onDrop={() => dragId && dragId !== task.id && reorderNotebook(dragId, task.id)}
              updateTask={updateTask}
              addStep={addStep}
              completeTask={completeTask}
              requestActivate={requestActivate}
              snoozeTask={snoozeTask}
              clearWaiting={clearWaiting}
            />
          </Fragment>
        ))}
        {tasks.length === 0 && <div className="notebook-empty">Добавь первую задачу. Дальше записывай только то, что произошло.</div>}
      </section>
    </main>
  );
}

function NotebookRow({ number, task, now, active, front, onDragStart, onDrop, updateTask, addStep, completeTask, requestActivate, snoozeTask, clearWaiting }: {
  number: number; task: Task; now: number; active: boolean; front: boolean; onDragStart: () => void; onDrop: () => void;
  updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; completeTask: (id: string) => void;
  requestActivate: (id: string) => void; snoozeTask: (id: string, days: number) => void; clearWaiting: (id: string) => void;
}) {
  const [step, setStep] = useState('');
  const last = task.steps.at(-1);
  const stale = now - lastTouched(task) >= 2 * DAY;
  const due = task.returnAt !== null && task.returnAt <= now;

  return (
    <article id={`task-${task.id}`} className={`notebook-row ${active ? 'active-row' : ''} ${front ? 'front-row' : ''} ${stale ? 'stale-row' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); onDrop(); }}>
      <div className="row-number">{number}</div>
      <div className="row-body">
        <div className="row-task">
          <span className="drag-handle" draggable onDragStart={onDragStart} title="Перетащить">⋮⋮</span>
          <input className="row-title" value={task.title} onChange={(event) => updateTask(task.id, { title: event.target.value })} />
          {active && <span className="active-chip">сейчас</span>}
          {task.waitingPerson && <span className="waiting-chip">жду {task.waitingPerson}</span>}
          {task.returnAt && <span className={`return-chip ${due ? 'due' : ''}`}>{returnLabel(task.returnAt, now)}</span>}
          <span className={`last-age ${stale ? 'stale' : ''}`} title={new Date(lastTouched(task)).toLocaleString('ru-RU')}>{ageLabel(lastTouched(task), now)}</span>
          <button className={`work-button ${active ? 'active' : ''}`} onClick={() => requestActivate(task.id)} title="Переключиться на эту задачу">▶</button>
          <button className="complete-button" onClick={() => completeTask(task.id)} title="Задача достигла результата">✓</button>
        </div>

        <div className="timeline-scroll">
          <div className="timeline-track">
            {task.steps.map((item, index) => (
              <div className={`timeline-step ${index === task.steps.length - 1 ? 'latest' : ''}`} key={item.id} title={new Date(item.createdAt).toLocaleString('ru-RU')}>
                <span>{item.text}</span>{index < task.steps.length - 1 && <b>→</b>}
              </div>
            ))}
            <form className="step-input-wrap" onSubmit={(event) => {
              event.preventDefault();
              addStep(task.id, step);
              setStep('');
            }}>
              <input value={step} onChange={(event) => setStep(event.target.value)} placeholder={task.steps.length ? 'Что произошло дальше?' : 'Запиши первое действие...'} autoComplete="off" />
            </form>
          </div>
        </div>

        <div className="row-tools">
          <details className="wait-menu">
            <summary>Жду / вернуть внимание</summary>
            <div className="wait-popover">
              <label>Жду кого?<input value={task.waitingPerson} onChange={(event) => updateTask(task.id, { waitingPerson: event.target.value })} placeholder="Наташа" /></label>
              <div><button type="button" onClick={() => snoozeTask(task.id, 1)}>завтра</button><button type="button" onClick={() => snoozeTask(task.id, 3)}>3 дня</button><button type="button" onClick={() => snoozeTask(task.id, 7)}>неделя</button><button type="button" onClick={() => clearWaiting(task.id)}>снять</button></div>
            </div>
          </details>
          {last && <span>Последнее: {last.text}</span>}
        </div>
      </div>
    </article>
  );
}

function BoardPage({ store, dragId, setDragId, createTask, moveTask, movePoolTask, addToNotebook, completeTask, deleteTask, renameColumn, poolOpen, setPoolOpen }: {
  store: Store; dragId: string | null; setDragId: (id: string | null) => void;
  createTask: (title: string, columnId: ColumnId) => void; moveTask: (taskId: string, columnId: BoardColumnId, beforeId?: string) => void;
  movePoolTask: (taskId: string, columnId: BoardColumnId) => void; addToNotebook: (taskId: string) => void; completeTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void; renameColumn: (columnId: BoardColumnId, title: string) => void;
  poolOpen: boolean; setPoolOpen: (open: boolean) => void;
}) {
  const poolTasks = store.tasks.filter((task) => task.columnId === 'pool').sort((a, b) => a.boardOrder - b.boardOrder);
  return (
    <main className="board-page">
      <div className="board-heading">
        <div><p>ДОСКА</p><h1>Все обязательства</h1></div>
        <button className="pool-toggle" onClick={() => setPoolOpen(!poolOpen)}>Пул · {poolTasks.length}</button>
      </div>

      {poolOpen && (
        <section className="pool-drawer">
          <div className="pool-head"><div><b>Пул</b><span>Выгрузи сюда всё, что не обязано жить перед глазами.</span></div><button onClick={() => setPoolOpen(false)}>×</button></div>
          <ColumnAdd placeholder="Быстро добавить в Пул..." onAdd={(title) => createTask(title, 'pool')} />
          <div className="pool-list">{poolTasks.map((task) => (
            <div className="pool-row" key={task.id}><span>{task.title}</span><div><button onClick={() => addToNotebook(task.id)}>В тетрадь</button><button onClick={() => movePoolTask(task.id, 'week')}>Неделя</button><button onClick={() => movePoolTask(task.id, 'month')}>Месяц</button><button onClick={() => deleteTask(task.id)}>×</button></div></div>
          ))}</div>
        </section>
      )}

      <div className="board-scroll"><div className="board-grid">
        {boardColumnIds.map((columnId) => {
          const tasks = store.tasks.filter((task) => task.columnId === columnId).sort((a, b) => a.boardOrder - b.boardOrder);
          return (
            <section className={`board-column column-${columnId}`} key={columnId} onDragOver={(event) => event.preventDefault()} onDrop={() => dragId && moveTask(dragId, columnId)}>
              <div className="column-head"><input value={store.columnTitles[columnId]} onChange={(event) => renameColumn(columnId, event.target.value)} /><span>{tasks.length}</span></div>
              <div className="board-cards">
                {tasks.map((task) => (
                  <article className="board-card" key={task.id} draggable onDragStart={() => setDragId(task.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); if (dragId && dragId !== task.id) moveTask(dragId, columnId, task.id); }}>
                    <div className="card-title">{task.title}</div>
                    {task.steps.at(-1) && <div className="card-context">{task.steps.at(-1)?.text}</div>}
                    <div className="card-actions">
                      {columnId !== 'done' && <button onClick={() => addToNotebook(task.id)}>В тетрадь</button>}
                      {columnId !== 'done' && <button onClick={() => completeTask(task.id)}>Готово</button>}
                      <button className="delete-card" onClick={() => deleteTask(task.id)}>×</button>
                    </div>
                  </article>
                ))}
              </div>
              {columnId !== 'done' && <ColumnAdd placeholder="+ Добавить задачу" onAdd={(title) => createTask(title, columnId)} />}
            </section>
          );
        })}
      </div></div>
    </main>
  );
}

function ColumnAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (title: string) => void }) {
  const [value, setValue] = useState('');
  return <form className="column-add" onSubmit={(event) => { event.preventDefault(); if (!value.trim()) return; onAdd(value); setValue(''); }}><input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} /></form>;
}

function PeoplePage({ tasks, now, addToNotebook, snoozeTask, clearWaiting }: {
  tasks: Task[]; now: number; addToNotebook: (id: string) => void; snoozeTask: (id: string, days: number) => void; clearWaiting: (id: string) => void;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => {
      const person = task.waitingPerson.trim() || 'Без имени';
      map.set(person, [...(map.get(person) || []), task]);
    });
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [tasks]);

  return (
    <main className="people-page">
      <div className="board-heading"><div><p>ЖДУ ЛЮДЕЙ</p><h1>Мяч не у меня</h1></div><span>Открой перед звонком человеку</span></div>
      <div className="people-grid">
        {groups.map(([person, personTasks]) => (
          <section className="person-card" key={person}>
            <header><h2>{person}</h2><span>{personTasks.length}</span></header>
            {personTasks.map((task) => {
              const due = task.returnAt !== null && task.returnAt <= now;
              return <div className="person-task" key={task.id}>
                <div><b>{task.title}</b><p>{task.steps.at(-1)?.text || 'Нет записи о последнем действии'}</p><small className={due ? 'due-text' : ''}>{task.returnAt ? returnLabel(task.returnAt, now) : 'без возврата внимания'}</small></div>
                <div className="person-actions"><button onClick={() => addToNotebook(task.id)}>В тетрадь</button><button onClick={() => snoozeTask(task.id, 1)}>завтра</button><button onClick={() => snoozeTask(task.id, 3)}>3 дня</button><button onClick={() => clearWaiting(task.id)}>получил ответ</button></div>
              </div>;
            })}
          </section>
        ))}
        {groups.length === 0 && <div className="notebook-empty">Никого не ждёшь. Редкий и прекрасный момент.</div>}
      </div>
    </main>
  );
}

function CheckpointModal({ current, target, close, save }: { current?: Task; target?: Task; close: () => void; save: (text: string) => void }) {
  const [text, setText] = useState('');
  if (!current || !target) return null;
  return (
    <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <form className="checkpoint-modal" onSubmit={(event) => { event.preventDefault(); save(text); }}>
        <small>ПЕРЕД ПЕРЕКЛЮЧЕНИЕМ</small>
        <h2>Оставь checkpoint</h2>
        <p><b>{current.title}</b> → {target.title}</p>
        <input autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder="Где оставил? Например: отправил Наташе вариант, жду ОС" />
        <div><button type="button" onClick={close}>Не переключаться</button><button className="primary" type="submit">Переключиться →</button></div>
      </form>
    </div>
  );
}

export default App;
