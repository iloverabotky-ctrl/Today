import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH missing');
const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => {
  if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text());
});

const now = Date.now();
const task = (id, title, order, city='spb') => ({
  id, title, columnId:'pool', boardOrder:order, inNotebook:false, notebookOrder:0, notebookAt:null,
  notebookCompleted:false, steps:[{id:id+'-s1',text:'Комментарий '+title,createdAt:now-60000,waitingPerson:'',remindAt:null}],
  waitingPerson:'', returnAt:null, assignee:'', deadline:null, project:'none', city, createdAt:now-order*1000, completedAt:null,
});
const store = {
  tasks:[task('t1','Важная срочная',0),task('t2','Операционная',1),task('t3','Развитие',2),task('t4','Когда-нибудь',3),task('k1','Краснодарская',4,'krasnodar')],
  columnTitles:{today:'Сегодня',week:'Неделя',month:'Месяц',delegated:'Делегировано команде',done:'Готово'},
  activeTaskId:null,
};
await page.addInitScript(value => {
  localStorage.setItem('today-cockpit-v2', JSON.stringify(value));
  localStorage.removeItem('today-eisenhower-v1');
}, store);

await page.goto('http://127.0.0.1:5173/', { waitUntil:'networkidle' });
const assert = (condition, message) => { if (!condition) throw new Error(message); };

await page.getByRole('button', {name:'Матрица'}).click();
await page.waitForSelector('.matrix-page');
assert(await page.locator('.matrix-quadrant').count() === 4, 'four quadrants expected');
assert(await page.locator('.matrix-task').count() === 5, 'all cities should show five tasks');

const assignByNumber = async (quadrantClass, value) => {
  const q = page.locator(quadrantClass);
  const input = q.locator('.matrix-manual input');
  await input.fill(String(value));
  await input.press('Enter');
  await page.waitForTimeout(100);
};

await assignByNumber('.q-urgent-important', 1);
await assignByNumber('.q-urgent-not-important', 1);
await assignByNumber('.q-important-not-urgent', 1);
await assignByNumber('.q-not-urgent-not-important', 1);

// Tasks reorder after each classification, so verify mapping through persisted assignments rather than fixed title order.
const matrix = await page.evaluate(() => JSON.parse(localStorage.getItem('today-eisenhower-v1') || '{}'));
assert(Object.keys(matrix).length === 4, 'four tasks should be classified');

const state = await page.evaluate(() => JSON.parse(localStorage.getItem('today-cockpit-v2') || '{}'));
const byId = Object.fromEntries(state.tasks.map(t => [t.id,t]));
for (const [id, quadrant] of Object.entries(matrix)) {
  if (quadrant === 'urgent-important') assert(byId[id].columnId === 'today', 'urgent important -> today');
  if (quadrant === 'urgent-not-important') assert(byId[id].columnId === 'today', 'operational -> today');
  if (quadrant === 'important-not-urgent') assert(byId[id].columnId === 'week', 'important not urgent -> week');
  if (quadrant === 'not-urgent-not-important') assert(byId[id].columnId === 'pool', 'long box -> pool');
}

await page.getByRole('button', {name:'Доска'}).click();
await page.waitForSelector('.v6-board');
const operationalId = Object.keys(matrix).find(id => matrix[id] === 'urgent-not-important');
assert(operationalId, 'operational task id expected');
const opCard = page.locator('.column-today .board-card.is-operational');
assert(await opCard.count() === 1, 'exactly one operational card expected in Today');
assert((await opCard.locator('.operation-chip').textContent())?.trim() === 'ОП', 'operational chip expected');
assert((await page.locator('.board-longbox-link').textContent())?.includes('1'), 'long box counter should be one');

await page.getByRole('button', {name:'Матрица'}).click();
await page.getByRole('button', {name:'СПб', exact:true}).click();
await page.waitForTimeout(80);
assert(await page.locator('.matrix-task').count() === 4, 'SPb filter should hide Krasnodar task');
await page.getByRole('button', {name:'Краснодар'}).click();
await page.waitForTimeout(80);
assert(await page.locator('.matrix-task').count() === 1, 'Krasnodar filter should show one task');

assert(errors.length === 0, 'browser errors: '+errors.join(' | '));
console.log('PASS matrix smoke', JSON.stringify({matrix}));
await browser.close();
