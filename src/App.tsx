import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardColumnId, ColumnId, Store, Task } from './types';
import { defaultColumnTitles, demo, STORAGE_KEY } from './data';

const BOARD_COLUMNS: BoardColumnId[] = ['today', 'week', 'month', 'delegated', 'done'];
const DAY = 24 * 60 * 60 * 1000;
const STALE_AFTER = 2 * DAY;
const FRONT_EDGE = 7;
const DENSITY_KEY = 'today-density-v1';
type Page = 'notebook' | 'board' | 'people';
type Density = 'comfortable' | 'compact';

const newId = () => crypto.randomUUID();
const isColumnId = (value: unknown): value is ColumnId =>
  ['today', 'week', 'month', 'delegated', 'done', 'pool'].includes(String(value));

const normalizeStore = (value: unknown): Store => {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Store> & { tasks?: unknown[] };
  const tasks: Task[] = Array.isArray(raw.tasks)
    ? raw.tasks.map((item, index) => {
        const task = (item && typeof item === 'object' ? item : {}) as Partial<Task>;
        const steps = Array.isArray(task.steps)
          ? task.steps.map((step, stepIndex) => {
              const source = (step && typeof step === 'object' ? step : {}) as Partial<Task['steps'][number]>;
              return {
                id: typeof source.id === 'string' ? source.id : newId(),
                text: typeof source.text === 'string' ? source.text : `Запись ${stepIndex + 1}`,
                createdAt: typeof source.createdAt === 'number' ? source.createdAt : Date.now(),
              };
            })
          : [];
        return {
          id: typeof task.id === 'string' ? task.id : newId(),
          title: typeof task.title === 'string' ? task.title : `Задача ${index + 1}`,
          columnId: isColumnId(task.columnId) ? task.columnId : 'pool',
          boardOrder: typeof task.boardOrder === 'number' ? task.boardOrder : index,
          inNotebook: Boolean(task.inNotebook),
          notebookOrder: typeof task.notebookOrder === 'number' ? task.notebookOrder : index,
          steps,
          waitingPerson: typeof task.waitingPerson === 'string' ? task.waitingPerson : '',
          returnAt: typeof task.returnAt === 'number' ? task.returnAt : null,
          createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.now(),
          completedAt: typeof task.completedAt === 'number' ? task.completedAt : null,
        };
      })
    : demo.tasks;

  return {
    tasks,
    columnTitles: { ...defaultColumnTitles, ...(raw.columnTitles || {}) },
    activeTaskId:
      typeof raw.activeTaskId === 'string' && tasks.some((task) => task.id === raw.activeTaskId)
        ? raw.activeTaskId
        : null,
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

const loadDensity = (): Density => localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable';
const nextBoardOrder = (tasks: Task[], columnId: ColumnId) =>
  Math.max(-1, ...tasks.filter((task) => task.columnId === columnId).map((task) => task.boardOrder)) + 1;
const nextNotebookOrder = (tasks: Task[]) =>
  Math.max(-1, ...tasks.filter((task) => task.inNotebook).map((task) => task.notebookOrder)) + 1;
const lastTouched = (task: Task) => task.steps.at(-1)?.createdAt ?? task.createdAt;
const lastStep = (task: Task) => task.steps.at(-1)?.text || 'Пока без записей';

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
  if (!timestamp) return 'без возврата';
  if (timestamp <= now) return 'вернуть сейчас';
  const hours = Math.ceil((timestamp - now) / (60 * 60 * 1000));
  if (hours <= 24) return `через ${hours} ч`;
  const days = Math.ceil(hours / 24);
  return days === 1 ? 'завтра' : `через ${days} дн`;
};

function App() {
  const [store, setStore] = useState<Store>(loadStore);
  const [page, setPage] = useState<Page>('notebook');
  const [density, setDensity] = useState<Density>(loadDensity);
  const [now, setNow] = useState(Date.now());
  const [dragBoardId, setDragBoardId] = useState<string | null>(null);
  const [dragNotebookId, setDragNotebookId] = useState<string | null>(null);
  const [poolOpen, setPoolOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [checkpointTarget, setCheckpointTarget] = useState<string | null>(null);
  const [waitingTaskId, setWaitingTaskId] = useState<string | null>(null);
  const quickRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(store)), [store]);
  useEffect(() => localStorage.setItem(DENSITY_KEY, density), [density]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (quickOpen) window.setTimeout(() => quickRef.current?.focus(), 0);
  }, [quickOpen]);
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.timeline-scroll').forEach((node) => {
      node.scrollLeft = node.scrollWidth;
    });
  }, [store.tasks]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (event.key === 'Escape') {
        setQuickOpen(false);
        setPoolOpen(false);
        setWaitingTaskId(null);
        setCheckpointTarget(null);
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
  }, []);

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
    () => notebookTasks.filter((task) => now - lastTouched(task) >= STALE_AFTER),
    [notebookTasks, now],
  );
  const poolTasks = useMemo(
    () => store.tasks.filter((task) => task.columnId === 'pool').sort((a, b) => a.boardOrder - b.boardOrder),
    [store.tasks],
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
        id: newId(), title: clean, columnId: actualColumn,
        boardOrder: nextBoardOrder(current.tasks, actualColumn),
        inNotebook, notebookOrder: inNotebook ? nextNotebookOrder(current.tasks) : 0,
        steps: [], waitingPerson: '', returnAt: null, createdAt: Date.now(),
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

  const completeTask = (taskId: string) => {
    setStore((current) => ({
      ...current,
      activeTaskId: current.activeTaskId === taskId ? null : current.activeTaskId,
      tasks: current.tasks.map((task) => task.id === taskId ? {
        ...task, columnId: 'done', inNotebook: false,
        boardOrder: nextBoardOrder(current.tasks, 'done'), completedAt: Date.now(),
        waitingPerson: '', returnAt: null,
      } : task),
    }));
  };

  const addToNotebook = (taskId: string) => {
    setStore((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId ? {
        ...task, columnId: 'today', inNotebook: true,
        notebookOrder: task.inNotebook ? task.notebookOrder : nextNotebookOrder(current.tasks),
        boardOrder: nextBoardOrder(current.tasks, 'today'), completedAt: null,
      } : task),
    }));
    setPage('notebook');
    setPoolOpen(false);
  };

  const moveBoardTask = (taskId: string, targetColumn: BoardColumnId, beforeId?: string) => {
    setStore((current) => {
      const moving = current.tasks.find((task) => task.id === taskId);
      if (!moving) return current;
      const targetTasks = current.tasks.filter((task) => task.columnId === targetColumn && task.id !== taskId).sort((a, b) => a.boardOrder - b.boardOrder);
      const foundIndex = beforeId ? targetTasks.findIndex((task) => task.id === beforeId) : -1;
      const moved: Task = {
        ...moving,
        columnId: targetColumn,
        inNotebook: targetColumn === 'today' ? moving.inNotebook : false,
        completedAt: targetColumn === 'done' ? Date.now() : null,
        waitingPerson: targetColumn === 'done' ? '' : moving.waitingPerson,
        returnAt: targetColumn === 'done' ? null : moving.returnAt,
      };
      targetTasks.splice(foundIndex >= 0 ? foundIndex : targetTasks.length, 0, moved);
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

  const moveToPool = (taskId: string) => {
    setStore((current) => ({
      ...current,
      activeTaskId: current.activeTaskId === taskId ? null : current.activeTaskId,
      tasks: current.tasks.map((task) => task.id === taskId ? {
        ...task, columnId: 'pool', inNotebook: false,
        boardOrder: nextBoardOrder(current.tasks, 'pool'), completedAt: null,
      } : task),
    }));
  };

  const reorderNotebook = (taskId: string, beforeId?: string) => {
    setStore((current) => {
      const moving = current.tasks.find((task) => task.id === taskId);
      if (!moving) return current;
      const notebook = current.tasks.filter((task) => task.inNotebook && task.columnId === 'today' && task.id !== taskId).sort((a, b) => a.notebookOrder - b.notebookOrder);
      const foundIndex = beforeId ? notebook.findIndex((task) => task.id === beforeId) : -1;
      notebook.splice(foundIndex >= 0 ? foundIndex : notebook.length, 0, moving);
      const orders = new Map(notebook.map((task, index) => [task.id, index]));
      return { ...current, tasks: current.tasks.map((task) => {
        const order = orders.get(task.id);
        return order === undefined ? task : { ...task, notebookOrder: order };
      }) };
    });
    setDragNotebookId(null);
  };

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

  const setWaiting = (taskId: string, person: string, days: number | null) => {
    updateTask(taskId, { waitingPerson: person.trim(), returnAt: days === null ? null : Date.now() + days * DAY });
    setWaitingTaskId(null);
  };
  const clearWaiting = (taskId: string) => updateTask(taskId, { waitingPerson: '', returnAt: null });
  const snooze = (taskId: string, days: number) => updateTask(taskId, { returnAt: Date.now() + days * DAY });
  const deleteTask = (taskId: string) => {
    setStore((current) => ({
      ...current,
      activeTaskId: current.activeTaskId === taskId ? null : current.activeTaskId,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));
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
      try { setStore(normalizeStore(JSON.parse(String(reader.result || '{}')))); }
      catch { window.alert('Не удалось прочитать резервную копию TODAY.'); }
    };
    reader.readAsText(file);
  };

  const activeTask = store.tasks.find((task) => task.id === store.activeTaskId) || null;
  const checkpointTargetTask = store.tasks.find((task) => task.id === checkpointTarget) || null;
  const waitingTask = store.tasks.find((task) => task.id === waitingTaskId) || null;

  return (
    <div className={`app-shell density-${density}`}>
      <header className="topbar">
        <div className="brand"><span className="brand-mark">T</span><strong>TODAY</strong></div>
        <nav className="page-switch" aria-label="Разделы TODAY">
          <button className={page === 'notebook' ? 'active' : ''} onClick={() => setPage('notebook')}>Тетрадь <span>{notebookTasks.length}</span></button>
          <button className={page === 'board' ? 'active' : ''} onClick={() => setPage('board')}>Доска</button>
          <button className={page === 'people' ? 'active' : ''} onClick={() => setPage('people')}>Жду <span>{waitingTasks.length}</span></button>
        </nav>
        <div className="top-actions">
          <button className="quick-button" onClick={() => setQuickOpen(true)} aria-label="Быстро добавить в пул">＋ <span>Быстро</span><kbd>N</kbd></button>
          <details className="more-menu">
            <summary aria-label="Ещё">•••</summary>
            <div className="more-popover">
              <div className="menu-section"><label>Плотность</label><div className="density-switch">
                <button className={density === 'comfortable' ? 'active' : ''} onClick={() => setDensity('comfortable')}>Комфортная</button>
                <button className={density === 'compact' ? 'active' : ''} onClick={() => setDensity('compact')}>Компактная</button>
              </div></div>
              <button className="menu-action" onClick={exportData}>Экспорт данных</button>
              <label className="menu-action import-action">Импорт данных<input type="file" accept="application/json" onChange={(event) => importData(event.target.files?.[0])} /></label>
            </div>
          </details>
        </div>
      </header>

      {page === 'notebook' && <NotebookPage
        tasks={notebookTasks} activeTaskId={store.activeTaskId} now={now} dueTasks={dueTasks}
        staleCount={staleTasks.length} waitingCount={waitingTasks.length} dragId={dragNotebookId}
        setDragId={setDragNotebookId} createTask={(title) => createTask(title, 'today', true)}
        updateTask={updateTask} addStep={addStep} completeTask={completeTask} reorderNotebook={reorderNotebook}
        requestActivate={requestActivate} openWaiting={setWaitingTaskId} clearWaiting={clearWaiting} snooze={snooze}
      />}

      {page === 'board' && <BoardPage
        store={store} now={now} poolTasks={poolTasks} poolOpen={poolOpen} setPoolOpen={setPoolOpen}
        dragId={dragBoardId} setDragId={setDragBoardId} createTask={createTask} moveTask={moveBoardTask}
        moveToPool={moveToPool} addToNotebook={addToNotebook} completeTask={completeTask} deleteTask={deleteTask}
        renameColumn={(columnId, title) => setStore((current) => ({
          ...current,
          columnTitles: { ...current.columnTitles, [columnId]: title.trim() || defaultColumnTitles[columnId] },
        }))}
      />}

      {page === 'people' && <PeoplePage
        tasks={waitingTasks} dueTasks={dueTasks} now={now} addToNotebook={addToNotebook}
        clearWaiting={clearWaiting} snooze={snooze} openWaiting={setWaitingTaskId}
      />}

      {quickOpen && <QuickCapture value={quickText} setValue={setQuickText} inputRef={quickRef}
        close={() => { setQuickOpen(false); setQuickText(''); }}
        submit={() => { if (!quickText.trim()) return; createTask(quickText, 'pool'); setQuickText(''); setQuickOpen(false); }} />}
      {checkpointTargetTask && activeTask && <CheckpointModal from={activeTask} to={checkpointTargetTask} close={() => setCheckpointTarget(null)} save={saveCheckpointAndSwitch} />}
      {waitingTask && <WaitingModal task={waitingTask} close={() => setWaitingTaskId(null)} save={(person, days) => setWaiting(waitingTask.id, person, days)} />}
    </div>
  );
}

function NotebookPage({ tasks, activeTaskId, now, dueTasks, staleCount, waitingCount, dragId, setDragId, createTask, updateTask, addStep, completeTask, reorderNotebook, requestActivate, openWaiting, clearWaiting, snooze }: {
  tasks: Task[]; activeTaskId: string | null; now: number; dueTasks: Task[]; staleCount: number; waitingCount: number;
  dragId: string | null; setDragId: (id: string | null) => void; createTask: (title: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void;
  completeTask: (id: string) => void; reorderNotebook: (id: string, beforeId?: string) => void;
  requestActivate: (id: string) => void; openWaiting: (id: string) => void; clearWaiting: (id: string) => void; snooze: (id: string, days: number) => void;
}) {
  const [newTask, setNewTask] = useState('');
  return (
    <main className="notebook-page">
      <div className="notebook-titlebar"><div><h1>Что сейчас происходит</h1><p>Последняя запись хранит контекст вместо головы</p></div></div>
      <div className="attention-strip">
        <div><strong>{tasks.length}</strong><span>в работе</span></div>
        <div><strong>{waitingCount}</strong><span>жду</span></div>
        <div className={dueTasks.length ? 'attention-hot' : ''}><strong>{dueTasks.length}</strong><span>вернулись</span></div>
        <div className={staleCount ? 'attention-warn' : ''}><strong>{staleCount}</strong><span>2+ дня</span></div>
      </div>
      {dueTasks.length > 0 && <section className="returned-panel">
        <div className="returned-head"><strong>Снова посмотреть</strong><span>{dueTasks.length}</span></div>
        <div className="returned-list">{dueTasks.slice(0, 6).map((task) => <div className="returned-item" key={task.id}>
          <div><strong>{task.title}</strong><small>{task.waitingPerson ? `Жду: ${task.waitingPerson}` : lastStep(task)}</small></div>
          <div className="returned-actions"><button onClick={() => requestActivate(task.id)}>В работу</button><button onClick={() => snooze(task.id, 1)}>завтра</button><button onClick={() => clearWaiting(task.id)}>снять</button></div>
        </div>)}</div>
      </section>}
      <form className="new-task-line" onSubmit={(event) => { event.preventDefault(); if (!newTask.trim()) return; createTask(newTask); setNewTask(''); }}>
        <span>＋</span><input id="new-notebook-task" value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="Новая задача..." autoComplete="off" /><small>Enter</small>
      </form>
      <section className="notebook-list" onDragOver={(event) => event.preventDefault()} onDrop={() => dragId && reorderNotebook(dragId)}>
        {tasks.map((task, index) => <div key={task.id}>
          {index === FRONT_EDGE && <div className="backlog-divider"><span>остальные процессы</span><b>{Math.max(0, tasks.length - FRONT_EDGE)}</b></div>}
          <NotebookRow number={index + 1} task={task} now={now} frontEdge={index < FRONT_EDGE} active={task.id === activeTaskId}
            onDragStart={() => setDragId(task.id)} onDrop={() => dragId && dragId !== task.id && reorderNotebook(dragId, task.id)}
            updateTask={updateTask} addStep={addStep} completeTask={completeTask} requestActivate={requestActivate}
            openWaiting={openWaiting} clearWaiting={clearWaiting} />
        </div>)}
        {tasks.length === 0 && <div className="empty-state">Добавь первую задачу. Дальше TODAY будет хранить ход работы за тебя.</div>}
      </section>
    </main>
  );
}

function NotebookRow({ number, task, now, frontEdge, active, onDragStart, onDrop, updateTask, addStep, completeTask, requestActivate, openWaiting, clearWaiting }: {
  number: number; task: Task; now: number; frontEdge: boolean; active: boolean; onDragStart: () => void; onDrop: () => void;
  updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void;
  completeTask: (id: string) => void; requestActivate: (id: string) => void; openWaiting: (id: string) => void; clearWaiting: (id: string) => void;
}) {
  const [step, setStep] = useState('');
  const [expanded, setExpanded] = useState(false);
  const touched = lastTouched(task);
  const stale = now - touched >= STALE_AFTER;
  const hiddenCount = Math.max(0, task.steps.length - 4);
  const visibleSteps = expanded ? task.steps : task.steps.slice(-4);
  return (
    <article className={`notebook-row ${frontEdge ? 'front-edge' : 'deep-row'} ${active ? 'active-row' : ''} ${stale ? 'stale-row' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); onDrop(); }}>
      <div className="row-number">{String(number).padStart(2, '0')}</div>
      <div className="row-body">
        <div className="row-top">
          <span className="drag-handle" draggable onDragStart={onDragStart} title="Перетащить">⋮⋮</span>
          <button className={`focus-button ${active ? 'is-active' : ''}`} onClick={() => requestActivate(task.id)}>{active ? 'Сейчас' : '▶'}</button>
          <input className="row-title" value={task.title} onChange={(event) => updateTask(task.id, { title: event.target.value })} aria-label="Название задачи" />
          {task.waitingPerson && <button className="waiting-chip" onClick={() => openWaiting(task.id)}>Жду {task.waitingPerson}</button>}
          <span className={`last-age ${stale ? 'stale-age' : ''}`} title={new Date(touched).toLocaleString('ru-RU')}>{ageLabel(touched, now)}</span>
          <button className="icon-action" onClick={() => openWaiting(task.id)} title="Жду / вернуть внимание">⏳</button>
          <button className="complete-button" onClick={() => completeTask(task.id)} title="Готово">✓</button>
        </div>
        <div className={`timeline-scroll ${expanded ? 'is-expanded' : ''}`}>
          <div className="timeline-track">
            {hiddenCount > 0 && !expanded && <button className="history-more" onClick={() => setExpanded(true)}>… {hiddenCount} раньше</button>}
            {visibleSteps.map((item, index) => {
              const latest = item.id === task.steps.at(-1)?.id;
              return <div className={`timeline-step ${latest ? 'latest' : ''}`} key={item.id} title={new Date(item.createdAt).toLocaleString('ru-RU')}><span>{item.text}</span>{index < visibleSteps.length - 1 && <b>→</b>}</div>;
            })}
            {expanded && hiddenCount > 0 && <button className="history-more" onClick={() => setExpanded(false)}>свернуть</button>}
            <form className="step-input-wrap" onSubmit={(event) => { event.preventDefault(); if (!step.trim()) return; addStep(task.id, step); setStep(''); }}>
              <input value={step} onChange={(event) => setStep(event.target.value)} placeholder={task.steps.length ? 'Что произошло дальше?' : 'Первое действие...'} autoComplete="off" />
            </form>
          </div>
        </div>
        <div className="mobile-context"><span>Последнее</span><strong>{lastStep(task)}</strong><button onClick={() => setExpanded(!expanded)}>История · {task.steps.length}</button></div>
        {task.waitingPerson && <div className={`waiting-line ${task.returnAt !== null && task.returnAt <= now ? 'return-due' : ''}`}>
          <span>Жду <strong>{task.waitingPerson}</strong></span><span>{returnLabel(task.returnAt, now)}</span><button onClick={() => openWaiting(task.id)}>изменить</button><button onClick={() => clearWaiting(task.id)}>снять</button>
        </div>}
      </div>
    </article>
  );
}

function BoardPage({ store, now, poolTasks, poolOpen, setPoolOpen, dragId, setDragId, createTask, moveTask, moveToPool, addToNotebook, completeTask, deleteTask, renameColumn }: {
  store: Store; now: number; poolTasks: Task[]; poolOpen: boolean; setPoolOpen: (open: boolean) => void;
  dragId: string | null; setDragId: (id: string | null) => void; createTask: (title: string, columnId: ColumnId, inNotebook?: boolean) => void;
  moveTask: (id: string, columnId: BoardColumnId, beforeId?: string) => void; moveToPool: (id: string) => void;
  addToNotebook: (id: string) => void; completeTask: (id: string) => void; deleteTask: (id: string) => void;
  renameColumn: (id: BoardColumnId, title: string) => void;
}) {
  const [mobileColumn, setMobileColumn] = useState<BoardColumnId>('today');
  return (
    <main className="board-page">
      <div className="page-heading board-heading"><div><h1>Доска</h1><p>Все обязательства на одном горизонте</p></div><button className="pool-button" onClick={() => setPoolOpen(true)}>Пул <b>{poolTasks.length}</b></button></div>
      <div className="mobile-board-tabs">{BOARD_COLUMNS.map((columnId) => {
        const count = store.tasks.filter((task) => task.columnId === columnId).length;
        return <button key={columnId} className={mobileColumn === columnId ? 'active' : ''} onClick={() => setMobileColumn(columnId)}>{store.columnTitles[columnId]} <span>{count}</span></button>;
      })}</div>
      <div className="board-scroll"><div className="board-grid">{BOARD_COLUMNS.map((columnId) => {
        const tasks = store.tasks.filter((task) => task.columnId === columnId).sort((a, b) => a.boardOrder - b.boardOrder);
        return <BoardColumn key={columnId} columnId={columnId} title={store.columnTitles[columnId]} tasks={tasks} now={now}
          mobileVisible={mobileColumn === columnId} dragId={dragId} setDragId={setDragId} rename={(title) => renameColumn(columnId, title)}
          create={(title) => createTask(title, columnId)} moveTask={moveTask} moveToPool={moveToPool} addToNotebook={addToNotebook}
          completeTask={completeTask} deleteTask={deleteTask} />;
      })}</div></div>
      {poolOpen && <PoolDrawer tasks={poolTasks} close={() => setPoolOpen(false)} create={(title) => createTask(title, 'pool')} moveTask={moveTask} addToNotebook={addToNotebook} deleteTask={deleteTask} />}
    </main>
  );
}

function BoardColumn({ columnId, title, tasks, now, mobileVisible, dragId, setDragId, rename, create, moveTask, moveToPool, addToNotebook, completeTask, deleteTask }: {
  columnId: BoardColumnId; title: string; tasks: Task[]; now: number; mobileVisible: boolean; dragId: string | null;
  setDragId: (id: string | null) => void; rename: (title: string) => void; create: (title: string) => void;
  moveTask: (id: string, columnId: BoardColumnId, beforeId?: string) => void; moveToPool: (id: string) => void;
  addToNotebook: (id: string) => void; completeTask: (id: string) => void; deleteTask: (id: string) => void;
}) {
  const [draft, setDraft] = useState(title);
  const [newTask, setNewTask] = useState('');
  useEffect(() => setDraft(title), [title]);
  return (
    <section className={`board-column column-${columnId} ${mobileVisible ? 'mobile-visible' : 'mobile-hidden'}`} onDragOver={(event) => event.preventDefault()} onDrop={() => dragId && moveTask(dragId, columnId)}>
      <div className="column-head"><input value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => rename(draft)} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} aria-label="Название колонки" /><span>{tasks.length}</span></div>
      <div className="board-cards">{tasks.map((task) => <article className={`board-card ${dragId === task.id ? 'is-dragging' : ''}`} key={task.id} draggable onDragStart={() => setDragId(task.id)} onDragEnd={() => setDragId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); if (dragId && dragId !== task.id) moveTask(dragId, columnId, task.id); }}>
        <div className="card-title">{task.title}</div><div className="card-meta"><span>{ageLabel(lastTouched(task), now)}</span>{task.inNotebook && <b>в тетради</b>}{task.waitingPerson && <b className="wait-meta">жду {task.waitingPerson}</b>}</div>
        <div className="card-actions">{columnId !== 'done' && <button onClick={() => addToNotebook(task.id)}>В тетрадь</button>}{columnId !== 'done' && <button onClick={() => completeTask(task.id)}>Готово</button>}{columnId !== 'done' && <button onClick={() => moveToPool(task.id)}>В пул</button>}<button className="delete-card" onClick={() => deleteTask(task.id)}>×</button></div>
      </article>)}</div>
      {columnId !== 'done' && <form className="column-add" onSubmit={(event) => { event.preventDefault(); if (!newTask.trim()) return; create(newTask); setNewTask(''); }}><span>＋</span><input value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="Добавить задачу" /></form>}
    </section>
  );
}

function PoolDrawer({ tasks, close, create, moveTask, addToNotebook, deleteTask }: { tasks: Task[]; close: () => void; create: (title: string) => void; moveTask: (id: string, columnId: BoardColumnId) => void; addToNotebook: (id: string) => void; deleteTask: (id: string) => void; }) {
  const [text, setText] = useState('');
  return <div className="drawer-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><aside className="pool-drawer">
    <div className="drawer-head"><div><p>ВНЕШНЯЯ ПАМЯТЬ</p><h2>Пул <span>{tasks.length}</span></h2></div><button onClick={close}>×</button></div>
    <p className="drawer-copy">Сюда складывается всё, что не должно занимать внимание прямо сейчас.</p>
    <form className="pool-add" onSubmit={(event) => { event.preventDefault(); if (!text.trim()) return; create(text); setText(''); }}><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Быстро выгрузить задачу..." autoFocus /><button>＋</button></form>
    <div className="pool-list">{tasks.map((task) => <article className="pool-card" key={task.id}><strong>{task.title}</strong><div><button onClick={() => addToNotebook(task.id)}>В работу</button><button onClick={() => moveTask(task.id, 'today')}>Сегодня</button><button onClick={() => moveTask(task.id, 'week')}>Неделя</button><button onClick={() => moveTask(task.id, 'month')}>Месяц</button><button className="delete-card" onClick={() => deleteTask(task.id)}>×</button></div></article>)}{tasks.length === 0 && <div className="drawer-empty">Пул пуст. Хороший знак.</div>}</div>
  </aside></div>;
}

function PeoplePage({ tasks, dueTasks, now, addToNotebook, clearWaiting, snooze, openWaiting }: { tasks: Task[]; dueTasks: Task[]; now: number; addToNotebook: (id: string) => void; clearWaiting: (id: string) => void; snooze: (id: string, days: number) => void; openWaiting: (id: string) => void; }) {
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks.forEach((task) => { const key = task.waitingPerson.trim() || 'Без имени'; map.set(key, [...(map.get(key) || []), task]); });
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [tasks]);
  return <main className="people-page"><div className="page-heading"><div><h1>Жду людей</h1><p>Все вопросы, где мяч сейчас не у тебя</p></div><span>{tasks.length} вопросов · {dueTasks.length} пора вернуть</span></div>
    <div className="people-grid">{groups.map(([person, personTasks]) => <section className="person-card" key={person}><div className="person-head"><div className="person-avatar">{person.slice(0, 1).toUpperCase()}</div><div><h2>{person}</h2><span>{personTasks.length} вопросов</span></div></div><div className="person-tasks">{personTasks.map((task) => {
      const due = task.returnAt !== null && task.returnAt <= now;
      return <article className={`person-task ${due ? 'person-due' : ''}`} key={task.id}><div><strong>{task.title}</strong><p>{lastStep(task)}</p><small>{returnLabel(task.returnAt, now)}</small></div><div className="person-actions"><button onClick={() => addToNotebook(task.id)}>В работу</button><button onClick={() => snooze(task.id, 1)}>+1 день</button><button onClick={() => openWaiting(task.id)}>изменить</button><button onClick={() => clearWaiting(task.id)}>снять</button></div></article>;
    })}</div></section>)}{groups.length === 0 && <div className="empty-state people-empty">Сейчас ни от кого ничего не ждёшь.</div>}</div>
  </main>;
}

function QuickCapture({ value, setValue, inputRef, close, submit }: { value: string; setValue: (value: string) => void; inputRef: { current: HTMLInputElement | null }; close: () => void; submit: () => void }) {
  return <div className="quick-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="quick-capture" onSubmit={(event) => { event.preventDefault(); submit(); }}><span>＋</span><input ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Что появилось?" autoComplete="off" /><kbd>Enter → Пул</kbd></form></div>;
}

function CheckpointModal({ from, to, close, save }: { from: Task; to: Task; close: () => void; save: (text: string) => void }) {
  const [text, setText] = useState('');
  return <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="modal-card" onSubmit={(event) => { event.preventDefault(); save(text); }}><p>CHECKPOINT</p><h2>Где оставил «{from.title}»?</h2><span className="switch-copy">После этого переключимся на «{to.title}».</span><input autoFocus value={text} onChange={(event) => setText(event.target.value)} placeholder="Например: отправил вариант №2, теперь жду" /><div className="modal-actions"><button type="button" onClick={close}>Остаться</button><button className="primary" type="submit">Сохранить и переключиться</button></div></form></div>;
}

function WaitingModal({ task, close, save }: { task: Task; close: () => void; save: (person: string, days: number | null) => void }) {
  const [person, setPerson] = useState(task.waitingPerson);
  const [days, setDays] = useState<number | null>(task.returnAt ? 1 : null);
  return <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="modal-card waiting-modal" onSubmit={(event) => { event.preventDefault(); save(person, days); }}><p>ВЫГРУЗИТЬ ОЖИДАНИЕ</p><h2>{task.title}</h2><label>Кого жду?</label><input autoFocus value={person} onChange={(event) => setPerson(event.target.value)} placeholder="Например: Наташа" /><label>Когда вернуть внимание?</label><div className="return-options"><button type="button" className={days === 1 ? 'selected' : ''} onClick={() => setDays(1)}>завтра</button><button type="button" className={days === 3 ? 'selected' : ''} onClick={() => setDays(3)}>3 дня</button><button type="button" className={days === 7 ? 'selected' : ''} onClick={() => setDays(7)}>неделя</button><button type="button" className={days === null ? 'selected' : ''} onClick={() => setDays(null)}>не возвращать</button></div><div className="modal-actions"><button type="button" onClick={close}>Отмена</button><button className="primary" disabled={!person.trim()}>Сохранить</button></div></form></div>;
}

export default App;
