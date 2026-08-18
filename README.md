# LUX Art Archive

A complete, dependency-free, CD-inspired artwork portfolio built for GitHub Pages.

## What is included

- Interactive CD collection homepage
- Holographic pointer lighting and 3D tilt
- Animated transition into each gallery
- Shareable gallery URLs using hashes
- Responsive mobile/tablet/desktop layout
- Full-screen artwork lightbox
- Keyboard controls
- Reduced-motion accessibility support
- No npm install, build step, framework, or external CDN
- GitHub Pages-ready structure

## Upload to GitHub

1. Create a new GitHub repository.
2. Upload **everything inside this folder** to the root of that repository.
3. Commit the files.
4. In the repository, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Select your main branch and the **/(root)** folder.
7. Save.

GitHub will publish the site after the deployment finishes.

## Replace the example artwork

Put your real image files in:

`assets/art/`

Then open:

`data.js`

Each artwork entry looks like this:

```js
{ title: "My Artwork", meta: "GFX / 2026", image: "assets/art/my-artwork.jpg" }
```

You can use JPG, PNG, WEBP, GIF, or SVG files.

## Add a new collection/disc

Duplicate one collection object in `data.js`, then change:

- `id` — unique URL-safe name
- `disc` — displayed disc number
- `title`
- `shortTitle`
- `eyebrow`
- `description`
- `discStyle` — `silver`, `white`, `smoke`, or `clear`
- `accent` — any CSS color
- `artworks` — your artwork entries

The homepage automatically creates a new disc from the data.

## Change the site title / owner

Search these files for `LUX` and replace it with your preferred title/brand:

- `index.html`
- `data.js`

## Recommended image sizes

For a fast portfolio:

- Long edge: roughly 1600–2400 px
- WEBP or optimized JPG for most images
- Try to keep individual files under a few MB

## Local preview

You can double-click `index.html`, but browser security rules can differ. A simple local web server is more reliable.

If Python is installed, run this from the project folder:

```bash
python -m http.server 8080
```

Then open:

`http://localhost:8080`

## File structure

```text
lux-art-archive/
├── index.html
├── styles.css
├── app.js
├── data.js
├── 404.html
├── README.md
├── .gitignore
└── assets/
    ├── icons/
    │   └── favicon.svg
    └── art/
        └── example SVG artwork
```

## Notes

The included SVG artwork is placeholder content only. Replace it with your own work before publishing your final portfolio.
