// Read time from the article text a feed actually ships. Feeds that publish
// the whole post (content:encoded or Atom content) give a real word count;
// teaser feeds give a few sentences, which is not the article, so they get
// no read time at all rather than a made-up one.
export const WORDS_PER_MINUTE = 230;
export const FULL_TEXT_MIN_WORDS = 300;

export function countWords(html = '') {
  const text = String(html)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ');
  return text.split(/\s+/).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

export function readMinutes(item = {}) {
  const words = countWords(item['content:encoded'] || item.content || '');
  if (words < FULL_TEXT_MIN_WORDS) return 0;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
