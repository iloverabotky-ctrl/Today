from pathlib import Path

path = Path('src/App.tsx')
text = path.read_text()
old = '<textarea className="row-title" rows={1} value={task.title} onChange={(event) => updateTask(task.id, { title: event.target.value })} onDoubleClick={() => openTask(task.id)} title="Двойной клик — открыть задачу" /><button className="open-task-button" onClick={() => openTask(task.id)} title="Открыть задачу">↗</button>'
new = '<button className="row-title row-title-open" type="button" onClick={() => openTask(task.id)} title="Открыть задачу">{task.title}</button><button className="open-task-button" onClick={() => openTask(task.id)} title="Открыть задачу">↗</button>'
if old not in text:
    raise SystemExit('Expected notebook title control not found')
path.write_text(text.replace(old, new, 1))

css = Path('src/task-focus.css')
styles = css.read_text()
addition = '''\n/* In the notebook the task title is now the doorway into the task. */\n.v6-row .row-title-open{\n  display:-webkit-box!important;\n  -webkit-box-orient:vertical!important;\n  -webkit-line-clamp:2!important;\n  overflow:hidden!important;\n  text-align:left!important;\n  cursor:pointer!important;\n  border:0!important;\n  background:transparent!important;\n}\n.v6-row .row-title-open:hover{color:#8ae6b2!important}\n'''
if 'row-title-open' not in styles:
    css.write_text(styles + addition)
