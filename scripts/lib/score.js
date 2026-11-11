// scripts/lib/score.js
// Importance scoring for stories (Phase 1 + Phase 2 boost)

export const SCORE_BASE = 50;
export const HIGH_SOURCES = [
  'SemiAnalysis', 'The Information', 'TechCrunch', 'Ars Technica',
  'IEEE Spectrum', 'SemiEngineering', 'The Register', 'MIT Technology Review',
  'SemiWiki', 'AnandTech',
];
export const MEDIUM_SOURCES = [
  'The Verge', 'Wired', 'ZDNet', "Tom's Hardware", 'GitHub Blog', 'OpenAI Blog', 'Anthropic',
];
export const HIGH_SOURCE_POINTS = 28;
export const MEDIUM_SOURCE_POINTS = 14;
export const RECENCY_CAP = 22;
export const RECENCY_DECAY_PER_HOUR = 0.35;
export const CHIP_POINTS = 12;
export const OPEN_POINTS = 7;
export const LAB_POINTS = 6;
export const WHY_POINTS = 8;
export const WHY_MIN_LENGTH = 20;

export function scoreItem(item) {
  let score = SCORE_BASE;

  if (HIGH_SOURCES.includes(item.source)) score += HIGH_SOURCE_POINTS;
  else if (MEDIUM_SOURCES.includes(item.source)) score += MEDIUM_SOURCE_POINTS;

  const published = item.published || item.pubDate;
  if (published) {
    const hoursOld = (Date.now() - new Date(published).getTime()) / 36e5;
    score += Math.max(0, RECENCY_CAP - hoursOld * RECENCY_DECAY_PER_HOUR);
  }

  const text = ((item.title || '') + ' ' + (item.summary || item.excerpt || '')).toLowerCase();
  if (/\b(nvidia|hbm|tpu|cuda|gpu|asic|chiplet|semiconductor|tsmc)\b/.test(text)) score += CHIP_POINTS;
  if (/\b(open.?source|github|arxiv|paper)\b/.test(text)) score += OPEN_POINTS;
  if (/\b(openai|anthropic|meta ai|google deepmind|claude|gpt|grok)\b/.test(text)) score += LAB_POINTS;

  // Phase 2: lightweight editorial boost for items that already have a human/AI "why it matters"
  if (item.whyItMatters && item.whyItMatters.length > WHY_MIN_LENGTH) score += WHY_POINTS;

  return Math.round(Math.min(100, Math.max(0, score)));
}
