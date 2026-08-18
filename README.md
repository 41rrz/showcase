# LUX // ART ARCHIVE

A dependency-free, GitHub Pages-ready artwork portfolio built around interactive CD releases.

## What changed in this enhanced build

- The collection/home screen is locked to exactly one viewport: no page scrolling or mobile rubber-band scrolling.
- Discs continuously float and rotate at slightly different speeds.
- Pointer/touch position changes disc tilt and holographic reflections.
- Animated spectral film, glints, sweep highlights, disc grooves, edge ticks and micro-print details.
- Hover/press changes the ambient page accent to match the selected disc.
- The whole disc stage has subtle desktop parallax.
- Opening a collection now uses a larger spin/zoom/flash transition before the gallery enters.
- Mobile layout is tuned to remain a 2x2 disc wall without needing to scroll.
- Reduced-motion accessibility is retained.

## Edit your artwork

1. Put image files in `assets/art/`.
2. Open `data.js`.
3. Change each artwork entry to your file path, title and metadata.

Example:

```js
{ title: "My Artwork", meta: "GFX / 2026", image: "assets/art/my-art.png" }
```

Supported by browsers: JPG, PNG, WEBP, GIF and SVG.

## Edit or add collections

Collections are also controlled in `data.js`. Each collection includes:

- `id` - unique URL-safe name
- `disc` - display number
- `title`
- `shortTitle`
- `eyebrow`
- `description`
- `discStyle` - `silver`, `white`, `smoke`, or `clear`
- `accent` - any CSS color such as `#b9b6ff`
- `artworks` - array of gallery items

The current home composition is visually optimized for four collections.

## GitHub Pages

Upload the contents of this folder to the root of a GitHub repository, then enable Pages from the `main` branch and `/ (root)` folder.

No npm install, build command or framework is required.
