from pathlib import Path

app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

replacements = [
    (
        "    openReminder={openReminder}\n    quickNext={() => selectAndNext(task.id)}\n  />;",
        "    openReminder={openReminder}\n    quickNext={() => selectAndNext(task.id)}\n    toggleCompleted={toggleCompleted}\n  />;",
    ),
    (
        "function NotebookV5Row({ number, task, now, selected, active, waiting, onSelect, onDragStart, onDragEnd, onDrop, updateStep, deleteStep, openReminder, quickNext }: {\n  number: number; task: Task; now: number; selected: boolean; active: boolean; waiting: boolean; onSelect: () => void; onDragStart: () => void; onDragEnd: () => void; onDrop: () => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; openReminder: (target: ReminderTarget) => void; quickNext: () => void;\n}) {",
        "function NotebookV5Row({ number, task, now, selected, active, waiting, onSelect, onDragStart, onDragEnd, onDrop, updateStep, deleteStep, openReminder, quickNext, toggleCompleted }: {\n  number: number; task: Task; now: number; selected: boolean; active: boolean; waiting: boolean; onSelect: () => void; onDragStart: () => void; onDragEnd: () => void; onDrop: () => void; updateStep: (taskId: string, stepId: string, patch: Partial<TaskStep>) => void; deleteStep: (taskId: string, stepId: string) => void; openReminder: (target: ReminderTarget) => void; quickNext: () => void; toggleCompleted: (id: string) => void;\n}) {",
    ),
    (
        "    <div className=\"nb5-title-cell\">\n      <span className={`nb5-project-dot ${task.project}`} title={projectLabel(task.project) || 'Без проекта'} />",
        "    <div className=\"nb5-title-cell\">\n      <button type=\"button\" className=\"nb5-quick-complete\" onClick={(event) => { event.stopPropagation(); toggleCompleted(task.id); }} title={task.notebookCompleted ? 'Вернуть в работу' : 'Быстро выполнить'} aria-label={task.notebookCompleted ? 'Вернуть задачу в работу' : 'Быстро выполнить задачу'}><span>✓</span></button>\n      <span className={`nb5-project-dot ${task.project}`} title={projectLabel(task.project) || 'Без проекта'} />",
    ),
]

for old, new in replacements:
    if old not in app:
        raise SystemExit(f'Expected App fragment not found: {old[:160]}')
    app = app.replace(old, new, 1)

app_path.write_text(app, encoding='utf-8')

css_path = Path('src/notebook-v5-full.css')
css = css_path.read_text(encoding='utf-8')
marker = '/* Notebook quick complete */'
if marker in css:
    raise SystemExit('Quick complete CSS already present')

css += r'''

/* Notebook quick complete */
.nb5-quick-complete{
  display:grid;
  place-items:center;
  flex:0 0 18px;
  width:18px;
  height:18px;
  box-sizing:border-box;
  padding:0;
  border:1px solid #45505a;
  border-radius:50%;
  background:#111519;
  color:transparent;
  opacity:.72;
  cursor:pointer;
  font-size:10px;
  font-weight:760;
  line-height:1;
  transition:border-color .12s,background .12s,color .12s,opacity .12s,box-shadow .12s,transform .08s;
}
.nb5-quick-complete span{transform:translateY(-.2px)}
.nb5-row:hover .nb5-quick-complete,
.nb5-row.selected .nb5-quick-complete{border-color:#65727c;opacity:1}
.nb5-quick-complete:hover{
  border-color:#70c98d!important;
  background:rgba(77,151,99,.12)!important;
  color:#91e0aa!important;
  box-shadow:0 0 0 3px rgba(82,164,108,.055);
}
.nb5-quick-complete:active{transform:scale(.91)}
.nb5-row.completed .nb5-quick-complete{
  border-color:#5c9e70;
  background:rgba(77,151,99,.16);
  color:#8ed9a5;
}
.nb5-row.completed .nb5-title{text-decoration:line-through;text-decoration-color:#65706a;text-decoration-thickness:1px}
@media(max-width:760px){
  .nb5-quick-complete{flex-basis:20px;width:20px;height:20px;opacity:.9}
}
'''
css_path.write_text(css, encoding='utf-8')
print('Notebook quick complete patched')
