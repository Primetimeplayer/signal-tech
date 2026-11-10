import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(__dirname, '../public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function checkBinary(name) {
  try {
    const res = spawnSync(name, ['--version'], { stdio: 'ignore' });
    return res.status === 0;
  } catch {
    return false;
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function startHttpServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let reqPath = decodeURIComponent(req.url.split('?')[0]);
      if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

      const filePath = path.join(PUBLIC_DIR, reqPath);
      if (!filePath.startsWith(PUBLIC_DIR)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end(`Not found: ${reqPath}`);
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache'
        });
        fs.createReadStream(filePath).pipe(res);
      });
    });

    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });

    server.on('error', reject);
  });
}

class WebDriverClient {
  constructor(port) {
    this.baseUrl = `http://127.0.0.1:${port}`;
    this.sessionId = null;
  }

  async request(method, reqPath, body = null) {
    const url = `${this.baseUrl}${reqPath}`;
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body !== null) {
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`WebDriver ${method} ${reqPath} failed (${res.status}): ${JSON.stringify(data)}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async createSession() {
    const data = await this.request('POST', '/session', {
      capabilities: {
        alwaysMatch: {
          'moz:firefoxOptions': {
            args: ['-headless'],
            prefs: {
              'browser.cache.disk.enable': false,
              'browser.cache.memory.enable': false,
              'network.cookie.cookieBehavior': 0
            }
          },
          timeouts: {
            pageLoad: 30000,
            script: 30000
          }
        }
      }
    });
    this.sessionId = data.value.sessionId;
    return data.value;
  }

  async deleteSession() {
    if (!this.sessionId) return;
    try {
      await this.request('DELETE', `/session/${this.sessionId}`);
    } finally {
      this.sessionId = null;
    }
  }

  async navigate(url) {
    return await this.request('POST', `/session/${this.sessionId}/url`, { url });
  }

  async getTitle() {
    const data = await this.request('GET', `/session/${this.sessionId}/title`);
    return data.value;
  }

  async findElement(selector) {
    try {
      const data = await this.request('POST', `/session/${this.sessionId}/element`, {
        using: 'css selector',
        value: selector
      });
      return data.value ? data.value['element-6066-11e4-a52e-4f735466cecf'] : null;
    } catch {
      return null;
    }
  }

  async findElements(selector) {
    try {
      const data = await this.request('POST', `/session/${this.sessionId}/elements`, {
        using: 'css selector',
        value: selector
      });
      return (data.value || []).map(el => el['element-6066-11e4-a52e-4f735466cecf']);
    } catch {
      return [];
    }
  }

  async click(elementId) {
    return await this.request('POST', `/session/${this.sessionId}/element/${elementId}/click`, {});
  }

  // W3C actions: used where element click cannot express the intent
  // (e.g. clicking a full-screen backdrop next to an overlaid drawer).
  async performActions(actions) {
    return await this.request('POST', `/session/${this.sessionId}/actions`, { actions });
  }

  async pointerClickAt(x, y) {
    return await this.performActions([{
      type: 'pointer',
      id: 'mouse',
      parameters: { pointerType: 'mouse' },
      actions: [
        { type: 'pointerMove', duration: 0, x, y },
        { type: 'pointerDown', button: 0 },
        { type: 'pointerUp', button: 0 }
      ]
    }]);
  }

  async pressKey(key) {
    return await this.performActions([{
      type: 'key',
      id: 'keyboard',
      actions: [
        { type: 'keyDown', value: key },
        { type: 'keyUp', value: key }
      ]
    }]);
  }

  async clear(elementId) {
    return await this.request('POST', `/session/${this.sessionId}/element/${elementId}/clear`, {});
  }

  async sendKeys(elementId, text) {
    return await this.request('POST', `/session/${this.sessionId}/element/${elementId}/value`, { text });
  }

  async executeScript(script, args = []) {
    const data = await this.request('POST', `/session/${this.sessionId}/execute/sync`, {
      script,
      args
    });
    return data.value;
  }

  async setWindowRect(width, height) {
    return await this.request('POST', `/session/${this.sessionId}/window/rect`, {
      width,
      height
    });
  }

  async refresh() {
    return await this.request('POST', `/session/${this.sessionId}/refresh`, {});
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// geckodriver's W3C key actions accept WebDriver key codes, not key names.
const KEY_ESCAPE = String.fromCharCode(0xe00c);
const KEY_TAB = String.fromCharCode(0xe004);

const hasGecko = checkBinary('geckodriver');
const hasFirefox = checkBinary('firefox');

// Wall-clock budget for the whole suite (the subtests carry no individual
// timeouts). It was 60s, which the suite already spent almost entirely before
// the mobile-viewport regressions were added; 180s keeps headroom for slower
// machines without skipping or shortening any test.
test('browser regression suite (headless Firefox + direct WebDriver)', { timeout: 180000 }, async (t) => {
  if (!hasGecko || !hasFirefox) {
    t.skip(`Skipping browser tests: geckodriver (${hasGecko ? 'found' : 'missing'}), firefox (${hasFirefox ? 'found' : 'missing'})`);
    return;
  }

  let httpServer = null;
  let geckoProcess = null;
  let driver = null;
  let testUrl = '';

  t.after(async () => {
    if (driver && driver.sessionId) {
      try {
        await driver.deleteSession();
      } catch {
        // Session deletion best-effort
      }
    }
    if (geckoProcess) {
      try {
        geckoProcess.kill('SIGTERM');
      } catch {
        // Process termination best-effort
      }
      try {
        // geckodriver does not reliably honour SIGTERM. While it stays alive
        // the ChildProcess handle keeps Node's event loop open, so
        // `node --test` never exits even though every test has finished.
        geckoProcess.kill('SIGKILL');
      } catch {
        // Forced termination best-effort
      }
    }
    if (httpServer) {
      try {
        await new Promise(r => httpServer.close(r));
      } catch {
        // Server close best-effort
      }
    }
  });

  // 1. Start temporary static server
  const serverInfo = await startHttpServer();
  httpServer = serverInfo.server;
  testUrl = `http://127.0.0.1:${serverInfo.port}/index.html`;

  // 2. Start geckodriver
  const geckoPort = await getFreePort();
  geckoProcess = spawn('geckodriver', ['--port', String(geckoPort), '--host', '127.0.0.1'], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let geckoReady = false;
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${geckoPort}/status`);
      if (r.ok) {
        geckoReady = true;
        break;
      }
    } catch {
      await sleep(100);
    }
  }
  assert.ok(geckoReady, 'geckodriver failed to respond on /status');

  // 3. Create WebDriver session & navigate to dashboard
  driver = new WebDriverClient(geckoPort);
  await driver.createSession();
  assert.ok(driver.sessionId, 'WebDriver session creation returned valid sessionId');

  await driver.navigate(testUrl);

  // Wait for document.readyState complete & feed loaded
  let feedLoaded = false;
  for (let i = 0; i < 50; i++) {
    const cardCount = await driver.executeScript('return document.querySelectorAll("#feed .card").length;');
    const statusText = await driver.executeScript('const el = document.getElementById("status"); return el ? el.textContent : "";');
    if (cardCount > 0 || (statusText && statusText.includes('updated'))) {
      feedLoaded = true;
      break;
    }
    await sleep(100);
  }
  assert.ok(feedLoaded, 'Dashboard feed failed to load within timeout');

  // --- SUBTESTS ---

  await t.test('loads dashboard and renders initial feed cards', async () => {
    const title = await driver.getTitle();
    assert.match(title, /Signal/i, 'Page title must contain "Signal"');

    const statusEl = await driver.findElement('#status');
    assert.ok(statusEl, '#status element must exist');

    const feedEl = await driver.findElement('#feed');
    assert.ok(feedEl, '#feed element must exist');

    const latestGone = await driver.executeScript('return !document.getElementById("latestSection") && !document.getElementById("latestRow") && !document.getElementById("latest");');
    assert.equal(latestGone, true, 'Latest Stories strip must not be on the page');

    const themeToggleEl = await driver.findElement('#themeToggle');
    assert.ok(themeToggleEl, '#themeToggle element must exist');

    const searchEl = await driver.findElement('#search');
    assert.ok(searchEl, '#search element must exist');

    const cardCount = await driver.executeScript('return document.querySelectorAll("#feed .card").length;');
    assert.ok(cardCount > 0, `Expected feed cards, found ${cardCount}`);

    const fetchErrors = await driver.executeScript('return window.fetchErrors || [];');
    assert.equal(fetchErrors.length, 0, `Dashboard reported fetchErrors: ${JSON.stringify(fetchErrors)}`);
  });

  await t.test('toggles theme and persists across page refresh', async () => {
    const initialTheme = await driver.executeScript('return document.documentElement.getAttribute("data-theme");');
    assert.equal(initialTheme, 'light', 'Default theme should be "light"');

    const themeToggleEl = await driver.findElement('#themeToggle');
    await driver.click(themeToggleEl);
    await sleep(200);

    const toggledTheme = await driver.executeScript('return document.documentElement.getAttribute("data-theme");');
    assert.equal(toggledTheme, 'dark', 'Theme should switch to "dark" on toggle click');

    await driver.refresh();
    await sleep(500);

    const persistedTheme = await driver.executeScript('return document.documentElement.getAttribute("data-theme");');
    assert.equal(persistedTheme, 'dark', 'Theme "dark" must persist in localStorage across page refresh');

    // Reset back to light
    const themeToggleAfterRefresh = await driver.findElement('#themeToggle');
    await driver.click(themeToggleAfterRefresh);
    await sleep(200);
    const restoredTheme = await driver.executeScript('return document.documentElement.getAttribute("data-theme");');
    assert.equal(restoredTheme, 'light', 'Theme should switch back to "light"');
  });

  await t.test('filters feed by category and updates aria-pressed', async () => {
    const filterEl = await driver.findElement('.filter[data-cat="news"]');
    assert.ok(filterEl, 'News category filter element must exist');

    const initialAria = await driver.executeScript('return document.querySelector(\'.filter[data-cat="news"]\').getAttribute("aria-pressed");');
    assert.equal(initialAria, 'false', 'Initial aria-pressed for news filter should be "false"');

    await driver.click(filterEl);
    await sleep(300);

    const resultingAria = await driver.executeScript('return document.querySelector(\'.filter[data-cat="news"]\').getAttribute("aria-pressed");');
    assert.equal(resultingAria, 'true', 'aria-pressed should update to "true" when active');

    const nonNewsCount = await driver.executeScript('return document.querySelectorAll("#feed .card:not(.news)").length;');
    assert.equal(nonNewsCount, 0, 'No non-news cards should be visible when filtered to "news"');

    const newsCount = await driver.executeScript('return document.querySelectorAll("#feed .card.news").length;');
    assert.ok(newsCount > 0, 'News cards should remain visible when filtered');

    // Reset to "all"
    const allFilterEl = await driver.findElement('.filter[data-cat="all"]');
    if (allFilterEl) {
      await driver.click(allFilterEl);
      await sleep(200);
    }
  });

  await t.test('searches feed with debounce and restores when cleared', async () => {
    const searchEl = await driver.findElement('#search');
    assert.ok(searchEl, 'Search input element must exist');

    const initialCount = await driver.executeScript('return document.querySelectorAll("#feed .card").length;');

    await driver.sendKeys(searchEl, 'podracing');
    await sleep(400); // 150ms debounce

    const filteredCount = await driver.executeScript('return document.querySelectorAll("#feed .card").length;');
    assert.ok(filteredCount > 0, 'Filtered card count should be greater than 0');
    assert.ok(filteredCount <= initialCount, 'Filtered card count should be less than or equal to total');

    const cardTitles = await driver.executeScript(`
      return Array.from(document.querySelectorAll("#feed .card h2")).map(h => h.textContent.toLowerCase());
    `);
    const matchesTerm = cardTitles.some(t => t.includes('podracing') || t.includes('star wars'));
    assert.ok(matchesTerm, 'Search result cards must match query keywords');

    // Clear and dispatch input event
    await driver.clear(searchEl);
    await driver.executeScript(`
      const el = document.getElementById("search");
      el.value = "";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    `);
    await sleep(400);

    const restoredCount = await driver.executeScript('return document.querySelectorAll("#feed .card").length;');
    assert.equal(restoredCount, initialCount, 'Clearing search input must restore full card count');
  });

  // Puts every filter control back to its on-load state so each filter test
  // starts from a known, unfiltered baseline.
  const RESET_FILTERS_SCRIPT = `
    const applySelect = (id, value) => {
      const el = document.getElementById(id);
      if (el.value !== value) {
        el.value = value;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    };
    document.querySelector('.filter[data-cat="all"]').click();
    applySelect('sourceFilter', 'all');
    applySelect('dateFilter', 'all');
    if (document.getElementById('hwToggle').getAttribute('aria-pressed') === 'true') document.getElementById('hwToggle').click();
    if (document.getElementById('savedToggle').getAttribute('aria-pressed') === 'true') document.getElementById('savedToggle').click();
    const searchBox = document.getElementById('search');
    if (searchBox.value) {
      searchBox.value = '';
      searchBox.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  `;

  const pickSource = `
    const sel = document.getElementById('sourceFilter');
    return Array.from(sel.options).map(o => o.value).find(v => v !== 'all');
  `;

  await t.test('source and time-range filters narrow the feed and Clear filters restores it', async () => {
    await driver.setWindowRect(1280, 900);
    await driver.executeScript(RESET_FILTERS_SCRIPT);
    await sleep(250);

    const controls = await driver.executeScript(`
      return {
        sourceDisplay: getComputedStyle(document.getElementById('sourceTrigger')).display,
        dateDisplay: getComputedStyle(document.getElementById('dateTrigger')).display,
        sourceOptions: document.getElementById('sourceFilter').options.length,
        dateOptions: Array.from(document.getElementById('dateFilter').options).map(o => o.value),
        clearHidden: document.getElementById('clearFilters').hidden,
        baseline: document.querySelectorAll('#feed .card').length
      };
    `);

    assert.notEqual(controls.sourceDisplay, 'none', 'Source filter must be visible to the user');
    assert.notEqual(controls.dateDisplay, 'none', 'Time-range filter must be visible to the user');
    assert.ok(controls.sourceOptions > 1, `Source filter must be populated, found ${controls.sourceOptions} options`);
    assert.deepEqual(controls.dateOptions, ['all', 'today', 'week'], 'Time range must offer any time / today / this week');
    assert.equal(controls.clearHidden, true, 'Clear filters must stay hidden while nothing is filtered');
    assert.ok(controls.baseline > 0, 'Feed must render cards before filtering');

    const narrowedSource = await driver.executeScript(pickSource);
    const narrowed = await driver.executeScript(`
      const source = arguments[0];
      const sel = document.getElementById('sourceFilter');
      sel.value = source;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return new Promise(resolve => setTimeout(() => resolve({
        source,
        clearHidden: document.getElementById('clearFilters').hidden,
        count: document.querySelectorAll('#feed .card').length,
        allMatch: Array.from(document.querySelectorAll('#feed .card .card-meta'))
          .every(meta => meta.textContent.includes(source))
      }), 150));
    `, [narrowedSource]);

    assert.equal(narrowed.clearHidden, false, 'Clear filters must appear once a source filter is active');
    assert.ok(narrowed.count > 0, 'A source chosen from the data must still have results');
    assert.ok(narrowed.count <= controls.baseline, 'Source filtering must not add cards');
    assert.equal(narrowed.allMatch, true, 'Every rendered card must belong to the selected source');

    const timeRange = await driver.executeScript(`
      const sel = document.getElementById('dateFilter');
      const read = value => new Promise(resolve => {
        sel.value = value;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
        setTimeout(() => resolve({
          value,
          cards: document.querySelectorAll('#feed .card').length,
          empty: !!document.querySelector('#feed .empty')
        }), 150);
      });
      return (async () => [await read('today'), await read('week'), await read('all')])();
    `);

    assert.ok(timeRange[0].cards <= timeRange[1].cards, 'Today must be a subset of this week');
    assert.ok(timeRange[1].cards <= timeRange[2].cards, 'This week must be a subset of any time');
    assert.equal(timeRange[2].empty, false, 'The unfiltered time range must not show the empty state');

    // Narrow again, then reset through the visible control.
    await driver.executeScript(`
      const source = arguments[0];
      const sel = document.getElementById('sourceFilter');
      sel.value = source;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    `, [await driver.executeScript(pickSource)]);
    await sleep(200);

    const clearEl = await driver.findElement('#clearFilters');
    await driver.click(clearEl);
    await sleep(300);

    const restored = await driver.executeScript(`
      return {
        clearHidden: document.getElementById('clearFilters').hidden,
        source: document.getElementById('sourceFilter').value,
        date: document.getElementById('dateFilter').value,
        cards: document.querySelectorAll('#feed .card').length,
        allPressed: document.querySelector('.filter[data-cat="all"]').getAttribute('aria-pressed'),
        hwPressed: document.getElementById('hwToggle').getAttribute('aria-pressed'),
        savedPressed: document.getElementById('savedToggle').getAttribute('aria-pressed')
      };
    `);

    assert.equal(restored.clearHidden, true, 'Clear filters must hide itself once nothing is filtered');
    assert.equal(restored.source, 'all', 'Reset must restore the source filter');
    assert.equal(restored.date, 'all', 'Reset must restore the time-range filter');
    assert.equal(restored.allPressed, 'true', 'Reset must restore the active category');
    assert.equal(restored.hwPressed, 'false', 'Reset must clear the Hardware toggle');
    assert.equal(restored.savedPressed, 'false', 'Reset must clear the Saved toggle');
    assert.equal(restored.cards, controls.baseline, 'Reset must restore the original card count');
  });

  await t.test('a filter combination with no matches falls back to the existing empty state', async () => {
    await driver.setWindowRect(1280, 900);
    await driver.executeScript(RESET_FILTERS_SCRIPT);
    await sleep(250);

    const emptySource = await driver.executeScript(pickSource);
    const empty = await driver.executeScript(`
      const sel = document.getElementById('sourceFilter');
      sel.value = arguments[0];
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      const searchBox = document.getElementById('search');
      searchBox.value = 'zzzz-no-headline-can-ever-match-this-zzzz';
      searchBox.dispatchEvent(new Event('input', { bubbles: true }));
      return new Promise(resolve => setTimeout(() => {
        const msg = document.querySelector('#feed .empty');
        resolve({
          cards: document.querySelectorAll('#feed .card').length,
          message: msg ? msg.textContent.trim() : '',
          messageVisible: msg ? getComputedStyle(msg).display !== 'none' : false,
          clearHidden: document.getElementById('clearFilters').hidden,
          count: document.getElementById('resultCount').textContent
        });
      }, 400));
    `, [emptySource]);

    assert.equal(empty.cards, 0, 'No cards may render when nothing matches');
    assert.match(empty.message, /Nothing matches/i, 'Zero results must reuse the existing empty state');
    assert.equal(empty.messageVisible, true, 'The empty state must actually be shown');
    assert.equal(empty.clearHidden, false, 'Clear filters must be offered when a filter yields nothing');
    assert.match(empty.count, /^0 of /, 'Result count must report zero matches');

    const clearEl = await driver.findElement('#clearFilters');
    await driver.click(clearEl);
    await sleep(300);

    const restored = await driver.executeScript(`
      return {
        cards: document.querySelectorAll('#feed .card').length,
        empty: !!document.querySelector('#feed .empty'),
        search: document.getElementById('search').value,
        clearHidden: document.getElementById('clearFilters').hidden
      };
    `);

    assert.ok(restored.cards > 0, 'Clearing the filters must bring the feed back');
    assert.equal(restored.empty, false, 'The empty state must go away once results exist');
    assert.equal(restored.search, '', 'Clear filters must also clear the search box');
    assert.equal(restored.clearHidden, true, 'Clear filters must hide itself after resetting');
  });

  await t.test('save toggle exposes its pressed state and confirms the change immediately', async () => {
    await driver.setWindowRect(1280, 900);
    await driver.executeScript(RESET_FILTERS_SCRIPT);
    await sleep(250);

    const before = await driver.executeScript(`
      const btn = document.querySelector('#feed .save-btn');
      if (!btn) return null;
      const cs = getComputedStyle(btn);
      return {
        link: btn.dataset.link,
        pressed: btn.getAttribute('aria-pressed'),
        label: btn.textContent.trim(),
        color: cs.color,
        background: cs.backgroundColor
      };
    `);
    assert.ok(before, 'Feed must render a save button');
    assert.equal(before.pressed, 'false', 'An unsaved card must report aria-pressed="false"');
    assert.match(before.label, /Save/, 'Unsaved card must show the Save label');

    await driver.executeScript(`document.querySelector('#feed .save-btn').click();`);
    await sleep(120);

    const after = await driver.executeScript(`
      const link = arguments[0];
      const btn = Array.from(document.querySelectorAll('#feed .save-btn')).find(b => b.dataset.link === link);
      if (!btn) return null;
      const cs = getComputedStyle(btn);
      return {
        pressed: btn.getAttribute('aria-pressed'),
        label: btn.textContent.trim(),
        active: btn.classList.contains('active'),
        pulsing: btn.classList.contains('save-pulse'),
        color: cs.color,
        background: cs.backgroundColor
      };
    `, [before.link]);

    assert.ok(after, 'The card must still render its save button after toggling');
    assert.equal(after.pressed, 'true', 'Saving must flip aria-pressed to "true"');
    assert.match(after.label, /Saved/, 'Saving must update the label');
    assert.equal(after.active, true, 'Saving must apply the active visual state');
    assert.equal(after.pulsing, true, 'Saving must play the one-shot confirmation animation');
    assert.notEqual(after.color, before.color, 'Active save state must change the button colour');
    assert.notEqual(after.background, before.background, 'Active save state must change the button surface');

    // Put the saved item back so later tests start from a clean library.
    await driver.executeScript(`
      const link = arguments[0];
      const btn = Array.from(document.querySelectorAll('#feed .save-btn')).find(b => b.dataset.link === link);
      if (btn) btn.click();
    `, [before.link]);
    await sleep(150);

    const restored = await driver.executeScript(`
      const link = arguments[0];
      const btn = Array.from(document.querySelectorAll('#feed .save-btn')).find(b => b.dataset.link === link);
      return btn ? btn.getAttribute('aria-pressed') : null;
    `, [before.link]);
    assert.equal(restored, 'false', 'Un-saving must return aria-pressed to "false"');
  });

  await t.test('share reports the copy result through a self-clearing status message', async () => {
    await driver.setWindowRect(1280, 900);
    await driver.executeScript(RESET_FILTERS_SCRIPT);
    await sleep(250);

    const hasShare = await driver.executeScript(`return !!document.querySelector('#feed .share-btn');`);
    assert.equal(hasShare, true, 'Feed must render a share button');

    await driver.executeScript(`document.querySelector('#feed .share-btn').click();`);
    await sleep(300);

    const feedback = await driver.executeScript(`
      const fb = document.querySelector('#feed .share-feedback');
      if (!fb) return null;
      const btn = fb.previousElementSibling;
      return {
        role: fb.getAttribute('role'),
        live: fb.getAttribute('aria-live'),
        atomic: fb.getAttribute('aria-atomic'),
        message: fb.textContent.trim(),
        parentIsActions: fb.parentElement.classList.contains('card-actions'),
        buttonLabel: btn ? btn.textContent.trim() : ''
      };
    `);

    assert.ok(feedback, 'Sharing must surface immediate feedback');
    assert.equal(feedback.role, 'status', 'Share feedback must be announced as a status message');
    assert.equal(feedback.live, 'polite', 'Share feedback must use a polite live region');
    assert.equal(feedback.parentIsActions, true, 'Share feedback must sit next to the button that triggered it');
    assert.match(
      feedback.message,
      /^(Link copied\. Share it anywhere\.|Copy failed\. Select the link and copy it manually\.)$/,
      `Share feedback must state the actual outcome, saw "${feedback.message}"`
    );
    assert.notEqual(feedback.buttonLabel, '', 'The share button must keep a readable label');

    await sleep(1400);
    const cleared = await driver.executeScript(`return document.querySelectorAll('#feed .share-feedback').length;`);
    assert.equal(cleared, 0, 'Share feedback must clear itself instead of lingering');
  });

  await t.test('slash shortcut skips editable surfaces but still focuses search', async () => {
    await driver.setWindowRect(1280, 900);

    const result = await driver.executeScript(`
      const searchBox = document.getElementById('search');
      if (document.activeElement === searchBox) searchBox.blur();

      const fire = el => el.dispatchEvent(new KeyboardEvent('keydown', {
        key: '/', bubbles: true, cancelable: true
      }));

      const textarea = document.createElement('textarea');
      textarea.id = 'slashTextareaProbe';
      document.body.appendChild(textarea);
      textarea.focus();
      fire(textarea);
      const afterTextarea = document.activeElement.id;

      const editable = document.createElement('div');
      editable.id = 'slashEditableProbe';
      editable.setAttribute('contenteditable', 'true');
      document.body.appendChild(editable);
      editable.focus();
      fire(editable);
      const afterEditable = document.activeElement.id;

      const select = document.getElementById('sourceFilter');
      select.focus();
      fire(select);
      const afterSelect = document.activeElement.id;

      if (document.activeElement === searchBox) searchBox.blur();
      const neutral = document.body;
      fire(neutral);
      const afterNeutral = document.activeElement.id;

      textarea.remove();
      editable.remove();
      if (document.activeElement === searchBox) searchBox.blur();
      return { afterTextarea, afterEditable, afterSelect, afterNeutral };
    `);

    assert.equal(result.afterTextarea, 'slashTextareaProbe', 'A focused textarea must keep focus when / is pressed');
    assert.equal(result.afterEditable, 'slashEditableProbe', 'A contenteditable region must keep focus when / is pressed');
    assert.equal(result.afterSelect, 'sourceFilter', 'A focused select must keep focus when / is pressed');
    assert.equal(result.afterNeutral, 'search', 'A neutral page must still focus the search box on /');
  });

  await t.test('search and filter controls show a strong focus ring in both themes', async () => {
    await driver.setWindowRect(1280, 900);
    await driver.executeScript(RESET_FILTERS_SCRIPT);
    await sleep(250);

    const originalTheme = await driver.executeScript(`
      return document.documentElement.getAttribute('data-theme');
    `);
    const themes = [originalTheme, originalTheme === 'light' ? 'dark' : 'light'];
    const report = [];

    const probeFocus = async () => await driver.executeScript(`
      const el = document.activeElement;
      const cs = getComputedStyle(el);
      return {
        id: el.id,
        tag: el.tagName,
        focusVisible: el.matches(':focus-visible'),
        width: parseFloat(cs.outlineWidth) || 0,
        style: cs.outlineStyle,
        color: cs.outlineColor
      };
    `);

    for (const theme of themes) {
      await driver.executeScript(`document.documentElement.setAttribute('data-theme', arguments[0]);`, [theme]);

      const searchEl = await driver.findElement('#search');
      await driver.sendKeys(searchEl, '');
      await sleep(60);
      // The search paints its ring on the whole rounded field, not on the
      // bare <input> inside it, so measure the container while confirming
      // the input itself draws no outline.
      const searchFocus = await driver.executeScript(`
        const input = document.getElementById('search');
        const box = input.closest('.search-row');
        const boxStyle = getComputedStyle(box);
        const inputStyle = getComputedStyle(input);
        return {
          id: box.className,
          tag: box.tagName,
          focusVisible: input.matches(':focus-visible'),
          width: parseFloat(boxStyle.outlineWidth) || 0,
          style: boxStyle.outlineStyle,
          color: boxStyle.outlineColor,
          inputWidth: parseFloat(inputStyle.outlineWidth) || 0,
          inputStyle: inputStyle.outlineStyle
        };
      `);

      // The native filter selects are visually hidden state holders
      // (tabindex="-1"); the visible control is the pill-shaped trigger
      // button. Nudge the keyboard first — a scripted focus() only matches
      // :focus-visible when the last real input was a keypress — then focus
      // the source trigger directly and read its ring.
      await driver.performActions([{
        type: 'key',
        id: 'keyboard',
        actions: [
          { type: 'keyDown', value: String.fromCharCode(0xe008) }, // Shift
          { type: 'keyUp', value: String.fromCharCode(0xe008) }
        ]
      }]);
      await sleep(60);
      await driver.executeScript('document.getElementById("sourceTrigger").focus();');
      await sleep(60);
      const selectFocus = await probeFocus();

      report.push({ theme, searchFocus, selectFocus });
    }

    await driver.executeScript(`
      document.documentElement.setAttribute('data-theme', arguments[0]);
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    `, [originalTheme]);

    for (const entry of report) {
      const { theme, searchFocus, selectFocus } = entry;
      assert.equal(searchFocus.focusVisible, true, `Search must be :focus-visible in ${theme} theme`);
      assert.ok(
        searchFocus.width >= 2 && searchFocus.style !== 'none',
        `The rounded search field must show a solid focus ring of at least 2px in ${theme} theme (got ${searchFocus.width}px ${searchFocus.style})`
      );
      assert.ok(
        searchFocus.inputStyle === 'none' || searchFocus.inputWidth === 0,
        `The inner search input must not draw its own square outline in ${theme} theme (got ${searchFocus.inputWidth}px ${searchFocus.inputStyle})`
      );
      assert.ok(selectFocus, `A filter trigger must be present to measure its focus ring in ${theme} theme`);
      assert.equal(selectFocus.focusVisible, true, `Filter trigger must be :focus-visible in ${theme} theme`);
      assert.ok(
        selectFocus.width >= 2 && selectFocus.style !== 'none',
        `Filter trigger focus ring must be solid and at least 2px in ${theme} theme (got ${selectFocus.width}px ${selectFocus.style})`
      );
    }
  });

  // Shared browser-side helpers for the accessibility subtests below.
  // resolveBg() walks up the DOM compositing semi-transparent layers, so the
  // measured ratio is against the surface the text is actually painted on,
  // not just the element's own background-color.
  const COLOR_HELPERS = `
    function lum(r, g, b) {
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return f(r) * 0.2126 + f(g) * 0.7152 + f(b) * 0.0722;
    }
    function parseColor(str) {
      const m = (str || '').match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
      if (!m) return null;
      return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    }
    function contrastOf(fg, bg) {
      if (!fg || !bg) return null;
      const a = lum(fg.r, fg.g, fg.b), b = lum(bg.r, bg.g, bg.b);
      return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
    }
    function resolveBg(el, d) {
      d = d || 0;
      if (!el || d > 30) return { r: 255, g: 255, b: 255, a: 1 };
      const bg = parseColor(getComputedStyle(el).backgroundColor);
      if (!bg) return resolveBg(el.parentElement, d + 1);
      if (bg.a >= 0.999) return bg;
      if (bg.a <= 0.001) return resolveBg(el.parentElement, d + 1);
      const p = resolveBg(el.parentElement, d + 1);
      return {
        r: Math.round(bg.r * bg.a + p.r * (1 - bg.a)),
        g: Math.round(bg.g * bg.a + p.g * (1 - bg.a)),
        b: Math.round(bg.b * bg.a + p.b * (1 - bg.a)),
        a: 1
      };
    }
    function probeText(sel) {
      const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
      if (!el) return null;
      const cs = getComputedStyle(el);
      const bg = resolveBg(el);
      return { fg: cs.color, bg: 'rgb(' + bg.r + ', ' + bg.g + ', ' + bg.b + ')', ratio: contrastOf(parseColor(cs.color), bg) };
    }
    function probeBorder(sel) {
      const el = document.querySelector(sel);
      if (!el) return null;
      const cs = getComputedStyle(el);
      const fg = parseColor(cs.borderTopColor);
      const own = resolveBg(el);
      const outside = resolveBg(el.parentElement);
      return {
        border: cs.borderTopColor,
        own: contrastOf(fg, own),
        outside: contrastOf(fg, outside),
        width: parseFloat(cs.borderTopWidth) || 0
      };
    }
  `;

  // A programmatic focus() only lands :focus-visible when the last real input
  // was a keypress, so the focus subtest nudges the keyboard first.
  const KEYBOARD_NUDGE = [
    { type: 'key', id: 'keyboard', actions: [
      { type: 'keyDown', value: String.fromCharCode(0xe008) },
      { type: 'keyUp', value: String.fromCharCode(0xe008) }
    ] }
  ];

  await t.test('main feed renders visibly instead of the loading skeleton', async () => {
    await driver.setWindowRect(1280, 900);
    await driver.executeScript(RESET_FILTERS_SCRIPT);
    await sleep(300);

    const readState = await driver.executeScript(`
      const feed = document.getElementById('feed');
      const skel = document.getElementById('skeleton');
      const card = document.querySelector('#feed .card');
      const fr = feed.getBoundingClientRect();
      const cr = card ? card.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        cards: document.querySelectorAll('#feed .card').length,
        feedDisplay: getComputedStyle(feed).display,
        feedHeight: Math.round(fr.height),
        skeletonDisplay: getComputedStyle(skel).display,
        cardW: Math.round(cr.width),
        cardH: Math.round(cr.height)
      };
    `);

    assert.ok(readState.cards > 0, 'Feed must render cards once the data has loaded');
    assert.notEqual(readState.feedDisplay, 'none', 'The feed must be visible after load, not left on display:none');
    assert.ok(readState.feedHeight > 0, `The feed must occupy page height (got ${readState.feedHeight}px)`);
    assert.equal(readState.skeletonDisplay, 'none', 'The loading skeleton must be hidden once cards are rendered');
    assert.ok(readState.cardW > 0 && readState.cardH > 0, 'Cards must have a real box so they can be seen and focused');

    await driver.executeScript(`document.querySelector('.filter[data-cat="papers"]').click();`);
    await sleep(300);

    const afterFilter = await driver.executeScript(`
      const feed = document.getElementById('feed');
      const skel = document.getElementById('skeleton');
      return {
        cards: document.querySelectorAll('#feed .card').length,
        feedDisplay: getComputedStyle(feed).display,
        skeletonDisplay: getComputedStyle(skel).display
      };
    `);

    assert.ok(afterFilter.cards > 0, 'Filtering to a category must still render cards');
    assert.notEqual(afterFilter.feedDisplay, 'none', 'Re-rendering must not leave the feed hidden');
    assert.equal(afterFilter.skeletonDisplay, 'none', 'Re-rendering must not bring the skeleton back');

    await driver.executeScript(RESET_FILTERS_SCRIPT);
    await sleep(200);
  });

  await t.test('themed text meets WCAG AA contrast in light and dark modes', async () => {
    await driver.setWindowRect(1280, 900);
    await driver.executeScript(RESET_FILTERS_SCRIPT);
    await sleep(300);

    const originalTheme = await driver.executeScript("return document.documentElement.getAttribute('data-theme');");

    const probe = async (theme) => {
      await driver.executeScript("document.documentElement.setAttribute('data-theme', arguments[0]);", [theme]);
      await sleep(200);
      return await driver.executeScript(COLOR_HELPERS + `
        // Reddit has no items in the sample data, so inject a hidden probe
        // card: a category accent nobody can currently see must still be
        // compliant before Reddit data returns.
        const injected = document.createElement('article');
        injected.className = 'card reddit';
        injected.style.display = 'none';
        injected.innerHTML = '<div class="card-meta"><span class="cat-label">Probe</span></div>';
        document.body.appendChild(injected);
        const redditLabel = probeText('.card.reddit .cat-label');
        injected.remove();

        return {
          theme: document.documentElement.getAttribute('data-theme'),
          cardMeta: probeText('#feed .card-meta'),
          metaSeparator: probeText('#feed .card-meta > span:nth-child(2)'),
          metaTime: probeText('#feed .card-meta > span:last-child'),
          metaThird: probeText('#feed .card-meta > span:nth-child(3)'),
          catNews: probeText('#feed .card.news .cat-label'),
          catPapers: probeText('#feed .card.papers .cat-label'),
          catReviews: probeText('#feed .card.reviews .cat-label'),
          catReddit: redditLabel,
          resultCount: probeText('#resultCount'),
          status: probeText('#status'),
          tagline: probeText('.tagline'),
          latestLabelCount: probeText('.latest-label > span'),
          footer: probeText('footer'),
          footerLink: probeText('footer a'),
          clearFilters: probeText('#clearFilters'),
          searchHint: probeText('.search-hint'),
          cardTitle: probeText('#feed .card h2 a'),
          cardSummary: probeText('#feed .card p'),
          saveBtn: probeText('#feed .save-btn'),
          shareBtn: probeText('#feed .share-btn'),
          sidebarItem: probeText('.sidebar-item'),
          sidebarHeading: probeText('.sidebar-heading'),
          chip: probeText('#feed .chip'),
          latestCat: probeText('.latest-card .cat'),
          latestTitle: probeText('.latest-card h3')
        };
      `);
    };

    for (const theme of ['light', 'dark']) {
      const report = await probe(theme);
      assert.equal(report.theme, theme);
      for (const [name, entry] of Object.entries(report)) {
        if (name === 'theme' || !entry) continue;
        assert.notEqual(entry.ratio, null, `${name} (${theme}): could not compute a ratio for ${entry.fg}`);
        assert.ok(
          entry.ratio >= 4.5,
          `${name} (${theme}): contrast ${entry.ratio}:1 — ${entry.fg} on ${entry.bg} must meet AA 4.5:1`
        );
      }
    }

    await driver.executeScript("document.documentElement.setAttribute('data-theme', arguments[0]);", [originalTheme]);
    await sleep(150);
  });

  await t.test('control boundaries keep 3:1 non-text contrast in both themes', async () => {
    await driver.setWindowRect(1280, 900);
    await driver.executeScript(RESET_FILTERS_SCRIPT);
    await sleep(300);

    const originalTheme = await driver.executeScript("return document.documentElement.getAttribute('data-theme');");

    const probe = async (theme) => {
      await driver.executeScript("document.documentElement.setAttribute('data-theme', arguments[0]);", [theme]);
      await sleep(200);
      return await driver.executeScript(COLOR_HELPERS + `
        return {
          theme: document.documentElement.getAttribute('data-theme'),
          // The source/date triggers and Clear filters are borderless
          // pills drawn like the header search, so they are not probed here.
          searchRow: probeBorder('.row2 .search-row'),
          loadMore: probeBorder('#loadMoreBtn'),
          themeToggle: probeBorder('#themeToggle'),
          menuToggle: probeBorder('#menuToggle')
        };
      `);
    };

    for (const theme of ['light', 'dark']) {
      const report = await probe(theme);
      assert.equal(report.theme, theme);
      for (const [name, entry] of Object.entries(report)) {
        if (name === 'theme' || !entry) continue;
        assert.ok(entry.width >= 1, `${name} (${theme}): needs a visible border (got ${entry.width}px ${entry.border})`);
        const weakest = Math.min(entry.own, entry.outside);
        assert.ok(
          weakest >= 3,
          `${name} (${theme}): border ${entry.border} is only ${weakest}:1 against its own surface (${entry.own}:1) or the page around it (${entry.outside}:1); control boundaries need 3:1`
        );
      }
    }

    await driver.executeScript("document.documentElement.setAttribute('data-theme', arguments[0]);", [originalTheme]);
    await sleep(150);
  });

  await t.test('every interactive control shows a keyboard focus ring in both themes', async () => {
    await driver.setWindowRect(1280, 900);
    await driver.executeScript(RESET_FILTERS_SCRIPT);
    await sleep(300);

    const originalTheme = await driver.executeScript("return document.documentElement.getAttribute('data-theme');");

    // The controls the page actually shows: toolbar, sidebar, masthead,
    // article cards, carousel arrows, and the "clear filters" pill (which only
    // exists while something is filtered).
    const DESKTOP_CONTROLS = [
      '#search',
      '#sourceTrigger',
      '#dateTrigger',
      '#clearFilters',
      '.theme-toggle',
      '#loadMoreBtn',
      '.filter',
      '.sidebar-item',
      '.mast-right a',
      '#feed .card h2 a',
      '#feed .save-btn',
      '#feed .share-btn'
    ];

    const probeControls = async (selectors) => {
      await driver.performActions(KEYBOARD_NUDGE);
      await sleep(80);
      return await driver.executeScript(`
        const selectors = arguments[0];
        const out = [];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (!el) { out.push({ sel, present: false }); continue; }
          const wasHidden = el.hidden === true;
          if (wasHidden) el.hidden = false;
          const restoreDisplay = getComputedStyle(el).display;
          if (restoreDisplay === 'none') { el.style.display = 'inline-block'; }
          // The search field paints its ring on the rounded container rather
          // than the bare input, so read the ring from the container while
          // still focusing the input that receives keyboard focus.
          const ringEl = el.id === 'search' ? el.closest('.search-row') : el;
          el.focus();
          const cs = getComputedStyle(ringEl);
          out.push({
            sel,
            present: true,
            active: document.activeElement === el,
            focusVisible: el.matches(':focus-visible'),
            width: parseFloat(cs.outlineWidth) || 0,
            style: cs.outlineStyle
          });
          el.blur();
          if (wasHidden) el.hidden = true;
          if (el.style.display) el.style.removeProperty('display');
        }
        return out;
      `, [selectors]);
    };

    const assertRings = (results, theme, label) => {
      assert.ok(results.length > 0, `${label}: nothing probed`);
      for (const result of results) {
        if (!result.present) continue;
        assert.ok(result.active, `${label} (${theme}): ${result.sel} must receive keyboard focus`);
        assert.equal(result.focusVisible, true, `${label} (${theme}): ${result.sel} must match :focus-visible`);
        assert.ok(
          result.style !== 'none' && result.width >= 2,
          `${label} (${theme}): ${result.sel} focus ring must be solid and at least 2px (got ${result.width}px ${result.style})`
        );
      }
    };

    for (const theme of ['light', 'dark']) {
      await driver.executeScript("document.documentElement.setAttribute('data-theme', arguments[0]);", [theme]);
      await sleep(200);
      const results = await probeControls(DESKTOP_CONTROLS);
      assertRings(results, theme, 'desktop controls');
    }

    // Mobile-only controls: the menu toggle, and the drawer close button that
    // only exists once the navigation drawer is open.
    await driver.setWindowRect(390, 844);
    await sleep(300);
    await driver.performActions(KEYBOARD_NUDGE);

    const menuRing = await probeControls(['#menuToggle']);
    assertRings(menuRing, 'dark', 'mobile menu toggle');

    const menuToggleEl = await driver.findElement('#menuToggle');
    assert.ok(menuToggleEl, '#menuToggle must exist on mobile');
    await driver.click(menuToggleEl);
    await sleep(350);

    // The drawer was opened with a pointer click, so the browser is in "mouse"
    // modality and a scripted focus() would not match :focus-visible. Walk the
    // real Tab order instead — that is how a keyboard user reaches this button
    // and it is the state the ring has to hold up in.
    let closeRing = null;
    for (let i = 0; i < 12 && !closeRing; i++) {
      await driver.performActions([
        { type: 'key', id: 'keyboard', actions: [
          { type: 'keyDown', value: KEY_TAB },
          { type: 'keyUp', value: KEY_TAB }
        ] }
      ]);
      await sleep(60);
      const reached = await driver.executeScript(`
        const el = document.activeElement;
        if (!el || el.id !== 'sidebarClose') return null;
        const cs = getComputedStyle(el);
        return {
          sel: '#sidebarClose',
          present: true,
          active: true,
          focusVisible: el.matches(':focus-visible'),
          width: parseFloat(cs.outlineWidth) || 0,
          style: cs.outlineStyle
        };
      `);
      if (reached) closeRing = reached;
    }
    assert.ok(closeRing, 'Keyboard focus must reach the drawer close button');
    assertRings([closeRing], 'dark', 'drawer close button');

    await driver.setWindowRect(1280, 900);
    await driver.executeScript("document.documentElement.setAttribute('data-theme', arguments[0]);", [originalTheme]);
    await driver.executeScript(RESET_FILTERS_SCRIPT);
    await sleep(200);
  });

  await t.test('theme toggle exposes its state through its accessible name', async () => {
    await driver.setWindowRect(1280, 900);
    await driver.executeScript(RESET_FILTERS_SCRIPT);
    await sleep(300);

    // Earlier subtests set data-theme directly (which skips the toggle's own
    // click handler), so the icon and its label can be a step behind the
    // attribute. Two real clicks put both back in step and land on the same
    // theme this test started in.
    for (let i = 0; i < 2; i++) {
      const syncEl = await driver.findElement('#themeToggle');
      assert.ok(syncEl, '#themeToggle must exist');
      await driver.click(syncEl);
      await sleep(300);
    }

    const readToggle = await driver.executeScript(`
      const btn = document.getElementById('themeToggle');
      const theme = document.documentElement.getAttribute('data-theme');
      const other = theme === 'light' ? 'dark' : 'light';
      return {
        theme,
        label: (btn.getAttribute('aria-label') || '').trim(),
        title: (btn.getAttribute('title') || '').trim(),
        iconHidden: !!btn.querySelector('svg[aria-hidden="true"]'),
        expected: 'Switch to ' + other + ' theme',
        hasPressed: btn.hasAttribute('aria-pressed')
      };
    `);

    assert.equal(readToggle.label, readToggle.expected, `Theme toggle in ${readToggle.theme} must name the theme it switches to`);
    assert.equal(readToggle.title, readToggle.expected, 'Theme toggle tooltip must match its accessible name');
    assert.equal(readToggle.iconHidden, true, 'The theme icon must be hidden from assistive technology');
    assert.match(readToggle.label, /^(Switch to (light|dark) theme|Toggle light and dark theme)$/,
      `Theme toggle must expose a readable state name (got "${readToggle.label}")`);

    const toggleEl = await driver.findElement('#themeToggle');
    assert.ok(toggleEl, '#themeToggle must exist');
    await driver.click(toggleEl);
    await sleep(350);

    const afterClick = await driver.executeScript(`
      const btn = document.getElementById('themeToggle');
      const theme = document.documentElement.getAttribute('data-theme');
      const other = theme === 'light' ? 'dark' : 'light';
      return { theme, label: (btn.getAttribute('aria-label') || '').trim(), expected: 'Switch to ' + other + ' theme' };
    `);

    assert.notEqual(afterClick.theme, readToggle.theme, 'Clicking the toggle must switch the theme');
    assert.equal(afterClick.label, afterClick.expected, `After switching to ${afterClick.theme} the label must name the theme it switches to`);

    const toggleAgain = await driver.findElement('#themeToggle');
    await driver.click(toggleAgain);
    await sleep(350);

    const restored = await driver.executeScript(`
      const btn = document.getElementById('themeToggle');
      return { theme: document.documentElement.getAttribute('data-theme'), label: (btn.getAttribute('aria-label') || '').trim() };
    `);
    assert.equal(restored.theme, readToggle.theme, 'Theme must be restored after the accessibility check');
    assert.equal(restored.label, readToggle.label, 'Accessible name must return to its original value');
  });

  await t.test('heading structure has one h1 and no skipped levels', async () => {
    await driver.setWindowRect(1280, 900);
    await driver.executeScript(RESET_FILTERS_SCRIPT);
    await sleep(300);

    const report = await driver.executeScript(`
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
      const visible = headings.filter(h => {
        const cs = getComputedStyle(h);
        return cs.display !== 'none' && cs.visibility !== 'hidden';
      });
      const outline = visible.map(h => ({ level: Number(h.tagName.slice(1)), text: (h.textContent || '').trim().slice(0, 60) }));
      const noscriptH1 = document.querySelectorAll('noscript h1').length;
      return { outline, noscriptH1, firstIsH1: outline.length > 0 && outline[0].level === 1 };
    `);

    assert.ok(report.outline.length > 0, 'Page must expose headings');
    assert.ok(report.firstIsH1, `The first heading on the page must be the h1 hero headline (got level ${report.outline[0] && report.outline[0].level})`);
    assert.equal(report.noscriptH1, 0,
      'A second h1 inside <noscript> would still be parsed when scripting is off; the live document must have exactly one h1');

    const h1s = report.outline.filter(h => h.level === 1);
    assert.equal(h1s.length, 1, `Exactly one visible h1 is expected (found ${h1s.length}: ${h1s.map(h => h.text).join(' | ')})`);

    for (let i = 1; i < report.outline.length; i++) {
      const jump = report.outline[i].level - report.outline[i - 1].level;
      assert.ok(
        jump <= 1,
        `Heading level jumps from h${report.outline[i - 1].level} ("${report.outline[i - 1].text}") to h${report.outline[i].level} ("${report.outline[i].text}")`
      );
    }

    const sectionNames = report.outline.filter(h => h.level === 2).map(h => h.text);
    assert.equal(sectionNames.some(t => /latest stories/i.test(t)), false, 'Latest Stories must not have a heading');
    assert.ok(sectionNames.some(t => /top stories/i.test(t)), 'The main feed section must carry an h2');
  });

  await t.test('page stays responsive with every item rendered (no virtualization needed)', async () => {
    await driver.setWindowRect(1280, 900);
    await driver.executeScript(RESET_FILTERS_SCRIPT);
    await sleep(300);

    // Measured before deciding anything: with the sample data the whole feed
    // is only 76 items, so the page renders every card directly. These bounds
    // are deliberately loose — they exist to catch a real regression (an
    // accidental full re-render per keystroke, a runaway DOM), not to encode
    // the exact numbers measured today.
    const perf = await driver.executeScript(`
      return new Promise((resolve) => {
        const feed = document.getElementById('feed');
        const cardsAtStart = feed.querySelectorAll('.card').length;

        const t0 = performance.now();
        window.scrollTo(0, 0);
        const scrollMs = performance.now() - t0;

        const docHeight = document.documentElement.scrollHeight;
        const nodes = document.getElementsByTagName('*').length;

        // Expand the entire feed so the full-height page is what gets measured.
        const expand = document.getElementById('loadMoreBtn');
        if (expand) {
          while (!expand.hidden && expand.offsetParent !== null) {
            expand.click();
            if (expand.hidden || expand.offsetParent === null) break;
          }
        }
        const allCards = feed.querySelectorAll('.card').length;
        const fullHeight = document.documentElement.scrollHeight;
        const fullNodes = document.getElementsByTagName('*').length;

        const t1 = performance.now();
        window.scrollTo(0, fullHeight);
        const scrollFullMs = performance.now() - t1;
        window.scrollTo(0, 0);

        // Restore the paginated state for the subtests that follow.
        const allBtn = document.querySelector('.filter[data-cat="all"]');
        if (allBtn) allBtn.click();

        resolve({
          cardsAtStart,
          allCards,
          docHeight,
          fullHeight,
          nodes,
          fullNodes,
          scrollMs: Math.round(scrollMs * 100) / 100,
          scrollFullMs: Math.round(scrollFullMs * 100) / 100
        });
      });
    `);

    assert.ok(perf.allCards >= perf.cardsAtStart, 'Expanding the feed must not lose cards');
    assert.ok(perf.fullHeight >= perf.docHeight, 'The fully expanded page cannot be shorter than the paginated one');
    assert.ok(perf.fullNodes >= perf.nodes, 'Expanding the feed adds DOM nodes');

    // Deliberately generous ceiling: 76 cards at roughly 300px each is well
    // under this. It only trips if the page grows an order of magnitude or a
    // scroll handler starts doing per-frame layout work.
    assert.ok(perf.fullHeight < 60000, `Fully expanded page height ${perf.fullHeight}px is far beyond the expected range; re-check whether rendering needs work`);
    assert.ok(perf.fullNodes < 6000, `Fully expanded DOM node count ${perf.fullNodes} is far beyond the expected range`);
    assert.ok(perf.scrollFullMs < 500, `Scrolling the full page took ${perf.scrollFullMs}ms; scroll handling may be doing per-frame layout work`);
  });

  await t.test('Latest Stories strip is not on the homepage', async () => {
    const gone = await driver.executeScript(`
      return {
        section: !!document.getElementById('latestSection'),
        row: !!document.getElementById('latestRow'),
        prev: !!document.getElementById('latestPrev'),
        next: !!document.getElementById('latestNext'),
        heading: Array.from(document.querySelectorAll('h2')).some((h) => /latest stories/i.test(h.textContent || ''))
      };
    `);
    assert.equal(gone.section, false, '#latestSection must be gone');
    assert.equal(gone.row, false, '#latestRow must be gone');
    assert.equal(gone.prev, false, 'Previous control must be gone');
    assert.equal(gone.next, false, 'Next control must be gone');
    assert.equal(gone.heading, false, 'Latest Stories heading must be gone');
    const signal = await driver.findElement('#signalStrip');
    assert.ok(signal, '#signalStrip must remain');
  });

  await t.test('renders Recent Items and enforces XSS protection', async () => {
    const safeTitle = 'Safe Test Recent Story';
    const safeUrl = 'https://example.com/safe-story';

    // 1. Test safe item rendering
    await driver.executeScript(`
      localStorage.setItem('techDashboardRecents', JSON.stringify([
        { title: ${JSON.stringify(safeTitle)}, url: ${JSON.stringify(safeUrl)} }
      ]));
    `);
    await driver.refresh();
    await sleep(500);

    const safeResult = await driver.executeScript(`
      const items = Array.from(document.querySelectorAll("#recentArticles .recent-item"));
      return items.map(a => ({ text: a.textContent.trim(), href: a.href }));
    `);
    assert.ok(safeResult.length >= 1, 'Expected at least 1 recent article item rendered');
    assert.equal(safeResult[0].text, safeTitle);
    assert.equal(safeResult[0].href, safeUrl);

    // 2. Test XSS / HTML injection resistance
    const maliciousTitle = '<img src=x onerror="window.__recentInjection=true">';
    const maliciousUrl = 'https://example.com/malicious';

    await driver.executeScript(`
      localStorage.setItem('techDashboardRecents', JSON.stringify([
        { title: ${JSON.stringify(maliciousTitle)}, url: ${JSON.stringify(maliciousUrl)} },
        { title: ${JSON.stringify(safeTitle)}, url: ${JSON.stringify(safeUrl)} }
      ]));
    `);
    await driver.refresh();
    await sleep(500);

    const xssCheck = await driver.executeScript(`
      const imgCount = document.querySelectorAll("#recentArticles img").length;
      const injectionFlag = window.__recentInjection === true;
      const firstItem = document.querySelector("#recentArticles .recent-item");
      return {
        imgCount,
        injectionFlag,
        text: firstItem ? firstItem.textContent : null,
        innerHTML: firstItem ? firstItem.innerHTML : null
      };
    `);

    assert.equal(xssCheck.imgCount, 0, 'No img tags should be created inside #recentArticles');
    assert.equal(xssCheck.injectionFlag, false, 'XSS script injection must not execute');
    assert.equal(xssCheck.text, maliciousTitle, 'Malicious payload must be treated as literal text');

    // Clean up recents localStorage
    await driver.executeScript('localStorage.removeItem("techDashboardRecents");');
    await driver.refresh();
    await sleep(300);
  });

  await t.test('desktop sidebar renders the expected navigation', async () => {
    await driver.setWindowRect(1280, 900);
    await driver.executeScript(`
      try { localStorage.removeItem('techDashboardRecents'); } catch (e) {}
    `);
    await driver.refresh();
    for (let i = 0; i < 50; i++) {
      const cards = await driver.executeScript('return document.querySelectorAll("#feed .card").length;');
      if (cards > 0) break;
      await sleep(100);
    }
    await sleep(200);

    const sidebar = await driver.executeScript(`
      const filters = document.getElementById('filters');
      const rect = filters.getBoundingClientRect();
      return {
        visible: rect.width > 0 && rect.height > 0,
        width: Math.round(rect.width),
        headings: Array.from(filters.querySelectorAll('.sidebar-section > .sidebar-heading')).map(h => h.textContent.trim()),
        items: Array.from(filters.querySelectorAll('.sidebar-item')).map(el => ({
          id: el.id || el.dataset.cat || '',
          text: el.textContent.trim()
        })),
        menuToggle: getComputedStyle(document.getElementById('menuToggle')).display,
        backdrop: getComputedStyle(document.getElementById('sidebarBackdrop')).display,
        drawerHead: getComputedStyle(document.querySelector('.sidebar-drawer-head')).display,
        accountSection: (() => { const a = document.getElementById('accountBtn'); return !!a && a.getBoundingClientRect().width > 0; })(),
        docOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
      };
    `);

    assert.ok(sidebar.visible, 'Sidebar must be visible on desktop');
    assert.ok(sidebar.width >= 180, `Sidebar should keep its desktop width, measured ${sidebar.width}px`);
    assert.ok(
      sidebar.headings.includes('TOPICS') && sidebar.headings.includes('LIBRARY'),
      `Sidebar should keep its TOPICS and LIBRARY groups, found ${JSON.stringify(sidebar.headings)}`
    );
    assert.equal(sidebar.accountSection, true, 'Log in must sit in the masthead on desktop');
    const ids = sidebar.items.map(i => i.id);
    for (const expected of ['all', 'news', 'papers', 'reviews', 'reddit', 'hwToggle', 'savedToggle', 'digestsNav']) {
      assert.ok(ids.includes(expected), `Sidebar must expose navigation item "${expected}", found ${JSON.stringify(ids)}`);
    }
    assert.equal(sidebar.menuToggle, 'none', 'Mobile menu control must stay hidden on desktop');
    assert.equal(sidebar.backdrop, 'none', 'Drawer backdrop must stay hidden on desktop');
    assert.equal(sidebar.drawerHead, 'none', 'Drawer header must stay hidden on desktop');
    assert.equal(sidebar.docOverflow, false, 'Desktop sidebar must not cause horizontal overflow');
  });

  await t.test('Home stays the active sidebar item on load', async () => {
    const state = await driver.executeScript(`
      const all = document.querySelector('.filter[data-cat="all"]');
      const others = Array.from(document.querySelectorAll('.filter[data-cat]')).filter(b => b.dataset.cat !== 'all');
      return {
        homePressed: all.getAttribute('aria-pressed'),
        otherPressed: others.map(b => b.getAttribute('aria-pressed')),
        homeBg: getComputedStyle(all).backgroundColor,
        idleBg: getComputedStyle(others[0]).backgroundColor
      };
    `);

    assert.equal(state.homePressed, 'true', 'Home must be pressed by default');
    assert.ok(state.otherPressed.every(p => p === 'false'), 'No other category may be active on load');
    assert.notEqual(state.homeBg, state.idleBg, 'Active Home item must remain visually distinct from idle items');
  });

  await t.test('Digests navigation link is present and usable', async () => {
    const digests = await driver.executeScript(`
      const el = document.getElementById('digestsNav');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        tag: el.tagName,
        href: el.getAttribute('href'),
        label: el.textContent.trim(),
        visible: rect.width > 0 && rect.height > 0,
        inViewport: rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1
      };
    `);

    assert.ok(digests, '#digestsNav must exist in the sidebar');
    assert.equal(digests.tag, 'A', 'Digests entry must be a real link');
    assert.match(digests.href, /\/digests$/, 'Digests link must point at the clean /digests URL');
    assert.match(digests.label, /Digests/i, 'Digests link must be labelled');
    assert.ok(digests.visible && digests.inViewport, 'Digests link must be visible on desktop');
  });

  await t.test('empty RECENT group is hidden instead of looking unfinished', async () => {
    await driver.executeScript(`try { localStorage.removeItem('techDashboardRecents'); } catch (e) {}`);
    await driver.refresh();
    for (let i = 0; i < 50; i++) {
      const cards = await driver.executeScript('return document.querySelectorAll("#feed .card").length;');
      if (cards > 0) break;
      await sleep(100);
    }
    await sleep(200);

    const empty = await driver.executeScript(`
      const section = document.getElementById('recentSection');
      return {
        stored: localStorage.getItem('techDashboardRecents'),
        recentItems: document.querySelectorAll('#recentArticles .recent-item').length,
        display: getComputedStyle(section).display,
        height: Math.round(section.getBoundingClientRect().height)
      };
    `);

    assert.ok(!empty.stored || empty.stored === '[]', 'Test must start with no stored recents');
    assert.equal(empty.recentItems, 0, 'No recent items should be rendered without stored data');
    assert.equal(empty.display, 'none', 'Empty RECENT group must be hidden rather than shown empty');

    // Recents must still appear once real items exist (no fake content added).
    await driver.executeScript(`
      localStorage.setItem('techDashboardRecents', JSON.stringify([
        { title: 'Sidebar regression story', url: 'https://example.com/sidebar-regression' }
      ]));
    `);
    await driver.refresh();
    for (let i = 0; i < 50; i++) {
      const cards = await driver.executeScript('return document.querySelectorAll("#feed .card").length;');
      if (cards > 0) break;
      await sleep(100);
    }
    await sleep(200);

    const populated = await driver.executeScript(`
      const section = document.getElementById('recentSection');
      return {
        recentItems: document.querySelectorAll('#recentArticles .recent-item').length,
        display: getComputedStyle(section).display,
        text: section.textContent
      };
    `);

    assert.equal(populated.recentItems, 1, 'A single stored recent must render exactly one item');
    assert.notEqual(populated.display, 'none', 'RECENT group must appear when it has content');
    assert.match(populated.text, /Sidebar regression story/, 'RECENT group must show the stored title');

    await driver.executeScript(`try { localStorage.removeItem('techDashboardRecents'); } catch (e) {}`);
    await driver.refresh();
    for (let i = 0; i < 50; i++) {
      const cards = await driver.executeScript('return document.querySelectorAll("#feed .card").length;');
      if (cards > 0) break;
      await sleep(100);
    }
    await sleep(200);
  });

  await t.test('mobile drawer starts closed and does not obscure the page', async () => {
    await driver.setWindowRect(390, 844);
    await sleep(400);

    const closed = await driver.executeScript(`
      const filters = document.getElementById('filters');
      const backdrop = document.getElementById('sidebarBackdrop');
      const toggle = document.getElementById('menuToggle');
      const search = document.getElementById('search');
      const fRect = filters.getBoundingClientRect();
      const sRect = search.getBoundingClientRect();
      const viewport = document.documentElement.clientWidth;
      return {
        open: document.body.classList.contains('sidebar-open'),
        expanded: toggle.getAttribute('aria-expanded'),
        controls: toggle.getAttribute('aria-controls'),
        toggleVisible: getComputedStyle(toggle).display !== 'none',
        visibility: getComputedStyle(filters).visibility,
        drawerRight: Math.round(fRect.right),
        backdropDisplay: getComputedStyle(backdrop).display,
        searchInsideViewport: sRect.left >= -1 && sRect.right <= viewport + 1,
        docOverflow: document.documentElement.scrollWidth > viewport,
        searchInteractive: !document.querySelector('.row2').inert
      };
    `);

    assert.equal(closed.open, false, 'Drawer must start closed');
    assert.equal(closed.expanded, 'false', 'Menu control must report collapsed state');
    assert.equal(closed.controls, 'filters', 'Menu control must reference the drawer it toggles');
    assert.ok(closed.toggleVisible, 'Menu control must be available on mobile');
    assert.equal(closed.visibility, 'hidden', 'Closed drawer must be hidden from view and focus');
    assert.ok(closed.drawerRight <= 1, `Closed drawer must sit off-screen, right edge at ${closed.drawerRight}px`);
    assert.equal(closed.backdropDisplay, 'none', 'Backdrop must not block the page while closed');
    assert.ok(closed.searchInsideViewport, 'Search must sit inside the viewport while the drawer is closed');
    assert.equal(closed.docOverflow, false, 'Mobile layout must not overflow horizontally');
    assert.ok(closed.searchInteractive, 'Search must stay interactive while the drawer is closed');
  });

  await t.test('mobile drawer opens from the menu control and covers the page with a backdrop', async () => {
    await driver.setWindowRect(390, 844);
    await sleep(300);
    await driver.executeScript(`
      if (document.body.classList.contains('sidebar-open')) document.getElementById('sidebarClose').click();
    `);
    await sleep(200);

    const toggleEl = await driver.findElement('#menuToggle');
    assert.ok(toggleEl, '#menuToggle must exist');
    await driver.click(toggleEl);
    await sleep(400);

    const open = await driver.executeScript(`
      const filters = document.getElementById('filters');
      const backdrop = document.getElementById('sidebarBackdrop');
      const fRect = filters.getBoundingClientRect();
      const bRect = backdrop.getBoundingClientRect();
      const viewport = document.documentElement.clientWidth;
      const navIds = Array.from(filters.querySelectorAll('.sidebar-item')).map(el => el.id || el.dataset.cat);
      return {
        open: document.body.classList.contains('sidebar-open'),
        expanded: document.getElementById('menuToggle').getAttribute('aria-expanded'),
        visibility: getComputedStyle(filters).visibility,
        onScreen: fRect.left >= -1 && fRect.right <= viewport + 1,
        backdropTag: backdrop.tagName,
        backdropDisplay: getComputedStyle(backdrop).display,
        backdropLabel: (backdrop.getAttribute('aria-label') || '').trim(),
        backdropCovers: bRect.width >= viewport - 1 && bRect.height >= document.documentElement.clientHeight - 1,
        mainInert: document.querySelector('main').inert,
        footerInert: document.querySelector('footer').inert,
        searchInert: document.querySelector('.row2').inert,
        navIds,
        digestsVisible: document.getElementById('digestsNav').getBoundingClientRect().width > 0,
        accountVisible: document.getElementById('syncSettingsBtn').getBoundingClientRect().width > 0,
        docOverflow: document.documentElement.scrollWidth > viewport
      };
    `);

    assert.equal(open.open, true, 'Menu control must open the drawer');
    assert.equal(open.expanded, 'true', 'Menu control must report expanded state');
    assert.equal(open.visibility, 'visible', 'Open drawer must be visible');
    assert.ok(open.onScreen, 'Open drawer must sit fully inside the viewport');
    assert.equal(open.backdropTag, 'BUTTON', 'Backdrop must be a real button');
    assert.equal(open.backdropDisplay, 'block', 'Backdrop must be shown while the drawer is open');
    assert.ok(open.backdropLabel.length > 0, 'Backdrop must carry an accessible label');
    assert.ok(open.backdropCovers, 'Backdrop must cover the page behind the drawer');
    assert.ok(open.mainInert && open.footerInert && open.searchInert, 'Page content behind the drawer must be inert while open');
    assert.ok(open.digestsVisible, 'Drawer must keep every navigation destination reachable');
    assert.equal(open.accountVisible, true, 'Log in must be reachable in the drawer on phones');
    assert.ok(open.navIds.includes('digestsNav'), 'Drawer must keep the digests link');
    assert.equal(open.docOverflow, false, 'Open drawer must not cause horizontal page overflow');

    await driver.executeScript("document.getElementById('sidebarClose').click();");
    await sleep(300);
  });

  await t.test('drawer close button, backdrop click, and Escape all close it', async () => {
    await driver.setWindowRect(390, 844);
    await sleep(300);
    await driver.executeScript(`
      if (document.body.classList.contains('sidebar-open')) document.getElementById('sidebarClose').click();
    `);
    await sleep(200);

    const drawerState = () => driver.executeScript(`
      return {
        open: document.body.classList.contains('sidebar-open'),
        expanded: document.getElementById('menuToggle').getAttribute('aria-expanded'),
        visibility: getComputedStyle(document.getElementById('filters')).visibility,
        backdrop: getComputedStyle(document.getElementById('sidebarBackdrop')).display,
        focusId: document.activeElement ? document.activeElement.id : '',
        mainInert: document.querySelector('main').inert
      };
    `);

    // 1. Close button.
    let toggleEl = await driver.findElement('#menuToggle');
    await driver.click(toggleEl);
    await sleep(350);
    assert.equal((await drawerState()).open, true, 'Drawer must be open before the close-button check');

    const closeEl = await driver.findElement('#sidebarClose');
    assert.ok(closeEl, '#sidebarClose must exist inside the drawer');
    await driver.click(closeEl);
    await sleep(400);
    let state = await drawerState();
    assert.equal(state.open, false, 'Close button must close the drawer');
    assert.equal(state.expanded, 'false', 'Menu control must report collapsed after close button');
    assert.equal(state.visibility, 'hidden', 'Drawer must be hidden after close button');
    assert.equal(state.backdrop, 'none', 'Backdrop must be removed after close button');
    assert.equal(state.mainInert, false, 'Page content must become interactive again');
    assert.equal(state.focusId, 'menuToggle', 'Focus must return to the menu control after closing');

    // 2. Backdrop click, outside the drawer.
    toggleEl = await driver.findElement('#menuToggle');
    await driver.click(toggleEl);
    await sleep(350);
    assert.equal((await drawerState()).open, true, 'Drawer must be open before the backdrop check');

    const viewport = await driver.executeScript('return { w: window.innerWidth, h: window.innerHeight };');
    await driver.pointerClickAt(Math.round(viewport.w - 24), Math.round(viewport.h - 60));
    await sleep(400);
    state = await drawerState();
    assert.equal(state.open, false, 'Clicking the backdrop must close the drawer');
    assert.equal(state.visibility, 'hidden', 'Drawer must be hidden after a backdrop click');

    // 3. Escape.
    toggleEl = await driver.findElement('#menuToggle');
    await driver.click(toggleEl);
    await sleep(350);
    assert.equal((await drawerState()).open, true, 'Drawer must be open before the Escape check');

    await driver.pressKey(KEY_ESCAPE);
    await sleep(400);
    state = await drawerState();
    assert.equal(state.open, false, 'Escape must close the drawer');
    assert.equal(state.expanded, 'false', 'Menu control must report collapsed after Escape');
    assert.equal(state.visibility, 'hidden', 'Drawer must be hidden after Escape');
    assert.equal(state.mainInert, false, 'Page content must be interactive again after Escape');
  });

  await t.test('drawer renders correctly in both light and dark themes', async () => {
    await driver.setWindowRect(390, 844);
    await sleep(300);
    await driver.executeScript(`
      if (document.body.classList.contains('sidebar-open')) document.getElementById('sidebarClose').click();
    `);
    await sleep(200);

    const toggleEl = await driver.findElement('#menuToggle');
    await driver.click(toggleEl);
    await sleep(350);

    const readDrawer = () => driver.executeScript(`
      const filters = document.getElementById('filters');
      const close = document.getElementById('sidebarClose');
      const filtersStyle = getComputedStyle(filters);
      const closeStyle = getComputedStyle(close);
      return {
        theme: document.documentElement.getAttribute('data-theme'),
        surface: filtersStyle.backgroundColor,
        border: filtersStyle.borderRightColor,
        closeSurface: closeStyle.backgroundColor,
        closeBorder: closeStyle.borderTopColor,
        closeColor: closeStyle.color,
        shadow: filtersStyle.boxShadow
      };
    `);

    await driver.executeScript("document.documentElement.setAttribute('data-theme','light');");
    await sleep(200);
    const light = await readDrawer();

    await driver.executeScript("document.documentElement.setAttribute('data-theme','dark');");
    await sleep(200);
    const dark = await readDrawer();

    assert.equal(light.theme, 'light');
    assert.equal(dark.theme, 'dark');
    assert.notEqual(dark.surface, light.surface, 'Drawer surface must follow the theme');
    assert.notEqual(dark.border, light.border, 'Drawer border must follow the theme');
    assert.notEqual(dark.closeColor, light.closeColor, 'Drawer close control must stay legible in dark mode');
    assert.equal(dark.closeSurface, dark.surface, 'Drawer controls must reuse the theme surface');
    assert.equal(dark.closeBorder, dark.border, 'Drawer controls must reuse the theme border');
    assert.notEqual(dark.shadow, 'none', 'Open drawer must be visually distinct from the page');

    await driver.executeScript("document.documentElement.setAttribute('data-theme','light');");
    await sleep(150);
    const restored = await readDrawer();
    assert.equal(restored.surface, light.surface, 'Drawer surface must return to the light theme value');

    await driver.executeScript("document.getElementById('sidebarClose').click();");
    await sleep(300);
  });

  await t.test('drawer controls are keyboard reachable with a visible focus ring', async () => {
    await driver.setWindowRect(390, 844);
    await sleep(300);
    await driver.executeScript(`
      if (document.body.classList.contains('sidebar-open')) document.getElementById('sidebarClose').click();
    `);
    await sleep(200);

    const toggleEl = await driver.findElement('#menuToggle');
    await driver.click(toggleEl);
    await sleep(350);
    assert.equal(
      await driver.executeScript('return document.body.classList.contains("sidebar-open");'),
      true,
      'Drawer must be open before the keyboard traversal check'
    );

    const seen = [];
    let closeFocused = false;
    for (let i = 0; i < 12 && !closeFocused; i++) {
      const current = await driver.executeScript(
        'return document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : "";'
      );
      seen.push(current);
      if (current === 'sidebarClose') { closeFocused = true; break; }
      await driver.pressKey(KEY_TAB);
      await sleep(120);
    }

    assert.ok(closeFocused, `Tab must reach the drawer close control, traversal was ${JSON.stringify(seen)}`);

    const focusRing = await driver.executeScript(`
      const el = document.activeElement;
      const style = getComputedStyle(el);
      return {
        id: el.id,
        tag: el.tagName,
        focusVisible: el.matches(':focus-visible'),
        outlineWidth: parseFloat(style.outlineWidth) || 0,
        outlineStyle: style.outlineStyle
      };
    `);

    assert.equal(focusRing.tag, 'BUTTON', 'Keyboard focus must land on a real button');
    assert.ok(focusRing.focusVisible, 'Drawer control must register as keyboard-focused (:focus-visible)');
    assert.ok(
      focusRing.outlineWidth >= 1 && focusRing.outlineStyle !== 'none',
      'Keyboard-focused drawer control must show a visible focus ring'
    );

    await driver.pressKey(KEY_ESCAPE);
    await sleep(300);
    await driver.setWindowRect(1280, 900);
    await sleep(300);
  });

  await t.test('mobile drawer stays compact, keeps the feed visible, and swipes closed', async () => {
    await driver.setWindowRect(390, 844);
    await sleep(300);
    await driver.executeScript(`
      if (document.body.classList.contains('sidebar-open')) document.getElementById('sidebarClose').click();
    `);
    await sleep(200);

    const toggleEl = await driver.findElement('#menuToggle');
    await driver.click(toggleEl);
    await sleep(400);

    const compact = await driver.executeScript(`
      const filters = document.getElementById('filters');
      const backdrop = document.getElementById('sidebarBackdrop');
      const fRect = filters.getBoundingClientRect();
      const viewport = document.documentElement.clientWidth;
      const color = getComputedStyle(backdrop).backgroundColor;
      const match = color.match(/rgba?\\(([^)]+)\\)/);
      const parts = match ? match[1].split(',').map(v => parseFloat(v)) : [];
      const alpha = parts.length === 4 ? parts[3] : (parts.length === 3 ? 1 : 0);
      const closeRect = document.getElementById('sidebarClose').getBoundingClientRect();
      return {
        viewport,
        width: Math.round(fRect.width),
        fraction: fRect.width / viewport,
        visibleBeside: Math.round(viewport - fRect.right),
        scrimAlpha: alpha,
        closeWidth: Math.round(closeRect.width),
        closeHeight: Math.round(closeRect.height)
      };
    `);

    assert.ok(compact.width >= 200, `Drawer must stay usable, found ${compact.width}px`);
    assert.ok(
      compact.fraction <= 0.66,
      `Drawer must not take over the viewport (occupies ${Math.round(compact.fraction * 100)}% of it)`
    );
    assert.ok(
      compact.visibleBeside >= 100,
      `Feed must stay visible beside the open drawer (${compact.visibleBeside}px uncovered)`
    );
    assert.ok(
      compact.scrimAlpha >= 0.45 && compact.scrimAlpha <= 0.55,
      `Backdrop must dim the page behind the drawer (alpha ${compact.scrimAlpha})`
    );
    assert.ok(
      compact.closeWidth >= 40 && compact.closeHeight >= 40,
      `Close control must be a comfortable touch target (${compact.closeWidth}x${compact.closeHeight})`
    );

    // A mostly-vertical drag is a scroll gesture, not a dismissal.
    const vertical = await driver.executeScript(`
      const filters = document.getElementById('filters');
      const fire = (type, x, y) => {
        const ev = new Event(type, { bubbles: true, cancelable: true });
        ev.touches = [{ clientX: x, clientY: y }];
        ev.changedTouches = [{ clientX: x, clientY: y }];
        filters.dispatchEvent(ev);
      };
      fire('touchstart', 200, 300);
      fire('touchend', 206, 430);
      return document.body.classList.contains('sidebar-open');
    `);
    assert.equal(vertical, true, 'A vertical swipe must not dismiss the drawer');

    // A left swipe dismisses it and hands the page back.
    const swiped = await driver.executeScript(`
      const filters = document.getElementById('filters');
      const fire = (type, x, y) => {
        const ev = new Event(type, { bubbles: true, cancelable: true });
        ev.touches = [{ clientX: x, clientY: y }];
        ev.changedTouches = [{ clientX: x, clientY: y }];
        filters.dispatchEvent(ev);
      };
      fire('touchstart', 200, 300);
      fire('touchend', 120, 312);
      return new Promise(resolve => setTimeout(() => resolve({
        open: document.body.classList.contains('sidebar-open'),
        expanded: document.getElementById('menuToggle').getAttribute('aria-expanded'),
        mainInert: document.querySelector('main').inert,
        backdrop: getComputedStyle(document.getElementById('sidebarBackdrop')).display
      }), 350));
    `);

    assert.equal(swiped.open, false, 'Swiping the drawer left must dismiss it');
    assert.equal(swiped.expanded, 'false', 'Menu control must report collapsed after the swipe');
    assert.equal(swiped.mainInert, false, 'Feed must become interactive again after the swipe');
    assert.equal(swiped.backdrop, 'none', 'Backdrop must be removed after the swipe');
  });

  await t.test('search placeholder stays whole and readable on narrow screens', async () => {
    await driver.setWindowRect(390, 844);
    await sleep(350);

    const placement = await driver.executeScript(`
      const toggle = document.getElementById('searchToggle');
      const count = document.getElementById('resultCount');
      const meta = document.querySelector('.result-meta');
      const toggleRect = toggle.getBoundingClientRect();
      const countRect = count.getBoundingClientRect();
      return {
        grouped: !!(meta && meta.contains(toggle) && meta.contains(count)),
        toggleShown: getComputedStyle(toggle).display !== 'none',
        mastSearchHidden: getComputedStyle(document.querySelector('.mast .search-row')).display === 'none',
        sameRow: Math.abs((toggleRect.top + toggleRect.height / 2) - (countRect.top + countRect.height / 2)) < 20,
        gap: Math.round(toggleRect.left - countRect.right)
      };
    `);
    assert.equal(placement.grouped, true, 'Search icon must sit in the result-count row');
    assert.equal(placement.toggleShown, true, 'Search icon must be visible on a phone');
    assert.equal(placement.mastSearchHidden, true, 'Mast search field must be collapsed on a phone');
    assert.equal(placement.sameRow, true, 'Search icon must share a row with the item count');
    assert.ok(placement.gap >= -1 && placement.gap < 40, `Search icon must sit directly beside the count (gap ${placement.gap}px)`);

    await driver.executeScript(`document.getElementById('searchToggle').click();`);
    await sleep(200);

    const narrow = await driver.executeScript(`
      const el = document.getElementById('search');
      if (document.activeElement === el) el.blur();
      const cs = getComputedStyle(el);
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = (cs.fontWeight || '400') + ' ' + cs.fontSize + ' ' + (cs.fontFamily || 'sans-serif');
      const usable = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const overlay = document.getElementById('searchOverlay');
      const bar = overlay.getBoundingClientRect();
      return {
        placeholder: el.placeholder,
        fontSize: parseFloat(cs.fontSize),
        measured: Math.ceil(ctx.measureText(el.placeholder).width),
        usable: Math.round(usable),
        overlayOpen: !overlay.hidden && document.body.classList.contains('search-open'),
        fullWidth: bar.width >= document.documentElement.clientWidth - 2
      };
    `);

    const placeholderText = 'Search headlines';
    assert.equal(narrow.overlayOpen, true, 'Search icon must open the overlay');
    assert.equal(narrow.fullWidth, true, 'Phone search overlay must span the viewport');
    assert.equal(narrow.placeholder, placeholderText, 'Narrow screens use the Search headlines placeholder');
    assert.ok(narrow.fontSize >= 12, `Placeholder must stay readable (font-size ${narrow.fontSize}px)`);
    assert.ok(
      narrow.measured <= narrow.usable + 4,
      `Placeholder must fit without truncation (needs ${narrow.measured}px, has ${narrow.usable}px)`
    );

    await driver.executeScript(`document.getElementById('searchToggle').click();`);
    await driver.setWindowRect(1280, 900);
    await sleep(350);
    const wide = await driver.executeScript(`
      const row = document.querySelector('.mast .search-row');
      return {
        placeholder: document.getElementById('search').placeholder,
        fontSize: parseFloat(getComputedStyle(document.getElementById('search')).fontSize),
        inMast: !!(row && row.contains(document.getElementById('search'))),
        toggleHidden: getComputedStyle(document.getElementById('searchToggle')).display === 'none',
        overlayHidden: document.getElementById('searchOverlay').hidden
      };
    `);
    assert.equal(wide.placeholder, placeholderText, 'Desktop uses the Search headlines placeholder');
    assert.ok(wide.fontSize >= 14, `Desktop search typography must be unchanged (font-size ${wide.fontSize}px)`);
    assert.equal(wide.inMast, true, 'Desktop search must stay in the mast');
    assert.equal(wide.toggleHidden, true, 'Desktop must hide the row-2 search icon');
    assert.equal(wide.overlayHidden, true, 'Desktop search overlay must stay closed');
  });

  await t.test('renders responsive layouts without horizontal overflow', async () => {
    // Desktop: 1280x900
    await driver.setWindowRect(1280, 900);
    await sleep(300);
    const desktopOverflow = await driver.executeScript(`
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    `);
    assert.equal(desktopOverflow, false, 'Desktop layout (1280x900) should not cause horizontal overflow');

    // Mobile: 390x844
    await driver.setWindowRect(390, 844);
    await sleep(300);
    const mobileOverflow = await driver.executeScript(`
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    `);
    assert.equal(mobileOverflow, false, 'Mobile layout (390x844) should not cause horizontal overflow');

    const mobileElements = await driver.executeScript(`
      return {
        hasStatus: !!document.getElementById('status'),
        hasFeed: !!document.getElementById('feed')
      };
    `);
    assert.ok(mobileElements.hasStatus && mobileElements.hasFeed, 'Key elements must be present in mobile view');
  });

  await t.test('verifies no fatal console or local resource errors', async () => {
    const resourceErrors = await driver.executeScript(`
      return window.performance.getEntriesByType('resource')
        .filter(r => r.name.includes('/data/') || r.name.includes('recent-items.js'))
        .filter(r => r.duration === 0 && r.transferSize === 0);
    `);
    assert.equal(resourceErrors.length, 0, `Local dashboard resources failed to load: ${JSON.stringify(resourceErrors)}`);
  });

});
