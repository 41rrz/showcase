# LUX Art Archive — V7 Professional Release

A dependency-free, GitHub Pages-ready interactive artwork portfolio built around physical CD-inspired collection covers.

## Publish to GitHub Pages

Upload the contents of this folder to the **root** of your repository, then enable:

- Settings → Pages
- Source: **Deploy from a branch**
- Branch: **main**
- Folder: **/ (root)**

Do not upload only the ZIP file; extract it first.

## Normal content editing

Edit `data.js` and place normal image files in `assets/art/`.

V7 site-level settings are also in `data.js` under `site`, including the owner name, year, browser title, description, and home-page copy.

## Hidden live editor

Tap/click the **LUX** logo five times quickly. The site enters visual Edit Mode.

You can:

- edit site identity and home-page copy with **SITE**
- create, duplicate, move, or delete discs
- upload custom disc artwork
- add, replace, move, crop, scale, rotate, or delete artwork
- drag directly on artwork to reposition its crop
- export `data.js` for GitHub
- export/restore a JSON editor backup

Changes are autosaved locally in that browser. GitHub Pages cannot write directly to your repository, so use **EXPORT DATA.JS** when you are ready to publish editor changes.

## Disc Lab

Open `#studio` at the end of the site URL to access the advanced disc/cover creator directly.

Example:

`https://username.github.io/repository/#studio`

## Visitor features added in V7

- deep links to individual collections and artwork
- share/copy-link controls
- collection search
- compact/spacious gallery density toggle
- fullscreen artwork viewer
- artwork zoom controls
- swipe navigation on mobile
- keyboard navigation on desktop
- neighboring-image preloading
- loading and image-error states
- dynamic page titles/descriptions per collection/artwork
- reduced-motion support
- improved focus/accessibility behavior
- mobile web-app manifest

## Useful URLs

Collection:

`#gallery/gfx`

Individual artwork:

`#gallery/gfx/art/1`

Hidden Disc Lab:

`#studio`

## Before using your final domain

Replace the placeholder artwork in `assets/art/`, customize `data.js`, and test the site on both phone and desktop. The project intentionally has no npm, framework, build system, analytics, or third-party tracking dependency.
