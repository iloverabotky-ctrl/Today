import { chromium } from 'playwright-core';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const now=Date.now();
const mk=(id,title,column='today',project='none',extra={})=>({
 id,title,columnId:column,boardOrder:Number(id.replace(/\D/g,''))||0,inNotebook:false,notebookOrder:0,notebookAt:null,notebookCompleted:false,
 steps:[],waitingPerson:'',returnAt:null,assignee:'',deadline:null,project,city:'spb',createdAt:now-60000,completedAt:null,...extra
});
const store={tasks:[
 mk('t1','Доработать TODAY','today','none',{inNotebook:true,notebookAt:now-5000,steps:[{id:'s1',text:'Проверить визуал всех экранов',createdAt:now-10000,waitingPerson:'',remindAt:null}]}),
 mk('t2','Подготовить запуск Пасты','today','pasta',{deadline:now+86400000}),
 mk('t3','Согласовать поставку КВЭП','week','kvep',{steps:[{id:'s3',text:'Жду финальную цену',createdAt:now-20000,waitingPerson:'',remindAt:null}]}),
 mk('t4','Ответ от Наташи','delegated','pasta',{assignee:'Наташа',waitingPerson:'Наташа',deadline:now+2*86400000,returnAt:now+2*86400000}),
 mk('t5','Просроченный ответ','week','kvep',{waitingPerson:'Анита',returnAt:now-86400000}),
 mk('t6','Разобрать новый входящий','pool','none'),
 mk('t7','Операционная задача','pool','pasta'),
 mk('t8','Развитие проекта','pool','kvep'),
 mk('t9','Долгий ящик','pool','none')
],columnTitles:{today:'Сегодня',week:'Неделя',month:'Месяц',delegated:'Делегировано команде',done:'Готово'},activeTaskId:'t1'};
await page.addInitScript(({store})=>{
 localStorage.setItem('today-cockpit-v2',JSON.stringify(store));
 localStorage.setItem('today-eisenhower-v1',JSON.stringify({t7:'urgent-not-important',t8:'important-not-urgent',t9:'not-urgent-not-important'}));
 localStorage.setItem('today-eisenhower-transferred-v1','{}');
 localStorage.setItem('today-eisenhower-session-v1',JSON.stringify({all:['t6','t7','t8','t9'],spb:['t6','t7','t8','t9'],krasnodar:[]}));
 localStorage.setItem('today-team-v1',JSON.stringify([
  {id:'natasha',name:'Наташа',role:'Управляющая Паста',fixed:true},
  {id:'anita',name:'Анита',role:'Региональный управляющий',fixed:true},
  {id:'zhenya',name:'Женя',role:'КВЭП СПб',fixed:true}
 ]));
}, {store});
const errors=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('console',m=>{ if(m.type()==='error'&&!m.text().includes('Failed to load resource')) errors.push(m.text()) });
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
await page.screenshot({path:'.github/tmp/01-notebook.png'});
await page.getByRole('button',{name:'Доска'}).click(); await page.waitForTimeout(120); await page.screenshot({path:'.github/tmp/02-board.png'});
await page.locator('.page-switch button').filter({hasText:'Матрица'}).click(); await page.waitForTimeout(120); await page.screenshot({path:'.github/tmp/03-matrix.png'});
await page.locator('.page-switch button').filter({hasText:'Жду'}).first().click(); await page.waitForTimeout(120); await page.screenshot({path:'.github/tmp/04-wait.png'});
await page.waitForSelector('.page-switch button[data-safe-management="team"]',{timeout:5000});
await page.locator('.page-switch button[data-safe-management="team"]').click(); await page.waitForTimeout(120); await page.screenshot({path:'.github/tmp/05-team.png'});
await page.locator('.page-switch button[data-safe-management="oneonone"]').click(); await page.waitForTimeout(120); await page.screenshot({path:'.github/tmp/06-oneonone.png'});
if(errors.length) throw new Error(errors.join(' | '));
await browser.close();
