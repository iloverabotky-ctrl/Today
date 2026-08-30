from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()

old = "  const visible = expanded ? task.steps : task.steps.slice(-3); const hidden = Math.max(0, task.steps.length - 3);"
new = "  const visible = task.steps.slice(-2); const hiddenSteps = task.steps.slice(0, -2); const hidden = hiddenSteps.length;"
if old not in text:
    raise SystemExit('Notebook history state snippet not found')
text = text.replace(old, new, 1)

old = "        {hidden > 0 && !expanded && <button className=\"history-more\" onClick={() => setExpanded(true)}>История · {task.steps.length}</button>}"
new = "        {hidden > 0 && <button className={`history-more ${expanded ? 'open' : ''}`} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Скрыть' : `История · ${hidden}`}</button>}"
if old not in text:
    raise SystemExit('History button snippet not found')
text = text.replace(old, new, 1)

old = '''        {expanded && task.steps.length > 3 && <button className="history-more" onClick={() => setExpanded(false)}>свернуть</button>}
        {!task.notebookCompleted && <form className="step-input-wrap" onSubmit={(event) => { event.preventDefault(); if (!step.trim()) return; addStep(task.id, step); setStep(''); }}><input value={step} onChange={(event) => setStep(event.target.value)} placeholder={task.steps.length ? '+ что дальше?' : '+ первое действие'} /></form>}
      </div>
      <div className="row-actions">'''
new = '''        {!task.notebookCompleted && <form className="step-input-wrap" onSubmit={(event) => { event.preventDefault(); if (!step.trim()) return; addStep(task.id, step); setStep(''); }}><input value={step} onChange={(event) => setStep(event.target.value)} placeholder={task.steps.length ? '+ что дальше?' : '+ первое действие'} /></form>}
      </div>
      {hidden > 0 && <div className={`notebook-history-drawer ${expanded ? 'open' : ''}`} aria-hidden={!expanded}>
        <div className="notebook-history-inner">
          <div className="notebook-history-cap"><span>Раньше</span><button type="button" onClick={() => setExpanded(false)} title="Скрыть историю">×</button></div>
          {hiddenSteps.map((item, index) => <div className={`notebook-history-item ${item.waitingPerson ? 'event-waiting' : ''}`} key={item.id}>
            <span className="notebook-history-number">{index + 1}</span>
            {editing === item.id ? <form onSubmit={(event) => { event.preventDefault(); if (editText.trim()) updateStep(task.id, item.id, { text: editText.trim() }); setEditing(null); }}><input autoFocus value={editText} onChange={(event) => setEditText(event.target.value)} onKeyDown={(event) => event.key === 'Escape' && setEditing(null)} /></form> : <><span className="notebook-history-text">{item.text}</span><div className="notebook-history-actions"><button type="button" onClick={() => { setEditing(item.id); setEditText(item.text); }} title="Редактировать">✎</button><button type="button" onClick={() => openReminder({ taskId: task.id, stepId: item.id })} title="Жду / напомнить">⏰</button><button type="button" className="delete" onClick={() => deleteStep(task.id, item.id)} title="Удалить этап">×</button></div></>}
          </div>)}
        </div>
      </div>}
      <div className="row-actions">'''
if old not in text:
    raise SystemExit('Notebook history drawer insertion point not found')
text = text.replace(old, new, 1)

path.write_text(text)
