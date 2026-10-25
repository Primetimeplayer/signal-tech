import test from 'node:test';
import assert from 'node:assert/strict';
import { countWords, readMinutes } from '../scripts/lib/read-time.js';

test('counts words in feed HTML, ignoring tags and entities', () => {
  assert.equal(countWords('<p>Hello&nbsp;<b>new</b> world &mdash; 3 chips</p>'), 5);
  assert.equal(countWords('<style>p{a:b}</style><p>one two</p>'), 2);
});

test('full-text items get a read time from their word count', () => {
  const body = `<p>${'word '.repeat(920)}</p>`;
  assert.equal(readMinutes({ 'content:encoded': body }), 4);
  assert.equal(readMinutes({ content: body }), 4);
});

test('teaser-only items get no read time', () => {
  assert.equal(readMinutes({ content: `<p>${'word '.repeat(60)}</p>` }), 0);
  assert.equal(readMinutes({}), 0);
});
