import { chromium } from 'playwright-core';

const chromePath=process.env.CHROME_PATH;
if(!chromePath) throw new Error('CHROME_PATH missing');
const browser=await chromium.launch({headless:true,executablePath:chromePath,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1500,height:1000}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource')) errors.push(m.text())});
const now=Date.now();
const mk=(id,title,column='pool',extra={})=>({
 id,title,columnId:column,boardOrder:Number(id.replace(/\D/g,''))||0,inNotebook:false,notebookOrder:0,notebookAt:null,notebookCompleted:false,
 steps:[],waitingPerson:'',returnAt:null,assignee:'',deadline:null,project:'none',city:'spb',createdAt:now-100000,completedAt:null,...extra
});
const tasks=[
 mk('t1','Быстрый входящий','pool'),
 mk('t2','Второй входящий','pool'),
 mk('t3','Вернуть в месяц','month'),
 mk('t4','Обычный дедлайн','today',{deadline:now+86400000}),
 mk('t5','Делегированная задача','delegated',{assignee:'Наташа',waitingPerson:'Наташа',deadline:now+172800000,returnAt:now+172800000}),
 mk('t6','Жду комментарий','week',{waitingPerson:'Анита',returnAt:now-60000,steps:[{id:'s6',text:'Жду финальную цифру',createdAt:now-200000,waitingPerson:'',remindAt:null}]}),
 mk('t7','Задача в тетради','today',{inNotebook:true,notebookAt:now-1000})
];
const store={tasks,columnTitles:{today:'Сегодня',week:'Неделя',month:'Месяц',delegated:'Делегировано команде',done:'Готово'},activeTaskId:null};
await page.addInitScript(store=>{
 localStorage.setItem('today-cockpit-v2',JSON.stringify(store));
 localStorage.removeItem('today-eisenhower-v1');
 localStorage.removeItem('today-eisenhower-origin-v1');
 localStorage.removeItem('today-eisenhower-session-v1');
 localStorage.setItem('today-team-v1',JSON.stringify([{id:'natasha',name:'Наташа',role:'Управляющая'}]));
},store);
const assert=(v,m)=>{if(!v) throw new Error(m)};
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});

// Matrix: notebook task excluded and numbering stable.
await page.getByRole('button',{name:'Матрица'}).click();
await page.waitForSelector('.matrix-page');
assert((await page.locator('.matrix-task-title').allTextContents()).every(t=>!t.includes('Задача в тетради')),'notebook task must not enter matrix');

const monthRow=page.locator('.matrix-task').filter({hasText:'Вернуть в месяц'});
const monthNumber=(await monthRow.locator('.matrix-task-number').textContent())?.trim();
const secondRow=page.locator('.matrix-task').filter({hasText:'Второй входящий'});
const secondNumberBefore=(await secondRow.locator('.matrix-task-number').textContent())?.trim();
assert(monthNumber,'month task number missing');
await page.locator('.q-urgent-important .matrix-manual input').fill(monthNumber);
await page.locator('.q-urgent-important .matrix-manual input').press('Enter');
await page.waitForTimeout(120);
assert(await page.locator('.matrix-task').filter({hasText:'Вернуть в месяц'}).count()===0,'classified task should leave inbox');
const qTask=page.locator('.q-urgent-important .matrix-q-task').filter({hasText:'Вернуть в месяц'});
assert(await qTask.count()===1,'classified task missing from quadrant');
assert((await qTask.locator('b').textContent())?.trim()===monthNumber,'matrix number changed after classification');
const secondNumberAfter=(await page.locator('.matrix-task').filter({hasText:'Второй входящий'}).locator('.matrix-task-number').textContent())?.trim();
assert(secondNumberBefore===secondNumberAfter,'another task number shifted after classification');

// Restore to original month.
await qTask.locator('.matrix-q-remove').click();
await page.waitForTimeout(120);
assert(await page.locator('.matrix-task').filter({hasText:'Вернуть в месяц'}).count()===1,'restored task should return to inbox');
let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('today-cockpit-v2')||'{}'));
assert(state.tasks.find(t=>t.id==='t3').columnId==='month','matrix restore must return original column');

// Board deadlines + delegated combined row.
await page.getByRole('button',{name:'Доска'}).click();
await page.waitForSelector('.v6-board');
const normal=page.locator('.board-card').filter({hasText:'Обычный дедлайн'});
assert(await normal.locator('.board-deadline').count()===1,'ordinary deadline should be visible');
const delegated=page.locator('.board-card').filter({hasText:'Делегированная задача'});
assert(await delegated.locator('.delegated-wait-line').count()===1,'delegated wait line missing');
assert((await delegated.locator('.delegated-wait-line').textContent())?.includes('ЖДУ · Наташа'),'delegated person missing');
assert(await delegated.locator('.deadline-chip').count()===0,'old deadline chip should not be used');

// Deadline editor.
await normal.locator('.board-deadline').click();
await page.waitForSelector('.deadline-modal');
await page.locator('.deadline-modal .return-options button').filter({hasText:'завтра 12:00'}).click();
await page.locator('.deadline-modal .primary').click();
await page.waitForTimeout(100);
state=await page.evaluate(()=>JSON.parse(localStorage.getItem('today-cockpit-v2')||'{}'));
assert(Boolean(state.tasks.find(t=>t.id==='t4').deadline),'deadline save failed');

// Wait screen uses new flat rows.
await page.getByRole('button',{name:/Жду/}).click();
await page.waitForSelector('.wait-page-v2');
assert(await page.locator('.wait-row').count()>=2,'new wait rows missing');
assert(await page.locator('.person-task').count()===0,'legacy wait cards still rendered');

// Team cards + explicit cancel.
await page.waitForSelector('.page-switch button[data-safe-management="team"]',{timeout:5000});
await page.locator('.page-switch button[data-safe-management="team"]').click();
await page.waitForSelector('#today-management-root:not([hidden])');
assert(await page.locator('.team-card').count()>=1,'team cards missing');
await page.locator('#safe-add-member').click();
assert(!(await page.locator('#safe-add-panel').getAttribute('hidden')),'add panel should open');
assert(await page.locator('#safe-cancel-member').count()===1,'cancel button missing');
await page.locator('#safe-name').fill('Тест');
await page.locator('#safe-cancel-member').click();
assert((await page.locator('#safe-add-panel').getAttribute('hidden'))!==null,'cancel should close add panel');
assert((await page.locator('#safe-name').inputValue())==='','cancel should clear name');

assert(errors.length===0,'browser errors: '+errors.join(' | '));
console.log('PASS workspace polish smoke',{monthNumber,secondNumberBefore});
await browser.close();
