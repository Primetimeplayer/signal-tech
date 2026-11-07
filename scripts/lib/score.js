// scripts/lib/score.js
// Simple importance scoring for stories (Phase 1)

export function scoreItem(item) {
  let score = 50;

  const high = [
    'SemiAnalysis', 'The Information', 'TechCrunch', 'Ars Technica',
    'IEEE Spectrum', 'SemiEngineering', 'The Register', 'MIT Technology Review'
  ];
  const medium = ["The Verge", 'Wired', 'ZDNet', "Tom's Hardware", 'GitHub Blog'];

  if (high.includes(item.source)) score += 25;
  else if (medium.includes(item.source)) score += 12;

  const published = item.published || item.pubDate;
  if (published) {
    const hoursOld = (Date.now() - new Date(published).getTime()) / 36e5;
    score += Math.max(0, 20 - hoursOld * 0.4);
  }

  const text = ((item.title || '') + ' ' + (item.summary || item.excerpt || '')).toLowerCase();
  if (/\b(nvidia|hbm|tpu|cuda|gpu|asic|chiplet|semiconductor)\b/.test(text)) score += 10;
  if (/\b(open.?source|github|arxiv|paper)\b/.test(text)) score += 6;
  if (/\b(openai|anthropic|meta ai|google deepmind|claude|gpt)\b/.test(text)) score += 5;

  return Math.round(Math.min(100, Math.max(0, score)));
}
