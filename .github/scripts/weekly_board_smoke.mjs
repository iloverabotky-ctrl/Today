import { chromium } from 'playwright-core';

const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1536,height:960}});
const now=Date.now();
const mk=(id,title,column='pool',extra={})=>({
 id,title,columnId:column,boardOrder:0,inNotebook:false,notebookOrder:0,notebookAt:null,notebookCompleted:false,
 steps:[],subtasks:[],waitingPerson:'',returnAt:null,assignee:'',deadline:null,plannedStart:null,plannedEnd:null,
 project:'none',city:'spb',createdAt:now,completedAt:null,...extra
});
const store={tasks:[
 mk('m1','Матрица красная','pool',{project:'pasta'}),
 mk('legacyToday','Старая Сегодня','today'),
 mk('legacyWeek','Старая Неделя','week')
],columnTitles:{today:'Сегодня',week:'Неделя',month:'Месяц',delegated:'Делегировано команде',done:'Готово'},activeTaskId:null};
await page.addInitScript(({store})=>{
 localStorage.setItem('today-cockpit-v2',JSON.stringify(store));
 localStorage.setItem('today-eisenhower-v1',JSON.stringify({m1:'urgent-important'}));
 localStorage.setItem('today-eisenhower-transferred-v1',JSON.stringify({}));
 localStorage.setItem('today-eisenhower-session-v1',JSON.stringify({all:['m1'],spb:['m1'],krasnodar:[]}));
 localStorage.setItem('today-team-v1',JSON.stringify([{id:'natasha',name:'Наташа',role:'Управляющая'}]));
}, {store});
const ok=(v,m)=>{if(!v) throw new Error(m)};
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});

// Legacy migration and weekly board existence.
await page.getByRole('button',{name:'Доска'}).click();
await page.waitForSelector('.weekly-board-grid');
ok(await page.locator('.column-inbox').count()===1,'Inbox column missing');
for(const id of ['mon','tue','wed','thu','fri','sat','sun']) ok(await page.locator('.column-'+id).count()===1,'Day missing '+id);
ok(await page.locator('.column-inbox .board-card').filter({hasText:'Старая Неделя'}).count()===1,'Legacy week did not migrate to Inbox');
ok(await page.locator('.weekly-board-scroll').evaluate(el=>el.scrollWidth>el.clientWidth),'Board should horizontally scroll to Month/Delegated/Done');

// Matrix -> Inbox, priority preserved.
await page.locator('.page-switch button').filter({hasText:'Матрица'}).click();
const transfer=page.locator('.q-urgent-important .matrix-transfer');
await transfer.click();
await page.locator('.page-switch button').filter({hasText:'Доска'}).click();
const incoming=page.locator('.column-inbox .board-card').filter({hasText:'Матрица красная'});
ok(await incoming.count()===1,'Matrix task did not land in Inbox');
ok(await incoming.locator('.board-priority-chip').filter({hasText:'Срочно / Важно'}).count()===1,'Matrix priority did not persist');

// Drag Inbox -> Monday.
await incoming.dragTo(page.locator('.column-mon'));
await page.waitForTimeout(100);
const monday=page.locator('.column-mon .board-card').filter({hasText:'Матрица красная'});
ok(await monday.count()===1,'Task did not move Inbox -> Monday');
ok(await monday.locator('.board-priority-chip').count()===1,'Priority lost after day move');

// Add exact time.
await monday.hover();
await monday.getByRole('button',{name:'Время'}).click();
await page.waitForSelector('.time-modal');
const timeInputs=page.locator('.time-modal input[type="datetime-local"]');
await timeInputs.nth(0).fill('2026-10-26T10:00');
await timeInputs.nth(1).fill('2026-10-26T11:30');
await page.locator('.time-modal .primary').click();
await page.waitForTimeout(80);
ok((await monday.locator('.planned-time').textContent())?.includes('10:00–11:30'),'Planned time badge missing');

// Day -> Notebook.
await monday.hover();
await monday.getByRole('button',{name:'В тетрадь'}).click();
await page.waitForSelector('.modal-card');
await page.locator('.modal-card .primary').click();
await page.locator('.page-switch button').filter({hasText:'Тетрадь'}).click();
const noteRow=page.locator('.nb5-row').filter({hasText:'Матрица красная'});
ok(await noteRow.count()===1,'Task did not enter Notebook');

// Add subtask in inspector.
await noteRow.locator('.nb5-title').click();
await page.waitForSelector('.nb5-inspector');
const subInput=page.locator('.nb5-subtasks input');
await subInput.fill('Проверить цифры');
await subInput.press('Enter');
ok(await page.locator('.nb5-subtask-list').filter({hasText:'Проверить цифры'}).count()===1,'Subtask add failed');

// Delegate from Notebook.
await page.locator('.nb5-inspector-footer .delegate').click();
await page.waitForSelector('.modal-card');
await page.locator('.modal-card select').selectOption({label:'Наташа'});
await page.locator('.modal-card .primary').click();
await page.waitForTimeout(100);
ok(await page.locator('.nb5-row').filter({hasText:'Матрица красная'}).count()===0,'Delegated task should leave Notebook');
await page.locator('.page-switch button').filter({hasText:'Делегировано'}).first().click();
ok(await page.locator('.delegated-page').filter({hasText:'Матрица красная'}).count()===1,'Delegated task missing from Delegated tab');

// Same task also in Delegated board column.
await page.locator('.page-switch button').filter({hasText:'Доска'}).click();
const boardScroll=page.locator('.weekly-board-scroll');
await boardScroll.evaluate(el=>el.scrollLeft=el.scrollWidth);
await page.waitForTimeout(80);
const delegatedCard=page.locator('.column-delegated .board-card').filter({hasText:'Матрица красная'});
ok(await delegatedCard.count()===1,'Delegated task missing from delegated board column');
ok(await delegatedCard.locator('.board-priority-chip').count()===1,'Priority lost after delegation');

// Done.
await delegatedCard.hover();
await delegatedCard.getByRole('button',{name:'Готово'}).click();
await page.waitForTimeout(80);
ok(await page.locator('.column-done .board-card').filter({hasText:'Матрица красная'}).count()===1,'Task missing from Done');
ok(await page.locator('.column-done .board-priority-chip').filter({hasText:'Срочно / Важно'}).count()===1,'Priority lost in Done');

console.log('PASS weekly board lifecycle smoke');
await browser.close();
