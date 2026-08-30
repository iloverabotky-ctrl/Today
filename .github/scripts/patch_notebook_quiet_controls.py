from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()

anchor = "const formatDateTime = (timestamp: number | null) => timestamp ? new Date(timestamp).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'без даты';\n"
helper = """const formatTaskCreated = (timestamp: number) => {\n  const date = new Date(timestamp);\n  const today = new Date();\n  const time = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });\n  if (date.toDateString() == today.toDateString()) return time;\n  const day = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');\n  return `${day} · ${time}`;\n};\n"""
if 'const formatTaskCreated' not in text:
    if anchor not in text:
        raise SystemExit('formatDateTime anchor not found')
    text = text.replace(anchor, anchor + helper, 1)

project_anchor = "        {task.project !== 'none' && <span className={`project-dot dot-${task.project}`} title={projectLabel(task.project)} />}\n"
time_markup = "        <span className=\"task-created-time\" title={`Создано ${new Date(task.createdAt).toLocaleString('ru-RU')}`}>{formatTaskCreated(task.createdAt)}</span>\n"
if 'task-created-time' not in text:
    if project_anchor not in text:
        raise SystemExit('project marker anchor not found')
    text = text.replace(project_anchor, project_anchor + time_markup, 1)

old_history = "        {hidden > 0 && <button className={`history-more ${expanded ? 'open' : ''}`} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Скрыть' : `История · ${hidden}`}</button>}"
new_history = "        {hidden > 0 && <button className={`history-more ${expanded ? 'open' : ''}`} onClick={() => setExpanded((value) => !value)} title={expanded ? 'Скрыть историю' : 'Открыть историю'} aria-label={expanded ? 'Скрыть историю' : 'Открыть историю'}>↺ <span>{hidden}</span></button>}"
if old_history in text:
    text = text.replace(old_history, new_history, 1)
elif "aria-label={expanded ? 'Скрыть историю' : 'Открыть историю'}" not in text:
    raise SystemExit('history button anchor not found')

old_next = "<button type=\"button\" className={`next-step-trigger ${current ? '' : 'no-current'}`} onClick={() => setNextOpen(true)}>＋ следующий шаг</button>"
new_next = "<button type=\"button\" className={`next-step-trigger ${current ? '' : 'no-current'}`} onClick={() => setNextOpen(true)} title=\"Следующий шаг\" aria-label=\"Следующий шаг\">＋</button>"
if old_next in text:
    text = text.replace(old_next, new_next, 1)
elif 'aria-label="Следующий шаг"' not in text:
    raise SystemExit('next-step button anchor not found')

path.write_text(text)
