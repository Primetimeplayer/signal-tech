// scripts/lib/editorial.js
// Lightweight Phase 4 editorial overrides
// Format: { "link-or-title-substring": { pin: true, boost: 15, hide: false } }

export function applyEditorial(items, overrides = {}) {
  return items
    .map(item => {
      const key = Object.keys(overrides).find(k =>
        (item.link || '').includes(k) || (item.title || '').toLowerCase().includes(k.toLowerCase())
      );
      if (!key) return item;
      const o = overrides[key];
      if (o.hide) return null;
      const next = { ...item };
      if (o.pin) next.score = Math.max(next.score || 0, 95);
      if (o.boost) next.score = Math.min(100, (next.score || 50) + o.boost);
      if (o.note) next.whyItMatters = o.note;
      return next;
    })
    .filter(Boolean);
}
