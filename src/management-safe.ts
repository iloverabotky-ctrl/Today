type TeamMember = { id: string; name: string; role: string; fixed?: boolean };
type MetricRow = { id: string; name: string; target: string; fact: string; comment: string };
type Meeting = {
  id: string; memberId: string; date: string; metrics: MetricRow[];
  previousCommitments: string; wins: string; problems: string; decisions: string;
  commitments: string; ownerNeeds: string; risks: string; workload: number; clarity: number; createdAt: number;
};

const TEAM_KEY = 'today-team-v1';
const OOO_KEY = 'today-oneonone-v1';
const TASKS_KEY = 'today-cockpit-v2';
const ROOT_ID = 'today-management-root';
const DEFAULT_TEAM: TeamMember[] = [
  { id: 'natasha', name: 'Наташа', role: '', fixed: true },
  { id: 'anita', name: 'Анита', role: '', fixed: true },
  { id: 'zhenya', name: 'Женя', role: '', fixed: true },
  { id: 'ksyusha', name: 'Ксюша', role: '', fixed: true },
  { id: 'olga', name: 'Ольга', role: '', fixed: true },
];

const uid = () => crypto.randomUUID();
const esc = (value: string) => value.replace(/[&<>'"]/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c] || c));
const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,10);
};

function loadTeam(): TeamMember[] {
  try {
    const saved = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]') as TeamMember[];
    const map = new Map(saved.map((m) => [m.id, m]));
    DEFAULT_TEAM.forEach((m) => map.set(m.id, map.has(m.id) ? { ...map.get(m.id)!, fixed: true } : m));
    return [...map.values()];
  } catch { return [...DEFAULT_TEAM]; }
}
function saveTeam(team: TeamMember[]) { localStorage.setItem(TEAM_KEY, JSON.stringify(team)); syncDatalist(); }
function loadMeetings(): Meeting[] {
  try { const v = JSON.parse(localStorage.getItem(OOO_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function saveMeetings(items: Meeting[]) { localStorage.setItem(OOO_KEY, JSON.stringify(items)); }
function loadTasks(): Array<Record<string, unknown>> {
  try { const v = JSON.parse(localStorage.getItem(TASKS_KEY) || '{}'); return Array.isArray(v.tasks) ? v.tasks : []; }
  catch { return []; }
}
function formatDate(value: string | number | Date) {
  return new Date(value).toLocaleDateString('ru-RU', { day:'numeric', month:'short' });
}
function nextOneOnOne(memberId: string) {
  const last = loadMeetings().filter((m) => m.memberId === memberId).sort((a,b)=>b.createdAt-a.createdAt)[0];
  return last ? new Date(new Date(last.date).getTime() + 7 * 86400000) : null;
}
function waitingCount(name: string) {
  const low = name.toLocaleLowerCase('ru-RU');
  return loadTasks().filter((t) => String(t.waitingPerson || '').trim().toLocaleLowerCase('ru-RU') === low && t.columnId !== 'done').length;
}

function ensureRoot() {
  const shell = document.querySelector<HTMLElement>('.app-shell');
  if (!shell) return null;
  let root = document.getElementById(ROOT_ID) as HTMLElement | null;
  if (!root) {
    root = document.createElement('main');
    root.id = ROOT_ID;
    root.className = 'management-page';
    root.hidden = true;
    shell.appendChild(root);
  }
  return root;
}
function setOriginalVisible(visible: boolean) {
  document.querySelectorAll<HTMLElement>('.app-shell > main:not(#today-management-root)').forEach((n) => n.style.display = visible ? '' : 'none');
}
function deactivate() {
  const root = document.getElementById(ROOT_ID) as HTMLElement | null;
  if (root) root.hidden = true;
  setOriginalVisible(true);
}
function activate(kind: 'team'|'oneonone', memberId?: string) {
  const root = ensureRoot(); if (!root) return;
  setOriginalVisible(false); root.hidden = false;
  document.querySelectorAll('.page-switch button').forEach((b) => b.classList.remove('active'));
  document.querySelector<HTMLButtonElement>(`.page-switch button[data-safe-management="${kind}"]`)?.classList.add('active');
  kind === 'team' ? renderTeam(root) : renderOneOnOne(root, memberId);
}

function ensureNav() {
  const nav = document.querySelector<HTMLElement>('.page-switch'); if (!nav) return;
  if (!nav.querySelector('[data-safe-management="team"]')) {
    const b = document.createElement('button'); b.type='button'; b.dataset.safeManagement='team'; b.textContent='Команда';
    b.onclick = (e) => { e.stopPropagation(); activate('team'); };
    nav.appendChild(b);
  }
  if (!nav.querySelector('[data-safe-management="oneonone"]')) {
    const b = document.createElement('button'); b.type='button'; b.dataset.safeManagement='oneonone'; b.textContent='1:1';
    b.onclick = (e) => { e.stopPropagation(); activate('oneonone'); };
    nav.appendChild(b);
  }
}

function syncDatalist() {
  let list = document.getElementById('today-team-datalist') as HTMLDataListElement | null;
  if (!list) { list = document.createElement('datalist'); list.id='today-team-datalist'; document.body.appendChild(list); }
  list.innerHTML = loadTeam().map((m) => `<option value="${esc(m.name)}"></option>`).join('');
  const modalInput = document.querySelector<HTMLInputElement>('.waiting-modal input');
  if (modalInput) modalInput.setAttribute('list','today-team-datalist');
}

function renderTeam(root: HTMLElement) {
  const team = loadTeam();
  root.innerHTML = `<div class="management-heading"><div><h1>Команда</h1><p>Постоянные люди, вопросы и ритм 1:1</p></div><button class="management-primary" id="safe-add-member">＋ Добавить человека</button></div>
  <div class="team-grid">${team.map((m) => {
    const next = nextOneOnOne(m.id); const overdue = !!next && next.getTime() < Date.now();
    return `<article class="team-card" data-id="${m.id}"><div class="team-card-top"><div class="team-avatar">${esc(m.name.slice(0,1).toUpperCase())}</div><div class="team-person"><strong>${esc(m.name)}</strong><input class="team-role" value="${esc(m.role)}" placeholder="Роль / зона ответственности"></div></div><div class="team-signals"><div><b>${waitingCount(m.name)}</b><span>жду ответа</span></div><div class="${overdue?'signal-hot':''}"><b>${next?formatDate(next):'ещё не было'}</b><span>следующий 1:1</span></div></div><div class="team-card-actions"><button class="open-ooo">Открыть 1:1</button><button class="open-wait">Вопросы</button></div></article>`;
  }).join('')}</div>
  <div class="team-add-panel" id="safe-add-panel" hidden><form id="safe-add-form"><input id="safe-name" placeholder="Имя сотрудника" autocomplete="off"><input id="safe-role" placeholder="Роль (необязательно)" autocomplete="off"><button>Добавить</button></form></div>`;

  root.querySelector<HTMLButtonElement>('#safe-add-member')!.onclick = () => {
    const p = root.querySelector<HTMLElement>('#safe-add-panel')!; p.hidden = !p.hidden; if (!p.hidden) root.querySelector<HTMLInputElement>('#safe-name')?.focus();
  };
  root.querySelector<HTMLFormElement>('#safe-add-form')!.onsubmit = (e) => {
    e.preventDefault(); const name = root.querySelector<HTMLInputElement>('#safe-name')!.value.trim(); if (!name) return;
    const role = root.querySelector<HTMLInputElement>('#safe-role')!.value.trim(); const teamNow = loadTeam(); teamNow.push({ id:uid(), name, role }); saveTeam(teamNow); renderTeam(root);
  };
  root.querySelectorAll<HTMLElement>('.team-card').forEach((card) => {
    const id = card.dataset.id!;
    card.querySelector<HTMLInputElement>('.team-role')!.onchange = (e) => { const t=loadTeam(); const m=t.find(x=>x.id===id); if(m) m.role=(e.currentTarget as HTMLInputElement).value.trim(); saveTeam(t); };
    card.querySelector<HTMLButtonElement>('.open-ooo')!.onclick = () => activate('oneonone', id);
    card.querySelector<HTMLButtonElement>('.open-wait')!.onclick = () => { deactivate(); [...document.querySelectorAll<HTMLButtonElement>('.page-switch button')].find(b=>b.textContent?.trim().startsWith('Жду'))?.click(); };
  });
}

const metricHtml = (r: MetricRow) => `<div class="metric-row" data-mid="${r.id}"><input data-f="name" placeholder="Показатель" value="${esc(r.name)}"><input data-f="target" placeholder="План" value="${esc(r.target)}"><input data-f="fact" placeholder="Факт" value="${esc(r.fact)}"><input data-f="comment" placeholder="Почему отклонение / комментарий" value="${esc(r.comment)}"></div>`;
const emptyMetric = (): MetricRow => ({ id:uid(), name:'', target:'', fact:'', comment:'' });

function renderOneOnOne(root: HTMLElement, memberId?: string) {
  const team = loadTeam(); const member = team.find(m=>m.id===memberId) || team[0]; if (!member) return;
  const history = loadMeetings().filter(m=>m.memberId===member.id).sort((a,b)=>b.createdAt-a.createdAt); const last=history[0];
  root.innerHTML = `<div class="management-heading oneonone-heading"><div><h1>1:1</h1><p>Еженедельный разговор: цифры → проблемы → решения → обязательства</p></div><div class="oneonone-next">${last?`Последний: <b>${formatDate(last.date)}</b>`:'Первая встреча'}</div></div>
  <div class="member-tabs">${team.map(m=>`<button class="${m.id===member.id?'active':''}" data-member="${m.id}">${esc(m.name)}</button>`).join('')}</div>
  <div class="oneonone-layout"><section class="oneonone-form-card">
    <div class="ooo-person-head"><div class="team-avatar">${esc(member.name[0].toUpperCase())}</div><div><h2>${esc(member.name)}</h2><span>${esc(member.role||'роль пока не указана')}</span></div><input id="ooo-date" type="date" value="${today()}"></div>
    <div class="ooo-section"><div class="ooo-section-title"><b>1. Обязательства с прошлого 1:1</b><span>Что обещали сделать и что реально сделано</span></div><textarea id="ooo-prev">${last?esc(last.commitments):''}</textarea></div>
    <div class="ooo-section"><div class="ooo-section-title"><b>2. Цифры недели</b><span>План → факт → причина отклонения</span></div><div id="ooo-metrics" class="metrics-list">${[emptyMetric(),emptyMetric(),emptyMetric()].map(metricHtml).join('')}</div><button type="button" class="ooo-ghost" id="ooo-add-metric">＋ Ещё показатель</button></div>
    <div class="ooo-two-col"><div class="ooo-section"><div class="ooo-section-title"><b>3. Что получилось</b><span>Конкретные результаты</span></div><textarea id="ooo-wins"></textarea></div><div class="ooo-section"><div class="ooo-section-title"><b>4. Где буксуем</b><span>Проблемы, люди, процессы</span></div><textarea id="ooo-problems"></textarea></div></div>
    <div class="ooo-section"><div class="ooo-section-title"><b>5. Решения</b><span>Что меняем после разговора</span></div><textarea id="ooo-decisions"></textarea></div>
    <div class="ooo-section commitments-section"><div class="ooo-section-title"><b>6. Обязательства до следующего 1:1</b><span>1–3 конкретных результата</span></div><textarea id="ooo-commitments"></textarea></div>
    <div class="ooo-two-col"><div class="ooo-section"><div class="ooo-section-title"><b>7. Что нужно от меня</b><span>Решение, ресурс, снятие блока</span></div><textarea id="ooo-owner"></textarea></div><div class="ooo-section"><div class="ooo-section-title"><b>8. Риск следующей недели</b><span>Что может сорвать результат</span></div><textarea id="ooo-risks"></textarea></div></div>
    <div class="ooo-scores"><label>Нагрузка <strong id="ooo-workload-value">5/10</strong><input id="ooo-workload" type="range" min="1" max="10" value="5"></label><label>Ясность приоритетов <strong id="ooo-clarity-value">7/10</strong><input id="ooo-clarity" type="range" min="1" max="10" value="7"></label></div>
    <div class="ooo-save-row"><span>Сохраняется в историю ${esc(member.name)}</span><button class="management-primary" id="ooo-save">Сохранить 1:1</button></div>
  </section><aside class="oneonone-history"><div class="history-heading"><b>История</b><span>${history.length}</span></div>${history.length?history.slice(0,8).map(h=>`<details class="history-item"><summary><div><strong>${formatDate(h.date)}</strong><span>${h.metrics.slice(0,3).filter(x=>x.name).map(x=>`${esc(x.name)}: ${esc(x.fact||'—')}`).join(' · ')||'без цифр'}</span></div><b>›</b></summary><div class="history-body">${h.commitments?`<p><label>Обязательства</label>${esc(h.commitments)}</p>`:''}${h.decisions?`<p><label>Решения</label>${esc(h.decisions)}</p>`:''}${h.problems?`<p><label>Буксуем</label>${esc(h.problems)}</p>`:''}${h.ownerNeeds?`<p><label>От меня</label>${esc(h.ownerNeeds)}</p>`:''}<div class="history-scores"><span>Нагрузка ${h.workload}/10</span><span>Ясность ${h.clarity}/10</span></div></div></details>`).join(''):'<div class="ooo-empty">Пока встреч нет.</div>'}</aside></div>`;

  root.querySelectorAll<HTMLButtonElement>('[data-member]').forEach(b=>b.onclick=()=>renderOneOnOne(root,b.dataset.member));
  root.querySelector<HTMLButtonElement>('#ooo-add-metric')!.onclick=()=>root.querySelector('#ooo-metrics')?.insertAdjacentHTML('beforeend',metricHtml(emptyMetric()));
  const wl=root.querySelector<HTMLInputElement>('#ooo-workload')!, cl=root.querySelector<HTMLInputElement>('#ooo-clarity')!;
  wl.oninput=()=>{ root.querySelector('#ooo-workload-value')!.textContent=`${wl.value}/10`; }; cl.oninput=()=>{ root.querySelector('#ooo-clarity-value')!.textContent=`${cl.value}/10`; };
  root.querySelector<HTMLButtonElement>('#ooo-save')!.onclick=()=>{
    const metrics=[...root.querySelectorAll<HTMLElement>('.metric-row')].map(row=>({ id:row.dataset.mid||uid(), name:row.querySelector<HTMLInputElement>('[data-f="name"]')?.value.trim()||'', target:row.querySelector<HTMLInputElement>('[data-f="target"]')?.value.trim()||'', fact:row.querySelector<HTMLInputElement>('[data-f="fact"]')?.value.trim()||'', comment:row.querySelector<HTMLInputElement>('[data-f="comment"]')?.value.trim()||'' })).filter(r=>r.name||r.target||r.fact||r.comment);
    const meeting: Meeting={ id:uid(), memberId:member.id, date:root.querySelector<HTMLInputElement>('#ooo-date')!.value||today(), metrics, previousCommitments:root.querySelector<HTMLTextAreaElement>('#ooo-prev')!.value.trim(), wins:root.querySelector<HTMLTextAreaElement>('#ooo-wins')!.value.trim(), problems:root.querySelector<HTMLTextAreaElement>('#ooo-problems')!.value.trim(), decisions:root.querySelector<HTMLTextAreaElement>('#ooo-decisions')!.value.trim(), commitments:root.querySelector<HTMLTextAreaElement>('#ooo-commitments')!.value.trim(), ownerNeeds:root.querySelector<HTMLTextAreaElement>('#ooo-owner')!.value.trim(), risks:root.querySelector<HTMLTextAreaElement>('#ooo-risks')!.value.trim(), workload:Number(wl.value), clarity:Number(cl.value), createdAt:Date.now() };
    const all=loadMeetings(); all.push(meeting); saveMeetings(all); renderOneOnOne(root, member.id);
  };
}

export function initSafeManagementWorkspace() {
  saveTeam(loadTeam()); ensureRoot(); ensureNav(); syncDatalist();
  document.addEventListener('click', (event) => {
    const el = event.target as HTMLElement;
    const navButton = el.closest<HTMLButtonElement>('.page-switch button');
    if (navButton && !navButton.dataset.safeManagement) deactivate();
    window.setTimeout(() => { ensureNav(); syncDatalist(); }, 0);
  }, true);
  window.setInterval(() => ensureNav(), 2000);
}
