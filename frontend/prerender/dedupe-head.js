// Tras el prerender, las páginas del blog heredan de index.html la descripción
// y las etiquetas Open Graph/Twitter de la portada, además de las suyas propias.
// Este script elimina las heredadas para que buscadores e IAs lean solo las del artículo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const blogDir = path.resolve(__dirname, '..', 'dist', 'blog');
const homeHtml = fs.readFileSync(path.resolve(__dirname, '..', 'index.html'), 'utf8');

const homeTags = [
  ...homeHtml.matchAll(/<meta\s+(?:name|property)="(description|og:title|og:description|twitter:title|twitter:description)"\s+content="([^"]*)"/g),
].map(([, key, content]) => ({ key, content }));

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : e.name === 'index.html' ? [full] : [];
  });
}

let changed = 0;
for (const file of walk(blogDir)) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;
  for (const { key, content } of homeTags) {
    const escKey = key.replace(/[.:]/g, (c) => '\\' + c);
    const escContent = content.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\s*<meta\\s+(?:name|property)="${escKey}"\\s+content="${escContent}"\\s*\\/?>`);
    html = html.replace(re, '');
  }
  if (html !== before) {
    fs.writeFileSync(file, html);
    changed += 1;
  }
}
console.log(`dedupe-head: ${changed} páginas del blog limpiadas`);
