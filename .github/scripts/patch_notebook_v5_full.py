from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()
start_marker = 'function NotebookPage('
end_marker = '\n\nfunction TaskFocusView('
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('Notebook component markers not found')

replacement = r'''function NotebookPage({ tasks, upcoming, activeTaskId, dueItems, now, dragId, setDragId, createTask, updateTask, addStep, updateStep, deleteStep, openTask, requestActivate, reorderNotebook, openReminder, moveToBoard, toggleCompleted, finishTask, showNow }: {
  tasks: Task[]; upcoming: Task[]; activeTaskId: string | null; dueItems: Array<{ id: string; task: Task; step?: TaskStep; person: string; at: number }>; now: number; dragId: string | null;
  setDragId: (id: string | null) => void; createTask: (title: string, project: ProjectId) => unknown; updateTask: (id: string, patch: Partial<Task>) => void; addStep: (id: string, text: string) => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; openTask: (id: string) => void; requestActivate: (id: string) => void; reorderNotebook: (id: string, beforeId?: string) => void; openReminder: (target: ReminderTarget) => void; moveToBoard: (id: string, column: BoardColumnId) => void; toggleCompleted: (id: string) => void; finishTask: (id: string) => void; showNow: (id: string) => void;
}) {
  const [newTask, setNewTask] = useState('');
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [project, setProject] = useState<ProjectId>('none');
  const [showCompleted, setShowCompleted] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(activeTaskId || tasks.find((task) => !task.notebookCompleted)?.id || null);

  const workingTasks = tasks.filter((task) => !task.notebookCompleted);
  const completedTasks = tasks.filter((task) => task.notebookCompleted);
  const selectedTask = selectedId ? tasks.find((task) => task.id === selectedId) || null : null;

  useEffect(() => {
    if (selectedId && tasks.some((task) => task.id === selectedId)) return;
    const fallback = (activeTaskId && tasks.some((task) => task.id === activeTaskId) ? activeTaskId : null) || workingTasks[0]?.id || completedTasks[0]?.id || null;
    setSelectedId(fallback);
  }, [tasks, selectedId, activeTaskId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if (typing) return;
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

function NotebookV5Row({ number, task, now, selected, active, waiting, onSelect, onDragStart, onDragEnd, onDrop, updateStep, deleteStep, openReminder, quickNext }: {
  number: number; task: Task; now: number; selected: boolean; active: boolean; waiting: boolean; onSelect: () => void; onDragStart: () => void; onDragEnd: () => void; onDrop: () => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; openReminder: (target: ReminderTarget) => void; quickNext: () => void;
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
      <span className={`nb5-project-dot ${task.project}`} title={projectLabel(task.project) || 'Без проекта'} />
      <button type="button" className="nb5-title" title={task.title}>{task.title}</button>
      <span className="nb5-drag" draggable onDragStart={(event) => { event.stopPropagation(); onDragStart(); }} onDragEnd={onDragEnd} title="Перетащить">⋮⋮</span>
    </div>
    <time className="nb5-created" title={new Date(task.createdAt).toLocaleString('ru-RU')}>{formatTaskCreated(task.createdAt)}</time>
    <div className="nb5-current-cell">
      {editing && current ? <form onSubmit={(event) => { event.preventDefault(); saveCurrent(); }} onClick={(event) => event.stopPropagation()}><input autoFocus value={editText} onChange={(event) => setEditText(event.target.value)} onBlur={saveCurrent} onKeyDown={(event) => { if (event.key === 'Escape') { setEditText(current.text); setEditing(false); } }} /></form> : current ? <button type="button" className="nb5-current-action" title={current.text} onClick={(event) => { event.stopPropagation(); onSelect(); setEditing(true); }}>{current.text}</button> : <button type="button" className="nb5-current-empty" onClick={(event) => { event.stopPropagation(); quickNext(); }}>＋ первое действие</button>}
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
}'''

text = text[:start] + replacement + text[end:]
path.write_text(text)
print('Notebook rebuilt')
