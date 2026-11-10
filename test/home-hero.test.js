import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.resolve(__dirname, '../public/index.html'), 'utf8');

test('home page has exactly one h1, the hero headline', () => {
  const { document } = new JSDOM(html).window;
  const h1s = document.querySelectorAll('h1');
  assert.equal(h1s.length, 1, `Expected one h1 on the home page, found ${h1s.length}`);
  assert.equal(h1s[0].id, 'heroTitle');
  assert.equal(h1s[0].textContent.trim(), 'Tech news that matters, in 5 minutes');
  assert.equal(document.querySelectorAll('.wordmark').length >= 1, true, 'Wordmark must still be present');
  assert.equal(document.querySelectorAll('h1.wordmark').length, 0, 'Wordmark must not be an h1');
});

test('hero signup is the on-page beehiiv embed, not an off-site subscribe link', () => {
  const { document } = new JSDOM(html).window;
  const frame = document.querySelector('#heroSignup iframe#heroSubscribe');
  assert.ok(frame, 'Hero signup embed must exist');
  assert.equal(document.querySelectorAll('#heroSignup a[href*="beehiiv"], #heroSignup a[href*="/subscribe"]').length, 0,
    'Hero must not send the reader to beehiiv or /subscribe');
  const url = new URL(frame.getAttribute('src'));
  assert.equal(url.origin + url.pathname, 'https://embeds.beehiiv.com/272d8e40-805d-4008-b4c0-75c73e67d0ef');
  assert.equal(url.searchParams.get('slim'), 'true');
  assert.equal(frame.getAttribute('height'), '52');
  assert.equal(document.querySelector('#heroSignup .hero-signup-submit').textContent.trim(), 'Subscribe');
  assert.equal(document.querySelector('#heroTitle').textContent.trim(), 'Tech news that matters, in 5 minutes');
});
