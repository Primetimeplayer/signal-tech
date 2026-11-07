// scripts/lib/cluster.js
// Basic clustering of related stories (Phase 1)

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(the|a|an|of|for|in|on|with|and|or|to|from|by)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function clusterItems(items) {
  const clusters = [];
  const used = new Set();

  for (let i = 0; i < items.length; i++) {
    if (used.has(i)) continue;
    const cluster = [items[i]];
    used.add(i);
    const base = normalize(items[i].title);

    for (let j = i + 1; j < items.length; j++) {
      if (used.has(j)) continue;
      const other = normalize(items[j].title);
      const words = new Set(base.split(' ').filter(w => w.length > 3));
      const overlap = other.split(' ').filter(w => words.has(w)).length;
      const hoursApart = Math.abs(
        new Date(items[i].published || 0) - new Date(items[j].published || 0)
      ) / 36e5;

      if (overlap >= 2 && hoursApart < 36) {
        cluster.push(items[j]);
        used.add(j);
      }
    }
    clusters.push(cluster);
  }

  return clusters.map(cluster => {
    cluster.sort((a, b) => (b.score || 0) - (a.score || 0));
    const primary = { ...cluster[0] };
    primary.isPrimary = true;
    primary.clusterId = primary.link || primary.title;
    primary.related = cluster.slice(1).map(item => ({
      source: item.source,
      url: item.link,
      title: item.title
    }));
    return primary;
  });
}
