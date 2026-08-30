from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()

old_sort = """  const notebookReady = useMemo(() => store.tasks.filter((task) => task.inNotebook && task.columnId !== 'done' && (task.notebookAt === null || task.notebookAt <= now)).sort((a, b) => {\n    if (a.notebookCompleted !== b.notebookCompleted) return a.notebookCompleted ? 1 : -1;\n    return a.notebookOrder - b.notebookOrder;\n  }), [store.tasks, now]);"""
new_sort = """  const notebookReady = useMemo(() => store.tasks.filter((task) => task.inNotebook && task.columnId !== 'done' && (task.notebookAt === null || task.notebookAt <= now)).sort((a, b) => {\n    if (a.notebookCompleted !== b.notebookCompleted) return a.notebookCompleted ? 1 : -1;\n    if (!a.notebookCompleted && !b.notebookCompleted) {\n      if (a.id === store.activeTaskId && b.id !== store.activeTaskId) return -1;\n      if (b.id === store.activeTaskId && a.id !== store.activeTaskId) return 1;\n    }\n    return a.notebookOrder - b.notebookOrder;\n  }), [store.tasks, store.activeTaskId, now]);"""
if old_sort not in text:
    raise SystemExit('Notebook sort block not found')
text = text.replace(old_sort, new_sort, 1)

page_start = text.index('function NotebookPage(')
row_start = text.index('function NotebookRow(', page_start)
focus_start = text.index('function TaskFocusView(', row_start)

notebook_page = r'''function NotebookPage({ tasks, upcoming, activeTaskId, dueItems, now, dragId, setDragId, createTask, updateTask, addStep, updateStep, deleteStep, openTask, requestActivate, reorderNotebook, openReminder, moveToBoard, toggleCompleted, finishTask, showNow }: {
  tasks: Task[]; upcoming: Task[]; activeTaskId: string | null; dueItems: Array<{ id: string; task: Task; step?: TaskStep; person: string; at: number }>; now: number; dragId: string | null;
  setDragId: (id: string | null) => void; createTask: (title: string, project: ProjectId) => unknown; updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; openTask: (id: string) => void; requestActivate: (id: string) => void; reorderNotebook: (id: string, beforeId?: string) => void; openReminder: (target: ReminderTarget) => void; moveToBoard: (id: string, column: BoardColumnId) => void; toggleCompleted: (id: string) => void; finishTask: (id: string) => void; showNow: (id: string) => void;
}) {
  const [newTask, setNewTask] = useState('');
  const [project, setProject] = useState<ProjectId>('none');
  const [showCompleted, setShowCompleted] = useState(false);
  const workingTasks = tasks.filter((task) => !task.notebookCompleted);
  const completedTasks = tasks.filter((task) => task.notebookCompleted);

  const renderRow = (task: Task, index: number, completed = false) => <NotebookRow
    key={task.id}
    number={index + 1}
    task={task}
    now={now}
    active={!completed && task.id === activeTaskId}
    waiting={taskIsWaiting(task)}
    onDragStart={() => setDragId(task.id)}
    onDrop={() => dragId && dragId !== task.id && reorderNotebook(dragId, task.id)}
    updateTask={updateTask}
    addStep={addStep}
    updateStep={updateStep}
    deleteStep={deleteStep}
    openTask={openTask}
    requestActivate={requestActivate}
    openReminder={openReminder}
    moveToBoard={moveToBoard}
    toggleCompleted={toggleCompleted}
    finishTask={finishTask}
  />;

  return <main className="notebook-page v6-notebook">
    <div className="notebook-titlebar"><div><h1>Тетрадь</h1><p>Задача → сейчас</p></div></div>

    {dueItems.length > 0 && <details className="returned-panel returned-collapsed">
      <summary><strong>Пора вернуть внимание</strong><span>{dueItems.length}</span></summary>
      <div className="returned-items">{dueItems.slice(0, 8).map((item) => <div className="returned-item" key={item.id}><div><strong>{item.task.title}</strong><small>{item.step ? item.step.text : item.person ? `Жду: ${item.person}` : 'Напоминание'}</small></div><button onClick={() => openReminder({ taskId: item.task.id, stepId: item.step?.id })}>открыть</button></div>)}</div>
    </details>}

    <form className="new-task-line v6-new-task" onSubmit={(event) => { event.preventDefault(); if (!newTask.trim()) return; createTask(newTask, project); setNewTask(''); }}>
      <span>＋</span><input id="new-notebook-task" value={newTask} onChange={(event) => setNewTask(event.target.value)} placeholder="Новая задача..." /><ProjectPicker value={project} setValue={setProject} /><button>Добавить</button>
    </form>

    <section className="notebook-list v6-notebook-list" onDragOver={(event) => event.preventDefault()} onDrop={() => dragId && reorderNotebook(dragId)}>
      {workingTasks.map((task, index) => renderRow(task, index))}
    </section>

    {completedTasks.length > 0 && <section className="completed-today">
      <button className="completed-summary" type="button" onClick={() => setShowCompleted((value) => !value)}>✓ Выполнено · {completedTasks.length}<span>{showCompleted ? 'скрыть' : 'показать'}</span></button>
      {showCompleted && <div className="completed-drawer">{completedTasks.map((task, index) => renderRow(task, workingTasks.length + index, true))}</div>}
    </section>}

    {upcoming.length > 0 && <section className="upcoming-notebook"><h3>Запланировано в Тетрадь</h3>{upcoming.map((task) => <div key={task.id}><strong>{task.title}</strong><span>{formatDateTime(task.notebookAt)}</span><button onClick={() => showNow(task.id)}>показать сейчас</button></div>)}</section>}
  </main>;
}

'''

notebook_row = r'''function NotebookRow({ number, task, now, active, waiting, onDragStart, onDrop, updateTask, addStep, updateStep, deleteStep, openTask, requestActivate, openReminder, moveToBoard, toggleCompleted, finishTask }: {
  number: number; task: Task; now: number; active: boolean; waiting: boolean; onDragStart: () => void; onDrop: () => void; updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; openTask: (id: string) => void; requestActivate: (id: string) => void; openReminder: (target: ReminderTarget) => void; moveToBoard: (id: string, column: BoardColumnId) => void; toggleCompleted: (id: string) => void; finishTask: (id: string) => void;
}) {
  const [step, setStep] = useState('');
  const [nextOpen, setNextOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const current = task.steps.at(-1) || null;
  const hiddenSteps = task.steps.slice(0, -1);
  const hidden = hiddenSteps.length;
  const waitingStep = [...task.steps].reverse().find((item) => item.waitingPerson.trim());
  const waitingPerson = task.waitingPerson.trim() || (task.columnId === 'delegated' ? task.assignee.trim() : '') || waitingStep?.waitingPerson.trim() || '';
  const staleDays = Math.floor(Math.max(0, now - lastTouched(task)) / DAY);

  const beginEdit = (item: TaskStep) => { setEditing(item.id); setEditText(item.text); };
  const saveEdit = (item: TaskStep) => {
    const clean = editText.trim();
    if (clean) updateStep(task.id, item.id, { text: clean });
    setEditing(null);
  };
  const submitNext = () => {
    if (!step.trim()) return;
    addStep(task.id, step);
    setStep('');
    setNextOpen(false);
  };

  return <article className={`notebook-row v6-row project-${task.project} ${waiting ? 'is-waiting' : ''} ${active ? 'active-row' : ''} ${task.notebookCompleted ? 'notebook-done' : ''}`} draggable onDragStart={onDragStart} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.stopPropagation(); onDrop(); }}>
    <div className="row-number">{number}</div>
    <div className="row-main">
      <div className="row-task-line">
        <button className={`notebook-check ${task.notebookCompleted ? 'checked' : ''}`} onClick={() => toggleCompleted(task.id)} title="Отметить выполненной">✓</button>
        <span className="drag-handle" title="Перетащить">⋮⋮</span>
        <button className="row-title row-title-open" type="button" onClick={() => openTask(task.id)} title="Открыть задачу">{task.title}</button>
        {active && <span className="focus-badge">СЕЙЧАС</span>}
        {task.project !== 'none' && <span className={`project-dot dot-${task.project}`} title={projectLabel(task.project)} />}
        {waiting && <button className="waiting-status" onClick={() => openReminder({ taskId: task.id })}>{waitingPerson ? `ЖДУ · ${waitingPerson}` : 'ЖДУ'}</button>}
        {staleDays >= 3 && !task.notebookCompleted && <span className="stale-age">без движения {staleDays} дн</span>}
      </div>

      <div className="stream-line">
        {hidden > 0 && <button className={`history-more ${expanded ? 'open' : ''}`} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Скрыть' : `История · ${hidden}`}</button>}

        {current ? <div className={`stream-event ${current.waitingPerson ? 'event-waiting' : ''}`} key={current.id}>
          {editing === current.id ? <form onSubmit={(event) => { event.preventDefault(); saveEdit(current); }}><input autoFocus value={editText} onChange={(event) => setEditText(event.target.value)} onBlur={() => saveEdit(current)} onKeyDown={(event) => { if (event.key === 'Escape') setEditing(null); }} /></form> : <>
            <button type="button" className="current-action-text" onClick={() => beginEdit(current)} title="Нажми, чтобы изменить">{current.text}</button>
            <button className="event-edit" onClick={() => beginEdit(current)} title="Редактировать">✎</button>
            <button className="event-remind" onClick={() => openReminder({ taskId: task.id, stepId: current.id })} title="Жду / напомнить">⏰</button>
            <button className="event-delete" onClick={() => deleteStep(task.id, current.id)} title="Удалить">×</button>
          </>}
        </div> : !task.notebookCompleted && <button className="empty-current" type="button" onClick={() => setNextOpen(true)}>Добавь первое действие</button>}

        {!task.notebookCompleted && (nextOpen ? <form className="step-input-wrap" onSubmit={(event) => { event.preventDefault(); submitNext(); }}><input autoFocus value={step} onChange={(event) => setStep(event.target.value)} onBlur={() => !step.trim() && setNextOpen(false)} onKeyDown={(event) => { if (event.key === 'Escape') { setStep(''); setNextOpen(false); } }} placeholder="Следующий шаг..." /></form> : <button type="button" className={`next-step-trigger ${current ? '' : 'no-current'}`} onClick={() => setNextOpen(true)}>＋ следующий шаг</button>)}
      </div>

      {hidden > 0 && <div className={`notebook-history-drawer ${expanded ? 'open' : ''}`} aria-hidden={!expanded}>
        <div className="notebook-history-inner">
          <div className="notebook-history-cap"><span>Раньше</span><button type="button" onClick={() => setExpanded(false)} title="Скрыть историю">×</button></div>
          {hiddenSteps.map((item, index) => <div className={`notebook-history-item ${item.waitingPerson ? 'event-waiting' : ''}`} key={item.id}>
            <span className="notebook-history-number">{index + 1}</span>
            {editing === item.id ? <form onSubmit={(event) => { event.preventDefault(); saveEdit(item); }}><input autoFocus value={editText} onChange={(event) => setEditText(event.target.value)} onBlur={() => saveEdit(item)} onKeyDown={(event) => { if (event.key === 'Escape') setEditing(null); }} /></form> : <>
              <button type="button" className="notebook-history-text" onClick={() => beginEdit(item)}>{item.text}</button>
              <div className="notebook-history-actions"><button type="button" onClick={() => beginEdit(item)} title="Редактировать">✎</button><button type="button" onClick={() => openReminder({ taskId: task.id, stepId: item.id })} title="Жду / напомнить">⏰</button><button type="button" className="delete" onClick={() => deleteStep(task.id, item.id)} title="Удалить">×</button></div>
            </>}
          </div>)}
        </div>
      </div>}

      <details className="row-more">
        <summary title="Действия">•••</summary>
        <div className="row-more-menu">
          {!active && !task.notebookCompleted && <button type="button" onClick={() => requestActivate(task.id)}>В фокус</button>}
          <button type="button" onClick={() => openReminder({ taskId: task.id })}>Жду / напомнить</button>
          <select defaultValue="" onChange={(event) => { if (event.target.value) moveToBoard(task.id, event.target.value as BoardColumnId); event.currentTarget.value = ''; }}><option value="">В доску →</option><option value="today">Сегодня</option><option value="week">Неделя</option><option value="month">Месяц</option><option value="delegated">Делегировано</option></select>
          {task.notebookCompleted && <button type="button" onClick={() => finishTask(task.id)}>В Готово</button>}
        </div>
      </details>
    </div>
  </article>;
}


'''

text = text[:page_start] + notebook_page + notebook_row + text[focus_start:]

# Keep the deep task screen language aligned with the calmer notebook.
text = text.replace('Сейчас основной этап', 'Сейчас')
text = text.replace('История этапов', 'История')
text = text.replace('Добавь первый этап ниже', 'Добавь первое действие ниже')
text = text.replace('Следующий этап', 'Что дальше')
text = text.replace('Добавить этап', 'Добавить')

path.write_text(text)
