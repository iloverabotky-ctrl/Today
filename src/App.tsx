import { useEffect, useMemo, useState } from 'react';
import type { ColumnId, Store, Task } from './types';
import { defaultColumnTitles, demo, STORAGE_KEY } from './data';

const columnIds: ColumnId[] = ['today', 'week', 'month', 'delegated', 'done'];

type Page = 'notebook' | 'board';

const newId = () => crypto.randomUUID();

const loadStore = (): Store => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return demo;
    const parsed = JSON.parse(raw) as Store;
    return {
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : demo.tasks,
      columnTitles: { ...defaultColumnTitles, ...(parsed.columnTitles || {}) },
    };
  } catch {
    return demo;
  }
};

const nextOrder = (tasks: Task[], columnId: ColumnId) =>
  Math.max(-1, ...tasks.filter((task) => task.columnId === columnId).map((task) => task.boardOrder)) + 1;

const nextNotebookOrder = (tasks: Task[]) =>
  Math.max(-1, ...tasks.filter((task) => task.inNotebook).map((task) => task.notebookOrder)) + 1;

const ageLabel = (timestamp?: number) => {
  if (!timestamp) return 'без записей';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'сейчас';
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'вчера' : `${days} дн`;
};

function App() {
  const [store, setStore] = useState<Store>(loadStore);
  const [page, setPage] = useState<Page>('notebook');
  const [dragBoardId, setDragBoardId] = useState<string | null>(null);
  const [dragNotebookId, setDragNotebookId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.timeline-scroll').forEach((node) => {
      node.scrollLeft = node.scrollWidth;
    });
  }, [store.tasks]);

  const notebookTasks = useMemo(
    () =>
      store.tasks
        .filter((task) => task.inNotebook && task.columnId === 'today')
        .sort((a, b) => a.notebookOrder - b.notebookOrder),
    [store.tasks],
  );

  const updateTask = (id: string, patch: Partial<Task>) => {
    setStore((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)),
    }));
  };

  const createTask = (title: string, columnId: ColumnId, inNotebook = false) => {
    const clean = title.trim();
    if (!clean) return;
    setStore((current) => ({
      ...current,
      tasks: [
        ...current.tasks,
        {
          id: newId(),
          title: clean,
          columnId,
          boardOrder: nextOrder(current.tasks, columnId),
          inNotebook,
          notebookOrder: inNotebook ? nextNotebookOrder(current.tasks) : 0,
          steps: [],
          createdAt: Date.now(),
          completedAt: columnId === 'done' ? Date.now() : null,
        },
      ],
    }));
  };

  const moveBoardTask = (taskId: string, targetColumn: ColumnId, beforeId?: string) => {
    setStore((current) => {
      const moving = current.tasks.find((task) => task.id === taskId);
      if (!moving) return current;

      const targetTasks = current.tasks
        .filter((task) => task.columnId === targetColumn && task.id !== taskId)
        .sort((a, b) => a.boardOrder - b.boardOrder);

      const insertAt = beforeId
        ? Math.max(0, targetTasks.findIndex((task) => task.id === beforeId))
        : targetTasks.length;

      const moved: Task = {
        ...moving,
        columnId: targetColumn,
        inNotebook: targetColumn === 'today' ? moving.inNotebook : false,
        completedAt: targetColumn === 'done' ? Date.now() : null,
      };

      targetTasks.splice(insertAt, 0, moved);
      const targetOrders = new Map(targetTasks.map((task, index) => [task.id, index]));

      return {
        ...current,
        tasks: current.tasks.map((task) => {
          if (task.id === taskId) {
            return { ...moved, boardOrder: targetOrders.get(task.id) ?? 0 };
          }
          const order = targetOrders.get(task.id);
          return order === undefined ? task : { ...task, boardOrder: order };
        }),
      };
    });
    setDragBoardId(null);
  };

  const addToNotebook = (taskId: string) => {
    setStore((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              columnId: 'today',
              inNotebook: true,
              notebookOrder: nextNotebookOrder(current.tasks),
              boardOrder: nextOrder(current.tasks, 'today'),
              completedAt: null,
            }
          : task,
      ),
    }));
    setPage('notebook');
  };

  const addStep = (taskId: string, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setStore((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              steps: [...task.steps, { id: newId(), text: clean, createdAt: Date.now() }],
            }
          : task,
      ),
    }));
  };

  const completeTask = (taskId: string) => {
    setStore((current) => {
      const task = current.tasks.find((item) => item.id === taskId);
      if (!task) return current;
      return {
        ...current,
        tasks: current.tasks.map((item) =>
          item.id === taskId
            ? {
                ...item,
                columnId: 'done',
                inNotebook: false,
                boardOrder: nextOrder(current.tasks, 'done'),
                completedAt: Date.now(),
              }
            : item,
        ),
      };
    });
  };

  const reorderNotebook = (taskId: string, beforeId?: string) => {
    setStore((current) => {
      const notebook = current.tasks
        .filter((task) => task.inNotebook && task.columnId === 'today' && task.id !== taskId)
        .sort((a, b) => a.notebookOrder - b.notebookOrder);
      const moving = current.tasks.find((task) => task.id === taskId);
      if (!moving) return current;
      const insertAt = beforeId
        ? Math.max(0, notebook.findIndex((task) => task.id === beforeId))
        : notebook.length;
      notebook.splice(insertAt, 0, moving);
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

  const deleteTask = (taskId: string) => {
    setStore((current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== taskId) }));
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">T</span>
          <strong>TODAY</strong>
        </div>
        <nav className="page-switch" aria-label="Разделы">
          <button className={page === 'notebook' ? 'active' : ''} onClick={() => setPage('notebook')}>
            Рабочая тетрадь <span>{notebookTasks.length}</span>
          </button>
          <button className={page === 'board' ? 'active' : ''} onClick={() => setPage('board')}>
            Доска
          </button>
        </nav>
        <div className="save-state"><i /> сохранено</div>
      </header>

      {page === 'notebook' ? (
        <NotebookPage
          tasks={notebookTasks}
          dragId={dragNotebookId}
          setDragId={setDragNotebookId}
          createTask={(title) => createTask(title, 'today', true)}
          updateTask={updateTask}
          addStep={addStep}
          completeTask={completeTask}
          reorderNotebook={reorderNotebook}
        />
      ) : (
        <BoardPage
          store={store}
          dragId={dragBoardId}
          setDragId={setDragBoardId}
          createTask={createTask}
          moveTask={moveBoardTask}
          addToNotebook={addToNotebook}
          completeTask={completeTask}
          deleteTask={deleteTask}
          renameColumn={(columnId, title) =>
            setStore((current) => ({
              ...current,
              columnTitles: { ...current.columnTitles, [columnId]: title || defaultColumnTitles[columnId] },
            }))
          }
        />
      )}
    </div>
  );
}

function NotebookPage({
  tasks,
  dragId,
  setDragId,
  createTask,
  updateTask,
  addStep,
  completeTask,
  reorderNotebook,
}: {
  tasks: Task[];
  dragId: string | null;
  setDragId: (id: string | null) => void;
  createTask: (title: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  addStep: (id: string, text: string) => void;
  completeTask: (id: string) => void;
  reorderNotebook: (id: string, beforeId?: string) => void;
}) {
  const [newTask, setNewTask] = useState('');

  return (
    <main className="notebook-page">
      <div className="notebook-heading">
        <div>
          <p>РАБОЧАЯ ТЕТРАДЬ</p>
          <h1>Ход работы</h1>
        </div>
        <span>Последняя запись = текущий контекст</span>
      </div>

      <form
        className="new-task-line"
        onSubmit={(event) => {
          event.preventDefault();
          createTask(newTask);
          setNewTask('');
        }}
      >
        <span>＋</span>
        <input
          value={newTask}
          onChange={(event) => setNewTask(event.target.value)}
          placeholder="Новая задача..."
          autoComplete="off"
        />
        <small>Enter — добавить</small>
      </form>

      <section className="notebook-list" onDragOver={(event) => event.preventDefault()} onDrop={() => dragId && reorderNotebook(dragId)}>
        {tasks.map((task, index) => (
          <NotebookRow
            key={task.id}
            number={index + 1}
            task={task}
            onDragStart={() => setDragId(task.id)}
            onDrop={() => dragId && dragId !== task.id && reorderNotebook(dragId, task.id)}
            updateTask={updateTask}
            addStep={addStep}
            completeTask={completeTask}
          />
        ))}
        {tasks.length === 0 && (
          <div className="notebook-empty">Добавь первую задачу выше. Здесь будет жить ход твоей работы.</div>
        )}
      </section>
    </main>
  );
}

function NotebookRow({
  number,
  task,
  onDragStart,
  onDrop,
  updateTask,
  addStep,
  completeTask,
}: {
  number: number;
  task: Task;
  onDragStart: () => void;
  onDrop: () => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
  addStep: (id: string, text: string) => void;
  completeTask: (id: string) => void;
}) {
  const [step, setStep] = useState('');
  const last = task.steps[task.steps.length - 1];

  return (
    <article className="notebook-row" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); onDrop(); }}>
      <div className="row-number">{number}</div>
      <div className="row-body">
        <div className="row-task">
          <span className="drag-handle" draggable onDragStart={onDragStart} title="Перетащить">⋮⋮</span>
          <input
            className="row-title"
            value={task.title}
            onChange={(event) => updateTask(task.id, { title: event.target.value })}
            aria-label="Название задачи"
          />
          <span className="last-age" title={last ? new Date(last.createdAt).toLocaleString('ru-RU') : undefined}>
            {ageLabel(last?.createdAt)}
          </span>
          <button className="complete-button" onClick={() => completeTask(task.id)} title="Задача достигла результата">
            ✓
          </button>
        </div>

        <div className="timeline-scroll">
          <div className="timeline-track">
            {task.steps.map((item, index) => (
              <div
                className={`timeline-step ${index === task.steps.length - 1 ? 'latest' : ''}`}
                key={item.id}
                title={new Date(item.createdAt).toLocaleString('ru-RU')}
              >
                <span>{item.text}</span>
                {index < task.steps.length - 1 && <b>→</b>}
              </div>
            ))}
            <form
              className="step-input-wrap"
              onSubmit={(event) => {
                event.preventDefault();
                addStep(task.id, step);
                setStep('');
              }}
            >
              <input
                value={step}
                onChange={(event) => setStep(event.target.value)}
                placeholder={task.steps.length ? 'Что произошло дальше?' : 'Запиши первое действие...'}
                autoComplete="off"
              />
            </form>
          </div>
        </div>
      </div>
    </article>
  );
}

function BoardPage({
  store,
  dragId,
  setDragId,
  createTask,
  moveTask,
  addToNotebook,
  completeTask,
  deleteTask,
  renameColumn,
}: {
  store: Store;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  createTask: (title: string, columnId: ColumnId) => void;
  moveTask: (taskId: string, columnId: ColumnId, beforeId?: string) => void;
  addToNotebook: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  renameColumn: (columnId: ColumnId, title: string) => void;
}) {
  return (
    <main className="board-page">
      <div className="board-heading">
        <div>
          <p>ДОСКА</p>
          <h1>Все задачи</h1>
        </div>
        <span>Перетаскивай карточки между горизонтами</span>
      </div>

      <div className="board-scroll">
        <div className="board-grid">
          {columnIds.map((columnId) => {
            const tasks = store.tasks
              .filter((task) => task.columnId === columnId)
              .sort((a, b) => a.boardOrder - b.boardOrder);
            return (
              <BoardColumn
                key={columnId}
                columnId={columnId}
                title={store.columnTitles[columnId]}
                tasks={tasks}
                dragId={dragId}
                onDragStart={setDragId}
                onDrop={(beforeId) => dragId && moveTask(dragId, columnId, beforeId)}
                createTask={createTask}
                addToNotebook={addToNotebook}
                completeTask={completeTask}
                deleteTask={deleteTask}
                renameColumn={renameColumn}
              />
            );
          })}
        </div>
      </div>
    </main>
  );
}

function BoardColumn({
  columnId,
  title,
  tasks,
  dragId,
  onDragStart,
  onDrop,
  createTask,
  addToNotebook,
  completeTask,
  deleteTask,
  renameColumn,
}: {
  columnId: ColumnId;
  title: string;
  tasks: Task[];
  dragId: string | null;
  onDragStart: (id: string | null) => void;
  onDrop: (beforeId?: string) => void;
  createTask: (title: string, columnId: ColumnId) => void;
  addToNotebook: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  renameColumn: (columnId: ColumnId, title: string) => void;
}) {
  const [draft, setDraft] = useState('');

  return (
    <section
      className={`board-column column-${columnId}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => dragId && onDrop()}
    >
      <div className="column-head">
        <input
          value={title}
          onChange={(event) => renameColumn(columnId, event.target.value)}
          onBlur={(event) => renameColumn(columnId, event.target.value.trim())}
          aria-label="Название колонки"
        />
        <span>{tasks.length}</span>
      </div>

      <div className="board-cards">
        {tasks.map((task) => (
          <article
            className="board-card"
            key={task.id}
            draggable
            onDragStart={() => onDragStart(task.id)}
            onDragEnd={() => onDragStart(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.stopPropagation();
              if (dragId && dragId !== task.id) onDrop(task.id);
            }}
          >
            <div className="card-title">{task.title}</div>
            <div className="card-actions">
              {columnId !== 'done' && (
                <button onClick={() => addToNotebook(task.id)} title="Открыть в рабочей тетради">В тетрадь</button>
              )}
              {columnId !== 'done' && <button onClick={() => completeTask(task.id)} title="Готово">✓</button>}
              <button className="delete-card" onClick={() => deleteTask(task.id)} title="Удалить">×</button>
            </div>
          </article>
        ))}
      </div>

      <form
        className="column-add"
        onSubmit={(event) => {
          event.preventDefault();
          createTask(draft, columnId);
          setDraft('');
        }}
      >
        <span>＋</span>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Добавить задачу" />
      </form>
    </section>
  );
}

export default App;
