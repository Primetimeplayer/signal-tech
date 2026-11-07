// scripts/lib/score.js
// Importance scoring for stories (Phase 1 + Phase 2 boost)

export function scoreItem(item) {
  let score = 50;

  const high = [
    'SemiAnalysis', 'The Information', 'TechCrunch', 'Ars Technica',
    'IEEE Spectrum', 'SemiEngineering', 'The Register', 'MIT Technology Review',
    'SemiWiki', 'AnandTech'
  ];
  const medium = ["The Verge", 'Wired', 'ZDNet', "Tom's Hardware", 'GitHub Blog', 'OpenAI Blog', 'Anthropic'];

  if (high.includes(item.source)) score += 28;
  else if (medium.includes(item.source)) score += 14;

  const published = item.published || item.pubDate;
  if (published) {
    const hoursOld = (Date.now() - new Date(published).getTime()) / 36e5;
    score += Math.max(0, 22 - hoursOld * 0.35);
  }

  const text = ((item.title || '') + ' ' + (item.summary || item.excerpt || '')).toLowerCase();
  if (/\b(nvidia|hbm|tpu|cuda|gpu|asic|chiplet|semiconductor|tsmc)\b/.test(text)) score += 12;
  if (/\b(open.?source|github|arxiv|paper)\b/.test(text)) score += 7;
  if (/\b(openai|anthropic|meta ai|google deepmind|claude|gpt|grok)\b/.test(text)) score += 6;

  // Phase 2: lightweight editorial boost for items that already have a human/AI "why it matters"
  if (item.whyItMatters && item.whyItMatters.length > 20) score += 8;

  return Math.round(Math.min(100, Math.max(0, score)));
}
