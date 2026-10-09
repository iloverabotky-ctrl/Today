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
 mk('t5','Удалить и вернуть','pool'),
 mk('b1','Сразу на доске','month')
];
const store={tasks,columnTitles:{today:'Сегодня',week:'Неделя',month:'Месяц',delegated:'Делегировано команде',done:'Готово'},activeTaskId:null};
await page.addInitScript(store=>{
 localStorage.setItem('today-cockpit-v2',JSON.stringify(store));
 localStorage.removeItem('today-eisenhower-v1');
 localStorage.removeItem('today-eisenhower-origin-v1');
 localStorage.setItem('today-eisenhower-transferred-v1',JSON.stringify({}));
 localStorage.removeItem('today-eisenhower-session-v1');
},store);
const assert=(v,m)=>{if(!v) throw new Error(m)};
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});

// nav counter
const matrixNav=page.locator('.page-switch button').filter({hasText:'Матрица'});
assert((await matrixNav.textContent())?.includes('5'),'matrix nav counter should show five');
await matrixNav.click();
await page.waitForSelector('.matrix-page');

// single-screen desktop
const scroll=await page.evaluate(()=>({h:document.documentElement.scrollHeight,v:innerHeight,mh:document.querySelector('.matrix-page')?.scrollHeight,mc:document.querySelector('.matrix-page')?.clientHeight}));
assert(scroll.h<=scroll.v+2,'document scroll on matrix '+JSON.stringify(scroll));
assert(scroll.mh<=scroll.mc+2,'matrix internal scroll '+JSON.stringify(scroll));

// New analysis moved under menu
assert(await page.locator('.matrix-new-session').count()===0,'old visible new-session button still exists');
await page.locator('.matrix-more summary').click();
assert(await page.locator('.matrix-more button').filter({hasText:'Новый разбор'}).count()===1,'new analysis missing from menu');
await page.locator('.matrix-more summary').click();

// assign via manual and keep in list
const row=page.locator('.matrix-task').filter({hasText:'Срочная важная'});
const n=(await row.locator('.matrix-task-number').textContent())?.trim();
assert(n,'task number missing');
await page.locator('.q-urgent-important .matrix-manual input').fill(n);
await page.locator('.q-urgent-important .matrix-manual input').press('Enter');
await page.waitForTimeout(80);
assert(await page.locator('.matrix-task').filter({hasText:'Срочная важная'}).count()===1,'assigned task disappeared from list before transfer');
assert(await page.locator('.matrix-task').filter({hasText:'Срочная важная'}).locator('.matrix-assignment').count()===1,'assignment badge missing');
const chip=page.locator('.q-urgent-important .matrix-number-chip').filter({hasText:n});
assert(await chip.count()===1,'number chip missing');
assert((await chip.getAttribute('data-title'))==='Срочная важная','hover title data missing');
assert((await page.locator('.q-urgent-important .matrix-transfer').textContent())?.includes('Перенести 1 → Сегодня'),'transfer button should show count and target');

// drag another task and keep it in list
const opRow=page.locator('.matrix-task').filter({hasText:'Операционная'});
await opRow.dragTo(page.locator('.q-urgent-not-important'));
await page.waitForTimeout(100);
assert(await page.locator('.matrix-task').filter({hasText:'Операционная'}).count()===1,'dragged task disappeared from list');
assert(await page.locator('.q-urgent-not-important .matrix-number-chip').count()===1,'drag assignment failed');

// transfer first quadrant
await page.locator('.q-urgent-important .matrix-transfer').click();
await page.waitForTimeout(100);
assert(await page.locator('.matrix-task').filter({hasText:'Срочная важная'}).count()===0,'transferred task remains in matrix list');
let state=await page.evaluate(()=>JSON.parse(localStorage.getItem('today-cockpit-v2')||'{}'));
assert(state.tasks.find(t=>t.id==='t1').columnId==='today','transfer did not send task to Today');
assert((await page.locator('.page-switch button').filter({hasText:'Матрица'}).textContent())?.includes('4'),'matrix nav counter should decrease');

// delete + undo
const delRow=page.locator('.matrix-task').filter({hasText:'Удалить и вернуть'});
await delRow.hover();
await delRow.locator('.matrix-task-tools .delete').click();
await page.waitForSelector('.matrix-undo-toast');
state=await page.evaluate(()=>JSON.parse(localStorage.getItem('today-cockpit-v2')||'{}'));
assert(!state.tasks.some(t=>t.id==='t5'),'delete failed');
await page.locator('.matrix-undo-toast button').filter({hasText:'Отменить'}).click();
await page.waitForTimeout(80);
state=await page.evaluate(()=>JSON.parse(localStorage.getItem('today-cockpit-v2')||'{}'));
assert(state.tasks.some(t=>t.id==='t5'),'undo delete failed');

// longbox transfer + drawer
const longRow=page.locator('.matrix-task').filter({hasText:'Долгий ящик'});
const ln=(await longRow.locator('.matrix-task-number').textContent())?.trim();
await page.locator('.q-not-urgent-not-important .matrix-manual input').fill(ln);
await page.locator('.q-not-urgent-not-important .matrix-manual input').press('Enter');
await page.locator('.q-not-urgent-not-important .matrix-transfer').click();
await page.getByRole('button',{name:'Доска'}).click();
await page.waitForSelector('.v6-board');
const longButton=page.locator('.board-longbox-link');
assert((await longButton.textContent())?.includes('1'),'longbox count missing');
await longButton.click();
await page.waitForSelector('.longbox-drawer');
assert(await page.locator('.longbox-row').filter({hasText:'Долгий ящик'}).count()===1,'longbox drawer task missing');
await page.locator('.longbox-row').filter({hasText:'Долгий ящик'}).getByRole('button',{name:'В Матрицу'}).click();
await page.waitForSelector('.matrix-page');
assert(await page.locator('.matrix-task').filter({hasText:'Долгий ящик'}).count()===1,'return from longbox to matrix failed');

assert(errors.length===0,'browser errors: '+errors.join(' | '));
console.log('PASS matrix UX polish smoke');
await browser.close();
