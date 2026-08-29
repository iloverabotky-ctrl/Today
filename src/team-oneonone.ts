type TeamMember = {
  id: string;
  name: string;
  role: string;
  fixed?: boolean;
};

type MetricRow = {
  id: string;
  name: string;
  target: string;
  fact: string;
  comment: string;
};

type OneOnOne = {
  id: string;
  memberId: string;
  date: string;
  metrics: MetricRow[];
  previousCommitments: string;
  wins: string;
  problems: string;
  decisions: string;
  commitments: string;
  ownerNeeds: string;
  risks: string;
  workload: number;
  clarity: number;
  createdAt: number;
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
const escapeHtml = (value: string) => value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] || char);
const todayValue = () => {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

function loadTeam(): TeamMember[] {
  try {
    const raw = JSON.parse(localStorage.getItem(TEAM_KEY) || '[]') as TeamMember[];
    const map = new Map(raw.map((item) => [item.id, item]));
    DEFAULT_TEAM.forEach((item) => {
      if (!map.has(item.id)) map.set(item.id, item);
      else map.set(item.id, { ...map.get(item.id)!, fixed: true });
    });
    return [...map.values()];
  } catch {
    return [...DEFAULT_TEAM];
  }
}

function saveTeam(team: TeamMember[]) {
  localStorage.setItem(TEAM_KEY, JSON.stringify(team));
  syncTeamDatalist(team);
}

function loadMeetings(): OneOnOne[] {
  try {
    const value = JSON.parse(localStorage.getItem(OOO_KEY) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveMeetings(items: OneOnOne[]) {
  localStorage.setItem(OOO_KEY, JSON.stringify(items));
}

function loadTasks(): Array<Record<string, unknown>> {
  try {
    const value = JSON.parse(localStorage.getItem(TASKS_KEY) || '{}') as { tasks?: Array<Record<string, unknown>> };
    return Array.isArray(value.tasks) ? value.tasks : [];
  } catch {
    return [];
  }
}

function memberStats(member: TeamMember, meetings: OneOnOne[]) {
  const tasks = loadTasks();
  const waiting = tasks.filter((task) => String(task.waitingPerson || '').trim().toLocaleLowerCase('ru-RU') === member.name.toLocaleLowerCase('ru-RU') && task.columnId !== 'done').length;
  const history = meetings.filter((item) => item.memberId === member.id).sort((a, b) => b.createdAt - a.createdAt);
  const last = history[0];
  const next = last ? new Date(new Date(last.date).getTime() + 7 * 24 * 60 * 60 * 1000) : null;
  return { waiting, last, next };
}

function formatDate(value: string | number | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function syncTeamDatalist(team = loadTeam()) {
  let list = document.querySelector<HTMLDataListElement>('#today-team-datalist');
  if (!list) {
    list = document.createElement('datalist');
    list.id = 'today-team-datalist';
    document.body.appendChild(list);
  }
  list.innerHTML = team.map((item) => `<option value="${escapeHtml(item.name)}"></option>`).join('');
  document.querySelectorAll<HTMLInputElement>('.waiting-modal input').forEach((input, index) => {
    if (index === 0) input.setAttribute('list', 'today-team-datalist');
  });
}

function ensureRoot() {
  const shell = document.querySelector<HTMLElement>('.app-shell');
  if (!shell) return null;
  let root = document.querySelector<HTMLElement>(`#${ROOT_ID}`);
  if (!root) {
    root = document.createElement('main');
    root.id = ROOT_ID;
    root.className = 'management-page';
    root.hidden = true;
    shell.appendChild(root);
  }
  return root;
}

function setOriginalPagesVisible(visible: boolean) {
  document.querySelectorAll<HTMLElement>('.app-shell > main:not(#today-management-root)').forEach((node) => {
    node.style.display = visible ? '' : 'none';
  });
}

function activateManagementPage(kind: 'team' | 'oneonone', memberId?: string) {
  const root = ensureRoot();
  if (!root) return;
  setOriginalPagesVisible(false);
  root.hidden = false;
  document.querySelectorAll('.page-switch button').forEach((button) => button.classList.remove('active'));
  document.querySelector<HTMLButtonElement>(`.page-switch button[data-management-page="${kind}"]`)?.classList.add('active');
  if (kind === 'team') renderTeam(root);
  else renderOneOnOne(root, memberId);
}

function deactivateManagementPage() {
  const root = document.querySelector<HTMLElement>(`#${ROOT_ID}`);
  if (root) root.hidden = true;
  setOriginalPagesVisible(true);
}

function ensureNavButtons() {
  const nav = document.querySelector<HTMLElement>('.page-switch');
  if (!nav) return;
  if (!nav.querySelector('[data-management-page="team"]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.managementPage = 'team';
    button.textContent = 'Команда';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      activateManagementPage('team');
    });
    nav.appendChild(button);
  }
  if (!nav.querySelector('[data-management-page="oneonone"]')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.managementPage = 'oneonone';
    button.textContent = '1:1';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      activateManagementPage('oneonone');
    });
    nav.appendChild(button);
  }
}

function renderTeam(root: HTMLElement) {
  const team = loadTeam();
  const meetings = loadMeetings();
  root.innerHTML = `
    <div class="management-heading">
      <div><h1>Команда</h1><p>Постоянные люди, вопросы и ритм 1:1</p></div>
      <button class="management-primary" id="add-team-member">＋ Добавить человека</button>
    </div>
    <div class="team-grid">
      ${team.map((member) => {
        const stats = memberStats(member, meetings);
        const nextLabel = stats.next ? formatDate(stats.next) : 'ещё не было';
        const overdue = stats.next ? stats.next.getTime() < Date.now() : false;
        return `<article class="team-card" data-member-id="${member.id}">
          <div class="team-card-top"><div class="team-avatar">${escapeHtml(member.name.slice(0, 1).toUpperCase())}</div><div class="team-person"><strong>${escapeHtml(member.name)}</strong><input class="team-role" value="${escapeHtml(member.role)}" placeholder="Роль / зона ответственности" aria-label="Роль ${escapeHtml(member.name)}"></div></div>
          <div class="team-signals">
            <div><b>${stats.waiting}</b><span>жду ответа</span></div>
            <div class="${overdue ? 'signal-hot' : ''}"><b>${nextLabel}</b><span>следующий 1:1</span></div>
          </div>
          <div class="team-card-actions"><button class="open-oneonone">Открыть 1:1</button><button class="open-waiting">Вопросы</button></div>
        </article>`;
      }).join('')}
    </div>
    <div class="team-add-panel" id="team-add-panel" hidden>
      <form id="team-add-form"><input id="team-new-name" placeholder="Имя сотрудника" autocomplete="off" autofocus><input id="team-new-role" placeholder="Роль (необязательно)" autocomplete="off"><button>Добавить</button></form>
    </div>`;

  root.querySelector<HTMLButtonElement>('#add-team-member')?.addEventListener('click', () => {
    const panel = root.querySelector<HTMLElement>('#team-add-panel');
    if (panel) { panel.hidden = !panel.hidden; root.querySelector<HTMLInputElement>('#team-new-name')?.focus(); }
  });
  root.querySelector<HTMLFormElement>('#team-add-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = root.querySelector<HTMLInputElement>('#team-new-name')?.value.trim() || '';
    const role = root.querySelector<HTMLInputElement>('#team-new-role')?.value.trim() || '';
    if (!name) return;
    const current = loadTeam();
    current.push({ id: uid(), name, role });
    saveTeam(current);
    renderTeam(root);
  });
  root.querySelectorAll<HTMLElement>('.team-card').forEach((card) => {
    const id = card.dataset.memberId || '';
    card.querySelector<HTMLInputElement>('.team-role')?.addEventListener('change', (event) => {
      const current = loadTeam();
      const member = current.find((item) => item.id === id);
      if (member) member.role = (event.currentTarget as HTMLInputElement).value.trim();
      saveTeam(current);
    });
    card.querySelector<HTMLButtonElement>('.open-oneonone')?.addEventListener('click', () => activateManagementPage('oneonone', id));
    card.querySelector<HTMLButtonElement>('.open-waiting')?.addEventListener('click', () => {
      deactivateManagementPage();
      const waitingButton = [...document.querySelectorAll<HTMLButtonElement>('.page-switch button')].find((button) => button.textContent?.trim().startsWith('Жду'));
      waitingButton?.click();
    });
  });
}

function emptyMetrics(): MetricRow[] {
  return [0, 1, 2].map(() => ({ id: uid(), name: '', target: '', fact: '', comment: '' }));
}

function renderOneOnOne(root: HTMLElement, selectedMemberId?: string) {
  const team = loadTeam();
  const meetings = loadMeetings();
  const selected = team.find((item) => item.id === selectedMemberId) || team[0];
  if (!selected) return;
  const history = meetings.filter((item) => item.memberId === selected.id).sort((a, b) => b.createdAt - a.createdAt);
  const last = history[0];
  const metrics = emptyMetrics();

  root.innerHTML = `
    <div class="management-heading oneonone-heading">
      <div><h1>1:1</h1><p>Еженедельный разговор: цифры → проблемы → решения → обязательства</p></div>
      <div class="oneonone-next">${last ? `Последний: <b>${formatDate(last.date)}</b>` : 'Первая встреча'}</div>
    </div>
    <div class="member-tabs">${team.map((member) => `<button class="${member.id === selected.id ? 'active' : ''}" data-select-member="${member.id}">${escapeHtml(member.name)}</button>`).join('')}</div>
    <div class="oneonone-layout">
      <section class="oneonone-form-card">
        <div class="ooo-person-head"><div class="team-avatar">${escapeHtml(selected.name.slice(0, 1).toUpperCase())}</div><div><h2>${escapeHtml(selected.name)}</h2><span>${escapeHtml(selected.role || 'роль пока не указана')}</span></div><input id="ooo-date" type="date" value="${todayValue()}"></div>

        <div class="ooo-section">
          <div class="ooo-section-title"><b>1. Обязательства с прошлого 1:1</b><span>Начинаем не с новостей, а с обещаний</span></div>
          <textarea id="ooo-previous" placeholder="Что обещали сделать? Что выполнено / не выполнено и почему?">${last ? escapeHtml(last.commitments) : ''}</textarea>
        </div>

        <div class="ooo-section">
          <div class="ooo-section-title"><b>2. Цифры недели</b><span>3–5 показателей: план → факт → причина отклонения</span></div>
          <div id="metrics-list" class="metrics-list">
            ${metrics.map((row) => metricRowHtml(row)).join('')}
          </div>
          <button class="ooo-ghost" type="button" id="add-metric">＋ Ещё показатель</button>
        </div>

        <div class="ooo-two-col">
          <div class="ooo-section"><div class="ooo-section-title"><b>3. Что получилось</b><span>Факты, не общие ощущения</span></div><textarea id="ooo-wins" placeholder="Результаты недели, которыми довольны"></textarea></div>
          <div class="ooo-section"><div class="ooo-section-title"><b>4. Где буксуем</b><span>Проблемы, отклонения, люди, процессы</span></div><textarea id="ooo-problems" placeholder="Что не получилось и почему"></textarea></div>
        </div>

        <div class="ooo-section"><div class="ooo-section-title"><b>5. Решения</b><span>Что конкретно меняем после разговора</span></div><textarea id="ooo-decisions" placeholder="Решения, которые приняли на встрече"></textarea></div>
        <div class="ooo-section commitments-section"><div class="ooo-section-title"><b>6. Обязательства до следующего 1:1</b><span>Лучше 1–3 конкретных результата, чем длинный список задач</span></div><textarea id="ooo-commitments" placeholder="Что должно быть сделано к следующему разговору"></textarea></div>

        <div class="ooo-two-col">
          <div class="ooo-section"><div class="ooo-section-title"><b>7. Что нужно от меня</b><span>Решение, ресурс, контакт, снятие блока</span></div><textarea id="ooo-owner-needs" placeholder="Что должен сделать Андрей"></textarea></div>
          <div class="ooo-section"><div class="ooo-section-title"><b>8. Риск следующей недели</b><span>Что вероятнее всего сломает результат</span></div><textarea id="ooo-risks" placeholder="Один главный риск"></textarea></div>
        </div>

        <div class="ooo-scores">
          <label>Нагрузка <strong id="workload-value">5/10</strong><input id="ooo-workload" type="range" min="1" max="10" value="5"></label>
          <label>Ясность приоритетов <strong id="clarity-value">7/10</strong><input id="ooo-clarity" type="range" min="1" max="10" value="7"></label>
        </div>
        <div class="ooo-save-row"><span>После сохранения встреча попадёт в историю ${escapeHtml(selected.name)}</span><button class="management-primary" id="save-oneonone">Сохранить 1:1</button></div>
      </section>

      <aside class="oneonone-history"><div class="history-heading"><b>История</b><span>${history.length}</span></div>${history.length ? history.slice(0, 8).map((item) => historyHtml(item)).join('') : '<div class="ooo-empty">Пока встреч нет. После первого 1:1 здесь появится история решений и обязательств.</div>'}</aside>
    </div>`;

  root.querySelectorAll<HTMLButtonElement>('[data-select-member]').forEach((button) => button.addEventListener('click', () => renderOneOnOne(root, button.dataset.selectMember)));
  root.querySelector<HTMLButtonElement>('#add-metric')?.addEventListener('click', () => {
    root.querySelector('#metrics-list')?.insertAdjacentHTML('beforeend', metricRowHtml({ id: uid(), name: '', target: '', fact: '', comment: '' }));
  });
  const workload = root.querySelector<HTMLInputElement>('#ooo-workload');
  const clarity = root.querySelector<HTMLInputElement>('#ooo-clarity');
  workload?.addEventListener('input', () => { const node = root.querySelector('#workload-value'); if (node) node.textContent = `${workload.value}/10`; });
  clarity?.addEventListener('input', () => { const node = root.querySelector('#clarity-value'); if (node) node.textContent = `${clarity.value}/10`; });
  root.querySelector<HTMLButtonElement>('#save-oneonone')?.addEventListener('click', () => {
    const metricRows = [...root.querySelectorAll<HTMLElement>('.metric-row')].map((row) => ({
      id: row.dataset.metricId || uid(),
      name: row.querySelector<HTMLInputElement>('[data-field="name"]')?.value.trim() || '',
      target: row.querySelector<HTMLInputElement>('[data-field="target"]')?.value.trim() || '',
      fact: row.querySelector<HTMLInputElement>('[data-field="fact"]')?.value.trim() || '',
      comment: row.querySelector<HTMLInputElement>('[data-field="comment"]')?.value.trim() || '',
    })).filter((row) => row.name || row.target || row.fact || row.comment);
    const meeting: OneOnOne = {
      id: uid(), memberId: selected.id,
      date: root.querySelector<HTMLInputElement>('#ooo-date')?.value || todayValue(),
      metrics: metricRows,
      previousCommitments: root.querySelector<HTMLTextAreaElement>('#ooo-previous')?.value.trim() || '',
      wins: root.querySelector<HTMLTextAreaElement>('#ooo-wins')?.value.trim() || '',
      problems: root.querySelector<HTMLTextAreaElement>('#ooo-problems')?.value.trim() || '',
      decisions: root.querySelector<HTMLTextAreaElement>('#ooo-decisions')?.value.trim() || '',
      commitments: root.querySelector<HTMLTextAreaElement>('#ooo-commitments')?.value.trim() || '',
      ownerNeeds: root.querySelector<HTMLTextAreaElement>('#ooo-owner-needs')?.value.trim() || '',
      risks: root.querySelector<HTMLTextAreaElement>('#ooo-risks')?.value.trim() || '',
      workload: Number(workload?.value || 5), clarity: Number(clarity?.value || 7), createdAt: Date.now(),
    };
    const current = loadMeetings(); current.push(meeting); saveMeetings(current); renderOneOnOne(root, selected.id);
  });
}

function metricRowHtml(row: MetricRow) {
  return `<div class="metric-row" data-metric-id="${row.id}"><input data-field="name" placeholder="Показатель" value="${escapeHtml(row.name)}"><input data-field="target" placeholder="План" value="${escapeHtml(row.target)}"><input data-field="fact" placeholder="Факт" value="${escapeHtml(row.fact)}"><input data-field="comment" placeholder="Почему отклонение / комментарий" value="${escapeHtml(row.comment)}"></div>`;
}

function historyHtml(item: OneOnOne) {
  const metricSummary = item.metrics.slice(0, 3).filter((m) => m.name).map((m) => `${escapeHtml(m.name)}: ${escapeHtml(m.fact || '—')}`).join(' · ');
  return `<details class="history-item"><summary><div><strong>${formatDate(item.date)}</strong><span>${metricSummary || 'без цифр'}</span></div><b>›</b></summary><div class="history-body">${item.commitments ? `<p><label>Обязательства</label>${escapeHtml(item.commitments)}</p>` : ''}${item.decisions ? `<p><label>Решения</label>${escapeHtml(item.decisions)}</p>` : ''}${item.problems ? `<p><label>Буксуем</label>${escapeHtml(item.problems)}</p>` : ''}${item.ownerNeeds ? `<p><label>От меня</label>${escapeHtml(item.ownerNeeds)}</p>` : ''}<div class="history-scores"><span>Нагрузка ${item.workload}/10</span><span>Ясность ${item.clarity}/10</span></div></div></details>`;
}

export function initManagementWorkspace() {
  saveTeam(loadTeam());
  const observer = new MutationObserver(() => {
    ensureNavButtons();
    ensureRoot();
    syncTeamDatalist();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setTimeout(() => { ensureNavButtons(); ensureRoot(); syncTeamDatalist(); }, 0);
  document.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('.page-switch button');
    if (button && !button.dataset.managementPage) deactivateManagementPage();
  }, true);
}
