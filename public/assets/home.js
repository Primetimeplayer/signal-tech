
  const feedEl = document.getElementById('feed');
  const newsletterCardEl = document.getElementById('newsletterCard');
  let statusClock = '';
  function t(key, vars) {
    const select = document.getElementById('languageSelect');
    const code = select && select.value ? select.value : 'en-US';
    return window.SignalI18n.translate(code, key, vars);
  }
  function applyI18n() {
    const select = document.getElementById('languageSelect');
    const code = select && select.value ? select.value : 'en-US';
    window.SignalI18n.apply(document, code);
    if (statusEl) {
      statusEl.textContent = statusClock ? `${t('updated')} ${statusClock}` : t('loading');
    }
    syncLocaleMenus();
    if (searchRowEl && searchRowEl.classList.contains('is-open')) renderSearchSuggest();
  }
  const skeletonEl = document.getElementById('skeleton');
  const statusEl = document.getElementById('status');
  const filtersEl = document.getElementById('filters');
  const searchEl = document.getElementById('search');
  const searchToggleEl = document.getElementById('searchToggle');
  const searchOverlayEl = document.getElementById('searchOverlay');
  const searchOverlayBarEl = document.getElementById('searchOverlayBar');
  const searchRowEl = document.querySelector('.mast .search-row');
  const searchAnchorEl = document.querySelector('.mast-right');
  const sourceFilterEl = document.getElementById('sourceFilter');
  const dateFilterEl = document.getElementById('dateFilter');
  const themeToggleEl = document.getElementById('themeToggle');
  const themeIconEl = document.getElementById('themeIcon');
  const resultCountEl = document.getElementById('resultCount');
  const latestSectionEl = document.getElementById('latestSection');
  const latestRowEl = document.getElementById('latestRow');
  const latestPrevEl = document.getElementById('latestPrev');
  const latestNextEl = document.getElementById('latestNext');
  const hwToggleEl = document.getElementById('hwToggle');
  const savedToggleEl = document.getElementById('savedToggle');
  const errorBannerEl = document.getElementById('errorBanner');
  const loadMoreWrapEl = document.getElementById('loadMoreWrap');
  const loadMoreBtnEl = document.getElementById('loadMoreBtn');
  const searchHintEl = document.getElementById('searchHint');
  const searchClearEl = document.getElementById('searchClear');
  const searchSuggestEl = document.getElementById('searchSuggest');
  const clearFiltersEl = document.getElementById('clearFilters');


  const AUTO_REFRESH_MS = 300000;
  const LATEST_WINDOW_MS = 12 * 60 * 60 * 1000;
  const PAGE_SIZE = 18;
  const SEARCH_DEBOUNCE_MS = 150;

  const SUN_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
  const MOON_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  const VERTICALS = {
    software: ['software', 'developer', 'programming', 'github', 'linux', 'windows', 'open source', 'open-source', 'javascript', 'python'],
    chips: ['chip', 'chips', 'silicon', 'semiconductor', 'nvidia', 'amd', 'intel', 'tsmc', 'gpu', 'cpu', 'qualcomm', 'wafer'],
    gaming: ['game', 'games', 'gaming', 'console', 'playstation', 'xbox', 'nintendo', 'steam', 'esports'],
    space: ['spacex', 'nasa', 'rocket', 'rockets', 'satellite', 'orbit', 'lunar', 'astronaut', 'apollo'],
    security: ['security', 'cybersecurity', 'ransomware', 'vulnerability', 'malware', 'breach', 'encrypt', 'encryption'],
    gadgets: ['laptop', 'smartphone', 'iphone', 'android', 'tablet', 'macbook', 'ipad', 'headphone', 'wearable', 'gadget'],
  };

  const HARDWARE_KEYWORDS = [
    'gpu', 'cpu', 'chip', 'chipset', 'processor', 'silicon', 'semiconductor',
    'nvidia', 'amd', 'intel', 'qualcomm', 'tsmc', 'apple silicon',
    'laptop', 'smartphone', 'tablet', 'wearable', 'smartwatch',
    'headset', 'vr', 'ar glasses', 'robot', 'robotics', 'drone',
    'accelerator', 'tpu', 'npu', 'inference chip', 'data center hardware',
    'battery', 'sensor', 'camera module', 'motherboard', 'ssd', 'ram',
  ];

  let activeFilter = 'all';
  let activeSource = 'all';
  let activeDate = 'all';
  let hardwareOnly = false;
  let savedOnly = false;
  let searchTerm = '';
  let searchSuggestIndex = -1;
  const RECENT_SEARCH_KEY = 'signal-recent-searches';
  const SEARCH_TOPICS = [
    ['papers', 'catPapers'],
    ['chips', 'catChips'],
    ['software', 'catSoftware'],
    ['security', 'catSecurity'],
    ['space', 'catSpace'],
    ['gaming', 'catGaming'],
  ];

  let allItems = [];
  let visibleCount = PAGE_SIZE;
  let searchTimer = null;
  let fetchErrors = [];
  let feedFailed = false;
  let balanceQueue = [];
  let balancedShown = 0;
  let makeStoryRow = () => '';

  // --- Theme ---
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeIconEl.outerHTML = theme === 'light' ? SUN_SVG.replace('<svg', '<svg id="themeIcon"') : MOON_SVG.replace('<svg', '<svg id="themeIcon"');
    // Re-grab the element since outerHTML replaced it
    // Actually, let's use innerHTML instead
  }
  function setThemeIcon(theme) {
    const container = document.getElementById('themeToggle');
    // Expose the toggle's state through its accessible name: the label
    // always describes the theme you would switch TO, so the current theme
    // is inferable by assistive technology (the icon alone conveys nothing).
    const targetTheme = theme === 'light' ? 'dark' : 'light';
    const actionLabel = `Switch to ${targetTheme} theme`;
    container.setAttribute('aria-label', actionLabel);
    container.setAttribute('title', actionLabel);
    container.innerHTML = theme === 'light'
      ? '<svg id="themeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg id="themeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }
  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem('signal-theme'); } catch (e) {}
    const theme = saved || (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    setThemeIcon(theme);
  }
  themeToggleEl.addEventListener('click', () => {
    const next = (document.documentElement.getAttribute('data-theme') || 'dark') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    setThemeIcon(next);
    try { localStorage.setItem('signal-theme', next); } catch (e) {}
  });
  initTheme();

  // --- Saved items + account sync ---
const AUTH_BASE = 'https://signal-sync.primetimeplayer-signal-sync.workers.dev';
const AUTH_TOKEN_KEY = 'signal-auth-token';

let authState = { authenticated: false, user: null };
let authReady = false;
let authToken = '';
try {
  authToken = localStorage.getItem(AUTH_TOKEN_KEY) || '';
} catch (e) {
  authToken = '';
}

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem('signal-saved') || '{}');
  } catch (e) {
    return {};
  }
}

function persistSaved(map) {
  try {
    localStorage.setItem('signal-saved', JSON.stringify(map));
  } catch (e) {}
}

let savedMap = loadSaved();

function authHeaders(extra = {}) {
  const headers = { ...extra };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
}

async function exchangeAuthCode() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('auth_code');

  if (!code) return false;

  try {
    const res = await fetch(`${AUTH_BASE}/auth/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code }),
    });

    if (!res.ok) {
      throw new Error(`auth exchange: ${res.status}`);
    }

    const data = await res.json();

    if (!data.token) {
      throw new Error('Auth exchange returned no token');
    }

    authToken = data.token;
    localStorage.setItem(AUTH_TOKEN_KEY, authToken);

    history.replaceState(
      {},
      document.title,
      window.location.pathname + window.location.hash
    );

    return true;
  } catch (e) {
    console.error('Auth exchange failed:', e.message);
    authToken = '';
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return false;
  }
}

async function getAuthState() {
  try {
    const res = await fetch(`${AUTH_BASE}/api/me`, {
      headers: authHeaders(),
    });

    if (!res.ok) {
      authState = { authenticated: false, user: null };

      if (res.status === 401) {
        authToken = '';
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }

      return authState;
    }

    authState = await res.json();
    return authState;
  } catch (e) {
    console.error('Auth check failed:', e.message);
    authState = { authenticated: false, user: null };
    return authState;
  }
}

async function getCloudSaved() {
  const res = await fetch(`${AUTH_BASE}/api/saved`, {
    headers: authHeaders(),
  });

  if (!res.ok) throw new Error(`saved GET: ${res.status}`);

  const data = await res.json();
  const items = Array.isArray(data) ? data : (data.saved || data.items || []);
  const map = {};

  for (const item of items) {
    if (!item.url && !item.story_url) continue;

    const link = item.url || item.story_url;

    map[link] = {
      title: item.title || '',
      savedAt: item.savedAt || item.saved_at || new Date().toISOString(),
      note: item.note || '',
    };
  }

  return map;
}

async function putCloudSaved(link, item) {
  const res = await fetch(`${AUTH_BASE}/api/saved`, {
    method: 'PUT',
    headers: authHeaders({
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify({
      url: link,
      title: item.title || '',
      note: item.note || '',
      savedAt: item.savedAt || new Date().toISOString(),
    }),
  });

  if (!res.ok) throw new Error(`saved PUT: ${res.status}`);
}

async function deleteCloudSaved(link) {
  const res = await fetch(
    `${AUTH_BASE}/api/saved?url=${encodeURIComponent(link)}`,
    {
      method: 'DELETE',
      headers: authHeaders(),
    }
  );

  if (!res.ok) throw new Error(`saved DELETE: ${res.status}`);
}

async function migrateLocalSavedToCloud() {
  const localMap = { ...savedMap };
  const remoteMap = await getCloudSaved();

  for (const link of Object.keys(localMap)) {
    const item = localMap[link];
    await putCloudSaved(link, item);
  }

  savedMap = { ...remoteMap, ...localMap };
  persistSaved(savedMap);

  console.log(
    `Saved Stories synced: ${Object.keys(localMap).length} local, ${Object.keys(remoteMap).length} account`
  );
}

async function logoutAccount() {
  try {
    if (authToken) {
      await fetch(`${AUTH_BASE}/auth/logout`, {
        method: 'POST',
        headers: authHeaders(),
      });
    }
  } catch (e) {
    console.error('Logout failed:', e.message);
  }

  authToken = '';
  localStorage.removeItem(AUTH_TOKEN_KEY);
  authState = { authenticated: false, user: null };
  authReady = true;

  const accountBtn = document.getElementById('syncSettingsBtn');

  if (accountBtn) {
    setAccountLabel('login');
    accountBtn.title = t('signInGoogle');
  }

  render();
}

async function initAuth() {
  await exchangeAuthCode();
  await getAuthState();

  authReady = true;

  const accountBtn = document.getElementById('syncSettingsBtn');

  if (authState.authenticated) {
    if (accountBtn) {
      setAccountLabel('logout');
      accountBtn.title = authState.user?.email || t('logOut');
    }

    try {
      await migrateLocalSavedToCloud();
      render();
    } catch (e) {
      console.error('Saved Stories sync failed:', e.message);
    }
  } else {
    if (accountBtn) {
      setAccountLabel('login');
      accountBtn.title = t('signInGoogle');
    }
  }
}

// Keeps the account icon and updates only its visible/accessible label.
function setAccountLabel(label) {
  const btn = document.getElementById('syncSettingsBtn');
  if (!btn) return;
  let textNode = btn.querySelector('.account-label');
  if (!textNode) {
    textNode = document.createElement('span');
    textNode.className = 'account-label';
    btn.appendChild(textNode);
  }
  const mode = label === 'logout' || label === 'Log out' ? 'logout' : 'login';
  textNode.textContent = mode === 'logout' ? t('logOut') : t('logIn');
  btn.setAttribute('aria-label', mode === 'logout' ? t('logOutAccount') : t('logInSync'));
}

document.getElementById('syncSettingsBtn')?.addEventListener('click', () => {
  if (authState.authenticated) {
    logoutAccount();
  } else {
    window.location.href = `${AUTH_BASE}/auth/google`;
  }
});

  // render() rebuilds the cards, so the button that was clicked is gone by the
  // time we return. Re-apply the confirmation to its replacement — and hand
  // keyboard focus back — so a save toggle never looks like it did nothing.
  function flashSaveButton(link, giveFocus) {
    const btn = Array.from(feedEl.querySelectorAll('.save-btn'))
      .find((b) => b.dataset.link === link);
    if (!btn) {
      // The card left the feed (un-saving inside the Saved view); keep focus
      // on the control that governs that view instead of dropping it.
      if (giveFocus) {
        const savedToggle = Array.from(document.querySelectorAll('.toggle-saved')).find((el) => el.getClientRects().length) || savedToggleEl;
        savedToggle.focus({ preventScroll: true });
      }
      return;
    }
    btn.classList.add('save-pulse');
    btn.addEventListener('animationend', () => btn.classList.remove('save-pulse'), { once: true });
    if (giveFocus) btn.focus({ preventScroll: true });
  }

async function toggleSave(link) {
  const wasSaved = !!savedMap[link];
  const active = document.activeElement;
  const hadFocus = !!(active && active.classList && active.classList.contains('save-btn') &&
    active.dataset.link === link);
  const previous = wasSaved ? { ...savedMap[link] } : null;

  if (wasSaved) {
    delete savedMap[link];
  } else {
    savedMap[link] = {
      title: allItems.find((item) => item.link === link)?.title || '',
      savedAt: new Date().toISOString(),
      note: '',
    };
  }

  persistSaved(savedMap);
  render();
  flashSaveButton(link, hadFocus);

  if (!authReady || !authState.authenticated) return;

  try {
    if (wasSaved) {
      await deleteCloudSaved(link);
    } else {
      await putCloudSaved(link, savedMap[link]);
    }
  } catch (e) {
    console.error('Saved Story update failed:', e.message);

    if (wasSaved) {
      savedMap[link] = previous;
    } else {
      delete savedMap[link];
    }

    persistSaved(savedMap);
    render();
    flashSaveButton(link, hadFocus);
  }
}

async function updateNote(link, text) {
  if (!savedMap[link]) return;

  savedMap[link].note = text;
  persistSaved(savedMap);

  if (!authReady || !authState.authenticated) return;

  try {
    await putCloudSaved(link, savedMap[link]);
  } catch (e) {
    console.error('Saved Story note update failed:', e.message);
  }
}

initAuth();

  // --- Helpers ---
  function timeAgo(iso) {
    if (!iso) return '';
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return t('justNow');
    if (mins < 60) return t('minsAgo', { n: mins });
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return t('hoursAgo', { n: hrs });
    return t('daysAgo', { n: Math.floor(hrs / 24) });
  }
  function catLabel(cat) {
    return { news: t('catNews'), papers: t('catPaper'), reviews: t('catReview'), reddit: t('catReddit') }[cat] || cat;
  }
  function escapeHtml(str = '') {
    return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function escapeAttr(str = '') {
    return str.replace(/"/g, '&quot;');
  }
  // Cached JSON can still hold &#8217; or &amp;. Decode first, then escape,
  // so the character shows and markup in the feed cannot run.
  function decodeEntities(value = '') {
    const named = {
      amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
      hellip: '…', mdash: '—', ndash: '–', rsquo: '\u2019', lsquo: '\u2018',
      rdquo: '\u201d', ldquo: '\u201c',
    };
    let text = String(value ?? '');
    for (let pass = 0; pass < 3; pass += 1) {
      const next = text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]+);/gi, (entity, body) => {
        if (body.charAt(0) !== '#') {
          const decoded = named[body.toLowerCase()];
          return decoded === undefined ? entity : decoded;
        }
        const hex = body.charAt(1) === 'x' || body.charAt(1) === 'X';
        const code = parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
        if (!Number.isFinite(code) || code < 0 || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) return entity;
        return String.fromCodePoint(code);
      });
      if (next === text) break;
      text = next;
    }
    return text;
  }
  function textHtml(value = '') {
    return escapeHtml(decodeEntities(value));
  }
  function textAttr(value = '') {
    return escapeAttr(decodeEntities(value));
  }
  function withinDateFilter(iso, filter) {
    if (filter === 'all' || !iso) return true;
    const ageMs = Date.now() - new Date(iso).getTime();
    if (filter === 'today') return ageMs <= 24 * 60 * 60 * 1000;
    if (filter === 'week') return ageMs <= 7 * 24 * 60 * 60 * 1000;
    return true;
  }
  function isHardware(item) {
    const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
    return HARDWARE_KEYWORDS.some((kw) => text.includes(kw));
  }

  function matchesKeywords(item, words) {
    const text = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
    return words.some((word) => {
      const body = String(word).toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`(?:^|[^a-z0-9])${body}(?:[^a-z0-9]|$)`).test(text);
    });
  }

  function matchesVertical(item, filter) {
    if (!filter || filter === 'all') return true;
    if (filter === 'news' || filter === 'papers' || filter === 'reviews' || filter === 'reddit') {
      return item.category === filter;
    }
    if (filter === 'gadgets') return isHardware(item) || matchesKeywords(item, VERTICALS.gadgets);
    const words = VERTICALS[filter];
    return words ? matchesKeywords(item, words) : item.category === filter;
  }

  function sortItems(list) {
    return list.slice().sort((a, b) => {
      const da = new Date(a.published || 0).getTime() || 0;
      const db = new Date(b.published || 0).getTime() || 0;
      return db - da;
    });
  }

  // Contextual chips come only from fields the feed actually provides.
  // Papers carry arXiv subject codes; everything else is already labelled
  // by the category/source meta line, so no chip is invented for it.
  function arxivSubject(categories) {
    if (!Array.isArray(categories)) return '';
    for (const entry of categories) {
      if (typeof entry !== 'string') continue;
      const code = entry.trim();
      if (code.length <= 12 && /^[a-z-]+(\.[a-z-]+)?\.[A-Z]{2}$/.test(code)) return code;
    }
    return '';
  }

  function buildCardChips(item) {
    if (!item || typeof item !== 'object') return [];
    const chips = [];
    if (item.category === 'papers') {
      const subject = arxivSubject(item.categories);
      if (subject) chips.push({ text: subject, kind: 'subject' });
    }
    return chips;
  }

  function populateSources() {
    // The source/time selects are hidden state holders at the end of <body>
    // (no longer toolbar controls), but the filter logic still reads them,
    // so they stay populated.
    if (!sourceFilterEl) return;

    // Group sources by category for easier scanning
    const byCategory = { news: [], papers: [], reviews: [], reddit: [] };
    const sources = [...new Set(allItems.map((i) => i.source).filter(Boolean))].sort();
    sources.forEach((s) => {
      const item = allItems.find((i) => i.source === s);
      const cat = item ? item.category : null;
      if (cat && byCategory[cat]) byCategory[cat].push(s);
      else byCategory.news.push(s); // fallback
    });

    const current = sourceFilterEl.value;
    let html = `<option value="all">${escapeHtml(t('allSources'))}</option>`;
    const labels = { news: t('groupNews'), papers: t('groupPapers'), reviews: t('groupReviews'), reddit: t('groupReddit') };
    for (const cat of ['news', 'papers', 'reviews', 'reddit']) {
      if (byCategory[cat].length) {
        html += `<optgroup label="${escapeAttr(labels[cat])}">`;
        byCategory[cat].forEach((s) => {
          html += `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`;
        });
        html += '</optgroup>';
      }
    }
    sourceFilterEl.innerHTML = html;
    if ([...sourceFilterEl.options].some((o) => o.value === current)) sourceFilterEl.value = current;
  }

  function storyImageUrl(item) {
    const raw = item && (item.image || item.imageUrl || item.thumbnail) || '';
    const url = String(raw).replace(/&amp;|&#0*38;|&#x0*26;/gi, '&').trim();
    return /^https?:\/\//i.test(url) ? url : '';
  }

  function storyCategory(item) {
    const category = item && item.category;
    if (category === 'papers' || category === 'reviews' || category === 'reddit') return category;
    return 'news';
  }

  function categoryIconSvg(category) {
    const icons = {
      news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
      papers: '<path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M8 13h8M8 17h5"/>',
      reviews: '<path d="m12 3 2.2 4.6L19 8.2l-3.5 3.4.8 4.9L12 14.8 7.7 16.5l.8-4.9L5 8.2l4.8-.6L12 3z"/>',
      reddit: '<path d="M5 6h14v9H8l-3 3V6z"/>',
    };
    const body = icons[category] || icons.news;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
  }

  function mediaPlaceholder(item, kind) {
    const category = storyCategory(item);
    return `<span class="card-media ${kind}-media media-fallback" data-category="${escapeAttr(category)}" aria-hidden="true">${categoryIconSvg(category)}</span>`;
  }

  // A failed story photo is removed so the broken-image icon never shows.
  // The box that replaces it keeps the photo's height, stays light gray,
  // and centers the publisher favicon.
  function signalImageFallback(img) {
    if (!img || img.dataset.fallbackApplied === '1') return;
    img.dataset.fallbackApplied = '1';
    img.hidden = true;
    const category = storyCategory({ category: img.dataset.category });
    const kind = img.classList.contains('hero-thumb') ? 'hero' : img.classList.contains('pick-thumb') ? 'pick' : 'story';
    const holder = document.createElement('span');
    holder.className = `card-media ${kind}-media media-fallback`;
    holder.dataset.category = category;
    holder.setAttribute('aria-hidden', 'true');
    const host = img.dataset.sourceHost || '';
    if (host) {
      const mark = document.createElement('img');
      mark.className = 'media-fallback-mark';
      mark.alt = '';
      mark.setAttribute('referrerpolicy', 'no-referrer');
      mark.setAttribute('decoding', 'async');
      mark.setAttribute('loading', kind === 'story' ? 'lazy' : 'eager');
      mark.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
      mark.addEventListener('error', () => {
        mark.hidden = true;
      });
      holder.appendChild(mark);
    }
    if (img.parentNode) img.replaceWith(holder);
  }

  function cardImage(item, kind, width, height) {
    const url = storyImageUrl(item);
    if (!url) return mediaPlaceholder(item, kind);
    const cls = kind === 'hero' ? 'hero-thumb' : kind === 'pick' ? 'pick-thumb' : 'story-thumb';
    const host = publisherHost(item && item.link);
    // Text, tags, and timestamps are in the card markup. The photo URL stays
    // on data-src until the text has painted, with a reserved box so the
    // image cannot shift the card when it arrives.
    const loading = (kind === 'hero' || kind === 'pick') ? 'eager' : 'lazy';
    return `<img class="${cls}" alt="" width="${width}" height="${height}" loading="${loading}" decoding="async" referrerpolicy="no-referrer" data-src="${escapeAttr(url)}" data-category="${escapeAttr(storyCategory(item))}" data-source-host="${escapeAttr(host)}" onerror="signalImageFallback(this)">`;
  }

  function mountCardImages(root) {
    if (!root) return;
    root.querySelectorAll('img[data-src]').forEach((img) => {
      if (img.getAttribute('src')) return;
      const loading = (img.classList.contains('hero-thumb') || img.classList.contains('pick-thumb')) ? 'eager' : 'lazy';
      img.setAttribute('loading', loading);
      img.setAttribute('referrerpolicy', 'no-referrer');
      img.setAttribute('decoding', 'async');
      if (!img.getAttribute('width') || !img.getAttribute('height')) {
        if (img.classList.contains('hero-thumb')) {
          img.width = 640;
          img.height = 248;
        } else if (img.classList.contains('pick-thumb')) {
          img.width = 72;
          img.height = 72;
        } else {
          img.width = 96;
          img.height = 96;
        }
      }
      img.src = img.dataset.src;
    });
  }

  function paintCardImages(root) {
    // Yield so the card text paints before image requests start. A hidden
    // document pauses requestAnimationFrame, so a timeout is the reliable yield.
    setTimeout(() => mountCardImages(root), 0);
  }

  function storyThumb(item, width = 96, height = 96) {
    return cardImage(item, 'story', width, height);
  }

  function storyByline(item) {
    const when = timeAgo(item.published);
    const author = Array.isArray(item.authors) && item.authors.length
      ? item.authors.slice(0, 2).join(', ')
      : (item.author || '');
    return [when, author].filter(Boolean).join(' · ');
  }

  function publisherHost(link) {
    try {
      return new URL(link).hostname.replace(/^www\./, '');
    } catch (e) {
      return '';
    }
  }

  function sourceMark(item) {
    const host = publisherHost(item && item.link);
    const letter = escapeHtml(((item && item.source) || host || '?').trim().charAt(0).toUpperCase() || '?');
    const fallback = `<span class="source-favicon source-favicon-fallback"${host ? ' hidden' : ''}>${letter}</span>`;
    if (!host) return fallback;
    const src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
    return `<img class="source-favicon" src="${escapeAttr(src)}" alt="" width="16" height="16" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true;var n=this.nextElementSibling;if(n)n.hidden=false">${fallback}`;
  }

  function storyAuthor(item) {
    if (!item) return '';
    if (Array.isArray(item.authors) && item.authors.length) return item.authors.slice(0, 2).join(', ');
    return item.author || '';
  }

  function relativeDate(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const mins = Math.floor((Date.now() - then) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins === 1 ? '1 minute ago' : `${mins} minutes ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return days === 1 ? '1 day ago' : `${days} days ago`;
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function sourceLine(item) {
    const name = item && item.source ? `<span class="source-name">${textHtml(item.source)}</span>` : '';
    return `<div class="source-line">${sourceMark(item)}${name}</div>`;
  }

  function cardMeta(item) {
    const when = relativeDate(item.published);
    const author = storyAuthor(item);
    const cat = catLabel(item.category);
    const source = (item && item.source) || '';
    const hasExtra = Boolean(when || author);
    return `<div class="card-meta${hasExtra ? ' has-extra' : ''}"><span class="cat-label">${escapeHtml(cat)}</span><span class="meta-source visually-hidden" aria-hidden="true">${textHtml(source)}</span>${when ? `<span class="meta-time">${escapeHtml(when)}</span>` : ''}${author ? `<span class="meta-author">${escapeHtml(author)}</span>` : ''}</div>`;
  }

  function pickThumb(item) {
    return cardImage(item, 'pick', 72, 72);
  }

  function titleTokens(title) {
    const stop = new Set(['the', 'a', 'an', 'of', 'to', 'and', 'in', 'on', 'for', 'with', 'from', 'its', 'is', 'are', 'at', 'by', 'as', 'after', 'new', 'over', 'into', 'that', 'this', 'than', 'will', 'have', 'been', 'says', 'said']);
    return (title || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 3 && !stop.has(word));
  }

  function pickRelated(lead, pool, limit = 4) {
    if (!lead) return [];
    const leadTokens = new Set(titleTokens(lead.title));
    const scored = pool
      .filter((item) => item.link !== lead.link && item.source !== lead.source)
      .map((item) => {
        const overlap = titleTokens(item.title).reduce((count, token) => count + (leadTokens.has(token) ? 1 : 0), 0);
        return { item, overlap };
      })
      .filter((row) => row.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap);
    const related = [];
    const seen = new Set();
    for (const row of scored) {
      if (related.length >= limit) break;
      if (seen.has(row.item.source)) continue;
      related.push(row.item);
      seen.add(row.item.source);
    }
    return related;
  }

  function cardActions(item, saved, note) {
    return `
          <div class="card-actions">
            <button class="icon-btn save-btn${saved ? ' active' : ''}" data-link="${escapeAttr(item.link)}" aria-pressed="${saved ? 'true' : 'false'}">${saved ? `★ ${escapeHtml(t('savedStar'))}` : `☆ ${escapeHtml(t('save'))}`}</button>
            <button class="icon-btn share-btn" data-link="${escapeAttr(item.link)}">⇪ ${escapeHtml(t('share'))}</button>
          </div>
          ${saved ? `
          <div class="note-box">
            <p class="note-label">${escapeHtml(t('yourNote'))}</p>
            <textarea class="note-input" data-link="${escapeAttr(item.link)}" aria-label="${escapeAttr(t('yourNote'))}" placeholder="${escapeAttr(t('notePlaceholder'))}">${escapeHtml(note)}</textarea>
          </div>` : ''}`;
  }

  function isPromoItem(item) {
    return /\b(coupons?|promo[\s-]*codes?|discounts?|lingerie)\b/i.test((item && item.title) || '');
  }

  function renderLatest() {
    const latest = allItems
      .filter((i) => i.published && !Number.isNaN(new Date(i.published).getTime()) && !isPromoItem(i))
      .slice(0, 10);
    const latestCountEl = document.getElementById('latestCount');
    if (!latest.length) {
      latestSectionEl.hidden = true;
      if (latestCountEl) latestCountEl.textContent = '';
      return;
    }
    latestSectionEl.hidden = false;
    if (latestCountEl) {
      latestCountEl.textContent = latest.length === 1 ? t('newestOne') : t('newestMany', { n: latest.length });
    }
    latestRowEl.innerHTML = latest.map((item) => {
      const sourceName = (item.source && String(item.source).trim()) || catLabel(item.category);
      return `
      <a class="latest-card ${item.category}" href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer" data-recent-title="${textAttr(item.title)}">
        <div class="cat">${textHtml(sourceName)} · ${timeAgo(item.published)}</div>
        <h3>${textHtml(item.title)}</h3>
      </a>
    `;
    }).join('');
    syncLatestNav();
  }

  // --- Latest Stories carousel controls ---
  // Prev/next drive the existing horizontal scroll container (no autoplay).
  function syncLatestNav() {
    if (!latestRowEl || !latestPrevEl || !latestNextEl) return;
    const max = latestRowEl.scrollWidth - latestRowEl.clientWidth;
    latestPrevEl.disabled = latestRowEl.scrollLeft <= 1;
    latestNextEl.disabled = max <= 1 || latestRowEl.scrollLeft >= max - 1;
    const bar = document.getElementById('latestProgressBar');
    if (!bar) return;
    const total = latestRowEl.scrollWidth;
    const view = latestRowEl.clientWidth;
    const thumb = total > 0 ? Math.min(100, Math.max(8, (view / total) * 100)) : 100;
    const ratio = max <= 1 ? 0 : Math.min(1, Math.max(0, latestRowEl.scrollLeft / max));
    bar.style.width = `${thumb}%`;
    bar.style.marginLeft = `${ratio * (100 - thumb)}%`;
  }

  function scrollLatest(dir) {
    const card = latestRowEl && latestRowEl.querySelector('.latest-card');
    if (!card) return;
    const gap = parseFloat(getComputedStyle(latestRowEl).gap) || 0;
    const step = card.getBoundingClientRect().width + gap;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    latestRowEl.scrollBy({ left: dir * step, behavior: reduce ? 'auto' : 'smooth' });
  }

  latestPrevEl.addEventListener('click', () => scrollLatest(-1));
  latestNextEl.addEventListener('click', () => scrollLatest(1));
  latestRowEl.addEventListener('scroll', syncLatestNav, { passive: true });
  window.addEventListener('resize', syncLatestNav);
  window.addEventListener('resize', () => {
    if (feedEl && feedEl.querySelector('.picks-col')) balanceColumns();
  });

  function buildShareText(item) {
    const hook = item.whyItMatters || item.summary || '';
    return `${item.title}${hook ? ' — ' + hook : ''} ${item.link}`.trim();
  }

  // The toast lives exactly this long, then is removed from the DOM so a stale
  // confirmation can never be announced or read again.
  const SHARE_FEEDBACK_MS = 1600;

  const SHARE_OK = () => t('shareOk');
  const SHARE_FAIL = () => t('shareFail');

  // Report the outcome of a share attempt next to the button that triggered it.
  // role="status" makes both success and failure a polite live-region
  // announcement, so the result is not conveyed by colour or icon alone.
  function showShareFeedback(btn, message, ok) {
    if (btn._shareFeedback) {
      clearTimeout(btn._shareFeedbackTimer);
      btn._shareFeedback.remove();
      btn._shareFeedback = null;
    }

    const fb = document.createElement('span');
    fb.className = 'share-feedback' + (ok ? '' : ' is-error');
    fb.setAttribute('role', 'status');
    fb.setAttribute('aria-live', 'polite');
    fb.setAttribute('aria-atomic', 'true');
    fb.textContent = message;
    btn.insertAdjacentElement('afterend', fb);

    btn._shareFeedback = fb;
    btn._shareFeedbackTimer = setTimeout(() => {
      fb.remove();
      if (btn._shareFeedback === fb) btn._shareFeedback = null;
    }, SHARE_FEEDBACK_MS);
  }

  // Returns whether the copy really happened, so callers report the truth
  // instead of assuming success and hiding a failure from the user.
  async function writeToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        // Permission denied or insecure context: try the legacy path below.
      }
    }

    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  async function copyText(text, btn) {
    // Captured once per button so a second click still restores the real label.
    const copied = await writeToClipboard(text);
    clearTimeout(btn._labelTimer);

    if (copied) {
      btn.textContent = `✓ ${t('copied')}`;
      btn.classList.add('copied');
      btn._labelTimer = setTimeout(() => {
        btn.textContent = `⇪ ${t('share')}`;
        btn.classList.remove('copied');
      }, SHARE_FEEDBACK_MS);
      showShareFeedback(btn, SHARE_OK(), true);
    } else {
      btn.textContent = `⇪ ${t('share')}`;
      btn.classList.remove('copied');
      showShareFeedback(btn, SHARE_FAIL(), false);
    }
  }

  function getFilteredItems() {
    const term = searchTerm.trim().toLowerCase();

    const baseItems = savedOnly
      ? Object.entries(savedMap).map(([link, saved]) => {
          const existing = allItems.find((item) => item.link === link);

          return existing || {
            link,
            title: saved.title || link,
            summary: '',
            whyItMatters: '',
            category: 'news',
            source: (() => {
              try { return new URL(link).hostname.replace(/^www\\./, ''); }
              catch (e) { return ''; }
            })(),
            published: saved.savedAt || '',
          };
        })
      : allItems;

    return baseItems.filter((i) => {
      if (isPromoItem(i)) return false;
      const matchesCat = matchesVertical(i, activeFilter);
      const matchesSource = activeSource === 'all' || i.source === activeSource;
      const matchesDate = withinDateFilter(i.published, activeDate);
      const matchesTerm = !term ||
        (i.title || '').toLowerCase().includes(term) ||
        (i.summary || '').toLowerCase().includes(term);
      const matchesHw = !hardwareOnly || isHardware(i);
      const matchesSaved = !savedOnly || !!savedMap[i.link];

      return matchesCat && matchesSource && matchesDate && matchesTerm && matchesHw && matchesSaved;
    });
  }

  // True when anything narrows the feed away from its default, unfiltered view.
  // The reset control is only offered in that case.
  function hasActiveFilters() {
    return activeFilter !== 'all' ||
      activeSource !== 'all' ||
      activeDate !== 'all' ||
      savedOnly ||
      hardwareOnly ||
      !!searchTerm.trim();
  }

  // One reset for every filter control: sidebar categories, the source and time
  // selects, the Hardware/Saved toggles and the search box, all back to their
  // initial state so the feed returns to exactly what it showed on load.
  function resetFilters() {
    activeFilter = 'all';
    activeSource = 'all';
    activeDate = 'all';
    hardwareOnly = false;
    savedOnly = false;
    searchTerm = '';
    visibleCount = PAGE_SIZE;
    clearTimeout(searchTimer);

    document.querySelectorAll('.toggle-hw').forEach((el) => el.setAttribute('aria-pressed', 'false'));
    document.querySelectorAll('.toggle-saved').forEach((el) => el.setAttribute('aria-pressed', 'false'));
    if (sourceFilterEl) sourceFilterEl.value = 'all';
    if (dateFilterEl) dateFilterEl.value = 'all';
    searchEl.value = '';
    syncSearchChrome();
    document.querySelectorAll('.filter[data-cat], .top-nav-item[data-cat]').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.cat === activeFilter ? 'true' : 'false');
    });

    render();
  }

  function paintErrorBanner(message) {
    if (!errorBannerEl) return;
    errorBannerEl.replaceChildren();
    const text = document.createElement('span');
    text.className = 'error-banner-text';
    text.textContent = message;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'retry-feed';
    button.id = 'retryFeed';
    button.textContent = t('retryFeed');
    button.addEventListener('click', () => refresh());
    errorBannerEl.append(text, button);
    errorBannerEl.classList.add('visible');
  }

  function clearErrorBanner() {
    if (!errorBannerEl) return;
    errorBannerEl.classList.remove('visible');
    errorBannerEl.replaceChildren();
  }

  function renderErrorBanner() {
    if (feedFailed && !allItems.length) {
      paintErrorBanner(t('errorFeed'));
      return;
    }
    if (fetchErrors.length) {
      paintErrorBanner(t('errorPartial', { sources: fetchErrors.join(', ') }));
      return;
    }
    clearErrorBanner();
  }

  function hideSkeletons() {
    document.querySelectorAll('.skeleton-grid').forEach((el) => {
      el.style.display = 'none';
    });
  }

  function showFeedFailure(serial) {
    if (serial !== refreshSerial) return;
    feedFailed = true;
    allItems = [];
    paintedSignature = '';
    hideSkeletons();
    if (statusEl) {
      statusEl.textContent = '';
      statusEl.hidden = true;
    }
    renderAll();
  }

  function placeNewsletterCard() {
    if (!newsletterCardEl || !feedEl) return;
    const top = feedEl.querySelector('.feed-top');
    if (top) top.insertAdjacentElement('afterend', newsletterCardEl);
    else feedEl.insertAdjacentElement('afterend', newsletterCardEl);
  }

  function render() {
    if (newsletterCardEl && feedEl.contains(newsletterCardEl)) newsletterCardEl.remove();
    const items = sortItems(getFilteredItems());
    visibleCount = Math.min(visibleCount, items.length || PAGE_SIZE);

    resultCountEl.textContent = t('resultCount', { n: items.length, m: allItems.length });

    renderErrorBanner();

    // The reset control only exists while something is actually narrowed down,
    // so the default, unfiltered view stays exactly what it was before.
    clearFiltersEl.hidden = !hasActiveFilters();

    // A failed load is not an empty filter result. Drop the skeleton and the
    // "loading feed…" line, and leave the retry banner as the status.
    if (feedFailed && !allItems.length) {
      feedEl.style.display = 'none';
      skeletonEl.style.display = 'none';
      loadMoreWrapEl.style.display = 'none';
      if (statusEl) {
        statusEl.textContent = '';
        statusEl.hidden = true;
      }
      placeNewsletterCard();
      return;
    }

    // No matching items: reuse the page's existing empty state instead of
    // leaving a blank grid. The message doubles as the answer to "did the app
    // work?" — there were simply no results for the current filters.
    if (!items.length) {
      feedEl.style.display = 'none';
      skeletonEl.style.display = 'none';
      loadMoreWrapEl.style.display = 'none';
      feedEl.innerHTML = `<div class="empty">${escapeHtml(t('empty'))}</div>`;
      feedEl.style.display = 'block';
      placeNewsletterCard();
      return;
    }

    // The feed is rendered from already-loaded data in one synchronous pass,
    // so the skeleton is only needed while a refetch is in flight (refresh()
    // turns it on at the start of every fetch). Flip both back here: the
    // skeleton off, the grid on — otherwise the placeholders stay on screen
    // and the freshly rendered cards never appear.
    skeletonEl.style.display = 'none';
    feedEl.style.display = 'grid';
    loadMoreWrapEl.style.display = 'none';

    // The large hero is the first story with a usable image URL. Earlier
    // stories stay in the feed behind it. If none have an image, the
    // first story stays the hero.
    const heroIndex = items.findIndex((item) => storyImageUrl(item));
    const ordered = heroIndex > 0
      ? [items[heroIndex], ...items.slice(0, heroIndex), ...items.slice(heroIndex + 1)]
      : items;
    const visible = ordered.slice(0, visibleCount);
    const lead = visible[0];
    const related = pickRelated(lead, visible.slice(1));
    const usedLinks = new Set([lead.link, ...related.map((item) => item.link)]);
    const pool = visible.slice(1).filter((item) => !usedLinks.has(item.link));
    const picks = pool.slice(0, 5);
    picks.forEach((item) => usedLinks.add(item.link));
    const featurePool = pool.filter((item) => !usedLinks.has(item.link));
    const silicon = [];
    const spaceItems = [];
    const rest = [];
    featurePool.forEach((item) => {
      if (silicon.length < 2 && matchesKeywords(item, VERTICALS.chips)) silicon.push(item);
      else if (spaceItems.length < 2 && matchesKeywords(item, VERTICALS.space)) spaceItems.push(item);
      else rest.push(item);
    });
    const inLower = new Set(silicon.concat(spaceItems, rest).map((item) => item.link));
    const tail = items.filter((item) => item && item.link && !usedLinks.has(item.link) && !inLower.has(item.link));
    let extraPlaced = 0;
    while (silicon.length + spaceItems.length + rest.length < 12 && tail.length) {
      const item = tail.shift();
      rest.push(item);
      inLower.add(item.link);
      extraPlaced += 1;
    }
    // A spotlight or feed section with one story leaves an empty track on
    // the right. Pull the next unused story so that card has a partner.
    const pullPartner = (list, donors) => {
      if (list.length !== 1) return;
      for (const donor of donors) {
        if (!donor.length) continue;
        list.push(donor.shift());
        return;
      }
    };
    pullPartner(silicon, [rest, tail]);
    pullPartner(spaceItems, [rest, tail]);
    pullPartner(rest, [tail]);
    silicon.concat(spaceItems, rest).forEach((item) => usedLinks.add(item.link));

    const storyFields = (item) => {
      const saved = !!savedMap[item.link];
      return {
        hw: isHardware(item),
        saved,
        note: saved ? (savedMap[item.link].note || '') : '',
        chips: buildCardChips(item),
      };
    };

    const leadFields = storyFields(lead);
    const hero = `
      <article class="card hero-story ${lead.category}${leadFields.hw ? ' is-hardware' : ''}">
        <a class="hero-media" href="${escapeAttr(lead.link)}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true">${cardImage(lead, 'hero', 640, 248)}</a>
        <div class="story-copy hero-copy">
          ${sourceLine(lead)}
          <h2><a href="${escapeAttr(lead.link)}" target="_blank" rel="noopener noreferrer" data-recent-title="${textAttr(lead.title)}">${textHtml(lead.title)}</a></h2>
          ${cardMeta(lead)}
          ${leadFields.chips.length ? `<div class="card-chips">${leadFields.chips.map((chip) => `<span class="chip chip-${chip.kind}">${escapeHtml(chip.text)}</span>`).join('')}</div>` : ''}
          ${lead.summary ? `<p class="hero-dek">${textHtml(lead.summary)}</p>` : ''}
          ${lead.whyItMatters ? `<div class="why"><b>${escapeHtml(t('whyItMatters'))}</b>${textHtml(lead.whyItMatters)}</div>` : ''}
          ${cardActions(lead, leadFields.saved, leadFields.note)}
        </div>
      </article>`;

    const followUps = related.map((item) => {
      const fields = storyFields(item);
      return `
      <article class="card follow-card ${item.category}${fields.hw ? ' is-hardware' : ''}">
        <div class="story-copy">
          ${sourceLine(item)}
          <h2><a href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer" data-recent-title="${textAttr(item.title)}">${textHtml(item.title)}</a></h2>
          ${cardMeta(item)}
          ${fields.chips.length ? `<div class="card-chips">${fields.chips.map((chip) => `<span class="chip chip-${chip.kind}">${escapeHtml(chip.text)}</span>`).join('')}</div>` : ''}
          ${cardActions(item, fields.saved, fields.note)}
        </div>
      </article>`;
    }).join('');

    const storyRow = (item) => {
      const fields = storyFields(item);
      return `
      <article class="card story-row ${item.category}${fields.hw ? ' is-hardware' : ''}">
        <div class="story-copy">
          ${sourceLine(item)}
          <h2><a href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer" data-recent-title="${textAttr(item.title)}">${textHtml(item.title)}</a></h2>
          ${cardMeta(item)}
          ${fields.chips.length ? `<div class="card-chips">${fields.chips.map((chip) => `<span class="chip chip-${chip.kind}">${escapeHtml(chip.text)}</span>`).join('')}</div>` : ''}
          ${item.summary ? `<p>${textHtml(item.summary)}</p>` : ''}
          ${cardActions(item, fields.saved, fields.note)}
        </div>
        ${storyThumb(item, 96, 96)}
      </article>`;
    };
    // The old span-2 lead is a pair of equal cards. Full rows of three follow.
    // A remainder of one or two stays a pair so a card is not left alone.
    const packSection = (items) => {
      const blocks = [];
      const queue = items.slice();
      if (!queue.length) return blocks;
      if (queue.length === 1) {
        blocks.push({ kind: 'pair', items: queue });
        return blocks;
      }
      blocks.push({ kind: 'pair', items: queue.splice(0, 2) });
      while (queue.length) {
        if (queue.length === 1) {
          const prev = blocks[blocks.length - 1];
          if (prev && prev.kind === 'pair' && prev.items.length === 2) {
            prev.kind = 'grid';
            prev.items.push(queue.shift());
          } else if (prev && prev.items.length > 2) {
            const moved = prev.items.pop();
            if (prev.kind === 'grid' && prev.items.length === 2) prev.kind = 'pair';
            blocks.push({ kind: 'pair', items: [moved, queue.shift()] });
          } else {
            blocks.push({ kind: 'pair', items: queue.splice(0, 1) });
          }
        } else if (queue.length === 2 || queue.length === 4) {
          blocks.push({ kind: 'pair', items: queue.splice(0, 2) });
        } else if (queue.length % 3 === 1) {
          blocks.push({ kind: 'grid', items: queue.splice(0, queue.length - 4) });
        } else {
          const remainder = queue.length % 3;
          blocks.push({ kind: 'grid', items: queue.splice(0, queue.length - remainder) });
        }
      }
      return blocks;
    };
    const lowerSection = (title, sectionItems, extraClass) => {
      if (!sectionItems.length) return '';
      const grids = packSection(sectionItems).map((block) => {
        const colClass = block.kind === 'pair' ? 'pair-row' : 'cols-3';
        return `<div class="lower-grid ${colClass}">${block.items.map(storyRow).join('')}</div>`;
      }).join('');
      const sectionClass = extraClass ? `lower-section ${extraClass}` : 'lower-section';
      return `<section class="${sectionClass}"><h2 class="feed-column-title">${escapeHtml(title)}</h2>${grids}</section>`;
    };
    const storySections = [
      lowerSection(t('silicon'), silicon),
      lowerSection(t('deepSpace'), spaceItems),
      lowerSection(t('moreStories'), rest, 'more-stories'),
    ].filter(Boolean);
    const inFeedAd = `
      <aside class="in-feed-ad" aria-label="${escapeAttr(t('sponsored'))}">
        <span class="ad-label">${escapeHtml(t('sponsored'))}</span>
        <ins class="adsbygoogle" style="display:block" data-ad-format="fluid" data-ad-layout-key="placeholder" data-ad-client="ca-pub-xxxxxxxxxxxxxxxx" data-ad-slot="0000000000"></ins>
      </aside>`;
    const lowerParts = storySections.length
      ? [storySections[0], inFeedAd, ...storySections.slice(1)]
      : [inFeedAd];
    const lower = lowerParts.join('');
    const sponsorSlot = `
      <section class="sponsor-slot" aria-label="${escapeAttr(t('featuredSponsor'))}">
        <div class="sponsor-slot-head">
          <h2 class="sponsor-title">${escapeHtml(t('featuredSponsor'))}</h2>
          <span class="ad-label">${escapeHtml(t('sponsored'))}</span>
        </div>
        <ins class="adsbygoogle" style="display:block" data-ad-format="auto" data-full-width-responsive="true" data-ad-client="ca-pub-xxxxxxxxxxxxxxxx" data-ad-slot="0000000001"></ins>
      </section>`;

    const pickCards = picks.map((item) => {
      const fields = storyFields(item);
      return `
      <article class="card pick-card ${item.category}${fields.hw ? ' is-hardware' : ''}">
        <div class="story-copy">
          ${sourceLine(item)}
          <h2><a href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer" data-recent-title="${textAttr(item.title)}">${textHtml(item.title)}</a></h2>
          ${cardMeta(item)}
          ${fields.chips.length ? `<div class="card-chips">${fields.chips.map((chip) => `<span class="chip chip-${chip.kind}">${escapeHtml(chip.text)}</span>`).join('')}</div>` : ''}
          ${cardActions(item, fields.saved, fields.note)}
        </div>
        ${pickThumb(item)}
      </article>`;
    }).join('');

    feedEl.innerHTML = `
      <div class="feed-top">
        <section class="briefing-col" aria-label="${escapeAttr(t('briefing'))}">
          <h2 class="feed-column-title">${escapeHtml(t('briefing'))}</h2>
          <div class="briefing-card">
            ${hero}
            ${followUps ? `<div class="follow-ups">${followUps}</div>` : ''}
          </div>
        </section>
        <aside class="picks-col" aria-label="${escapeAttr(t('picks'))}">${sponsorSlot}${pickCards ? `<h2 class="feed-column-title">${escapeHtml(t('picks'))}</h2><div class="picks-list">${pickCards}</div>` : ''}</aside>
      </div>
      ${lower ? `<div class="lower-feed">${lower}</div>` : ''}`;

    placeNewsletterCard();
    wireFeed(feedEl);
    paintCardImages(feedEl);
    balanceQueue = items.filter((item) => item && item.link && !usedLinks.has(item.link));
    balancedShown = extraPlaced;
    makeStoryRow = storyRow;
    balanceColumns();

    const remaining = Math.max(0, items.length - visibleCount - balancedShown);
    if (remaining > 0) {
      loadMoreWrapEl.style.display = 'block';
      loadMoreBtnEl.textContent = t('showMoreRemaining', { n: remaining });
    } else {
      loadMoreWrapEl.style.display = 'none';
    }
  }

  function renderAll() {
    renderLatest();
    render();
  }

  function wireFeed(root) {
    if (!root) return;
    root.querySelectorAll('.save-btn').forEach((btn) => {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => toggleSave(btn.dataset.link));
    });
    root.querySelectorAll('.share-btn').forEach((btn) => {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const item = allItems.find((i) => i.link === btn.dataset.link)
          || getFilteredItems().find((i) => i.link === btn.dataset.link);
        if (item) copyText(buildShareText(item), btn);
      });
    });
    root.querySelectorAll('.note-input').forEach((ta) => {
      if (ta.dataset.bound === '1') return;
      ta.dataset.bound = '1';
      ta.addEventListener('change', () => updateNote(ta.dataset.link, ta.value));
    });
  }

  // The 3-column sections stay full width. Extra story rows fill only the
  // hole beside Picks, and a card that would overshoot by more than the gap
  // is left for the next page instead of being kept.
  function balanceColumns() {
    const briefing = feedEl.querySelector('.briefing-col');
    const picks = feedEl.querySelector('.picks-col');
    if (!briefing || !picks) return 0;
    briefing.style.paddingBottom = '';
    picks.style.paddingBottom = '';
    if (window.matchMedia('(max-width: 800px)').matches) return 0;

    let fill = briefing.querySelector('.briefing-fill');
    const ensureFill = () => {
      if (fill && fill.isConnected) return fill;
      fill = document.createElement('div');
      fill.className = 'briefing-fill';
      const card = briefing.querySelector('.briefing-card');
      if (card) card.insertAdjacentElement('afterend', fill);
      else briefing.appendChild(fill);
      return fill;
    };

    let added = 0;
    let guard = 0;
    while (guard < 40 && balanceQueue.length) {
      guard += 1;
      const beforeBrief = briefing.getBoundingClientRect().height;
      const remaining = picks.getBoundingClientRect().height - beforeBrief;
      if (remaining <= 16) break;

      const item = balanceQueue.shift();
      const holder = document.createElement('div');
      holder.innerHTML = String(makeStoryRow(item) || '').trim();
      const card = holder.firstElementChild;
      if (!card) break;
      ensureFill().appendChild(card);
      wireFeed(card);

      const briefHeight = briefing.getBoundingClientRect().height;
      const overshoot = briefHeight - picks.getBoundingClientRect().height;
      if (briefHeight <= beforeBrief || overshoot > remaining) {
        card.remove();
        balanceQueue.unshift(item);
        break;
      }
      added += 1;
      balancedShown += 1;
    }
    if (fill && !fill.querySelector('.card')) fill.remove();

    const leftover = Math.round(picks.getBoundingClientRect().height - briefing.getBoundingClientRect().height);
    if (leftover > 1) briefing.style.paddingBottom = `${leftover}px`;
    else if (leftover < -1) picks.style.paddingBottom = `${-leftover}px`;

    const remaining = Math.max(0, getFilteredItems().length - visibleCount - balancedShown);
    if (loadMoreWrapEl && loadMoreBtnEl) {
      if (remaining > 0) {
        loadMoreWrapEl.style.display = 'block';
        loadMoreBtnEl.textContent = t('showMoreRemaining', { n: remaining });
      } else {
        loadMoreWrapEl.style.display = 'none';
      }
    }

    feedEl.querySelectorAll('img').forEach((img) => {
      if (img.dataset.balanceLoad === '1' || (img.complete && img.getAttribute('src'))) return;
      img.dataset.balanceLoad = '1';
      img.addEventListener('load', () => balanceColumns(), { once: true });
    });
    paintCardImages(feedEl);
    return added;
  }

  const regionSelectEl = document.getElementById('regionSelect');
  const languageSelectEl = document.getElementById('languageSelect');
  const LOCALE_REGION_KEY = 'region';
  const LOCALE_LANGUAGE_KEY = 'language';
  let refreshSerial = 0;
  let staticBuckets = null;
  let paintedSignature = '';
  const feedMemoryCache = new Map();

  function readFeedCache(region, language, allowStale) {
    if (!window.SignalFeedCache) return null;
    const options = allowStale ? { allowStale: true } : undefined;
    try {
      return window.SignalFeedCache.read(localStorage, feedMemoryCache, region, language, Date.now(), options);
    } catch (e) {
      try {
        return window.SignalFeedCache.read(null, feedMemoryCache, region, language, Date.now(), options);
      } catch (err) {
        return null;
      }
    }
  }

  function writeFeedCache(region, language, items) {
    if (!window.SignalFeedCache) return;
    try {
      window.SignalFeedCache.write(localStorage, feedMemoryCache, region, language, items);
    } catch (e) {
      window.SignalFeedCache.write(null, feedMemoryCache, region, language, items);
    }
  }

  function feedSignature(items) {
    return items.map((item) => `${item.category || ''}|${item.link || ''}|${item.title || ''}|${item.published || ''}`).join('\n');
  }

  function titleKey(item) {
    return decodeEntities((item && item.title) || '').trim().toLowerCase();
  }

  // Same decoded title from two sources (The Verge and The Verge Reviews)
  // counts once. The newest copy wins. Untitled items stay.
  function dedupeByTitle(items) {
    const ranked = items.slice().sort((a, b) => {
      const da = new Date(a.published || 0).getTime() || 0;
      const db = new Date(b.published || 0).getTime() || 0;
      return db - da;
    });
    const seen = new Set();
    const kept = [];
    ranked.forEach((item) => {
      const key = titleKey(item);
      if (key) {
        if (seen.has(key)) return;
        seen.add(key);
      }
      kept.push(item);
    });
    return kept;
  }

  function composeFeed(localized, buckets) {
    const news = mergeNews(localized, buckets.news);
    return dedupeByTitle([...news, ...buckets.papers, ...buckets.reviews, ...buckets.reddit]
      .filter((item) => !isPromoItem(item)));
  }

  function applyFeed(items, serial, savedAt) {
    if (serial !== refreshSerial) return;
    feedFailed = false;
    if (statusEl) statusEl.hidden = false;
    const signature = feedSignature(items);
    if (signature !== paintedSignature || feedEl.style.display !== 'grid') {
      allItems = dedupeByTitle(items);
      paintedSignature = signature;
      populateSources();
      renderAll();
      if (isSearchSuggestOpen() && searchEl && searchEl.value.trim()) renderSearchSuggest();
    } else {
      renderErrorBanner();
    }
    statusClock = new Date(savedAt || Date.now()).toLocaleTimeString('en-US');
    statusEl.textContent = `${t('updated')} ${statusClock}`;
  }

  function savedLocaleValue(key, select) {
    try {
      const saved = localStorage.getItem(key);
      if (saved && select && Array.from(select.options).some((option) => option.value === saved)) {
        return saved;
      }
    } catch (e) {}
    return select ? select.value : '';
  }

  function applySavedLocale() {
    if (regionSelectEl) regionSelectEl.value = savedLocaleValue(LOCALE_REGION_KEY, regionSelectEl);
    if (languageSelectEl) languageSelectEl.value = savedLocaleValue(LOCALE_LANGUAGE_KEY, languageSelectEl);
  }

  function persistLocale() {
    try {
      localStorage.setItem(LOCALE_REGION_KEY, regionSelectEl.value);
      localStorage.setItem(LOCALE_LANGUAGE_KEY, languageSelectEl.value);
    } catch (e) {}
  }

  function currentLocale() {
    return {
      region: regionSelectEl ? regionSelectEl.value : 'US',
      language: languageSelectEl ? languageSelectEl.value : 'en-US',
    };
  }

  function newsFeedEndpoint(region, language) {
    const query = `region=${encodeURIComponent(region)}&language=${encodeURIComponent(language)}`;
    const local = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const base = local ? location.origin : AUTH_BASE;
    return `${base}/api/news?${query}`;
  }

  // Live Google News locale (`/api/news` → https://news.google.com/rss?hl=&gl=&ceid=).
  // Both attempts share one 6 second budget. A timeout, a failed response,
  // invalid JSON, or a disconnected Cloudflare worker returns null. The feed
  // then stays on the static files in public/data/ (news.json, papers.json,
  // reviews.json, reddit.json). Digests never call the worker: digests.html
  // reads public/digests/*.json on its own.
  const LOCALE_FETCH_MS = 6000;

  async function loadLocalizedNews(region, language) {
    const deadline = Date.now() + LOCALE_FETCH_MS;
    let lastError = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      try {
        const res = await fetch(newsFeedEndpoint(region, language), {
          cache: 'no-store',
          signal: AbortSignal.timeout(remaining),
        });
        if (!res.ok) throw new Error(`google news ${res.status}`);
        let data;
        try {
          data = await res.json();
        } catch (parseErr) {
          throw new Error('google news invalid JSON');
        }
        if (!data || typeof data !== 'object' || !Array.isArray(data.items) || !data.items.length) {
          throw new Error('google news invalid JSON');
        }
        return data.items.map((item) => ({ ...item, category: 'news' }));
      } catch (err) {
        lastError = err;
      }
    }
    console.error('Localized news feed failed; using static JSON', lastError);
    return null;
  }

  async function loadStaticBuckets() {
    const [staticNews, papers, reviews, reddit] = await Promise.all([
      loadJSON('news.json', 'news', (i) => i),
      loadJSON('papers.json', 'papers', (i) => ({
        ...i,
        source: (i.authors || []).slice(0, 2).join(', ') + ((i.authors || []).length > 2 ? ` ${t('etAl')}` : ''),
      })),
      loadJSON('reviews.json', 'reviews', (i) => i),
      loadJSON('reddit.json', 'reddit', (i) => i),
    ]);
    return { news: staticNews, papers, reviews, reddit };
  }

  function mergeNews(localized, publisher) {
    if (!localized || !localized.length) return publisher;
    const seen = new Set(localized.map((item) => (item.title || '').toLowerCase().trim()).filter(Boolean));
    const rest = publisher.filter((item) => item.source !== 'Google News' && !seen.has((item.title || '').toLowerCase().trim()));
    return [...localized, ...rest];
  }

  async function loadJSON(file, category, mapFn) {
    try {
      const res = await fetch(`data/${file}?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
        signal: AbortSignal.timeout(LOCALE_FETCH_MS),
      });
      if (!res.ok) throw new Error(`${file}: ${res.status}`);
      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error(`${file}: invalid JSON`);
      }
      if (!data || typeof data !== 'object' || Array.isArray(data) || (data.items != null && !Array.isArray(data.items))) {
        throw new Error(`${file}: invalid JSON`);
      }
      return (data.items || []).map((raw) => ({ ...mapFn(raw), category }));
    } catch (err) {
      console.error('Failed to load', file, err);
      fetchErrors.push(file.replace('.json', ''));
      return [];
    }
  }

  async function refresh(options = {}) {
    // The first load uses the skeleton. Later polls stay quiet so a
    // 5-minute refresh does not blank the feed the reader is already on.
    // A region or language change paints a fresh cached edition immediately
    // and lets the Google News request finish behind that. Static JSON is
    // painted as soon as it arrives so a locale request cannot hold the
    // skeleton until its 6 second timeout. Expired localStorage items stay
    // available for the failure path below.
    const quiet = options.quiet === true;
    const serial = ++refreshSerial;
    const locale = currentLocale();
    const staleCached = readFeedCache(locale.region, locale.language, true);
    const cached = (staleCached && window.SignalFeedCache && (Date.now() - staleCached.savedAt < window.SignalFeedCache.TTL_MS))
      ? staleCached
      : null;
    fetchErrors = [];
    feedFailed = false;
    if (cached && staticBuckets) {
      applyFeed(composeFeed(cached.items, staticBuckets), serial, cached.savedAt);
    } else if (cached && cached.items && cached.items.length) {
      const immediate = dedupeByTitle(cached.items.filter((item) => !isPromoItem(item)));
      if (immediate.length) applyFeed(immediate, serial, cached.savedAt);
    } else if (!quiet) {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = t('loading');
      }
      clearErrorBanner();
      skeletonEl.style.display = 'grid';
      feedEl.style.display = 'none';
      loadMoreWrapEl.style.display = 'none';
    }
    let localeSettled = false;
    const localizedPromise = loadLocalizedNews(locale.region, locale.language).then((items) => {
      localeSettled = true;
      return items;
    });
    try {
      const nextBuckets = await loadStaticBuckets();
      if (serial !== refreshSerial) return;
      const staticNews = nextBuckets.news;
      const papers = nextBuckets.papers;
      const reviews = nextBuckets.reviews;
      const reddit = nextBuckets.reddit;
      const staticCount = staticNews.length + papers.length + reviews.length + reddit.length;
      if (staticCount > 0 || !staticBuckets) staticBuckets = nextBuckets;

      if (!localeSettled) {
        const interimNews = cached ? cached.items : null;
        const interim = composeFeed(interimNews, staticBuckets);
        if (interim.length) applyFeed(interim, serial, cached ? cached.savedAt : Date.now());
      }

      const localized = await localizedPromise;
      if (localized) writeFeedCache(locale.region, locale.language, localized);
      if (serial !== refreshSerial) return;

      const newsItems = localized || (staleCached ? staleCached.items : null);
      if (!newsItems && (locale.region !== 'US' || locale.language !== 'en-US')) {
        fetchErrors.push('google-news');
      }
      const items = composeFeed(newsItems, staticBuckets);
      if (!items.length) {
        if (allItems.length) {
          renderErrorBanner();
          hideSkeletons();
          if (statusEl) {
            statusEl.hidden = !statusClock;
            statusEl.textContent = statusClock ? `${t('updated')} ${statusClock}` : '';
          }
          return;
        }
        showFeedFailure(serial);
        return;
      }
      applyFeed(
        items,
        serial,
        localized ? Date.now() : (staleCached ? staleCached.savedAt : Date.now())
      );
    } catch (err) {
      console.error('Feed refresh failed', err);
      if (serial !== refreshSerial) return;
      try {
        if (!staticBuckets) {
          const recovered = await loadStaticBuckets();
          if (serial !== refreshSerial) return;
          const recoveredCount = recovered.news.length + recovered.papers.length + recovered.reviews.length + recovered.reddit.length;
          if (recoveredCount) staticBuckets = recovered;
        }
        const fallbackItems = staticBuckets
          ? composeFeed(staleCached ? staleCached.items : null, staticBuckets)
          : dedupeByTitle((staleCached && staleCached.items) || []);
        if (fallbackItems.length) {
          applyFeed(fallbackItems, serial, staleCached ? staleCached.savedAt : Date.now());
          return;
        }
      } catch (fallbackErr) {
        console.error('Stale feed cache could not be shown', fallbackErr);
      }
      if (!allItems.length) showFeedFailure(serial);
    } finally {
      if (serial === refreshSerial) hideSkeletons();
    }
  }

  // --- Event listeners ---
  // Listen for filter clicks on both the mobile drawer (#filters) and the
  // desktop horizontal nav (.top-nav).
  function handleFilterClick(e) {
    const btn = e.target.closest('.filter[data-cat], .top-nav-item[data-cat]');
    if (!btn) return;
    const container = btn.classList.contains('filter') ? filtersEl : document.getElementById('topNav');
    container.querySelectorAll('.filter[data-cat], .top-nav-item[data-cat]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
    btn.setAttribute('aria-pressed', 'true');
    activeFilter = btn.dataset.cat;
    visibleCount = PAGE_SIZE;
    syncCategoryPressed();
    render();
    if (document.body.classList.contains('sidebar-open')) setSidebarOpen(false);
  }
  filtersEl.addEventListener('click', handleFilterClick);
  const topNavEl = document.getElementById('topNav');
  if (topNavEl && !filtersEl.contains(topNavEl)) topNavEl.addEventListener('click', handleFilterClick);

  // --- Sidebar drawer (mobile navigation) ---
  const menuToggleEl = document.getElementById('menuToggle');
  const sidebarBackdropEl = document.getElementById('sidebarBackdrop');
  const sidebarCloseEl = document.getElementById('sidebarClose');
  // The search bar lives in the masthead, so it is listed alongside the
  // toolbar row: everything the drawer covers must stop taking input.
  const sidebarBehindTargets = Array.from(document.querySelectorAll('.controls > .row2, .mast .search-row, .locale-controls, #topicBar .search-row, main, footer'));
  let sidebarInertSnapshot = null;

  function setSidebarOpen(open) {
    document.body.classList.toggle('sidebar-open', open);
    if (menuToggleEl) menuToggleEl.setAttribute('aria-expanded', open ? 'true' : 'false');

    // Keep the page behind the drawer from receiving pointer or keyboard input.
    if (open) {
      if (!sidebarInertSnapshot) {
        sidebarInertSnapshot = sidebarBehindTargets.map((el) => [el, el.inert]);
        sidebarBehindTargets.forEach((el) => { el.inert = true; });
      }
    } else if (sidebarInertSnapshot) {
      sidebarInertSnapshot.forEach(([el, wasInert]) => { el.inert = wasInert; });
      sidebarInertSnapshot = null;
      if (menuToggleEl && filtersEl.contains(document.activeElement)) menuToggleEl.focus();
    }
  }

  if (menuToggleEl) {
    menuToggleEl.addEventListener('click', () => {
      setSidebarOpen(!document.body.classList.contains('sidebar-open'));
    });
  }
  [sidebarBackdropEl, sidebarCloseEl].forEach((el) => {
    if (el) el.addEventListener('click', () => setSidebarOpen(false));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isSearchSuggestOpen()) {
      e.preventDefault();
      closeSearchSuggest();
      if (document.body.classList.contains('search-open')) {
        setSearchOpen(false);
        if (searchToggleEl) searchToggleEl.focus();
      } else if (searchEl) {
        searchEl.blur();
      }
      return;
    }
    if (document.body.classList.contains('search-open')) {
      setSearchOpen(false);
      if (searchToggleEl) searchToggleEl.focus();
      return;
    }
    if (document.querySelector('.locale-menu:not([hidden])')) {
      closeLocaleMenus(true);
      return;
    }
    if (document.body.classList.contains('sidebar-open')) {
      setSidebarOpen(false);
      if (menuToggleEl) menuToggleEl.focus();
    }
  });

  // Touch: swipe left across the drawer to dismiss it, so the feed behind is
  // one gesture away — no precise tap on the backdrop or the close icon needed.
  // Vertical drags keep their default meaning (scrolling the drawer itself).
  let swipeStart = null;
  filtersEl.addEventListener('touchstart', (e) => {
    swipeStart = null;
    if (!document.body.classList.contains('sidebar-open') || e.touches.length !== 1) return;
    swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: true });
  filtersEl.addEventListener('touchend', (e) => {
    if (!swipeStart) return;
    const end = e.changedTouches[0];
    const dx = end.clientX - swipeStart.x;
    const dy = end.clientY - swipeStart.y;
    swipeStart = null;
    if (dx <= -50 && Math.abs(dy) <= Math.abs(dx)) setSidebarOpen(false);
  }, { passive: true });
  filtersEl.addEventListener('touchcancel', () => { swipeStart = null; }, { passive: true });
  document.addEventListener('click', (e) => {
    const hw = e.target.closest('.toggle-hw');
    const saved = e.target.closest('.toggle-saved');
    if (!hw && !saved) return;
    if (hw) {
      hardwareOnly = !hardwareOnly;
      document.querySelectorAll('.toggle-hw').forEach((el) => el.setAttribute('aria-pressed', String(hardwareOnly)));
    } else {
      savedOnly = !savedOnly;
      document.querySelectorAll('.toggle-saved').forEach((el) => el.setAttribute('aria-pressed', String(savedOnly)));
    }
    visibleCount = PAGE_SIZE;
    render();
    if (document.body.classList.contains('sidebar-open')) setSidebarOpen(false);
  });
  function onLocaleChange() {
    persistLocale();
    visibleCount = PAGE_SIZE;
    applyI18n();
    refresh();
  }
  if (regionSelectEl) regionSelectEl.addEventListener('change', onLocaleChange);
  if (languageSelectEl) languageSelectEl.addEventListener('change', onLocaleChange);

  const LANG_BADGE = {
    'en-US': 'EN',
    'es-419': 'ES',
    fr: 'FR',
    de: 'DE',
    ja: 'JA',
    'pt-BR': 'PT',
    hi: 'HI',
    ko: 'KO',
    'zh-CN': 'ZH',
    it: 'IT',
    nl: 'NL',
  };

  function localeBadge(select) {
    if (!select) return '';
    if (select.id === 'languageSelect') return LANG_BADGE[select.value] || String(select.value).slice(0, 2).toUpperCase();
    return select.value || '';
  }

  function closeLocaleMenus(restoreFocus) {
    document.querySelectorAll('.locale-menu').forEach((menu) => {
      menu.hidden = true;
    });
    document.querySelectorAll('.locale-trigger').forEach((btn) => {
      const wasOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', 'false');
      if (restoreFocus && wasOpen) btn.focus();
    });
  }

  function placeLocaleMenu(trigger, menu) {
    const rect = trigger.getBoundingClientRect();
    menu.hidden = false;
    const menuHeight = Math.min(menu.scrollHeight, Math.round(window.innerHeight * 0.6));
    let top = rect.bottom + 6;
    if (top + menuHeight > window.innerHeight - 8) top = Math.max(8, rect.top - menuHeight - 6);
    menu.style.top = `${Math.round(top)}px`;
    menu.style.right = `${Math.max(8, Math.round(window.innerWidth - rect.right))}px`;
    menu.style.left = 'auto';
  }

  function renderLocaleMenu(select, menu) {
    const current = select.value;
    menu.replaceChildren();
    Array.from(select.options).forEach((opt) => {
      const selected = opt.value === current;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = selected ? 'locale-option is-selected' : 'locale-option';
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
      item.dataset.value = opt.value;
      const label = document.createElement('span');
      label.className = 'locale-option-label';
      label.textContent = opt.textContent;
      const mark = document.createElement('span');
      mark.className = 'locale-check';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = selected ? '✓' : '';
      item.append(label, mark);
      item.addEventListener('click', () => {
        closeLocaleMenus(false);
        if (select.value !== opt.value) {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          syncLocaleMenus();
        }
      });
      menu.appendChild(item);
    });
  }

  function syncLocaleMenus() {
    [
      ['regionSelect', 'regionMenu', 'regionBadge', 'regionTrigger'],
      ['languageSelect', 'languageMenu', 'languageBadge', 'languageTrigger'],
    ].forEach(([selectId, menuId, badgeId, triggerId]) => {
      const select = document.getElementById(selectId);
      const menu = document.getElementById(menuId);
      const badge = document.getElementById(badgeId);
      const trigger = document.getElementById(triggerId);
      if (!select || !menu || !trigger) return;
      if (badge) badge.textContent = localeBadge(select);
      trigger.classList.add('is-set');
      const label = select.getAttribute('aria-label') || '';
      if (label) {
        trigger.setAttribute('aria-label', label);
        trigger.setAttribute('title', select.getAttribute('title') || label);
      }
      const open = trigger.getAttribute('aria-expanded') === 'true';
      renderLocaleMenu(select, menu);
      menu.hidden = !open;
    });
  }

  function bindLocaleMenus() {
    document.querySelectorAll('.locale-trigger').forEach((trigger) => {
      const menu = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!menu) return;
      trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const willOpen = menu.hidden;
        closeLocaleMenus(false);
        if (!willOpen) return;
        trigger.setAttribute('aria-expanded', 'true');
        placeLocaleMenu(trigger, menu);
        const selected = menu.querySelector('.is-selected');
        if (selected) selected.focus();
      });
      menu.addEventListener('keydown', (e) => {
        const items = Array.from(menu.querySelectorAll('.locale-option'));
        const index = items.indexOf(document.activeElement);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const next = e.key === 'ArrowDown' ? Math.min(items.length - 1, index + 1) : Math.max(0, index - 1);
          const target = items[index === -1 ? 0 : next];
          if (target) target.focus();
        }
      });
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.locale-field')) closeLocaleMenus(false);
    });
    window.addEventListener('resize', () => {
      document.querySelectorAll('.locale-trigger[aria-expanded="true"]').forEach((trigger) => {
        const menu = document.getElementById(trigger.getAttribute('aria-controls'));
        if (menu && !menu.hidden) placeLocaleMenu(trigger, menu);
      });
    });
  }

  function parkSearchRow() {
    if (!searchRowEl || !searchAnchorEl) return;
    if (searchRowEl.parentElement !== searchAnchorEl.parentElement) {
      searchAnchorEl.parentElement.insertBefore(searchRowEl, searchAnchorEl);
    }
  }

  function setSearchOpen(open) {
    const narrow = window.matchMedia('(max-width: 767px)').matches;
    const show = Boolean(open) && narrow;
    document.body.classList.toggle('search-open', show);
    if (searchToggleEl) searchToggleEl.setAttribute('aria-expanded', show ? 'true' : 'false');
    if (searchOverlayEl) searchOverlayEl.hidden = !show;
    if (show && searchOverlayBarEl && searchRowEl) {
      searchOverlayBarEl.appendChild(searchRowEl);
      searchEl.focus();
    } else {
      parkSearchRow();
      closeSearchSuggest();
    }
  }

  function bindMobileSearch() {
    if (searchToggleEl) {
      searchToggleEl.addEventListener('click', () => {
        setSearchOpen(!document.body.classList.contains('search-open'));
      });
    }
    if (searchOverlayEl) {
      searchOverlayEl.addEventListener('click', (e) => {
        if (e.target === searchOverlayEl) setSearchOpen(false);
      });
    }
    const narrowQuery = window.matchMedia('(max-width: 767px)');
    const onNarrowChange = () => {
      if (!narrowQuery.matches) setSearchOpen(false);
    };
    if (narrowQuery.addEventListener) narrowQuery.addEventListener('change', onNarrowChange);
    else if (narrowQuery.addListener) narrowQuery.addListener(onNarrowChange);
  }

  bindLocaleMenus();
  bindMobileSearch();
  if (sourceFilterEl) sourceFilterEl.addEventListener('change', (e) => { activeSource = e.target.value; visibleCount = PAGE_SIZE; render(); });
  if (dateFilterEl) dateFilterEl.addEventListener('change', (e) => { activeDate = e.target.value; visibleCount = PAGE_SIZE; render(); });
  clearFiltersEl.addEventListener('click', () => {
    resetFilters();
    // Keep focus somewhere useful: the source/time selects are hidden state
    // holders now, so park focus on the search field instead of an
    // invisible control. On a phone the field lives in the overlay.
    if (window.matchMedia('(max-width: 767px)').matches) setSearchOpen(true);
    else searchEl.focus();
  });

  function readRecentSearches() {
    try {
      const parsed = JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.map((item) => String(item || '').trim()).filter(Boolean).slice(0, 5);
    } catch (e) {
      return [];
    }
  }

  function writeRecentSearches(list) {
    try {
      localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(list.slice(0, 5)));
    } catch (e) { /* storage can be blocked */ }
  }

  function rememberSearch(term) {
    const value = String(term || '').trim();
    if (!value) return;
    const next = [value, ...readRecentSearches().filter((item) => item.toLowerCase() !== value.toLowerCase())];
    writeRecentSearches(next);
  }

  function syncSearchChrome() {
    const hasValue = !!(searchEl && searchEl.value);
    if (searchRowEl) searchRowEl.classList.toggle('has-value', hasValue);
    if (searchClearEl) searchClearEl.hidden = !hasValue;
    if (searchHintEl) searchHintEl.style.removeProperty('display');
  }

  function isSearchSuggestOpen() {
    return !!(searchRowEl && searchRowEl.classList.contains('is-open') && searchSuggestEl && !searchSuggestEl.hidden);
  }

  function suggestOptions() {
    if (!searchSuggestEl) return [];
    return Array.from(searchSuggestEl.querySelectorAll('[role="option"]'));
  }

  function setSearchSuggestIndex(index) {
    const options = suggestOptions();
    if (!options.length) index = -1;
    else if (index < 0) index = 0;
    else if (index >= options.length) index = options.length - 1;
    searchSuggestIndex = index;
    options.forEach((el, i) => {
      const on = i === index;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (index >= 0 && options[index]) {
      searchEl.setAttribute('aria-activedescendant', options[index].id);
      options[index].scrollIntoView({ block: 'nearest' });
    } else {
      searchEl.removeAttribute('aria-activedescendant');
    }
  }

  function closeSearchSuggest() {
    if (!searchSuggestEl || !searchRowEl) return;
    searchRowEl.classList.remove('is-open');
    searchSuggestEl.hidden = true;
    searchSuggestEl.replaceChildren();
    searchSuggestIndex = -1;
    if (searchEl) {
      searchEl.setAttribute('aria-expanded', 'false');
      searchEl.removeAttribute('aria-activedescendant');
    }
    syncSearchChrome();
  }

  function openSearchSuggest() {
    if (!searchSuggestEl || !searchRowEl || !searchEl) return;
    searchRowEl.classList.add('is-open');
    searchSuggestEl.hidden = false;
    searchEl.setAttribute('aria-expanded', 'true');
    renderSearchSuggest();
    syncSearchChrome();
  }

  function highlightQuery(text, query) {
    const decoded = decodeEntities(text || '');
    const words = String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
    if (!words.length) return escapeHtml(decoded);
    const pattern = new RegExp(words.map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
    let html = '';
    let last = 0;
    decoded.replace(pattern, (match, offset) => {
      html += escapeHtml(decoded.slice(last, offset));
      html += `<mark>${escapeHtml(match)}</mark>`;
      last = offset + match.length;
      return match;
    });
    html += escapeHtml(decoded.slice(last));
    return html;
  }

  function appendSuggestLabel(text) {
    const label = document.createElement('div');
    label.className = 'search-suggest-label';
    label.setAttribute('role', 'presentation');
    label.textContent = text;
    searchSuggestEl.appendChild(label);
  }

  function prepareOption(el, index) {
    el.id = `search-opt-${index}`;
    el.setAttribute('role', 'option');
    el.setAttribute('aria-selected', 'false');
    return el;
  }

  function renderEmptySuggest() {
    const recents = readRecentSearches();
    let index = 0;
    if (recents.length) {
      const head = document.createElement('div');
      head.className = 'search-suggest-head';
      head.setAttribute('role', 'presentation');
      const label = document.createElement('span');
      label.textContent = 'Recent searches';
      head.appendChild(label);
      searchSuggestEl.appendChild(head);
      recents.forEach((value) => {
        const row = document.createElement('div');
        row.className = 'search-option search-recent';
        row.dataset.kind = 'recent';
        row.dataset.value = value;
        const text = document.createElement('span');
        text.className = 'search-recent-text';
        text.textContent = value;
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'search-recent-remove';
        remove.tabIndex = -1;
        remove.dataset.removeRecent = value;
        remove.setAttribute('aria-label', `Remove ${value}`);
        remove.textContent = '×';
        row.append(text, remove);
        prepareOption(row, index);
        index += 1;
        searchSuggestEl.appendChild(row);
      });
      const clearAll = document.createElement('button');
      clearAll.type = 'button';
      clearAll.className = 'search-option search-clear-all';
      clearAll.dataset.kind = 'clear-all';
      clearAll.textContent = 'Clear all';
      prepareOption(clearAll, index);
      index += 1;
      searchSuggestEl.appendChild(clearAll);
    }
    appendSuggestLabel('Suggested topics');
    const chips = document.createElement('div');
    chips.className = 'search-chips';
    chips.setAttribute('role', 'presentation');
    SEARCH_TOPICS.forEach(([cat, key]) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'search-option search-chip';
      chip.dataset.kind = 'topic';
      chip.dataset.cat = cat;
      chip.textContent = t(key);
      prepareOption(chip, index);
      index += 1;
      chips.appendChild(chip);
    });
    searchSuggestEl.appendChild(chips);
  }

  function renderMatchSuggest(query) {
    const needle = query.toLowerCase();
    const matches = dedupeByTitle(allItems.filter((item) => {
      if (!item || isPromoItem(item)) return false;
      const title = decodeEntities(item.title || '').toLowerCase();
      const summary = decodeEntities(item.summary || '').toLowerCase();
      return title.includes(needle) || summary.includes(needle);
    })).slice(0, 6);
    if (!matches.length) {
      const empty = document.createElement('p');
      empty.className = 'search-suggest-empty';
      empty.textContent = 'No matching headlines';
      searchSuggestEl.appendChild(empty);
      return;
    }
    matches.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'search-option search-hit';
      row.dataset.kind = 'headline';
      row.dataset.link = item.link || '';
      const title = document.createElement('span');
      title.className = 'search-hit-title';
      title.innerHTML = highlightQuery(item.title || '', query);
      row.appendChild(title);
      const titleHas = decodeEntities(item.title || '').toLowerCase().includes(needle);
      if (!titleHas && item.summary) {
        const snippet = document.createElement('span');
        snippet.className = 'search-hit-snippet';
        snippet.innerHTML = highlightQuery(item.summary, query);
        row.appendChild(snippet);
      }
      const source = decodeEntities(item.source || '');
      const when = timeAgo(item.published);
      const meta = [source, when].filter(Boolean).join(' · ');
      if (meta) {
        const line = document.createElement('span');
        line.className = 'search-hit-meta';
        line.textContent = meta;
        row.appendChild(line);
      }
      prepareOption(row, index);
      searchSuggestEl.appendChild(row);
    });
  }

  function renderSearchSuggest() {
    if (!searchSuggestEl || searchSuggestEl.hidden) return;
    searchSuggestEl.replaceChildren();
    searchSuggestIndex = -1;
    if (searchEl) searchEl.removeAttribute('aria-activedescendant');
    const query = searchEl.value.trim();
    if (!query) renderEmptySuggest();
    else renderMatchSuggest(query);
  }

  function commitSearch() {
    searchTerm = searchEl.value;
    clearTimeout(searchTimer);
    visibleCount = PAGE_SIZE;
    render();
    rememberSearch(searchTerm);
    closeSearchSuggest();
  }

  function applySuggestTopic(cat) {
    activeFilter = cat;
    visibleCount = PAGE_SIZE;
    syncCategoryPressed();
    render();
    closeSearchSuggest();
    searchEl.blur();
    if (document.body.classList.contains('sidebar-open')) setSidebarOpen(false);
  }

  function activateSuggestOption(el) {
    if (!el) return;
    const kind = el.dataset.kind;
    if (kind === 'clear-all') {
      writeRecentSearches([]);
      renderSearchSuggest();
      return;
    }
    if (kind === 'recent') {
      const value = el.dataset.value || '';
      searchEl.value = value;
      searchTerm = value;
      rememberSearch(value);
      clearTimeout(searchTimer);
      visibleCount = PAGE_SIZE;
      syncSearchChrome();
      render();
      closeSearchSuggest();
      return;
    }
    if (kind === 'topic') {
      applySuggestTopic(el.dataset.cat);
      return;
    }
    if (kind === 'headline' && el.dataset.link) {
      rememberSearch(searchEl.value);
      closeSearchSuggest();
      window.open(el.dataset.link, '_blank', 'noopener');
    }
  }

  function bindSearchSuggest() {
    if (!searchEl || !searchRowEl || !searchSuggestEl) return;
    searchRowEl.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.search-suggest, .search-clear')) return;
      searchRowEl.classList.add('search-pointer');
      openSearchSuggest();
    });
    searchSuggestEl.addEventListener('mousedown', (e) => {
      e.preventDefault();
    });
    searchSuggestEl.addEventListener('click', (e) => {
      const remove = e.target.closest('[data-remove-recent]');
      if (remove) {
        const value = remove.dataset.removeRecent;
        writeRecentSearches(readRecentSearches().filter((item) => item !== value));
        renderSearchSuggest();
        return;
      }
      const option = e.target.closest('[role="option"]');
      if (option) activateSuggestOption(option);
    });
    if (searchClearEl) {
      searchClearEl.addEventListener('mousedown', (e) => e.preventDefault());
      searchClearEl.addEventListener('click', () => {
        searchEl.value = '';
        searchTerm = '';
        clearTimeout(searchTimer);
        visibleCount = PAGE_SIZE;
        render();
        syncSearchChrome();
        if (document.activeElement === searchEl) openSearchSuggest();
        else searchEl.focus();
      });
    }
    document.addEventListener('mousedown', (e) => {
      if (!searchRowEl.contains(e.target)) closeSearchSuggest();
    });
  }

  // Debounced search. The feed waits 150ms; the suggestion list updates immediately.
  searchEl.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    syncSearchChrome();
    if (document.activeElement === searchEl) openSearchSuggest();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { visibleCount = PAGE_SIZE; render(); }, SEARCH_DEBOUNCE_MS);
  });

  // Keyboard shortcut: "/" to focus search — but never while the user is typing
  // into a field or an editable surface, where "/" is real content.
  document.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (document.activeElement === searchEl) return;

    const target = e.target;
    const editable = target && (target.isContentEditable ||
      (target.closest && target.closest('[contenteditable]:not([contenteditable="false"])')));
    if (editable) return;
    if (target && target.matches && target.matches('input, textarea, select')) return;

    e.preventDefault();
    if (window.matchMedia('(max-width: 767px)').matches) setSearchOpen(true);
    else searchEl.focus();
  });
  searchEl.addEventListener('focus', () => {
    syncSearchChrome();
    openSearchSuggest();
  });
  searchEl.addEventListener('blur', () => {
    if (searchRowEl) searchRowEl.classList.remove('search-pointer');
    syncSearchChrome();
    setTimeout(() => {
      if (searchRowEl && !searchRowEl.contains(document.activeElement)) closeSearchSuggest();
    }, 0);
  });
  searchEl.addEventListener('keydown', (e) => {
    if (searchRowEl && e.key === 'Tab') {
      searchRowEl.classList.remove('search-pointer');
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!isSearchSuggestOpen()) return;
      const options = suggestOptions();
      if (!options.length) return;
      // Arrowing through results keeps the white elevated bar. The highlighted
      // row is the indicator, so the keyboard ring stays off.
      if (searchRowEl) searchRowEl.classList.add('search-pointer');
      e.preventDefault();
      if (searchSuggestIndex < 0) setSearchSuggestIndex(e.key === 'ArrowDown' ? 0 : options.length - 1);
      else setSearchSuggestIndex(e.key === 'ArrowDown' ? searchSuggestIndex + 1 : searchSuggestIndex - 1);
      return;
    }
    if (e.key !== 'Enter') return;
    const options = suggestOptions();
    const current = searchSuggestIndex >= 0 ? options[searchSuggestIndex] : null;
    if (current) {
      e.preventDefault();
      activateSuggestOption(current);
      return;
    }
    e.preventDefault();
    commitSearch();
  });
  bindSearchSuggest();

  // Load more button
  loadMoreBtnEl.addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    render();
  });

  const HASH_FILTERS = {
    technology: 'news',
    news: 'news',
    ai: 'papers',
    papers: 'papers',
    reviews: 'reviews',
    community: 'reddit',
    reddit: 'reddit',
    software: 'software',
    chips: 'chips',
    gaming: 'gaming',
    space: 'space',
    security: 'security',
    gadgets: 'gadgets',
  };

  function syncCategoryPressed() {
    document.querySelectorAll('.filter[data-cat], .top-nav-item[data-cat]').forEach((b) => {
      b.setAttribute('aria-pressed', b.dataset.cat === activeFilter ? 'true' : 'false');
    });
    document.querySelectorAll('.toggle-hw').forEach((el) => el.setAttribute('aria-pressed', String(hardwareOnly)));
    document.querySelectorAll('.toggle-saved').forEach((el) => el.setAttribute('aria-pressed', String(savedOnly)));
  }

  function applyHash(renderNow) {
    const hash = (location.hash || '').replace(/^#/, '').toLowerCase();
    if (!hash) return;
    if (hash === 'all' || hash === 'home') {
      activeFilter = 'all';
      hardwareOnly = false;
      savedOnly = false;
    } else if (HASH_FILTERS[hash]) {
      activeFilter = HASH_FILTERS[hash];
    }
    if (hash === 'hardware') hardwareOnly = true;
    if (hash === 'saved') savedOnly = true;
    visibleCount = PAGE_SIZE;
    syncCategoryPressed();
    if (renderNow) render();
    if (hash === 'settings') document.getElementById('syncSettingsBtn')?.focus();
  }

  setInterval(renderAll, 60 * 1000);
  setInterval(() => refresh({ quiet: true }), AUTO_REFRESH_MS);

  applyHash(false);
  applySavedLocale();
  applyI18n();
  refresh();
  window.addEventListener('hashchange', () => applyHash(true));
  window.addEventListener('scroll', function () {
  if (window.scrollY > 80) {
    document.body.classList.add('search-scrolled');
  } else {
    document.body.classList.remove('search-scrolled');
  }
});

(function () {
  var KEY = 'signal_tech_cookie_consent';
  var banner = document.getElementById('cookieBanner');
  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }
  function write(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
  }
  function hide() { if (banner) banner.hidden = true; }
  var choice = read();
  if (choice === 'all' || choice === 'essential') { hide(); return; }
  if (banner) banner.hidden = false;
  var accept = document.getElementById('cookieAccept');
  var essential = document.getElementById('cookieEssential');
  if (accept) accept.addEventListener('click', function () {
    write('all');
    if (window.loadSignalAnalytics) window.loadSignalAnalytics();
    hide();
  });
  if (essential) essential.addEventListener('click', function () {
    write('essential');
    hide();
  });
})();
