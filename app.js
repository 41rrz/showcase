(() => {
  const archive = window.LUX_ARCHIVE;
  if (!archive || !Array.isArray(archive.collections)) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const boot = $('#boot');
  const discStage = $('#discStage');
  const gallery = $('#gallery');
  const galleryGrid = $('#galleryGrid');
  const collectionView = $('#collectionView');
  const aboutView = $('#aboutView');
  const cursorLabel = $('#cursorLabel');
  const lightbox = $('#lightbox');

  let currentCollection = null;
  let currentArtworkIndex = 0;
  let routeLock = false;

  const pad = (n) => String(n).padStart(2, '0');

  function buildDiscs() {
    discStage.innerHTML = archive.collections.map((collection, index) => `
      <button class="disc-card" data-collection="${collection.id}" aria-label="Open ${collection.title} gallery">
        <div class="disc-card__disc-wrap">
          <div class="disc-card__disc" style="--disc-accent:${collection.accent}">
            <div class="disc-face disc-face--${collection.discStyle}"></div>
            <div class="disc-graphic" style="color:${collection.accent}">
              <span class="disc-ring disc-ring--a"></span>
              <span class="disc-ring disc-ring--b"></span>
              <span class="disc-slash"></span>
              <span class="disc-label">${collection.shortTitle}<small>LUX / DISC ${collection.disc}</small></span>
            </div>
            <span class="disc-center"></span>
          </div>
        </div>
        <div class="disc-card__meta">
          <span class="disc-card__meta-left">
            <strong>${collection.title}</strong>
            <span>DISC ${collection.disc} / ${archive.site.year}</span>
          </span>
          <span class="disc-card__count">${pad(collection.artworks.length)} TRACKS</span>
        </div>
      </button>
    `).join('');

    $$('.disc-card', discStage).forEach((card) => {
      const disc = $('.disc-card__disc', card);

      card.addEventListener('pointermove', (event) => {
        if (event.pointerType === 'touch') return;
        const r = disc.getBoundingClientRect();
        const x = (event.clientX - r.left) / r.width;
        const y = (event.clientY - r.top) / r.height;
        const ry = (x - .5) * 11;
        const rx = (.5 - y) * 11;
        disc.style.setProperty('--tilt-x', `${rx.toFixed(2)}deg`);
        disc.style.setProperty('--tilt-y', `${ry.toFixed(2)}deg`);
        disc.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
        disc.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
      });

      card.addEventListener('pointerenter', (event) => {
        if (event.pointerType !== 'touch') cursorLabel.classList.add('is-visible');
      });

      card.addEventListener('pointerleave', () => {
        disc.style.setProperty('--tilt-x', '0deg');
        disc.style.setProperty('--tilt-y', '0deg');
        cursorLabel.classList.remove('is-visible');
      });

      card.addEventListener('click', () => {
        const collection = archive.collections.find(c => c.id === card.dataset.collection);
        if (collection) animateOpenCollection(collection, card);
      });
    });
  }

  function animateOpenCollection(collection, card) {
    if (routeLock) return;
    routeLock = true;
    cursorLabel.classList.remove('is-visible');
    discStage.classList.add('is-opening');
    card.classList.add('is-opening');

    window.setTimeout(() => {
      openCollection(collection, true);
      discStage.classList.remove('is-opening');
      card.classList.remove('is-opening');
      routeLock = false;
    }, 430);
  }

  function openCollection(collection, updateHash = false) {
    currentCollection = collection;
    currentArtworkIndex = 0;

    $('#galleryDiscNumber').textContent = `DISC ${collection.disc}`;
    $('#galleryMiniTitle').textContent = collection.shortTitle;
    $('#galleryCounter').textContent = `${pad(collection.artworks.length)} TRACKS`;
    $('#galleryEyebrow').textContent = collection.eyebrow;
    $('#galleryTitle').textContent = collection.title;
    $('#galleryDescription').textContent = collection.description;
    $('#galleryFooterCode').textContent = `DISC / ${collection.disc}`;

    galleryGrid.innerHTML = collection.artworks.map((art, index) => `
      <button class="art-card" data-art-index="${index}" aria-label="Open ${art.title}">
        <div class="art-card__image-wrap">
          <img src="${art.image}" alt="${escapeHtml(art.title)}" loading="lazy" />
          <span class="art-card__index">TRACK ${pad(index + 1)}</span>
        </div>
        <div class="art-card__meta">
          <strong>${escapeHtml(art.title)}</strong>
          <span>${escapeHtml(art.meta)}</span>
        </div>
      </button>
    `).join('');

    $$('.art-card', galleryGrid).forEach((card) => {
      card.addEventListener('click', () => openArtwork(Number(card.dataset.artIndex)));
    });

    gallery.classList.add('is-open');
    gallery.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    gallery.scrollTop = 0;

    if (updateHash) history.pushState({ collection: collection.id }, '', `#gallery/${collection.id}`);
  }

  function closeCollection(updateHash = true) {
    gallery.classList.remove('is-open');
    gallery.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    currentCollection = null;
    if (updateHash) history.pushState({}, '', location.pathname + location.search);
  }

  function openArtwork(index) {
    if (!currentCollection) return;
    currentArtworkIndex = Math.max(0, Math.min(index, currentCollection.artworks.length - 1));
    const art = currentCollection.artworks[currentArtworkIndex];
    $('#lightboxImage').src = art.image;
    $('#lightboxImage').alt = art.title;
    $('#lightboxTrack').textContent = `TRACK ${pad(currentArtworkIndex + 1)} / ${pad(currentCollection.artworks.length)}`;
    $('#lightboxTitle').textContent = art.title;
    $('#lightboxMeta').textContent = art.meta;
    if (!lightbox.open) lightbox.showModal();
  }

  function stepArtwork(direction) {
    if (!currentCollection) return;
    const total = currentCollection.artworks.length;
    currentArtworkIndex = (currentArtworkIndex + direction + total) % total;
    openArtwork(currentArtworkIndex);
  }

  function selectView(view) {
    const isAbout = view === 'about';
    collectionView.hidden = isAbout;
    aboutView.hidden = !isAbout;
    $$('.nav-link').forEach(btn => btn.classList.toggle('is-active', btn.dataset.nav === view));
    if (!gallery.classList.contains('is-open')) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function syncHash() {
    const match = location.hash.match(/^#gallery\/([^/]+)$/);
    if (match) {
      const collection = archive.collections.find(c => c.id === decodeURIComponent(match[1]));
      if (collection) {
        openCollection(collection, false);
        return;
      }
    }
    if (gallery.classList.contains('is-open')) closeCollection(false);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  buildDiscs();

  $$('.nav-link').forEach(btn => btn.addEventListener('click', () => selectView(btn.dataset.nav)));
  $('#closeGallery').addEventListener('click', () => closeCollection(true));
  $('#closeLightbox').addEventListener('click', () => lightbox.close());
  $('#prevArtwork').addEventListener('click', () => stepArtwork(-1));
  $('#nextArtwork').addEventListener('click', () => stepArtwork(1));

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) lightbox.close();
  });

  document.addEventListener('keydown', (event) => {
    if (lightbox.open) {
      if (event.key === 'ArrowLeft') stepArtwork(-1);
      if (event.key === 'ArrowRight') stepArtwork(1);
      return;
    }
    if (event.key === 'Escape' && gallery.classList.contains('is-open')) closeCollection(true);
  });

  document.addEventListener('pointermove', (event) => {
    cursorLabel.style.left = `${event.clientX}px`;
    cursorLabel.style.top = `${event.clientY}px`;
  }, { passive: true });

  window.addEventListener('popstate', syncHash);
  window.addEventListener('hashchange', syncHash);

  syncHash();
  window.setTimeout(() => boot.classList.add('is-done'), 1120);
})();
