# carlosirijalba.com

Web estática, sin WordPress, sin base de datos y sin plugins. Todo el contenido vive en la carpeta `content/` como texto plano e imágenes. Un pequeño script (`build.js`) lo convierte en la web final en `dist/`.

## Añadir un proyecto nuevo

1. Copia la carpeta `content/projects/_template` y renómbrala con el nombre del proyecto en minúsculas y con guiones, por ejemplo `content/projects/rising-seas`. Ese nombre será la dirección: `carlosirijalba.com/work/rising-seas/`.
2. Mete dentro las fotos. Lo más cómodo es numerarlas `01.jpg`, `02.jpg`, `03.jpg`... en el orden en que quieres que aparezcan. Pueden ser grandes (la web genera sola las versiones ligeras para móvil).
3. Abre `project.md` y rellena la cabecera:

```
---
title: rising seas
years: 2025–2026
sort: 2026                  ← año para ordenar: el más alto sale primero
context: Solo exhibition, Bradwolff Projects, Amsterdam
cover: 01.jpg               ← imagen de la lista y de la portada
featured: yes               ← opcional: este proyecto ocupa la imagen grande de la home
draft: no                   ← "yes" lo oculta mientras lo preparas
video: https://player.vimeo.com/video/123456789   ← opcional
video_caption: Título del vídeo, duración
publication: catalogo.pdf   ← opcional, un PDF dentro de la misma carpeta
images:
  - 01.jpg | Installation view, Bradwolff Projects, 2026. Photo: Name
  - 02.jpg | Title, 2026. Salt, steel. 120 x 80 cm
---
```

4. Debajo de la cabecera, el texto del proyecto. Línea en blanco entre párrafos. `### Subtítulo` para subtítulos, `*cursiva*`, `**negrita**`, `[enlace](https://...)`, y `---` para separar, por ejemplo, la versión en castellano.

Las imágenes que estén en la carpeta pero no en la lista `images:` se añaden igualmente al final, en orden alfabético y sin pie de foto.

## Otras cosas que se editan a mano

- `content/news.md`: el bloque "Now" de la home (exposiciones en curso). `show: no` oculta una noticia sin borrarla. Si no hay ninguna visible, el bloque desaparece.
- `content/biography.md`: bio y CV. En el CV, cada año va solo en una línea y debajo sus entradas.
- `content/contact.md` y `content/site.md`: email, galería, Instagram, PDFs de portfolio y press kit (en `content/files/`).

## Publicar (gratis)

La forma más sencilla: subir esta carpeta a un repositorio de GitHub y conectarlo a Vercel (plan Hobby, gratuito). Vercel detecta `vercel.json`, ejecuta `npm run build` y publica `dist/`. A partir de ahí, cada cambio que se suba a GitHub (incluso editando `project.md` desde la web de GitHub y arrastrando fotos) se publica solo en un minuto.

`vercel.json` ya incluye redirecciones desde las URLs antiguas de WordPress (`/endotic/`, `/pannotia-2/`...) para no perder enlaces ni posicionamiento.

## Trabajar en local

Necesita Node 18 o superior.

```
npm install
npm run dev
```

y abre la dirección que aparece en la terminal.
