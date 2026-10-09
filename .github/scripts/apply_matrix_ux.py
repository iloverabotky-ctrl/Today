from pathlib import Path

def rep(s, old, new, label):
    if old not in s:
        raise SystemExit("missing "+label)
    return s.replace(old,new,1)

def between(s, start, end, new, label):
    a=s.find(start)
    if a<0: raise SystemExit("missing start "+label)
    b=s.find(end,a)
    if b<0: raise SystemExit("missing end "+label)
    return s[:a]+new+s[b:]

p=Path("src/App.tsx")
s=p.read_text(encoding="utf-8")

s=rep(s,
"  const waitingTasks = useMemo(() => store.tasks.filter((task) => task.columnId !== 'done' && taskIsWaiting(task)), [store.tasks]);",
"""  const waitingTasks = useMemo(() => store.tasks.filter((task) => task.columnId !== 'done' && taskIsWaiting(task)), [store.tasks]);
  const matrixInboxCount = useMemo(() => store.tasks.filter((task) => task.columnId === 'pool' && !task.inNotebook && !matrixTransferred[task.id]).length, [store.tasks, matrixTransferred]);""",
"matrix counter")

old="""  const deleteMatrixTask = (taskId: string) => {
    setStore((current) => ({
      ...current,
      activeTaskId: current.activeTaskId === taskId ? null : current.activeTaskId,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));
    discardMatrixAssignment(taskId);
    if (taskFocusId === taskId) setTaskFocusId(null);
  };
"""
new="""  const deleteMatrixTask = (taskId: string) => {
    const snapshot = store.tasks.find((task) => task.id === taskId) || null;
    if (!snapshot) return null;
    setStore((current) => ({
      ...current,
      activeTaskId: current.activeTaskId === taskId ? null : current.activeTaskId,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));
    discardMatrixAssignment(taskId);
    if (taskFocusId === taskId) setTaskFocusId(null);
    return snapshot;
  };

  const restoreMatrixTask = (task: Task, quadrant?: MatrixQuadrant) => {
    setStore((current) => current.tasks.some((item) => item.id === task.id) ? current : { ...current, tasks: [...current.tasks, task] });
    setMatrixTransferred((current) => {
      if (!current[task.id]) return current;
      const next = { ...current };
      delete next[task.id];
      return next;
    });
    if (quadrant) setMatrixAssignments((current) => ({ ...current, [task.id]: quadrant }));
  };

  const returnLongboxToMatrix = (taskId: string) => {
    setMatrixTransferred((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    setMatrixAssignments((current) => {
      const next = { ...current };
      delete next[taskId];
      return next;
    });
    setPage('matrix');
  };
"""
s=rep(s,old,new,"delete restore")

s=rep(s,
"<button className={page === 'matrix' ? 'active' : ''} onClick={() => setPage('matrix')}>Матрица</button>",
"<button className={page === 'matrix' ? 'active' : ''} onClick={() => setPage('matrix')}>Матрица {matrixInboxCount > 0 && <span>{matrixInboxCount}</span>}</button>",
"matrix nav counter")

s=rep(s,
"{page === 'board' && <BoardPage store={store} city={boardCity} setCity={setBoardCity} now={now} dragId={dragBoardId} setDragId={setDragBoardId} createTask={createTask} moveTask={moveBoardTask} openSchedule={setScheduleTaskId} openReminder={(id) => setReminderTarget({ taskId: id })} openDelegate={setDelegateTaskId} openDeadline={setDeadlineTaskId} finishTask={finishTask} matrixAssignments={matrixAssignments} matrixTransferred={matrixTransferred} openMatrix={() => setPage('matrix')} />}",
"{page === 'board' && <BoardPage store={store} city={boardCity} setCity={setBoardCity} now={now} dragId={dragBoardId} setDragId={setDragBoardId} createTask={createTask} moveTask={moveBoardTask} openSchedule={setScheduleTaskId} openReminder={(id) => setReminderTarget({ taskId: id })} openDelegate={setDelegateTaskId} openDeadline={setDeadlineTaskId} finishTask={finishTask} matrixAssignments={matrixAssignments} matrixTransferred={matrixTransferred} returnToMatrix={returnLongboxToMatrix} />}",
"board render")

s=rep(s,
"{page === 'matrix' && <MatrixPage tasks={store.tasks} city={matrixCity} setCity={setMatrixCity} assignments={matrixAssignments} transferred={matrixTransferred} assignTask={assignMatrixTask} clearAssignment={discardMatrixAssignment} transferQuadrant={transferMatrixQuadrant} createTask={(title, city, project) => createTask(title, 'pool', city, project)} updateTask={updateTask} addStep={addStep} deleteTask={deleteMatrixTask} openTask={openTaskDetails} />}",
"{page === 'matrix' && <MatrixPage tasks={store.tasks} city={matrixCity} setCity={setMatrixCity} assignments={matrixAssignments} transferred={matrixTransferred} assignTask={assignMatrixTask} clearAssignment={discardMatrixAssignment} transferQuadrant={transferMatrixQuadrant} createTask={(title, city, project) => createTask(title, 'pool', city, project)} updateTask={updateTask} addStep={addStep} deleteTask={deleteMatrixTask} restoreTask={restoreMatrixTask} openTask={openTaskDetails} />}",
"matrix render")

board="""function BoardPage({ store, city, setCity, now, dragId, setDragId, createTask, moveTask, openSchedule, openReminder, openDelegate, openDeadline, finishTask, matrixAssignments, matrixTransferred, returnToMatrix }: {
  store: Store; city: CityId; setCity: (city: CityId) => void; now: number; dragId: string | null; setDragId: (id: string | null) => void; createTask: (title: string, column: ColumnId, city: CityId, project?: ProjectId) => string | null; moveTask: (id: string, column: BoardColumnId, beforeId?: string) => void; openSchedule: (id: string) => void; openReminder: (id: string) => void; openDelegate: (id: string) => void; openDeadline: (id: string) => void; finishTask: (id: string) => void; matrixAssignments: MatrixAssignments; matrixTransferred: MatrixTransferred; returnToMatrix: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [column, setColumn] = useState<BoardColumnId>('today');
  const [project, setProject] = useState<ProjectId>('none');
  const [longboxOpen, setLongboxOpen] = useState(false);
  const longboxTasks = store.tasks.filter((task) => task.city === city && task.columnId === 'pool' && matrixTransferred[task.id] && matrixAssignments[task.id] === 'not-urgent-not-important').sort((a, b) => a.boardOrder - b.boardOrder);
  const submit = () => { const id = createTask(title, column, city, project); if (!id) return; setTitle(''); if (column === 'delegated') window.setTimeout(() => openDelegate(id), 0); };

  return <main className="board-page v6-board">
    <div className="page-heading board-heading">
      <div><h1>Доска</h1><p>Отдельные горизонты СПб и Краснодара</p></div>
      <div className="board-heading-actions">
        <button type="button" className="board-longbox-link" onClick={() => setLongboxOpen(true)}>Долгий ящик · {longboxTasks.length}</button>
        <div className="city-switch"><button className={city === 'spb' ? 'active' : ''} onClick={() => setCity('spb')}>Санкт-Петербург</button><button className={city === 'krasnodar' ? 'active' : ''} onClick={() => setCity('krasnodar')}>Краснодар</button></div>
      </div>
    </div>
    <form className="board-big-add" onSubmit={(event) => { event.preventDefault(); submit(); }}><span>＋</span><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Добавить задачу на доску..." /><ProjectPicker value={project} setValue={setProject} /><select value={column} onChange={(event) => setColumn(event.target.value as BoardColumnId)}>{BOARD_COLUMNS.filter((item) => item !== 'done').map((item) => <option value={item} key={item}>{store.columnTitles[item]}</option>)}</select><button>Добавить задачу</button></form>
    <div className="board-scroll"><div className="board-grid">{BOARD_COLUMNS.map((columnId) => {
      const tasks = store.tasks.filter((task) => !task.inNotebook && task.city === city && task.columnId === columnId).sort((a, b) => a.boardOrder - b.boardOrder);
      return <BoardColumn key={columnId} columnId={columnId} title={store.columnTitles[columnId]} tasks={tasks} now={now} dragId={dragId} setDragId={setDragId} moveTask={moveTask} openSchedule={openSchedule} openReminder={openReminder} openDelegate={openDelegate} openDeadline={openDeadline} finishTask={finishTask} matrixAssignments={matrixAssignments} />;
    })}</div></div>

    {longboxOpen && <div className="longbox-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setLongboxOpen(false)}>
      <aside className="longbox-drawer">
        <div className="longbox-head"><div><h2>Долгий ящик</h2><p>Не срочно и не важно · не занимает место на основной Доске</p></div><button type="button" onClick={() => setLongboxOpen(false)}>×</button></div>
        {longboxTasks.length === 0 ? <div className="longbox-empty">Здесь пока ничего нет.</div> : <div className="longbox-list">{longboxTasks.map((task) => <article className="longbox-row" key={task.id}>
          <strong>{task.title}</strong>
          <small>{projectLabel(task.project) || 'Без проекта'}{task.deadline ? ` · до ${formatDeadlineShort(task.deadline)}` : ''}</small>
          <div className="longbox-actions">
            <button type="button" onClick={() => moveTask(task.id, 'today')}>Сегодня</button>
            <button type="button" onClick={() => moveTask(task.id, 'week')}>Неделя</button>
            <button type="button" onClick={() => moveTask(task.id, 'month')}>Месяц</button>
            <button type="button" onClick={() => { setLongboxOpen(false); returnToMatrix(task.id); }}>В Матрицу</button>
          </div>
        </article>)}</div>}
      </aside>
    </div>}
  </main>;
}

"""
s=between(s,"function BoardPage(","function BoardColumn(",board,"BoardPage")

p.write_text(s,encoding="utf-8")
print("patched App")
