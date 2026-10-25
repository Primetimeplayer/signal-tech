// Headlines are plain text. Some feeds put inline markup in the title
// (The Register: <span class="italic">Reg</span> readers ...), and rss-parser
// hands it over as-is. Drop HTML tags, decode entities, then drop tags again
// in case the markup was escaped twice. Only real HTML element names or tags
// with attributes count, so a headline about <T> generics keeps its text.

import { decodeEntities } from './decode-entities.js';

const HTML_TAG = /<\/?(?:a|abbr|audio|b|blockquote|br|cite|del|div|em|embed|font|h[1-6]|i|iframe|img|ins|li|mark|object|ol|p|picture|q|s|script|small|source|span|strong|style|sub|sup|svg|time|u|ul|video|wbr)\b[^<>]*>|<\/?[a-z][a-z0-9-]*\s+[a-z_:][a-z0-9_:.-]*\s*=[^<>]*>/gi;
const BLOCK_TAG = /^<\/?(?:br|p|div|li|h[1-6]|blockquote)\b/i;

function stripTags(text) {
  return text.replace(HTML_TAG, (tag) => (BLOCK_TAG.test(tag) ? ' ' : ''));
}

export function cleanTitle(value = '') {
  return stripTags(decodeEntities(stripTags(String(value ?? ''))))
    .replace(/\s+/g, ' ')
    .trim();
}
