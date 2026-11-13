(() => {
  'use strict';

  // The only page elements that receive styling are those created below.
  // Original ad cards are retained in the DOM, but hidden while their concise
  // representations are displayed. Organic result nodes are never modified.
  const MODES = new Set(['compact', 'minimal', 'collapsed']);
  const AD_LABEL = /^(?:ad|ads|sponsored|advertisement|annonce|publicité)$/i;
  const DOMAIN = /(?:^|\b)((?:[a-z\d-]+\.)+[a-z]{2,})(?:\b|\/|$)/i;
  const records = new Map();
  const rendered = new Set();
  const groupOrigins = new WeakMap();
  const rememberedCollapse = new WeakMap();
  let mode = 'compact';
  let pendingScan = false;
  let modalOpen = false;
  let nextGroupId = 0;

  const cleanText = (value) => (value || '').replace(/\s+/g, ' ').trim();
  const isOwn = (el) => Boolean(el?.closest?.('.qcr-group, .qcr-modal-backdrop'));
  const isLabel = (el) => el instanceof Element &&
    !el.children.length && el.textContent.length < 26 &&
    AD_LABEL.test(cleanText(el.textContent)) && !isOwn(el);

  function safeURL(link) {
    try {
      const url = new URL(link.href, location.href);
      return ['https:', 'http:'].includes(url.protocol) ? url : null;
    } catch {
      return null;
    }
  }

  function countLabels(el) {
    let count = 0;
    if (isLabel(el)) count++;
    for (const sub of el.querySelectorAll('span,small,div,em,b')) {
      if (isLabel(sub) && ++count > 1) break;
    }
    return count;
  }

  function titleLink(root, label) {
    // Prefer semantic titles. Qwant also uses styled links in some versions.
    for (const heading of root.querySelectorAll('h2,h3,[role="heading"]')) {
      const link = heading.closest('a[href]') || heading.querySelector('a[href]');
      if (link && safeURL(link) && cleanText(link.textContent).length > 4) return link;
    }
    const labelTop = label?.getBoundingClientRect?.().top ?? 0;
    let best = null;
    let bestScore = -Infinity;
    for (const link of root.querySelectorAll('a[href]')) {
      const url = safeURL(link);
      const txt = cleanText(link.textContent);
      if (!url || txt.length < 13 || txt.length > 190 || AD_LABEL.test(txt)) continue;
      if (/^(?:https?:\/\/)?(?:www\.)?[^\s]+\.[a-z]{2,}(?:\s*[›\/].*)?$/i.test(txt)) continue;
      const rect = link.getBoundingClientRect();
      const style = getComputedStyle(link);
      const fontSize = parseFloat(style.fontSize) || 12;
      const score = fontSize * 4 + Math.min(txt.length, 90) / 8 +
        (rect.top >= labelTop - 2 ? 9 : -15) -
        (txt.length > 120 ? 12 : 0);
      if (score > bestScore) { best = link; bestScore = score; }
    }
    return best;
  }

  function countProminentLinks(root) {
    let count = 0;
    for (const link of root.querySelectorAll('a[href]')) {
      const text = cleanText(link.textContent);
      // H3 links beneath an H2 are usually ad sitelinks, not new results.
      if (link.closest('h3') && root.querySelector('h2')) continue;
      if (text.length < 18 || text.length > 190 || !safeURL(link)) continue;
      const size = parseFloat(getComputedStyle(link).fontSize) || 0;
      if (size >= 15.5 && ++count > 1) break;
    }
    return count;
  }

  function findCard(label) {
    if (!isLabel(label)) return null;
    const existing = label.closest('[data-qcr-original]');
    if (existing && records.has(existing)) return existing;

    // Prefer a real result boundary. It also includes expanded sitelinks and
    // other promotional widgets so no oversized fragments are left behind.
    const structural = label.closest(
      'article, [data-testid="adResult"], [data-testid="webResult"], .search-result-item--ad, .search-result-item, .result'
    );
    if (structural && !isOwn(structural) && countLabels(structural) === 1 &&
        titleLink(structural, label) &&
        !structural.matches('main,[role="main"],body')) return structural;

    let current = label.parentElement;
    let best = null;
    for (let depth = 0; current && depth < 10; depth++, current = current.parentElement) {
      if (current.matches('main,[role="main"],body,html,nav,header,footer')) break;
      if (isOwn(current)) break;
      const links = current.querySelectorAll('a[href]');
      if (links.length > 28 || countLabels(current) > 1) break;
      // If a generic wrapper contains two prominent result links, it is
      // likely the list containing both an ad and an organic result.
      if (countProminentLinks(current) > 1) break;
      // An ad may contain several H3 sitelinks. Treat a second primary H2
      // as the start of another result, but don't stop merely for sitelinks.
      if (current.querySelectorAll('h2,[role="heading"][aria-level="2"]').length > 1) break;
      if (current.querySelectorAll('h2').length === 0 &&
          current.querySelectorAll('h3,[role="heading"]').length > 1) break;
      // Do not replace a whole search-results region or a sidebar.
      if (current.textContent.length > 2200) break;
      if (links.length && titleLink(current, label)) best = current;
    }
    if (!best) return null;
    if (best.querySelectorAll('a[href]').length > 28 || countLabels(best) !== 1) return null;
    return best;
  }

  function findExclusiveShell(root) {
    // Find the highest wrapper containing ONLY this result. Qwant often keeps
    // margin/gap on a parent wrapper, so hiding just the headline card leaves
    // a large empty slot in the results list.
    let shell = root;
    for (let depth = 0; depth < 7; depth++) {
      const parent = shell.parentElement;
      if (!parent || parent.matches('main,[role="main"],body,html,nav,header,footer,aside')) break;
      if (isOwn(parent) || countLabels(parent) !== 1) break;
      const shellText = cleanText(shell.textContent);
      const parentText = cleanText(parent.textContent);
      // Wrapper-only parents have virtually identical text. A sibling organic
      // result or another independent widget disqualifies the parent.
      if (parentText.length > shellText.length + 55 || parentText.length > 2600) break;
      if (parent.querySelectorAll('h2,[role="heading"][aria-level="2"]').length > 1) break;
      shell = parent;
    }
    return shell;
  }

  function advertiserDomain(root, url) {
    // Ad click URLs commonly point to Bing/Qwant tracking endpoints. Extract
    // the *displayed* advertiser from text nodes, NOT from the link hostname.
    // Reading individual text nodes works when CSS moves the domain visually
    // above the title but its source order comes after it.
    const matches = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node, visits = 0;
    while ((node = walker.nextNode()) && ++visits <= 180) {
      const value = cleanText(node.nodeValue);
      if (!value || value.length > 280) continue;
      const match = value.match(DOMAIN);
      if (match) matches.push(match[1].toLowerCase().replace(/^www\./, ''));
    }
    // If a domain has been separated into multiple markup nodes, innerText
    // is a fallback. Unlike v1.6, do not stop at the headline/title line.
    if (!matches.length) {
      for (const line of (root.innerText || '').split(/\n+/).slice(0, 25)) {
        const match = cleanText(line).match(DOMAIN);
        if (match) matches.push(match[1].toLowerCase().replace(/^www\./, ''));
      }
    }
    const displayed = matches.find(d => d !== 'qwant.com' && d !== 'bing.com');
    if (displayed) return displayed;
    if (matches.length) return matches[0];
    if (!/(?:^|\.)(?:bing|qwant)\.com$/i.test(url.hostname)) {
      return url.hostname.replace(/^www\./, '');
    }
    return 'Sponsored advertiser';
  }

  function metadataFor(root, shell = root) {
    const label = [...root.querySelectorAll('span,small,div,em,b')].find(isLabel);
    if (!label) return null;
    const anchor = titleLink(root, label);
    if (!anchor) return null;
    const url = safeURL(anchor);
    const title = cleanText(anchor.textContent);
    if (!url || title.length < 5 || title.length > 220) return null;
    return { root: shell, anchor, title, domain: advertiserDomain(shell, url), url };
  }

  function findAds() {
    const scope = document.querySelector('main,[role="main"]') || document.body;
    if (!scope) return [];
    const found = new Map();

    for (const label of scope.querySelectorAll('span,small,div,em,b')) {
      if (!isLabel(label)) continue;
      const root = findCard(label);
      if (!root || found.has(root)) continue;
      const shell = findExclusiveShell(root);
      const meta = metadataFor(root, shell);
      if (meta) found.set(shell, meta);
    }

    // Support Qwant variants with a dedicated ad result container.
    // A genuine Ad label is still required to avoid touching organic results.
    for (const selector of ['[data-testid="adResult"]', '.search-result-item--ad', 'article.result']) {
      for (const candidate of scope.querySelectorAll(selector)) {
        if (found.has(candidate) || countLabels(candidate) !== 1) continue;
        const shell = findExclusiveShell(candidate);
        const meta = metadataFor(candidate, shell);
        if (meta) found.set(shell, meta);
      }
    }

    const sorted = [...found.values()].sort((a, b) => {
      if (a.root === b.root) return 0;
      return a.root.compareDocumentPosition(b.root) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
    // Never replace overlapping ancestors/descendants.
    return sorted.filter((item, i) => !sorted.some((other, j) =>
      i !== j && other.root.contains(item.root)));
  }

  function commonAncestor(a, b) {
    const visited = new Set();
    for (let node = a; node; node = node.parentElement) visited.add(node);
    for (let node = b; node; node = node.parentElement) {
      if (visited.has(node)) return node;
    }
    return document.body;
  }

  function organicBetween(before, after) {
    // The ad cards in Qwant are often *not siblings*. Instead of requiring
    // adjacency in the DOM, look for a real organic title between them.
    if (!before || !after || !before.isConnected || !after.isConnected) return true;
    let range;
    try {
      range = document.createRange();
      range.setStartAfter(before);
      range.setEndBefore(after);
    } catch { return true; }
    const ancestor = commonAncestor(before, after);
    const candidates = ancestor.querySelectorAll('h2,h3,[role="heading"],a[href]');
    let visited = 0;
    for (const el of candidates) {
      if (++visited > 500) return true; // Fail closed: don't merge unclear runs.
      if (!range.intersectsNode(el) || isOwn(el)) continue;
      if (el.closest('nav,header,footer,aside')) continue;
      if (el.matches('h2,h3,[role="heading"]')) {
        const link = el.closest('a[href]') || el.querySelector('a[href]');
        if (link && safeURL(link) && cleanText(link.textContent).length >= 12) return true;
      } else {
        const text = cleanText(el.textContent);
        const size = parseFloat(getComputedStyle(el).fontSize) || 0;
        if (size >= 16 && text.length >= 13 && text.length <= 220 && safeURL(el)) return true;
      }
    }
    return false;
  }

  function buildRuns(ads) {
    const runs = [];
    let previous = null;
    for (const item of ads) {
      if (!previous || organicBetween(previous.root, item.root)) runs.push([]);
      runs[runs.length - 1].push(item);
      previous = item;
    }
    return runs;
  }

  function textEl(tag, className, content) {
    const el = document.createElement(tag);
    el.className = className;
    el.textContent = content;
    return el;
  }

  function isLightBackground(el) {
    // Qwant's selected theme can differ from the OS preference, so derive
    // contrast from the page itself rather than prefers-color-scheme.
    for (let node = el?.parentElement; node; node = node.parentElement) {
      const value = getComputedStyle(node).backgroundColor;
      const match = value.match(/^rgba?\(([^)]+)\)$/i);
      if (!match) continue;
      const parts = match[1].split(/[\s,\/]+/).filter(Boolean).map(Number);
      if (parts.length < 3 || parts.some((p,i) => i < 3 && !Number.isFinite(p))) continue;
      if (parts.length > 3 && parts[3] < 0.2) continue;
      const [r,g,b] = parts;
      // Luminance proxy; sufficient for contrast selection.
      return (r * 299 + g * 587 + b * 114) / 1000 > 155;
    }
    return false;
  }

  function showGroup(run) {
    if (!run[0]?.root.isConnected || !run[0].root.parentElement) return;
    const group = document.createElement('section');
    group.className = 'qcr-group';
    if (isLightBackground(run[0].root)) group.classList.add('qcr-light');
    group.dataset.qcrMode = mode;
    group.setAttribute('aria-label', 'Sponsored search results');
    const listId = `qcr-list-${++nextGroupId}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'qcr-toggle';
    button.setAttribute('aria-controls', listId);
    const label = textEl('span', 'qcr-toggle-text', 'Sponsored results');
    label.append(textEl('span', 'qcr-count', `(${run.length})`));
    const chevron = textEl('span', 'qcr-chevron', '▾');
    button.append(label, chevron);
    const list = document.createElement('div');
    list.id = listId;
    list.className = 'qcr-list';

    let collapsed = rememberedCollapse.has(run[0].root)
      ? rememberedCollapse.get(run[0].root)
      : mode === 'collapsed';
    const setCollapsed = (next) => {
      collapsed = Boolean(next);
      list.hidden = collapsed;
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute('aria-label', `${collapsed ? 'Show' : 'Hide'} ${run.length} sponsored result${run.length === 1 ? '' : 's'}`);
      chevron.textContent = collapsed ? '▸' : '▾';
      rememberedCollapse.set(run[0].root, collapsed);
    };
    button.addEventListener('click', () => setCollapsed(!collapsed));

    for (const item of run) {
      const ad = document.createElement('div');
      ad.className = 'qcr-ad';
      const domain = textEl('div', 'qcr-domain', item.domain);
      domain.append(textEl('span', 'qcr-ad-badge', '· Ad'));
      const link = textEl('a', 'qcr-ad-link', item.title);
      link.href = item.url.href;
      link.dataset.qcrAdLink = '1';
      link.dataset.qcrAdvertiser = item.domain;
      link.title = `${item.title} — sponsored by ${item.domain}`;
      ad.append(domain, link);
      list.append(ad);
    }
    group.append(button, list);
    run[0].root.before(group);
    rendered.add(group);
    groupOrigins.set(group, run[0].root);
    setCollapsed(collapsed);
  }

  function unhideOriginals() {
    for (const [root, old] of records) {
      if (root.isConnected) {
        if (old.display) root.style.setProperty('display', old.display, old.priority);
        else root.style.removeProperty('display');
        root.removeAttribute('data-qcr-original');
      }
    }
    records.clear();
    for (const group of rendered) group.remove();
    rendered.clear();
  }

  function render(ads) {
    unhideOriginals();
    // Mark originals as hidden only after enough information was extracted.
    for (const item of ads) {
      const root = item.root;
      if (!root.isConnected) continue;
      records.set(root, {
        display: root.style.getPropertyValue('display'),
        priority: root.style.getPropertyPriority('display')
      });
      root.dataset.qcrOriginal = '1';
      root.style.setProperty('display', 'none', 'important');
    }
    for (const run of buildRuns(ads)) showGroup(run);
  }

  function applyMode(nextMode) {
    if (!MODES.has(nextMode)) return;
    if (mode === nextMode) return;
    mode = nextMode;
    for (const group of rendered) {
      group.dataset.qcrMode = mode;
