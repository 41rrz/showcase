(() => {
  const archive = window.LUX_ARCHIVE;
  if (!archive || !Array.isArray(archive.collections)) return;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const boot = $('#boot');
  const discStage = $('#discStage');
  const gallery = $('#gallery');
  const galleryGrid = $('#galleryGrid');
  const cursorLabel = $('#cursorLabel');
  const lightbox = $('#lightbox');
  const stageStatus = $('#stageStatus');
  const discRange = $('#discRange');

  let currentCollection = null;
  let currentArtworkIndex = 0;
  let routeLock = false;

  const pad = (n) => String(n).padStart(2, '0');
  const defaultAccent = '#9f95ff';

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function setText(node, value) {
    if (node) node.textContent = value;
  }

  function setAccent(color = defaultAccent) {
    document.documentElement.style.setProperty('--active-accent', color);
  }

  function createDiscMotion(card, disc) {
    const state = {
      currentX: 0,
      currentY: 0,
      targetX: 0,
      targetY: 0,
      currentMX: 50,
      currentMY: 50,
      targetMX: 50,
      targetMY: 50,
      raf: 0,
      active: false,
    };

    function render() {
      state.currentX += (state.targetX - state.currentX) * 0.14;
      state.currentY += (state.targetY - state.currentY) * 0.14;
      state.currentMX += (state.targetMX - state.currentMX) * 0.14;
      state.currentMY += (state.targetMY - state.currentMY) * 0.14;

      disc.style.setProperty('--tilt-x', `${state.currentX.toFixed(2)}deg`);
      disc.style.setProperty('--tilt-y', `${state.currentY.toFixed(2)}deg`);
      disc.style.setProperty('--mx', `${state.currentMX.toFixed(1)}%`);
      disc.style.setProperty('--my', `${state.currentMY.toFixed(1)}%`);

      const settled =
        Math.abs(state.targetX - state.currentX) < 0.03 &&
        Math.abs(state.targetY - state.currentY) < 0.03 &&
        Math.abs(state.targetMX - state.currentMX) < 0.08 &&
        Math.abs(state.targetMY - state.currentMY) < 0.08;

      if (state.active || !settled) {
        state.raf = requestAnimationFrame(render);
      } else {
        state.raf = 0;
      }
    }

    function wake() {
      if (!state.raf) state.raf = requestAnimationFrame(render);
    }

    function update(event) {
      const r = disc.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (event.clientX - r.left) / r.width));
      const y = Math.max(0, Math.min(1, (event.clientY - r.top) / r.height));
      const strength = event.pointerType === 'touch' ? 6.8 : 9.5;
      state.targetY = (x - 0.5) * strength;
      state.targetX = (0.5 - y) * strength;
      state.targetMX = x * 100;
      state.targetMY = y * 100;
      wake();
    }

    function enter() {
      state.active = true;
      wake();
    }

    function leave() {
      state.active = false;
      state.targetX = 0;
      state.targetY = 0;
      state.targetMX = 50;
      state.targetMY = 50;
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
          <div class="disc-card__disc" style="--disc-accent:${collection.accent}">
            <div class="disc-rotor">
              <div class="disc-face disc-face--${collection.discStyle}"></div>
              <span class="disc-grooves"></span>
              <div class="disc-graphic" style="color:${collection.accent}">
                <span class="disc-ring disc-ring--a"></span>
                <span class="disc-ring disc-ring--b"></span>
                <span class="disc-slash"></span>
                <span class="disc-ticks"></span>
                <span class="disc-micro disc-micro--top">LUX • ARCHIVE • ${collection.disc}</span>
                <span class="disc-micro disc-micro--side">DIGITAL OBJECT / ${archive.site.year}</span>
                <span class="disc-label">${escapeHtml(collection.shortTitle)}<small>LUX / DISC ${collection.disc}</small></span>
              </div>
              <span class="disc-center"></span>
              <span class="disc-holo"></span>
              <span class="disc-sweep"></span>
            </div>
            <span class="disc-glint"></span>
          </div>
        </div>
        <div class="disc-card__meta">
          <span class="disc-card__meta-left">
            <strong>${escapeHtml(collection.title)}</strong>
            <span>DISC ${collection.disc} / ${archive.site.year}</span>
          </span>
          <span class="disc-card__count">${pad(collection.artworks.length)} TRACKS</span>
        </div>
      </button>
    `).join('');

    $$('.disc-card', discStage).forEach((card) => {
      const disc = $('.disc-card__disc', card);
      const collection = archive.collections.find(c => c.id === card.dataset.collection);
      const motion = createDiscMotion(card, disc);

      card.addEventListener('pointermove', (event) => {
        if (routeLock) return;
        motion.update(event);
      });

      card.addEventListener('pointerenter', (event) => {
        if (!collection) return;
        motion.enter();
        motion.update(event);
        setAccent(collection.accent);
        document.body.classList.add('has-disc-focus');
        setText(stageStatus, `DISC ${collection.disc} / ${collection.shortTitle}`);
        if (event.pointerType !== 'touch') cursorLabel.classList.add('is-visible');
      });

      card.addEventListener('pointerdown', (event) => {
        if (!collection || routeLock) return;
        card.classList.add('is-pressed');
        motion.enter();
        motion.update(event);
        setAccent(collection.accent);
        setText(stageStatus, `LOADING DISC ${collection.disc}`);
        try { card.setPointerCapture(event.pointerId); } catch (_) {}
      });

      const releasePress = () => card.classList.remove('is-pressed');
      card.addEventListener('pointerup', releasePress);
      card.addEventListener('pointercancel', releasePress);

      card.addEventListener('pointerleave', () => {
        releasePress();
        motion.leave();
        cursorLabel.classList.remove('is-visible');
        document.body.classList.remove('has-disc-focus');
        setText(stageStatus, 'MOVE / TOUCH TO INSPECT');
        if (!routeLock) setAccent(defaultAccent);
      });

      card.addEventListener('click', () => {
        if (collection) animateOpenCollection(collection, card);
      });
    });
  }

  function animateOpenCollection(collection, card) {
    if (routeLock) return;
    routeLock = true;
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

  function openCollection(collection, updateHash = false) {
    currentCollection = collection;
    currentArtworkIndex = 0;

    setText($('#galleryDiscNumber'), `DISC ${collection.disc}`);
    setText($('#galleryMiniTitle'), collection.shortTitle);
    setText($('#galleryCounter'), `${pad(collection.artworks.length)} TRACKS`);
    setText($('#galleryEyebrow'), collection.eyebrow);
    setText($('#galleryTitle'), collection.title);
    setText($('#galleryDescription'), collection.description);
    setText($('#galleryFooterCode'), `DISC / ${collection.disc}`);

    galleryGrid.innerHTML = collection.artworks.map((art, index) => `
      <button class="art-card" data-art-index="${index}" aria-label="Open ${escapeHtml(art.title)}">
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

    $$('.art-card', galleryGrid).forEach((artCard) => {
      artCard.addEventListener('click', () => openArtwork(Number(artCard.dataset.artIndex)));
    });

    gallery.classList.add('is-open');
    gallery.setAttribute('aria-hidden', 'false');
    document.body.classList.add('gallery-open');
    gallery.scrollTop = 0;

    if (updateHash) history.pushState({ collection: collection.id }, '', `#gallery/${collection.id}`);
  }

  function closeCollection(updateHash = true) {
    gallery.classList.remove('is-open');
    gallery.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('gallery-open');
    currentCollection = null;
    setAccent(defaultAccent);
    if (updateHash) history.pushState({}, '', location.pathname + location.search);
  }

  function openArtwork(index) {
    if (!currentCollection) return;
    currentArtworkIndex = Math.max(0, Math.min(index, currentCollection.artworks.length - 1));
    const art = currentCollection.artworks[currentArtworkIndex];
    $('#lightboxImage').src = art.image;
    $('#lightboxImage').alt = art.title;
    setText($('#lightboxTrack'), `TRACK ${pad(currentArtworkIndex + 1)} / ${pad(currentCollection.artworks.length)}`);
    setText($('#lightboxTitle'), art.title);
    setText($('#lightboxMeta'), art.meta);
    if (!lightbox.open) lightbox.showModal();
  }

  function stepArtwork(direction) {
    if (!currentCollection) return;
    const total = currentCollection.artworks.length;
    currentArtworkIndex = (currentArtworkIndex + direction + total) % total;
    openArtwork(currentArtworkIndex);
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

  buildDiscs();

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
      if (event.key === 'Escape') lightbox.close();
      return;
    }
    if (event.key === 'Escape' && gallery.classList.contains('is-open')) closeCollection(true);
  });

  document.addEventListener('pointermove', (event) => {
    cursorLabel.style.left = `${event.clientX}px`;
    cursorLabel.style.top = `${event.clientY}px`;

    if (!document.body.classList.contains('collection-locked') || gallery.classList.contains('is-open')) return;
    if (event.pointerType === 'touch') return;
    const nx = (event.clientX / Math.max(window.innerWidth, 1)) - 0.5;
    const ny = (event.clientY / Math.max(window.innerHeight, 1)) - 0.5;
    discStage.style.setProperty('--stage-x', `${(nx * 4).toFixed(2)}px`);
    discStage.style.setProperty('--stage-y', `${(ny * 3).toFixed(2)}px`);
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (document.body.classList.contains('collection-locked') && !gallery.classList.contains('is-open')) {
      event.preventDefault();
    }
  }, { passive: false });

  window.addEventListener('popstate', syncHash);
  window.addEventListener('hashchange', syncHash);

  syncHash();
  window.setTimeout(() => boot.classList.add('is-done'), 1120);
})();
