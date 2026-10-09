from pathlib import Path

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing fragment: {label}")
    return text.replace(old, new, 1)

app_path = Path("src/App.tsx")
app = app_path.read_text(encoding="utf-8")

app = replace_once(
    app,
    "import { defaultColumnTitles, demo, STORAGE_KEY } from './data';\n",
    "import { defaultColumnTitles, demo, STORAGE_KEY } from './data';\nimport { MATRIX_STORAGE_KEY, MatrixPage, loadMatrixAssignments, type MatrixAssignments, type MatrixCityFilter, type MatrixQuadrant } from './matrix';\n",
    "matrix import",
)

app = replace_once(
    app,
    "type Page = 'notebook' | 'board' | 'people';",
    "type Page = 'notebook' | 'board' | 'matrix' | 'people';",
    "page union",
)

app = replace_once(
    app,
    "  const [boardCity, setBoardCity] = useState<CityId>('spb');\n  const [now, setNow] = useState(Date.now());",
    "  const [boardCity, setBoardCity] = useState<CityId>('spb');\n  const [matrixCity, setMatrixCity] = useState<MatrixCityFilter>('all');\n  const [matrixAssignments, setMatrixAssignments] = useState<MatrixAssignments>(loadMatrixAssignments);\n  const [now, setNow] = useState(Date.now());",
    "matrix state",
)

app = replace_once(
    app,
    "  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(store)), [store]);\n",
    "  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(store)), [store]);\n  useEffect(() => localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(matrixAssignments)), [matrixAssignments]);\n",
    "matrix persistence",
)

app = replace_once(
    app,
    "      if (event.altKey && event.key === '3') setPage('people');",
    "      if (event.altKey && event.key === '3') setPage('people');\n      if (event.altKey && event.key === '4') setPage('matrix');",
    "matrix hotkey",
)

anchor = "  const waitingTasks = useMemo(() => store.tasks.filter((task) => task.columnId !== 'done' && taskIsWaiting(task)), [store.tasks]);\n\n"
insert = """  const waitingTasks = useMemo(() => store.tasks.filter((task) => task.columnId !== 'done' && taskIsWaiting(task)), [store.tasks]);

  const clearMatrixAssignment = (taskId: string) => setMatrixAssignments((current) => {
    if (!current[taskId]) return current;
    const next = { ...current };
    delete next[taskId];
    return next;
  });

  const assignMatrixTask = (taskId: string, quadrant: MatrixQuadrant) => {
    setMatrixAssignments((current) => ({ ...current, [taskId]: quadrant }));
    setStore((current) => {
      const moving = current.tasks.find((task) => task.id === taskId);
      if (!moving || moving.columnId === 'done') return current;
      if (moving.columnId === 'delegated') return current;
      const targetColumn: ColumnId =
        quadrant === 'important-not-urgent'
          ? 'week'
          : quadrant === 'not-urgent-not-important'
            ? 'pool'
            : 'today';
      const targetOrder = nextBoardOrder(current.tasks, targetColumn, moving.city);
      return {
        ...current,
        activeTaskId: current.activeTaskId === taskId ? null : current.activeTaskId,
        tasks: current.tasks.map((task) => task.id === taskId ? {
          ...task,
          columnId: targetColumn,
          boardOrder: targetOrder,
          inNotebook: false,
          notebookAt: null,
          notebookCompleted: false,
          completedAt: null,
        } : task),
      };
    });
  };

"""
app = replace_once(app, anchor, insert, "matrix actions")

app = replace_once(
    app,
    "  const finishTask = (taskId: string) => setStore((current) => ({ ...current, activeTaskId: current.activeTaskId === taskId ? null : current.activeTaskId, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, columnId: 'done', inNotebook: false, notebookAt: null, notebookCompleted: false, completedAt: Date.now(), waitingPerson: '', returnAt: null } : task) }));",
    "  const finishTask = (taskId: string) => {\n    clearMatrixAssignment(taskId);\n    setStore((current) => ({ ...current, activeTaskId: current.activeTaskId === taskId ? null : current.activeTaskId, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, columnId: 'done', inNotebook: false, notebookAt: null, notebookCompleted: false, completedAt: Date.now(), waitingPerson: '', returnAt: null } : task) }));\n  };",
    "finish task clears matrix",
)

app = replace_once(
    app,
    "  const moveBoardTask = (taskId: string, targetColumn: BoardColumnId, beforeId?: string) => {\n    let shouldChooseDelegate = false;",
    "  const moveBoardTask = (taskId: string, targetColumn: BoardColumnId, beforeId?: string) => {\n    let shouldChooseDelegate = false;\n    let changedColumn = false;",
    "board move tracking",
)

app = replace_once(
    app,
    "      const moving = current.tasks.find((task) => task.id === taskId); if (!moving) return current;\n      shouldChooseDelegate = targetColumn === 'delegated' && moving.columnId !== 'delegated';",
    "      const moving = current.tasks.find((task) => task.id === taskId); if (!moving) return current;\n      changedColumn = moving.columnId !== targetColumn;\n      shouldChooseDelegate = targetColumn === 'delegated' && moving.columnId !== 'delegated';",
    "board change detection",
)

app = replace_once(
    app,
    "    if (shouldChooseDelegate) window.setTimeout(() => setDelegateTaskId(taskId), 0);\n  };\n  const reorderNotebook",
    "    if (changedColumn) clearMatrixAssignment(taskId);\n    if (shouldChooseDelegate) window.setTimeout(() => setDelegateTaskId(taskId), 0);\n  };\n  const reorderNotebook",
    "board move clears matrix",
)

app = replace_once(
    app,
    "  const openTaskFocus = (taskId: string) => { setStore((current) => ({ ...current, activeTaskId: taskId })); setTaskFocusId(taskId); };",
    "  const openTaskFocus = (taskId: string) => { setStore((current) => ({ ...current, activeTaskId: taskId })); setTaskFocusId(taskId); };\n  const openTaskDetails = (taskId: string) => setTaskFocusId(taskId);",
    "non-focus task details",
)

app = replace_once(
    app,
    "        <button className={page === 'board' ? 'active' : ''} onClick={() => setPage('board')}>Доска</button>\n        <button className={page === 'people' ? 'active' : ''} onClick={() => setPage('people')}>Жду <span>{waitingTasks.length}</span></button>",
    "        <button className={page === 'board' ? 'active' : ''} onClick={() => setPage('board')}>Доска</button>\n        <button className={page === 'matrix' ? 'active' : ''} onClick={() => setPage('matrix')}>Матрица</button>\n        <button className={page === 'people' ? 'active' : ''} onClick={() => setPage('people')}>Жду <span>{waitingTasks.length}</span></button>",
    "matrix nav",
)

app = replace_once(
    app,
    "    {page === 'board' && <BoardPage store={store} city={boardCity} setCity={setBoardCity} now={now} dragId={dragBoardId} setDragId={setDragBoardId} createTask={createTask} moveTask={moveBoardTask} openSchedule={setScheduleTaskId} openReminder={(id) => setReminderTarget({ taskId: id })} openDelegate={setDelegateTaskId} finishTask={finishTask} />}\n    {page === 'people'",
    "    {page === 'board' && <BoardPage store={store} city={boardCity} setCity={setBoardCity} now={now} dragId={dragBoardId} setDragId={setDragBoardId} createTask={createTask} moveTask={moveBoardTask} openSchedule={setScheduleTaskId} openReminder={(id) => setReminderTarget({ taskId: id })} openDelegate={setDelegateTaskId} finishTask={finishTask} matrixAssignments={matrixAssignments} openMatrix={() => setPage('matrix')} />}\n    {page === 'matrix' && <MatrixPage tasks={store.tasks} city={matrixCity} setCity={setMatrixCity} assignments={matrixAssignments} assignTask={assignMatrixTask} clearAssignment={clearMatrixAssignment} createTask={(title, city, project) => createTask(title, 'pool', city, project)} updateTask={updateTask} addStep={addStep} openTask={openTaskDetails} />}\n    {page === 'people'",
    "matrix render",
)

app = replace_once(
    app,
    "    {focusTask && <TaskFocusView task={focusTask} now={now} close={() => setTaskFocusId(null)}",
    "    {focusTask && <TaskFocusView task={focusTask} now={now} backLabel={page === 'matrix' ? '← Вернуться в Матрицу' : '← Вернуться в Тетрадь'} close={() => setTaskFocusId(null)}",
    "focus view back label prop",
)

app = replace_once(
    app,
    "function TaskFocusView({ task, now, close, updateTask, addStep, updateStep, deleteStep, openReminder, toggleCompleted, finishTask }: {\n  task: Task; now: number; close: () => void;",
    "function TaskFocusView({ task, now, backLabel, close, updateTask, addStep, updateStep, deleteStep, openReminder, toggleCompleted, finishTask }: {\n  task: Task; now: number; backLabel: string; close: () => void;",
    "focus view signature",
)

app = replace_once(
    app,
    '<div className="task-focus-top"><button className="task-focus-back" onClick={close}>← Вернуться в Тетрадь</button><span className="task-focus-mode">Одна задача · без отвлечений</span></div>',
    '<div className="task-focus-top"><button className="task-focus-back" onClick={close}>{backLabel}</button><span className="task-focus-mode">Одна задача · без отвлечений</span></div>',
    "focus view button",
)

app = replace_once(
    app,
    "function BoardPage({ store, city, setCity, now, dragId, setDragId, createTask, moveTask, openSchedule, openReminder, openDelegate, finishTask }: {\n  store: Store; city: CityId; setCity: (city: CityId) => void; now: number; dragId: string | null; setDragId: (id: string | null) => void; createTask: (title: string, column: ColumnId, city: CityId, project?: ProjectId) => string | null; moveTask: (id: string, column: BoardColumnId, beforeId?: string) => void; openSchedule: (id: string) => void; openReminder: (id: string) => void; openDelegate: (id: string) => void; finishTask: (id: string) => void;\n}) {",
    "function BoardPage({ store, city, setCity, now, dragId, setDragId, createTask, moveTask, openSchedule, openReminder, openDelegate, finishTask, matrixAssignments, openMatrix }: {\n  store: Store; city: CityId; setCity: (city: CityId) => void; now: number; dragId: string | null; setDragId: (id: string | null) => void; createTask: (title: string, column: ColumnId, city: CityId, project?: ProjectId) => string | null; moveTask: (id: string, column: BoardColumnId, beforeId?: string) => void; openSchedule: (id: string) => void; openReminder: (id: string) => void; openDelegate: (id: string) => void; finishTask: (id: string) => void; matrixAssignments: MatrixAssignments; openMatrix: () => void;\n}) {",
    "board page props",
)

app = replace_once(
    app,
    "  const [title, setTitle] = useState(''); const [column, setColumn] = useState<BoardColumnId>('today'); const [project, setProject] = useState<ProjectId>('none');\n  const submit = () => { const id = createTask(title, column, city, project); if (!id) return; setTitle(''); if (column === 'delegated') window.setTimeout(() => openDelegate(id), 0); };\n  return <main className=\"board-page v6-board\"><div className=\"page-heading board-heading\"><div><h1>Доска</h1><p>Отдельные горизонты СПб и Краснодара</p></div><div className=\"city-switch\">",
    "  const [title, setTitle] = useState(''); const [column, setColumn] = useState<BoardColumnId>('today'); const [project, setProject] = useState<ProjectId>('none');\n  const longboxCount = store.tasks.filter((task) => task.city === city && task.columnId === 'pool' && matrixAssignments[task.id] === 'not-urgent-not-important').length;\n  const submit = () => { const id = createTask(title, column, city, project); if (!id) return; setTitle(''); if (column === 'delegated') window.setTimeout(() => openDelegate(id), 0); };\n  return <main className=\"board-page v6-board\"><div className=\"page-heading board-heading\"><div><h1>Доска</h1><p>Отдельные горизонты СПб и Краснодара</p></div><div className=\"board-heading-actions\"><button type=\"button\" className=\"board-longbox-link\" onClick={openMatrix}>Долгий ящик · {longboxCount}</button><div className=\"city-switch\">",
    "board heading longbox",
)

app = replace_once(
    app,
    "</button></div></div>\n    <form className=\"board-big-add\"",
    "</button></div></div></div>\n    <form className=\"board-big-add\"",
    "board heading wrapper close",
)

app = replace_once(
    app,
    "      return <BoardColumn key={columnId} columnId={columnId} title={store.columnTitles[columnId]} tasks={tasks} now={now} dragId={dragId} setDragId={setDragId} moveTask={moveTask} openSchedule={openSchedule} openReminder={openReminder} openDelegate={openDelegate} finishTask={finishTask} />;",
    "      return <BoardColumn key={columnId} columnId={columnId} title={store.columnTitles[columnId]} tasks={tasks} now={now} dragId={dragId} setDragId={setDragId} moveTask={moveTask} openSchedule={openSchedule} openReminder={openReminder} openDelegate={openDelegate} finishTask={finishTask} matrixAssignments={matrixAssignments} />;",
    "board column assignments prop",
)

app = replace_once(
    app,
    "function BoardColumn({ columnId, title, tasks, now, dragId, setDragId, moveTask, openSchedule, openReminder, openDelegate, finishTask }: { columnId: BoardColumnId; title: string; tasks: Task[]; now: number; dragId: string | null; setDragId: (id: string | null) => void; moveTask: (id: string, column: BoardColumnId, beforeId?: string) => void; openSchedule: (id: string) => void; openReminder: (id: string) => void; openDelegate: (id: string) => void; finishTask: (id: string) => void; }) {",
    "function BoardColumn({ columnId, title, tasks, now, dragId, setDragId, moveTask, openSchedule, openReminder, openDelegate, finishTask, matrixAssignments }: { columnId: BoardColumnId; title: string; tasks: Task[]; now: number; dragId: string | null; setDragId: (id: string | null) => void; moveTask: (id: string, column: BoardColumnId, beforeId?: string) => void; openSchedule: (id: string) => void; openReminder: (id: string) => void; openDelegate: (id: string) => void; finishTask: (id: string) => void; matrixAssignments: MatrixAssignments; }) {",
    "board column signature",
)

app = replace_once(
    app,
    "    const waiting = taskIsWaiting(task); const overdue = task.deadline !== null && task.deadline < now;\n    return <article className={`board-card project-${task.project} ${waiting ? 'is-waiting' : ''}`}",
    "    const waiting = taskIsWaiting(task); const overdue = task.deadline !== null && task.deadline < now; const operational = columnId === 'today' && matrixAssignments[task.id] === 'urgent-not-important';\n    return <article className={`board-card project-${task.project} ${waiting ? 'is-waiting' : ''} ${operational ? 'is-operational' : ''}`}",
    "operational board class",
)

app = replace_once(
    app,
    '<div className="card-meta">{projectLabel(task.project) && <b>{projectLabel(task.project)}</b>}{task.assignee && <span>→ {task.assignee}</span>}{waiting && <span className="wait-chip">ЖДУ</span>}</div>',
    '<div className="card-meta">{projectLabel(task.project) && <b>{projectLabel(task.project)}</b>}{operational && <span className="operation-chip">ОП</span>}{task.assignee && <span>→ {task.assignee}</span>}{waiting && <span className="wait-chip">ЖДУ</span>}</div>',
    "operation chip",
)

app_path.write_text(app, encoding="utf-8")

main_path = Path("src/main.tsx")
main = main_path.read_text(encoding="utf-8")
main = replace_once(
    main,
    "import './notebook-v5-inspector-refine.css';\n",
    "import './notebook-v5-inspector-refine.css';\nimport './matrix.css';\n",
    "matrix css import",
)
main_path.write_text(main, encoding="utf-8")
print("Matrix integration patched")
