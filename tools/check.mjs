// Comprueba el sitio generado en ./dist: enlaces internos, imágenes, idioma y textos alternativos.
//   node tools/check.mjs
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const pages = [];
(function walk(d) {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.html')) pages.push(p);
  }
})(OUT);

const errors = [];
let links = 0, images = 0;
for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const name = relative(OUT, page).split(sep).join('/');
  const lang = (html.match(/<html lang="([a-z]{2})"/) || [])[1];
  if (!lang) errors.push(`${name}: falta el atributo lang`);
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${name}: falta <title>`);
  if (name !== '404.html' && (html.match(/<h1[\s>]/g) || []).length !== 1) errors.push(`${name}: debe tener exactamente un <h1>`);
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    images++;
    if (!/\balt="/.test(m[0])) errors.push(`${name}: imagen sin atributo alt`);
  }
  for (const m of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    let url = m[1];
    if (/^(https?:|mailto:|#|data:)/.test(url)) continue;
    links++;
    url = url.split('#')[0].split('?')[0];
    let target = url.startsWith('/') ? join(OUT, url) : join(dirname(page), url);
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, 'index.html');
    if (!existsSync(target)) errors.push(`${name}: enlace roto → ${m[1]}`);
  }
}
if (errors.length) {
  console.error(`${errors.length} problema(s):`);
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
console.log(`Correcto: ${pages.length} páginas, ${links} enlaces internos y ${images} imágenes comprobados.`);
