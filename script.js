(() => {
  'use strict';

  const SITE = 'Slub';
  const TAGLINE = 'We create dynamic coded experiences';

  const $ = (sel, root = document) => root.querySelector(sel);
  const views = { home: $('#view-home'), case: $('#view-case'), about: $('#view-about') };
  const cardsEl = $('#cards');
  const stackEl = $('#case-stack');
  const footerEl = $('#contact');
  const navLinks = document.querySelectorAll('[data-nav]');

  let projects = [];
  let currentView = null;
  let homeScroll = 0;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Data ---------- */

  async function load() {
    try {
      const res = await fetch('projects.json?v=20261022e');
      if (!res.ok) throw new Error(res.status);
      projects = await res.json();
    } catch (err) {
      console.error(err);
    }
    if (!projects.length) {
      cardsEl.innerHTML = '<p class="load-error">Could not load projects.json. If you opened index.html straight from disk, serve the folder instead (for example <code>python3 -m http.server</code>).</p>';
      return;
    }
    renderGrid();
    renderServices();
    route();
  }

  const firstHeading = (p) => ((p.caseStudyContent || []).find((b) => b.type === 'text' && b.heading) || {}).heading || '';
  const subtitle = (p) => {
    const h = firstHeading(p);
    return h && h !== p.title ? h : [p.category, p.year].filter(Boolean).join(' • ');
  };

  /* ---------- Home: work list ---------- */

  const ARROW = '<svg class="card-arrow" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2.3 7.7l5.1-5.1M2.3 2.1h5.5v5.5" fill="none" stroke="currentColor"/></svg>';
  const SERVICES = ['Creative coding', 'Brand identity', 'Creative direction', 'Art direction', 'Campaigns', 'Illustration & motion'];

  function renderGrid() {
    cardsEl.innerHTML = projects
      .map((p) => `
      <article class="card" data-pid="${esc(p.id)}">
        <a href="#${esc(p.id)}" aria-label="${esc(p.title)}">
          <div class="card-media"><img src="${esc(p.thumbnail)}" alt="" loading="lazy"></div>
          <div class="card-meta">
            <h3 class="card-title">${esc(p.title)}</h3>
            <p class="card-sub">${esc(subtitle(p))}</p>${ARROW}
          </div>
        </a>
      </article>`)
      .join('');
    $('#service-list').innerHTML = SERVICES.map((t, i) => `<li><span class="n">${String(i + 1).padStart(2, '0')}</span><span>${esc(t)}</span></li>`).join('');
    watchWork();
  }
  const renderServices = () => {};

  // The card nearest the middle of the screen is "active": it stays bright and fills the sticky side column.
  const firstBody = (p) => (((p.caseStudyContent || []).find((b) => b.type === 'text' && (b.body || []).length) || {}).body || []).filter((t) => !/^\s*(role:|key results)/i.test(t)).join('\n\n');
  function setWork(card) {
    const p = projects.find((x) => x.id === card.dataset.pid);
    if (!p) return;
    cardsEl.querySelectorAll('.card').forEach((c) => c.classList.toggle('is-active', c === card));
    $('#work-active').textContent = p.title;
    $('#work-desc').textContent = firstBody(p);
    $('#work-thumb').src = p.thumbnail;
    $('#work-sub').textContent = subtitle(p);
    $('#work-tag').textContent = [p.year, p.category].filter(Boolean).join(', ');
  }
  let workTick = false;
  function updateWork() {
    workTick = false;
    if (currentView !== 'home') return;
    const mid = window.innerHeight * 0.5;
    let best = null, bd = Infinity;
    cardsEl.querySelectorAll('.card').forEach((c) => {
      const r = c.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bd) { bd = d; best = c; }
    });
    if (best && !best.classList.contains('is-active')) setWork(best);
  }
  function watchWork() {
    const first = cardsEl.querySelector('.card');
    first && setWork(first);
    window.addEventListener('scroll', () => { if (!workTick) { workTick = true; requestAnimationFrame(updateWork); } }, { passive: true });
  }

  /* ---------- Showreel: the band grows to full screen as you scroll ---------- */

  const reel = $('#reel'), reelVideo = $('#reel-video'), reelTitle = $('#reel-title'), reelIntro = $('#reel-intro');
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  function updateReel() {
    if (currentView !== 'home' || window.innerWidth < 900) return;
    const total = reel.offsetHeight - window.innerHeight;
    const p = clamp01(-reel.getBoundingClientRect().top / total);
    const e = clamp01(p / 0.8);
    const k = e * e * (3 - 2 * e);
    reelVideo.style.clipPath = `inset(${8 * (1 - k)}px ${8 * (1 - k)}px ${72.9 * (1 - k)}% ${8 * (1 - k)}px round ${4 * (1 - k)}px)`;
    reelIntro.style.transform = `translateY(${-k * 60}px)`;
    reelIntro.style.opacity = String(1 - clamp01((p - 0.1) / 0.35));
    reelTitle.style.opacity = String(clamp01((p - 0.8) / 0.2));
  }
  window.addEventListener('scroll', () => requestAnimationFrame(updateReel), { passive: true });
  window.addEventListener('resize', updateReel);

  /* ---------- Case study ---------- */

  const SMALL = new Set(['and', 'of', 'the', 'for', 'to', 'in', '&']);
  const titleCase = (r) => r.replace(/\S+/g, (w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1)));
  const LABELED = /^\s*(role:|key results:?\s)/i;
  const CREDIT = /^\s*(creative direction|art direction|design(ed)? by|production|producer|animation|motion|photography|copy(writing)?|illustration|agency|credits?|team|studio|also on the team)\b[^:]{0,40}:/i;

  function roleRow(text) {
    const kr = /^\s*key results:?\s*/i.test(text);
    const items = kr
      ? text.replace(/^\s*key results:?\s*/i, '').split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)
      : text.replace(/^\s*role:\s*/i, '').split(',').map((x) => x.trim()).filter(Boolean).map(titleCase);
    const row = `<div class="role-row"><div class="role-label">${kr ? 'Key results' : 'Role'}</div><ul class="role-list${kr ? ' body' : ''}">${items.map((r) => `<li>${esc(r)}</li>`).join('')}</ul></div>`;
    return kr ? `<div class="kr-wrap">${row}</div>` : row;
  }

  function textBlock(b) {
    const paras = [].concat(b.body || []);
    const labeled = paras.filter((t) => LABELED.test(t));
    const rest = paras.filter((t) => !LABELED.test(t)).sort((x, y) => CREDIT.test(x) - CREDIT.test(y));
    const row = b.heading || rest.length
      ? `<div class="text-row${b.noLine ? ' no-line' : ''}"><div class="text-left">${b.heading ? `<h3>${esc(b.heading)}</h3>` : ''}</div><div class="text-right">${rest.map((t) => `<p>${esc(t)}</p>`).join('')}</div></div>`
      : '';
    if (!row && !labeled.length) return '';
    return `<div class="block-text">${row}${labeled.map(roleRow).join('')}</div>`;
  }

  function blockHTML(b) {
    switch (b.type) {
      case 'text':
        return textBlock(b);
      case 'image':
        return `<figure class="block-media${b.half ? (b.half === 'left' ? ' half-left' : ' half-right') : ''}"><img src="${esc(b.src)}" alt="${esc(b.alt)}" loading="lazy">${b.caption ? `<figcaption class="figcap">${esc(b.caption)}</figcaption>` : ''}</figure>`;
      case 'vimeo': {
        const id = String(b.id || '').replace(/\D/g, '');
        if (!id) return '';
        const hash = b.hash ? ` data-hash="${esc(b.hash)}"` : '';
        return `<figure class="block-media"><div class="embed" data-vimeo="${id}"${hash} data-title="${esc(b.title || 'Video')}"></div></figure>`;
      }
      case 'sketch':
        return `<figure class="block-media"><div class="embed sketch"><iframe src="${esc(b.src)}" title="${esc(b.title || 'Interactive sketch')}" loading="lazy" allow="autoplay"></iframe><span class="pill">Interactive</span></div></figure>`;
      case 'video':
        return `<figure class="block-media"><video src="${esc(b.src)}"${b.poster ? ` poster="${esc(b.poster)}"` : ''} controls playsinline preload="metadata"></video>${b.caption ? `<figcaption class="figcap">${esc(b.caption)}</figcaption>` : ''}</figure>`;
      default:
        return '';
    }
  }

  const pageTitle = (p) => p.pageTitle || p.title;

  function caseHTML(p) {
    const content = p.caseStudyContent || [];
    const blocks = content.map(blockHTML);
    const heroAt = content.findIndex((b) => b.type === 'image' || b.type === 'vimeo');
    const hero = heroAt >= 0 ? blocks.splice(heroAt, 1)[0] : '';
    const i = projects.indexOf(p);
    const next = projects[(i + 1) % projects.length];
    const meta = [p.category, p.client, p.year].filter(Boolean).map(esc).map((m) => `<span>${m}</span>`).join('');
    return `
      <article class="case" aria-label="${esc(pageTitle(p))}">
        <header class="case-top">
          <div class="case-meta">${meta}</div>
          <h1>${esc(pageTitle(p))}</h1>
          ${p.summary && p.summary.trim() ? `<p class="case-lede">${esc(p.summary)}</p>` : ''}
        </header>
        <div class="case-body">${hero}${blocks.join('')}</div>
        <footer class="case-end">
          <a class="next" href="#${esc(next.id)}">
            <div class="section-label">Next project</div>
            <div class="next-title">${esc(next.title)}</div>
          </a>
          <a class="section-label" href="#work">← All work</a>
        </footer>
      </article>`;
  }

  // Vimeo embeds autoplay muted and loop; the iframe is only created near the viewport.
  const embedObserver = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          embedObserver.unobserve(e.target);
          loadEmbed(e.target);
        });
      }, { rootMargin: '300px 0px' })
    : null;

  function loadEmbed(box) {
    const params = new URLSearchParams({ autoplay: '1', muted: '1', loop: '1', autopause: '0', playsinline: '1', dnt: '1' });
    if (box.dataset.hash) params.set('h', box.dataset.hash);
    const frame = document.createElement('iframe');
    frame.src = `https://player.vimeo.com/video/${box.dataset.vimeo}?${params}`;
    frame.title = box.dataset.title;
    frame.allow = 'autoplay; fullscreen; picture-in-picture';
    frame.allowFullscreen = true;
    box.replaceChildren(frame);
  }

  function showCase(id) {
    const p = projects.find((x) => x.id === id);
    if (!p) { location.hash = ''; return false; }
    stackEl.innerHTML = caseHTML(p);
    stackEl.querySelectorAll('.embed[data-vimeo]').forEach((box) => (embedObserver ? embedObserver.observe(box) : loadEmbed(box)));
    document.title = `${pageTitle(p)} • ${SITE}`;
    return true;
  }

  /* ---------- Routing (hash based) ---------- */
  // ""          -> home      "#about"  -> about
  // "#work"     -> home, scrolled to the work list
  // "#services" / "#contact" -> home / footer anchors
  // "#<id>"     -> case study

  function show(name) {
    if (currentView === 'home') homeScroll = window.scrollY;
    Object.entries(views).forEach(([key, el]) => { el.hidden = key !== name; });
    if (name !== 'case') stackEl.innerHTML = '';
    const navKey = name === 'case' ? 'work' : name === 'home' ? 'work' : name;
    navLinks.forEach((a) => (a.dataset.nav === navKey ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
    currentView = name;
    $('#hb-label').textContent = { home: 'Home', case: 'Work', about: 'About' }[name];
    $('#hb').classList.remove('open');
    requestAnimationFrame(() => { updateReel(); updateWork(); });
  }

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY, behavior: 'smooth' });
  }

  function route() {
    const hash = decodeURIComponent(location.hash.slice(1));
    const returning = currentView === 'case';

    if (hash === 'about') {
      show('about');
      document.title = `About • ${SITE}`;
      window.scrollTo(0, 0);
    } else if (hash === 'contact') {
      if (!currentView || currentView === 'case') show('home');
      document.title = `${SITE} • ${TAGLINE}`;
      scrollToId('contact');
    } else if (hash === 'work' || hash === 'services') {
      if (currentView !== 'home') show('home');
      document.title = `${SITE} • ${TAGLINE}`;
      scrollToId(hash);
    } else if (hash) {
      show('case');
      if (showCase(hash)) window.scrollTo(0, 0);
    } else {
      show('home');
      document.title = `${SITE} • ${TAGLINE}`;
      window.scrollTo(0, returning ? homeScroll : 0);
    }
  }

  // A missing image falls back to a grey placeholder.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG' || img.dataset.fallback) return;
    img.dataset.fallback = '1';
    img.src = 'placeholder.svg';
  }, true);

  /* ---------- Clock + copy email ---------- */

  const clock = $('#clock');
  const tick = () => {
    const d = new Date();
    clock.textContent = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
  };
  tick();
  setInterval(tick, 15000);

  $('#hb-toggle').addEventListener('click', () => {
    const hb = $('#hb');
    $('#hb-toggle').setAttribute('aria-expanded', String(hb.classList.toggle('open')));
  });

  $('#copy-mail').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const done = () => { btn.textContent = 'Copied'; setTimeout(() => (btn.textContent = 'Copy'), 1500); };
    (navigator.clipboard ? navigator.clipboard.writeText($('#mail').textContent) : Promise.reject()).then(done, () => {});
  });

  window.addEventListener('hashchange', route);
  load();
})();
