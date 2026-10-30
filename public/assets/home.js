
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
    // Language apply rewrites every data-i18n-aria name, including the theme
    // toggle. Put the "Switch to … theme" name back, and rebuild the source
    // and date lists so a locale change cannot leave another control's options behind.
    if (document.getElementById('themeToggle')) {
      setThemeIcon(document.documentElement.getAttribute('data-theme') || 'dark');
    }
    lockDateFilter();
    populateSources();
    syncFilterChrome();
    syncLocaleMenus();
    if (searchRowEl && searchRowEl.classList.contains('is-open')) renderSearchSuggest();
    if (signalIssue) renderSignalIssue();
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
  const BOOKMARK_SVG = '<svg class="save-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false"><path d="M6 3h12v18l-6-4-6 4z" fill="FILL" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

  const VERTICALS = {
    software: ['software', 'developer', 'programming', 'github', 'linux', 'windows', 'open source', 'open-source', 'javascript', 'python'],
    chips: ['chip', 'chips', 'silicon', 'semiconductor', 'nvidia', 'amd', 'intel', 'tsmc', 'gpu', 'cpu', 'qualcomm', 'wafer'],
    gaming: ['game', 'games', 'gaming', 'console', 'playstation', 'xbox', 'nintendo', 'steam', 'esports'],
    space: ['spacex', 'nasa', 'rocket', 'rockets', 'satellite', 'orbit', 'lunar', 'astronaut', 'apollo'],
    security: ['security', 'cybersecurity', 'ransomware', 'vulnerability', 'malware', 'breach', 'encrypt', 'encryption'],
    gadgets: ['laptop', 'smartphone', 'iphone', 'android', 'tablet', 'macbook', 'ipad', 'headphone', 'wearable', 'gadget'],
    ai: ['ai', 'a.i.', 'artificial intelligence', 'machine learning', 'deep learning', 'neural network', 'llm', 'llms', 'large language model', 'language model', 'generative', 'genai', 'chatbot', 'chatgpt', 'gpt', 'openai', 'anthropic', 'claude', 'gemini', 'copilot', 'grok', 'xai', 'deepseek', 'mistral', 'llama', 'perplexity', 'hugging face', 'agentic', 'ai agent', 'ai agents', 'ai model', 'ai models', 'ai chip', 'ai chips'],
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
  let signalIssue = null;
  let signalIssues = [];
  let signalIndex = 0;
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
// On signaltechnews.com the worker is routed on the site's own origin
// (/api/*, /auth/*). Anywhere else (the old GitHub Pages copy, pages.dev
// previews, local servers) it is reached on workers.dev.
const WORKER_ORIGIN = 'https://signal-sync.primetimeplayer-signal-sync.workers.dev';
const SITE_HOSTS = ['signaltechnews.com', 'www.signaltechnews.com'];
const AUTH_BASE = SITE_HOSTS.includes(location.hostname) ? location.origin : WORKER_ORIGIN;
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

  setAccountLabel('login');

  render();
}

function hasSessionCookie() {
  try {
    return /(?:^|; )signal_session=/.test(document.cookie || '');
  } catch (e) {
    return false;
  }
}

async function initAuth() {
  await exchangeAuthCode();
  // Logged-out visits have no token and no session cookie. Skip /api/me so
  // the expected 401 does not show up as a console error.
  if (authToken || hasSessionCookie()) {
    await getAuthState();
  } else {
    authState = { authenticated: false, user: null };
  }

  authReady = true;

  if (authState.authenticated) {
    setAccountLabel('logout');

    try {
      await migrateLocalSavedToCloud();
      render();
    } catch (e) {
      console.error('Saved Stories sync failed:', e.message);
    }
  } else {
    setAccountLabel('login');
  }
}

// Two account buttons share one state: #accountBtn in the masthead (desktop)
// and #syncSettingsBtn in the navigation drawer (phones). Only the icon is
// kept; the label, aria-label, tooltip and the .is-signed-in dot follow the
// signed-in state, and the data-i18n keys let a language switch re-translate
// them.
function setAccountLabel(label) {
  const mode = label === 'logout' || label === 'Log out' ? 'logout' : 'login';
  document.querySelectorAll('[data-account-btn]').forEach((btn) => {
    let textNode = btn.querySelector('.account-label');
    if (!textNode) {
      textNode = document.createElement('span');
      textNode.className = 'account-label';
      btn.appendChild(textNode);
    }
    const labelKey = mode === 'logout' ? 'logOut' : 'logIn';
    const ariaKey = mode === 'logout' ? 'logOutAccount' : 'logInSync';
    textNode.setAttribute('data-i18n', labelKey);
    textNode.textContent = t(labelKey);
    btn.classList.toggle('is-signed-in', mode === 'logout');
    btn.setAttribute('data-i18n-aria', ariaKey);
    btn.setAttribute('aria-label', t(ariaKey));
    if (mode === 'logout') {
      btn.removeAttribute('data-i18n-title');
      btn.title = authState.user?.email || t('logOut');
    } else {
      btn.setAttribute('data-i18n-title', 'signInGoogle');
      btn.title = t('signInGoogle');
    }
  });
}

document.querySelectorAll('[data-account-btn]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (authState.authenticated) {
      logoutAccount();
    } else {
      window.location.href = `${AUTH_BASE}/auth/google`;
    }
  });
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
    return { news: t('catNews'), papers: t('catPaper'), reviews: t('catReview'), review: t('catReview'), guide: t('catGuide'), reddit: t('catReddit') }[cat] || cat;
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
  // Headlines are plain text. Older news.json, KV and localStorage copies can
  // still hold feed markup (<span class="italic">Reg</span>), so drop HTML
  // tags here too. Same rules as scripts/lib/clean-title.js. The result is
  // still escaped by textHtml/escapeHtml, so nothing in a title can run.
  const TITLE_TAG = /<\/?(?:a|abbr|audio|b|blockquote|br|cite|del|div|em|embed|font|h[1-6]|i|iframe|img|ins|li|mark|object|ol|p|picture|q|s|script|small|source|span|strong|style|sub|sup|svg|time|u|ul|video|wbr)\b[^<>]*>|<\/?[a-z][a-z0-9-]*\s+[a-z_:][a-z0-9_:.-]*\s*=[^<>]*>/gi;
  const TITLE_BLOCK_TAG = /^<\/?(?:br|p|div|li|h[1-6]|blockquote)\b/i;
  function stripTitleTags(text) {
    return text.replace(TITLE_TAG, (tag) => (TITLE_BLOCK_TAG.test(tag) ? ' ' : ''));
  }
  function cleanTitle(value = '') {
    return stripTitleTags(decodeEntities(stripTitleTags(String(value ?? ''))))
      .replace(/\s+/g, ' ')
      .trim();
  }
  function withCleanTitle(item) {
    if (!item || typeof item.title !== 'string') return item;
    const title = cleanTitle(item.title);
    return title === item.title ? item : { ...item, title: title || '(untitled)' };
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

  const REVIEW_TITLE_RE = /\breview(?:s|ed)?\b|\btested\b|\bhands[- ]on\b|\bfirst look\b|\bi tried\b|\ba (?:week|month) with\b|\b\d+ best\b|\bbest\b.*\b(?:for|of) 20\d\d\b|\(20\d\d\)|\bvs\.?\s(?!code\b)|\bversus\b/i;
  const GUIDE_TITLE_RE = /^how to\b|\bhow to\b|\b\d+ ways to\b|\btips\b|\bguide\b|\bwhat (?:do|does|is)\b.*\bmean\b/i;
  const REVIEW_SOURCES = new Set(['The Verge Reviews']);
  // 'news' | 'review' | 'guide' | 'papers' | 'reddit', from the article itself.
  function storyKind(item) {
    if (!item) return 'news';
    if (item.category === 'papers' || item.category === 'reddit') return item.category;
    const title = decodeEntities(item.title || '');
    if (REVIEW_SOURCES.has(item.source) || REVIEW_TITLE_RE.test(title)) return 'review';
    if (GUIDE_TITLE_RE.test(title)) return 'guide';
    return 'news';
  }
  // Colour class for a card: reviews purple, everything else as before.
  function kindClass(item) {
    const kind = storyKind(item);
    return kind === 'review' ? 'reviews' : kind === 'guide' ? 'news' : kind;
  }

  function matchesVertical(item, filter) {
    if (!filter || filter === 'all') return true;
    if (filter === 'papers') {
      // AI = every paper plus any news/review whose HEADLINE is about AI.
      // Title only: summaries mention "AI" too loosely.
      return item.category === 'papers' || (item.category !== 'reddit' && matchesKeywords({ title: item.title }, VERTICALS.ai));
    }
    if (filter === 'reviews') return storyKind(item) === 'review';
    if (filter === 'news') return item.category !== 'papers' && item.category !== 'reddit' && storyKind(item) !== 'review';
    if (filter === 'reddit') return item.category === 'reddit';
    if (filter === 'gadgets') return isHardware(item) || matchesKeywords(item, VERTICALS.gadgets);
    const words = VERTICALS[filter];
    return words ? matchesKeywords(item, words) : item.category === filter;
  }

  function sortItems(list) {
    const byDate = list.slice().sort((a, b) => {
      const da = new Date(a.published || 0).getTime() || 0;
      const db = new Date(b.published || 0).getTime() || 0;
      return db - da;
    });
    return withImageFirst(byDate);
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

  // Date options are a fixed time range. Rebuilding them here means a region
  // or language list can never be copied into this control.
  const DATE_FILTER_OPTIONS = [
    ['all', 'anyTime'],
    ['today', 'today'],
    ['week', 'thisWeek'],
  ];

  function lockDateFilter() {
    if (!dateFilterEl) return;
    const current = dateFilterEl.value;
    const expected = DATE_FILTER_OPTIONS.map(([value]) => value);
    const actual = Array.from(dateFilterEl.options).map((opt) => opt.value);
    const same = actual.length === expected.length && actual.every((value, index) => value === expected[index]);
    if (!same) dateFilterEl.replaceChildren();
    DATE_FILTER_OPTIONS.forEach(([value, key], index) => {
      const opt = dateFilterEl.options[index] || dateFilterEl.appendChild(document.createElement('option'));
      opt.value = value;
      opt.textContent = t(key);
    });
    dateFilterEl.value = expected.includes(current) ? current : 'all';
  }

  function populateSources() {
    if (!sourceFilterEl) return;

    // Publication names only. Region and language values live on their own
    // selects and are never copied in here.
    const byCategory = { news: [], papers: [], reviews: [], reddit: [] };
    const sources = [...new Set(allItems.map((i) => i.source).filter(Boolean))].sort();
    sources.forEach((s) => {
      const item = allItems.find((i) => i.source === s);
      const cat = item ? item.category : null;
      if (cat && byCategory[cat]) byCategory[cat].push(s);
      else byCategory.news.push(s);
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
    const allowed = new Set(['all', ...sources]);
    Array.from(sourceFilterEl.options).forEach((opt) => {
      if (!allowed.has(opt.value)) opt.remove();
    });
    if (allowed.has(current)) sourceFilterEl.value = current;
    else {
      sourceFilterEl.value = 'all';
      activeSource = 'all';
    }
  }

  function storyImageUrl(item) {
    const raw = item && (item.image || item.imageUrl || item.thumbnail) || '';
    const url = String(raw).replace(/&amp;|&#0*38;|&#x0*26;/gi, '&').trim();
    return /^https?:\/\//i.test(url) ? url : '';
  }

  // Pictured stories stay in their existing order, then stories with no
  // picture. Nothing is removed. Latest, the hero, and the grid read this
  // order so image-less Google News items do not fill those slots.
  function withImageFirst(items) {
    const pictured = [];
    const textOnly = [];
    (items || []).forEach((item) => {
      if (storyImageUrl(item)) pictured.push(item);
      else textOnly.push(item);
    });
    return pictured.concat(textOnly);
  }

  function storyCategory(item) {
    const category = item && item.category;
    if (category === 'papers' || category === 'reviews' || category === 'reddit') return category;
    return 'news';
  }

  function imageAltText(item) {
    return cleanTitle(item && item.title) || t('storyImage');
  }

  function logoAltText(item, host) {
    const name = cleanTitle((item && item.source) || host || '');
    return name ? t('logoOf', { name }) : t('storyImage');
  }

  function faviconMark(host, loading, alt) {
    if (!host) return '';
    const src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
    const label = alt || t('storyImage');
    return `<img class="media-fallback-mark" alt="${escapeAttr(label)}" width="28" height="28" loading="${loading}" decoding="async" referrerpolicy="no-referrer" src="${escapeAttr(src)}" onerror="this.hidden=true">`;
  }

  // The hero keeps a picture box, so a story with no photo gets a
  // brand-coloured tile there: source favicon plus the category name.
  // List cards omit the slot instead. A photo that fails to load still
  // uses this tile from signalImageFallback.
  function mediaPlaceholder(item, kind) {
    const category = storyCategory(item);
    const host = publisherHost(item && item.link);
    const loading = kind === 'hero' ? 'eager' : 'lazy';
    const label = catLabel(category);
    return `<span class="card-media ${kind}-media media-fallback media-tile" data-category="${escapeAttr(category)}" aria-hidden="true">${faviconMark(host, loading, logoAltText(item, host))}<span class="media-tile-label">${escapeHtml(label)}</span></span>`;
  }

  // A failed story photo is removed so the broken-image icon never shows.
  // The replacement keeps the photo box and uses the same branded tile.
  function signalImageFallback(img) {
    if (!img || img.dataset.fallbackApplied === '1') return;
    img.dataset.fallbackApplied = '1';
    img.hidden = true;
    const category = storyCategory({ category: img.dataset.category });
    const kind = img.classList.contains('hero-thumb') ? 'hero' : img.classList.contains('pick-thumb') ? 'pick' : 'story';
    const holder = document.createElement('span');
    holder.className = `card-media ${kind}-media media-fallback media-tile`;
    holder.dataset.category = category;
    holder.setAttribute('aria-hidden', 'true');
    const host = img.dataset.sourceHost || '';
    if (host) {
      const mark = document.createElement('img');
      mark.className = 'media-fallback-mark';
      mark.alt = (img.alt && img.alt.trim()) || (host ? t('logoOf', { name: host }) : t('storyImage'));
      mark.width = 28;
      mark.height = 28;
      mark.setAttribute('referrerpolicy', 'no-referrer');
      mark.setAttribute('decoding', 'async');
      mark.setAttribute('loading', kind === 'hero' ? 'eager' : 'lazy');
      mark.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
      mark.addEventListener('error', () => {
        mark.hidden = true;
      });
      holder.appendChild(mark);
    }
    const label = document.createElement('span');
    label.className = 'media-tile-label';
    label.textContent = catLabel(category);
    holder.appendChild(label);
    if (img.parentNode) img.replaceWith(holder);
  }

  function heroLeadsViewport() {
    if (typeof window.matchMedia !== 'function') return true;
    return !window.matchMedia('(max-width: 800px)').matches;
  }

  function resizedImage(url, width) {
    const one = `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&q=85&output=webp&we`;
    const two = `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width * 2}&q=85&output=webp&we`;
    const three = `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width * 3}&q=85&output=webp&we`;
    return { src: one, srcset: `${one} 1x, ${two} 2x, ${three} 3x` };
  }

  function preloadHeroImage(url) {
    const sized = resizedImage(url, 800);
    let link = document.head.querySelector('link[data-hero-preload]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.dataset.heroPreload = '1';
      document.head.appendChild(link);
    }
    if (link.getAttribute('href') === sized.src) return;
    link.href = sized.src;
    link.setAttribute('imagesrcset', sized.srcset);
    link.setAttribute('fetchpriority', 'high');
  }

  function cardImage(item, kind, width, height) {
    const url = storyImageUrl(item);
    if (!url) return kind === 'hero' ? mediaPlaceholder(item, kind) : '';
    const cls = kind === 'hero' ? 'hero-thumb' : kind === 'pick' ? 'pick-thumb' : 'story-thumb';
    const host = publisherHost(item && item.link);
    // List thumbs request 80px (160px at 2x, 240px at 3x). The hero stays 800.
    const sized = resizedImage(url, kind === 'hero' ? 800 : 80);
    if (kind === 'hero' && heroLeadsViewport()) preloadHeroImage(url);
    const loading = kind === 'hero' ? 'eager' : 'lazy';
    const priority = kind === 'hero' ? ' fetchpriority="high"' : '';
    const sizes = kind === 'hero' ? ' sizes="(max-width: 800px) 100vw, 640px"' : ' sizes="96px"';
    const srcAttr = ` src="${escapeAttr(sized.src)}" srcset="${escapeAttr(sized.srcset)}"`;
    return `<img class="${cls}" alt="${escapeAttr(imageAltText(item))}" width="${width}" height="${height}" loading="${loading}" decoding="async" referrerpolicy="no-referrer"${priority}${sizes}${srcAttr} data-src="${escapeAttr(url)}" data-category="${escapeAttr(storyCategory(item))}" data-source-host="${escapeAttr(host)}" onerror="signalImageFallback(this)">`;
  }

  function mountCardImages(root) {
    if (!root) return;
    root.querySelectorAll('img[data-src]').forEach((img) => {
      if (img.getAttribute('src')) return;
      const hero = img.classList.contains('hero-thumb');
      img.setAttribute('loading', hero ? 'eager' : 'lazy');
      img.setAttribute('referrerpolicy', 'no-referrer');
      img.setAttribute('decoding', 'async');
      if (hero) img.setAttribute('fetchpriority', 'high');
      if (!img.getAttribute('width') || !img.getAttribute('height')) {
        if (hero) {
          img.width = 800;
          img.height = 450;
        } else {
          img.width = 96;
          img.height = 72;
        }
      }
      const original = img.dataset.src;
      if (original) {
        const sized = resizedImage(original, hero ? 800 : 80);
        img.src = sized.src;
        img.srcset = sized.srcset;
        if (hero) preloadHeroImage(original);
      }
    });
  }

  function paintCardImages(root) {
    // Yield so the card text paints before image requests start. A hidden
    // document pauses requestAnimationFrame, so a timeout is the reliable yield.
    setTimeout(() => mountCardImages(root), 0);
  }

  function storyThumb(item, width = 96, height = 72) {
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
    return `<img class="source-favicon" src="${escapeAttr(src)}" alt="${escapeAttr(logoAltText(item, host))}" width="16" height="16" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.hidden=true;var n=this.nextElementSibling;if(n)n.hidden=false">${fallback}`;
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

  // Publisher domain, plus a read time only when the fetch step counted the
  // words of a full-text feed item. Teaser-only stories never get a guess.
  function sourceExtra(item) {
    const host = publisherHost(item && item.link);
    const domain = host && host !== 'news.google.com' ? host : '';
    const mins = item && Number(item.readMinutes) > 0 ? Math.round(Number(item.readMinutes)) : 0;
    return `${domain ? `<span class="source-extra source-domain">${escapeHtml(domain)}</span>` : ''}${mins ? `<span class="source-extra source-read">${escapeHtml(t('minRead', { n: mins }))}</span>` : ''}`;
  }

  function sourceLine(item) {
    const name = item && item.source ? `<span class="source-name">${textHtml(item.source)}</span>` : '';
    return `<div class="source-line">${sourceMark(item)}${name}${sourceExtra(item)}</div>`;
  }

  function cardMeta(item) {
    const when = relativeDate(item.published);
    const author = storyAuthor(item);
    const cat = catLabel(storyKind(item));
    const source = (item && item.source) || '';
    const hasExtra = Boolean(when || author);
    return `<div class="card-meta${hasExtra ? ' has-extra' : ''}"><span class="cat-label">${escapeHtml(cat)}</span><span class="meta-source visually-hidden" aria-hidden="true">${textHtml(source)}</span>${when ? `<span class="meta-time">${escapeHtml(when)}</span>` : ''}${author ? `<span class="meta-author">${escapeHtml(author)}</span>` : ''}</div>`;
  }

  function pickThumb(item) {
    return cardImage(item, 'pick', 96, 72);
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
    const title = cleanTitle(item && item.title) || t('storyImage');
    const saveLabel = saved ? t('savedStory', { title }) : t('saveStory', { title });
    return `
          <div class="card-actions">
            <button type="button" class="icon-btn save-btn${saved ? ' active' : ''}" data-link="${escapeAttr(item.link)}" aria-pressed="${saved ? 'true' : 'false'}" aria-label="${escapeAttr(saveLabel)}">${saved ? `${BOOKMARK_SVG.replace('FILL', 'currentColor')} ${escapeHtml(t('savedStar'))}` : `${BOOKMARK_SVG.replace('FILL', 'none')} ${escapeHtml(t('save'))}`}</button>
            <button type="button" class="icon-btn share-btn" data-link="${escapeAttr(item.link)}" aria-label="${escapeAttr(t('shareStory', { title }))}">⇪ ${escapeHtml(t('share'))}</button>
            <button type="button" class="icon-btn preview-btn" data-link="${escapeAttr(item.link)}" aria-label="${escapeAttr(t('previewStory', { title }))}">⤢ ${escapeHtml(t('preview'))}</button>
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
    if (latestRowEl) latestRowEl.setAttribute('aria-busy', 'false');
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

  // opts.ignoreSource / opts.ignoreDate leave that one control out, so the
  // source and date menus can show how many stories each choice would give.
  function getFilteredItems(opts = {}) {
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
      const matchesSource = opts.ignoreSource || activeSource === 'all' || i.source === activeSource;
      const matchesDate = opts.ignoreDate || withinDateFilter(i.published, activeDate);
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

  function syncFilterChrome() {
    const active = hasActiveFilters();
    const row = document.getElementById('feedFilters');
    const status = document.getElementById('filtersStatus');
    if (status) {
      status.hidden = !active;
      status.textContent = active ? t('filtersActive') : '';
    }
    if (sourceFilterEl) sourceFilterEl.classList.toggle('is-active', activeSource !== 'all');
    if (dateFilterEl) dateFilterEl.classList.toggle('is-active', activeDate !== 'all');
    if (clearFiltersEl) clearFiltersEl.hidden = !active;
    syncFilterMenus();
  }

  // ---------- Source and date dropdowns ----------
  // The native selects stay in the DOM as the state holders (their change
  // handlers drive the feed). These listbox menus are the visible controls,
  // drawn like the header search pill. Pattern: select-only combobox, focus
  // stays on the trigger and aria-activedescendant points at the option.
  var filterMenuList;
  var filterTypeahead = { text: '', timer: 0 };

  function filterMenus() {
    if (filterMenuList) return filterMenuList;
    filterMenuList = [
      { key: 'source', select: sourceFilterEl, trigger: 'sourceTrigger', menu: 'sourceMenu', value: 'sourceValue' },
      { key: 'date', select: dateFilterEl, trigger: 'dateTrigger', menu: 'dateMenu', value: 'dateValue' },
    ].map((c) => Object.assign(c, {
      triggerEl: document.getElementById(c.trigger),
      menuEl: document.getElementById(c.menu),
      valueEl: document.getElementById(c.value),
    })).filter((c) => c.select && c.triggerEl && c.menuEl);
    return filterMenuList;
  }

  function filterMenuIsOpen(c) {
    return c.triggerEl.getAttribute('aria-expanded') === 'true';
  }

  function filterOptionRows(c) {
    const select = c.select;
    if (c.key === 'date') {
      const pool = getFilteredItems({ ignoreDate: true });
      return [{ options: Array.from(select.options).map((opt) => ({
        value: opt.value,
        label: opt.textContent,
        count: pool.filter((i) => withinDateFilter(i.published, opt.value)).length,
      })) }];
    }
    // Sources are counted inside the current topic, Hardware/Saved toggles,
    // search and date, so a source that would give an empty feed is not offered.
    const pool = getFilteredItems({ ignoreSource: true });
    const counts = new Map();
    pool.forEach((i) => { if (i.source) counts.set(i.source, (counts.get(i.source) || 0) + 1); });
    const keep = (value) => counts.has(value) || value === select.value;
    const groups = [{ options: [{ value: 'all', label: t('allSources'), count: pool.length }] }];
    Array.from(select.children).forEach((node) => {
      if (node.tagName === 'OPTGROUP') {
        const options = Array.from(node.children)
          .filter((opt) => keep(opt.value))
          .map((opt) => ({ value: opt.value, label: opt.textContent, count: counts.get(opt.value) || 0 }));
        if (options.length) groups.push({ label: node.label, options });
      } else if (node.value !== 'all' && keep(node.value)) {
        groups[0].options.push({ value: node.value, label: node.textContent, count: counts.get(node.value) || 0 });
      }
    });
    return groups;
  }

  function renderFilterMenu(c) {
    const current = c.select.value;
    const menu = c.menuEl;
    menu.replaceChildren();
    let index = 0;
    filterOptionRows(c).forEach((group, g) => {
      let parent = menu;
      if (group.label) {
        parent = document.createElement('div');
        parent.className = 'filter-group';
        parent.setAttribute('role', 'group');
        const head = document.createElement('div');
        head.className = 'filter-group-label';
        head.id = `${c.key}MenuGroup${g}`;
        head.setAttribute('role', 'presentation');
        head.textContent = group.label;
        parent.setAttribute('aria-labelledby', head.id);
        parent.appendChild(head);
        menu.appendChild(parent);
      }
      group.options.forEach((o) => {
        const selected = o.value === current;
        const opt = document.createElement('div');
        opt.className = `filter-option${selected ? ' is-selected' : ''}${o.count ? '' : ' is-empty'}`;
        opt.id = `${c.key}Option${index++}`;
        opt.setAttribute('role', 'option');
        opt.setAttribute('aria-selected', selected ? 'true' : 'false');
        opt.dataset.value = o.value;
        const label = document.createElement('span');
        label.className = 'filter-option-label';
        label.textContent = o.label;
        const count = document.createElement('span');
        count.className = 'filter-option-count';
        count.textContent = String(o.count);
        const check = document.createElement('span');
        check.className = 'filter-option-check';
        check.setAttribute('aria-hidden', 'true');
        check.innerHTML = selected ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" focusable="false"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' : '';
        opt.append(check, label, count);
        parent.appendChild(opt);
      });
    });
  }

  function filterOptions(c) {
    return Array.from(c.menuEl.querySelectorAll('.filter-option'));
  }

  function setActiveFilterOption(c, index, scroll = true) {
    const opts = filterOptions(c);
    if (!opts.length) return;
    const i = Math.max(0, Math.min(opts.length - 1, index));
    opts.forEach((o, n) => o.classList.toggle('is-active', n === i));
    c.triggerEl.setAttribute('aria-activedescendant', opts[i].id);
    if (scroll) {
      const o = opts[i];
      const m = c.menuEl;
      if (o.offsetTop < m.scrollTop) m.scrollTop = o.offsetTop - 6;
      else if (o.offsetTop + o.offsetHeight > m.scrollTop + m.clientHeight) m.scrollTop = o.offsetTop + o.offsetHeight - m.clientHeight + 6;
    }
  }

  function activeFilterIndex(c) {
    return filterOptions(c).findIndex((o) => o.classList.contains('is-active'));
  }

  function placeFilterMenu(c) {
    const menu = c.menuEl;
    menu.style.transform = '';
    const rect = menu.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    let shift = 0;
    if (rect.right > vw - 8) shift = vw - 8 - rect.right;
    if (rect.left + shift < 8) shift = 8 - rect.left;
    if (shift) menu.style.transform = `translateX(${Math.round(shift)}px)`;
  }

  function closeFilterMenus(restoreFocus) {
    filterMenus().forEach((c) => {
      if (!filterMenuIsOpen(c)) return;
      c.triggerEl.setAttribute('aria-expanded', 'false');
      c.triggerEl.removeAttribute('aria-activedescendant');
      c.menuEl.hidden = true;
      c.triggerEl.closest('.filter-field').classList.remove('is-open');
      if (restoreFocus) c.triggerEl.focus();
    });
  }

  function openFilterMenu(c, index) {
    closeFilterMenus(false);
    if (typeof closeLocaleMenus === 'function') closeLocaleMenus(false);
    renderFilterMenu(c);
    c.menuEl.hidden = false;
    c.triggerEl.setAttribute('aria-expanded', 'true');
    c.triggerEl.closest('.filter-field').classList.add('is-open');
    placeFilterMenu(c);
    const opts = filterOptions(c);
    let i = index;
    if (i === undefined) i = opts.findIndex((o) => o.classList.contains('is-selected'));
    if (i === 'last') i = opts.length - 1;
    setActiveFilterOption(c, i < 0 ? 0 : i);
  }

  function chooseFilterOption(c, value) {
    closeFilterMenus(false);
    c.triggerEl.focus();
    if (value === undefined || c.select.value === value) return;
    c.select.value = value;
    c.select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function syncFilterMenus() {
    filterMenus().forEach((c) => {
      const opt = c.select.options[c.select.selectedIndex];
      if (c.valueEl) c.valueEl.textContent = opt ? opt.textContent : '';
      c.triggerEl.classList.toggle('is-active', c.select.value !== 'all');
      if (filterMenuIsOpen(c)) {
        const keep = activeFilterIndex(c);
        renderFilterMenu(c);
        setActiveFilterOption(c, keep < 0 ? 0 : keep, false);
      }
    });
  }

  function bindFilterMenus() {
    filterMenus().forEach((c) => {
      const field = c.triggerEl.closest('.filter-field');
      c.triggerEl.addEventListener('click', () => {
        if (filterMenuIsOpen(c)) closeFilterMenus(false);
        else openFilterMenu(c);
      });
      c.triggerEl.addEventListener('keydown', (e) => {
        const open = filterMenuIsOpen(c);
        const count = filterOptions(c).length;
        const at = activeFilterIndex(c);
        const key = e.key;
        if (!open) {
          if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ' || key === 'Home' || key === 'End') {
            e.preventDefault();
            openFilterMenu(c, key === 'Home' ? 0 : (key === 'End' ? 'last' : undefined));
          }
          return;
        }
        if (key === 'ArrowDown' || key === 'ArrowUp') {
          e.preventDefault();
          if (e.altKey && key === 'ArrowUp') { chooseFilterOption(c, (filterOptions(c)[at] || {}).dataset?.value); return; }
          setActiveFilterOption(c, at + (key === 'ArrowDown' ? 1 : -1));
        } else if (key === 'Home' || key === 'End') {
          e.preventDefault();
          setActiveFilterOption(c, key === 'Home' ? 0 : count - 1);
        } else if (key === 'PageDown' || key === 'PageUp') {
          e.preventDefault();
          setActiveFilterOption(c, at + (key === 'PageDown' ? 8 : -8));
        } else if (key === 'Enter' || (key === ' ' && !filterTypeahead.text)) {
          e.preventDefault();
          const opt = filterOptions(c)[at];
          chooseFilterOption(c, opt ? opt.dataset.value : undefined);
        } else if (key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeFilterMenus(true);
        } else if (key === 'Tab') {
          closeFilterMenus(false);
        } else if (key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          // Type-ahead: jump to the first option starting with the typed text.
          e.preventDefault();
          e.stopPropagation();
          clearTimeout(filterTypeahead.timer);
          filterTypeahead.text += key.toLowerCase();
          filterTypeahead.timer = setTimeout(() => { filterTypeahead.text = ''; }, 600);
          const opts = filterOptions(c);
          const hit = opts.findIndex((o) => o.querySelector('.filter-option-label').textContent.toLowerCase().startsWith(filterTypeahead.text));
          if (hit >= 0) setActiveFilterOption(c, hit);
        }
      });
      // Keep focus on the trigger while the pointer is in the list.
      c.menuEl.addEventListener('mousedown', (e) => e.preventDefault());
      c.menuEl.addEventListener('mousemove', (e) => {
        const opt = e.target.closest('.filter-option');
        if (!opt) return;
        const i = filterOptions(c).indexOf(opt);
        if (i !== activeFilterIndex(c)) setActiveFilterOption(c, i, false);
      });
      c.menuEl.addEventListener('click', (e) => {
        const opt = e.target.closest('.filter-option');
        if (opt) chooseFilterOption(c, opt.dataset.value);
      });
      field.addEventListener('focusout', () => {
        setTimeout(() => {
          if (filterMenuIsOpen(c) && !field.contains(document.activeElement)) closeFilterMenus(false);
        }, 0);
      });
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest || !e.target.closest('.feed-filters .filter-field')) closeFilterMenus(false);
    });
    window.addEventListener('resize', () => {
      filterMenus().forEach((c) => { if (filterMenuIsOpen(c)) placeFilterMenu(c); });
    });
  }

  function emptyFeedHtml() {
    const term = searchTerm.trim();
    if (term) {
      return `<div class="empty empty-search" role="status"><p>${escapeHtml(t('emptySearch', { q: term }))}</p></div>`;
    }
    if (savedOnly && !Object.keys(savedMap).length) {
      const body = authState.authenticated ? t('empty') : t('savedEmptyBody');
      const login = authState.authenticated ? '' : `<button type="button" class="empty-login">${escapeHtml(t('logIn'))}</button>`;
      return `<div class="empty empty-saved" role="status"><p class="empty-title">${escapeHtml(t('savedEmptyTitle'))}</p><p>${escapeHtml(body)}</p>${login}</div>`;
    }
    return `<div class="empty" role="status"><p>${escapeHtml(t('empty'))}</p></div>`;
  }

  function wireEmptyActions(root) {
    if (!root) return;
    root.querySelectorAll('.empty-login').forEach((btn) => {
      if (btn.dataset.bound === '1') return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        window.location.href = `${AUTH_BASE}/auth/google`;
      });
    });
  }

  function publishStoryJsonLd(items) {
    let node = document.getElementById('storyJsonLd');
    if (!node) {
      node = document.createElement('script');
      node.id = 'storyJsonLd';
      node.type = 'application/ld+json';
      document.head.appendChild(node);
    }
    const list = (items || []).slice(0, 12).filter((item) => item && item.link).map((item, index) => {
      const article = {
        '@type': 'NewsArticle',
        headline: cleanTitle(item.title) || item.link,
        url: item.link,
        publisher: { '@id': 'https://signaltechnews.com/#organization' },
      };
      if (item.published) article.datePublished = item.published;
      const image = storyImageUrl(item);
      if (image) article.image = image;
      if (item.source) article.author = { '@type': 'Organization', name: cleanTitle(item.source) || item.source };
      return { '@type': 'ListItem', position: index + 1, item: article };
    });
    node.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Signal Tech stories',
      itemListElement: list,
    }).replace(/</g, '\\u003c');
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

  function setSkeletonVisible(on) {
    if (!skeletonEl) return;
    skeletonEl.style.display = on ? 'grid' : 'none';
    skeletonEl.setAttribute('aria-busy', on ? 'true' : 'false');
    const main = document.getElementById('main');
    if (main) main.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function hideSkeletons() {
    setSkeletonVisible(false);
  }

  function showFeedFailure(serial) {
    if (serial !== refreshSerial) return;
    feedFailed = true;
    allItems = [];
    paintedSignature = '';
    paintedTop = '';
    paintedWithStatic = false;
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
    cancelPreview();
    if (newsletterCardEl && feedEl.contains(newsletterCardEl)) newsletterCardEl.remove();
    const items = sortItems(getFilteredItems());
    visibleCount = Math.min(visibleCount, items.length || PAGE_SIZE);

    resultCountEl.textContent = t('resultCount', { n: items.length, m: allItems.length });

    renderErrorBanner();

    // The reset control only exists while something is actually narrowed down,
    // so the default, unfiltered view stays exactly what it was before.
    syncFilterChrome();
    const latestWrapEl = document.getElementById('latest');
    if (latestWrapEl) latestWrapEl.classList.toggle('is-filtered-out', hasActiveFilters());

    // A failed load is not an empty filter result. Drop the skeleton and the
    // "loading feed…" line, and leave the retry banner as the status.
    if (feedFailed && !allItems.length) {
      feedEl.style.display = 'none';
      setSkeletonVisible(false);
      loadMoreWrapEl.style.display = 'none';
      if (statusEl) {
        statusEl.textContent = '';
        statusEl.hidden = true;
      }
      publishStoryJsonLd([]);
      placeNewsletterCard();
      syncHash();
      return;
    }

    // No matching items: reuse the page's existing empty state instead of
    // leaving a blank grid. The message doubles as the answer to "did the app
    // work?" — there were simply no results for the current filters.
    if (!items.length) {
      feedEl.style.display = 'none';
      setSkeletonVisible(false);
      loadMoreWrapEl.style.display = 'none';
      feedEl.innerHTML = emptyFeedHtml();
      feedEl.style.display = 'block';
      wireEmptyActions(feedEl);
      publishStoryJsonLd([]);
      placeNewsletterCard();
      syncHash();
      return;
    }

    // The feed is rendered from already-loaded data in one synchronous pass,
    // so the skeleton is only needed while a refetch is in flight (refresh()
    // turns it on at the start of every fetch). Flip both back here: the
    // skeleton off, the grid on — otherwise the placeholders stay on screen
    // and the freshly rendered cards never appear.
    setSkeletonVisible(false);
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
      <article class="card hero-story ${kindClass(lead)}${leadFields.hw ? ' is-hardware' : ''}">
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
      <article class="card follow-card ${kindClass(item)}${fields.hw ? ' is-hardware' : ''}">
        <div class="story-copy">
          ${sourceLine(item)}
          <h2><a href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer" data-recent-title="${textAttr(item.title)}">${textHtml(item.title)}</a></h2>
          ${cardMeta(item)}
          ${fields.chips.length ? `<div class="card-chips">${fields.chips.map((chip) => `<span class="chip chip-${chip.kind}">${escapeHtml(chip.text)}</span>`).join('')}</div>` : ''}
          ${cardActions(item, fields.saved, fields.note)}
        </div>
        ${storyThumb(item, 96, 72)}
      </article>`;
    }).join('');

    const storyRow = (item) => {
      const fields = storyFields(item);
      return `
      <article class="card story-row ${kindClass(item)}${fields.hw ? ' is-hardware' : ''}">
        <div class="story-copy">
          ${sourceLine(item)}
          <h2><a href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer" data-recent-title="${textAttr(item.title)}">${textHtml(item.title)}</a></h2>
          ${cardMeta(item)}
          ${fields.chips.length ? `<div class="card-chips">${fields.chips.map((chip) => `<span class="chip chip-${chip.kind}">${escapeHtml(chip.text)}</span>`).join('')}</div>` : ''}
          ${item.summary ? `<p>${textHtml(item.summary)}</p>` : ''}
          ${cardActions(item, fields.saved, fields.note)}
        </div>
        ${storyThumb(item, 96, 72)}
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
      <article class="card pick-card ${kindClass(item)}${fields.hw ? ' is-hardware' : ''}">
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

    const savedNote = (savedOnly && !authState.authenticated)
      ? `<div class="saved-sync-note" role="status"><p>${escapeHtml(t('savedLocalNote'))}</p><button type="button" class="empty-login">${escapeHtml(t('logIn'))}</button></div>`
      : '';
    feedEl.innerHTML = `
      ${savedNote}
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
    wireEmptyActions(feedEl);
    publishStoryJsonLd(visible);
    paintCardImages(feedEl);
    hydrateDeferredHeroes(feedEl);
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
    syncHash();
  }

  function hydrateDeferredHeroes(root) {
    const imgs = [...(root || document).querySelectorAll('img.hero-thumb[data-src]')].filter((img) => !img.getAttribute('src'));
    if (!imgs.length) return;
    const run = () => {
      imgs.forEach((img) => {
        if (!img.isConnected || img.getAttribute('src')) return;
        const sized = resizedImage(img.dataset.src, 800);
        img.setAttribute('loading', 'eager');
        img.setAttribute('fetchpriority', 'high');
        img.src = sized.src;
        img.srcset = sized.srcset;
      });
    };
    setTimeout(run, 1600);
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

  // --- Story preview popover ---
  // Desktop (hover + fine pointer): resting on a card for 1s opens a large
  // preview beside it. Keyboard: focusing a card headline for 1s does the same.
  // Touch: the card's "Preview" button opens it as a bottom sheet.
  // Opening plays a "genie" effect: the popup pours out of the card through a
  // pinched funnel (clip-path + transform only); closing sucks it back in.
  const PREVIEW_DELAY_MS = 1000;
  const PREVIEW_GRACE_MS = 250;
  const GENIE_OPEN_MS = 300;
  const GENIE_SHEET_MS = 280;
  const GENIE_CLOSE_MS = 200;
  const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let previewEl = null;
  let previewBackdropEl = null;
  let previewTimer = null;
  let previewHideTimer = null;
  let previewCard = null;
  let previewScrollY = 0;
  let previewAnim = null;
  let previewGenie = null; // { side, at } saved at open so close can reverse it

  function previewItemFor(card) {
    const link = card && card.querySelector('h2 a[href]');
    const href = link && link.getAttribute('href');
    return href ? allItems.find((i) => i.link === href) || null : null;
  }

  function previewImageSrc(item) {
    const url = storyImageUrl(item);
    return url ? resizedImage(url, 520).src : '';
  }

  function previewIsOpen() {
    return !!previewEl && !previewEl.hidden && !previewEl.classList.contains('is-closing');
  }

  function ensurePreviewEl() {
    if (previewEl) return previewEl;
    previewBackdropEl = document.createElement('div');
    previewBackdropEl.className = 'story-preview-backdrop';
    previewBackdropEl.hidden = true;
    document.body.appendChild(previewBackdropEl);
    previewEl = document.createElement('div');
    previewEl.id = 'storyPreview';
    previewEl.className = 'story-preview';
    previewEl.setAttribute('role', 'dialog');
    previewEl.setAttribute('aria-modal', 'false');
    previewEl.setAttribute('aria-labelledby', 'storyPreviewTitle');
    previewEl.hidden = true;
    previewEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || !previewEl.classList.contains('is-sheet')) return;
      const items = Array.from(previewEl.querySelectorAll('button, a[href]')).filter((el) => !el.disabled);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    });
    previewEl.addEventListener('mouseenter', () => clearTimeout(previewHideTimer));
    previewEl.addEventListener('mouseleave', () => schedulePreviewHide());
    previewEl.addEventListener('click', (e) => {
      if (e.target.closest('.story-preview-close')) hidePreview(true);
    });
    document.body.appendChild(previewEl);
    return previewEl;
  }

  // Which popup edge faces the source (card or Preview button), and where
  // along that edge (0-100%) the funnel's narrow end should sit.
  function genieAnchor(popupRect, sourceRect, sheet) {
    const cx = sourceRect.left + sourceRect.width / 2;
    const cy = sourceRect.top + sourceRect.height / 2;
    const along = (value, start, size) => Math.max(6, Math.min(94, ((value - start) / size) * 100));
    if (sheet) return { side: 'bottom', at: along(cx, popupRect.left, popupRect.width) };
    if (popupRect.left >= sourceRect.right - 2) return { side: 'left', at: along(cy, popupRect.top, popupRect.height) };
    if (popupRect.right <= sourceRect.left + 2) return { side: 'right', at: along(cy, popupRect.top, popupRect.height) };
    const side = cy < popupRect.top + popupRect.height / 2 ? 'top' : 'bottom';
    return { side, at: along(cx, popupRect.left, popupRect.width) };
  }

  // Keyframes for a soft genie. Each frame clips the popup to a gentle funnel:
  // a wide neck (about 45% of the edge) at the side facing the source that
  // flares slightly towards the far edge. The far edge opens first and the
  // neck last, while the popup grows a short way out of the source.
  function genieFrames({ side, at }) {
    const lerp = (a, b, k) => a + (b - a) * k;
    const ease = (k) => { const c = Math.max(0, Math.min(1, k)); return c * c * (3 - 2 * c); };
    const rows = [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1]; // 0 = source edge, 1 = far edge
    const frames = [];
    for (let f = 0; f <= 9; f += 1) {
      const t = f / 9;
      const lo = [];
      const hi = [];
      rows.forEach((u) => {
        const open = ease(t * 1.5 - (1 - u) * 0.5);
        const neckLo = Math.max(0, Math.min(at, 77.5) - 22.5);
        lo.push(lerp(neckLo, 0, open).toFixed(2));
        hi.push(lerp(neckLo + 45, 100, open).toFixed(2));
      });
      const reach = lerp(0.6, 1, ease(t * 1.15)).toFixed(3);
      let pts;
      let transform;
      let origin;
      if (side === 'left' || side === 'right') {
        const x = (u) => (side === 'left' ? u * 100 : 100 - u * 100).toFixed(2);
        pts = rows.map((u, n) => `${x(u)}% ${lo[n]}%`).concat(rows.map((u, n) => `${x(u)}% ${hi[n]}%`).reverse());
        transform = `scaleX(${reach})`;
        origin = `${side === 'left' ? 0 : 100}% ${at}%`;
      } else {
        const y = (u) => (side === 'top' ? u * 100 : 100 - u * 100).toFixed(2);
        pts = rows.map((u, n) => `${lo[n]}% ${y(u)}%`).concat(rows.map((u, n) => `${hi[n]}% ${y(u)}%`).reverse());
        transform = `scaleY(${reach})`;
        origin = `${at}% ${side === 'top' ? 0 : 100}%`;
      }
      frames.push({ offset: t, clipPath: `polygon(${pts.join(', ')})`, transform, transformOrigin: origin, opacity: Math.min(1, t * 4) });
    }
    return frames;
  }

  function playPreviewAnim(opening) {
    if (previewAnim) previewAnim.cancel();
    const reduce = reduceMotionQuery.matches || !previewEl.animate;
    if (reduce) {
      if (!previewEl.animate) return null;
      previewAnim = previewEl.animate({ opacity: opening ? [0, 1] : [1, 0] }, { duration: 150, easing: 'linear' });
      return previewAnim;
    }
    const frames = genieFrames(previewGenie || { side: 'bottom', at: 50 });
    previewAnim = previewEl.animate(opening ? frames : frames.slice().reverse().map((f) => ({ ...f, offset: 1 - f.offset })), {
      duration: opening ? (previewEl.classList.contains('is-sheet') ? GENIE_SHEET_MS : GENIE_OPEN_MS) : GENIE_CLOSE_MS,
      easing: opening ? 'cubic-bezier(0.25, 0.1, 0.25, 1)' : 'cubic-bezier(0.4, 0, 0.7, 0.2)',
    });
    return previewAnim;
  }

  function hidePreview(restoreFocus) {
    clearTimeout(previewHideTimer);
    if (!previewIsOpen()) { previewCard = null; return; }
    const el = previewEl;
    const wasSheet = el.classList.contains('is-sheet');
    const card = previewCard;
    previewCard = null;
    el.classList.add('is-closing');
    if (previewBackdropEl) previewBackdropEl.classList.remove('is-visible');
    const finish = () => {
      if (!el.classList.contains('is-closing')) return; // reopened meanwhile
      el.hidden = true;
      el.classList.remove('is-closing', 'is-sheet');
      if (previewBackdropEl) previewBackdropEl.hidden = true;
    };
    const anim = playPreviewAnim(false);
    if (anim) anim.onfinish = finish; else finish();
    if (restoreFocus && card) {
      const focusTarget = (wasSheet && card.querySelector('.preview-btn')) || card.querySelector('h2 a');
      if (focusTarget) focusTarget.focus({ preventScroll: true });
    }
  }

  // Cancels a pending open as well as closing an open preview.
  function cancelPreview() {
    clearTimeout(previewTimer);
    hidePreview(false);
  }

  function schedulePreviewHide() {
    clearTimeout(previewHideTimer);
    if (previewEl && previewEl.classList.contains('is-sheet')) return;
    previewHideTimer = setTimeout(() => hidePreview(false), PREVIEW_GRACE_MS);
  }

  function showPreview(card, sheet, source) {
    const item = previewItemFor(card);
    if (!item) return;
    const body = String(item.excerpt || item.summary || '').trim();
    const why = String(item.whyItMatters || '').trim();
    if (!body && !why) return;
    const el = ensurePreviewEl();
    const img = previewImageSrc(item);
    const when = relativeDate(item.published);
    el.innerHTML = `
      <button type="button" class="story-preview-close" aria-label="${escapeAttr(t('closePreview'))}">×</button>
      ${img ? `<img class="story-preview-img" src="${escapeAttr(img)}" alt="${escapeAttr(imageAltText(item))}" width="520" height="292" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
      <div class="story-preview-body">
        <p class="story-preview-meta">${textHtml(item.source || '')}${when ? ` · ${escapeHtml(when)}` : ''}</p>
        <h3 class="story-preview-title" id="storyPreviewTitle">${textHtml(item.title)}</h3>
        ${body ? `<p class="story-preview-summary">${textHtml(body)}</p>` : ''}
        ${why ? `<p class="story-preview-why"><b>${escapeHtml(t('whyItMatters'))}</b> ${textHtml(why)}</p>` : ''}
        <a class="story-preview-open" href="${escapeAttr(item.link)}" target="_blank" rel="noopener noreferrer" data-recent-title="${textAttr(item.title)}">${escapeHtml(t('openOriginal'))} ↗</a>
      </div>`;
    previewCard = card;
    previewScrollY = window.scrollY;
    el.classList.remove('is-closing');
    el.classList.toggle('is-sheet', !!sheet);
    el.setAttribute('aria-modal', sheet ? 'true' : 'false');
    el.style.left = '';
    el.style.top = '';
    el.hidden = false;
    if (sheet) {
      previewBackdropEl.hidden = false;
      requestAnimationFrame(() => previewBackdropEl.classList.add('is-visible'));
    } else {
      const rect = card.getBoundingClientRect();
      const gap = 12;
      const width = el.offsetWidth;
      const height = el.offsetHeight;
      let left;
      if (rect.right + gap + width <= window.innerWidth - 16) left = rect.right + gap;
      else if (rect.left - gap - width >= 16) left = rect.left - gap - width;
      else left = rect.left + (rect.width - width) / 2;
      left = Math.max(16, Math.min(left, window.innerWidth - width - 16));
      const top = Math.max(16, Math.min(rect.top, window.innerHeight - height - 16));
      el.style.left = `${Math.round(left)}px`;
      el.style.top = `${Math.round(top)}px`;
    }
    // One layout read for the geometry, then the animation runs on the
    // compositor (transform, clip-path, opacity only).
    const sourceRect = (source || card).getBoundingClientRect();
    previewGenie = genieAnchor(el.getBoundingClientRect(), sourceRect, sheet);
    playPreviewAnim(true);
    if (sheet) el.querySelector('.story-preview-close').focus({ preventScroll: true });
  }

  function armPreview(card) {
    if (!card || card === previewCard) { clearTimeout(previewHideTimer); return; }
    clearTimeout(previewTimer);
    // Start loading the picture now so it is there when the popup opens.
    const item = previewItemFor(card);
    const src = item && previewImageSrc(item);
    if (src) new Image().src = src;
    previewTimer = setTimeout(() => showPreview(card, false), PREVIEW_DELAY_MS);
  }

  function bindPreview() {
    if (!feedEl || feedEl.dataset.previewBound === '1') return;
    feedEl.dataset.previewBound = '1';
    feedEl.addEventListener('mouseover', (e) => {
      if (!hoverQuery.matches) return;
      const card = e.target.closest('article.card');
      if (card && !card.contains(e.relatedTarget)) armPreview(card);
    });
    feedEl.addEventListener('mouseout', (e) => {
      if (!hoverQuery.matches) return;
      const card = e.target.closest('article.card');
      if (!card || card.contains(e.relatedTarget)) return;
      if (previewEl && previewEl.contains(e.relatedTarget)) return;
      if (card === previewCard) schedulePreviewHide();
      else clearTimeout(previewTimer);
    });
    feedEl.addEventListener('focusin', (e) => {
      const link = e.target.closest('article.card h2 a');
      if (link) armPreview(link.closest('article.card'));
    });
    feedEl.addEventListener('focusout', (e) => {
      if (previewEl && previewEl.contains(e.relatedTarget)) return;
      if (previewEl && previewEl.classList.contains('is-sheet')) return;
      cancelPreview();
    });
    feedEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.preview-btn');
      if (!btn) return;
      e.preventDefault();
      showPreview(btn.closest('article.card'), true, btn);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      clearTimeout(previewTimer);
      if (!previewIsOpen()) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      hidePreview(true);
    });
    document.addEventListener('click', (e) => {
      if (!previewIsOpen()) return;
      if (previewEl.contains(e.target) || e.target.closest('.preview-btn')) return;
      // A sheet is a modal: dismissing it from outside returns focus to the
      // Preview button. A hover card is not, so it closes without a focus move.
      const sheet = previewEl.classList.contains('is-sheet');
      clearTimeout(previewTimer);
      hidePreview(sheet);
    });
    window.addEventListener('scroll', () => {
      if (previewEl && previewEl.classList.contains('is-sheet')) return;
      if (previewIsOpen() && Math.abs(window.scrollY - previewScrollY) < 40) return;
      cancelPreview();
    }, { passive: true });
    window.addEventListener('resize', cancelPreview);
  }
  bindPreview();

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
  let paintedTop = '';
  let paintedWithStatic = false;
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

  function topStorySignature(items) {
    return dedupeByTitle(items)
      .filter((item) => !isPromoItem(item))
      .slice(0, 8)
      .map((item) => `${item.link || ''}|${titleKey(item)}`)
      .join('\n');
  }

  function titleKey(item) {
    return decodeEntities((item && item.title) || '').trim().toLowerCase();
  }

  // Same decoded title from two sources (The Verge and The Verge Reviews)
  // counts once. The newest copy wins. Untitled items stay. Every feed path
  // passes through here, so this is also where titles lose stray markup.
  function dedupeByTitle(items) {
    const ranked = items.map(withCleanTitle).sort((a, b) => {
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
    return withImageFirst(dedupeByTitle([...news, ...buckets.papers, ...buckets.reviews, ...buckets.reddit]
      .filter((item) => !isPromoItem(item))));
  }

  function applyFeed(items, serial, savedAt, options = {}) {
    if (serial !== refreshSerial) return;
    feedFailed = false;
    if (statusEl) statusEl.hidden = false;
    const signature = feedSignature(items);
    const top = topStorySignature(items);
    const onScreen = feedEl.style.display === 'grid';
    const sameFeed = signature === paintedSignature && onScreen;
    // A live response that does not change the top stories stays quiet.
    // The first paint of the static JSON still draws, including sections
    // that sit below those stories.
    const sameTop = options.quietSwap && paintedWithStatic && top && top === paintedTop && onScreen;
    if (!sameFeed && !sameTop) {
      allItems = withImageFirst(dedupeByTitle(items));
      paintedSignature = signature;
      paintedTop = top;
      populateSources();
      renderAll();
      if (isSearchSuggestOpen() && searchEl && searchEl.value.trim()) renderSearchSuggest();
    } else {
      renderErrorBanner();
    }
    if (options.markStatic) paintedWithStatic = true;
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
  // Static JSON paints immediately. Both live attempts share LIVE_FEED_MS;
  // a later response is not swapped in. Static files still use LOCALE_FETCH_MS.
  // A timeout, a failed response, invalid JSON, or a disconnected worker
  // returns null and the feed stays on public/data/. Digests never call the
  // worker: digests.html reads public/digests/*.json on its own.
  const LOCALE_FETCH_MS = 6000;
  const LIVE_FEED_MS = 2500;

  async function loadLocalizedNews(region, language) {
    const deadline = Date.now() + LIVE_FEED_MS;
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
    console.warn('Localized news feed failed; using static JSON', lastError);
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
    // Live items usually have no image and would otherwise lead the feed.
    return withImageFirst([...localized, ...rest]);
  }

  async function loadJSON(file, category, mapFn) {
    try {
      const res = await fetch(`data/${file}`, {
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
    // skeleton until the live request finishes. The static JSON paints first.
    // A live result replaces it only when it arrives within LIVE_FEED_MS
    // and the top stories actually change.
    // Expired localStorage items stay available for the failure path below.
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
      applyFeed(composeFeed(cached.items, staticBuckets), serial, cached.savedAt, { markStatic: true });
    } else if (cached && cached.items && cached.items.length) {
      const immediate = dedupeByTitle(cached.items.filter((item) => !isPromoItem(item)));
      if (immediate.length) applyFeed(immediate, serial, cached.savedAt);
    } else if (!quiet) {
      if (statusEl) {
        statusEl.hidden = false;
        statusEl.textContent = t('loading');
      }
      clearErrorBanner();
      setSkeletonVisible(true);
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
        if (interim.length) applyFeed(interim, serial, cached ? cached.savedAt : Date.now(), { markStatic: true });
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
        localized ? Date.now() : (staleCached ? staleCached.savedAt : Date.now()),
        { markStatic: true, quietSwap: true }
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
          applyFeed(fallbackItems, serial, staleCached ? staleCached.savedAt : Date.now(), {
            markStatic: !!staticBuckets,
            quietSwap: true,
          });
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
  const sidebarBehindTargets = Array.from(document.querySelectorAll('.skip-link, #heroSignup, .topic-wrap, .home-intro, .controls > .row2, .mast .search-row, .locale-controls, #topicBar .search-row, main, footer'));
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
      const closeBtn = document.getElementById('sidebarClose');
      if (closeBtn) closeBtn.focus({ preventScroll: true });
    } else if (sidebarInertSnapshot) {
      sidebarInertSnapshot.forEach(([el, wasInert]) => { el.inert = wasInert; });
      sidebarInertSnapshot = null;
      if (menuToggleEl && (filtersEl.contains(document.activeElement) || document.activeElement === document.getElementById('sidebarClose'))) {
        menuToggleEl.focus();
      }
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
    if (previewIsOpen()) return;
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
    // Region and language menus read only their own select. Source and date
    // stay on #sourceFilter and #dateFilter.
    if (!select || (select.id !== 'regionSelect' && select.id !== 'languageSelect')) return;
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
      const visible = (badge && badge.textContent.trim()) || localeBadge(select);
      const described = select.getAttribute('aria-label') || '';
      const accessible = visible
        ? (described && described.indexOf(visible) !== 0 ? `${visible}, ${described}` : (described || visible))
        : described;
      if (accessible) {
        trigger.setAttribute('aria-label', accessible);
        trigger.setAttribute('title', accessible);
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
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Home' || e.key === 'End') {
          e.preventDefault();
          let next = index;
          if (e.key === 'ArrowDown') next = Math.min(items.length - 1, index + 1);
          else if (e.key === 'ArrowUp') next = Math.max(0, index - 1);
          else if (e.key === 'Home') next = 0;
          else next = items.length - 1;
          const target = items[index === -1 ? 0 : next];
          if (target) target.focus();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeLocaleMenus(true);
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
  bindFilterMenus();
  syncFilterMenus();
  bindMobileSearch();
  if (sourceFilterEl) sourceFilterEl.addEventListener('change', (e) => { activeSource = e.target.value; visibleCount = PAGE_SIZE; render(); });
  if (dateFilterEl) dateFilterEl.addEventListener('change', (e) => {
    const value = e.target.value;
    activeDate = value === 'today' || value === 'week' ? value : 'all';
    if (dateFilterEl.value !== activeDate) dateFilterEl.value = activeDate;
    visibleCount = PAGE_SIZE;
    render();
  });
  clearFiltersEl.addEventListener('click', () => {
    resetFilters();
    // The button hides itself once nothing is filtered, so hand focus to the
    // first filter instead of opening the search box or the phone overlay.
    const first = document.getElementById('sourceTrigger');
    if (first) first.focus();
  });
  window.addEventListener('message', (event) => {
    let host = '';
    try { host = new URL(event.origin).hostname; } catch (err) { return; }
    if (!/(^|\.)beehiiv\.com$/i.test(host)) return;
    let raw = event.data;
    if (raw && typeof raw === 'object') {
      try { raw = JSON.stringify(raw); } catch (err) { raw = ''; }
    }
    const text = String(raw || '');
    if (!/subscrib/i.test(text) || !/success|complete|confirm/i.test(text)) return;
    const thanks = document.getElementById('newsletterThanks');
    if (!thanks) return;
    thanks.hidden = false;
    thanks.textContent = t('newsletterThanks');
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
    if (hash === 'settings') document.getElementById(window.matchMedia('(max-width: 800px)').matches ? 'syncSettingsBtn' : 'accountBtn')?.focus();
  }

  const FILTER_TO_HASH = { news: 'technology', papers: 'ai', reddit: 'community' };
  // Mirror the current tab in the URL so a reload (or a shared link) lands on it.
  // Only filter hashes are rewritten; anchors like #newsletterCard are left alone.
  function syncHash() {
    const current = (location.hash || '').replace(/^#/, '').toLowerCase();
    if (current && !HASH_FILTERS[current] && !['all', 'home', 'hardware', 'saved'].includes(current)) return;
    const name = savedOnly ? 'saved'
      : hardwareOnly ? 'hardware'
      : activeFilter !== 'all' ? (FILTER_TO_HASH[activeFilter] || activeFilter) : '';
    if (name === current) return;
    history.replaceState(null, '', location.pathname + location.search + (name ? `#${name}` : ''));
  }

  setInterval(() => { if (!previewIsOpen()) renderAll(); }, 60 * 1000);
  setInterval(() => refresh({ quiet: true }), AUTO_REFRESH_MS);

  function formatSignalDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    const date = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
      : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const lang = document.documentElement.lang || 'en';
    try {
      return new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
    } catch (err) {
      return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
    }
  }

  function safeSignalUrl(value) {
    try {
      const url = new URL(String(value || ''), location.href);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
      return url.href;
    } catch (err) {
      return '';
    }
  }

  // --- This week's Signal: issue stack ---
  // data/signal-issues.json holds every issue, newest first. The newest sits
  // on top and older ones peek out underneath (box-shadow layers in home.css).
  // Swipe up on the card (or ↑ / the up arrow) brings the previous issue
  // forward; swipe down (or ↓ / the down arrow) brings the newer one back.
  // The card only claims a vertical swipe when there is an issue in that
  // direction, the card is fully on screen and the page is not mid-scroll,
  // so ordinary page scrolling over the card keeps working.
  const SIGNAL_MAX_ISSUES = 12;
  const SIGNAL_HINT_KEY = 'signal-stack-hint-seen';
  let signalLastScroll = 0;

  function normaliseSignalIssue(data) {
    if (!data || typeof data !== 'object') return null;
    const stories = Array.isArray(data.stories)
      ? data.stories.filter((story) => story && String(story.headline || '').trim())
      : [];
    const url = safeSignalUrl(data.url);
    const title = String(data.title || '').trim();
    const issueNumber = data.issueNumber;
    if (!title || !url || !stories.length || issueNumber == null || String(issueNumber).trim() === '') return null;
    return {
      issueNumber,
      title,
      date: data.date || '',
      url,
      stories: stories.slice(0, 3).map((story) => ({
        headline: String(story.headline).trim(),
        whyItMatters: String(story.whyItMatters || '').trim(),
      })),
    };
  }

  function signalIssueLabel(issue) {
    const when = formatSignalDate(issue.date);
    const label = t('signalIssue', { n: issue.issueNumber });
    return when ? `${label} · ${when}` : label;
  }

  function signalReduceMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function renderSignalStack() {
    const strip = document.getElementById('signalStrip');
    if (!strip) return;
    const total = signalIssues.length;
    const older = total - 1 - signalIndex;
    strip.classList.toggle('is-stack', total > 1);
    strip.classList.toggle('has-older', older > 0);
    strip.classList.toggle('has-older-2', older > 1);
    strip.classList.toggle('has-newer', signalIndex > 0);
    let nav = document.getElementById('signalNav');
    if (total < 2) {
      if (nav) nav.hidden = true;
      return;
    }
    if (!nav) {
      nav = document.createElement('div');
      nav.className = 'signal-nav';
      nav.id = 'signalNav';
      nav.innerHTML = `
        <button type="button" class="signal-nav-btn" data-signal-step="1"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 15 6-6 6 6"/></svg></button>
        <button type="button" class="signal-nav-btn" data-signal-step="-1"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg></button>
        <span class="signal-live" id="signalLive" aria-live="polite"></span>`;
      const actions = strip.querySelector('.signal-actions');
      strip.insertBefore(nav, actions || null);
    }
    nav.hidden = false;
    const [olderBtn, newerBtn] = nav.querySelectorAll('.signal-nav-btn');
    olderBtn.setAttribute('aria-label', t('signalPrev'));
    olderBtn.title = t('signalPrev');
    olderBtn.disabled = older < 1;
    newerBtn.setAttribute('aria-label', t('signalNewer'));
    newerBtn.title = t('signalNewer');
    newerBtn.disabled = signalIndex < 1;
  }

  function renderSignalIssue() {
    const strip = document.getElementById('signalStrip');
    if (!strip || !signalIssue) return;
    const kickerEl = document.getElementById('signalKickerLabel');
    const titleEl = document.getElementById('signalTitle');
    const metaEl = document.getElementById('signalMeta');
    const storiesEl = document.getElementById('signalStories');
    const readEl = document.getElementById('signalRead');
    if (kickerEl) {
      const key = signalIndex > 0 ? 'signalKickerPast' : 'signalKicker';
      kickerEl.setAttribute('data-i18n', key);
      kickerEl.textContent = t(key);
    }
    if (titleEl) titleEl.textContent = signalIssue.title;
    // The " · " separator before the label comes from CSS (.signal-kicker-meta::before).
    if (metaEl) metaEl.textContent = signalIssueLabel(signalIssue);
    if (readEl) readEl.href = signalIssue.url;
    if (storiesEl) {
      storiesEl.replaceChildren();
      signalIssue.stories.forEach((story) => {
        const item = document.createElement('div');
        item.className = 'signal-story';
        const headline = document.createElement('p');
        headline.className = 'signal-headline';
        headline.textContent = story.headline;
        const why = document.createElement('p');
        why.className = 'signal-why';
        why.textContent = story.whyItMatters;
        item.append(headline, why);
        storiesEl.appendChild(item);
      });
    }
    renderSignalStack();
    strip.hidden = false;
  }

  async function fetchSignalJson(path) {
    try {
      const res = await fetch(path, { cache: 'no-store' });
      return res.ok ? await res.json() : null;
    } catch (err) {
      return null;
    }
  }

  async function loadSignalIssue() {
    const strip = document.getElementById('signalStrip');
    if (!strip) return;
    const many = await fetchSignalJson('data/signal-issues.json');
    let list = (many && Array.isArray(many.issues) ? many.issues : []).map(normaliseSignalIssue).filter(Boolean);
    if (!list.length) {
      const one = normaliseSignalIssue(await fetchSignalJson('data/signal-issue.json'));
      if (one) list = [one];
    }
    list.sort((a, b) => String(b.date).localeCompare(String(a.date)) || (Number(b.issueNumber) - Number(a.issueNumber)));
    signalIssues = list.slice(0, SIGNAL_MAX_ISSUES);
    signalIndex = 0;
    signalIssue = signalIssues[0] || null;
    if (!signalIssue) {
      strip.hidden = true;
      return;
    }
    renderSignalIssue();
    bindSignalStack();
  }

  // step 1 = older issue, -1 = newer issue. from = the card's drag offset in px
  // at release (0 for buttons and keys). The new issue is drawn in the same
  // frame as the release or press, then settles in 200 ms. Nothing is locked
  // while it settles: a second swipe, tap or key press interrupts it at once.
  function stopSignalMotion(strip) {
    if (!strip.getAnimations) return;
    strip.getAnimations().forEach((anim) => {
      // Leave the CSS box-shadow transition (the peeking layers) alone.
      if (typeof CSSTransition !== 'undefined' && anim instanceof CSSTransition) return;
      anim.cancel();
    });
  }

  function stepSignal(step, from = 0) {
    const strip = document.getElementById('signalStrip');
    const next = signalIndex + step;
    if (!strip || !signalIssues[next]) return false;
    stopSignalMotion(strip);
    const keepHeight = strip.offsetHeight;
    signalIndex = next;
    signalIssue = signalIssues[next];
    renderSignalIssue();
    // Phones size the card to its content; never let it shrink mid-browse.
    if (strip.offsetHeight < keepHeight) strip.style.minHeight = `${keepHeight}px`;
    const live = document.getElementById('signalLive');
    if (live) live.textContent = `${signalIssueLabel(signalIssue)}: ${signalIssue.title}`;
    strip.style.transform = '';
    strip.style.opacity = '';
    if (!strip.animate) return true;
    if (signalReduceMotion()) {
      strip.animate({ opacity: [0.4, 1] }, { duration: 120, easing: 'linear' });
      return true;
    }
    // Older issue (swipe up / ▲): it rises from just behind the card.
    // Newer issue (swipe down / ▼): it drops back on top from just above.
    // A drag carries a little of its momentum into the entry.
    const enter = step > 0 ? 14 : -14;
    const carry = Math.max(-10, Math.min(10, -from * 0.1));
    strip.animate([
      { transform: `translateY(${enter + carry}px) scale(0.97)`, opacity: 0.35 },
      { transform: 'none', opacity: 1 },
    ], { duration: 200, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
    return true;
  }

  function snapSignalBack(strip, from) {
    strip.style.transform = '';
    strip.style.opacity = '';
    if (!from || !strip.animate || signalReduceMotion()) return;
    const fade = signalDragFade(from);
    strip.animate([
      { transform: `translateY(${from}px) scale(${1 - Math.abs(from) / 2000})`, opacity: fade },
      { transform: 'none', opacity: 1 },
    ], { duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' });
  }

  // While dragging, the card tracks the finger 1:1 for the first 120 px, then
  // with resistance, and fades a little so the issue behind reads as "next".
  function signalDragOffset(dy) {
    const a = Math.abs(dy);
    const d = a <= 120 ? a : 120 + (a - 120) * 0.3;
    return Math.sign(dy) * d;
  }

  function signalDragFade(offset) {
    return Math.max(0.55, 1 - Math.abs(offset) / 260);
  }

  function showSignalHint(strip) {
    let seen = false;
    try { seen = localStorage.getItem(SIGNAL_HINT_KEY) === '1'; } catch (err) { seen = true; }
    if (seen || signalIssues.length < 2 || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.intersectionRatio >= 0.9)) return;
      io.disconnect();
      try { localStorage.setItem(SIGNAL_HINT_KEY, '1'); } catch (err) { /* private mode */ }
      // The hint sits just under the card (a zero-height wrapper, so nothing
      // moves), and the card gives one small lift to show the issue behind it.
      const wrap = document.createElement('div');
      wrap.className = 'signal-hint-wrap';
      wrap.setAttribute('aria-hidden', 'true');
      const hint = document.createElement('p');
      hint.className = 'signal-hint';
      const touch = window.matchMedia('(pointer: coarse)').matches;
      hint.textContent = t(touch ? 'signalHintTouch' : 'signalHintKeys');
      wrap.appendChild(hint);
      strip.after(wrap);
      requestAnimationFrame(() => hint.classList.add('is-visible'));
      if (strip.animate && !signalReduceMotion()) {
        strip.animate([
          { transform: 'translateY(0)' },
          { transform: 'translateY(-6px)', offset: 0.35 },
          { transform: 'translateY(0)' },
        ], { duration: 650, delay: 250, easing: 'cubic-bezier(0.2, 1.25, 0.4, 1)' });
      }
      setTimeout(() => {
        hint.classList.remove('is-visible');
        setTimeout(() => wrap.remove(), 400);
      }, 4000);
    }, { threshold: [0.9] });
    io.observe(strip);
  }

  function bindSignalStack() {
    const strip = document.getElementById('signalStrip');
    if (!strip || strip.dataset.stackBound === '1' || signalIssues.length < 2) return;
    strip.dataset.stackBound = '1';
    showSignalHint(strip);
    strip.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-signal-step]');
      if (!btn || btn.disabled) return;
      stepSignal(Number(btn.dataset.signalStep));
    });
    strip.addEventListener('keydown', (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const step = event.key === 'ArrowUp' ? 1 : event.key === 'ArrowDown' ? -1 : 0;
      if (event.key === 'Home' && signalIndex > 0) {
        event.preventDefault();
        stepSignal(-signalIndex);
        return;
      }
      if (!step || !signalIssues[signalIndex + step]) return;
      event.preventDefault();
      stepSignal(step);
    });
    window.addEventListener('scroll', () => { signalLastScroll = performance.now(); }, { passive: true });
    let g = null;
    strip.addEventListener('touchstart', (event) => {
      g = null;
      if (event.touches.length !== 1) return;
      const rect = strip.getBoundingClientRect();
      const onScreen = rect.top >= 0 && rect.bottom <= window.innerHeight;
      // 100 ms is enough to tell a finger that has just stopped a fling from
      // one still riding it; 250 ms swallowed real swipes right after a scroll.
      const settled = performance.now() - signalLastScroll > 100;
      if (!onScreen || !settled) return;
      const touch = event.touches[0];
      g = { x: touch.clientX, y: touch.clientY, mode: '', step: 0, dy: 0, vy: 0, t: performance.now() };
    }, { passive: true });
    strip.addEventListener('touchmove', (event) => {
      if (!g || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const dx = touch.clientX - g.x;
      const dy = touch.clientY - g.y;
      if (!g.mode) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        g.step = dy < 0 ? 1 : -1;
        const vertical = Math.abs(dy) > Math.abs(dx) * 1.2;
        g.mode = vertical && signalIssues[signalIndex + g.step] ? 'stack' : 'page';
        // Grab the card where it is: stop any settle animation still running.
        if (g.mode === 'stack') stopSignalMotion(strip);
      }
      if (g.mode !== 'stack') return;
      if (event.cancelable) event.preventDefault();
      const now = performance.now();
      // Smoothed velocity (px/ms) so one uneven frame can't fake or kill a flick.
      const v = (dy - g.dy) / Math.max(1, now - g.t);
      g.vy = g.vy ? g.vy * 0.4 + v * 0.6 : v;
      g.dy = dy;
      g.t = now;
      if (!signalReduceMotion()) {
        const pull = signalDragOffset(dy);
        strip.style.transform = `translateY(${pull}px) scale(${1 - Math.abs(pull) / 2000})`;
        strip.style.opacity = String(signalDragFade(pull));
      }
    }, { passive: false });
    const end = (cancelled) => {
      if (!g || g.mode !== 'stack') { g = null; return; }
      const pull = signalReduceMotion() ? 0 : signalDragOffset(g.dy);
      const sameWay = (g.dy < 0 ? 1 : -1) === g.step;
      const far = Math.abs(g.dy) > 40 || (Math.abs(g.vy) > 0.35 && Math.abs(g.dy) > 12);
      if (!cancelled && sameWay && far) stepSignal(g.step, pull);
      else snapSignalBack(strip, pull);
      g = null;
    };
    strip.addEventListener('touchend', () => end(false), { passive: true });
    strip.addEventListener('touchcancel', () => end(true), { passive: true });
  }

  function bindSignalStrip() {
    const free = document.getElementById('signalFree');
    if (!free) return;
    free.addEventListener('click', (event) => {
      const card = document.getElementById('newsletterCard');
      if (!card) return;
      event.preventDefault();
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    });
  }

  applyHash(false);
  applySavedLocale();
  applyI18n();
  bindSignalStrip();
  loadSignalIssue();
  refresh();
  window.addEventListener('hashchange', () => applyHash(true));
  window.addEventListener('scroll', function () {
  if (window.scrollY > 80) {
    document.body.classList.add('search-scrolled');
  } else {
    document.body.classList.remove('search-scrolled');
  }
});
