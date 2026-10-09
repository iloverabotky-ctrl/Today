from pathlib import Path

def rep(s, old, new, label):
    if old not in s:
        raise SystemExit("missing "+label)
    return s.replace(old,new,1)

p=Path("src/App.tsx")
s=p.read_text(encoding="utf-8")

s=rep(s,
"import { MATRIX_ORIGIN_STORAGE_KEY, MATRIX_STORAGE_KEY, MatrixPage, loadMatrixAssignments, loadMatrixOrigins, type MatrixAssignments, type MatrixCityFilter, type MatrixOrigins, type MatrixQuadrant } from './matrix';",
"import { MATRIX_ORIGIN_STORAGE_KEY, MATRIX_STORAGE_KEY, MATRIX_TRANSFERRED_STORAGE_KEY, MatrixPage, loadMatrixAssignments, loadMatrixOrigins, loadMatrixTransferred, type MatrixAssignments, type MatrixCityFilter, type MatrixOrigins, type MatrixQuadrant, type MatrixTransferred } from './matrix';",
"matrix import")

s=rep(s,
"  const [matrixAssignments, setMatrixAssignments] = useState<MatrixAssignments>(loadMatrixAssignments);\n  const [matrixOrigins, setMatrixOrigins] = useState<MatrixOrigins>(loadMatrixOrigins);",
"""  const [matrixAssignments, setMatrixAssignments] = useState<MatrixAssignments>(loadMatrixAssignments);
  const [matrixOrigins, setMatrixOrigins] = useState<MatrixOrigins>(loadMatrixOrigins);
  const [matrixTransferred, setMatrixTransferred] = useState<MatrixTransferred>(() => {
    const loaded = loadMatrixTransferred();
    if (localStorage.getItem(MATRIX_TRANSFERRED_STORAGE_KEY) !== null) return loaded;
    const oldAssignments = loadMatrixAssignments();
    return Object.fromEntries(Object.keys(oldAssignments).map((id) => [id, true]));
  });""",
"matrix transferred state")

s=rep(s,
"  useEffect(() => localStorage.setItem(MATRIX_ORIGIN_STORAGE_KEY, JSON.stringify(matrixOrigins)), [matrixOrigins]);",
"""  useEffect(() => localStorage.setItem(MATRIX_ORIGIN_STORAGE_KEY, JSON.stringify(matrixOrigins)), [matrixOrigins]);
  useEffect(() => localStorage.setItem(MATRIX_TRANSFERRED_STORAGE_KEY, JSON.stringify(matrixTransferred)), [matrixTransferred]);""",
"matrix transferred persist")

old="""  const discardMatrixAssignment = (taskId: string) => {
    setMatrixAssignments((current) => {
      if (!current[taskId]) return current;
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    setMatrixOrigins((current) => {
      if (!current[taskId]) return current;
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  };

  const restoreMatrixAssignment = (taskId: string) => {
    const origin = matrixOrigins[taskId];
    if (origin) {
      setStore((current) => ({
        ...current,
        tasks: current.tasks.map((task) => task.id === taskId ? {
          ...task,
          columnId: origin.columnId,
          boardOrder: origin.boardOrder,
          inNotebook: origin.inNotebook,
          notebookOrder: origin.notebookOrder,
          notebookAt: origin.notebookAt,
          notebookCompleted: origin.notebookCompleted,
        } : task),
      }));
    }
    discardMatrixAssignment(taskId);
  };

  const assignMatrixTask = (taskId: string, quadrant: MatrixQuadrant) => {
    const snapshot = store.tasks.find((task) => task.id === taskId);
    if (snapshot && !matrixOrigins[taskId]) {
      setMatrixOrigins((current) => current[taskId] ? current : {
        ...current,
        [taskId]: {
          columnId: snapshot.columnId,
          boardOrder: snapshot.boardOrder,
          inNotebook: snapshot.inNotebook,
          notebookOrder: snapshot.notebookOrder,
          notebookAt: snapshot.notebookAt,
          notebookCompleted: snapshot.notebookCompleted,
        },
      });
    }
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
new="""  const discardMatrixAssignment = (taskId: string) => {
    setMatrixAssignments((current) => {
      if (!current[taskId]) return current;
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    setMatrixOrigins((current) => {
      if (!current[taskId]) return current;
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    setMatrixTransferred((current) => {
      if (!current[taskId]) return current;
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  };

  const assignMatrixTask = (taskId: string, quadrant: MatrixQuadrant) => {
    const snapshot = store.tasks.find((task) => task.id === taskId);
    if (!snapshot || snapshot.columnId !== 'pool' || snapshot.inNotebook || matrixTransferred[taskId]) return;
    if (!matrixOrigins[taskId]) {
      setMatrixOrigins((current) => current[taskId] ? current : {
        ...current,
        [taskId]: {
          columnId: snapshot.columnId,
          boardOrder: snapshot.boardOrder,
          inNotebook: snapshot.inNotebook,
          notebookOrder: snapshot.notebookOrder,
          notebookAt: snapshot.notebookAt,
          notebookCompleted: snapshot.notebookCompleted,
        },
      });
    }
    setMatrixAssignments((current) => ({ ...current, [taskId]: quadrant }));
  };

  const transferMatrixQuadrant = (quadrant: MatrixQuadrant, taskIds: string[]) => {
    const ids = new Set(taskIds);
    if (!ids.size) return;
    setStore((current) => {
      const counters = new Map<string, number>();
      const nextOrder = (columnId: ColumnId, city: CityId) => {
        const key = `${columnId}:${city}`;
        if (!counters.has(key)) counters.set(key, nextBoardOrder(current.tasks, columnId, city));
        const value = counters.get(key)!;
        counters.set(key, value + 1);
        return value;
      };
      return {
        ...current,
        tasks: current.tasks.map((task) => {
          if (!ids.has(task.id) || task.columnId !== 'pool' || task.inNotebook) return task;
          const targetColumn: ColumnId =
            quadrant === 'important-not-urgent'
              ? 'week'
              : quadrant === 'not-urgent-not-important'
                ? 'pool'
                : 'today';
          return {
            ...task,
            columnId: targetColumn,
            boardOrder: nextOrder(targetColumn, task.city),
            inNotebook: false,
            notebookAt: null,
            notebookCompleted: false,
            completedAt: null,
          };
        }),
      };
    });
    setMatrixTransferred((current) => {
      const next = { ...current };
      taskIds.forEach((id) => { next[id] = true; });
      return next;
    });
    setMatrixOrigins((current) => {
      const next = { ...current };
      taskIds.forEach((id) => { delete next[id]; });
      return next;
    });
  };

  const deleteMatrixTask = (taskId: string) => {
    setStore((current) => ({
      ...current,
      activeTaskId: current.activeTaskId === taskId ? null : current.activeTaskId,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));
    discardMatrixAssignment(taskId);
    if (taskFocusId === taskId) setTaskFocusId(null);
  };
"""
s=rep(s,old,new,"matrix actions")

s=rep(s,
"{page === 'board' && <BoardPage store={store} city={boardCity} setCity={setBoardCity} now={now} dragId={dragBoardId} setDragId={setDragBoardId} createTask={createTask} moveTask={moveBoardTask} openSchedule={setScheduleTaskId} openReminder={(id) => setReminderTarget({ taskId: id })} openDelegate={setDelegateTaskId} openDeadline={setDeadlineTaskId} finishTask={finishTask} matrixAssignments={matrixAssignments} openMatrix={() => setPage('matrix')} />}",
"{page === 'board' && <BoardPage store={store} city={boardCity} setCity={setBoardCity} now={now} dragId={dragBoardId} setDragId={setDragBoardId} createTask={createTask} moveTask={moveBoardTask} openSchedule={setScheduleTaskId} openReminder={(id) => setReminderTarget({ taskId: id })} openDelegate={setDelegateTaskId} openDeadline={setDeadlineTaskId} finishTask={finishTask} matrixAssignments={matrixAssignments} matrixTransferred={matrixTransferred} openMatrix={() => setPage('matrix')} />}",
"board render")

s=rep(s,
"{page === 'matrix' && <MatrixPage tasks={store.tasks} city={matrixCity} setCity={setMatrixCity} assignments={matrixAssignments} assignTask={assignMatrixTask} clearAssignment={restoreMatrixAssignment} createTask={(title, city, project) => createTask(title, 'pool', city, project)} updateTask={updateTask} addStep={addStep} openTask={openTaskDetails} />}",
"{page === 'matrix' && <MatrixPage tasks={store.tasks} city={matrixCity} setCity={setMatrixCity} assignments={matrixAssignments} transferred={matrixTransferred} assignTask={assignMatrixTask} clearAssignment={discardMatrixAssignment} transferQuadrant={transferMatrixQuadrant} createTask={(title, city, project) => createTask(title, 'pool', city, project)} updateTask={updateTask} addStep={addStep} deleteTask={deleteMatrixTask} openTask={openTaskDetails} />}",
"matrix render")

s=rep(s,
"function BoardPage({ store, city, setCity, now, dragId, setDragId, createTask, moveTask, openSchedule, openReminder, openDelegate, openDeadline, finishTask, matrixAssignments, openMatrix }: {\n  store: Store; city: CityId; setCity: (city: CityId) => void; now: number; dragId: string | null; setDragId: (id: string | null) => void; createTask: (title: string, column: ColumnId, city: CityId, project?: ProjectId) => string | null; moveTask: (id: string, column: BoardColumnId, beforeId?: string) => void; openSchedule: (id: string) => void; openReminder: (id: string) => void; openDelegate: (id: string) => void; openDeadline: (id: string) => void; finishTask: (id: string) => void; matrixAssignments: MatrixAssignments; openMatrix: () => void;\n}) {",
"function BoardPage({ store, city, setCity, now, dragId, setDragId, createTask, moveTask, openSchedule, openReminder, openDelegate, openDeadline, finishTask, matrixAssignments, matrixTransferred, openMatrix }: {\n  store: Store; city: CityId; setCity: (city: CityId) => void; now: number; dragId: string | null; setDragId: (id: string | null) => void; createTask: (title: string, column: ColumnId, city: CityId, project?: ProjectId) => string | null; moveTask: (id: string, column: BoardColumnId, beforeId?: string) => void; openSchedule: (id: string) => void; openReminder: (id: string) => void; openDelegate: (id: string) => void; openDeadline: (id: string) => void; finishTask: (id: string) => void; matrixAssignments: MatrixAssignments; matrixTransferred: MatrixTransferred; openMatrix: () => void;\n}) {",
"board signature")

s=rep(s,
"  const longboxCount = store.tasks.filter((task) => task.city === city && task.columnId === 'pool' && matrixAssignments[task.id] === 'not-urgent-not-important').length;",
"  const longboxCount = store.tasks.filter((task) => task.city === city && task.columnId === 'pool' && matrixTransferred[task.id] && matrixAssignments[task.id] === 'not-urgent-not-important').length;",
"longbox count")

p.write_text(s,encoding="utf-8")
print("patched App.tsx")
