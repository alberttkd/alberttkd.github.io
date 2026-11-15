// Generador estático del portafolio. Sin dependencias: solo Node.js 18 o superior.
//
//   node build.mjs           genera el sitio en ./dist
//   node build.mjs --serve   genera y sirve ./dist en http://localhost:4173
//
// El contenido vive en ./content (site.json y projects/*.json). Este archivo y
// assets/css/site.css definen la estructura y el diseño; para editar textos,
// proyectos o traducciones no hace falta tocarlos. Ver README.md.

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, cpSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'dist');
const warnings = [];

// ───────────────────────────── carga de contenido ─────────────────────────────
function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch (e) { throw new Error(`No se pudo leer ${path}: ${e.message}`); }
}

const site = readJson(join(ROOT, 'content', 'site.json'));
const LANGS = site.languages;
const BASE = site.baseUrl.replace(/\/?$/, '/');
const projectDir = join(ROOT, 'content', 'projects');
const projects = readdirSync(projectDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f, i) => ({ ...readJson(join(projectDir, f)), _file: f, no: String(i + 1).padStart(2, '0') }));

for (const p of projects) {
  if (!/^[a-z0-9-]+$/.test(p.slug || '')) throw new Error(`${p._file}: "slug" debe usar solo minúsculas, números y guiones.`);
}

// ───────────────────────────── utilidades ─────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Formato mínimo dentro de los textos: **negrita** y `código`.
const fmt = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>');

// Un texto puede ser una cadena (igual en todos los idiomas) o {"es": "...", "en": "...", "de": "..."}.
function tr(value, lang, where) {
  if (value == null) return '';
  if (typeof value !== 'object') return String(value);
  if (value[lang] != null) return String(value[lang]);
  warnings.push(`${where}: falta el idioma "${lang}"`);
  return String(value.en ?? value.de ?? value.es ?? '');
}

// Una imagen puede ser una ruta o {"de": ruta, "en": ruta}; si falta el idioma se usa la inglesa.
function pickSrc(src, lang) {
  if (typeof src === 'string') return { file: src, fallback: false };
  if (src[lang]) return { file: src[lang], fallback: false };
  return { file: src.en ?? Object.values(src)[0], fallback: true };
}

function imageSize(file) {
  const b = readFileSync(join(ROOT, file));
  if (b[0] === 0x89 && b[1] === 0x50) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

function img(file, alt, up, attrs = '') {
  if (!existsSync(join(ROOT, file))) throw new Error(`No existe la imagen ${file}`);
  const s = imageSize(file);
  const dims = s ? ` width="${s.w}" height="${s.h}"` : '';
  return `<img src="${up}${esc(file)}" alt="${esc(alt)}"${dims} loading="lazy" decoding="async"${attrs}>`;
}

function diagram(name, labels, lang, where) {
  let svg = readFileSync(join(ROOT, 'content', 'diagrams', `${name}.svg`), 'utf8');
  return svg.replace(/\{\{(\w+)\}\}/g, (_, k) => esc(tr(labels?.[k], lang, `${where}.labels.${k}`)));
}

// Titulares: cada palabra en su propio <span> para la entrada animada (ver assets/css/motion.css).
const words = (s) => String(s).split(/\s+/).filter(Boolean)
  .map((w, i) => `<span class="w" style="--i:${i}"><span>${esc(w)}</span></span>`).join(' ');

const ui = (key, lang) => tr(site.ui[key], lang, `site.json ui.${key}`);
const hostOf = (url) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

// ───────────────────────────── plantilla común ─────────────────────────────
function shell({ lang, depth, slug, title, description, body, pageClass = '' }) {
  const up = '../'.repeat(depth);
  const pagePath = (l) => `${l}/${slug ? slug + '/' : ''}`;
  const alternates = LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${BASE}${pagePath(l)}">`).join('\n');
  const langNav = LANGS.map((l) => {
    const current = l === lang;
    return `<li><a href="${up}${pagePath(l)}" lang="${l}" hreflang="${l}" data-lang="${l}"${current ? ' aria-current="true"' : ''} title="${esc(tr(site.ui.langNames, l, 'ui.langNames'))}">${l.toUpperCase()}</a></li>`;
  }).join('');
  const p = site.person;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${BASE}${pagePath(lang)}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${BASE}${pagePath(site.defaultLanguage)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${BASE}${pagePath(lang)}">
<meta property="og:locale" content="${lang}">
<meta name="theme-color" content="#F3F0E8">
<link rel="icon" href="${up}assets/favicon.svg" type="image/svg+xml">
<link rel="preload" href="${up}assets/fonts/Archivo-normal-100-900-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${up}assets/fonts/IBMPlexSans-normal-400-latin.woff2" as="font" type="font/woff2" crossorigin>
<script>
/* Activa las animaciones de aparición solo si el navegador puede ejecutarlas; si site.js no llega a cargar, se muestra todo. */
(function (d) {
  if (!('IntersectionObserver' in window)) return;
  d.classList.add('js');
  setTimeout(function () { if (!window.__motionReady) d.classList.remove('js'); }, 2500);
})(document.documentElement);
</script>
<link rel="stylesheet" href="${up}assets/css/site.css">
<link rel="stylesheet" href="${up}assets/css/motion.css">
</head>
<body${pageClass ? ` class="${pageClass}"` : ''}>
<a class="skip" href="#main">${esc(ui('skip', lang))}</a>
<header class="top">
  <div class="top-in">
    <a class="top-name" href="${up}${lang}/">${esc(p.name)}</a>
    <nav class="lang" aria-label="${esc(ui('langLabel', lang))}"><ul>${langNav}</ul></nav>
  </div>
</header>
<div class="page">
<main id="main">
${body}
</main>
<footer class="foot">
  <div class="foot-name">${esc(p.name)}</div>
  <div class="foot-links">
    <a href="mailto:${esc(p.email)}">${esc(p.email)}</a>
    <a href="${esc(p.linkedin)}" rel="me noopener">${esc(hostOf(p.linkedin))}</a>
    <a href="${esc(p.github)}" rel="me noopener">${esc(hostOf(p.github))}</a>
  </div>
  <div class="foot-date">${esc(ui('updated', lang))} ${esc(site.updated)}</div>
</footer>
</div>
<script src="${up}assets/js/site.js" defer></script>
</body>
</html>
`;
}

// ───────────────────────────── vista general ─────────────────────────────
function stripHtml(p, lang, up) {
  const s = p.strip;
  if (!s) return '';
  const where = `${p._file} strip`;
  const visual = s.svg
    ? diagram(s.svg, s.labels, lang, where)
    : img(pickSrc(s.img, lang).file, '', up);
  return `<div class="strip${s.svg ? ' strip-svg' : ''}" aria-hidden="true">${visual}</div>
      <p class="cap">${fmt(tr(s.caption, lang, `${where}.caption`))}</p>`;
}

function overviewPage(lang) {
  const up = '../';
  const pr = site.profile;
  const w = 'site.json profile';
  const p = site.person;
  const facts = pr.facts.map((f, i) => `<dt>${fmt(tr(f.label, lang, `${w}.facts[${i}].label`))}</dt><dd>${fmt(tr(f.value, lang, `${w}.facts[${i}].value`))}</dd>`).join('');
  const contact = `<dt>${esc(ui('contact', lang))}</dt><dd><a href="mailto:${esc(p.email)}">${esc(p.email)}</a><br><a href="${esc(p.linkedin)}" rel="me noopener">${esc(hostOf(p.linkedin))}</a><br><a href="${esc(p.github)}" rel="me noopener">${esc(hostOf(p.github))}</a></dd>`;

  const cards = projects.map((pj) => {
    const f = pj._file;
    return `<li>
    <a class="sheet" href="${pj.slug}/">
      ${stripHtml(pj, lang, up)}
      <h3 class="ttl"><span class="no">${pj.no}</span> ${fmt(tr(pj.title, lang, `${f} title`))}</h3>
      <p class="kind">${fmt(tr(pj.kind, lang, `${f} kind`))}</p>
      <p class="val">${fmt(tr(pj.summary, lang, `${f} summary`))}</p>
      <p class="stk">${fmt(tr(pj.stack, lang, `${f} stack`))}</p>
      <p class="go"><span>${esc(ui('open', lang))}</span><span class="arrow" aria-hidden="true">→</span></p>
    </a>
  </li>`;
  }).join('\n');

  const more = (site.more || []).map((m, i) => `<div class="mo">
    <h3>${fmt(tr(m.title, lang, `site.json more[${i}].title`))}</h3>
    <p class="mo-kind">${fmt(tr(m.kind, lang, `site.json more[${i}].kind`))}</p>
    <p>${fmt(tr(m.text, lang, `site.json more[${i}].text`))}</p>
  </div>`).join('\n');

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Person', name: p.name, url: BASE,
    email: `mailto:${p.email}`, sameAs: [p.linkedin, p.github],
  });

  const body = `<section class="hero">
  <div class="hero-main">
    <p class="eyebrow">${esc(ui('overview', lang))}</p>
    <h1 class="name">${words(p.name)}</h1>
    <p class="headline">${fmt(tr(pr.headline, lang, `${w}.headline`))}</p>
    <p class="profile">${fmt(tr(pr.intro, lang, `${w}.intro`))}</p>
  </div>
  <dl class="facts">${facts}${contact}</dl>
</section>

<section class="index" aria-labelledby="index-title">
  <div class="ix">
    <h2 id="index-title">${esc(ui('indexTitle', lang))}</h2>
    <p>${esc(ui('indexNote', lang).replace('{n}', projects.length))}</p>
  </div>
  <ul class="sheets">
${cards}
  </ul>
</section>
${more ? `
<section class="more" aria-labelledby="more-title">
  <h2 id="more-title" class="more-h">${esc(ui('moreTitle', lang))}</h2>
  <div class="more-grid">
${more}
  </div>
</section>` : ''}
<script type="application/ld+json">${jsonLd}</script>`;

  return shell({
    lang, depth: 1, slug: '', pageClass: 'is-overview',
    title: `${p.name} · ${tr(pr.headline, lang, `${w}.headline`)}`,
    description: tr(pr.intro, lang, `${w}.intro`),
    body,
  });
}

// ───────────────────────────── bloques de la página de proyecto ─────────────────────────────
function figureHtml(fig, lang, up, where, n) {
  const { file, fallback } = pickSrc(fig.src, lang);
  const alt = tr(fig.alt, lang, `${where}.alt`);
  const caption = tr(fig.caption, lang, `${where}.caption`);
  const credit = fig.credit ? tr(fig.credit, lang, `${where}.credit`) : '';
  const note = fallback && lang !== 'en' ? ` <span class="fig-note">${esc(ui('figLabelsEn', lang))}</span>` : '';
  const image = img(file, alt, up);
  const media = fig.wide
    ? `<div class="fig-scroll" tabindex="0" role="group" aria-label="${esc(alt)}">${image}</div>`
    : image;
  return `<figure class="fig${fig.plate ? ' plate' : ''}${fig.wide ? ' wide' : ''}${fig.narrow ? ' narrow' : ''}${fig.full ? ' full' : ''}">
  <div class="fig-media">${media}</div>
  <figcaption><span class="fig-n">${esc(ui('fig', lang))} ${n}</span> ${fmt(caption)}${note}${credit ? ` <span class="fig-credit">${fmt(credit)}</span>` : ''}</figcaption>
</figure>`;
}

function blockHtml(b, lang, up, where, counter) {
  const title = b.title ? `<h2>${fmt(tr(b.title, lang, `${where}.title`))}</h2>` : '';
  const intro = b.intro ? `<p class="block-intro">${fmt(tr(b.intro, lang, `${where}.intro`))}</p>` : '';
  switch (b.type) {
    case 'figure':
      return `<section class="block">${title}${intro}${figureHtml(b, lang, up, where, ++counter.n)}</section>`;
    case 'figures':
      return `<section class="block">${title}${intro}<div class="fig-grid">${b.items.map((f, i) => figureHtml(f, lang, up, `${where}.items[${i}]`, ++counter.n)).join('\n')}</div></section>`;
    case 'steps':
      return `<section class="block">${title}${intro}<ol class="steps">${b.items.map((s, i) => `<li>
  <h3>${fmt(tr(s.title, lang, `${where}.items[${i}].title`))}</h3>
  <p>${fmt(tr(s.text, lang, `${where}.items[${i}].text`))}</p>
</li>`).join('')}</ol></section>`;
    case 'lists':
      return `<section class="block lists">${b.items.map((l, i) => `<div class="list">
  <h2>${fmt(tr(l.title, lang, `${where}.items[${i}].title`))}</h2>
  <ul>${l.items.map((x, j) => `<li>${fmt(tr(x, lang, `${where}.items[${i}].items[${j}]`))}</li>`).join('')}</ul>
</div>`).join('\n')}</section>`;
    case 'table': {
      const head = b.head.map((h, i) => `<th scope="col"${i ? ' class="r"' : ''}>${fmt(tr(h, lang, `${where}.head[${i}]`))}</th>`).join('');
      const rows = b.rows.map((r, i) => `<tr${b.emphasis === i ? ' class="em"' : ''}>${r.map((c, j) => j
        ? `<td class="r">${fmt(tr(c, lang, `${where}.rows[${i}][${j}]`))}</td>`
        : `<th scope="row">${fmt(tr(c, lang, `${where}.rows[${i}][${j}]`))}</th>`).join('')}</tr>`).join('\n');
      const note = b.note ? `<p class="table-note">${fmt(tr(b.note, lang, `${where}.note`))}</p>` : '';
      return `<section class="block">${title}${intro}<div class="table-wrap" tabindex="0" role="group" aria-label="${esc(tr(b.title, lang, where))}"><table${b.stack ? ' class="stack"' : ''}><thead><tr>${head}</tr></thead><tbody>
${rows}
</tbody></table></div>${note}</section>`;
    }
    case 'text':
      return `<section class="block">${title}${intro}${(b.paragraphs || []).map((x, i) => `<p class="prose">${fmt(tr(x, lang, `${where}.paragraphs[${i}]`))}</p>`).join('')}</section>`;
    default:
      throw new Error(`${where}: tipo de bloque desconocido "${b.type}"`);
  }
}

function projectPage(pj, index, lang) {
  const up = '../../';
  const f = pj._file;
  const T = (v, k) => tr(v, lang, `${f} ${k}`);
  const counter = { n: 0 };

  const metric = pj.metric ? `<div class="metric">
    <p class="num">${fmt(T(pj.metric.value, 'metric.value'))}${pj.metric.unit ? `<span class="unit">${fmt(T(pj.metric.unit, 'metric.unit'))}</span>` : ''}</p>
    <p class="metric-label">${fmt(T(pj.metric.label, 'metric.label'))}</p>
    ${pj.metric.note ? `<p class="metric-note">${fmt(T(pj.metric.note, 'metric.note'))}</p>` : ''}
  </div>` : '';
  const facts = (pj.facts || []).length ? `<ul class="kpis">${pj.facts.map((k, i) => `<li>
    <p class="kpi">${fmt(T(k.value, `facts[${i}].value`))}${k.unit ? `<span class="unit">${fmt(T(k.unit, `facts[${i}].unit`))}</span>` : ''}</p>
    <p>${fmt(T(k.label, `facts[${i}].label`))}</p>
  </li>`).join('')}</ul>` : '';

  const story = pj.story ? `<section class="story" aria-label="${esc(ui('problem', lang))}, ${esc(ui('approach', lang))}, ${esc(ui('result', lang))}">
  ${['problem', 'approach', 'result'].map((k) => `<div class="story-col">
    <h2>${esc(ui(k, lang))}</h2>
    <p>${fmt(T(pj.story[k], `story.${k}`))}</p>
  </div>`).join('\n  ')}
</section>` : '';

  const repoRow = pj.repo
    ? `<dt>${esc(ui('repo', lang))}</dt><dd><a class="repo" href="${esc(pj.repo)}" rel="noopener">${esc(hostOf(pj.repo))}</a><br><span class="muted">${esc(ui('repoPublic', lang))}</span></dd>`
    : (pj.repoNote ? `<dt>${esc(ui('repo', lang))}</dt><dd>${fmt(T(pj.repoNote, 'repoNote'))}</dd>` : '');
  const meta = `<dl class="meta">${(pj.meta || []).map((m, i) => `<dt>${fmt(T(m.label, `meta[${i}].label`))}</dt><dd>${fmt(T(m.value, `meta[${i}].value`))}</dd>`).join('')}${repoRow}</dl>`;

  const blocks = (pj.blocks || []).map((b, i) => blockHtml(b, lang, up, `${f} blocks[${i}]`, counter)).join('\n');
  const credits = pj.credits ? `<section class="block credits"><h2>${esc(ui('credits', lang))}</h2><p>${fmt(T(pj.credits, 'credits'))}</p></section>` : '';

  const prev = projects[index - 1];
  const next = projects[index + 1];
  const pagerLink = (p, cls, label, arrowFirst) => p
    ? `<a class="${cls}" href="../${p.slug}/"><span class="pager-label">${arrowFirst ? '← ' : ''}${esc(label)}${arrowFirst ? '' : ' →'}</span><span class="pager-title"><span class="no">${p.no}</span> ${fmt(tr(p.title, lang, `${p._file} title`))}</span></a>`
    : `<span class="${cls}"></span>`;

  const body = `<article class="proj">
<nav class="crumb" aria-label="${esc(ui('breadcrumb', lang))}">
  <a href="../"><span aria-hidden="true">← </span>${esc(ui('back', lang))}</a>
  <span class="crumb-pos">${esc(ui('sheet', lang))} ${pj.no}/${String(projects.length).padStart(2, '0')}</span>
</nav>
<header class="proj-head">
  <p class="eyebrow"><span class="no">${pj.no}</span> ${fmt(T(pj.title, 'title'))} <span class="sep">/</span> ${fmt(T(pj.kind, 'kind'))}</p>
  <h1>${words(T(pj.headline, 'headline'))}</h1>
  <p class="lead">${fmt(T(pj.lead, 'lead'))}</p>
  ${pj.notice ? `<p class="notice">${fmt(T(pj.notice, 'notice'))}</p>` : ''}
</header>
<section class="key">
  ${metric}
  ${facts}
</section>
${story}
<section class="block meta-block" aria-label="${esc(ui('metaLabel', lang))}">
${meta}
</section>
${blocks}
${credits}
</article>
<nav class="pager" aria-label="${esc(ui('pagerLabel', lang))}">
  ${pagerLink(prev, 'pager-prev', ui('prev', lang), true)}
  <a class="pager-home" href="../">${esc(ui('back', lang))}</a>
  ${pagerLink(next, 'pager-next', ui('next', lang), false)}
</nav>`;

  return shell({
    lang, depth: 2, slug: pj.slug, pageClass: 'is-project',
    title: `${T(pj.title, 'title')} · ${site.person.name}`,
    description: T(pj.summary, 'summary'),
    body,
  });
}

// ───────────────────────────── páginas auxiliares ─────────────────────────────
function rootPage() {
  const def = site.defaultLanguage;
  const links = LANGS.map((l) => `<li><a href="${l}/" lang="${l}" hreflang="${l}">${esc(tr(site.ui.langNames, l, 'ui.langNames'))}</a></li>`).join('');
  return `<!doctype html>
<html lang="${def}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(site.person.name)}</title>
<meta name="description" content="${esc(tr(site.profile.intro, def, 'profile.intro'))}">
${LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${BASE}${l}/">`).join('\n')}
<link rel="alternate" hreflang="x-default" href="${BASE}${def}/">
<script>
(function () {
  var langs = ${JSON.stringify(LANGS)}, pick = null;
  try { pick = localStorage.getItem('lang'); } catch (e) {}
  if (langs.indexOf(pick) < 0) {
    pick = null;
    var nav = navigator.languages || [navigator.language || ''];
    for (var i = 0; i < nav.length && !pick; i++) {
      var c = String(nav[i]).slice(0, 2).toLowerCase();
      if (langs.indexOf(c) >= 0) pick = c;
    }
  }
  location.replace((pick || ${JSON.stringify(def)}) + '/');
})();
</script>
<noscript><meta http-equiv="refresh" content="0; url=${def}/"></noscript>
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="assets/css/site.css">
</head>
<body>
<div class="page"><main class="gate">
  <h1 class="name">${esc(site.person.name)}</h1>
  <ul class="gate-langs">${links}</ul>
</main></div>
</body>
</html>
`;
}

function notFoundPage() {
  const basePath = new URL(BASE).pathname;
  const links = LANGS.map((l) => `<li><a href="${basePath}${l}/" lang="${l}" hreflang="${l}">${esc(tr(site.ui.notFound, l, 'ui.notFound'))}</a></li>`).join('');
  return `<!doctype html>
<html lang="${site.defaultLanguage}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>404 · ${esc(site.person.name)}</title>
<link rel="stylesheet" href="${basePath}assets/css/site.css">
</head>
<body>
<div class="page"><main class="gate">
  <p class="eyebrow">404</p>
  <h1 class="name">${esc(site.person.name)}</h1>
  <ul class="gate-langs">${links}</ul>
</main></div>
</body>
</html>
`;
}

function sitemap() {
  const urls = [];
  for (const l of LANGS) {
    urls.push(`${BASE}${l}/`);
    for (const p of projects) urls.push(`${BASE}${l}/${p.slug}/`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>
`;
}

// ───────────────────────────── escritura ─────────────────────────────
function write(rel, content) {
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function build() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  cpSync(join(ROOT, 'assets'), join(OUT, 'assets'), { recursive: true });
  for (const lang of LANGS) {
    write(`${lang}/index.html`, overviewPage(lang));
    projects.forEach((p, i) => write(`${lang}/${p.slug}/index.html`, projectPage(p, i, lang)));
  }
  write('index.html', rootPage());
  write('404.html', notFoundPage());
  write('sitemap.xml', sitemap());
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${BASE}sitemap.xml\n`);
  write('.nojekyll', '');
  const unique = [...new Set(warnings)];
  if (unique.length) {
    console.warn(`\nAvisos (${unique.length}): textos sin traducir, se usó otro idioma como reserva`);
    for (const w of unique) console.warn('  - ' + w);
  }
  console.log(`\nSitio generado en dist/: ${projects.length} proyectos × ${LANGS.length} idiomas (${LANGS.join(', ')}).`);
}

function serve(port = 4173) {
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };
  createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = join(OUT, p);
    if (existsSync(file) && statSync(file).isDirectory()) {
      if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
      file = join(file, 'index.html');
    }
    if (!file.startsWith(OUT) || !existsSync(file)) {
      res.writeHead(404, { 'Content-Type': types['.html'] });
      return res.end(readFileSync(join(OUT, '404.html')));
    }
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(readFileSync(file));
  }).listen(port, () => console.log(`Vista previa: http://localhost:${port}/  (Ctrl+C para salir)`));
}

build();
if (process.argv.includes('--serve')) serve(Number(process.env.PORT) || 4173);
