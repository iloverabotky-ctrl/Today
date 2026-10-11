import { chromium } from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const now=Date.now();
const mk=(id,title,column='pool',project='none',extra={})=>({
 id,title,columnId:column,boardOrder:Number(id.replace(/\D/g,''))||0,inNotebook:false,notebookOrder:0,notebookAt:null,notebookCompleted:false,
 steps:[],waitingPerson:'',returnAt:null,assignee:'',deadline:null,project,city:'spb',createdAt:now-60000,completedAt:null,...extra
});
const store={tasks:[
 mk('t1','Доработать TODAY','today','none',{inNotebook:true,notebookAt:now-5000,steps:[{id:'s1',text:'Проверить визуал всех экранов',createdAt:now-10000,waitingPerson:'',remindAt:null}]}),
 mk('t2','Срочно закрыть вопрос','pool','pasta'),
 mk('t3','Операционная задача','pool','kvep'),
 mk('t4','Развитие проекта','pool','pasta'),
 mk('t5','Долгий ящик','pool','none'),
 mk('t6','Подготовить запуск Пасты','today','pasta',{deadline:now+86400000}),
 mk('t7','Ответ от Наташи','delegated','kvep',{waitingPerson:'Наташа',assignee:'Наташа',returnAt:now+86400000})
],columnTitles:{today:'Сегодня',week:'Неделя',month:'Месяц',delegated:'Делегировано команде',done:'Готово'},activeTaskId:'t1'};
await page.addInitScript(({store})=>{
 localStorage.setItem('today-cockpit-v2',JSON.stringify(store));
 localStorage.setItem('today-eisenhower-v1',JSON.stringify({t2:'urgent-important',t3:'urgent-not-important',t4:'important-not-urgent',t5:'not-urgent-not-important'}));
 localStorage.setItem('today-eisenhower-transferred-v1','{}');
 localStorage.setItem('today-eisenhower-session-v1',JSON.stringify({all:['t2','t3','t4','t5'],spb:['t2','t3','t4','t5'],krasnodar:[]}));
}, {store});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('Failed to load resource')) errors.push(m.text())});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
await page.screenshot({path:'.github/tmp/vivid-notebook.png'});
await page.getByRole('button',{name:'Доска'}).click(); await page.waitForTimeout(120); await page.screenshot({path:'.github/tmp/vivid-board.png'});
await page.locator('.page-switch button').filter({hasText:'Матрица'}).click(); await page.waitForTimeout(120); await page.screenshot({path:'.github/tmp/vivid-matrix.png'});
if(errors.length) throw new Error(errors.join(' | '));
await browser.close();
