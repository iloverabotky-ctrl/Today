import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardColumnId, CityId, ColumnId, ProjectId, Store, Task, TaskStep } from './types';
import { defaultColumnTitles, demo, STORAGE_KEY } from './data';

const BOARD_COLUMNS: BoardColumnId[] = ['today', 'week', 'month', 'delegated', 'done'];
const DAY = 86_400_000;
const TEAM_KEY = 'today-team-v1';
type Page = 'notebook' | 'board' | 'people';
type ReminderTarget = { taskId: string; stepId?: string } | null;

const newId = () => crypto.randomUUID();
const isColumnId = (value: unknown): value is ColumnId => ['today', 'week', 'month', 'delegated', 'done', 'pool'].includes(String(value));
const isProject = (value: unknown): value is ProjectId => ['none', 'pasta', 'kvep'].includes(String(value));
const isCity = (value: unknown): value is CityId => ['spb', 'krasnodar'].includes(String(value));

const toDateTimeLocal = (timestamp: number | null) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const fromDateTimeLocal = (value: string) => value ? new Date(value).getTime() : null;
const formatDateTime = (timestamp: number | null) => timestamp ? new Date(timestamp).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'без даты';
const formatTaskCreated = (timestamp: number) => {
  const date = new Date(timestamp);
  const today = new Date();
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (date.toDateString() == today.toDateString()) return time;
  const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
  return `${day} · ${time}`;
};
const projectLabel = (project: ProjectId) => project === 'pasta' ? 'Паста' : project === 'kvep' ? 'КВЭП' : '';

const normalizeStore = (value: unknown): Store => {
  const raw = (value && typeof value === 'object' ? value : {}) as Partial<Store> & { tasks?: unknown[] };
  const tasks: Task[] = Array.isArray(raw.tasks) ? raw.tasks.map((item, index) => {
    const task = (item && typeof item === 'object' ? item : {}) as Partial<Task>;
    const delegatedAssignee = task.columnId === 'delegated' && typeof task.assignee === 'string' ? task.assignee : '';
    const delegatedDeadline = task.columnId === 'delegated' && typeof task.deadline === 'number' ? task.deadline : null;
    const steps: TaskStep[] = Array.isArray(task.steps) ? task.steps.map((itemStep, stepIndex) => {
      const step = (itemStep && typeof itemStep === 'object' ? itemStep : {}) as Partial<TaskStep>;
      return {
        id: typeof step.id === 'string' ? step.id : newId(),
        text: typeof step.text === 'string' ? step.text : `Запись ${stepIndex + 1}`,
        createdAt: typeof step.createdAt === 'number' ? step.createdAt : Date.now(),
        waitingPerson: typeof step.waitingPerson === 'string' ? step.waitingPerson : '',
        remindAt: typeof step.remindAt === 'number' ? step.remindAt : null,
      };
    }) : [];
    return {
      id: typeof task.id === 'string' ? task.id : newId(),
      title: typeof task.title === 'string' ? task.title : `Задача ${index + 1}`,
      columnId: isColumnId(task.columnId) ? task.columnId : 'pool',
      boardOrder: typeof task.boardOrder === 'number' ? task.boardOrder : index,
      inNotebook: Boolean(task.inNotebook),
      notebookOrder: typeof task.notebookOrder === 'number' ? task.notebookOrder : index,
      notebookAt: typeof task.notebookAt === 'number' ? task.notebookAt : (task.inNotebook ? Date.now() : null),
      notebookCompleted: Boolean(task.notebookCompleted),
      steps,
      waitingPerson: typeof task.waitingPerson === 'string' && task.waitingPerson.trim() ? task.waitingPerson : delegatedAssignee,
      returnAt: typeof task.returnAt === 'number' ? task.returnAt : delegatedDeadline,
      assignee: typeof task.assignee === 'string' ? task.assignee : '',
      deadline: typeof task.deadline === 'number' ? task.deadline : null,
      project: isProject(task.project) ? task.project : 'none',
      city: isCity(task.city) ? task.city : 'spb',
      createdAt: typeof task.createdAt === 'number' ? task.createdAt : Date.now(),
      completedAt: typeof task.completedAt === 'number' ? task.completedAt : null,
    };
  }) : demo.tasks;
  return {
    tasks,
    columnTitles: { ...defaultColumnTitles, ...(raw.columnTitles || {}) },
    activeTaskId: typeof raw.activeTaskId === 'string' && tasks.some((task) => task.id === raw.activeTaskId) ? raw.activeTaskId : null,
  };
};

const loadStore = () => {
  try { const raw = localStorage.getItem(STORAGE_KEY); return raw ? normalizeStore(JSON.parse(raw)) : demo; }
  catch { return demo; }
};

const loadTeamNames = () => {
  const defaults = ['Наташа', 'Анита', 'Женя', 'Ксюша', 'Ольга'];
  try {
    const raw = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]') as Array<{ name?: string }>;
    return [...new Set([...defaults, ...raw.map((item) => item.name || '').filter(Boolean)])];
  } catch { return defaults; }
};

const saveTeamName = (name: string) => {
  const clean = name.trim(); if (!clean) return;
  try {
    const raw = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]') as Array<{ id: string; name: string; role: string }>;
    if (!raw.some((item) => item.name.toLocaleLowerCase('ru-RU') === clean.toLocaleLowerCase('ru-RU'))) {
      raw.push({ id: newId(), name: clean, role: '' });
      localStorage.setItem(TEAM_KEY, JSON.stringify(raw));
    }
  } catch {
    localStorage.setItem(TEAM_KEY, JSON.stringify([{ id: newId(), name: clean, role: '' }]));
  }
};

const nextBoardOrder = (tasks: Task[], columnId: ColumnId, city?: CityId) => Math.max(-1, ...tasks.filter((task) => task.columnId === columnId && (!city || task.city === city)).map((task) => task.boardOrder)) + 1;
const nextNotebookOrder = (tasks: Task[]) => Math.max(-1, ...tasks.filter((task) => task.inNotebook).map((task) => task.notebookOrder)) + 1;
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
const taskIsWaiting = (task: Task) => Boolean(
  task.waitingPerson.trim()
  || (task.columnId === 'delegated' && task.assignee.trim())
  || task.steps.some((step) => step.waitingPerson.trim()),
);

function App() {
  const [store, setStore] = useState<Store>(loadStore);
  const [page, setPage] = useState<Page>('notebook');
  const [boardCity, setBoardCity] = useState<CityId>('spb');
  const [now, setNow] = useState(Date.now());
  const [dragBoardId, setDragBoardId] = useState<string | null>(null);
  const [dragNotebookId, setDragNotebookId] = useState<string | null>(null);
  const [reminderTarget, setReminderTarget] = useState<ReminderTarget>(null);
  const [delegateTaskId, setDelegateTaskId] = useState<string | null>(null);
  const [scheduleTaskId, setScheduleTaskId] = useState<string | null>(null);
  const [taskFocusId, setTaskFocusId] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [teamVersion, setTeamVersion] = useState(0);
  const quickRef = useRef<HTMLInputElement | null>(null);
  const notified = useRef(new Set<string>());

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(store)), [store]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (quickOpen) window.setTimeout(() => quickRef.current?.focus(), 0); }, [quickOpen]);

  const dueItems = useMemo(() => {
    const result: Array<{ id: string; task: Task; step?: TaskStep; person: string; at: number }> = [];
    store.tasks.filter((task) => task.columnId !== 'done').forEach((task) => {
      if (task.returnAt !== null && task.returnAt <= now) result.push({ id: `task:${task.id}`, task, person: task.waitingPerson, at: task.returnAt });
      task.steps.forEach((step) => { if (step.remindAt !== null && step.remindAt <= now) result.push({ id: `step:${task.id}:${step.id}`, task, step, person: step.waitingPerson, at: step.remindAt }); });
    });
    return result.sort((a, b) => a.at - b.at);
  }, [store.tasks, now]);

  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    dueItems.forEach((item) => {
      if (notified.current.has(item.id)) return;
      notified.current.add(item.id);
      new Notification('TODAY · пора вернуть внимание', { body: item.step ? `${item.task.title}: ${item.step.text}` : item.task.title });
    });
  }, [dueItems]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (event.key === 'Escape') { setQuickOpen(false); setReminderTarget(null); setDelegateTaskId(null); setScheduleTaskId(null); setTaskFocusId(null); }
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault(); setPage('notebook');
        window.setTimeout(() => {
          const input = document.querySelector<HTMLInputElement>('#new-notebook-task');
          if (input) input.focus();
          else document.querySelector<HTMLButtonElement>('#new-notebook-add')?.click();
        }, 0);
        return;
      }
      if (typing) return;
      if (event.key.toLowerCase() === 'n') { event.preventDefault(); setQuickOpen(true); }
      if (event.altKey && event.key === '1') setPage('notebook');
      if (event.altKey && event.key === '2') setPage('board');
      if (event.altKey && event.key === '3') setPage('people');
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);

  const teamNames = useMemo(() => loadTeamNames(), [teamVersion]);
  const notebookReady = useMemo(() => store.tasks.filter((task) => task.inNotebook && task.columnId !== 'done' && (task.notebookAt === null || task.notebookAt <= now)).sort((a, b) => {
    if (a.notebookCompleted !== b.notebookCompleted) return a.notebookCompleted ? 1 : -1;
    if (!a.notebookCompleted && !b.notebookCompleted) {
      if (a.id === store.activeTaskId && b.id !== store.activeTaskId) return -1;
      if (b.id === store.activeTaskId && a.id !== store.activeTaskId) return 1;
    }
    return a.notebookOrder - b.notebookOrder;
  }), [store.tasks, store.activeTaskId, now]);
  const notebookUpcoming = useMemo(() => store.tasks.filter((task) => task.inNotebook && task.columnId !== 'done' && task.notebookAt !== null && task.notebookAt > now).sort((a, b) => (a.notebookAt || 0) - (b.notebookAt || 0)), [store.tasks, now]);
  const waitingTasks = useMemo(() => store.tasks.filter((task) => task.columnId !== 'done' && taskIsWaiting(task)), [store.tasks]);

  const updateTask = (id: string, patch: Partial<Task>) => setStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, ...patch } : task) }));
  const createTask = (title: string, columnId: ColumnId, city: CityId, project: ProjectId = 'none', inNotebook = false) => {
    const clean = title.trim(); if (!clean) return null;
    const id = newId();
    setStore((current) => ({ ...current, tasks: [...current.tasks, {
      id, title: clean, columnId: inNotebook ? 'today' : columnId, boardOrder: nextBoardOrder(current.tasks, columnId, city),
      inNotebook, notebookOrder: inNotebook ? Math.min(0, ...current.tasks.filter((task) => task.inNotebook && !task.notebookCompleted).map((task) => task.notebookOrder)) - 1 : 0, notebookAt: inNotebook ? now : null, notebookCompleted: false,
      steps: [], waitingPerson: '', returnAt: null, assignee: '', deadline: null, project, city, createdAt: Date.now(), completedAt: null,
    }] }));
    return id;
  };
  const addStep = (taskId: string, text: string) => {
    const clean = text.trim(); if (!clean) return;
    setStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, steps: [...task.steps, { id: newId(), text: clean, createdAt: Date.now(), waitingPerson: '', remindAt: null }] } : task) }));
  };
  const updateStep = (taskId: string, stepId: string, patch: Partial<TaskStep>) => setStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, steps: task.steps.map((step) => step.id === stepId ? { ...step, ...patch } : step) } : task) }));
  const deleteStep = (taskId: string, stepId: string) => setStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, steps: task.steps.filter((step) => step.id !== stepId) } : task) }));
  const saveReminder = (target: ReminderTarget, person: string, at: number | null) => {
    if (!target) return;
    if (target.stepId) updateStep(target.taskId, target.stepId, { waitingPerson: person.trim(), remindAt: at });
    else updateTask(target.taskId, { waitingPerson: person.trim(), returnAt: at });
    setReminderTarget(null);
  };
  const clearReminder = (target: ReminderTarget) => {
    if (!target) return;
    if (target.stepId) updateStep(target.taskId, target.stepId, { waitingPerson: '', remindAt: null });
    else updateTask(target.taskId, { waitingPerson: '', returnAt: null });
    setReminderTarget(null);
  };
  const moveToNotebook = (taskId: string, at: number) => setStore((current) => ({ ...current, activeTaskId: current.activeTaskId, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, inNotebook: true, notebookAt: at, notebookCompleted: false, notebookOrder: task.inNotebook ? task.notebookOrder : nextNotebookOrder(current.tasks), columnId: 'today', completedAt: null } : task) }));
  const moveNotebookToBoard = (taskId: string, columnId: BoardColumnId) => {
    setStore((current) => ({ ...current, activeTaskId: current.activeTaskId === taskId ? null : current.activeTaskId, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, inNotebook: false, notebookAt: null, notebookCompleted: false, columnId, boardOrder: nextBoardOrder(current.tasks, columnId, task.city), completedAt: columnId === 'done' ? Date.now() : null } : task) }));
    if (columnId === 'delegated') window.setTimeout(() => setDelegateTaskId(taskId), 0);
  };
  const toggleNotebookCompleted = (taskId: string) => updateTask(taskId, { notebookCompleted: !store.tasks.find((task) => task.id === taskId)?.notebookCompleted });
  const finishTask = (taskId: string) => setStore((current) => ({ ...current, activeTaskId: current.activeTaskId === taskId ? null : current.activeTaskId, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, columnId: 'done', inNotebook: false, notebookAt: null, notebookCompleted: false, completedAt: Date.now(), waitingPerson: '', returnAt: null } : task) }));
  const moveBoardTask = (taskId: string, targetColumn: BoardColumnId, beforeId?: string) => {
    let shouldChooseDelegate = false;
    setStore((current) => {
      const moving = current.tasks.find((task) => task.id === taskId); if (!moving) return current;
      shouldChooseDelegate = targetColumn === 'delegated' && moving.columnId !== 'delegated';
      const siblings = current.tasks.filter((task) => !task.inNotebook && task.city === moving.city && task.columnId === targetColumn && task.id !== taskId).sort((a, b) => a.boardOrder - b.boardOrder);
      const index = beforeId ? siblings.findIndex((task) => task.id === beforeId) : -1;
      const moved = { ...moving, columnId: targetColumn, completedAt: targetColumn === 'done' ? Date.now() : null };
      siblings.splice(index >= 0 ? index : siblings.length, 0, moved);
      const order = new Map(siblings.map((task, i) => [task.id, i]));
      return { ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...moved, boardOrder: order.get(task.id) ?? 0 } : order.has(task.id) ? { ...task, boardOrder: order.get(task.id)! } : task) };
    });
    if (shouldChooseDelegate) window.setTimeout(() => setDelegateTaskId(taskId), 0);
  };
  const reorderNotebook = (taskId: string, beforeId?: string) => setStore((current) => {
    const moving = current.tasks.find((task) => task.id === taskId); if (!moving) return current;
    const rows = current.tasks.filter((task) => task.inNotebook && task.columnId !== 'done' && task.id !== taskId).sort((a, b) => a.notebookOrder - b.notebookOrder);
    const index = beforeId ? rows.findIndex((task) => task.id === beforeId) : -1;
    rows.splice(index >= 0 ? index : rows.length, 0, moving);
    const order = new Map(rows.map((task, i) => [task.id, i]));
    return { ...current, tasks: current.tasks.map((task) => order.has(task.id) ? { ...task, notebookOrder: order.get(task.id)! } : task) };
  });
  const saveDelegation = (taskId: string, assignee: string, deadline: number | null, newPerson?: string) => {
    const person = (newPerson || assignee).trim();
    if (newPerson?.trim()) { saveTeamName(newPerson); setTeamVersion((value) => value + 1); }
    setStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? {
      ...task,
      columnId: 'delegated',
      inNotebook: false,
      notebookAt: null,
      assignee: person,
      deadline,
      waitingPerson: person,
      returnAt: deadline,
      boardOrder: nextBoardOrder(current.tasks, 'delegated', task.city),
    } : task) }));
    setDelegateTaskId(null);
  };
  const requestActivate = (taskId: string) => setStore((current) => ({ ...current, activeTaskId: taskId }));
  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') { window.alert('Этот браузер не поддерживает веб-уведомления.'); return; }
    const permission = await Notification.requestPermission();
    window.alert(permission === 'granted' ? 'Уведомления включены.' : 'Браузер не дал разрешение на уведомления.');
  };

  const openTaskFocus = (taskId: string) => { setStore((current) => ({ ...current, activeTaskId: taskId })); setTaskFocusId(taskId); };
  const focusTask = taskFocusId ? store.tasks.find((task) => task.id === taskFocusId) || null : null;
  const reminderTask = reminderTarget ? store.tasks.find((task) => task.id === reminderTarget.taskId) || null : null;
  const reminderStep = reminderTask && reminderTarget?.stepId ? reminderTask.steps.find((step) => step.id === reminderTarget.stepId) || null : null;
  const delegateTask = delegateTaskId ? store.tasks.find((task) => task.id === delegateTaskId) || null : null;
  const scheduleTask = scheduleTaskId ? store.tasks.find((task) => task.id === scheduleTaskId) || null : null;

  return <div className="app-shell v6-shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">T</span><strong>TODAY</strong></div>
      <nav className="page-switch" aria-label="Разделы TODAY">
        <button className={page === 'notebook' ? 'active' : ''} onClick={() => setPage('notebook')}>Тетрадь <span>{notebookReady.length}</span></button>
        <button className={page === 'board' ? 'active' : ''} onClick={() => setPage('board')}>Доска</button>
        <button className={page === 'people' ? 'active' : ''} onClick={() => setPage('people')}>Жду <span>{waitingTasks.length}</span></button>
      </nav>
      <div className="top-actions"><button className="quick-button" onClick={() => setQuickOpen(true)}>＋ <span>Быстро</span><kbd>N</kbd></button><details className="more-menu"><summary>•••</summary><div className="more-popover"><button className="menu-action" onClick={enableNotifications}>Включить уведомления</button></div></details></div>
    </header>

    {page === 'notebook' && <NotebookPage tasks={notebookReady} upcoming={notebookUpcoming} activeTaskId={store.activeTaskId} dueItems={dueItems} now={now} dragId={dragNotebookId} setDragId={setDragNotebookId} createTask={(title, project) => createTask(title, 'today', boardCity, project, true)} updateTask={updateTask} addStep={addStep} updateStep={updateStep} deleteStep={deleteStep} openTask={openTaskFocus} requestActivate={requestActivate} reorderNotebook={reorderNotebook} openReminder={setReminderTarget} moveToBoard={moveNotebookToBoard} toggleCompleted={toggleNotebookCompleted} finishTask={finishTask} showNow={(id) => moveToNotebook(id, Date.now())} />}
    {page === 'board' && <BoardPage store={store} city={boardCity} setCity={setBoardCity} now={now} dragId={dragBoardId} setDragId={setDragBoardId} createTask={createTask} moveTask={moveBoardTask} openSchedule={setScheduleTaskId} openReminder={(id) => setReminderTarget({ taskId: id })} openDelegate={setDelegateTaskId} finishTask={finishTask} />}
    {page === 'people' && <PeoplePage tasks={store.tasks} now={now} openReminder={setReminderTarget} />}
    {focusTask && <TaskFocusView task={focusTask} now={now} close={() => setTaskFocusId(null)} updateTask={updateTask} addStep={addStep} updateStep={updateStep} deleteStep={deleteStep} openReminder={setReminderTarget} toggleCompleted={toggleNotebookCompleted} finishTask={finishTask} />}

    {quickOpen && <QuickCapture value={quickText} setValue={setQuickText} inputRef={quickRef} close={() => { setQuickOpen(false); setQuickText(''); }} submit={() => { if (!quickText.trim()) return; createTask(quickText, 'pool', boardCity); setQuickText(''); setQuickOpen(false); }} />}
    {reminderTask && <ReminderModal task={reminderTask} step={reminderStep} teamNames={teamNames} close={() => setReminderTarget(null)} save={(person, at) => saveReminder(reminderTarget, person, at)} clear={() => clearReminder(reminderTarget)} />}
    {delegateTask && <DelegateModal task={delegateTask} teamNames={teamNames} close={() => setDelegateTaskId(null)} save={(assignee, deadline, newPerson) => saveDelegation(delegateTask.id, assignee, deadline, newPerson)} />}
    {scheduleTask && <NotebookScheduleModal task={scheduleTask} close={() => setScheduleTaskId(null)} save={(at) => { moveToNotebook(scheduleTask.id, at); setScheduleTaskId(null); }} />}
  </div>;
}

function ProjectPicker({ value, setValue }: { value: ProjectId; setValue: (value: ProjectId) => void }) {
  return <div className="project-picker"><button type="button" className={value === 'none' ? 'active' : ''} onClick={() => setValue('none')}>Без проекта</button><button type="button" className={`pasta ${value === 'pasta' ? 'active' : ''}`} onClick={() => setValue('pasta')}>Паста</button><button type="button" className={`kvep ${value === 'kvep' ? 'active' : ''}`} onClick={() => setValue('kvep')}>КВЭП</button></div>;
}

function NotebookPage({ tasks, upcoming, activeTaskId, dueItems, now, dragId, setDragId, createTask, updateTask, addStep, updateStep, deleteStep, openTask, requestActivate, reorderNotebook, openReminder, moveToBoard, toggleCompleted, finishTask, showNow }: {
  tasks: Task[]; upcoming: Task[]; activeTaskId: string | null; dueItems: Array<{ id: string; task: Task; step?: TaskStep; person: string; at: number }>; now: number; dragId: string | null;
  setDragId: (id: string | null) => void; createTask: (title: string, project: ProjectId) => unknown; updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; openTask: (id: string) => void; requestActivate: (id: string) => void; reorderNotebook: (id: string, beforeId?: string) => void; openReminder: (target: ReminderTarget) => void; moveToBoard: (id: string, column: BoardColumnId) => void; toggleCompleted: (id: string) => void; finishTask: (id: string) => void; showNow: (id: string) => void;
}) {
  const [newTask, setNewTask] = useState('');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [project, setProject] = useState<ProjectId>('none');
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const workingTasks = tasks.filter((task) => !task.notebookCompleted);
  const completedTasks = tasks.filter((task) => task.notebookCompleted);
  const selectedTask = selectedId ? tasks.find((task) => task.id === selectedId) || null : null;

  useEffect(() => {
    if (selectedId && !tasks.some((task) => task.id === selectedId)) setSelectedId(null);
  }, [tasks, selectedId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (typing) return;
      if (!selectedTask) return;
      const currentIndex = workingTasks.findIndex((task) => task.id === selectedId);
      if (event.key === 'ArrowDown' && workingTasks.length) {
        event.preventDefault();
        const next = workingTasks[Math.min(workingTasks.length - 1, currentIndex < 0 ? 0 : currentIndex + 1)];
        setSelectedId(next.id);
      }
      if (event.key === 'ArrowUp' && workingTasks.length) {
        event.preventDefault();
        const next = workingTasks[Math.max(0, currentIndex < 0 ? 0 : currentIndex - 1)];
        setSelectedId(next.id);
      }
      if (event.key.toLowerCase() === 'f' && selectedTask && !selectedTask.notebookCompleted) {
        event.preventDefault(); requestActivate(selectedTask.id);
      }
      if (event.key.toLowerCase() === 'j' && selectedTask) {
        event.preventDefault(); openReminder({ taskId: selectedTask.id, stepId: selectedTask.steps.at(-1)?.id });
      }
      if (event.key === 'Enter' && selectedTask && !selectedTask.notebookCompleted) {
        event.preventDefault();
        const button = document.querySelector<HTMLButtonElement>(`.nb5-row[data-task-id="${selectedTask.id}"] .nb5-current-action`);
        if (button) button.click();
        else document.querySelector<HTMLInputElement>('#nb5-panel-next')?.focus();
      }
      if (event.key === 'Escape' && selectedTask) setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [workingTasks, selectedId, selectedTask, requestActivate, openReminder]);

  const selectAndNext = (taskId: string) => {
    setSelectedId(taskId);
    window.setTimeout(() => document.querySelector<HTMLInputElement>('#nb5-panel-next')?.focus(), 60);
  };

  const renderRow = (task: Task, index: number, completed = false) => <NotebookV5Row
    key={task.id}
    number={index + 1}
    task={task}
    now={now}
    selected={task.id === selectedId}
    active={!completed && task.id === activeTaskId}
    waiting={taskIsWaiting(task)}
    onSelect={() => setSelectedId(task.id)}
    onDragStart={() => setDragId(task.id)}
    onDragEnd={() => setDragId(null)}
    onDrop={() => { if (dragId && dragId !== task.id) reorderNotebook(dragId, task.id); setDragId(null); }}
    updateStep={updateStep}
    deleteStep={deleteStep}
    openReminder={openReminder}
    quickNext={() => selectAndNext(task.id)}
    toggleCompleted={toggleCompleted}
  />;

  return <main className="notebook-page nb5-page">
    <div className="nb5-heading">
      <div><h1>Тетрадь</h1><p>Меньше шума. Больше движения.</p></div>
      {dueItems.length > 0 && <details className="nb5-returned">
        <summary><span>Пора вернуть внимание</span><b>{dueItems.length}</b></summary>
        <div className="nb5-returned-popover">{dueItems.slice(0, 8).map((item) => <button type="button" key={item.id} onClick={() => { setSelectedId(item.task.id); openReminder({ taskId: item.task.id, stepId: item.step?.id }); }}><strong>{item.task.title}</strong><small>{item.step?.text || (item.person ? `Жду: ${item.person}` : 'Напоминание')}</small></button>)}</div>
      </details>}
    </div>

    <div className={`nb5-workspace ${selectedTask ? 'has-inspector' : ''}`}>
      <section className="nb5-list-pane">
        <div className="nb5-add-zone">
          {newTaskOpen ? <form className="nb5-new-task" onSubmit={(event) => { event.preventDefault(); if (!newTask.trim()) return; createTask(newTask, project); setNewTask(''); setNewTaskOpen(false); }}>
            <input id="new-notebook-task" autoFocus value={newTask} onChange={(event) => setNewTask(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setNewTask(''); setNewTaskOpen(false); } }} placeholder="Новая задача..." />
            <ProjectPicker value={project} setValue={setProject} />
            <button type="submit">Enter</button><button type="button" className="nb5-new-close" onClick={() => { setNewTask(''); setNewTaskOpen(false); }}>×</button>
          </form> : <button id="new-notebook-add" type="button" className="nb5-add-button" onClick={() => setNewTaskOpen(true)}><span>＋</span><small>Новая задача</small></button>}
        </div>

        <div className="nb5-list-head" aria-hidden="true"><span>№</span><span>Задача</span><span>Создано</span><span>Сейчас</span><span>Состояние</span><span /></div>
        <section className="nb5-list" onDragOver={(event) => event.preventDefault()} onDrop={() => { if (dragId) reorderNotebook(dragId); setDragId(null); }}>
          {workingTasks.map((task, index) => renderRow(task, index))}
        </section>

        {completedTasks.length > 0 && <section className="nb5-completed">
          <button className="nb5-completed-summary" type="button" onClick={() => setShowCompleted((value) => !value)}>✓ Выполнено сегодня · {completedTasks.length}<span>{showCompleted ? '↑' : '↓'}</span></button>
          {showCompleted && <div className="nb5-completed-list">{completedTasks.map((task, index) => renderRow(task, workingTasks.length + index, true))}</div>}
        </section>}

        {upcoming.length > 0 && <section className="nb5-upcoming"><div className="nb5-upcoming-title">Запланировано · {upcoming.length}</div>{upcoming.map((task) => <button type="button" key={task.id} onClick={() => showNow(task.id)}><strong>{task.title}</strong><span>{formatDateTime(task.notebookAt)}</span><small>показать сейчас</small></button>)}</section>}
      </section>

      {selectedTask && <NotebookV5Inspector
        task={selectedTask}
        now={now}
        active={selectedTask.id === activeTaskId}
        close={() => setSelectedId(null)}
        openTask={openTask}
        requestActivate={requestActivate}
        updateTask={updateTask}
        addStep={addStep}
        updateStep={updateStep}
        deleteStep={deleteStep}
        openReminder={openReminder}
        moveToBoard={moveToBoard}
        toggleCompleted={toggleCompleted}
        finishTask={finishTask}
      />}
    </div>
  </main>;
}

function NotebookV5Row({ number, task, now, selected, active, waiting, onSelect, onDragStart, onDragEnd, onDrop, updateStep, deleteStep, openReminder, quickNext, toggleCompleted }: {
  number: number; task: Task; now: number; selected: boolean; active: boolean; waiting: boolean; onSelect: () => void; onDragStart: () => void; onDragEnd: () => void; onDrop: () => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; openReminder: (target: ReminderTarget) => void; quickNext: () => void; toggleCompleted: (id: string) => void;
}) {
  const current = task.steps.at(-1) || null;
  const historyCount = Math.max(0, task.steps.length - 1);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(current?.text || '');
  useEffect(() => { if (!editing) setEditText(current?.text || ''); }, [current?.id, current?.text, editing]);
  const waitingStep = [...task.steps].reverse().find((item) => item.waitingPerson.trim());
  const waitingPerson = task.waitingPerson.trim() || (task.columnId === 'delegated' ? task.assignee.trim() : '') || waitingStep?.waitingPerson.trim() || '';
  const staleDays = Math.floor(Math.max(0, now - lastTouched(task)) / DAY);
  const saveCurrent = () => { const clean = editText.trim(); if (current && clean) updateStep(task.id, current.id, { text: clean }); setEditing(false); };

  return <article data-task-id={task.id} className={`nb5-row ${selected ? 'selected' : ''} ${active ? 'active' : ''} ${waiting ? 'waiting' : ''} ${task.notebookCompleted ? 'completed' : ''}`} onClick={onSelect} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); onDrop(); }}>
    <div className="nb5-number">{number}</div>
    <div className="nb5-title-cell">
      <button type="button" className="nb5-quick-complete" onClick={(event) => { event.stopPropagation(); toggleCompleted(task.id); }} title={task.notebookCompleted ? 'Вернуть в работу' : 'Быстро выполнить'} aria-label={task.notebookCompleted ? 'Вернуть задачу в работу' : 'Быстро выполнить задачу'}><span>✓</span></button>
      <span className={`nb5-project-dot ${task.project}`} title={projectLabel(task.project) || 'Без проекта'} />
      <button type="button" className="nb5-title" title={task.title}>{task.title}</button>
      <span className="nb5-drag" draggable onDragStart={(event) => { event.stopPropagation(); onDragStart(); }} onDragEnd={onDragEnd} title="Перетащить">⋮⋮</span>
    </div>
    <time className="nb5-created" title={new Date(task.createdAt).toLocaleString('ru-RU')}>{formatTaskCreated(task.createdAt)}</time>
    <div className="nb5-current-cell">
      {editing && current ? <form onSubmit={(event) => { event.preventDefault(); saveCurrent(); }} onClick={(event) => event.stopPropagation()}><input autoFocus value={editText} onChange={(event) => setEditText(event.target.value)} onBlur={saveCurrent} onKeyDown={(event) => { if (event.key === 'Escape') { setEditText(current.text); setEditing(false); } }} /></form> : current ? <button type="button" className="nb5-current-action" title={current.text} onClick={(event) => { event.stopPropagation(); setEditing(true); }}>{current.text}</button> : <button type="button" className="nb5-current-empty" onClick={(event) => { event.stopPropagation(); quickNext(); }}>＋ первое действие</button>}
    </div>
    <div className="nb5-state">
      {active ? <span className="nb5-state-focus">СЕЙЧАС</span> : waiting ? <button type="button" className="nb5-state-wait" onClick={(event) => { event.stopPropagation(); openReminder({ taskId: task.id, stepId: current?.id }); }}>{waitingPerson ? `ЖДУ · ${waitingPerson}` : 'ЖДУ'}</button> : staleDays >= 3 ? <span className="nb5-state-stale">{staleDays}д без движения</span> : null}
    </div>
    <div className="nb5-row-tools">
      {current && <button type="button" onClick={(event) => { event.stopPropagation(); openReminder({ taskId: task.id, stepId: current.id }); }} title="Жду / напомнить">◷</button>}
      {historyCount > 0 && <button type="button" onClick={(event) => { event.stopPropagation(); onSelect(); }} title={`История: ${historyCount}`}>↺<small>{historyCount}</small></button>}
      {!task.notebookCompleted && <button type="button" onClick={(event) => { event.stopPropagation(); quickNext(); }} title="Следующий шаг">＋</button>}
      {current && <button type="button" className="nb5-row-delete" onClick={(event) => { event.stopPropagation(); deleteStep(task.id, current.id); }} title="Удалить текущий шаг">×</button>}
      <button type="button" className="nb5-chevron" onClick={(event) => { event.stopPropagation(); onSelect(); }} title="Открыть контекст">›</button>
    </div>
  </article>;
}

function NotebookV5Inspector({ task, now, active, close, openTask, requestActivate, updateTask, addStep, updateStep, deleteStep, openReminder, moveToBoard, toggleCompleted, finishTask }: {
  task: Task; now: number; active: boolean; close: () => void; openTask: (id: string) => void; requestActivate: (id: string) => void; updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; openReminder: (target: ReminderTarget) => void; moveToBoard: (id: string, column: BoardColumnId) => void; toggleCompleted: (id: string) => void; finishTask: (id: string) => void;
}) {
  const current = task.steps.at(-1) || null;
  const history = task.steps.slice(0, -1);
  const [next, setNext] = useState('');
  const waitingStep = [...task.steps].reverse().find((item) => item.waitingPerson.trim());
  const waitingPerson = task.waitingPerson.trim() || (task.columnId === 'delegated' ? task.assignee.trim() : '') || waitingStep?.waitingPerson.trim() || '';
  const submitNext = () => { if (!next.trim()) return; addStep(task.id, next); setNext(''); };

  return <aside className="nb5-inspector">
    <div className="nb5-inspector-top">
      <div className="nb5-inspector-kicker"><span className={`nb5-project-dot ${task.project}`} />{active ? 'СЕЙЧАС' : task.notebookCompleted ? 'ВЫПОЛНЕНО' : 'ЗАДАЧА'}</div>
      <div className="nb5-inspector-icons"><button type="button" onClick={() => openTask(task.id)} title="Глубокий режим">↗</button><button type="button" onClick={close} title="Закрыть">×</button></div>
    </div>

    <input className="nb5-inspector-title" value={task.title} onChange={(event) => updateTask(task.id, { title: event.target.value })} />
    <div className="nb5-inspector-meta"><span>{formatTaskCreated(task.createdAt)}</span>{projectLabel(task.project) && <span>{projectLabel(task.project)}</span>}<span>{ageLabel(lastTouched(task), now)}</span>{waitingPerson && <button type="button" onClick={() => openReminder({ taskId: task.id, stepId: current?.id })}>ЖДУ · {waitingPerson}</button>}</div>

    <section className="nb5-inspector-current">
      <div className="nb5-section-label"><span>Сейчас</span>{current && <div><button type="button" onClick={() => openReminder({ taskId: task.id, stepId: current.id })} title="Жду / напомнить">◷</button><button type="button" className="delete" onClick={() => deleteStep(task.id, current.id)} title="Удалить шаг">×</button></div>}</div>
      {current ? <textarea value={current.text} rows={3} onChange={(event) => updateStep(task.id, current.id, { text: event.target.value })} /> : !task.notebookCompleted ? <form className="nb5-first-action" onSubmit={(event) => { event.preventDefault(); submitNext(); }}><input id="nb5-panel-next" autoFocus value={next} onChange={(event) => setNext(event.target.value)} placeholder="Первое действие..." /><button>Enter</button></form> : <div className="nb5-inspector-empty">Задача выполнена</div>}
    </section>

    {history.length > 0 && <section className="nb5-inspector-history">
      <div className="nb5-section-label"><span>История</span><b>{history.length}</b></div>
      <div className="nb5-history-list">{history.map((item, index) => <article key={item.id} className={item.waitingPerson ? 'waiting' : ''}><span className="nb5-history-number">{index + 1}</span><textarea rows={1} value={item.text} onChange={(event) => updateStep(task.id, item.id, { text: event.target.value })} /><div className="nb5-history-tools"><button type="button" onClick={() => openReminder({ taskId: task.id, stepId: item.id })}>◷</button><button type="button" className="delete" onClick={() => deleteStep(task.id, item.id)}>×</button></div></article>)}</div>
    </section>}

    {!task.notebookCompleted && current && <form className="nb5-next-form" onSubmit={(event) => { event.preventDefault(); submitNext(); }}><label>Что дальше?</label><div><input id="nb5-panel-next" value={next} onChange={(event) => setNext(event.target.value)} placeholder="Следующий шаг..." /><button>Enter</button></div></form>}

    <div className="nb5-inspector-footer">
      {!active && !task.notebookCompleted && <button type="button" className="focus" onClick={() => requestActivate(task.id)}>● Сделать СЕЙЧАС</button>}
      {active && !task.notebookCompleted && <span className="nb5-active-note">● Сейчас в фокусе</span>}
      <button type="button" onClick={() => openReminder({ taskId: task.id, stepId: current?.id })}>◷ ЖДУ / напомнить</button>
      <select defaultValue="" onChange={(event) => { if (event.target.value) moveToBoard(task.id, event.target.value as BoardColumnId); event.currentTarget.value = ''; }}><option value="">В доску →</option><option value="today">Сегодня</option><option value="week">Неделя</option><option value="month">Месяц</option><option value="delegated">Делегировано</option></select>
      <button type="button" onClick={() => toggleCompleted(task.id)}>{task.notebookCompleted ? '↩ Вернуть в работу' : '✓ Выполнено'}</button>
      {task.notebookCompleted && <button type="button" className="finish" onClick={() => { finishTask(task.id); close(); }}>В Готово</button>}
    </div>
  </aside>;
}

function TaskFocusView({ task, now, close, updateTask, addStep, updateStep, deleteStep, openReminder, toggleCompleted, finishTask }: {
  task: Task; now: number; close: () => void; updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; openReminder: (target: ReminderTarget) => void; toggleCompleted: (id: string) => void; finishTask: (id: string) => void;
}) {
  const [next, setNext] = useState('');
  const current = task.steps.at(-1) || null;
  const submitNext = () => { if (!next.trim()) return; addStep(task.id, next); setNext(''); };
  return <div className="task-focus-overlay">
    <div className="task-focus-shell">
      <div className="task-focus-top"><button className="task-focus-back" onClick={close}>← Вернуться в Тетрадь</button><span className="task-focus-mode">Одна задача · без отвлечений</span></div>
      <textarea className="task-focus-title" value={task.title} rows={2} onChange={(event) => updateTask(task.id, { title: event.target.value })} />
      <div className="task-focus-meta">{projectLabel(task.project) && <span className={`task-focus-project ${task.project}`}>{projectLabel(task.project)}</span>}<span>{ageLabel(lastTouched(task), now)}</span>{taskIsWaiting(task) && <button className="task-focus-wait" onClick={() => openReminder({ taskId: task.id })}>ЖДУ</button>}</div>
      {current ? <section className="task-focus-current"><small>Сейчас</small><strong>{current.text}</strong></section> : <section className="task-focus-current empty"><small>Сейчас</small><strong>Добавь первое действие ниже</strong></section>}
      <div className="task-focus-history-head"><span>История</span><span>{task.steps.length}</span></div>
      <section className="task-focus-history">{task.steps.map((item, index) => <article className={`task-focus-step ${item.id === current?.id ? 'current' : ''}`} key={item.id}><div className="task-focus-step-number">{index + 1}</div><textarea value={item.text} rows={1} onChange={(event) => updateStep(task.id, item.id, { text: event.target.value })} /><div className="task-focus-step-actions"><button onClick={() => openReminder({ taskId: task.id, stepId: item.id })} title="Жду / напомнить">⏰</button><button className="delete" onClick={() => deleteStep(task.id, item.id)} title="Удалить этап">×</button></div></article>)}</section>
      {!task.notebookCompleted && <form className="task-focus-next" onSubmit={(event) => { event.preventDefault(); submitNext(); }}><label>Что дальше</label><div className="task-focus-next-row"><input autoFocus value={next} onChange={(event) => setNext(event.target.value)} placeholder="Что делаю дальше?" /><button>Добавить</button></div></form>}
      <div className="task-focus-footer"><button onClick={() => openReminder({ taskId: task.id })}>⏰ Жду / напомнить</button><button onClick={() => toggleCompleted(task.id)}>{task.notebookCompleted ? 'Вернуть в работу' : 'Отметить выполненной'}</button>{task.notebookCompleted && <button className="complete" onClick={() => { finishTask(task.id); close(); }}>В Готово</button>}</div>
    </div>
  </div>;
}

function BoardPage({ store, city, setCity, now, dragId, setDragId, createTask, moveTask, openSchedule, openReminder, openDelegate, finishTask }: {
  store: Store; city: CityId; setCity: (city: CityId) => void; now: number; dragId: string | null; setDragId: (id: string | null) => void; createTask: (title: string, column: ColumnId, city: CityId, project?: ProjectId) => string | null; moveTask: (id: string, column: BoardColumnId, beforeId?: string) => void; openSchedule: (id: string) => void; openReminder: (id: string) => void; openDelegate: (id: string) => void; finishTask: (id: string) => void;
}) {
  const [title, setTitle] = useState(''); const [column, setColumn] = useState<BoardColumnId>('today'); const [project, setProject] = useState<ProjectId>('none');
  const submit = () => { const id = createTask(title, column, city, project); if (!id) return; setTitle(''); if (column === 'delegated') window.setTimeout(() => openDelegate(id), 0); };
  return <main className="board-page v6-board"><div className="page-heading board-heading"><div><h1>Доска</h1><p>Отдельные горизонты СПб и Краснодара</p></div><div className="city-switch"><button className={city === 'spb' ? 'active' : ''} onClick={() => setCity('spb')}>Санкт-Петербург</button><button className={city === 'krasnodar' ? 'active' : ''} onClick={() => setCity('krasnodar')}>Краснодар</button></div></div>
    <form className="board-big-add" onSubmit={(event) => { event.preventDefault(); submit(); }}><span>＋</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Добавить задачу на доску..." /><ProjectPicker value={project} setValue={setProject} /><select value={column} onChange={(event) => setColumn(event.target.value as BoardColumnId)}>{BOARD_COLUMNS.filter((item) => item !== 'done').map((item) => <option value={item} key={item}>{store.columnTitles[item]}</option>)}</select><button>Добавить задачу</button></form>
    <div className="board-scroll"><div className="board-grid">{BOARD_COLUMNS.map((columnId) => {
      const tasks = store.tasks.filter((task) => !task.inNotebook && task.city === city && task.columnId === columnId).sort((a, b) => a.boardOrder - b.boardOrder);
      return <BoardColumn key={columnId} columnId={columnId} title={store.columnTitles[columnId]} tasks={tasks} now={now} dragId={dragId} setDragId={setDragId} moveTask={moveTask} openSchedule={openSchedule} openReminder={openReminder} openDelegate={openDelegate} finishTask={finishTask} />;
    })}</div></div>
  </main>;
}

function BoardColumn({ columnId, title, tasks, now, dragId, setDragId, moveTask, openSchedule, openReminder, openDelegate, finishTask }: { columnId: BoardColumnId; title: string; tasks: Task[]; now: number; dragId: string | null; setDragId: (id: string | null) => void; moveTask: (id: string, column: BoardColumnId, beforeId?: string) => void; openSchedule: (id: string) => void; openReminder: (id: string) => void; openDelegate: (id: string) => void; finishTask: (id: string) => void; }) {
  return <section className={`board-column column-${columnId}`} onDragOver={(event) => event.preventDefault()} onDrop={() => dragId && moveTask(dragId, columnId)}><div className="column-head"><strong>{title}</strong><span>{tasks.length}</span></div><div className="board-cards">{tasks.map((task) => {
    const waiting = taskIsWaiting(task); const overdue = task.deadline !== null && task.deadline < now;
    return <article className={`board-card project-${task.project} ${waiting ? 'is-waiting' : ''}`} key={task.id} draggable onDragStart={() => setDragId(task.id)} onDragEnd={() => setDragId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); if (dragId && dragId !== task.id) moveTask(dragId, columnId, task.id); }}><div className="card-title">{task.title}</div><div className="card-meta">{projectLabel(task.project) && <b>{projectLabel(task.project)}</b>}{task.assignee && <span>→ {task.assignee}</span>}{waiting && <span className="wait-chip">ЖДУ</span>}</div>{task.deadline && <div className={`deadline-chip ${overdue ? 'overdue' : ''}`}>Дедлайн · {formatDateTime(task.deadline)}</div>}<div className="card-last">{lastStep(task)}</div><div className="card-actions">{columnId !== 'done' && <button onClick={() => openSchedule(task.id)}>В тетрадь</button>}{columnId !== 'done' && <button onClick={() => openReminder(task.id)}>Жду</button>}{columnId === 'delegated' && <button onClick={() => openDelegate(task.id)}>Кому / дедлайн</button>}{columnId !== 'done' && <button onClick={() => finishTask(task.id)}>Готово</button>}</div></article>;
  })}</div></section>;
}

function PeoplePage({ tasks, now, openReminder }: { tasks: Task[]; now: number; openReminder: (target: ReminderTarget) => void }) {
  const items = useMemo(() => {
    const result: Array<{ id: string; person: string; task: Task; step?: TaskStep; at: number | null }> = [];
    tasks.filter((task) => task.columnId !== 'done').forEach((task) => {
      const taskPerson = task.waitingPerson.trim() || (task.columnId === 'delegated' ? task.assignee.trim() : '');
      const taskAt = task.returnAt ?? (task.columnId === 'delegated' ? task.deadline : null);
      if (taskPerson) result.push({ id: `task-${task.id}`, person: taskPerson, task, at: taskAt });
      task.steps.filter((step) => step.waitingPerson.trim()).forEach((step) => result.push({ id: `step-${task.id}-${step.id}`, person: step.waitingPerson.trim(), task, step, at: step.remindAt }));
    });
    return result;
  }, [tasks]);
  const groups = useMemo(() => { const map = new Map<string, typeof items>(); items.forEach((item) => map.set(item.person, [...(map.get(item.person) || []), item])); return [...map.entries()]; }, [items]);
  return <main className="people-page"><div className="page-heading"><div><h1>Жду</h1><p>Задачи, делегирования и отдельные этапы, где мяч сейчас не у тебя</p></div></div><div className="people-grid">{groups.map(([person, personItems]) => <section className="person-card" key={person}><div className="person-head"><div className="person-avatar">{person.slice(0, 1).toUpperCase()}</div><div><h2>{person}</h2><span>{personItems.length}</span></div></div>{personItems.map((item) => <article className={`person-task ${item.at !== null && item.at <= now ? 'person-due' : ''}`} key={item.id}><div><strong>{item.task.title}</strong>{item.step && <p>{item.step.text}</p>}<small>{item.at ? formatDateTime(item.at) : 'без времени возврата'}</small></div><button onClick={() => openReminder({ taskId: item.task.id, stepId: item.step?.id })}>изменить</button></article>)}</section>)}</div></main>;
}

function ReminderModal({ task, step, teamNames, close, save, clear }: { task: Task; step: TaskStep | null; teamNames: string[]; close: () => void; save: (person: string, at: number | null) => void; clear: () => void }) {
  const [person, setPerson] = useState(step ? step.waitingPerson : (task.waitingPerson || (task.columnId === 'delegated' ? task.assignee : ''))); const [when, setWhen] = useState(toDateTimeLocal(step ? step.remindAt : (task.returnAt ?? (task.columnId === 'delegated' ? task.deadline : null))));
  const quick = (days: number, hour?: number) => { const date = new Date(); date.setDate(date.getDate() + days); if (hour !== undefined) date.setHours(hour, 0, 0, 0); setWhen(toDateTimeLocal(date.getTime())); };
  const delegationWait = !step && task.columnId === 'delegated' && Boolean(task.assignee.trim());
  return <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="modal-card reminder-modal" onSubmit={(event) => { event.preventDefault(); save(person, fromDateTimeLocal(when)); }}><p>{step ? 'НАПОМИНАНИЕ ПО ЭТАПУ' : 'ЖДУ / ВЕРНУТЬ ВНИМАНИЕ'}</p><h2>{task.title}</h2>{step && <div className="modal-step">{step.text}</div>}<label>Кого жду?</label><input list="reminder-team" value={person} onChange={(event) => setPerson(event.target.value)} placeholder="Например: Наташа" /><datalist id="reminder-team">{teamNames.map((name) => <option value={name} key={name} />)}</datalist><label>Когда напомнить?</label><div className="return-options"><button type="button" onClick={() => quick(1)}>завтра</button><button type="button" onClick={() => quick(0, 18)}>сегодня 18:00</button><button type="button" onClick={() => quick(3)}>3 дня</button><button type="button" onClick={() => setWhen('')}>без даты</button></div><input className="datetime-return-input" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} /><div className="modal-actions">{delegationWait ? <span className="delegation-wait-note">Делегирование всегда остаётся в ЖДУ</span> : <button type="button" className="danger-link" onClick={clear}>Снять Жду</button>}<button type="button" onClick={close}>Отмена</button><button className="primary">Сохранить</button></div></form></div>;
}

function DelegateModal({ task, teamNames, close, save }: { task: Task; teamNames: string[]; close: () => void; save: (assignee: string, deadline: number | null, newPerson?: string) => void }) {
  const [assignee, setAssignee] = useState(task.assignee); const [deadline, setDeadline] = useState(toDateTimeLocal(task.deadline)); const [newPerson, setNewPerson] = useState('');
  return <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="modal-card" onSubmit={(event) => { event.preventDefault(); save(assignee, fromDateTimeLocal(deadline), newPerson); }}><p>ДЕЛЕГИРОВАНО = ЖДУ</p><h2>{task.title}</h2><label>Кому?</label><select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Выбрать сотрудника</option>{teamNames.map((name) => <option value={name} key={name}>{name}</option>)}</select><label>Или добавить нового</label><input value={newPerson} onChange={(event) => setNewPerson(event.target.value)} placeholder="Имя нового сотрудника" /><label>Дедлайн / когда вернуть внимание</label><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /><div className="modal-actions"><button type="button" onClick={close}>Отмена</button><button className="primary" disabled={!assignee && !newPerson.trim()}>Делегировать</button></div></form></div>;
}

function NotebookScheduleModal({ task, close, save }: { task: Task; close: () => void; save: (at: number) => void }) {
  const [when, setWhen] = useState(toDateTimeLocal(Date.now()));
  const tomorrowMorning = () => { const date = new Date(); date.setDate(date.getDate() + 1); date.setHours(9, 0, 0, 0); setWhen(toDateTimeLocal(date.getTime())); };
  return <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="modal-card" onSubmit={(event) => { event.preventDefault(); save(fromDateTimeLocal(when) || Date.now()); }}><p>В ТЕТРАДЬ</p><h2>{task.title}</h2><label>Когда задача должна появиться?</label><div className="return-options"><button type="button" onClick={() => setWhen(toDateTimeLocal(Date.now()))}>сейчас</button><button type="button" onClick={tomorrowMorning}>завтра 09:00</button></div><input type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} /><div className="modal-actions"><button type="button" onClick={close}>Отмена</button><button className="primary">Перенести</button></div></form></div>;
}

function QuickCapture({ value, setValue, inputRef, close, submit }: { value: string; setValue: (value: string) => void; inputRef: { current: HTMLInputElement | null }; close: () => void; submit: () => void }) {
  return <div className="quick-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="quick-capture" onSubmit={(event) => { event.preventDefault(); submit(); }}><span>＋</span><input ref={inputRef} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Что появилось?" /><kbd>Enter → Пул</kbd></form></div>;
}

export default App;
