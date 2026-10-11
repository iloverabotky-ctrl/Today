import { chromium } from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const now=Date.now();
const mk=(id,title,column='pool',extra={})=>({id,title,columnId:column,boardOrder:0,inNotebook:false,notebookOrder:0,notebookAt:null,notebookCompleted:false,steps:[],waitingPerson:'',returnAt:null,assignee:'',deadline:null,project:'none',city:'spb',createdAt:now,completedAt:null,...extra});
const store={tasks:[
  mk('pool1','Разобрать входящую'),
  mk('long1','Долгий ящик'),
  mk('board1','Задача на доске','today',{deadline:now+86400000}),
  mk('note1','Задача в тетради','today',{inNotebook:true,notebookAt:now})
],columnTitles:{today:'Сегодня',week:'Неделя',month:'Месяц',delegated:'Делегировано команде',done:'Готово'},activeTaskId:null};
await page.addInitScript(({store})=>{
 localStorage.setItem('today-cockpit-v2',JSON.stringify(store));
 localStorage.setItem('today-eisenhower-v1',JSON.stringify({long1:'not-urgent-not-important'}));
 localStorage.setItem('today-eisenhower-transferred-v1',JSON.stringify({long1:true}));
 localStorage.setItem('today-eisenhower-session-v1',JSON.stringify({all:['pool1'],spb:['pool1'],krasnodar:[]}));
}, {store});
const pass=(ok,msg)=>{if(!ok) throw new Error(msg)};
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});

// Matrix: inline capture exists immediately and remains after submit.
await page.locator('.page-switch button').filter({hasText:'Матрица'}).click();
const capture=page.locator('.matrix-add-inline input[aria-label="Новая задача во входящие"]');
pass(await capture.isVisible(),'Matrix inline capture is not visible');
await capture.fill('Новая входящая без плюсика');
await capture.press('Enter');
await page.waitForTimeout(100);
pass(await page.locator('.matrix-task-title',{hasText:'Новая входящая без плюсика'}).count()===1,'Matrix inline task was not created');
pass(await capture.isVisible(),'Matrix inline capture disappeared after submit');

// Matrix task sheet -> Escape.
await page.locator('.matrix-task-title').first().click();
pass(await page.locator('.matrix-sheet-backdrop').isVisible(),'Matrix sheet did not open');
await page.keyboard.press('Escape');
await page.waitForTimeout(50);
pass(await page.locator('.matrix-sheet-backdrop').count()===0,'Escape did not close matrix sheet');

// Matrix details -> Escape.
await page.locator('.matrix-manual-disclosure summary').first().click();
pass(await page.locator('.matrix-manual-disclosure[open]').count()===1,'Matrix details did not open');
await page.keyboard.press('Escape');
pass(await page.locator('.matrix-manual-disclosure[open]').count()===0,'Escape did not close matrix details');

// Board longbox -> Escape.
await page.getByRole('button',{name:'Доска'}).click();
await page.getByRole('button',{name:/Долгий ящик/}).click();
pass(await page.locator('.longbox-backdrop').isVisible(),'Longbox did not open');
await page.keyboard.press('Escape');
await page.waitForTimeout(50);
pass(await page.locator('.longbox-backdrop').count()===0,'Escape did not close longbox');

// Deadline modal -> Escape.
await page.locator('.board-card').filter({hasText:'Задача на доске'}).getByRole('button',{name:'Срок'}).evaluate((el)=>el.click());
pass(await page.locator('.modal-overlay').isVisible(),'Deadline modal did not open');
await page.keyboard.press('Escape');
await page.waitForTimeout(50);
pass(await page.locator('.modal-overlay').count()===0,'Escape did not close deadline modal');

// Quick capture -> Escape.
await page.keyboard.press('n');
pass(await page.locator('.quick-overlay').isVisible(),'Quick capture did not open');
await page.keyboard.press('Escape');
await page.waitForTimeout(50);
pass(await page.locator('.quick-overlay').count()===0,'Escape did not close quick capture');

// Notebook inspector -> Escape.
await page.getByRole('button',{name:/Тетрадь/}).click();
await page.locator('.nb5-title',{hasText:'Задача в тетради'}).click();
pass(await page.locator('.nb5-inspector').isVisible(),'Notebook inspector did not open');
await page.keyboard.press('Escape');
await page.waitForTimeout(50);
pass(await page.locator('.nb5-inspector').count()===0,'Escape did not close notebook inspector');

// Team add -> Escape.
await page.waitForSelector('.page-switch button[data-safe-management="team"]',{timeout:5000});
await page.locator('.page-switch button[data-safe-management="team"]').click();
await page.locator('#safe-add-member').click();
pass(await page.locator('#safe-add-panel').isVisible(),'Team add panel did not open');
await page.keyboard.press('Escape');
await page.waitForTimeout(50);
pass(!(await page.locator('#safe-add-panel').isVisible()),'Escape did not close team add panel');

await browser.close();
