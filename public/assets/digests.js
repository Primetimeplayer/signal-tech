/* Signal Tech — weekly digests page.
   On /digests it reads /digests/index.json and /digests/<id>.json and renders
   the latest week in the home page's Latest Stories card style (?d=YYYY-MM-DD
   still opens an older week, for old links). The archive, Previous and Next
   link to the static /digests/YYYY-MM-DD pages written by
   scripts/build-static-pages.js. On those static pages (#digestContent has
   data-digest-id) the content is already in the HTML, so this only wires up
   Share and the tools.
   ?tools shows the copy-as-Markdown and thread tools (there is no owner
   login, so they are hidden from the public page rather than protected). */
(function () {
  'use strict';

  var listEl = document.getElementById('digestList');
  var contentEl = document.getElementById('digestContent');
  var rangeEl = document.getElementById('digestRange');
  var prevEl = document.getElementById('digestPrev');
  var nextEl = document.getElementById('digestNext');
  var shareEl = document.getElementById('digestShare');
  var shareStatusEl = document.getElementById('digestShareStatus');
  var params = new URLSearchParams(location.search);
  var showTools = params.has('tools');
  var entries = [];
  var current = null;

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function inline(text) {
    return esc(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  }
  function safeUrl(url) {
    try {
      var u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
    } catch (e) { return ''; }
  }
  function sourceLabel(source, url) {
    try {
      if (/(^|\.)arxiv\.org$/i.test(new URL(url).hostname)) return 'arXiv';
    } catch (e) {}
    return source || 'Source';
  }
  var staticId = contentEl.getAttribute('data-digest-id');
  function linkFor(id) {
    return '/digests/' + encodeURIComponent(id) + (showTools ? '?tools' : '');
  }

  // Digest markdown: "# title", "*range*", intro lines, "## Section" blocks
  // of "- **[Title](url)** (Source) — summary", then "---" and an outro.
  var ITEM = /^- \*\*\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)\*\*(?: \(([^)]*)\))?(?: — (.*))?$/;
  function parseDigest(md) {
    var out = { title: '', range: '', intro: [], sections: [], outro: [] };
    var section = null;
    var after = false;
    String(md || '').split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      if (/^---+$/.test(line)) { after = true; section = null; return; }
      if (/^# /.test(line)) { out.title = line.slice(2).trim(); return; }
      if (/^## /.test(line)) { section = { name: line.slice(3).trim(), items: [] }; out.sections.push(section); after = false; return; }
      var m = ITEM.exec(line);
      if (m && section) {
        section.items.push({ title: m[1], url: m[2], source: sourceLabel((m[3] || '').trim(), m[2]), summary: (m[4] || '').trim() });
        return;
      }
      if (!out.range && !section && /^\*[^*].*\*$/.test(line)) { out.range = line.slice(1, -1); return; }
      if (after) out.outro.push(line);
      else if (!section) out.intro.push(line);
    });
    return out;
  }

  function card(item, sectionName) {
    var href = safeUrl(item.url);
    if (!href) return '';
    return '<a class="latest-card digest-card" href="' + esc(href) + '" target="_blank" rel="noopener noreferrer">' +
      '<div class="cat">' + esc(item.source) + ' · ' + esc(sectionName) + '</div>' +
      '<h3>' + esc(item.title) + '</h3>' +
      (item.summary ? '<p class="digest-card-summary">' + esc(item.summary) + '</p>' : '') +
      '</a>';
  }

  function newsletterHtml() {
    var tpl = document.getElementById('newsletterTemplate');
    return tpl ? tpl.innerHTML : '';
  }

  function toolsHtml(data) {
    if (!showTools) return '';
    var thread = (data.thread || []).map(function (t, i) {
      return '<div class="thread-item"><span class="n">' + (i + 1) + '/</span> ' + esc(t) + '</div>';
    }).join('');
    return '<div class="digest-tools">' +
      '<button type="button" class="page-btn" id="copyMd">Copy as Markdown</button>' +
      '<button type="button" class="page-btn" id="toggleThread" aria-expanded="false" aria-controls="threadBox">Show thread version</button>' +
      '<div class="thread-box" id="threadBox" hidden>' + thread +
      '<button type="button" class="page-btn" id="copyThread">Copy thread</button></div>' +
      '</div>';
  }

  function copyText(text, btn) {
    function done() {
      var original = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(function () { btn.textContent = original; }, 1600);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, done);
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    done();
  }

  function setNav(id) {
    var i = -1;
    for (var k = 0; k < entries.length; k++) if (entries[k].id === id) i = k;
    var older = i >= 0 ? entries[i + 1] : null;
    var newer = i > 0 ? entries[i - 1] : null;
    prevEl.hidden = !older;
    nextEl.hidden = !newer;
    if (older) { prevEl.href = linkFor(older.id); prevEl.dataset.id = older.id; }
    if (newer) { nextEl.href = linkFor(newer.id); nextEl.dataset.id = newer.id; }
    var chips = listEl.querySelectorAll('.digest-chip');
    for (var c = 0; c < chips.length; c++) {
      var active = chips[c].dataset.id === id;
      chips[c].classList.toggle('is-active', active);
      if (active) chips[c].setAttribute('aria-current', 'page');
      else chips[c].removeAttribute('aria-current');
    }
  }

  function wireTools(data) {
    var threadText = (data.thread || []).map(function (t, i) { return (i + 1) + '/ ' + t; }).join('\n\n');
    document.getElementById('copyMd').addEventListener('click', function (e) { copyText(data.markdown || '', e.currentTarget); });
    document.getElementById('copyThread').addEventListener('click', function (e) { copyText(threadText, e.currentTarget); });
    document.getElementById('toggleThread').addEventListener('click', function (e) {
      var box = document.getElementById('threadBox');
      box.hidden = !box.hidden;
      e.currentTarget.setAttribute('aria-expanded', box.hidden ? 'false' : 'true');
      e.currentTarget.textContent = box.hidden ? 'Show thread version' : 'Hide thread version';
    });
  }

  function publishDigestLd(title, sections) {
    var list = [];
    sections.forEach(function (section) {
      (section.items || []).forEach(function (item) {
        if (!item || !item.url || list.length >= 12) return;
        list.push({
          '@type': 'ListItem',
          position: list.length + 1,
          item: {
            '@type': 'NewsArticle',
            headline: item.title || item.url,
            url: item.url,
            author: item.source ? { '@type': 'Organization', name: item.source } : undefined,
            publisher: { '@id': 'https://signaltechnews.com/#organization' }
          }
        });
      });
    });
    var node = document.getElementById('digestJsonLd');
    if (!node) {
      node = document.createElement('script');
      node.id = 'digestJsonLd';
      node.type = 'application/ld+json';
      document.head.appendChild(node);
    }
    node.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: title,
      itemListElement: list
    }).replace(/</g, '\\u003c');
  }

  function render(entry, data) {
    var d = parseDigest(data.markdown);
    var title = d.title || entry.title || 'Signal Weekly';
    rangeEl.textContent = (d.range || entry.dateRange || '') + (entry.itemCount ? ' · ' + entry.itemCount + ' stories' : '');
    document.title = title + ' — Signal Tech';
    var html = toolsHtml(data);
    if (d.intro.length) html += '<div class="digest-intro">' + d.intro.map(function (p) { return '<p>' + inline(p) + '</p>'; }).join('') + '</div>';
    d.sections.forEach(function (s, i) {
      html += '<section class="digest-section" aria-labelledby="digest-s' + i + '">' +
        '<h2 class="digest-section-title" id="digest-s' + i + '">' + esc(s.name) + '</h2>' +
        '<div class="digest-grid">' + s.items.map(function (it) { return card(it, s.name); }).join('') + '</div>' +
        '</section>';
      if (i === 0) html += newsletterHtml();
    });
    if (!d.sections.length) html += newsletterHtml();
    if (d.outro.length) html += '<div class="digest-outro">' + d.outro.map(function (p) { return '<p>' + inline(p) + '</p>'; }).join('') + '</div>';
    contentEl.innerHTML = html;
    contentEl.setAttribute('aria-busy', 'false');
    publishDigestLd(title, d.sections);

    if (showTools) wireTools(data);
  }

  function load(id) {
    var entry = null;
    for (var k = 0; k < entries.length; k++) if (entries[k].id === id) entry = entries[k];
    if (!entry) return;
    current = entry;
    setNav(id);
    return fetch('/digests/' + encodeURIComponent(id) + '.json')
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(function (data) { if (current === entry) render(entry, data); })
      .catch(function () {
        contentEl.innerHTML = '<p class="digest-empty">This digest could not be loaded. Please try again in a moment.</p>';
        contentEl.setAttribute('aria-busy', 'false');
      });
  }

  shareEl.addEventListener('click', function () {
    var id = staticId || (current && current.id);
    var url = location.origin + (id ? '/digests/' + id : location.pathname);
    var title = current ? current.title : document.title;
    function say(msg) {
      shareStatusEl.textContent = msg;
      setTimeout(function () { shareStatusEl.textContent = ''; }, 2500);
    }
    if (navigator.share) {
      navigator.share({ title: title, url: url }).then(function () { say('Link copied'); }, function () {});
    } else if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { say('Link copied'); }, function () { say('Copy failed. The link is ' + url); });
    } else {
      say('Copy failed. The link is ' + url);
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && shareStatusEl && shareStatusEl.textContent) shareStatusEl.textContent = '';
  });

  if (staticId) {
    current = { id: staticId, title: document.title.replace(/ — Signal Tech$/, '') };
    if (showTools) {
      fetch('/digests/' + encodeURIComponent(staticId) + '.json')
        .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
        .then(function (data) { contentEl.insertAdjacentHTML('afterbegin', toolsHtml(data)); wireTools(data); })
        .catch(function () {});
    }
    return;
  }

  fetch('/digests/index.json')
    .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
    .then(function (list) {
      entries = (Array.isArray(list) ? list : []).filter(function (e) {
        return e && /^\d{4}-\d{2}-\d{2}$/.test(e.id);
      });
      if (!entries.length) {
        listEl.innerHTML = '';
        contentEl.innerHTML = '<p class="digest-empty">No digests yet. The first one is published on Monday.</p>' + newsletterHtml();
        contentEl.setAttribute('aria-busy', 'false');
        return;
      }
      listEl.innerHTML = entries.map(function (e) {
        return '<a class="digest-chip" href="' + esc(linkFor(e.id)) + '" data-id="' + esc(e.id) + '">' + esc(e.dateRange || e.id) + '</a>';
      }).join('');
      var wanted = params.get('d');
      var start = entries.some(function (e) { return e.id === wanted; }) ? wanted : entries[0].id;
      load(start);
    })
    .catch(function () {
      listEl.innerHTML = '';
      contentEl.innerHTML = '<p class="digest-empty">The digest archive could not be loaded. Please try again in a moment.</p>';
      contentEl.setAttribute('aria-busy', 'false');
    });
})();
