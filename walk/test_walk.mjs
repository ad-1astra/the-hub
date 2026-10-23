// Headless check for the walk page: console errors, collision, doorway passage, screenshots.
//   npx playwright test is not needed - run directly:  node test_walk.mjs
import { chromium } from 'playwright';

const URL = process.env.WALK_URL || 'http://127.0.0.1:8000/walk/index.html';
const OUT = process.env.WALK_OUT || '.';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader',
                                               '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const errors = [], warnings = [];
page.on('console', m => {
  const t = m.text();
  if (m.type() === 'error') errors.push(t);
  else if (m.type() === 'warning') warnings.push(t);
});
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', r => errors.push('REQUESTFAILED: ' + r.url() + ' ' + (r.failure()?.errorText || '')));

await page.goto(URL, { waitUntil: 'load', timeout: 90000 });

// wait for the model
await page.waitForFunction(() => window.__walk && window.__walk.ready, null,
                           { timeout: 120000 });
await page.waitForTimeout(2500);

const rooms = await page.evaluate(() => window.__walk.rooms());
console.log('ROOMS:', rooms.length, rooms.join(', '));

const results = {};

// --- 1. reception screenshot -------------------------------------------------------------
await page.evaluate(() => window.__walk.teleportTo('Reception Area'));
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/shot_reception.png` });
results.reception = await page.evaluate(() => window.__walk.pos());

// --- 2. founder space screenshot ---------------------------------------------------------
await page.evaluate(() => window.__walk.teleportTo('Founder Space 1'));
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/shot_founder.png` });
results.founder = await page.evaluate(() => window.__walk.pos());

// --- 3. COLLISION: walk straight into the reception west wall (X -5.35) ------------------
// Stand mid-reception, face due west, try to walk 6 m. The wall is ~4.6 m away, so an
// unobstructed walk would end near X -6.4; collision must stop it short of the wall.
const wall = await page.evaluate(() => {
  window.__walk.setMode(false);
  window.__walk.teleportTo('Reception Area');
  window.__walk.setYawTo(-30, 5.58);          // face west
  const before = window.__walk.pos();
  const after = window.__walk.stepForward(6.0, 120);
  return { before, after };
});
results.wall = wall;
await page.screenshot({ path: `${OUT}/shot_wall.png` });

// --- 4. DOORWAY: reception -> Founder Space 1 through the opening at Y 2.4-3.8 -----------
// Stand in front of the doorway on the reception side and walk east through it.
const door = await page.evaluate(() => {
  window.__walk.setMode(false);
  window.__walk.teleportTo('Reception Area');
  // step to the doorway line first
  window.__walk.setYawTo(-0.76, 3.10); window.__walk.stepForward(2.5, 50);
  window.__walk.setYawTo(30, 3.10);           // face east, through the doorway
  const before = window.__walk.pos();
  const after = window.__walk.stepForward(7.0, 140);
  return { before, after };
});
results.door = door;
await page.screenshot({ path: `${OUT}/shot_doorway.png` });

console.log('RESULTS ' + JSON.stringify(results));
console.log('CONSOLE_ERRORS ' + errors.length);
errors.slice(0, 12).forEach(e => console.log('  ERR ' + e.slice(0, 220)));
console.log('CONSOLE_WARNINGS ' + warnings.length);
warnings.slice(0, 5).forEach(w => console.log('  WARN ' + w.slice(0, 160)));

await browser.close();
