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

test('hero subscribe link points at the beehiiv signup with home_hero UTM and opens safely', () => {
  const { document } = new JSDOM(html).window;
  const link = document.querySelector('#heroSignup a#heroSubscribe');
  assert.ok(link, 'Hero subscribe link must exist');
  assert.equal(document.querySelectorAll('#heroSignup form, #heroSignup input, #heroSignup script').length, 0,
    'Hero signup must be a plain link with no form, input or script');
  const url = new URL(link.getAttribute('href'));
  assert.equal(url.origin + url.pathname, 'https://dailysignaltech.beehiiv.com/subscribe');
  assert.equal(url.searchParams.get('utm_source'), 'signaltechnews');
  assert.equal(url.searchParams.get('utm_medium'), 'home_hero');
  assert.equal(url.searchParams.get('utm_campaign'), 'signup_box');
  assert.equal(link.getAttribute('target'), '_blank');
  assert.ok((link.getAttribute('rel') || '').split(/\s+/).includes('noopener'), 'rel must include noopener');
  assert.equal(link.textContent.trim(), 'Subscribe free');
});
