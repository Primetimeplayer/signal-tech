/* Signal Tech — shared chrome for secondary pages (digests, issues).
   Handles the theme toggle, the Log in button, the cookie banner, the
   service worker and the copyright year. The home page keeps its own copy
   of this logic in assets/home.js; this file never runs there. */
(function () {
  'use strict';

  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {}
    return null;
  }

  // --- Theme (same key and default as the home page) ---
  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }
  function paintToggle(theme) {
    var btn = document.getElementById('themeToggle');
    if (!btn) return;
    var label = 'Switch to ' + (theme === 'light' ? 'dark' : 'light') + ' theme';
    btn.setAttribute('aria-label', label);
    btn.title = label;
    btn.innerHTML = theme === 'light' ? SUN : MOON;
  }
  function setTheme(theme, persist) {
    document.documentElement.setAttribute('data-theme', theme);
    paintToggle(theme);
    if (persist) store('signal-theme', theme);
  }
  setTheme(currentTheme(), false);
  var toggle = document.getElementById('themeToggle');
  if (toggle) toggle.addEventListener('click', function () {
    setTheme(currentTheme() === 'light' ? 'dark' : 'light', true);
  });
  window.addEventListener('storage', function (e) {
    if (e.key === 'signal-theme' && (e.newValue === 'light' || e.newValue === 'dark')) setTheme(e.newValue, false);
  });

  // --- Log in button ---
  // Same rules as home.js: the worker lives on the site origin on
  // signaltechnews.com and on workers.dev everywhere else; /api/me is only
  // called when a token or session cookie exists, so logged-out visits make
  // no request. Signing in or managing the account happens on the home page.
  var WORKER_ORIGIN = 'https://signal-sync.primetimeplayer-signal-sync.workers.dev';
  var SITE_HOSTS = ['signaltechnews.com', 'www.signaltechnews.com'];
  var AUTH_BASE = SITE_HOSTS.indexOf(location.hostname) !== -1 ? location.origin : WORKER_ORIGIN;
  var signedIn = false;
  var token = store('signal-auth-token') || '';
  var hasCookie = /(?:^|; )signal_session=/.test(document.cookie || '');

  function paintAccount(email) {
    var buttons = document.querySelectorAll('[data-account-btn]');
    for (var i = 0; i < buttons.length; i++) {
      var btn = buttons[i];
      var label = btn.querySelector('.account-label');
      btn.classList.toggle('is-signed-in', signedIn);
      if (label) label.textContent = signedIn ? 'Account' : 'Log in';
      btn.setAttribute('aria-label', signedIn ? 'Account settings' : 'Log in to sync saved stories');
      btn.title = signedIn ? (email || 'Account settings') : 'Sign in with Google';
    }
  }
  var accountButtons = document.querySelectorAll('[data-account-btn]');
  for (var a = 0; a < accountButtons.length; a++) {
    accountButtons[a].addEventListener('click', function () {
      window.location.href = signedIn ? '/#settings' : AUTH_BASE + '/auth/google';
    });
  }
  if ((token || hasCookie) && window.fetch) {
    var headers = token ? { Authorization: 'Bearer ' + token } : {};
    fetch(AUTH_BASE + '/api/me', { headers: headers })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (me) {
        signedIn = !!(me && me.authenticated);
        paintAccount(me && me.user && me.user.email);
      })
      .catch(function () {});
  }

  // --- Cookie banner (same key and behaviour as the home page) ---
  var KEY = 'signal_tech_cookie_consent';
  var banner = document.getElementById('cookieBanner');
  var choice = store(KEY);
  if (banner && choice !== 'all' && choice !== 'essential') {
    banner.hidden = false;
    var accept = document.getElementById('cookieAccept');
    var essential = document.getElementById('cookieEssential');
    if (accept) accept.addEventListener('click', function () {
      store(KEY, 'all');
      if (window.loadSignalAnalytics) window.loadSignalAnalytics();
      banner.hidden = true;
    });
    if (essential) essential.addEventListener('click', function () {
      store(KEY, 'essential');
      banner.hidden = true;
    });
  }

  // --- Copyright year ---
  var year = String(new Date().getFullYear());
  var copies = document.querySelectorAll('[data-i18n="copyright"]');
  for (var c = 0; c < copies.length; c++) copies[c].textContent = copies[c].textContent.replace(/20\d{2}/, year);

  // --- Service worker (scope is the site root) ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function () {});
    });
  }
})();
