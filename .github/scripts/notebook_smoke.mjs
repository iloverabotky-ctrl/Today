import { chromium } from 'playwright-core';

const baseURL = 'http://127.0.0.1:5173/';
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH is not set');

const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(4000);
const failures = [];
const checks = [];

const check = async (name, fn) => {
  try {
    await fn();
    checks.push(`PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push(`FAIL ${name}: ${message.split('\n')[0]}`);
    failures.push(name);
  }
};

await page.addInitScript(() => {
  localStorage.setItem('today-cockpit-v2', JSON.stringify({
    tasks: [],
    columnTitles: { today: 'Сегодня', week: 'Неделя', month: 'Месяц', delegated: 'Делегировано', done: 'Готово' },
    activeTaskId: null,
  }));
  localStorage.removeItem('today-team-v1');
  localStorage.removeItem('today-oneonone-v1');
});

await page.goto(baseURL, { waitUntil: 'networkidle' });

await check('Тетрадь открывается', async () => {
  await page.getByRole('heading', { name: 'Тетрадь' }).waitFor();
});

await check('Создание задачи', async () => {
  const input = page.locator('#new-notebook-task');
  await input.fill('SMOKE — проверить Тетрадь');
  await input.press('Enter');
  await page.getByRole('button', { name: 'SMOKE — проверить Тетрадь' }).waitFor();
});

const row = page.locator('.v6-row').filter({ hasText: 'SMOKE — проверить Тетрадь' }).first();

await check('Время создания отображается', async () => {
  await row.locator('.task-created-time').waitFor();
});

await check('Первое действие', async () => {
  await row.locator('.empty-current').click();
  const nextInput = row.locator('.step-input-wrap input');
  await nextInput.fill('Первое действие');
  await nextInput.press('Enter');
  const current = row.locator('.current-action-text');
  await current.waitFor();
  if ((await current.textContent())?.trim() !== 'Первое действие') throw new Error(`Текущий шаг: ${await current.textContent()}`);
});

await check('Добавление следующего шага', async () => {
  await row.hover();
  await row.locator('.next-step-trigger').click();
  const nextInput = row.locator('.step-input-wrap input');
  await nextInput.fill('Второе действие');
  await nextInput.press('Enter');
  const current = row.locator('.current-action-text');
  await current.waitFor();
  if ((await current.textContent())?.trim() !== 'Второе действие') throw new Error(`Текущий шаг: ${await current.textContent()}`);
});

await check('История открывается', async () => {
  await row.hover();
  await row.locator('.history-more').click();
  await row.locator('.notebook-history-item').filter({ hasText: 'Первое действие' }).waitFor();
});

await check('Редактирование текущего шага', async () => {
  await row.locator('.current-action-text').click();
  const editor = row.locator('.stream-event form input');
  await editor.fill('Второе действие — изменено');
  await editor.press('Enter');
  const current = row.locator('.current-action-text');
  await current.waitFor();
  if ((await current.textContent())?.trim() !== 'Второе действие — изменено') throw new Error(`После редактирования: ${await current.textContent()}`);
});

await check('Удаление текущего шага возвращает предыдущий', async () => {
  await row.hover();
  await row.locator('.stream-event .event-delete').click();
  const current = row.locator('.current-action-text');
  await current.waitFor();
  if ((await current.textContent())?.trim() !== 'Первое действие') throw new Error(`После удаления: ${await current.textContent()}`);
});

await check('Провал внутрь задачи и возврат', async () => {
  await row.getByRole('button', { name: 'SMOKE — проверить Тетрадь' }).click();
  await page.getByText('Одна задача · без отвлечений').waitFor();
  await page.getByRole('button', { name: /Вернуться в Тетрадь/ }).click();
  await page.getByRole('heading', { name: 'Тетрадь' }).waitFor();
  await row.locator('.focus-badge').filter({ hasText: 'СЕЙЧАС' }).waitFor();
});

await check('Жду / напоминание', async () => {
  await row.hover();
  await row.locator('.row-more > summary').click();
  await row.getByRole('button', { name: 'Жду / напомнить' }).click();
  const modal = page.locator('.reminder-modal');
  await modal.locator('input[list="reminder-team"]').fill('Тест');
  await modal.getByRole('button', { name: 'Сохранить' }).click();
  await row.getByRole('button', { name: 'ЖДУ · Тест' }).waitFor();
});

await check('Завершение в Тетради и свёрнутый архив', async () => {
  await row.getByTitle('Отметить выполненной').click();
  await page.getByRole('button', { name: /Выполнено · 1/ }).waitFor();
  if (await row.isVisible()) throw new Error('Выполненная задача осталась в основном потоке');
  await page.getByRole('button', { name: /Выполнено · 1/ }).click();
  await page.locator('.completed-drawer .v6-row').filter({ hasText: 'SMOKE — проверить Тетрадь' }).waitFor();
});

await check('Перенос задачи из Тетради в Доску', async () => {
  const input = page.locator('#new-notebook-task');
  await input.fill('SMOKE — перенос');
  await input.press('Enter');
  const moveRow = page.locator('.v6-row').filter({ hasText: 'SMOKE — перенос' }).first();
  await moveRow.hover();
  await moveRow.locator('.row-more > summary').click();
  await moveRow.locator('.row-more-menu select').selectOption('week');
  await moveRow.waitFor({ state: 'detached' });
  await page.getByRole('button', { name: 'Доска' }).click();
  await page.getByText('SMOKE — перенос', { exact: true }).waitFor();
});

console.log(checks.join('\n'));
await browser.close();
if (failures.length) {
  console.error(`Notebook smoke failures: ${failures.join(', ')}`);
  process.exit(1);
}
