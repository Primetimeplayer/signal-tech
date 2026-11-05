// A small, safe Markdown subset for content/blog/*.md.
// No raw HTML is emitted: text is escaped, and links are limited to
// http(s) and site-relative paths. The page template owns the H1, so a
// leading "# " heading is rendered as h2.

export function parseFrontMatter(raw) {
  const text = String(raw).replace(/^\uFEFF/, '');
  const fence = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!fence) return { meta: {}, body: text };
  return { meta: parseMeta(fence[1]), body: fence[2].replace(/^\r?\n/, '') };
}

function parseMeta(block) {
  const meta = {};
  const lines = String(block).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    const pair = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!pair) continue;
    const key = pair[1];
    const value = pair[2].trim();
    if (key === 'tags' && (value === '' || value === '|' || value === '>')) {
      const tags = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        i += 1;
        tags.push(unquote(lines[i].replace(/^\s*-\s+/, '')));
      }
      meta.tags = tags.filter(Boolean);
      continue;
    }
    if (key === 'tags') meta.tags = parseTags(value);
    else if (key === 'draft') meta.draft = parseBool(value);
    else meta[key] = unquote(value);
  }
  return meta;
}

function unquote(value) {
  const v = String(value).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1).replace(/\\(["'])/g, '$1');
  }
  return v;
}

function parseBool(value) {
  const v = unquote(value).toLowerCase();
  return v === 'true' || v === 'yes';
}

function parseTags(value) {
  let v = value.trim();
  if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1);
  if (!v) return [];
  return v.split(',').map((tag) => unquote(tag)).filter(Boolean);
}

function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// http(s) links, or a single-slash site path. javascript: and other schemes
// are dropped so the caller can keep the label as plain text.
export function safeHref(href) {
  const raw = String(href || '').trim();
  if (/^\/(?!\/)/.test(raw) && !/[\s<>"']/.test(raw) && !/^\/\\/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
  } catch { /* not a URL */ }
  return '';
}

function emphasis(escaped) {
  return escaped
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/(^|[^\w*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
}

function formatText(text) {
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let out = '';
  let match;
  while ((match = re.exec(text))) {
    out += emphasis(esc(text.slice(last, match.index)));
    const href = safeHref(match[2]);
    const label = emphasis(esc(match[1]));
    if (!href) out += label;
    else {
      const rel = /^https?:/i.test(href) ? ' rel="noopener"' : '';
      out += `<a href="${esc(href)}"${rel}>${label}</a>`;
    }
    last = match.index + match[0].length;
  }
  return out + emphasis(esc(text.slice(last)));
}

function inline(text) {
  const parts = String(text).split(/(`[^`\n]*`)/g);
  return parts.map((part, i) => (i % 2 === 1
    ? `<code>${esc(part.slice(1, -1))}</code>`
    : formatText(part))).join('');
}

function isFence(line) {
  return /^(```+|~~~+)/.exec(line);
}

function isHeading(line) {
  return /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
}

function isRule(line) {
  return /^ {0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line);
}

function isQuote(line) {
  return /^ {0,3}>\s?/.test(line);
}

function isList(line) {
  return /^(\s*)([-*+]|\d+[.)])\s+/.test(line);
}

function isTableRow(line) {
  return /^\s*\|.+\|\s*$/.test(line);
}

function isTableSep(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitCells(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function tableHtml(header, rows) {
  const head = header.map((cell) => `<th>${inline(cell)}</th>`).join('');
  const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`).join('\n');
  return `<div class="blog-table">\n<table>\n<thead>\n<tr>${head}</tr>\n</thead>\n<tbody>\n${body}\n</tbody>\n</table>\n</div>`;
}

export function mdToHtml(markdown) {
  const lines = String(markdown).replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    if (!lines[i].trim()) { i += 1; continue; }

    const fence = isFence(lines[i]);
    if (fence) {
      const marker = fence[1];
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith(marker)) {
        code.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`);
      continue;
    }

    if (isRule(lines[i])) { blocks.push('<hr>'); i += 1; continue; }

    const heading = isHeading(lines[i]);
    if (heading) {
      const level = heading[1].length === 1 ? 2 : Math.min(heading[1].length, 3);
      blocks.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      i += 1;
      continue;
    }

    if (isQuote(lines[i])) {
      const quoted = [];
      while (i < lines.length && (isQuote(lines[i]) || (quoted.length && !lines[i].trim() && lines[i + 1] && isQuote(lines[i + 1])))) {
        quoted.push(lines[i].replace(/^ {0,3}>\s?/, ''));
        i += 1;
      }
      const paras = quoted.join('\n').trim().split(/\n{2,}/)
        .filter((part) => part.trim())
        .map((part) => `<p>${inline(part.replace(/\n+/g, ' ').trim())}</p>`);
      blocks.push(`<blockquote>\n${paras.join('\n')}\n</blockquote>`);
      continue;
    }

    if (isTableRow(lines[i]) && lines[i + 1] && isTableSep(lines[i + 1])) {
      const header = splitCells(lines[i]);
      i += 2;
      const rows = [];
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitCells(lines[i]));
        i += 1;
      }
      blocks.push(tableHtml(header, rows));
      continue;
    }

    if (isList(lines[i])) {
      const ordered = /^\s*\d+[.)]\s+/.test(lines[i]);
      const items = [];
      while (i < lines.length) {
        const same = ordered ? /^\s*\d+[.)]\s+/.test(lines[i]) : /^\s*[-*+]\s+/.test(lines[i]);
        if (!same) break;
        let item = lines[i].replace(/^\s*(?:[-*+]|\d+[.)])\s+/, '');
        i += 1;
        while (i < lines.length && /^ {2,}\S/.test(lines[i]) && !isList(lines[i])) {
          item += ` ${lines[i].trim()}`;
          i += 1;
        }
        items.push(`<li>${inline(item.trim())}</li>`);
      }
      const tag = ordered ? 'ol' : 'ul';
      blocks.push(`<${tag}>\n${items.join('\n')}\n</${tag}>`);
      continue;
    }

    const para = [];
    while (i < lines.length && lines[i].trim() && !isFence(lines[i]) && !isRule(lines[i]) && !isHeading(lines[i]) && !isQuote(lines[i]) && !isList(lines[i]) && !(isTableRow(lines[i]) && lines[i + 1] && isTableSep(lines[i + 1]))) {
      para.push(lines[i].trim());
      i += 1;
    }
    blocks.push(`<p>${inline(para.join(' '))}</p>`);
  }

  return blocks.join('\n');
}
