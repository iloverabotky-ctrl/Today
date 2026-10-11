import { chromium } from 'playwright-core';
import fs from 'fs';

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const now = Date.now();
const mk = (id, title, column='pool', project='none', extra={}) => ({
  id, title, columnId: column, boardOrder: Number(id.replace(/\D/g,'')) || 0,
  inNotebook: false, notebookOrder: 0, notebookAt: null, notebookCompleted: false,
  steps: [], waitingPerson: '', returnAt: null, assignee: '', deadline: null,
  project, city: 'spb', createdAt: now - (Number(id.replace(/\D/g,'')) || 0) * 1000,
  completedAt: null, ...extra
});
const steps = (text) => [{ id: 's' + Math.random().toString(36).slice(2), text, createdAt: now - 10000, waitingPerson: '', remindAt: null }];
const store = {
  tasks: [
    mk('n1','Доработать TODAY','today','none',{inNotebook:true, notebookAt:now-6000, steps:steps('Проверить типографику всех экранов')}),
    mk('n2','Сделать единый файл для управляющих','today','pasta',{inNotebook:true, notebookAt:now-5000, steps:steps('Собрать комментарии и финализировать')}),
    mk('b1','Подготовить запуск Пасты','today','pasta',{deadline:now+86400000, steps:steps('Согласовать меню и закуп')}),
    mk('b2','Собрать отчёт КВЭП','week','kvep',{steps:steps('Жду выгрузку по продажам')}),
    mk('b3','Ответ от Наташи','delegated','pasta',{waitingPerson:'Наташа', assignee:'Наташа', returnAt:now+86400000, deadline:now+86400000}),
    mk('b4','Просроченный ответ','delegated','kvep',{waitingPerson:'Анита', assignee:'Анита', returnAt:now-86400000, deadline:now-86400000}),
    mk('m1','Срочно закрыть вопрос','pool','pasta'),
    mk('m2','Операционная задача','pool','kvep'),
    mk('m3','Развитие проекта','pool','pasta'),
    mk('m4','Долгий ящик','pool','none'),
    mk('m5','Просто входящая задача','pool','none')
  ],
  columnTitles: { today:'Сегодня', week:'Неделя', month:'Месяц', delegated:'Делегировано команде', done:'Готово' },
  activeTaskId: 'n1'
};
await page.addInitScript(({ store }) => {
  localStorage.setItem('today-cockpit-v2', JSON.stringify(store));
  localStorage.setItem('today-eisenhower-v1', JSON.stringify({m1:'urgent-important',m2:'urgent-not-important',m3:'important-not-urgent',m4:'not-urgent-not-important'}));
  localStorage.setItem('today-eisenhower-transferred-v1', '{}');
  localStorage.setItem('today-eisenhower-session-v1', JSON.stringify({all:['m1','m2','m3','m4','m5'], spb:['m1','m2','m3','m4','m5'], krasnodar:[]}));
  localStorage.setItem('today-team-v1', JSON.stringify([
    {id:'natasha', name:'Наташа', role:'Управляющая Паста', fixed:true},
    {id:'anita', name:'Анита', role:'Региональный управляющий', fixed:true},
    {id:'zhenya', name:'Женя', role:'КВЭП СПб', fixed:true},
    {id:'ksusha', name:'Ксюша', role:'Маркетинг', fixed:true},
    {id:'olga', name:'Ольга', role:'Финансы', fixed:true}
  ]));
}, { store });

const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text()); });
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
fs.mkdirSync('.github/tmp/audit', { recursive: true });

const shots = [];
async function shot(name){
  await page.waitForTimeout(180);
  const path = `.github/tmp/audit/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  shots.push(path);
}
await shot('01_notebook');
await page.getByRole('button', {name:'Доска'}).click(); await shot('02_board');
await page.locator('.page-switch button').filter({hasText:'Матрица'}).click(); await shot('03_matrix');
await page.locator('.page-switch button').filter({hasText:'Жду'}).first().click(); await shot('04_waiting');
await page.waitForSelector('.page-switch button[data-safe-management="team"]',{timeout:5000});
await page.locator('.page-switch button[data-safe-management="team"]').click(); await shot('05_team');
await page.locator('.page-switch button[data-safe-management="oneonone"]').click(); await shot('06_oneonone');

// Functional checks
const results = [];
function push(section, test, status, note='') { results.push({ section, test, status, note }); }
try {
  await page.locator('.page-switch button').filter({hasText:'Матрица'}).click();
  await page.waitForSelector('.matrix-page');
  const row = page.locator('.matrix-task').filter({hasText:'Просто входящая задача'});
  const rowCount = await row.count();
  push('Матрица','Входящие открываются и задача видна', rowCount > 0 ? 'pass' : 'fail');
  const firstChip = page.locator('.matrix-number-chip').first();
  push('Матрица','Номера задач в квадратах отображаются', await firstChip.count() > 0 ? 'pass' : 'fail');
  const transferText = await page.locator('.q-urgent-important .matrix-transfer').textContent();
  push('Матрица','Кнопка переноса показывает количество', /Перенести\s+1/.test(transferText || '') ? 'pass' : 'warn', transferText || '');
} catch(e) { push('Матрица','Сценарий сортировки', 'fail', String(e)); }
try {
  await page.getByRole('button', {name:'Доска'}).click();
  await page.waitForSelector('.v6-board');
  push('Доска','Колонки Today/Week/Delegated рендерятся', await page.locator('.board-column').count() >= 4 ? 'pass' : 'fail');
  push('Доска','Карточки задач видны', await page.locator('.board-card').count() > 0 ? 'pass' : 'fail');
  push('Доска','Долгий ящик доступен', await page.locator('.board-longbox-link').count() > 0 ? 'pass' : 'fail');
} catch(e) { push('Доска','Базовый сценарий', 'fail', String(e)); }
try {
  await page.getByRole('button', {name:/Тетрадь/}).click();
  await page.waitForSelector('.nb5-page');
  push('Тетрадь','Список задач виден', await page.locator('.nb5-row').count() > 0 ? 'pass' : 'fail');
  push('Тетрадь','Активная задача подсвечена', await page.locator('.nb5-row.active').count() > 0 ? 'pass' : 'warn');
} catch(e) { push('Тетрадь','Базовый сценарий', 'fail', String(e)); }
try {
  await page.locator('.page-switch button').filter({hasText:'Жду'}).first().click();
  await page.waitForSelector('.wait-page-v2');
  push('Жду','Группы ожидания показываются', await page.locator('.wait-person').count() > 0 ? 'pass' : 'warn');
  push('Жду','Просрочка имеет отдельное состояние', await page.locator('.wait-row.is-due').count() > 0 ? 'pass' : 'warn');
} catch(e) { push('Жду','Базовый сценарий', 'fail', String(e)); }
try {
  await page.locator('.page-switch button[data-safe-management="team"]').click();
  await page.waitForSelector('.management-page');
  push('Команда','Карточки сотрудников видны', await page.locator('.team-card').count() >= 5 ? 'pass' : 'warn');
  const addButton = page.locator('button').filter({hasText:/Добавить/}).first();
  push('Команда','Добавление сотрудника доступно', await addButton.count() > 0 ? 'pass' : 'warn');
} catch(e) { push('Команда','Базовый сценарий', 'fail', String(e)); }
try {
  await page.locator('.page-switch button[data-safe-management="oneonone"]').click();
  await page.waitForSelector('.oneonone-layout');
  push('1:1','Форма 1:1 открывается', await page.locator('.oneonone-form-card').count() > 0 ? 'pass' : 'fail');
  push('1:1','История 1:1 есть отдельным блоком', await page.locator('.oneonone-history').count() > 0 ? 'pass' : 'warn');
} catch(e) { push('1:1','Базовый сценарий', 'fail', String(e)); }

// Typography metrics: sample font sizes and line heights
const typography = await page.evaluate(() => {
  const take = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { selector: sel, fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight, color: cs.color };
  };
  return [
    take('.page-switch button'), take('.matrix-task-title'), take('.matrix-q-title strong'), take('.v6-board .card-title'), take('.nb5-title'), take('.wait-row-title strong'), take('.team-person strong'), take('.ooo-section textarea')
  ].filter(Boolean);
});

fs.writeFileSync('.github/tmp/audit/review.json', JSON.stringify({ results, typography, browserErrors: errors }, null, 2));
if (errors.length) throw new Error(errors.join(' | '));
await browser.close();
