import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH missing');
const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

const now = Date.now();
const task = (id, title, order, steps) => ({
  id, title, columnId:'today', boardOrder:order, inNotebook:true, notebookOrder:order, notebookAt:now-1000,
  notebookCompleted:false, steps:steps.map((text,i)=>({id:`${id}-s${i}`,text,createdAt:now-(steps.length-i)*60000,waitingPerson:'',remindAt:null})),
  waitingPerson:'', returnAt:null, assignee:'', deadline:null, project:order%2?'kvep':'pasta', city:'spb', createdAt:now-(order+1)*3600000, completedAt:null,
});
const store = { tasks:[
  task('t1','Первая задача',0,['Первый старый шаг','Первый текущий шаг']),
  task('t2','Вторая задача',1,['Второй старый шаг','Второй текущий шаг']),
  task('t3','Третья задача',2,['Третий текущий шаг'])
], columnTitles:{today:'Сегодня',week:'Неделя',month:'Месяц',delegated:'Делегировано',done:'Готово'}, activeTaskId:'t1' };
await page.addInitScript(value => localStorage.setItem('today-cockpit-v2', JSON.stringify(value)), store);
await page.goto('http://127.0.0.1:5173/', { waitUntil:'networkidle' });
await page.waitForSelector('.nb5-row');

const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(await page.locator('.nb5-row').count() === 3, 'three notebook rows expected');
assert(await page.locator('.nb5-inspector').isVisible(), 'inspector should be visible');

const rects = await page.locator('.nb5-row').evaluateAll(rows => rows.map(row => { const r=row.getBoundingClientRect(); return {height:r.height,x:r.x,width:r.width}; }));
assert(rects.every(r => Math.abs(r.height-rects[0].height)<0.5), 'rows must have equal height');
assert(rects.every(r => Math.abs(r.x-rects[0].x)<0.5), 'rows must share left edge');

await page.locator('.nb5-row[data-task-id="t2"] .nb5-title').click();
assert(await page.locator('.nb5-inspector-title').inputValue() === 'Вторая задача', 'title click must select inspector task');

await page.locator('.nb5-row[data-task-id="t2"] .nb5-current-action').click();
const inline = page.locator('.nb5-row[data-task-id="t2"] .nb5-current-cell input');
await inline.fill('Второй шаг изменён');
await inline.press('Enter');
await page.waitForTimeout(100);
assert((await page.locator('.nb5-row[data-task-id="t2"] .nb5-current-action').textContent())?.includes('изменён'), 'inline edit must persist');

await page.locator('.nb5-row[data-task-id="t2"]').hover();
await page.locator('.nb5-row[data-task-id="t2"] button[title="Следующий шаг"]').click();
const next = page.locator('#nb5-panel-next');
await next.fill('Новый текущий шаг');
await next.press('Enter');
await page.waitForTimeout(120);
assert((await page.locator('.nb5-row[data-task-id="t2"] .nb5-current-action').textContent())?.includes('Новый текущий'), 'next step must become current');

await page.locator('.nb5-inspector-current button[title="Удалить шаг"]').click();
await page.waitForTimeout(100);
assert((await page.locator('.nb5-row[data-task-id="t2"] .nb5-current-action').textContent())?.includes('изменён'), 'previous step must become current after delete');

await page.getByRole('button', { name:/Сделать СЕЙЧАС/ }).click();
await page.waitForTimeout(100);
assert((await page.locator('.nb5-row[data-task-id="t2"]').getAttribute('class'))?.includes('active'), 'focus action must activate task');

await page.locator('.nb5-inspector-footer').getByRole('button', { name:/ЖДУ \/ напомнить/ }).click();
await page.waitForSelector('.reminder-modal');
await page.keyboard.press('Escape');
await page.waitForTimeout(80);

await page.locator('.nb5-inspector-footer').getByRole('button', { name:'✓ Выполнено' }).click();
await page.waitForTimeout(120);
assert(await page.locator('.nb5-completed-summary').isVisible(), 'completed summary must appear');

await page.locator('.nb5-row[data-task-id="t1"] .nb5-title').click();
await page.locator('.nb5-inspector-icons button[title="Глубокий режим"]').click();
await page.waitForSelector('.task-focus-overlay');
await page.keyboard.press('Escape');

assert(errors.length === 0, `browser errors: ${errors.join(' | ')}`);
console.log('PASS notebook v5 smoke');
console.log(JSON.stringify({rects}));
await browser.close();
