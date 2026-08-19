(() => {
  const archive = window.LUX_ARCHIVE;
  if (!archive || !Array.isArray(archive.collections)) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const boot = $('#boot');
  const discStage = $('#discStage');
  const gallery = $('#gallery');
  const galleryGrid = $('#galleryGrid');
  const galleryEmpty = $('#galleryEmpty');
  const cursorLabel = $('#cursorLabel');
  const lightbox = $('#lightbox');
  const lightboxImage = $('#lightboxImage');
  const lightboxImageStage = $('#lightboxImageStage');
  const lightboxLoading = $('#lightboxLoading');
  const stageStatus = $('#stageStatus');
  const discRange = $('#discRange');
  const siteLive = $('#siteLive');
  const routeProgress = $('#routeProgress');

  let currentCollection = null;
  let currentArtworkIndex = 0;
  let routeLock = false;
  let lightboxZoom = 1;
  let touchStartX = null;
  let touchStartY = null;
  let density = localStorage.getItem('lux-gallery-density') || 'balanced';
  let searchQuery = '';
  let lastOpenedDiscId = null;

  const pad = (n) => String(n).padStart(2, '0');
  const defaultAccent = '#9f95ff';
  const site = archive.site || (archive.site = {});

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function numberOr(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function artLayoutFor(art, index) {
    if (art && ['compact', 'standard', 'wide', 'hero'].includes(art.layout)) return art.layout;
    return index % 5 === 0 ? 'wide' : 'compact';
  }

  function setText(node, value) {
    if (node) node.textContent = value;
  }

  function announce(message) {
    if (!siteLive) return;
    siteLive.textContent = '';
    requestAnimationFrame(() => { siteLive.textContent = message; });
  }

  function setAccent(color = defaultAccent) {
    document.documentElement.style.setProperty('--active-accent', color);
  }

  function pulseRouteProgress() {
    if (!routeProgress) return;
    routeProgress.classList.remove('is-running');
    void routeProgress.offsetWidth;
    routeProgress.classList.add('is-running');
  }

  function applySiteSettings() {
    const owner = site.owner || 'LUX';
    const year = site.year || new Date().getFullYear();
    const title = site.title || `${owner} // ART ARCHIVE`;
    const description = site.description || 'An interactive CD-inspired archive of selected digital artwork.';
    setText($('.brand__word'), owner);
    setText($('#brandMeta'), `ART ARCHIVE / ${year}`);
    setText($('#heroEyebrow'), site.heroEyebrow || 'DIGITAL WORK / SELECTED ARCHIVE');
    setText($('#heroTitle'), site.heroTitle || 'Choose a disc.');
    setText($('#heroSubtitle'), site.heroSubtitle || 'Each disc opens a different collection. Move your pointer across the surface to catch the holographic finish.');
    setText($('#stageFooterCenter'), site.footerRight || 'LUX INTERACTIVE ARCHIVE');
    setText($('#galleryFooterLeft'), site.footerLeft || `${owner} ART ARCHIVE`);
    document.title = title;
    const desc = $('meta[name="description"]');
    const ogTitle = $('meta[property="og:title"]');
    const ogDesc = $('meta[property="og:description"]');
    const twTitle = $('meta[name="twitter:title"]');
    const twDesc = $('meta[name="twitter:description"]');
    if (desc) desc.content = description;
    if (ogTitle) ogTitle.content = title;
    if (ogDesc) ogDesc.content = description;
    if (twTitle) twTitle.content = title;
    if (twDesc) twDesc.content = description;
  }

  function setPageMeta(collection = null, art = null) {
    const owner = site.owner || 'LUX';
    const baseTitle = site.title || `${owner} // ART ARCHIVE`;
    const baseDescription = site.description || 'An interactive CD-inspired archive of selected digital artwork.';
    let title = baseTitle;
    let description = baseDescription;
    if (collection) {
      title = `${collection.title} — ${owner}`;
      description = collection.description || baseDescription;
    }
    if (collection && art) {
      title = `${art.title} — ${collection.shortTitle || collection.title} / ${owner}`;
      description = `${art.meta || 'Artwork'} from ${collection.title}.`;
    }
    document.title = title;
    const selectors = [
      ['meta[name="description"]', description],
      ['meta[property="og:title"]', title],
      ['meta[property="og:description"]', description],
      ['meta[name="twitter:title"]', title],
      ['meta[name="twitter:description"]', description],
    ];
    selectors.forEach(([selector, content]) => {
      const el = $(selector);
      if (el) el.content = content;
    });
  }

  function createDiscMotion(card, disc) {
    const state = {
      currentX: 0, currentY: 0, targetX: 0, targetY: 0,
      currentMX: 50, currentMY: 50, targetMX: 50, targetMY: 50,
      raf: 0, active: false,
    };

    function render() {
      state.currentX += (state.targetX - state.currentX) * 0.12;
      state.currentY += (state.targetY - state.currentY) * 0.12;
      state.currentMX += (state.targetMX - state.currentMX) * 0.12;
      state.currentMY += (state.targetMY - state.currentMY) * 0.12;
      disc.style.setProperty('--tilt-x', `${state.currentX.toFixed(2)}deg`);
      disc.style.setProperty('--tilt-y', `${state.currentY.toFixed(2)}deg`);
      disc.style.setProperty('--mx', `${state.currentMX.toFixed(1)}%`);
      disc.style.setProperty('--my', `${state.currentMY.toFixed(1)}%`);
      const settled =
        Math.abs(state.targetX - state.currentX) < 0.03 &&
        Math.abs(state.targetY - state.currentY) < 0.03 &&
        Math.abs(state.targetMX - state.currentMX) < 0.08 &&
        Math.abs(state.targetMY - state.currentMY) < 0.08;
      if (state.active || !settled) state.raf = requestAnimationFrame(render);
      else state.raf = 0;
    }

    function wake() { if (!state.raf) state.raf = requestAnimationFrame(render); }

    function update(event) {
      const r = disc.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - r.left) / r.width));
      const y = Math.max(0, Math.min(1, (event.clientY - r.top) / r.height));
      const strength = event.pointerType === 'touch' ? 6.5 : 8.8;
      state.targetY = (x - .5) * strength;
      state.targetX = (.5 - y) * strength;
      state.targetMX = x * 100;
      state.targetMY = y * 100;
      wake();
    }

    function enter() { state.active = true; wake(); }
    function leave() {
      state.active = false;
      state.targetX = 0; state.targetY = 0;
      state.targetMX = 50; state.targetMY = 50;
      wake();
    }
    return { update, enter, leave };
  }

  function buildDiscs() {
    const total = archive.collections.length;
    setText(discRange, total ? `01—${pad(total)} / ${pad(total)}` : '00 / 00');

    discStage.innerHTML = archive.collections.map((collection, index) => `
      <button class="disc-card" data-collection="${escapeHtml(collection.id)}" aria-label="Open ${escapeHtml(collection.title)} gallery" style="--float-delay:${(-index * .72).toFixed(2)}s;--rotor-duration:${31 + (index * 3.1)}s">
        <span class="disc-card__number">${pad(index + 1)} / ${pad(total)}</span>
        <div class="disc-card__disc-wrap">
          <div class="disc-card__disc" style="--disc-accent:${collection.accent || defaultAccent}">
            <div class="disc-rotor">
              <div class="disc-face disc-face--${collection.discStyle || 'silver'}"></div>
              ${collection.coverImage ? `<span class="disc-custom-art" style="--cover-x:${numberOr(collection.coverX, 0)}%;--cover-y:${numberOr(collection.coverY, 0)}%;--cover-scale:${numberOr(collection.coverScale, 100) / 100};--cover-rotation:${numberOr(collection.coverRotation, 0)}deg;--cover-opacity:${numberOr(collection.coverOpacity, 100) / 100};--cover-fit:${collection.coverFit === 'contain' ? 'contain' : 'cover'}"><img src="${escapeHtml(collection.coverImage)}" alt="" /></span>` : ''}
              <span class="disc-grooves"></span>
              <div class="disc-graphic" style="color:${collection.accent || defaultAccent}">
                <span class="disc-ring disc-ring--a"></span><span class="disc-ring disc-ring--b"></span><span class="disc-slash"></span><span class="disc-ticks"></span>
                <span class="disc-micro disc-micro--top">${escapeHtml(site.owner || 'LUX')} • ARCHIVE • ${escapeHtml(collection.disc)}</span>
                <span class="disc-micro disc-micro--side">DIGITAL OBJECT / ${escapeHtml(site.year || '2026')}</span>
                <span class="disc-label">${escapeHtml(collection.shortTitle)}<small>${escapeHtml(site.owner || 'LUX')} / DISC ${escapeHtml(collection.disc)}</small></span>
              </div>
              <span class="disc-center"></span><span class="disc-holo"></span><span class="disc-sweep"></span>
            </div>
            <span class="disc-glint"></span>
          </div>
        </div>
        <div class="disc-card__meta">
          <span class="disc-card__meta-left"><strong>${escapeHtml(collection.title)}</strong><span>DISC ${escapeHtml(collection.disc)} / ${escapeHtml(site.year || '2026')}</span></span>
          <span class="disc-card__count">${pad(collection.artworks.length)} TRACKS</span>
        </div>
      </button>`).join('');

    $$('.disc-card', discStage).forEach((card) => {
      const disc = $('.disc-card__disc', card);
      const collection = archive.collections.find(c => c.id === card.dataset.collection);
      const motion = createDiscMotion(card, disc);
      card.addEventListener('pointermove', (event) => { if (!routeLock) motion.update(event); });
      card.addEventListener('pointerenter', (event) => {
        if (!collection) return;
        motion.enter();
        setAccent(collection.accent);
        document.body.classList.add('has-disc-focus');
        setText(stageStatus, `DISC ${collection.disc} / ${collection.shortTitle}`);
        if (event.pointerType !== 'touch') cursorLabel.classList.add('is-visible');
      });
      card.addEventListener('focus', () => {
        if (!collection) return;
        setAccent(collection.accent);
        setText(stageStatus, `DISC ${collection.disc} / ${collection.shortTitle}`);
      });
      card.addEventListener('blur', () => { if (!routeLock) setAccent(defaultAccent); });
      card.addEventListener('pointerdown', (event) => {
        if (!collection || routeLock) return;
        card.classList.add('is-pressed');
        motion.enter(); motion.update(event);
        setAccent(collection.accent);
        setText(stageStatus, `LOADING DISC ${collection.disc}`);
        try { card.setPointerCapture(event.pointerId); } catch (_) {}
      });
      const releasePress = () => card.classList.remove('is-pressed');
      card.addEventListener('pointerup', releasePress);
      card.addEventListener('pointercancel', releasePress);
      card.addEventListener('pointerleave', () => {
        releasePress(); motion.leave(); cursorLabel.classList.remove('is-visible');
        document.body.classList.remove('has-disc-focus');
        setText(stageStatus, 'MOVE / TOUCH TO INSPECT');
        if (!routeLock) setAccent(defaultAccent);
      });
      card.addEventListener('click', () => { if (collection) animateOpenCollection(collection, card); });
    });
  }

  function animateOpenCollection(collection, card) {
    if (routeLock) return;
    routeLock = true;
    lastOpenedDiscId = collection.id;
    pulseRouteProgress();
    setAccent(collection.accent);
    cursorLabel.classList.remove('is-visible');
    document.body.classList.add('is-transitioning');
    discStage.classList.add('is-opening');
    card.classList.add('is-opening');
    setText(stageStatus, `OPENING / ${collection.shortTitle}`);
    window.setTimeout(() => openCollection(collection, true), 540);
    window.setTimeout(() => {
      discStage.classList.remove('is-opening');
      card.classList.remove('is-opening', 'is-pressed');
      document.body.classList.remove('is-transitioning', 'has-disc-focus');
      setText(stageStatus, 'MOVE / TOUCH TO INSPECT');
      routeLock = false;
    }, 820);
  }

  function buildGalleryCards(collection) {
    galleryGrid.innerHTML = collection.artworks.map((art, index) => {
      const layout = artLayoutFor(art, index);
      const posX = numberOr(art.positionX, 50);
      const posY = numberOr(art.positionY, 50);
      const scale = numberOr(art.scale, 100) / 100;
      const rotation = numberOr(art.rotation, 0);
      const fit = art.fit === 'contain' ? 'contain' : 'cover';
      return `<button class="art-card art-card--${layout}" data-art-index="${index}" data-search="${escapeHtml(`${art.title || ''} ${art.meta || ''}`.toLowerCase())}" aria-label="Open ${escapeHtml(art.title)}" style="--art-pos-x:${posX}%;--art-pos-y:${posY}%;--art-scale:${scale};--art-rotation:${rotation}deg;--art-fit:${fit}">
        <div class="art-card__image-wrap"><span class="art-card__loader" aria-hidden="true"></span><img src="${escapeHtml(art.image)}" alt="${escapeHtml(art.title)}" loading="lazy" decoding="async" /><span class="art-card__index">TRACK ${pad(index + 1)}</span></div>
        <div class="art-card__meta"><strong>${escapeHtml(art.title)}</strong><span>${escapeHtml(art.meta)}</span></div>
      </button>`;
    }).join('');

    $$('.art-card', galleryGrid).forEach((artCard) => {
      const img = $('img', artCard);
      if (img) {
        const loaded = () => artCard.classList.add('is-image-ready');
        if (img.complete) loaded();
        else img.addEventListener('load', loaded, { once: true });
        img.addEventListener('error', () => artCard.classList.add('is-image-error'), { once: true });
      }
      artCard.addEventListener('click', () => openArtwork(Number(artCard.dataset.artIndex), true));
    });
    applyGalleryFilter();
  }

  function openCollection(collection, updateHash = false) {
    if (!collection) return;
    currentCollection = collection;
    currentArtworkIndex = 0;
    searchQuery = '';
    const searchInput = $('#gallerySearchInput');
    if (searchInput) searchInput.value = '';
    setText($('#galleryDiscNumber'), `DISC ${collection.disc}`);
    setText($('#galleryMiniTitle'), collection.shortTitle);
    setText($('#galleryCounter'), `${pad(collection.artworks.length)} TRACKS`);
    setText($('#galleryEyebrow'), collection.eyebrow);
    setText($('#galleryTitle'), collection.title);
    setText($('#galleryDescription'), collection.description);
    setText($('#galleryFooterCode'), `DISC / ${collection.disc}`);
    setAccent(collection.accent);
    buildGalleryCards(collection);
    gallery.dataset.density = density;
    updateDensityButton();
    gallery.classList.add('is-open');
    gallery.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gallery-open');
    gallery.scrollTop = 0;
    setPageMeta(collection);
    announce(`${collection.title} opened. ${collection.artworks.length} artworks.`);
    if (updateHash) {
      history.pushState({ collection: collection.id }, '', `#gallery/${encodeURIComponent(collection.id)}`);
      setTimeout(() => $('#closeGallery')?.focus({ preventScroll: true }), 120);
    }
  }

  function closeCollection(updateHash = true) {
    if (lightbox.open) lightbox.close();
    gallery.classList.remove('is-open');
    gallery.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gallery-open');
    currentCollection = null;
    setAccent(defaultAccent);
    setPageMeta();
    closeSearchBar();
    announce('Returned to collection discs.');
    if (updateHash) history.pushState({}, '', location.pathname + location.search);
    if (lastOpenedDiscId) setTimeout(() => $(`.disc-card[data-collection="${CSS.escape(lastOpenedDiscId)}"]`)?.focus({ preventScroll: true }), 120);
  }

  function showLightboxLoading(show) {
    lightboxLoading?.classList.toggle('is-visible', Boolean(show));
  }

  function setZoom(value) {
    lightboxZoom = Math.max(1, Math.min(4, value));
    lightboxImageStage?.style.setProperty('--lightbox-zoom', lightboxZoom.toFixed(2));
    const reset = $('#lightboxZoomReset');
    if (reset) reset.textContent = `${Math.round(lightboxZoom * 100)}%`;
    lightboxImageStage?.classList.toggle('is-zoomed', lightboxZoom > 1.01);
  }

  function preloadNeighbors() {
    if (!currentCollection?.artworks?.length) return;
    [-1, 1].forEach((offset) => {
      const total = currentCollection.artworks.length;
      const index = (currentArtworkIndex + offset + total) % total;
      const src = currentCollection.artworks[index]?.image;
      if (src) { const image = new Image(); image.src = src; }
    });
  }

  function openArtwork(index, updateHash = false) {
    if (!currentCollection) return;
    currentArtworkIndex = Math.max(0, Math.min(index, currentCollection.artworks.length - 1));
    const art = currentCollection.artworks[currentArtworkIndex];
    setZoom(1);
    showLightboxLoading(true);
    lightboxImage.onload = () => showLightboxLoading(false);
    lightboxImage.onerror = () => { showLightboxLoading(false); announce('Artwork image could not be loaded.'); };
    lightboxImage.src = art.image;
    lightboxImage.alt = art.title;
    setText($('#lightboxTrack'), `TRACK ${pad(currentArtworkIndex + 1)} / ${pad(currentCollection.artworks.length)}`);
    setText($('#lightboxTitle'), art.title);
    setText($('#lightboxMeta'), art.meta);
    if (!lightbox.open) lightbox.showModal();
    setPageMeta(currentCollection, art);
    announce(`${art.title}. Track ${currentArtworkIndex + 1} of ${currentCollection.artworks.length}.`);
    preloadNeighbors();
    if (updateHash) history.pushState({ collection: currentCollection.id, art: currentArtworkIndex }, '', `#gallery/${encodeURIComponent(currentCollection.id)}/art/${currentArtworkIndex + 1}`);
  }

  function closeArtwork(updateHash = true) {
    if (lightbox.open) lightbox.close();
    setZoom(1);
    if (currentCollection) setPageMeta(currentCollection);
    if (updateHash && currentCollection) history.replaceState({ collection: currentCollection.id }, '', `#gallery/${encodeURIComponent(currentCollection.id)}`);
    setTimeout(() => $(`.art-card[data-art-index="${currentArtworkIndex}"]`, galleryGrid)?.focus({ preventScroll: true }), 80);
  }

  function stepArtwork(direction) {
    if (!currentCollection) return;
    const total = currentCollection.artworks.length;
    currentArtworkIndex = (currentArtworkIndex + direction + total) % total;
    openArtwork(currentArtworkIndex, false);
    history.replaceState({ collection: currentCollection.id, art: currentArtworkIndex }, '', `#gallery/${encodeURIComponent(currentCollection.id)}/art/${currentArtworkIndex + 1}`);
  }

  function applyGalleryFilter() {
    const cards = $$('.art-card', galleryGrid);
    const q = searchQuery.trim().toLowerCase();
    let visible = 0;
    cards.forEach(card => {
      const match = !q || (card.dataset.search || '').includes(q);
      card.hidden = !match;
      if (match) visible++;
    });
    if (galleryEmpty) galleryEmpty.hidden = visible !== 0;
    if (currentCollection) setText($('#galleryCounter'), q ? `${pad(visible)} / ${pad(currentCollection.artworks.length)}` : `${pad(currentCollection.artworks.length)} TRACKS`);
  }

  function openSearchBar() {
    const bar = $('#gallerySearchBar');
    const toggle = $('#gallerySearchToggle');
    if (!bar) return;
    bar.hidden = false;
    requestAnimationFrame(() => bar.classList.add('is-open'));
    toggle?.setAttribute('aria-expanded', 'true');
    setTimeout(() => $('#gallerySearchInput')?.focus(), 40);
  }

  function closeSearchBar() {
    const bar = $('#gallerySearchBar');
    const toggle = $('#gallerySearchToggle');
    if (!bar) return;
    bar.classList.remove('is-open');
    toggle?.setAttribute('aria-expanded', 'false');
    setTimeout(() => { if (!bar.classList.contains('is-open')) bar.hidden = true; }, 260);
  }

  function updateDensityButton() {
    const button = $('#galleryDensity');
    if (button) button.textContent = density === 'dense' ? 'SPACIOUS' : 'COMPACT';
  }

  function toggleDensity() {
    density = density === 'dense' ? 'balanced' : 'dense';
    localStorage.setItem('lux-gallery-density', density);
    gallery.dataset.density = density;
    updateDensityButton();
    announce(density === 'dense' ? 'Compact gallery view enabled.' : 'Spacious gallery view enabled.');
  }

  async function shareUrl(title, text, url = location.href) {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      announce('Link copied to clipboard.');
      flashButtonText(document.activeElement, 'COPIED');
    } catch (_) {
      try {
        await navigator.clipboard.writeText(url);
        announce('Link copied to clipboard.');
      } catch (_) {}
    }
  }

  function flashButtonText(button, text) {
    if (!(button instanceof HTMLButtonElement)) return;
    const old = button.textContent;
    button.textContent = text;
    clearTimeout(button._luxTimer);
    button._luxTimer = setTimeout(() => { button.textContent = old; }, 1200);
  }

  function syncHash() {
    if (location.hash === '#studio') return;
    const artMatch = location.hash.match(/^#gallery\/([^/]+)\/art\/(\d+)$/);
    if (artMatch) {
      const collection = archive.collections.find(c => c.id === decodeURIComponent(artMatch[1]));
      const artIndex = Math.max(0, Number(artMatch[2]) - 1);
      if (collection) {
        if (currentCollection?.id !== collection.id || !gallery.classList.contains('is-open')) openCollection(collection, false);
        openArtwork(Math.min(artIndex, Math.max(0, collection.artworks.length - 1)), false);
        return;
      }
    }
    const galleryMatch = location.hash.match(/^#gallery\/([^/]+)$/);
    if (galleryMatch) {
      const collection = archive.collections.find(c => c.id === decodeURIComponent(galleryMatch[1]));
      if (collection) {
        if (lightbox.open) lightbox.close();
        if (currentCollection?.id !== collection.id || !gallery.classList.contains('is-open')) openCollection(collection, false);
        else setPageMeta(collection);
        return;
      }
    }
    if (lightbox.open) lightbox.close();
    if (gallery.classList.contains('is-open')) closeCollection(false);
  }

  function refreshCurrentGallery() {
    if (!currentCollection) return;
    const scrollTop = gallery.scrollTop;
    openCollection(currentCollection, false);
    gallery.scrollTop = scrollTop;
  }

  function focusNeighborDisc(direction) {
    const cards = $$('.disc-card', discStage);
    if (!cards.length) return;
    let index = cards.indexOf(document.activeElement);
    if (index < 0) index = 0;
    else index = (index + direction + cards.length) % cards.length;
    cards[index].focus({ preventScroll: true });
  }

  window.LUX_APP = {
    rebuildDiscs: buildDiscs,
    openCollection,
    closeCollection,
    refreshCurrentGallery,
    getCurrentCollection: () => currentCollection,
    getArchive: () => archive,
    refreshSiteSettings: () => { applySiteSettings(); buildDiscs(); if (currentCollection) refreshCurrentGallery(); },
  };

  applySiteSettings();
  buildDiscs();
  gallery.dataset.density = density;
  updateDensityButton();

  $('#closeGallery').addEventListener('click', () => closeCollection(true));
  $('#closeLightbox').addEventListener('click', () => closeArtwork(true));
  $('#prevArtwork').addEventListener('click', () => stepArtwork(-1));
  $('#nextArtwork').addEventListener('click', () => stepArtwork(1));
  $('#gallerySearchToggle').addEventListener('click', () => {
    const bar = $('#gallerySearchBar');
    if (bar?.classList.contains('is-open')) closeSearchBar(); else openSearchBar();
  });
  $('#gallerySearchClear').addEventListener('click', () => {
    const input = $('#gallerySearchInput');
    if (input) input.value = '';
    searchQuery = '';
    applyGalleryFilter();
    input?.focus();
  });
  $('#gallerySearchInput').addEventListener('input', (event) => { searchQuery = event.target.value; applyGalleryFilter(); });
  $('#galleryDensity').addEventListener('click', toggleDensity);
  $('#galleryShare').addEventListener('click', () => {
    if (!currentCollection) return;
    shareUrl(`${currentCollection.title} — ${site.owner || 'LUX'}`, currentCollection.description || '', location.href.split('/art/')[0]);
  });
  $('#lightboxShare').addEventListener('click', () => {
    if (!currentCollection) return;
    const art = currentCollection.artworks[currentArtworkIndex];
    shareUrl(`${art.title} — ${currentCollection.title}`, art.meta || '', location.href);
  });
  $('#lightboxZoomIn').addEventListener('click', () => setZoom(lightboxZoom + .25));
  $('#lightboxZoomOut').addEventListener('click', () => setZoom(lightboxZoom - .25));
  $('#lightboxZoomReset').addEventListener('click', () => setZoom(1));
  $('#lightboxFullscreen').addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await lightbox.requestFullscreen?.();
    } catch (_) {}
  });

  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeArtwork(true);
  });
  lightbox.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeArtwork(true);
  });

  lightboxImageStage.addEventListener('wheel', (event) => {
    if (!lightbox.open) return;
    if (event.ctrlKey || lightboxZoom > 1) {
      event.preventDefault();
      setZoom(lightboxZoom + (event.deltaY < 0 ? .15 : -.15));
    }
  }, { passive: false });

  lightbox.addEventListener('touchstart', (event) => {
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    touchStartX = touch.clientX; touchStartY = touch.clientY;
  }, { passive: true });
  lightbox.addEventListener('touchend', (event) => {
    if (touchStartX == null || lightboxZoom > 1) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    touchStartX = touchStartY = null;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.3) stepArtwork(dx < 0 ? 1 : -1);
  }, { passive: true });

  document.addEventListener('keydown', (event) => {
    if (lightbox.open) {
      if (event.key === 'ArrowLeft') stepArtwork(-1);
      if (event.key === 'ArrowRight') stepArtwork(1);
      if (event.key === 'Escape') closeArtwork(true);
      if (event.key === '+' || event.key === '=') setZoom(lightboxZoom + .25);
      if (event.key === '-') setZoom(lightboxZoom - .25);
      if (event.key === '0') setZoom(1);
      return;
    }
    if (gallery.classList.contains('is-open')) {
      if (event.key === 'Escape') closeCollection(true);
      if (event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); openSearchBar(); }
      return;
    }
    if (!document.body.classList.contains('site-edit-mode')) {
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') { event.preventDefault(); focusNeighborDisc(1); }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') { event.preventDefault(); focusNeighborDisc(-1); }
    }
  });

  document.addEventListener('pointermove', (event) => {
    cursorLabel.style.left = `${event.clientX}px`;
    cursorLabel.style.top = `${event.clientY}px`;
    if (!document.body.classList.contains('collection-locked') || gallery.classList.contains('is-open')) return;
    if (event.pointerType === 'touch') return;
    const nx = (event.clientX / Math.max(window.innerWidth, 1)) - .5;
    const ny = (event.clientY / Math.max(window.innerHeight, 1)) - .5;
    discStage.style.setProperty('--stage-x', `${(nx * 3.2).toFixed(2)}px`);
    discStage.style.setProperty('--stage-y', `${(ny * 2.4).toFixed(2)}px`);
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (document.body.classList.contains('collection-locked') && !gallery.classList.contains('is-open') && !document.body.classList.contains('studio-open')) event.preventDefault();
  }, { passive: false });

  window.addEventListener('popstate', syncHash);
  window.addEventListener('hashchange', syncHash);
  window.addEventListener('online', () => announce('Connection restored.'));
  window.addEventListener('offline', () => announce('You are offline. Already loaded artwork remains available.'));

  syncHash();
  window.setTimeout(() => boot.classList.add('is-done'), 1050);
  window.dispatchEvent(new CustomEvent('lux:app-ready'));
})();
