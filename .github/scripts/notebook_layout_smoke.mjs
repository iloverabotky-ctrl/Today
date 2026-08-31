import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH missing');
const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(5000);

await page.addInitScript(() => {
  const now = Date.now();
  localStorage.setItem('today-cockpit-v2', JSON.stringify({
    tasks: [{
      id:'layout-test', title:'Проверка ровной геометрии', columnId:'today', boardOrder:0,
      inNotebook:true, notebookOrder:0, notebookAt:now-1000, notebookCompleted:false,
      steps:[
        {id:'s1',text:'Первый завершенный этап',createdAt:now-5000,waitingPerson:'',remindAt:null},
        {id:'s2',text:'Текущий этап должен стоять ровно и не ползти по строке',createdAt:now-2000,waitingPerson:'',remindAt:null}
      ],
      waitingPerson:'', returnAt:null, assignee:'', deadline:null, project:'none', city:'spb', createdAt:now-10000, completedAt:null
    }],
    columnTitles:{today:'Сегодня',week:'Неделя',month:'Месяц',delegated:'Делегировано',done:'Готово'},
    activeTaskId:null
  }));
});

await page.goto('http://127.0.0.1:5173/', { waitUntil:'networkidle' });
const plus = page.locator('#new-notebook-add');
await plus.waitFor();
const plusBox = await plus.boundingBox();
if (!plusBox || plusBox.width > 40 || plusBox.height > 40) throw new Error(`plus is not compact: ${JSON.stringify(plusBox)}`);
if (await page.locator('#new-notebook-task').count()) throw new Error('new task input visible before plus click');

const row = page.locator('.v6-row').filter({hasText:'Проверка ровной геометрии'}).first();
const stream = row.locator('.stream-line');
const current = row.locator('.current-action-text');
const history = row.locator('.history-more');
const streamBox = await stream.boundingBox();
const currentBox = await current.boundingBox();
const historyBox = await history.boundingBox();
if (!streamBox || streamBox.width < 500) throw new Error(`stream too narrow: ${JSON.stringify(streamBox)}`);
if (!currentBox || currentBox.width < 180) throw new Error(`current stage too narrow: ${JSON.stringify(currentBox)}`);
if (!historyBox) throw new Error('history control missing');
if (Math.abs(currentBox.y - streamBox.y) > 8) throw new Error(`current stage vertical drift: stream=${streamBox.y}, current=${currentBox.y}`);
if (historyBox.x >= currentBox.x) throw new Error(`history lane drift: history=${historyBox.x}, current=${currentBox.x}`);

await plus.click();
const input = page.locator('#new-notebook-task');
await input.waitFor();
const formBox = await page.locator('.compact-new-task').boundingBox();
const inputBox = await input.boundingBox();
if (!formBox || formBox.width > 720) throw new Error(`new task form too wide: ${JSON.stringify(formBox)}`);
if (!inputBox || inputBox.width > 430) throw new Error(`new task input too wide: ${JSON.stringify(inputBox)}`);
await input.fill('Новая компактная задача');
await input.press('Enter');
await page.getByRole('button',{name:'Новая компактная задача'}).waitFor();
await plus.waitFor();

console.log('PASS notebook layout smoke');
console.log(JSON.stringify({plus:plusBox,stream:streamBox,current:currentBox,history:historyBox,form:formBox,input:inputBox}));
await browser.close();
