from pathlib import Path

def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing fragment: {label}")
    return text.replace(old, new, 1)

def replace_between(text, start, end, new, label):
    a=text.find(start)
    if a<0: raise SystemExit(f"Missing start: {label}")
    b=text.find(end,a)
    if b<0: raise SystemExit(f"Missing end: {label}")
    return text[:a]+new+text[b:]

p=Path("src/App.tsx")
s=p.read_text(encoding="utf-8")

s=replace_once(
s,
"import { MATRIX_STORAGE_KEY, MatrixPage, loadMatrixAssignments, type MatrixAssignments, type MatrixCityFilter, type MatrixQuadrant } from './matrix';",
"import { MATRIX_ORIGIN_STORAGE_KEY, MATRIX_STORAGE_KEY, MatrixPage, loadMatrixAssignments, loadMatrixOrigins, type MatrixAssignments, type MatrixCityFilter, type MatrixOrigins, type MatrixQuadrant } from './matrix';",
"matrix imports")

s=replace_once(
s,
"const formatDateTime = (timestamp: number | null) => timestamp ? new Date(timestamp).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'без даты';",
"""const formatDateTime = (timestamp: number | null) => timestamp ? new Date(timestamp).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'без даты';
const formatDeadlineShort = (timestamp: number | null) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${day} · ${time}`;
};""",
"deadline formatter")

s=replace_once(
s,
"  const [matrixAssignments, setMatrixAssignments] = useState<MatrixAssignments>(loadMatrixAssignments);\n  const [now, setNow] = useState(Date.now());",
"  const [matrixAssignments, setMatrixAssignments] = useState<MatrixAssignments>(loadMatrixAssignments);\n  const [matrixOrigins, setMatrixOrigins] = useState<MatrixOrigins>(loadMatrixOrigins);\n  const [now, setNow] = useState(Date.now());",
"matrix origin state")

s=replace_once(
s,
"  const [scheduleTaskId, setScheduleTaskId] = useState<string | null>(null);\n  const [taskFocusId, setTaskFocusId] = useState<string | null>(null);",
"  const [scheduleTaskId, setScheduleTaskId] = useState<string | null>(null);\n  const [deadlineTaskId, setDeadlineTaskId] = useState<string | null>(null);\n  const [taskFocusId, setTaskFocusId] = useState<string | null>(null);",
"deadline state")

s=replace_once(
s,
"  useEffect(() => localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(matrixAssignments)), [matrixAssignments]);",
"  useEffect(() => localStorage.setItem(MATRIX_STORAGE_KEY, JSON.stringify(matrixAssignments)), [matrixAssignments]);\n  useEffect(() => localStorage.setItem(MATRIX_ORIGIN_STORAGE_KEY, JSON.stringify(matrixOrigins)), [matrixOrigins]);",
"origin persistence")

s=replace_once(
s,
"      if (event.key === 'Escape') { setQuickOpen(false); setReminderTarget(null); setDelegateTaskId(null); setScheduleTaskId(null); setTaskFocusId(null); }",
"      if (event.key === 'Escape') { setQuickOpen(false); setReminderTarget(null); setDelegateTaskId(null); setScheduleTaskId(null); setDeadlineTaskId(null); setTaskFocusId(null); }",
"escape deadline")

old_block="""  const clearMatrixAssignment = (taskId: string) => setMatrixAssignments((current) => {
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
new_block="""  const discardMatrixAssignment = (taskId: string) => {
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
s=replace_once(s,old_block,new_block,"matrix origin actions")

s=replace_once(
s,
"  const moveToNotebook = (taskId: string, at: number) => setStore((current) => ({ ...current, activeTaskId: current.activeTaskId, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, inNotebook: true, notebookAt: at, notebookCompleted: false, notebookOrder: task.inNotebook ? task.notebookOrder : nextNotebookOrder(current.tasks), columnId: 'today', completedAt: null } : task) }));",
"""  const moveToNotebook = (taskId: string, at: number) => {
    discardMatrixAssignment(taskId);
    setStore((current) => ({ ...current, activeTaskId: current.activeTaskId, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, inNotebook: true, notebookAt: at, notebookCompleted: false, notebookOrder: task.inNotebook ? task.notebookOrder : nextNotebookOrder(current.tasks), columnId: 'today', completedAt: null } : task) }));
  };""",
"move to notebook discard")

s=replace_once(
s,
"  const moveNotebookToBoard = (taskId: string, columnId: BoardColumnId) => {\n    setStore",
"  const moveNotebookToBoard = (taskId: string, columnId: BoardColumnId) => {\n    discardMatrixAssignment(taskId);\n    setStore",
"notebook to board discard")

s=s.replace("    clearMatrixAssignment(taskId);\n    setStore((current) => ({ ...current, activeTaskId", "    discardMatrixAssignment(taskId);\n    setStore((current) => ({ ...current, activeTaskId",1)
s=s.replace("    if (changedColumn) clearMatrixAssignment(taskId);", "    if (changedColumn) discardMatrixAssignment(taskId);",1)

s=replace_once(
s,
"  const saveDelegation = (taskId: string, assignee: string, deadline: number | null, newPerson?: string) => {\n    const person = (newPerson || assignee).trim();",
"  const saveDelegation = (taskId: string, assignee: string, deadline: number | null, newPerson?: string) => {\n    discardMatrixAssignment(taskId);\n    const person = (newPerson || assignee).trim();",
"delegation discard")

s=replace_once(
s,
"  const scheduleTask = scheduleTaskId ? store.tasks.find((task) => task.id === scheduleTaskId) || null : null;",
"  const scheduleTask = scheduleTaskId ? store.tasks.find((task) => task.id === scheduleTaskId) || null : null;\n  const deadlineTask = deadlineTaskId ? store.tasks.find((task) => task.id === deadlineTaskId) || null : null;",
"deadline task derived")

s=replace_once(
s,
"openDelegate={setDelegateTaskId} finishTask={finishTask} matrixAssignments={matrixAssignments} openMatrix={() => setPage('matrix')}",
"openDelegate={setDelegateTaskId} openDeadline={setDeadlineTaskId} finishTask={finishTask} matrixAssignments={matrixAssignments} openMatrix={() => setPage('matrix')}",
"board deadline prop render")

s=replace_once(
s,
"assignments={matrixAssignments} assignTask={assignMatrixTask} clearAssignment={clearMatrixAssignment}",
"assignments={matrixAssignments} assignTask={assignMatrixTask} clearAssignment={restoreMatrixAssignment}",
"matrix restore prop")

s=replace_once(
s,
"    {scheduleTask && <NotebookScheduleModal task={scheduleTask} close={() => setScheduleTaskId(null)} save={(at) => { moveToNotebook(scheduleTask.id, at); setScheduleTaskId(null); }} />}\n",
"""    {scheduleTask && <NotebookScheduleModal task={scheduleTask} close={() => setScheduleTaskId(null)} save={(at) => { moveToNotebook(scheduleTask.id, at); setScheduleTaskId(null); }} />}
    {deadlineTask && <DeadlineModal task={deadlineTask} close={() => setDeadlineTaskId(null)} save={(at) => {
      updateTask(deadlineTask.id, deadlineTask.columnId === 'delegated' ? { deadline: at, returnAt: at } : { deadline: at });
      setDeadlineTaskId(null);
    }} />}
""",
"deadline modal render")

board_page="""function BoardPage({ store, city, setCity, now, dragId, setDragId, createTask, moveTask, openSchedule, openReminder, openDelegate, openDeadline, finishTask, matrixAssignments, openMatrix }: {
  store: Store; city: CityId; setCity: (city: CityId) => void; now: number; dragId: string | null; setDragId: (id: string | null) => void; createTask: (title: string, column: ColumnId, city: CityId, project?: ProjectId) => string | null; moveTask: (id: string, column: BoardColumnId, beforeId?: string) => void; openSchedule: (id: string) => void; openReminder: (id: string) => void; openDelegate: (id: string) => void; openDeadline: (id: string) => void; finishTask: (id: string) => void; matrixAssignments: MatrixAssignments; openMatrix: () => void;
}) {
  const [title, setTitle] = useState(''); const [column, setColumn] = useState<BoardColumnId>('today'); const [project, setProject] = useState<ProjectId>('none');
  const longboxCount = store.tasks.filter((task) => task.city === city && task.columnId === 'pool' && matrixAssignments[task.id] === 'not-urgent-not-important').length;
  const submit = () => { const id = createTask(title, column, city, project); if (!id) return; setTitle(''); if (column === 'delegated') window.setTimeout(() => openDelegate(id), 0); };
  return <main className="board-page v6-board"><div className="page-heading board-heading"><div><h1>Доска</h1><p>Отдельные горизонты СПб и Краснодара</p></div><div className="board-heading-actions"><button type="button" className="board-longbox-link" onClick={openMatrix}>Долгий ящик · {longboxCount}</button><div className="city-switch"><button className={city === 'spb' ? 'active' : ''} onClick={() => setCity('spb')}>Санкт-Петербург</button><button className={city === 'krasnodar' ? 'active' : ''} onClick={() => setCity('krasnodar')}>Краснодар</button></div></div></div>
    <form className="board-big-add" onSubmit={(event) => { event.preventDefault(); submit(); }}><span>＋</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Добавить задачу на доску..." /><ProjectPicker value={project} setValue={setProject} /><select value={column} onChange={(event) => setColumn(event.target.value as BoardColumnId)}>{BOARD_COLUMNS.filter((item) => item !== 'done').map((item) => <option value={item} key={item}>{store.columnTitles[item]}</option>)}</select><button>Добавить задачу</button></form>
    <div className="board-scroll"><div className="board-grid">{BOARD_COLUMNS.map((columnId) => {
      const tasks = store.tasks.filter((task) => !task.inNotebook && task.city === city && task.columnId === columnId).sort((a, b) => a.boardOrder - b.boardOrder);
      return <BoardColumn key={columnId} columnId={columnId} title={store.columnTitles[columnId]} tasks={tasks} now={now} dragId={dragId} setDragId={setDragId} moveTask={moveTask} openSchedule={openSchedule} openReminder={openReminder} openDelegate={openDelegate} openDeadline={openDeadline} finishTask={finishTask} matrixAssignments={matrixAssignments} />;
    })}</div></div>
  </main>;
}

"""
s=replace_between(s,"function BoardPage(","function BoardColumn(",board_page,"board page")

board_col="""function BoardColumn({ columnId, title, tasks, now, dragId, setDragId, moveTask, openSchedule, openReminder, openDelegate, openDeadline, finishTask, matrixAssignments }: { columnId: BoardColumnId; title: string; tasks: Task[]; now: number; dragId: string | null; setDragId: (id: string | null) => void; moveTask: (id: string, column: BoardColumnId, beforeId?: string) => void; openSchedule: (id: string) => void; openReminder: (id: string) => void; openDelegate: (id: string) => void; openDeadline: (id: string) => void; finishTask: (id: string) => void; matrixAssignments: MatrixAssignments; }) {
  return <section className={`board-column column-${columnId}`} onDragOver={(event) => event.preventDefault()} onDrop={() => dragId && moveTask(dragId, columnId)}><div className="column-head"><strong>{title}</strong><span>{tasks.length}</span></div><div className="board-cards">{tasks.map((task) => {
    const waiting = taskIsWaiting(task);
    const overdue = task.deadline !== null && task.deadline < now;
    const operational = columnId === 'today' && matrixAssignments[task.id] === 'urgent-not-important';
    const delegated = columnId === 'delegated';
    const waitingPerson = task.waitingPerson.trim() || task.assignee.trim();
    return <article className={`board-card project-${task.project} ${waiting ? 'is-waiting' : ''} ${operational ? 'is-operational' : ''} ${delegated ? 'is-delegated-card' : ''}`} key={task.id} draggable onDragStart={() => setDragId(task.id)} onDragEnd={() => setDragId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); if (dragId && dragId !== task.id) moveTask(dragId, columnId, task.id); }}>
      <div className="card-title">{task.title}</div>
      <div className="card-meta">
        {projectLabel(task.project) && <b>{projectLabel(task.project)}</b>}
        {operational && <span className="operation-chip">ОП</span>}
        {!delegated && task.assignee && <span>→ {task.assignee}</span>}
        {!delegated && waiting && <span className="wait-chip">ЖДУ</span>}
      </div>
      {delegated && <div className="delegated-wait-line">
        <span>ЖДУ · {waitingPerson || 'не назначено'}</span>
        <button type="button" className={overdue ? 'overdue' : ''} onClick={() => openDeadline(task.id)}>{task.deadline ? `${overdue ? 'просрочено' : 'до'} ${formatDeadlineShort(task.deadline)}` : '＋ дедлайн'}</button>
      </div>}
      {!delegated && task.deadline && <button type="button" className={`board-deadline ${overdue ? 'overdue' : ''}`} onClick={() => openDeadline(task.id)}>{overdue ? 'Просрочено' : 'До'} · {formatDeadlineShort(task.deadline)}</button>}
      <div className="card-last">{lastStep(task)}</div>
      <div className="card-actions">
        {columnId !== 'done' && <button onClick={() => openSchedule(task.id)}>В тетрадь</button>}
        {columnId !== 'done' && !delegated && <button onClick={() => openReminder(task.id)}>Жду</button>}
        {delegated && <button onClick={() => openDelegate(task.id)}>Кому</button>}
        {columnId !== 'done' && <button onClick={() => openDeadline(task.id)}>Срок</button>}
        {columnId !== 'done' && <button onClick={() => finishTask(task.id)}>Готово</button>}
      </div>
    </article>;
  })}</div></section>;
}

"""
s=replace_between(s,"function BoardColumn(","function PeoplePage(",board_col,"board column")

people="""function PeoplePage({ tasks, now, openReminder }: { tasks: Task[]; now: number; openReminder: (target: ReminderTarget) => void }) {
  const items = useMemo(() => {
    const result: Array<{ id: string; person: string; task: Task; step?: TaskStep; at: number | null }> = [];
    tasks.filter((task) => task.columnId !== 'done').forEach((task) => {
      const taskPerson = task.waitingPerson.trim() || (task.columnId === 'delegated' ? task.assignee.trim() : '');
      const taskAt = task.returnAt ?? (task.columnId === 'delegated' ? task.deadline : null);
      if (taskPerson) result.push({ id: `task-${task.id}`, person: taskPerson, task, at: taskAt });
      task.steps.filter((step) => step.waitingPerson.trim()).forEach((step) => result.push({ id: `step-${task.id}-${step.id}`, person: step.waitingPerson.trim(), task, step, at: step.remindAt }));
    });
    return result.sort((a, b) => {
      const aDue = a.at !== null && a.at <= now ? 0 : 1;
      const bDue = b.at !== null && b.at <= now ? 0 : 1;
      if (aDue !== bDue) return aDue - bDue;
      return (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER);
    });
  }, [tasks, now]);
  const groups = useMemo(() => {
    const map = new Map<string, typeof items>();
    items.forEach((item) => map.set(item.person, [...(map.get(item.person) || []), item]));
    return [...map.entries()];
  }, [items]);
  const dueCount = items.filter((item) => item.at !== null && item.at <= now).length;

  return <main className="people-page wait-page-v2">
    <div className="page-heading wait-heading">
      <div><h1>Жду</h1><p>То, где следующий ход сейчас не у тебя.</p></div>
      <div className="wait-summary"><strong>{items.length}</strong><span>в ожидании</span>{dueCount > 0 && <><i /><strong>{dueCount}</strong><span>пора вернуть</span></>}</div>
    </div>
    {groups.length === 0 ? <div className="wait-empty">Сейчас ни от кого ничего не ждёшь.</div> : <div className="wait-groups">{groups.map(([person, personItems]) => {
      const personDue = personItems.filter((item) => item.at !== null && item.at <= now).length;
      return <section className="wait-person" key={person}>
        <header className="wait-person-head"><div className="person-avatar">{person.slice(0, 1).toUpperCase()}</div><div><h2>{person}</h2><span>{personItems.length} {personItems.length === 1 ? 'задача' : 'задачи'}</span></div>{personDue > 0 && <em>{personDue} пора вернуть</em>}</header>
        <div className="wait-list">{personItems.map((item) => {
          const due = item.at !== null && item.at <= now;
          return <article className={`wait-row ${due ? 'is-due' : ''}`} key={item.id}>
            <div className="wait-row-marker" />
            <div className="wait-row-copy">
              <div className="wait-row-title"><strong>{item.task.title}</strong>{projectLabel(item.task.project) && <span>{projectLabel(item.task.project)}</span>}</div>
              {item.step && <p><span>↳</span>{item.step.text}</p>}
              <small className={due ? 'due' : ''}>{item.at ? `${due ? 'Пора вернуть' : 'Вернуть'} · ${formatDeadlineShort(item.at)}` : 'Без даты возврата'}</small>
            </div>
            <button className="wait-row-edit" onClick={() => openReminder({ taskId: item.task.id, stepId: item.step?.id })}>Изменить</button>
          </article>;
        })}</div>
      </section>;
    })}</div>}
  </main>;
}

"""
s=replace_between(s,"function PeoplePage(","function ReminderModal(",people,"people page")

deadline_modal="""function DeadlineModal({ task, close, save }: { task: Task; close: () => void; save: (at: number | null) => void }) {
  const [when, setWhen] = useState(toDateTimeLocal(task.deadline));
  const quick = (days: number, hour: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);
    setWhen(toDateTimeLocal(date.getTime()));
  };
  return <div className="modal-overlay" onMouseDown={(event) => event.target === event.currentTarget && close()}><form className="modal-card deadline-modal" onSubmit={(event) => { event.preventDefault(); save(fromDateTimeLocal(when)); }}>
    <p>ДЕДЛАЙН</p>
    <h2>{task.title}</h2>
    <div className="return-options"><button type="button" onClick={() => quick(0, 18)}>сегодня 18:00</button><button type="button" onClick={() => quick(1, 12)}>завтра 12:00</button><button type="button" onClick={() => quick(3, 12)}>через 3 дня</button></div>
    <input className="datetime-return-input" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
    <div className="modal-actions">{task.deadline && <button type="button" className="danger-link" onClick={() => save(null)}>Убрать срок</button>}<button type="button" onClick={close}>Отмена</button><button className="primary">Сохранить</button></div>
  </form></div>;
}

"""
s=s.replace("function DelegateModal(",deadline_modal+"function DelegateModal(",1)

p.write_text(s,encoding="utf-8")
print("App patched")
