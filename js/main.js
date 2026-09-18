/* AMEDIAZ GROUP — comportements du site
   Principe : le site reste entièrement lisible sans JavaScript.
   Ce fichier ajoute : courbes de niveau, header, menu, révélations, compteurs,
   accordéon des expertises, cycle de vie, plaque des secteurs. */
(() => {
  'use strict';

  const root = document.documentElement;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktopMQ = window.matchMedia('(min-width: 1024px)');

  root.classList.add('js-ready');

  /* ---------- 1. Courbes de niveau ----------
     Isolignes générées de façon déterministe (graine fixe) : rendu identique à chaque visite.
     Décor uniquement — aucune valeur topographique réelle n'est représentée. */
  const SVG_NS = 'http://www.w3.org/2000/svg';

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildContours(svg) {
    const num = (key, fallback) => (svg.dataset[key] !== undefined ? Number(svg.dataset[key]) : fallback);
    const count = num('levels', 12);
    const cx = num('cx', 800), cy = num('cy', 450);
    const r0 = num('r0', 40), r1 = num('r1', 600);
    const major = num('major', 5);
    const sx = num('sx', 1), sy = num('sy', 1);
    const rand = mulberry32(num('seed', 1));

    const p1 = rand() * Math.PI * 2, p2 = rand() * Math.PI * 2, p3 = rand() * Math.PI * 2;
    const a1 = 0.10 + rand() * 0.06, a2 = 0.05 + rand() * 0.04, a3 = 0.025 + rand() * 0.02;
    const steps = 96;
    const frag = document.createDocumentFragment();

    for (let i = 0; i < count; i++) {
      const t = count > 1 ? i / (count - 1) : 0;
      const radius = r0 + (r1 - r0) * Math.pow(t, 1.15);
      let d = '';
      for (let k = 0; k < steps; k++) {
        const th = (k / steps) * Math.PI * 2;
        // Dérive de phase très faible d'un niveau à l'autre : les courbes ne se croisent jamais.
        const wobble = 1
          + a1 * Math.sin(2 * th + p1 + i * 0.07)
          + a2 * Math.sin(3 * th + p2 - i * 0.06)
          + a3 * Math.sin(5 * th + p3 + i * 0.09);
        const x = cx + Math.cos(th) * radius * wobble * sx;
        const y = cy + Math.sin(th) * radius * wobble * sy;
        d += (k ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
      }
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d + 'Z');
      path.setAttribute('pathLength', '1');
      path.setAttribute('class', 'contour' + (i % major === major - 1 ? ' contour--major' : ''));
      path.style.setProperty('--i', i);
      frag.appendChild(path);
    }
    svg.appendChild(frag);
  }

  $$('svg[data-contours]').forEach(buildContours);

  /* ---------- 2. Header, parallaxe légère du hero, lien de navigation actif ---------- */
  const header = $('#header');
  const hero = $('.hero');
  const navLinks = $$('.nav a[href^="#"]');
  const spyTargets = navLinks.map((a) => ({ a, el: $(a.getAttribute('href')) })).filter((t) => t.el);
  let ticking = false;

  function onScroll() {
    const y = window.scrollY;
    header.classList.toggle('is-solid', y > 8 || menuIsOpen());

    if (hero && !reduceMotion && desktopMQ.matches && y < window.innerHeight) {
      hero.style.setProperty('--py', Math.min(y, 600) * 0.04 + 'px');   // courbes : 24 px maximum
      hero.style.setProperty('--pm', Math.min(y, 600) * -0.02 + 'px');  // monogramme : 12 px en sens inverse
    }

    // Lien actif : la section qui coupe la ligne située à 35 % de la hauteur d'écran
    const anchor = window.innerHeight * 0.35;
    spyTargets.forEach(({ a, el }) => {
      const r = el.getBoundingClientRect();
      const on = r.top <= anchor && r.bottom > anchor;
      if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
    });

    if (!desktopMQ.matches) updateCycleMobile();
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  window.addEventListener('resize', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } });

  /* ---------- 3. Menu mobile ---------- */
  const burger = $('.burger');
  const menu = $('#menu');
  const menuIsOpen = () => menu.classList.contains('is-open');

  function setMenu(open) {
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    menu.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    header.classList.toggle('is-solid', open || window.scrollY > 8);
    if (open) {
      // Le menu passe de visibility:hidden à visible : le focus échoue tant que le lien n'est pas rendu,
      // on réessaie donc brièvement (max ~250 ms).
      const first = $('a', menu);
      const tryFocus = (n) => {
        if (!first || !menuIsOpen()) return;
        first.focus();
        if (document.activeElement !== first && n < 5) setTimeout(() => tryFocus(n + 1), 50);
      };
      setTimeout(() => tryFocus(0), 50);
    }
  }
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuIsOpen()) { setMenu(false); burger.focus(); }
  });
  window.matchMedia('(min-width: 1100px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  /* ---------- 4. Hero : lancement de la séquence de construction ---------- */
  if (hero) {
    requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('is-in')));
  }

  /* ---------- 5. Révélation au défilement + compteurs ---------- */
  function countUp(el) {
    const end = Number(el.dataset.count);
    if (reduceMotion || !Number.isFinite(end)) return;
    const duration = 900;
    const t0 = performance.now();
    el.textContent = '0';
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick); else el.textContent = String(end);
    };
    requestAnimationFrame(tick);
  }

  function observe(elements, options, onEnter) {
    if (!elements.length) return;
    if (!('IntersectionObserver' in window)) { elements.forEach(onEnter); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        onEnter(entry.target);
        io.unobserve(entry.target);
      });
    }, options);
    elements.forEach((el) => io.observe(el));
  }

  observe($$('[data-reveal], [data-io]'), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }, (el) => {
    el.classList.add('is-in');
    $$('[data-count]', el).forEach(countUp);
  });
  // Les compteurs qui ne sont dans aucun bloc observé (BIM & Digital)
  $$('[data-count]').forEach((el) => {
    if (el.closest('[data-reveal], [data-io]')) return;
    observe([el], { threshold: 0.6 }, countUp);
  });

  /* ---------- 6. Expertises : accordéon (une seule ligne ouverte) ---------- */
  const xps = $$('.xp');
  const xpIndex = $$('.xps__index button');

  function setXp(index) {
    xps.forEach((xp, k) => {
      const on = k === index;
      xp.classList.toggle('is-open', on);
      $('.xp__btn', xp).setAttribute('aria-expanded', String(on));
    });
    xpIndex.forEach((b, k) => b.classList.toggle('is-active', k === index));
  }
  xps.forEach((xp, i) => {
    $('.xp__btn', xp).addEventListener('click', () => setXp(xp.classList.contains('is-open') ? -1 : i));
  });
  xpIndex.forEach((b, i) => {
    b.addEventListener('click', () => {
      setXp(i);
      xps[i].scrollIntoView({ block: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  /* ---------- 7. Cycle de vie : tracé, stations, légende ---------- */
  const cyBox = $('#cyBox');
  const stations = cyBox ? $$('.cy__st', cyBox) : [];
  const cyCols = cyBox ? $$('.cy__cols span', cyBox) : [];
  const cyRows = cyBox ? $$('.cy__rows span', cyBox) : [];
  const caption = $('#cyCaption');
  const captionHint = caption ? caption.innerHTML : '';

  function setCaption(li) {
    if (!caption) return;
    caption.textContent = '';
    if (!li) { caption.innerHTML = captionHint; return; }
    const mk = (cls, text) => { const s = document.createElement('span'); s.className = cls; s.textContent = text; return s; };
    caption.append(
      mk('cy__cnum', $('.cy__num', li).textContent),
      mk('cy__ctitle', $('.cy__title', li).textContent),
      mk('cy__cdesc', $('.cy__desc', li).textContent)
    );
    caption.classList.remove('is-in-caption');
    void caption.offsetWidth;
    caption.classList.add('is-in-caption');
  }

  function setHot(li) {
    stations.forEach((s) => s.classList.toggle('is-hot', s === li));
    cyCols.forEach((c) => c.classList.remove('is-hot'));
    cyRows.forEach((r) => r.classList.remove('is-hot'));
    if (li) {
      const i = stations.indexOf(li);
      const y = Number(String(li.style.getPropertyValue('--y')).trim());
      if (cyCols[i]) cyCols[i].classList.add('is-hot');
      if (cyRows[Math.min(4, Math.floor(y / 20))]) cyRows[Math.min(4, Math.floor(y / 20))].classList.add('is-hot');
    }
    if (desktopMQ.matches) setCaption(li);
  }

  stations.forEach((li) => {
    const node = $('.cy__node', li);
    li.addEventListener('mouseenter', () => setHot(li));
    li.addEventListener('mouseleave', () => setHot(null));
    node.addEventListener('focus', () => setHot(li));
    node.addEventListener('blur', () => setHot(null));
    node.addEventListener('click', () => setHot(li));   // tactile
  });

  function updateCycleMobile() {
    if (!cyBox || desktopMQ.matches || reduceMotion) return;
    const r = cyBox.getBoundingClientRect();
    const anchor = window.innerHeight * 0.62;
    cyBox.style.setProperty('--fill', clamp((anchor - r.top) / r.height, 0, 1).toFixed(3));
    stations.forEach((s) => {
      const n = $('.cy__node', s).getBoundingClientRect();
      s.classList.toggle('is-on', n.top + n.height / 2 < anchor);
    });
  }

  if (cyBox) {
    const activateAll = () => stations.forEach((s) => s.classList.add('is-on'));

    if (reduceMotion || !('IntersectionObserver' in window)) {
      cyBox.classList.add('is-drawn');
      activateAll();
    } else {
      // Bureau : le tracé se dessine en ~2 s, chaque station s'active quand il l'atteint.
      observe([cyBox], { threshold: 0.25 }, () => {
        cyBox.classList.add('is-drawn');
        if (!desktopMQ.matches) return;
        stations.forEach((s) => {
          const x = Number(String(s.style.getPropertyValue('--x')).trim());
          setTimeout(() => s.classList.add('is-on'), 150 + x * 20);
        });
      });
      updateCycleMobile();
    }

    desktopMQ.addEventListener('change', (e) => {
      if (e.matches) { setHot(null); if (cyBox.classList.contains('is-drawn')) activateAll(); }
      else updateCycleMobile();
    });
  }

  /* ---------- 8. Secteurs : la plaque technique suit la ligne survolée ---------- */
  const sxList = $('.sx__list');
  if (sxList) {
    const rows = $$('.sx__row', sxList);
    const texs = $$('.tex');
    const cap = $('#sxCap');
    const TEX_LABEL = { parcel: 'Parcellaire', contours: 'Courbes de niveau', network: 'Réseau', grid: 'Trame plan' };
    let leaveTimer = 0;

    const setTex = (row) => {
      const key = row ? row.dataset.tex : 'parcel';
      texs.forEach((t) => t.classList.toggle('is-on', t.dataset.tex === key));
      if (cap) cap.textContent = row ? row.dataset.name.replace(/&amp;/g, '&') + ' — ' + TEX_LABEL[key] : TEX_LABEL.parcel;
    };
    const hot = (row) => {
      clearTimeout(leaveTimer);
      rows.forEach((r) => r.classList.toggle('is-hot', r === row));
      sxList.classList.add('has-hot');
      setTex(row);
    };
    const cool = () => {
      leaveTimer = setTimeout(() => {
        rows.forEach((r) => r.classList.remove('is-hot'));
        sxList.classList.remove('has-hot');
        setTex(null);
      }, 120);
    };
    rows.forEach((row) => {
      row.addEventListener('mouseenter', () => hot(row));
      row.addEventListener('mouseleave', cool);
      row.addEventListener('focus', () => hot(row));
      row.addEventListener('blur', cool);
    });
  }

  /* ---------- 9. Références : la ligne survolée met son visuel en avant ---------- */
  const rfList = $('.rf__list');
  if (rfList) {
    const rows = $$('.rf__row', rfList);
    let leaveTimer = 0;
    const hot = (row) => {
      clearTimeout(leaveTimer);
      rows.forEach((r) => r.classList.toggle('is-hot', r === row));
      rfList.classList.add('has-hot');
    };
    const cool = () => {
      leaveTimer = setTimeout(() => {
        rows.forEach((r) => r.classList.remove('is-hot'));
        rfList.classList.remove('has-hot');
      }, 120);
    };
    rows.forEach((row) => {
      row.addEventListener('mouseenter', () => hot(row));
      row.addEventListener('mouseleave', cool);
      row.addEventListener('focus', () => hot(row));
      row.addEventListener('blur', cool);
    });
  }

  onScroll();
})();
