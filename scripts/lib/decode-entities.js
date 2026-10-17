// Turn numeric (&#8217;) and named (&amp;) entities into characters.
// A second pass covers values that were escaped twice (&amp;#8217;).

const NAMED = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '\u2019',
  lsquo: '\u2018',
  rdquo: '\u201d',
  ldquo: '\u201c',
};

export function decodeEntities(value = '') {
  let text = String(value ?? '');
  for (let pass = 0; pass < 3; pass += 1) {
    const next = text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (entity, body) => {
      if (body.charAt(0) !== '#') {
        const decoded = NAMED[body.toLowerCase()];
        return decoded === undefined ? entity : decoded;
      }
      const hex = body.charAt(1) === 'x' || body.charAt(1) === 'X';
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isInteger(code) || code < 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) {
        return entity;
      }
      return String.fromCodePoint(code);
    });
    if (next === text) break;
    text = next;
  }
  return text;
}
