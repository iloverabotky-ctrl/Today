import { chromium } from 'playwright-core';
const chromePath=process.env.CHROME_PATH;
const browser=await chromium.launch({headless:true,executablePath:chromePath,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const now=Date.now();
const mk=(id,title,project='none',deadline=null,step='')=>({
 id,title,columnId:'pool',boardOrder:Number(id.replace(/\D/g,''))||0,inNotebook:false,notebookOrder:0,notebookAt:null,notebookCompleted:false,
 steps:step?[{id:id+'s',text:step,createdAt:now-1000,waitingPerson:'',remindAt:null}]:[],
 waitingPerson:'',returnAt:null,assignee:'',deadline,project,city:'spb',createdAt:now-(Number(id.replace(/\D/g,''))||0)*1000,completedAt:null
});
const tasks=[
 mk('t1','Паста улица','pasta',now+86400000,'Уточнить у Андрея'),
 mk('t2','Отчёт — уточнить у Андрея','none',now+2*86400000,'Сверить итоговые цифры'),
 mk('t3','Таблица Балаган для ЦР','kvep',null,'Собрать финальную версию'),
 mk('t4','Алина — пицца + подарок','pasta',now+3*86400000,'Договориться о времени'),
 mk('t5','Инвентаризация W','kvep',null,'Проверить остатки')
];
const store={tasks,columnTitles:{today:'Сегодня',week:'Неделя',month:'Месяц',delegated:'Делегировано команде',done:'Готово'},activeTaskId:null};
await page.addInitScript(({store})=>{
 localStorage.setItem('today-cockpit-v2',JSON.stringify(store));
 localStorage.setItem('today-eisenhower-v1',JSON.stringify({t1:'urgent-important',t2:'urgent-important',t3:'urgent-not-important',t4:'important-not-urgent',t5:'not-urgent-not-important'}));
 localStorage.setItem('today-eisenhower-transferred-v1',JSON.stringify({}));
 localStorage.setItem('today-eisenhower-session-v1',JSON.stringify({all:['t1','t2','t3','t4','t5'],spb:['t1','t2','t3','t4','t5'],krasnodar:[]}));
}, {store});
await page.goto('http://127.0.0.1:5173/',{waitUntil:'networkidle'});
await page.getByRole('button',{name:/Матрица/}).click();
await page.waitForTimeout(300);
await page.screenshot({path:'.github/tmp/matrix-current.png',fullPage:true});
await browser.close();
