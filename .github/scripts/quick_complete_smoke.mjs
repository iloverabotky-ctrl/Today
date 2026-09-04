import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH missing');
const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });

const now = Date.now();
const task = (id, title, order, project) => ({
  id, title, columnId:'today', boardOrder:order, inNotebook:true, notebookOrder:order, notebookAt:now-1000,
  notebookCompleted:false, steps:[{id:`${id}-s1`,text:'Текущий шаг',createdAt:now-60000,waitingPerson:'',remindAt:null}],
  waitingPerson:'', returnAt:null, assignee:'', deadline:null, project, city:'spb', createdAt:now-(order+1)*3600000, completedAt:null,
});
const store = { tasks:[task('t1','Первая задача',0,'pasta'),task('t2','Вторая задача',1,'kvep')], columnTitles:{today:'Сегодня',week:'Неделя',month:'Месяц',delegated:'Делегировано',done:'Готово'}, activeTaskId:null };
await page.addInitScript(value => localStorage.setItem('today-cockpit-v2', JSON.stringify(value)), store);
await page.goto('http://127.0.0.1:5173/', { waitUntil:'networkidle' });
await page.waitForSelector('.nb5-row');

const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(await page.locator('.nb5-row').count() === 2, 'two working rows expected');
assert(await page.locator('.nb5-quick-complete').count() === 2, 'quick complete must exist on each row');
const geom = await page.locator('.nb5-row[data-task-id="t1"] .nb5-quick-complete').evaluate(el => {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return { width:r.width, height:r.height, opacity:Number(s.opacity), display:s.display };
});
assert(geom.width >= 17 && geom.height >= 17, 'quick complete must be easy to hit');
assert(geom.opacity >= 0.6, 'quick complete must be visible at rest');

await page.locator('.nb5-row[data-task-id="t1"] .nb5-quick-complete').click();
await page.waitForTimeout(120);
assert(await page.locator('.nb5-list .nb5-row').count() === 1, 'completed task must leave active list');
assert(await page.locator('.nb5-completed-summary').isVisible(), 'completed summary must appear');
assert((await page.locator('.nb5-completed-summary').textContent())?.includes('1'), 'completed summary must show one task');

await page.locator('.nb5-completed-summary').click();
await page.waitForTimeout(80);
const completedButton = page.locator('.nb5-completed-list .nb5-row[data-task-id="t1"] .nb5-quick-complete');
assert(await completedButton.isVisible(), 'completed task must retain quick restore control');
await completedButton.click();
await page.waitForTimeout(120);
assert(await page.locator('.nb5-list .nb5-row').count() === 2, 'restored task must return to active list');
assert(errors.length === 0, `browser errors: ${errors.join(' | ')}`);
console.log('PASS quick complete smoke', JSON.stringify(geom));
await browser.close();
