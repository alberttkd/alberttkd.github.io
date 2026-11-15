// Genera la imagen de vista previa para enlaces (LinkedIn, WhatsApp, etc.): 1200 × 627 px,
// una por idioma, en assets/img/og-<idioma>.png. Usa el contenido de content/ y el mismo CSS del sitio.
//
//   node tools/og-image.mjs
//
// Necesita Microsoft Edge o Google Chrome instalados (se usan sin ventana). Si están en otra ruta:
//   set BROWSER_PATH=C:\ruta\al\navegador.exe   y volver a ejecutar.
// Solo hace falta repetirlo si cambian el nombre, el titular o los proyectos.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const W = 1200, H = 627;
const site = JSON.parse(readFileSync(join(ROOT, 'content', 'site.json'), 'utf8'));
const projects = readdirSync(join(ROOT, 'content', 'projects')).filter((f) => f.endsWith('.json')).sort()
  .map((f) => JSON.parse(readFileSync(join(ROOT, 'content', 'projects', f), 'utf8')));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tr = (v, lang) => (v == null ? '' : typeof v !== 'object' ? String(v) : String(v[lang] ?? v.en ?? Object.values(v)[0]));

function strip(p, lang) {
  const s = p.strip || {};
  if (s.svg) {
    return readFileSync(join(ROOT, 'content', 'diagrams', `${s.svg}.svg`), 'utf8')
      .replace(/\{\{(\w+)\}\}/g, (_, k) => esc(tr(s.labels?.[k], lang)));
  }
  const src = typeof s.img === 'string' ? s.img : (s.img?.[lang] ?? s.img?.en);
  return src ? `<img src="${esc(src)}" alt="">` : '';
}

function html(lang) {
  const tiles = projects.map((p, i) => `<div class="t">
    <div class="s">${strip(p, lang)}</div>
    <p><b>${String(i + 1).padStart(2, '0')}</b>${esc(tr(p.title, lang))}</p>
  </div>`).join('\n');
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="assets/css/site.css">
<style>
  html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:var(--paper)}
  .frame{position:absolute;inset:24px;border:1px solid var(--ink)}
  .frame::before{content:"";position:absolute;inset:-7px;border:1px solid var(--rule)}
  .frame::after{content:"";position:absolute;inset:0;
    background:repeating-linear-gradient(90deg,var(--ink) 0 1px,transparent 1px 16.6667%) left top/100% 9px no-repeat,
               repeating-linear-gradient(90deg,var(--ink) 0 1px,transparent 1px 16.6667%) left bottom/100% 9px no-repeat}
  .in{position:absolute;inset:24px;padding:38px 48px 0}
  .og-top{display:flex;justify-content:space-between;align-items:baseline;font-family:var(--f-mono);font-size:17px;color:var(--ink-3)}
  .og-top span:first-child{letter-spacing:.16em;text-transform:uppercase}
  .og-top span:last-child{color:var(--ink);letter-spacing:.02em}
  h1{font-family:var(--f-display);font-stretch:72%;font-weight:780;font-size:118px;line-height:.9;letter-spacing:-.014em;
    margin:30px 0 0;max-width:900px;text-wrap:balance}
  .hl{font-family:var(--f-display);font-stretch:88%;font-weight:560;font-size:32px;line-height:1.2;color:var(--ink-2);margin:22px 0 0}
  .idx{position:absolute;left:48px;right:48px;bottom:34px;display:grid;grid-template-columns:repeat(${projects.length},1fr);gap:16px;
    border-top:1px solid var(--ink);padding-top:16px}
  .t .s{height:56px;background:var(--paper-2);overflow:hidden}
  .t .s img{width:100%;height:100%;object-fit:cover;filter:grayscale(1) contrast(1.08);mix-blend-mode:multiply}
  .t .s svg{width:100%;height:100%}
  .t p{margin:9px 0 0;height:2.2em;overflow:hidden;font-family:var(--f-display);font-stretch:78%;font-weight:720;font-size:17px;line-height:1.1}
  .t b{font-family:var(--f-mono);font-stretch:100%;font-weight:500;font-size:13px;color:var(--signal-ink);margin-right:6px}
</style>
</head>
<body>
<div class="frame"></div>
<div class="in">
  <div class="og-top"><span>${esc(tr(site.ui.overview, lang))}</span><span>${esc(site.baseUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</span></div>
  <h1>${esc(site.person.name)}</h1>
  <p class="hl">${esc(tr(site.profile.headline, lang))}</p>
  <div class="idx">
${tiles}
  </div>
</div>
</body>
</html>`;
}

// ---------- navegador sin ventana, controlado por el protocolo DevTools ----------
const candidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].filter(Boolean);
const browserPath = candidates.find((p) => existsSync(p));
if (!browserPath) {
  console.error('No se encontró Edge ni Chrome. Indica la ruta con la variable BROWSER_PATH.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = mkdtempSync(join(tmpdir(), 'og-'));
const PORT = 9341;
const browser = spawn(browserPath, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--hide-scrollbars', '--no-first-run', '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });

const temps = [];
try {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((t) => t.type === 'page'); } catch {}
  }
  if (!target) throw new Error('El navegador no respondió.');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });

  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  for (const lang of site.languages) {
    const tmp = join(ROOT, `.og-${lang}.html`);
    temps.push(tmp);
    writeFileSync(tmp, html(lang));
    await send('Page.navigate', { url: pathToFileURL(tmp).href });
    await sleep(500);
    await send('Runtime.evaluate', { expression: 'document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.decode().catch(() => 0))))', awaitPromise: true });
    await sleep(300);
    const shot = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: W, height: H, scale: 1 } });
    const out = join(ROOT, 'assets', 'img', `og-${lang}.png`);
    writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
    console.log(`assets/img/og-${lang}.png  (${W} × ${H})`);
  }
  ws.close();
} finally {
  browser.kill();
  for (const t of temps) rmSync(t, { force: true });
  await sleep(400);
  try { rmSync(profile, { recursive: true, force: true }); } catch {}
}
