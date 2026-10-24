from pathlib import Path
import re

p=Path("src/App.tsx")
s=p.read_text(encoding="utf-8")

def rep(old,new,label):
    global s
    if old not in s:
        raise SystemExit("missing "+label)
    s=s.replace(old,new,1)

def between(start,end,new,label):
    global s
    a=s.find(start)
    if a<0: raise SystemExit("missing start "+label)
    b=s.find(end,a)
    if b<0: raise SystemExit("missing end "+label)
    s=s[:a]+new+s[b:]

rep(
"import type { BoardColumnId, CityId, ColumnId, ProjectId, Store, Task, TaskStep } from './types';",
"import type { BoardColumnId, CityId, ColumnId, ProjectId, Store, Task, TaskStep, TaskSubtask } from './types';",
"types import")

rep(
"const BOARD_COLUMNS: BoardColumnId[] = ['today', 'week', 'month', 'delegated', 'done'];",
"""const DAY_COLUMNS: BoardColumnId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const BOARD_COLUMNS: BoardColumnId[] = ['inbox', ...DAY_COLUMNS, 'month', 'delegated', 'done'];
const DAY_LABELS: Record<string, string> = { mon: 'Пн', tue: 'Вт', wed: 'Ср', thu: 'Чт', fri: 'Пт', sat: 'Сб', sun: 'Вс' };""",
"board constants")

rep(
"const isColumnId = (value: unknown): value is ColumnId => ['today', 'week', 'month', 'delegated', 'done', 'pool'].includes(String(value));",
"""const isColumnId = (value: unknown): value is ColumnId => ['inbox', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'month', 'delegated', 'done', 'pool'].includes(String(value));
const dayColumnFromDate = (date = new Date()): BoardColumnId => {
  const ids: BoardColumnId[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return ids[date.getDay()];
};
const normalizeColumnId = (value: unknown): ColumnId => {
  if (isColumnId(value)) return value;
  if (value === 'today') return dayColumnFromDate();
  if (value === 'week') return 'inbox';
  return value === 'pool' ? 'pool' : 'inbox';
};""",
"column guard")

rep(
"const projectLabel = (project: ProjectId) => project === 'pasta' ? 'Паста' : project === 'kvep' ? 'КВЭП' : '';",
"""const projectLabel = (project: ProjectId) => project === 'pasta' ? 'Паста' : project === 'kvep' ? 'КВЭП' : '';
const priorityMeta = (quadrant?: MatrixQuadrant) => {
  if (quadrant === 'urgent-important') return { label: 'Срочно / Важно', cls: 'priority-red' };
  if (quadrant === 'important-not-urgent') return { label: 'Важно / Не срочно', cls: 'priority-amber' };
  if (quadrant === 'urgent-not-important') return { label: 'Срочно / Не важно', cls: 'priority-green' };
  if (quadrant === 'not-urgent-not-important') return { label: 'Не важно / Не срочно', cls: 'priority-blue' };
  return null;
};
const formatPlannedTime = (task: Task) => {
  if (!task.plannedStart) return '';
  const start = new Date(task.plannedStart).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (!task.plannedEnd) return start;
  const end = new Date(task.plannedEnd).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${start}–${end}`;
};
const startOfWeek = (timestamp: number) => {
  const date = new Date(timestamp);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
};""",
"priority helpers")

# Normalize steps block by adding subtasks
needle="""    const steps: TaskStep[] = Array.isArray(task.steps) ? task.steps.map((itemStep, stepIndex) => {
      const step = (itemStep && typeof itemStep === 'object' ? itemStep : {}) as Partial<TaskStep>;
      return {
        id: typeof step.id === 'string' ? step.id : newId(),
        text: typeof step.text === 'string' ? step.text : `Запись ${stepIndex + 1}`,
        createdAt: typeof step.createdAt === 'number' ? step.createdAt : Date.now(),
        waitingPerson: typeof step.waitingPerson === 'string' ? step.waitingPerson : '',
        remindAt: typeof step.remindAt === 'number' ? step.remindAt : null,
      };
    }) : [];
"""
insert=needle+"""    const subtasks: TaskSubtask[] = Array.isArray(task.subtasks) ? task.subtasks.map((itemSubtask, subtaskIndex) => {
      const subtask = (itemSubtask && typeof itemSubtask === 'object' ? itemSubtask : {}) as Partial<TaskSubtask>;
      return {
        id: typeof subtask.id === 'string' ? subtask.id : newId(),
        text: typeof subtask.text === 'string' ? subtask.text : `Подзадача ${subtaskIndex + 1}`,
        done: Boolean(subtask.done),
      };
    }) : [];
"""
rep(needle,insert,"normalize subtasks")

rep(
"      columnId: isColumnId(task.columnId) ? task.columnId : 'pool',",
"      columnId: normalizeColumnId(task.columnId),",
"normalize column")

rep(
"      steps,\n      waitingPerson:",
"      steps,\n      subtasks,\n      waitingPerson:",
"normalized subtasks field")

rep(
"      deadline: typeof task.deadline === 'number' ? task.deadline : null,\n      project:",
"      deadline: typeof task.deadline === 'number' ? task.deadline : null,\n      plannedStart: typeof task.plannedStart === 'number' ? task.plannedStart : null,\n      plannedEnd: typeof task.plannedEnd === 'number' ? task.plannedEnd : null,\n      project:",
"normalized planning fields")

rep(
"    columnTitles: { ...defaultColumnTitles, ...(raw.columnTitles || {}) },",
"    columnTitles: { ...defaultColumnTitles },",
"column titles migration")

rep(
"  const [deadlineTaskId, setDeadlineTaskId] = useState<string | null>(null);",
"  const [deadlineTaskId, setDeadlineTaskId] = useState<string | null>(null);\n  const [timeTaskId, setTimeTaskId] = useState<string | null>(null);",
"time modal state")

rep(
"        setDeadlineTaskId(null);\n        setTaskFocusId(null);",
"        setDeadlineTaskId(null);\n        setTimeTaskId(null);\n        setTaskFocusId(null);",
"escape time modal")

rep(
"  const waitingTasks = useMemo(() => store.tasks.filter((task) => task.columnId !== 'done' && taskIsWaiting(task)), [store.tasks]);",
"  const delegatedTasks = useMemo(() => store.tasks.filter((task) => task.columnId === 'delegated'), [store.tasks]);",
"delegated count")

# migrate previously transferred pool longbox tasks to inbox
anchor="  useEffect(() => localStorage.setItem(MATRIX_TRANSFERRED_STORAGE_KEY, JSON.stringify(matrixTransferred)), [matrixTransferred]);\n"
extra=anchor+"""  useEffect(() => {
    setStore((current) => {
      let changed = false;
      const tasks = current.tasks.map((task) => {
        if (task.columnId === 'pool' && matrixTransferred[task.id]) {
          changed = true;
          return { ...task, columnId: 'inbox' as ColumnId, boardOrder: nextBoardOrder(current.tasks, 'inbox', task.city) };
        }
        return task;
      });
      return changed ? { ...current, tasks } : current;
    });
  }, []);
"""
rep(anchor,extra,"transferred pool migration")

# matrix transfer -> inbox always
old="""          const targetColumn: ColumnId =
            quadrant === 'important-not-urgent'
              ? 'week'
              : quadrant === 'not-urgent-not-important'
                ? 'pool'
                : 'today';
"""
rep(old,"          const targetColumn: ColumnId = 'inbox';\n","matrix target inbox")

# createTask fields/current day
rep(
"      id, title: clean, columnId: inNotebook ? 'today' : columnId, boardOrder: nextBoardOrder(current.tasks, columnId, city),",
"      id, title: clean, columnId: inNotebook ? dayColumnFromDate() : columnId, boardOrder: nextBoardOrder(current.tasks, columnId, city),",
"create current day")
rep(
"      steps: [], waitingPerson: '', returnAt: null, assignee: '', deadline: null, project, city, createdAt: Date.now(), completedAt: null,",
"      steps: [], subtasks: [], waitingPerson: '', returnAt: null, assignee: '', deadline: null, plannedStart: null, plannedEnd: null, project, city, createdAt: Date.now(), completedAt: null,",
"create fields")

# subtask functions after deleteStep
anchor="  const deleteStep = (taskId: string, stepId: string) => setStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, steps: task.steps.filter((step) => step.id !== stepId) } : task) }));\n"
sub=anchor+"""  const addSubtask = (taskId: string, text: string) => {
    const clean = text.trim(); if (!clean) return;
    setStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, subtasks: [...task.subtasks, { id: newId(), text: clean, done: false }] } : task) }));
  };
  const toggleSubtask = (taskId: string, subtaskId: string) => setStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, subtasks: task.subtasks.map((item) => item.id === subtaskId ? { ...item, done: !item.done } : item) } : task) }));
  const deleteSubtask = (taskId: string, subtaskId: string) => setStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, subtasks: task.subtasks.filter((item) => item.id !== subtaskId) } : task) }));
"""
rep(anchor,sub,"subtask functions")

# preserve matrix assignment through workflow
s=s.replace("  const moveToNotebook = (taskId: string, at: number) => {\n    discardMatrixAssignment(taskId);\n","  const moveToNotebook = (taskId: string, at: number) => {\n",1)
s=s.replace("  const moveNotebookToBoard = (taskId: string, columnId: BoardColumnId) => {\n    discardMatrixAssignment(taskId);\n","  const moveNotebookToBoard = (taskId: string, columnId: BoardColumnId) => {\n",1)
s=s.replace("  const finishTask = (taskId: string) => {\n    discardMatrixAssignment(taskId);\n","  const finishTask = (taskId: string) => {\n",1)
s=s.replace("    if (changedColumn) discardMatrixAssignment(taskId);\n","",1)
s=s.replace("    discardMatrixAssignment(taskId);\n    const person = (newPerson || assignee).trim();","    const person = (newPerson || assignee).trim();",1)

# moveToNotebook should preserve existing column
rep(
"tasks: current.tasks.map((task) => task.id === taskId ? { ...task, inNotebook: true, notebookAt: at, notebookCompleted: false, notebookOrder: task.inNotebook ? task.notebookOrder : nextNotebookOrder(current.tasks), columnId: 'today', completedAt: null } : task)",
"tasks: current.tasks.map((task) => task.id === taskId ? { ...task, inNotebook: true, notebookAt: at, notebookCompleted: false, notebookOrder: task.inNotebook ? task.notebookOrder : nextNotebookOrder(current.tasks), completedAt: null } : task)",
"notebook preserve column")

# time task ref
rep(
"  const deadlineTask = deadlineTaskId ? store.tasks.find((task) => task.id === deadlineTaskId) || null : null;",
"  const deadlineTask = deadlineTaskId ? store.tasks.find((task) => task.id === deadlineTaskId) || null : null;\n  const timeTask = timeTaskId ? store.tasks.find((task) => task.id === timeTaskId) || null : null;",
"time task ref")

# nav and pages
rep(
"<button className={page === 'people' ? 'active' : ''} onClick={() => setPage('people')}>Жду <span>{waitingTasks.length}</span></button>",
"<button className={page === 'people' ? 'active' : ''} onClick={() => setPage('people')}>Делегировано <span>{delegatedTasks.length}</span></button>",
"delegated nav")

rep(
"{page === 'notebook' && <NotebookPage tasks={notebookReady} upcoming={notebookUpcoming} activeTaskId={store.activeTaskId} dueItems={dueItems} now={now} dragId={dragNotebookId} setDragId={setDragNotebookId} createTask={(title, project) => createTask(title, 'today', boardCity, project, true)} updateTask={updateTask} addStep={addStep} updateStep={updateStep} deleteStep={deleteStep} openTask={openTaskFocus} requestActivate={requestActivate} reorderNotebook={reorderNotebook} openReminder={setReminderTarget} moveToBoard={moveNotebookToBoard} toggleCompleted={toggleNotebookCompleted} finishTask={finishTask} showNow={(id) => moveToNotebook(id, Date.now())} />}",
"{page === 'notebook' && <NotebookPage tasks={notebookReady} upcoming={notebookUpcoming} activeTaskId={store.activeTaskId} dueItems={dueItems} now={now} dragId={dragNotebookId} setDragId={setDragNotebookId} createTask={(title, project) => createTask(title, dayColumnFromDate(), boardCity, project, true)} updateTask={updateTask} addStep={addStep} updateStep={updateStep} deleteStep={deleteStep} addSubtask={addSubtask} toggleSubtask={toggleSubtask} deleteSubtask={deleteSubtask} openTask={openTaskFocus} requestActivate={requestActivate} reorderNotebook={reorderNotebook} openReminder={setReminderTarget} openDelegate={setDelegateTaskId} moveToBoard={moveNotebookToBoard} toggleCompleted={toggleNotebookCompleted} finishTask={finishTask} showNow={(id) => moveToNotebook(id, Date.now())} matrixAssignments={matrixAssignments} />}",
"notebook page props")

rep(
"{page === 'board' && <BoardPage store={store} city={boardCity} setCity={setBoardCity} now={now} dragId={dragBoardId} setDragId={setDragBoardId} createTask={createTask} moveTask={moveBoardTask} openSchedule={setScheduleTaskId} openReminder={(id) => setReminderTarget({ taskId: id })} openDelegate={setDelegateTaskId} openDeadline={setDeadlineTaskId} finishTask={finishTask} matrixAssignments={matrixAssignments} matrixTransferred={matrixTransferred} returnToMatrix={returnLongboxToMatrix} />}",
"{page === 'board' && <BoardPage store={store} city={boardCity} setCity={setBoardCity} now={now} dragId={dragBoardId} setDragId={setDragBoardId} createTask={createTask} moveTask={moveBoardTask} openSchedule={setScheduleTaskId} openDelegate={setDelegateTaskId} openDeadline={setDeadlineTaskId} openTime={setTimeTaskId} finishTask={finishTask} matrixAssignments={matrixAssignments} />}",
"board page props")

rep(
"{page === 'people' && <PeoplePage tasks={store.tasks} now={now} openReminder={setReminderTarget} />}",
"{page === 'people' && <DelegatedPage tasks={store.tasks} now={now} openDelegate={setDelegateTaskId} />}",
"delegated page render")

# add time modal
rep(
"    {deadlineTask && <DeadlineModal task={deadlineTask} close={() => setDeadlineTaskId(null)} save={(at) => {",
"    {timeTask && <TimeModal task={timeTask} close={() => setTimeTaskId(null)} save={(start, end) => { updateTask(timeTask.id, { plannedStart: start, plannedEnd: end }); setTimeTaskId(null); }} />}\n    {deadlineTask && <DeadlineModal task={deadlineTask} close={() => setDeadlineTaskId(null)} save={(at) => {",
"time modal render")

# NotebookPage signature
rep(
"function NotebookPage({ tasks, upcoming, activeTaskId, dueItems, now, dragId, setDragId, createTask, updateTask, addStep, updateStep, deleteStep, openTask, requestActivate, reorderNotebook, openReminder, moveToBoard, toggleCompleted, finishTask, showNow }: {",
"function NotebookPage({ tasks, upcoming, activeTaskId, dueItems, now, dragId, setDragId, createTask, updateTask, addStep, updateStep, deleteStep, addSubtask, toggleSubtask, deleteSubtask, openTask, requestActivate, reorderNotebook, openReminder, openDelegate, moveToBoard, toggleCompleted, finishTask, showNow, matrixAssignments }: {",
"notebook signature")
rep(
"  setDragId: (id: string | null) => void; createTask: (title: string, project: ProjectId) => unknown; updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; openTask: (id: string) => void; requestActivate: (id: string) => void; reorderNotebook: (id: string, beforeId?: string) => void; openReminder: (target: ReminderTarget) => void; moveToBoard: (id: string, column: BoardColumnId) => void; toggleCompleted: (id: string) => void; finishTask: (id: string) => void; showNow: (id: string) => void;",
"  setDragId: (id: string | null) => void; createTask: (title: string, project: ProjectId) => unknown; updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; addSubtask: (id: string, text: string) => void; toggleSubtask: (taskId: string, subtaskId: string) => void; deleteSubtask: (taskId: string, subtaskId: string) => void; openTask: (id: string) => void; requestActivate: (id: string) => void; reorderNotebook: (id: string, beforeId?: string) => void; openReminder: (target: ReminderTarget) => void; openDelegate: (id: string) => void; moveToBoard: (id: string, column: BoardColumnId) => void; toggleCompleted: (id: string) => void; finishTask: (id: string) => void; showNow: (id: string) => void; matrixAssignments: MatrixAssignments;",
"notebook prop types")

# Inspector props in call
rep(
"        deleteStep={deleteStep}\n        openReminder={openReminder}",
"        deleteStep={deleteStep}\n        addSubtask={addSubtask}\n        toggleSubtask={toggleSubtask}\n        deleteSubtask={deleteSubtask}\n        openReminder={openReminder}\n        openDelegate={openDelegate}\n        priority={matrixAssignments[selectedTask.id]}",
"inspector call props")

# Inspector signature and types
rep(
"function NotebookV5Inspector({ task, now, active, close, openTask, requestActivate, updateTask, addStep, updateStep, deleteStep, openReminder, moveToBoard, toggleCompleted, finishTask }: {",
"function NotebookV5Inspector({ task, now, active, close, openTask, requestActivate, updateTask, addStep, updateStep, deleteStep, addSubtask, toggleSubtask, deleteSubtask, openReminder, openDelegate, priority, moveToBoard, toggleCompleted, finishTask }: {",
"inspector signature")
rep(
"  task: Task; now: number; active: boolean; close: () => void; openTask: (id: string) => void; requestActivate: (id: string) => void; updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; openReminder: (target: ReminderTarget) => void; moveToBoard: (id: string, column: BoardColumnId) => void; toggleCompleted: (id: string) => void; finishTask: (id: string) => void;",
"  task: Task; now: number; active: boolean; close: () => void; openTask: (id: string) => void; requestActivate: (id: string) => void; updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; addSubtask: (id: string, text: string) => void; toggleSubtask: (taskId: string, subtaskId: string) => void; deleteSubtask: (taskId: string, subtaskId: string) => void; openReminder: (target: ReminderTarget) => void; openDelegate: (id: string) => void; priority?: MatrixQuadrant; moveToBoard: (id: string, column: BoardColumnId) => void; toggleCompleted: (id: string) => void; finishTask: (id: string) => void;",
"inspector types")

# Inspector local subtask input
rep(
"  const [next, setNext] = useState('');",
"  const [next, setNext] = useState('');\n  const [newSubtask, setNewSubtask] = useState('');",
"inspector subtask state")

# Meta priority
rep(
'''<div className="nb5-inspector-meta"><span>{formatTaskCreated(task.createdAt)}</span>{projectLabel(task.project) && <span>{projectLabel(task.project)}</span>}<span>{ageLabel(lastTouched(task), now)}</span>{waitingPerson && <button type="button" onClick={() => openReminder({ taskId: task.id, stepId: current?.id })}>ЖДУ · {waitingPerson}</button>}</div>''',
'''<div className="nb5-inspector-meta"><span>{formatTaskCreated(task.createdAt)}</span>{projectLabel(task.project) && <span>{projectLabel(task.project)}</span>}{priorityMeta(priority) && <span className={`priority-chip ${priorityMeta(priority)?.cls}`}>{priorityMeta(priority)?.label}</span>}<span>{ageLabel(lastTouched(task), now)}</span>{waitingPerson && <button type="button" onClick={() => openReminder({ taskId: task.id, stepId: current?.id })}>Напомнить · {waitingPerson}</button>}</div>''',
"inspector priority")

# Insert subtasks before next form
anchor="""    {history.length > 0 && <section className="nb5-inspector-history">
      <div className="nb5-section-label"><span>История</span><b>{history.length}</b></div>
      <div className="nb5-history-list">{history.map((item, index) => <article key={item.id} className={item.waitingPerson ? 'waiting' : ''}><span className="nb5-history-number">{index + 1}</span><textarea rows={1} value={item.text} onChange={(event) => updateStep(task.id, item.id, { text: event.target.value })} /><div className="nb5-history-tools"><button type="button" onClick={() => openReminder({ taskId: task.id, stepId: item.id })}>◷</button><button type="button" className="delete" onClick={() => deleteStep(task.id, item.id)}>×</button></div></article>)}</div>
    </section>}
"""
subsection=anchor+"""
    <section className="nb5-subtasks">
      <div className="nb5-section-label"><span>Подзадачи</span><b>{task.subtasks.filter((item) => item.done).length}/{task.subtasks.length}</b></div>
      <div className="nb5-subtask-list">{task.subtasks.map((item) => <div key={item.id} className={item.done ? 'done' : ''}><button type="button" onClick={() => toggleSubtask(task.id, item.id)}>{item.done ? '✓' : ''}</button><span>{item.text}</span><button type="button" className="delete" onClick={() => deleteSubtask(task.id, item.id)}>×</button></div>)}</div>
      <form onSubmit={(event) => { event.preventDefault(); if (!newSubtask.trim()) return; addSubtask(task.id, newSubtask); setNewSubtask(''); }}><input value={newSubtask} onChange={(event) => setNewSubtask(event.target.value)} placeholder="Добавить подзадачу..." /><button>＋</button></form>
    </section>
"""
rep(anchor,subsection,"subtask inspector section")

# Inspector footer delegation + new board options
rep(
"      <button type="button" onClick={() => openReminder({ taskId: task.id, stepId: current?.id })}>◷ ЖДУ / напомнить</button>",
"      <button type="button" onClick={() => openReminder({ taskId: task.id, stepId: current?.id })}>◷ Напомнить</button>\n      <button type="button" className="delegate" onClick={() => openDelegate(task.id)}>↗ Делегировать</button>",
"inspector delegate")
rep(
'''<select defaultValue="" onChange={(event) => { if (event.target.value) moveToBoard(task.id, event.target.value as BoardColumnId); event.currentTarget.value = ''; }}><option value="">В доску →</option><option value="today">Сегодня</option><option value="week">Неделя</option><option value="month">Месяц</option><option value="delegated">Делегировано</option></select>''',
'''<select defaultValue="" onChange={(event) => { if (event.target.value) moveToBoard(task.id, event.target.value as BoardColumnId); event.currentTarget.value = ''; }}><option value="">В доску →</option><option value="inbox">Входящие</option><option value="mon">Пн</option><option value="tue">Вт</option><option value="wed">Ср</option><option value="thu">Чт</option><option value="fri">Пт</option><option value="sat">Сб</option><option value="sun">Вс</option><option value="month">Месяц</option><option value="delegated">Делегировано</option></select>''',
"inspector board options")

# Replace BoardPage through PeoplePage
start="function BoardPage("
end="function ReminderModal("
board_code=r'''function BoardPage({ store, city, setCity, now, dragId, setDragId, createTask, moveTask, openSchedule, openDelegate, openDeadline, openTime, finishTask, matrixAssignments }: {
  store: Store; city: CityId; setCity: (city: CityId) => void; now: number; dragId: string | null; setDragId: (id: string | null) => void; createTask: (title: string, column: ColumnId, city: CityId, project?: ProjectId) => string | null; moveTask: (id: string, column: BoardColumnId, beforeId?: string) => void; openSchedule: (id: string) => void; openDelegate: (id: string) => void; openDeadline: (id: string) => void; openTime: (id: string) => void; finishTask: (id: string) => void; matrixAssignments: MatrixAssignments;
}) {
  const [title, setTitle] = useState('');
  const [project, setProject] = useState<ProjectId>('none');
  const weekStart = useMemo(() => startOfWeek(now), [now]);
  const dateForColumn = (columnId: BoardColumnId) => {
    const index = DAY_COLUMNS.indexOf(columnId);
    if (index < 0) return null;
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  };
  const rangeEnd = new Date(weekStart); rangeEnd.setDate(rangeEnd.getDate() + 6);
  const weekRange = `${weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')} — ${rangeEnd.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '')}`;
  const submit = () => { const id = createTask(title, 'inbox', city, project); if (!id) return; setTitle(''); };

  return <main className="board-page v6-board weekly-board">
    <div className="page-heading board-heading">
      <div><h1>Доска</h1><p>Входящие → день недели → Тетрадь</p></div>
      <div className="board-heading-actions">
        <span className="week-range">{weekRange}</span>
        <div className="city-switch"><button className={city === 'spb' ? 'active' : ''} onClick={() => setCity('spb')}>Санкт-Петербург</button><button className={city === 'krasnodar' ? 'active' : ''} onClick={() => setCity('krasnodar')}>Краснодар</button></div>
      </div>
    </div>
    <form className="board-big-add board-inbox-add" onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <span>＋</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Добавить задачу во Входящие..." />
      <ProjectPicker value={project} setValue={setProject} />
      <button>Добавить</button>
    </form>
    <div className="board-scroll weekly-board-scroll">
      <div className="board-grid weekly-board-grid">{BOARD_COLUMNS.map((columnId) => {
        const tasks = store.tasks.filter((task) => !task.inNotebook && task.city === city && task.columnId === columnId).sort((a, b) => a.boardOrder - b.boardOrder);
        const date = dateForColumn(columnId);
        const subtitle = date ? date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '') : columnId === 'month' ? 'дальше горизонта недели' : columnId === 'delegated' ? 'у команды' : columnId === 'done' ? 'архив результата' : 'из Матрицы';
        return <BoardColumn key={columnId} columnId={columnId} title={store.columnTitles[columnId]} subtitle={subtitle} current={columnId === dayColumnFromDate(new Date(now))} tasks={tasks} now={now} dragId={dragId} setDragId={setDragId} moveTask={moveTask} openSchedule={openSchedule} openDelegate={openDelegate} openDeadline={openDeadline} openTime={openTime} finishTask={finishTask} matrixAssignments={matrixAssignments} />;
      })}</div>
    </div>
    <div className="weekly-scroll-hint">← Входящие и вся неделя · правее: Месяц, Делегировано, Готово →</div>
  </main>;
}

function BoardColumn({ columnId, title, subtitle, current, tasks, now, dragId, setDragId, moveTask, openSchedule, openDelegate, openDeadline, openTime, finishTask, matrixAssignments }: {
  columnId: BoardColumnId; title: string; subtitle: string; current: boolean; tasks: Task[]; now: number; dragId: string | null; setDragId: (id: string | null) => void; moveTask: (id: string, column: BoardColumnId, beforeId?: string) => void; openSchedule: (id: string) => void; openDelegate: (id: string) => void; openDeadline: (id: string) => void; openTime: (id: string) => void; finishTask: (id: string) => void; matrixAssignments: MatrixAssignments;
}) {
  return <section className={`board-column column-${columnId} ${current ? 'is-current-day' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={() => dragId && moveTask(dragId, columnId)}>
    <div className="column-head"><div><strong>{title}</strong><small>{subtitle}</small></div><span>{tasks.length}</span></div>
    <div className="board-cards">{tasks.map((task) => {
      const overdue = task.deadline !== null && task.deadline < now;
      const delegated = columnId === 'delegated';
      const priority = priorityMeta(matrixAssignments[task.id]);
      const subtaskDone = task.subtasks.filter((item) => item.done).length;
      const planned = formatPlannedTime(task);
      return <article className={`board-card project-${task.project} ${delegated ? 'is-delegated-card' : ''} ${priority?.cls || ''}`} key={task.id} draggable onDragStart={() => setDragId(task.id)} onDragEnd={() => setDragId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); if (dragId && dragId !== task.id) moveTask(dragId, columnId, task.id); }}>
        {priority && <div className={`board-priority-chip ${priority.cls}`}><i />{priority.label}</div>}
        <div className="card-title">{task.title}</div>
        <div className="card-meta">
          {projectLabel(task.project) && <b>{projectLabel(task.project)}</b>}
          {task.subtasks.length > 0 && <span className="subtask-progress">✓ {subtaskDone}/{task.subtasks.length}</span>}
          {planned && <button type="button" className="planned-time" onClick={() => openTime(task.id)}>◷ {planned}</button>}
        </div>
        {delegated && <div className="delegated-wait-line">
          <span>{task.assignee ? `→ ${task.assignee}` : 'не назначено'}</span>
          <button type="button" className={overdue ? 'overdue' : ''} onClick={() => openDeadline(task.id)}>{task.deadline ? `${overdue ? 'просрочено' : 'до'} ${formatDeadlineShort(task.deadline)}` : '＋ дедлайн'}</button>
        </div>}
        {!delegated && task.deadline && <button type="button" className={`board-deadline ${overdue ? 'overdue' : ''}`} onClick={() => openDeadline(task.id)}>{overdue ? 'Просрочено' : 'До'} · {formatDeadlineShort(task.deadline)}</button>}
        <div className="card-last">{lastStep(task)}</div>
        <div className="card-actions">
          {columnId !== 'done' && DAY_COLUMNS.includes(columnId) && <button onClick={() => openSchedule(task.id)}>В тетрадь</button>}
          {columnId !== 'done' && !delegated && <button onClick={() => openDelegate(task.id)}>Делегировать</button>}
          {columnId !== 'done' && !delegated && <button onClick={() => openTime(task.id)}>Время</button>}
          {delegated && <button onClick={() => openDelegate(task.id)}>Кому</button>}
          {columnId !== 'done' && <button onClick={() => openDeadline(task.id)}>Дедлайн</button>}
          {columnId !== 'done' && <button onClick={() => finishTask(task.id)}>Готово</button>}
        </div>
      </article>;
    })}</div>
  </section>;
}

function DelegatedPage({ tasks, now, openDelegate }: { tasks: Task[]; now: number; openDelegate: (id: string) => void }) {
  const delegated = useMemo(() => tasks.filter((task) => task.columnId === 'delegated').sort((a, b) => (a.deadline ?? Number.MAX_SAFE_INTEGER) - (b.deadline ?? Number.MAX_SAFE_INTEGER)), [tasks]);
  const groups = useMemo(() => {
    const map = new Map<string, Task[]>();
    delegated.forEach((task) => {
      const person = task.assignee.trim() || 'Не назначено';
      map.set(person, [...(map.get(person) || []), task]);
    });
    return [...map.entries()];
  }, [delegated]);
  const overdueCount = delegated.filter((task) => task.deadline !== null && task.deadline < now).length;

  return <main className="people-page wait-page-v2 delegated-page">
    <div className="page-heading wait-heading">
      <div><h1>Делегировано</h1><p>Все задачи, где следующий ход сейчас у команды.</p></div>
      <div className="wait-summary"><strong>{delegated.length}</strong><span>у команды</span>{overdueCount > 0 && <><i /><strong>{overdueCount}</strong><span>просрочено</span></>}</div>
    </div>
    {groups.length === 0 ? <div className="wait-empty">Сейчас ничего не делегировано.</div> : <div className="wait-groups">{groups.map(([person, personTasks]) => {
      const overdue = personTasks.filter((task) => task.deadline !== null && task.deadline < now).length;
      return <section className="wait-person" key={person}>
        <header className="wait-person-head"><div className="person-avatar">{person.slice(0,1).toUpperCase()}</div><div><h2>{person}</h2><span>{personTasks.length} задач</span></div>{overdue > 0 && <em>{overdue} просрочено</em>}</header>
        <div className="wait-list">{personTasks.map((task) => {
          const due = task.deadline !== null && task.deadline < now;
          return <article className={`wait-row ${due ? 'is-due' : ''}`} key={task.id}>
            <div className="wait-row-marker" />
            <div className="wait-row-copy">
              <div className="wait-row-title"><strong>{task.title}</strong>{projectLabel(task.project) && <span>{projectLabel(task.project)}</span>}</div>
              <p>{lastStep(task)}</p>
              <small className={due ? 'due' : ''}>{task.deadline ? `${due ? 'Просрочено' : 'Дедлайн'} · ${formatDeadlineShort(task.deadline)}` : 'Без дедлайна'}</small>
            </div>
            <button className="wait-row-edit" onClick={() => openDelegate(task.id)}>Изменить</button>
          </article>;
        })}</div>
      </section>;
    })}</div>}
  </main>;
}

'''
between(start,end,board_code+end,"board/delegated pages")

# Add TimeModal before DelegateModal
marker="function DelegateModal("
time_modal=r'''function TimeModal({ task, close, save }: { task: Task; close: () => void; save: (start: number | null, end: number | null) => void }) {
  const base = new Date();
  const defaultStart = task.plannedStart ? toDateTimeLocal(task.plannedStart) : toDateTimeLocal(new Date(base.setHours(10,0,0,0)).getTime());
  const defaultEnd = task.plannedEnd ? toDateTimeLocal(task.plannedEnd) : '';
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  return <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="modal-card time-modal" onSubmit={(event) => { event.preventDefault(); save(fromDateTimeLocal(start), fromDateTimeLocal(end)); }}>
    <p>ВРЕМЯ ЗАДАЧИ</p><h2>{task.title}</h2>
    <label>Начало</label><input type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} />
    <label>Конец — необязательно</label><input type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} />
    <div className="modal-actions">{task.plannedStart && <button type="button" className="danger-link" onClick={() => save(null, null)}>Убрать время</button>}<button type="button" onClick={close}>Отмена</button><button className="primary">Сохранить</button></div>
  </form></div>;
}

'''
idx=s.find(marker)
if idx<0: raise SystemExit("delegate modal marker missing")
s=s[:idx]+time_modal+s[idx:]

# Delegate wording
s=s.replace("<p>ДЕЛЕГИРОВАНО = ЖДУ</p>","<p>ДЕЛЕГИРОВАНИЕ</p>",1)
s=s.replace("<label>Дедлайн / когда вернуть внимание</label>","<label>Дедлайн</label>",1)

p.write_text(s,encoding="utf-8")
print("patched App.tsx")
