from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()

replacements = [
    (
        "  const [scheduleTaskId, setScheduleTaskId] = useState<string | null>(null);\n",
        "  const [scheduleTaskId, setScheduleTaskId] = useState<string | null>(null);\n  const [taskFocusId, setTaskFocusId] = useState<string | null>(null);\n",
    ),
    (
        "      if (event.key === 'Escape') { setQuickOpen(false); setReminderTarget(null); setDelegateTaskId(null); setScheduleTaskId(null); }",
        "      if (event.key === 'Escape') { setQuickOpen(false); setReminderTarget(null); setDelegateTaskId(null); setScheduleTaskId(null); setTaskFocusId(null); }",
    ),
    (
        "  const updateStep = (taskId: string, stepId: string, patch: Partial<TaskStep>) => setStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, steps: task.steps.map((step) => step.id === stepId ? { ...step, ...patch } : step) } : task) }));\n",
        "  const updateStep = (taskId: string, stepId: string, patch: Partial<TaskStep>) => setStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, steps: task.steps.map((step) => step.id === stepId ? { ...step, ...patch } : step) } : task) }));\n  const deleteStep = (taskId: string, stepId: string) => setStore((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, steps: task.steps.filter((step) => step.id !== stepId) } : task) }));\n",
    ),
    (
        "  const reminderTask = reminderTarget ? store.tasks.find((task) => task.id === reminderTarget.taskId) || null : null;\n",
        "  const openTaskFocus = (taskId: string) => { setStore((current) => ({ ...current, activeTaskId: taskId })); setTaskFocusId(taskId); };\n  const focusTask = taskFocusId ? store.tasks.find((task) => task.id === taskFocusId) || null : null;\n  const reminderTask = reminderTarget ? store.tasks.find((task) => task.id === reminderTarget.taskId) || null : null;\n",
    ),
    (
        "    {page === 'notebook' && <NotebookPage tasks={notebookReady} upcoming={notebookUpcoming} activeTaskId={store.activeTaskId} dueItems={dueItems} now={now} dragId={dragNotebookId} setDragId={setDragNotebookId} createTask={(title, project) => createTask(title, 'today', boardCity, project, true)} updateTask={updateTask} addStep={addStep} updateStep={updateStep} requestActivate={requestActivate} reorderNotebook={reorderNotebook} openReminder={setReminderTarget} moveToBoard={moveNotebookToBoard} toggleCompleted={toggleNotebookCompleted} finishTask={finishTask} showNow={(id) => moveToNotebook(id, Date.now())} />}",
        "    {page === 'notebook' && <NotebookPage tasks={notebookReady} upcoming={notebookUpcoming} activeTaskId={store.activeTaskId} dueItems={dueItems} now={now} dragId={dragNotebookId} setDragId={setDragNotebookId} createTask={(title, project) => createTask(title, 'today', boardCity, project, true)} updateTask={updateTask} addStep={addStep} updateStep={updateStep} deleteStep={deleteStep} openTask={openTaskFocus} requestActivate={requestActivate} reorderNotebook={reorderNotebook} openReminder={setReminderTarget} moveToBoard={moveNotebookToBoard} toggleCompleted={toggleNotebookCompleted} finishTask={finishTask} showNow={(id) => moveToNotebook(id, Date.now())} />}",
    ),
    (
        "    {page === 'people' && <PeoplePage tasks={store.tasks} now={now} openReminder={setReminderTarget} />}\n\n    {quickOpen &&",
        "    {page === 'people' && <PeoplePage tasks={store.tasks} now={now} openReminder={setReminderTarget} />}\n    {focusTask && <TaskFocusView task={focusTask} now={now} close={() => setTaskFocusId(null)} updateTask={updateTask} addStep={addStep} updateStep={updateStep} deleteStep={deleteStep} openReminder={setReminderTarget} toggleCompleted={toggleNotebookCompleted} finishTask={finishTask} />}\n\n    {quickOpen &&",
    ),
    (
        "function NotebookPage({ tasks, upcoming, activeTaskId, dueItems, now, dragId, setDragId, createTask, updateTask, addStep, updateStep, requestActivate, reorderNotebook, openReminder, moveToBoard, toggleCompleted, finishTask, showNow }: {",
        "function NotebookPage({ tasks, upcoming, activeTaskId, dueItems, now, dragId, setDragId, createTask, updateTask, addStep, updateStep, deleteStep, openTask, requestActivate, reorderNotebook, openReminder, moveToBoard, toggleCompleted, finishTask, showNow }: {",
    ),
    (
        "  setDragId: (id: string | null) => void; createTask: (title: string, project: ProjectId) => unknown; updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; requestActivate: (id: string) => void;",
        "  setDragId: (id: string | null) => void; createTask: (title: string, project: ProjectId) => unknown; updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; openTask: (id: string) => void; requestActivate: (id: string) => void;",
    ),
    (
        "updateTask={updateTask} addStep={addStep} updateStep={updateStep} requestActivate={requestActivate}",
        "updateTask={updateTask} addStep={addStep} updateStep={updateStep} deleteStep={deleteStep} openTask={openTask} requestActivate={requestActivate}",
    ),
    (
        "function NotebookRow({ number, task, now, active, waiting, onDragStart, onDrop, updateTask, addStep, updateStep, requestActivate, openReminder, moveToBoard, toggleCompleted, finishTask }: {",
        "function NotebookRow({ number, task, now, active, waiting, onDragStart, onDrop, updateTask, addStep, updateStep, deleteStep, openTask, requestActivate, openReminder, moveToBoard, toggleCompleted, finishTask }: {",
    ),
    (
        "number: number; task: Task; now: number; active: boolean; waiting: boolean; onDragStart: () => void; onDrop: () => void; updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; requestActivate: (id: string) => void;",
        "number: number; task: Task; now: number; active: boolean; waiting: boolean; onDragStart: () => void; onDrop: () => void; updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; openTask: (id: string) => void; requestActivate: (id: string) => void;",
    ),
    (
        "<textarea className=\"row-title\" rows={1} value={task.title} onChange={(event) => updateTask(task.id, { title: event.target.value })} />",
        "<textarea className=\"row-title\" rows={1} value={task.title} onChange={(event) => updateTask(task.id, { title: event.target.value })} onDoubleClick={() => openTask(task.id)} title=\"Двойной клик — открыть задачу\" /><button className=\"open-task-button\" onClick={() => openTask(task.id)} title=\"Открыть задачу\">↗</button>",
    ),
    (
        "<button className=\"event-remind\" onClick={() => openReminder({ taskId: task.id, stepId: item.id })}>⏰</button></>}",
        "<button className=\"event-remind\" onClick={() => openReminder({ taskId: task.id, stepId: item.id })}>⏰</button><button className=\"event-delete\" onClick={() => deleteStep(task.id, item.id)} title=\"Удалить этап\">×</button></>}",
    ),
]

for old, new in replacements:
    if old not in text:
        raise SystemExit(f'Expected snippet not found: {old[:160]}')
    text = text.replace(old, new, 1)

marker = "\nfunction BoardPage("
if marker not in text:
    raise SystemExit('BoardPage marker not found')

component = r'''

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
      {current ? <section className="task-focus-current"><small>Сейчас основной этап</small><strong>{current.text}</strong></section> : <section className="task-focus-current empty"><small>Сейчас</small><strong>Добавь первый этап ниже</strong></section>}
      <div className="task-focus-history-head"><span>История этапов</span><span>{task.steps.length}</span></div>
      <section className="task-focus-history">{task.steps.map((item, index) => <article className={`task-focus-step ${item.id === current?.id ? 'current' : ''}`} key={item.id}><div className="task-focus-step-number">{index + 1}</div><textarea value={item.text} rows={1} onChange={(event) => updateStep(task.id, item.id, { text: event.target.value })} /><div className="task-focus-step-actions"><button onClick={() => openReminder({ taskId: task.id, stepId: item.id })} title="Жду / напомнить">⏰</button><button className="delete" onClick={() => deleteStep(task.id, item.id)} title="Удалить этап">×</button></div></article>)}</section>
      {!task.notebookCompleted && <form className="task-focus-next" onSubmit={(event) => { event.preventDefault(); submitNext(); }}><label>Следующий этап</label><div className="task-focus-next-row"><input autoFocus value={next} onChange={(event) => setNext(event.target.value)} placeholder="Что делаю дальше?" /><button>Добавить этап</button></div></form>}
      <div className="task-focus-footer"><button onClick={() => openReminder({ taskId: task.id })}>⏰ Жду / напомнить</button><button onClick={() => toggleCompleted(task.id)}>{task.notebookCompleted ? 'Вернуть в работу' : 'Отметить выполненной'}</button>{task.notebookCompleted && <button className="complete" onClick={() => { finishTask(task.id); close(); }}>В Готово</button>}</div>
    </div>
  </div>;
}
'''

text = text.replace(marker, component + marker, 1)
path.write_text(text)

main = Path('src/main.tsx')
main_text = main.read_text()
old_import = "import './notebook-stage-fix.css';\n"
new_import = "import './notebook-stage-fix.css';\nimport './task-focus.css';\n"
if old_import not in main_text:
    raise SystemExit('Stage CSS import not found')
main.write_text(main_text.replace(old_import, new_import, 1))
