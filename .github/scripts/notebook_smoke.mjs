import { chromium } from 'playwright-core';

const baseURL = 'http://127.0.0.1:5173/';
const chromePath = process.env.CHROME_PATH;
if (!chromePath) throw new Error('CHROME_PATH is not set');

const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const failures = [];
const checks = [];

const check = async (name, fn) => {
  try {
    await fn();
    checks.push(`PASS ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push(`FAIL ${name}: ${message}`);
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

await check('Первое действие', async () => {
  await row.getByRole('button', { name: 'Добавь первое действие' }).click();
  const nextInput = row.getByPlaceholder('Следующий шаг...');
  await nextInput.fill('Первое действие');
  await nextInput.press('Enter');
  await row.getByRole('button', { name: 'Первое действие' }).waitFor();
});

await check('Добавление следующего шага', async () => {
  await row.hover();
  const plus = row.getByRole('button', { name: 'Следующий шаг' });
  await plus.click();
  const nextInput = row.getByPlaceholder('Следующий шаг...');
  await nextInput.fill('Второе действие');
  await nextInput.press('Enter');
  await row.getByRole('button', { name: 'Второе действие' }).waitFor();
});

await check('История открывается', async () => {
  await row.hover();
  await row.getByRole('button', { name: 'Открыть историю' }).click();
  await row.getByRole('button', { name: 'Первое действие' }).waitFor();
});

await check('Редактирование текущего шага', async () => {
  await row.getByRole('button', { name: 'Второе действие' }).click();
  const editor = row.locator('.stream-event form input');
  await editor.fill('Второе действие — изменено');
  await editor.press('Enter');
  await row.getByRole('button', { name: 'Второе действие — изменено' }).waitFor();
});

await check('Удаление текущего шага возвращает предыдущий', async () => {
  await row.hover();
  await row.getByTitle('Удалить').click();
  await row.getByRole('button', { name: 'Первое действие' }).waitFor();
});

await check('Провал внутрь задачи', async () => {
  await row.getByRole('button', { name: 'SMOKE — проверить Тетрадь' }).click();
  await page.getByText('Одна задача · без отвлечений').waitFor();
  await page.getByRole('button', { name: /Вернуться в Тетрадь/ }).click();
  await page.getByRole('heading', { name: 'Тетрадь' }).waitFor();
});

await check('Жду / напоминание', async () => {
  await row.hover();
  await row.locator('.row-more > summary').click();
  await row.getByRole('button', { name: 'Жду / напомнить' }).click();
  const modal = page.locator('.reminder-modal');
  await modal.getByLabel('Кого жду?').fill('Тест');
  await modal.getByRole('button', { name: 'Сохранить' }).click();
  await row.getByRole('button', { name: 'ЖДУ · Тест' }).waitFor();
});

await check('Фокус', async () => {
  await row.hover();
  await row.locator('.row-more > summary').click();
  await row.getByRole('button', { name: 'В фокус' }).click();
  await row.locator('.focus-badge').filter({ hasText: 'СЕЙЧАС' }).waitFor();
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
