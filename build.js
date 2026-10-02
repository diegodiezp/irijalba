// Carlos Irijalba website builder.
// Reads /content, writes a static site to /dist. Run: npm run build
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = __dirname;
const CONTENT = path.join(ROOT, 'content');
const DIST = path.join(ROOT, 'dist');
const WIDTHS = [800, 1600, 2400];

// ---------- tiny parsers (no dependencies) ----------
function parseFile(file) {
  const raw = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  const data = {};
  let body = raw;
  if (m) {
    body = m[2];
    let listKey = null;
    for (const line of m[1].split('\n')) {
      const item = line.match(/^\s+-\s+(.*)$/);
      if (item && listKey) { data[listKey].push(item[1].trim()); continue; }
      const kv = line.match(/^([A-Za-z_]+):\s*(.*)$/);
      if (!kv) continue;
      const [, k, v] = kv;
      if (v === '') { data[k] = []; listKey = k; } else { data[k] = v.trim(); listKey = null; }
    }
    for (const k in data) if (Array.isArray(data[k]) && data[k].length === 0) data[k] = '';
  }
  return { data, body: body.trim() };
}
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function inline(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}
function markdown(md) {
  if (!md) return '';
  return md.split(/\n{2,}/).map(block => {
    const b = block.trim();
    if (/^(-{3,}|·{2,})$/.test(b)) return '<hr>';
    const h = b.match(/^(#{1,3})\s+(.*)$/);
    if (h) return `<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`;
    if (/^[-*]\s/.test(b)) return '<ul>' + b.split('\n').map(l => `<li>${inline(l.replace(/^[-*]\s+/, ''))}</li>`).join('') + '</ul>';
    return `<p>${inline(b).replace(/\n/g, '<br>')}</p>`;
  }).join('\n');
}
const truthy = v => /^(true|yes|sí|si)$/i.test(String(v || ''));

// ---------- images ----------
const imgCache = {};
async function processImage(srcFile, outBase) {
  // outBase like "work/pannotia/01" -> dist/work/pannotia/01-800.webp ...
  if (imgCache[srcFile]) return imgCache[srcFile];
  const meta = await sharp(srcFile).metadata();
  const sizes = WIDTHS.filter(w => w < meta.width).concat([Math.min(meta.width, 2400)]);
  const uniq = [...new Set(sizes)];
  fs.mkdirSync(path.dirname(path.join(DIST, outBase)), { recursive: true });
  for (const w of uniq) {
    const out = path.join(DIST, `${outBase}-${w}.webp`);
    if (!fs.existsSync(out)) await sharp(srcFile).rotate().resize({ width: w }).webp({ quality: 80 }).toFile(out);
  }
  const ratio = meta.height / meta.width;
  const res = { base: '/' + outBase, widths: uniq, ratio, w: meta.width, h: meta.height };
  imgCache[srcFile] = res;
  return res;
}
function picture(img, alt, sizes = '100vw', cls = '', eager = false) {
  if (!img) return '';
  const srcset = img.widths.map(w => `${img.base}-${w}.webp ${w}w`).join(', ');
  const fallback = `${img.base}-${img.widths[Math.min(1, img.widths.length - 1)]}.webp`;
  const big = `${img.base}-${img.widths[img.widths.length - 1]}.webp`;
  return `<img class="${cls}" src="${fallback}" srcset="${srcset}" sizes="${sizes}" width="${img.w}" height="${img.h}" alt="${esc(alt)}" data-full="${big}"${eager ? ' fetchpriority="high"' : ' loading="lazy"'} decoding="async">`;
}

// ---------- content ----------
function loadNews() {
  const raw = fs.readFileSync(path.join(CONTENT, 'news.md'), 'utf8').replace(/\r\n/g, '\n');
  return raw.split(/^## /m).slice(1).map(chunk => {
    const lines = chunk.split('\n');
    const title = lines.shift().trim();
    const fields = {};
    const rest = [];
    for (const l of lines) {
      const kv = l.match(/^(when|where|link|show):\s*(.*)$/i);
      if (kv) fields[kv[1].toLowerCase()] = kv[2].trim(); else if (l.trim()) rest.push(l.trim());
    }
    return { title, ...fields, text: rest.join(' ') };
  }).filter(n => !/^(no|false)$/i.test(n.show || ''));
}
async function loadProjects() {
  const dir = path.join(CONTENT, 'projects');
  const out = [];
  for (const slug of fs.readdirSync(dir)) {
    if (slug.startsWith('_') || slug.startsWith('.')) continue;
    const pdir = path.join(dir, slug);
    if (!fs.statSync(pdir).isDirectory()) continue;
    const mdFile = path.join(pdir, 'project.md');
    if (!fs.existsSync(mdFile)) continue;
    const { data, body } = parseFile(mdFile);
    if (truthy(data.draft)) continue;
    // images: listed ones in order, then any unlisted image files alphabetically
    const listed = (Array.isArray(data.images) ? data.images : []).map(l => {
      const i = l.indexOf('|');
      return i === -1 ? { file: l.trim(), caption: '' } : { file: l.slice(0, i).trim(), caption: l.slice(i + 1).trim() };
    });
    const files = fs.readdirSync(pdir).filter(f => /\.(jpe?g|png|webp|tiff?)$/i.test(f)).sort();
    for (const f of files) if (!listed.find(x => x.file === f)) listed.push({ file: f, caption: '' });
    const images = [];
    for (const it of listed) {
      const src = path.join(pdir, it.file);
      if (!fs.existsSync(src)) { console.warn(`  ! ${slug}: image ${it.file} not found`); continue; }
      images.push({ ...it, img: await processImage(src, `work/${slug}/${it.file.replace(/\.\w+$/, '')}`) });
    }
    const coverItem = images.find(i => i.file === data.cover) || images[0];
    // copy other files (pdfs etc.)
    for (const f of fs.readdirSync(pdir)) {
      if (/\.(pdf|mp4|zip)$/i.test(f)) {
        fs.mkdirSync(path.join(DIST, 'work', slug), { recursive: true });
        fs.copyFileSync(path.join(pdir, f), path.join(DIST, 'work', slug, f));
      }
    }
    out.push({
      slug, title: data.title || slug, years: data.years || '', sort: parseFloat(data.sort || data.years) || 0,
      context: data.context || '', video: data.video || '', videoCaption: data.video_caption || '', publication: data.publication || '',
      featured: truthy(data.featured), cover: coverItem, images, body
    });
  }
  return out.sort((a, b) => b.sort - a.sort || a.title.localeCompare(b.title));
}

// ---------- templates ----------
function layout({ site, title, description, body, current, image }) {
  const full = title ? `${title}, ${site.name}` : site.name;
  const nav = [['Work', '/'], ['Biography', '/biography/'], ['Contact', '/contact/']];
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(description || site.description)}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(description || site.description)}">
${image ? `<meta property="og:image" content="${esc(site.url)}${image.base}-1600.webp">` : ''}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&family=IBM+Plex+Mono:wght@400&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header wrap">
  <a class="brand" href="/">${esc(site.name)}</a>
  <nav aria-label="Main">
    ${nav.map(([l, h]) => `<a href="${h}"${current === l ? ' aria-current="page"' : ''}>${l}</a>`).join('\n    ')}
  </nav>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer wrap">
  <p>${inline(site.footer || '')}</p>
  <p class="footer-links">
    ${site.email ? `<a href="mailto:${esc(site.email)}">${esc(site.email)}</a>` : ''}
    ${site.instagram ? `<a href="${esc(site.instagram)}" target="_blank" rel="noopener">Instagram</a>` : ''}
    ${site.portfolio ? `<a href="${esc(site.portfolio)}">Portfolio (PDF)</a>` : ''}
    ${site.presskit ? `<a href="${esc(site.presskit)}">Press kit (PDF)</a>` : ''}
  </p>
</footer>
<script src="/site.js" defer></script>
</body>
</html>`;
}

function homePage(site, projects, news) {
  const hero = projects.find(p => p.featured) || projects[0];
  const heroCaption = [hero.title + (hero.years ? `, ${hero.years}` : ''), hero.cover?.caption].filter(Boolean).join('. ');
  const newsHtml = news.length ? `
<section class="now wrap" aria-labelledby="now-h">
  <h2 id="now-h">Now</h2>
  <div class="now-items">
  ${news.map(n => `<article class="now-item">
    <p class="meta">${esc([n.when, n.where].filter(Boolean).join(', '))}</p>
    <h3>${n.link ? `<a href="${esc(n.link)}"${/^https?:/.test(n.link) ? ' target="_blank" rel="noopener"' : ''}>${esc(n.title)}</a>` : esc(n.title)}</h3>
    ${n.text ? `<p class="dim">${inline(n.text)}</p>` : ''}
  </article>`).join('\n  ')}
  </div>
</section>` : '';
  const rows = projects.map(p => `<li>
    <a class="row" href="/work/${p.slug}/">
      <span class="yr">${esc(p.years)}</span>
      <span class="ti">${esc(p.title)}</span>
      <span class="cx">${esc(p.context)}</span>
      <span class="th">${p.cover ? picture(p.cover.img, '', '200px') : ''}</span>
    </a>
  </li>`).join('\n  ');
  return layout({
    site, current: 'Work', image: hero.cover?.img,
    body: `
<figure class="hero wrap">
  <a href="/work/${hero.slug}/">${picture(hero.cover.img, `${hero.title}, ${hero.cover.caption || 'installation view'}`, '(min-width: 1440px) 1344px, 100vw', 'hero-img', true)}</a>
  <figcaption class="cap">${inline(heroCaption)}</figcaption>
</figure>
${newsHtml}
<section class="index wrap" aria-labelledby="work-h">
  <h2 id="work-h" class="index-head"><span class="yr">Year</span><span class="ti">Work</span><span class="cx">Context</span><span class="th"></span></h2>
  <ul class="rows">
  ${rows}
  </ul>
</section>`
  });
}

function projectPage(site, p, prev, next) {
  const paras = markdown(p.body);
  // split essay: first two paragraphs visible, rest behind "Read full text"
  const parts = paras.split('\n');
  const lead = parts.slice(0, 2).join('\n');
  const more = parts.slice(2).join('\n');
  const [first, ...rest] = p.images;
  const fig = (it, i, sizes) => `<figure class="work-fig">
    <button class="zoom" type="button" data-index="${i}" aria-label="Enlarge image ${i + 1}">${picture(it.img, it.caption || `${p.title}, image ${i + 1}`, sizes, '', i === 0)}</button>
    ${it.caption ? `<figcaption class="cap">${inline(it.caption)}</figcaption>` : ''}
  </figure>`;
  const vimeo = p.video ? `<div class="video"><iframe src="${esc(p.video)}?dnt=1" title="${esc(p.title)} video" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>${p.videoCaption ? `<p class="cap video-cap">${inline(p.videoCaption)}</p>` : ''}` : '';
  return layout({
    site, current: 'Work', title: p.title, image: p.cover?.img,
    description: (p.body.split(/\n{2,}/)[0] || '').replace(/[*\[\]]/g, '').slice(0, 155),
    body: `
<article class="project wrap">
  <header class="project-head">
    <h1>${esc(p.title)}</h1>
    <dl class="facts">
      ${p.years ? `<dt>Years</dt><dd>${esc(p.years)}</dd>` : ''}
      ${p.context ? `<dt>Context</dt><dd>${inline(p.context)}</dd>` : ''}
      ${p.publication ? `<dt>Publication</dt><dd><a href="/work/${p.slug}/${esc(p.publication)}">Download PDF</a></dd>` : ''}
    </dl>
  </header>
  ${first ? fig(first, 0, '(min-width: 1440px) 1344px, 100vw') : ''}
  ${paras ? `<section class="essay">
    <h2>Text</h2>
    <div class="essay-body">
      ${lead}
      ${more ? `<details><summary>Read full text</summary>${more}</details>` : ''}
    </div>
  </section>` : ''}
  ${vimeo}
  <div class="grid">
    ${rest.map((it, i) => fig(it, i + 1, '(min-width: 800px) 50vw, 100vw')).join('\n    ')}
  </div>
  <nav class="pager" aria-label="More work">
    ${prev ? `<a href="/work/${prev.slug}/" rel="prev"><span class="dim">Newer</span>${esc(prev.title)}</a>` : '<span></span>'}
    ${next ? `<a href="/work/${next.slug}/" rel="next" class="nx"><span class="dim">Older</span>${esc(next.title)}</a>` : '<span></span>'}
  </nav>
</article>
<dialog class="viewer" aria-label="Image viewer">
  <img alt="">
  <p class="cap viewer-cap"></p>
  <button type="button" class="v-prev" aria-label="Previous image">Previous</button>
  <button type="button" class="v-next" aria-label="Next image">Next</button>
  <button type="button" class="v-close" aria-label="Close viewer">Close</button>
</dialog>`
  });
}

function textPage(site, file, current) {
  const { data, body } = parseFile(path.join(CONTENT, file));
  // CV convention: "## Section" then lines "YEAR: entry"
  let html = '';
  for (const block of body.split(/^(?=## )/m)) {
    const lines = block.trim().split('\n');
    const h = lines[0].match(/^##\s+(.*)/);
    if (!h) { html += `<div class="bio-text">${markdown(block)}</div>`; continue; }
    const rows = [];
    let cur = null;
    for (const l of lines.slice(1)) {
      const y = l.match(/^(\d{4}(?:\/\d{2,4})?)\s*$/);
      if (y) { cur = { year: y[1], items: [] }; rows.push(cur); continue; }
      if (!l.trim()) continue;
      if (!cur) { cur = { year: '', items: [] }; rows.push(cur); }
      cur.items.push(l.replace(/^[-*]\s+/, ''));
    }
    html += `<section class="cv-sec"><h2>${esc(h[1])}</h2><dl class="cv">${rows.map(r =>
      `<dt>${esc(r.year)}</dt><dd><ul>${r.items.map(i => `<li>${inline(i)}</li>`).join('')}</ul></dd>`).join('')}</dl></section>`;
  }
  const links = (Array.isArray(data.links) ? data.links : []).map(l => { const [t, u] = l.split('|').map(s => s.trim()); return `<a href="${esc(u)}">${esc(t)}</a>`; }).join('');
  return layout({
    site, current, title: data.title,
    body: `<article class="page wrap">
  <h1>${esc(data.title)}</h1>
  ${links ? `<p class="page-links">${links}</p>` : ''}
  ${html}
</article>`
  });
}

// ---------- build ----------
(async () => {
  const t0 = Date.now();
  // keep generated images between builds, wipe html
  fs.mkdirSync(DIST, { recursive: true });
  const site = parseFile(path.join(CONTENT, 'site.md')).data;
  const news = loadNews();
  const projects = await loadProjects();
  const write = (rel, html) => { const f = path.join(DIST, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };

  write('index.html', homePage(site, projects, news));
  projects.forEach((p, i) => write(`work/${p.slug}/index.html`, projectPage(site, p, projects[i - 1], projects[i + 1])));
  write('biography/index.html', textPage(site, 'biography.md', 'Biography'));
  write('contact/index.html', textPage(site, 'contact.md', 'Contact'));
  write('404.html', layout({ site, title: 'Not found', body: `<article class="page wrap"><h1>Page not found</h1><p><a href="/">Back to all work</a></p></article>` }));

  // static assets
  for (const f of fs.readdirSync(path.join(ROOT, 'src'))) fs.copyFileSync(path.join(ROOT, 'src', f), path.join(DIST, f));
  const files = path.join(CONTENT, 'files');
  if (fs.existsSync(files)) { fs.mkdirSync(path.join(DIST, 'files'), { recursive: true }); for (const f of fs.readdirSync(files)) fs.copyFileSync(path.join(files, f), path.join(DIST, 'files', f)); }
  // project data for the image viewer
  const sitemap = ['/', '/biography/', '/contact/', ...projects.map(p => `/work/${p.slug}/`)].map(u => `<url><loc>${site.url}${u}</loc></url>`).join('');
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap}</urlset>`);
  write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${site.url}/sitemap.xml\n`);
  console.log(`Built ${projects.length} projects in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
})().catch(e => { console.error(e); process.exit(1); });
