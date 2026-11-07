// scripts/lib/cluster.js
// Stronger clustering of related stories (Phase 3)

const STOP = new Set([
  'the', 'a', 'an', 'of', 'for', 'in', 'on', 'with', 'and', 'or', 'to', 'from', 'by',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'at', 'as', 'it', 'its', 'this',
  'that', 'these', 'those', 'but', 'if', 'then', 'than', 'so', 'not', 'no', 'yes'
]);

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w))
    .join(' ')
    .trim();
}

function wordSet(str) {
  return new Set(normalize(str).split(' ').filter(Boolean));
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

export function clusterItems(items) {
  const clusters = [];
  const used = new Set();
  const sets = items.map(item => wordSet(item.title));

  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue;
    const cluster = [items[i]];
    used.add(i);
    const baseSet = sets[i];
    const baseTime = new Date(items[i].published || 0).getTime();

    for (let j = i + 1; j < items.length; j++) {
      if (used.has(j)) continue;
      const sim = jaccard(baseSet, sets[j]);
      const hoursApart = Math.abs(baseTime - new Date(items[j].published || 0).getTime()) / 36e5;

      // Tighter threshold + time window; boost if high-signal keywords overlap
      const combined = (items[i].title + ' ' + items[j].title).toLowerCase();
      const highSignal = /\b(nvidia|openai|anthropic|tsmc|hbm|gpu|tpu|jensen|huang|semiconductor)\b/.test(combined);
      // Entity match bonus
      const entities = ['nvidia', 'openai', 'anthropic', 'tsmc', 'jensen', 'huang', 'meta', 'google', 'amd', 'intel'];
      const entityOverlap = entities.filter(e => combined.includes(e)).length;
      const threshold = highSignal ? 0.15 : (entityOverlap >= 1 ? 0.20 : 0.28);

      if (sim >= threshold && hoursApart < 48) {
        cluster.push(items[j]);
        used.add(j);
      }
    }
    clusters.push(cluster);
  }

  return clusters.map(cluster => {
    // Prefer higher score, then source diversity
    cluster.sort((a, b) => {
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (scoreDiff !== 0) return scoreDiff;
      return (a.source || '').localeCompare(b.source || '');
    });
    const primary = { ...cluster[0] };
    primary.isPrimary = true;
    primary.clusterId = primary.link || primary.title;
    primary.clusterSize = cluster.length;
    primary.related = cluster.slice(1).map(item => ({
      source: item.source,
      url: item.link,
      title: item.title
    }));
    return primary;
  });
}
