import { chromium } from 'playwright-core';

const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH is not set');
const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(5000);
await page.addInitScript(() => {
  localStorage.setItem('today-cockpit-v2', JSON.stringify({
    tasks: [],
    columnTitles: { today: 'Сегодня', week: 'Неделя', month: 'Месяц', delegated: 'Делегировано', done: 'Готово' },
    activeTaskId: null,
  }));
});
await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });
const input = page.locator('#new-notebook-task');
await input.fill('GRID TEST');
await input.press('Enter');
const row = page.locator('.v6-row').filter({ hasText: 'GRID TEST' }).first();
await row.locator('.empty-current').click();
const step = row.locator('.step-input-wrap input');
await step.fill('Первое действие');
await step.press('Enter');
await page.waitForTimeout(200);
const data = await row.evaluate((rowEl) => {
  const pick = (selector) => {
    const el = rowEl.querySelector(selector);
    if (!el) return null;
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      selector,
      display: s.display,
      position: s.position,
      width: r.width,
      height: r.height,
      x: r.x,
      y: r.y,
      gridTemplateColumns: s.gridTemplateColumns,
      gridColumn: s.gridColumn,
      minWidth: s.minWidth,
      maxWidth: s.maxWidth,
      flex: s.flex,
      overflow: s.overflow,
    };
  };
  return {
    row: pick('.v6-row') || (() => { const s=getComputedStyle(rowEl); const r=rowEl.getBoundingClientRect(); return {display:s.display,width:r.width,height:r.height,gridTemplateColumns:s.gridTemplateColumns}; })(),
    main: pick('.row-main'),
    task: pick('.row-task-line'),
    stream: pick('.stream-line'),
    event: pick('.stream-event'),
    current: pick('.current-action-text'),
    next: pick('.next-step-trigger'),
    html: rowEl.innerHTML.slice(0, 2400),
  };
});
console.log('GRID_DIAG=' + JSON.stringify(data));
await browser.close();
