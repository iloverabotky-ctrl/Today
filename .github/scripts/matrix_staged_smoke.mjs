import { chromium } from 'playwright-core';

const chromePath=process.env.CHROME_PATH;
if(!chromePath) throw new Error('CHROME_PATH missing');
const browser=await chromium.launch({headless:true,executablePath:chromePath,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource')) errors.push(m.text())});
const now=Date.now();
const mk=(id,title,column='pool',extra={})=>({
 id,title,columnId:column,boardOrder:Number(id.replace(/\D/g,''))||0,inNotebook:false,notebookOrder:0,notebookAt:null,notebookCompleted:false,
 steps:[],waitingPerson:'',returnAt:null,assignee:'',deadline:null,project:'none',city:'spb',createdAt:now-(Number(id.replace(/\D/g,''))||0)*1000,completedAt:null,...extra
});
const tasks=[
 mk('t1','Срочная важная','pool',{steps:[{id:'s1',text:'уточнить детали',createdAt:now-5000,waitingPerson:'',remindAt:null}]}),
 mk('t2','Операционная','pool'),
 mk('t3','Развитие','pool'),
 mk('t4','Долгий ящик','pool'),
 mk('t5','Удалить меня','pool'),
 mk('b1','Сразу на доске','month'),
 mk('n1','Сразу в тетради','today',{inNotebook:true,notebookAt:now})
];
const store={tasks,columnTitles:{today:'Сегодня',week:'Неделя',month:'Месяц',delegated:'Делегировано команде',done:'Готово'},activeTaskId:null};
await page.addInitScript(store=>{
 localStorage.setItem('today-cockpit-v2',JSON.stringify(store));
 localStorage.removeItem('today-eisenhower-v1');
 localStorage.removeItem('today-eisenhower-origin-v1');
 localStorage.removeItem('today-eisenhower-transferred-v1');
 localStorage.removeItem('today-eisenhower-session-v1');
},store);
const assert=(v,m)=>{if(!v) throw new Error(m)};
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
await page.getByRole('button',{name:'Матрица'}).click();
await page.waitForSelector('.matrix-page');

// Only pool inbox tasks; direct board/notebook bypass matrix.
assert(await page.locator('.matrix-task').count()===5,'matrix must contain five pool tasks only');
assert(await page.locator('.matrix-task').filter({hasText:'Сразу на доске'}).count()===0,'board direct task leaked into matrix');
assert(await page.locator('.matrix-task').filter({hasText:'Сразу в тетради'}).count()===0,'notebook direct task leaked into matrix');

// Matrix fits desktop without document scrolling.
const scroll=await page.evaluate(()=>({h:document.documentElement.scrollHeight,v:window.innerHeight,mh:document.querySelector('.matrix-page')?.scrollHeight,mc:document.querySelector('.matrix-page')?.clientHeight}));
assert(scroll.h<=scroll.v+2,'matrix page creates document vertical scroll: '+JSON.stringify(scroll));
assert(scroll.mh<=scroll.mc+2,'matrix itself scrolls: '+JSON.stringify(scroll));

// Number is stable and assigning does not move to board.
const firstRow=page.locator('.matrix-task').filter({hasText:'Срочная важная'});
const num=(await firstRow.locator('.matrix-task-number').textContent())?.trim();
assert(num,'first task number missing');
await page.locator('.q-urgent-important .matrix-manual input').fill(num);
await page.locator('.q-urgent-important .matrix-manual input').press('Enter');
await page.waitForTimeout(100);
let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('today-cockpit-v2')||'{}'));
assert(state.tasks.find(t=>t.id==='t1').columnId==='pool','assignment moved task before Transfer');
assert(await firstRow.count()===0,'assigned task must leave inbox');
const chip=page.locator('.q-urgent-important .matrix-number-chip').filter({hasText:num});
assert(await chip.count()===1,'number chip missing in quadrant');
assert((await page.locator('.q-urgent-important').textContent())?.includes('Срочная важная')===false,'task title should not be written inside quadrant');

// Floating sheet from number.
await chip.click();
await page.waitForSelector('.matrix-sheet');
assert((await page.locator('.matrix-sheet h2').textContent())==='Срочная важная','sheet title wrong');
await page.locator('.matrix-sheet-top button').click();

// Transfer then disappear from matrix and appear on board.
await page.locator('.q-urgent-important .matrix-transfer').click();
await page.waitForTimeout(120);
state=await page.evaluate(()=>JSON.parse(localStorage.getItem('today-cockpit-v2')||'{}'));
assert(state.tasks.find(t=>t.id==='t1').columnId==='today','urgent important did not move to Today');
const transferred=await page.evaluate(()=>JSON.parse(localStorage.getItem('today-eisenhower-transferred-v1')||'{}'));
assert(transferred.t1===true,'transferred flag missing');
assert(await page.locator('.matrix-number-chip').filter({hasText:num}).count()===0,'transferred task still shown in matrix');

// Operational -> today, Development -> week, Longbox -> pool but hidden.
const assignTitle=async(title,q)=>{
 const row=page.locator('.matrix-task').filter({hasText:title});
 const n=(await row.locator('.matrix-task-number').textContent())?.trim();
 await page.locator(q+' .matrix-manual input').fill(n);
 await page.locator(q+' .matrix-manual input').press('Enter');
 await page.locator(q+' .matrix-transfer').click();
 await page.waitForTimeout(90);
 return n;
};
await assignTitle('Операционная','.q-urgent-not-important');
await assignTitle('Развитие','.q-important-not-urgent');
await assignTitle('Долгий ящик','.q-not-urgent-not-important');
state=await page.evaluate(()=>JSON.parse(localStorage.getItem('today-cockpit-v2')||'{}'));
assert(state.tasks.find(t=>t.id==='t2').columnId==='today','operational not in Today');
assert(state.tasks.find(t=>t.id==='t3').columnId==='week','development not in Week');
assert(state.tasks.find(t=>t.id==='t4').columnId==='pool','longbox storage changed');
assert(await page.locator('.matrix-task').filter({hasText:'Долгий ящик'}).count()===0,'longbox transferred task still in matrix');

// Delete from incoming.
const deleteRow=page.locator('.matrix-task').filter({hasText:'Удалить меня'});
await deleteRow.hover();
await deleteRow.locator('.matrix-task-tools .delete').click();
await page.waitForTimeout(80);
state=await page.evaluate(()=>JSON.parse(localStorage.getItem('today-cockpit-v2')||'{}'));
assert(!state.tasks.some(t=>t.id==='t5'),'matrix delete did not remove task');

// Board destinations and OP marker.
await page.getByRole('button',{name:'Доска'}).click();
await page.waitForSelector('.v6-board');
assert(await page.locator('.column-today .board-card').filter({hasText:'Срочная важная'}).count()===1,'urgent important missing on board');
const op=page.locator('.column-today .board-card').filter({hasText:'Операционная'});
assert(await op.count()===1,'operational task missing in Today');
assert(await op.locator('.operation-chip').count()===1,'OP marker missing');
assert(await page.locator('.column-week .board-card').filter({hasText:'Развитие'}).count()===1,'development missing in Week');
assert((await page.locator('.board-longbox-link').textContent())?.includes('1'),'longbox count should be one');

assert(errors.length===0,'browser errors: '+errors.join(' | '));
console.log('PASS matrix staged transfer smoke');
await browser.close();
