(() => {
  const STORAGE_KEY = 'lux-site-live-editor-v1';

  // Apply locally saved edits before app.js renders the archive.
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && Array.isArray(saved.collections)) window.LUX_ARCHIVE = saved;
  } catch (_) {}

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  let active = false;
  let brandTaps = [];
  let selection = null;
  let hoverTarget = null;
  let outlineLoop = 0;
  let saveTimer = 0;
  let fileCallback = null;
  let dragState = null;
  let initialized = false;

  function init() {
    if (initialized || !window.LUX_APP) return;
    initialized = true;

    injectEditorUi();
    bindEditorUi();
    bindBrandGesture();
    bindEditableHover();
    bindDirectImageDrag();
    updateEditorBar();
  }

  function archive() {
    return window.LUX_APP?.getArchive?.() || window.LUX_ARCHIVE;
  }

  function currentCollection() {
    return window.LUX_APP?.getCurrentCollection?.() || null;
  }

  function injectEditorUi() {
    document.body.insertAdjacentHTML('beforeend', `
      <div class="site-editor-bar" id="siteEditorBar" aria-hidden="true">
        <div class="site-editor-bar__identity">
          <span class="site-editor-dot"></span>
          <strong>EDIT MODE</strong>
          <span id="siteEditorState">LOCAL</span>
        </div>
        <div class="site-editor-bar__actions">
          <button type="button" data-editor-global="site">SITE</button>
          <button type="button" data-editor-global="add-disc">＋ DISC</button>
          <button type="button" data-editor-global="add-image" id="siteEditorAddImage">＋ IMAGE</button>
          <button type="button" data-editor-global="save">SAVE</button>
          <button type="button" data-editor-global="export">EXPORT DATA.JS</button>
          <button type="button" data-editor-global="exit" class="site-editor-bar__exit">DONE</button>
        </div>
      </div>

      <div class="site-edit-outline" id="siteEditOutline" aria-hidden="true">
        <div class="site-edit-outline__tag" id="siteEditTag">DISC</div>
        <div class="site-edit-tools" id="siteEditTools"></div>
      </div>

      <aside class="site-editor-panel" id="siteEditorPanel" aria-hidden="true">
        <header class="site-editor-panel__head">
          <div>
            <span id="siteEditorPanelKicker">OBJECT</span>
            <strong id="siteEditorPanelTitle">EDIT</strong>
          </div>
          <button type="button" id="siteEditorPanelClose" aria-label="Close editor">×</button>
        </header>
        <div class="site-editor-panel__body" id="siteEditorPanelBody"></div>
      </aside>

      <input class="site-editor-file" id="siteEditorFile" type="file" accept="image/*" />
      <input class="site-editor-file" id="siteEditorBackupFile" type="file" accept="application/json,.json" />
      <div class="site-editor-toast" id="siteEditorToast" aria-live="polite"></div>
    `);
  }

  function bindEditorUi() {
    $('#siteEditorPanelClose').addEventListener('click', closePanel);
    $('#siteEditorBackupFile').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        const incoming = payload.archive || payload;
        if (!incoming || !Array.isArray(incoming.collections)) throw new Error('Invalid archive');
        if (!confirm('Replace the current local editor state with this backup?')) return;
        Object.keys(archive()).forEach(key => delete archive()[key]);
        Object.assign(archive(), clone(incoming));
        saveLocal(false);
        window.LUX_APP.refreshSiteSettings?.();
        closePanel();
        selection = null;
        hideOutline();
        toast('BACKUP RESTORED');
      } catch (_) { toast('INVALID BACKUP FILE'); }
    });

    $('#siteEditorFile').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file || !fileCallback) return;
      const callback = fileCallback;
      fileCallback = null;
      try {
        const data = await fileToPortableDataUrl(file);
        callback(data, file);
      } catch (_) {
        toast('IMAGE COULD NOT BE LOADED');
      }
    });

    $('#siteEditorBar').addEventListener('click', (event) => {
      const button = event.target.closest('[data-editor-global]');
      if (!button) return;
      const action = button.dataset.editorGlobal;
      if (action === 'site') openSitePanel();
      if (action === 'add-disc') addDisc();
      if (action === 'add-image') addArtwork();
      if (action === 'save') saveLocal(true);
      if (action === 'export') exportDataJs();
      if (action === 'exit') setEditMode(false);
    });

    $('#siteEditTools').addEventListener('click', (event) => {
      const button = event.target.closest('[data-edit-action]');
      const info = $('#siteEditOutline')._info || selection;
      if (!button || !info) return;
      event.preventDefault();
      event.stopPropagation();
      selection = info;
      handleItemAction(button.dataset.editAction);
    });
    $('#siteEditTools').addEventListener('pointerleave', () => {
      if (!active) return;
      if (selection?.target?.isConnected) setOutlineTarget(selection.target, false);
      else hideOutline();
    });

    const gallery = $('#gallery');
    new MutationObserver(updateEditorBar).observe(gallery, { attributes: true, attributeFilter: ['class'] });
    gallery.addEventListener('scroll', scheduleOutline, { passive: true });
    window.addEventListener('resize', scheduleOutline, { passive: true });
  }

  function bindBrandGesture() {
    const brand = $('.brand');
    if (!brand) return;
    brand.addEventListener('click', (event) => {
      event.preventDefault();
      const now = Date.now();
      brandTaps = brandTaps.filter(time => now - time < 2600);
      brandTaps.push(now);

      brand.classList.remove('is-editor-tap');
      void brand.offsetWidth;
      brand.classList.add('is-editor-tap');
      setTimeout(() => brand.classList.remove('is-editor-tap'), 180);

      if (brandTaps.length >= 5) {
        brandTaps = [];
        setEditMode(!active);
        return;
      }

      if (!active && $('#gallery')?.classList.contains('is-open')) {
        window.LUX_APP.closeCollection(true);
      }
    }, true);
  }

  function setEditMode(enabled) {
    active = Boolean(enabled);
    document.body.classList.toggle('site-edit-mode', active);
    $('#siteEditorBar').setAttribute('aria-hidden', active ? 'false' : 'true');
    selection = null;
    hoverTarget = null;
    closePanel();
    updateEditorBar();
    if (active) {
      toast('EDIT MODE ENABLED');
      startOutlineLoop();
    } else {
      hideOutline();
      toast('EDIT MODE CLOSED');
    }
  }

  function bindEditableHover() {
    document.addEventListener('pointerover', (event) => {
      if (!active) return;
      if (event.target.closest('.site-editor-bar, .site-editor-panel, .site-edit-tools, .studio')) return;
      const target = editableFromNode(event.target);
      if (!target) return;
      hoverTarget = target;
      if (!selection) setOutlineTarget(target, false);
      else if (selection.target !== target) setOutlineTarget(target, true);
    }, true);

    document.addEventListener('pointerout', (event) => {
      if (!active) return;
      const target = editableFromNode(event.target);
      if (!target || target.contains(event.relatedTarget)) return;
      if (event.relatedTarget instanceof Element && event.relatedTarget.closest('.site-edit-tools')) return;
      if (hoverTarget === target) hoverTarget = null;
      if (selection?.target) setOutlineTarget(selection.target, false);
      else hideOutline();
    }, true);

    document.addEventListener('click', (event) => {
      if (!active) return;
      if (event.target.closest('.site-editor-bar, .site-editor-panel, .site-edit-tools, .studio')) return;
      const target = editableFromNode(event.target);
      if (!target) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      selectTarget(target);
    }, true);
  }

  function editableFromNode(node) {
    if (!(node instanceof Element)) return null;
    return node.closest('.disc-card, .art-card');
  }

  function targetInfo(target) {
    if (!target) return null;
    if (target.classList.contains('disc-card')) {
      const id = target.dataset.collection;
      const index = archive().collections.findIndex(item => item.id === id);
      if (index < 0) return null;
      return { kind: 'disc', target, index, collection: archive().collections[index] };
    }
    if (target.classList.contains('art-card')) {
      const collection = currentCollection();
      const index = Number(target.dataset.artIndex);
      if (!collection || !Number.isInteger(index) || !collection.artworks[index]) return null;
      return { kind: 'art', target, index, collection, art: collection.artworks[index] };
    }
    return null;
  }

  function selectTarget(target) {
    const info = targetInfo(target);
    if (!info) return;
    selection = info;
    setOutlineTarget(target, false);
    renderOutlineTools(info.kind);
  }

  function setOutlineTarget(target, temporary = false) {
    const info = targetInfo(target);
    if (!info) return hideOutline();
    const outline = $('#siteEditOutline');
    outline.dataset.kind = info.kind;
    outline.dataset.temporary = temporary ? 'true' : 'false';
    $('#siteEditTag').textContent = info.kind === 'disc' ? `DISC ${info.collection.disc}` : `TRACK ${String(info.index + 1).padStart(2, '0')}`;
    renderOutlineTools(info.kind);
    outline._info = info;
    outline.classList.add('is-visible');
    outline.setAttribute('aria-hidden', 'false');
    outline._target = target;
    scheduleOutline();
  }

  function hideOutline() {
    const outline = $('#siteEditOutline');
    if (!outline) return;
    outline.classList.remove('is-visible');
    outline.setAttribute('aria-hidden', 'true');
    outline._target = null;
    outline._info = null;
  }

  function renderOutlineTools(kind) {
    const tools = $('#siteEditTools');
    if (kind === 'disc') {
      tools.innerHTML = `
        <button type="button" data-edit-action="edit">EDIT</button>
        <button type="button" data-edit-action="open">OPEN</button>
        <button type="button" data-edit-action="disc-left" aria-label="Move disc left">←</button>
        <button type="button" data-edit-action="disc-right" aria-label="Move disc right">→</button>
        <button type="button" data-edit-action="duplicate">DUP</button>
        <button type="button" data-edit-action="delete" aria-label="Delete disc">×</button>`;
    } else {
      tools.innerHTML = `
        <button type="button" data-edit-action="edit">EDIT</button>
        <button type="button" data-edit-action="replace">REPLACE</button>
        <button type="button" data-edit-action="left" aria-label="Move left">←</button>
        <button type="button" data-edit-action="right" aria-label="Move right">→</button>
        <button type="button" data-edit-action="delete" aria-label="Delete artwork">×</button>`;
    }
  }

  function startOutlineLoop() {
    if (outlineLoop) return;
    const loop = () => {
      outlineLoop = 0;
      if (!active) return;
      positionOutline();
      outlineLoop = requestAnimationFrame(loop);
    };
    outlineLoop = requestAnimationFrame(loop);
  }

  function scheduleOutline() {
    if (!active) return;
    requestAnimationFrame(positionOutline);
  }

  function positionOutline() {
    const outline = $('#siteEditOutline');
    if (!outline?.classList.contains('is-visible')) return;
    const target = outline._target;
    if (!target?.isConnected) {
      if (selection) restoreSelectionTarget();
      else return hideOutline();
    }
    const liveTarget = outline._target;
    if (!liveTarget?.isConnected) return;
    const rect = liveTarget.getBoundingClientRect();
    const pad = liveTarget.classList.contains('disc-card') ? 7 : 5;
    outline.style.left = `${Math.round(rect.left - pad)}px`;
    outline.style.top = `${Math.round(rect.top - pad)}px`;
    outline.style.width = `${Math.round(rect.width + pad * 2)}px`;
    outline.style.height = `${Math.round(rect.height + pad * 2)}px`;
  }

  function restoreSelectionTarget() {
    if (!selection) return;
    let target = null;
    if (selection.kind === 'disc') {
      target = $(`.disc-card[data-collection="${CSS.escape(selection.collection.id)}"]`);
    } else if ($('#gallery').classList.contains('is-open')) {
      target = $(`.art-card[data-art-index="${selection.index}"]`, $('#galleryGrid'));
    }
    if (!target) return;
    selection.target = target;
    $('#siteEditOutline')._target = target;
    $('#siteEditOutline')._info = selection;
    renderOutlineTools(selection.kind);
    positionOutline();
  }

  function handleItemAction(action) {
    if (!selection) return;
    if (action === 'edit') return openPanelForSelection();
    if (selection.kind === 'disc') {
      if (action === 'open') {
        window.LUX_APP.openCollection(selection.collection, true);
        closePanel();
        selection = null;
        hideOutline();
        setTimeout(updateEditorBar, 80);
      }
      if (action === 'disc-left') moveDisc(selection.index, -1);
      if (action === 'disc-right') moveDisc(selection.index, 1);
      if (action === 'duplicate') duplicateDisc(selection.index);
      if (action === 'delete') deleteDisc(selection.index);
      return;
    }
    if (action === 'replace') replaceArtwork(selection.index);
    if (action === 'left') moveArtwork(selection.index, -1);
    if (action === 'right') moveArtwork(selection.index, 1);
    if (action === 'delete') deleteArtwork(selection.index);
  }

  function openSitePanel() {
    selection = null;
    hideOutline();
    const panel = $('#siteEditorPanel');
    const a = archive();
    a.site ||= {};
    const site = a.site;
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    $('#siteEditorPanelKicker').textContent = 'GLOBAL / WEBSITE';
    $('#siteEditorPanelTitle').textContent = 'SITE SETTINGS';
    $('#siteEditorPanelBody').innerHTML = `
      <section class="site-editor-group">
        <div class="site-editor-group__title"><span>01</span><strong>IDENTITY</strong></div>
        ${panelField('OWNER / MARK', 'editSiteOwner', site.owner || 'LUX')}
        ${panelField('YEAR', 'editSiteYear', site.year || '2026')}
        ${panelField('BROWSER TITLE', 'editSiteTitle', site.title || 'LUX // ART ARCHIVE')}
        <label class="site-editor-field"><span>SITE DESCRIPTION</span><textarea id="editSiteDescription" rows="4">${escapeHtml(site.description || '')}</textarea></label>
      </section>
      <section class="site-editor-group">
        <div class="site-editor-group__title"><span>02</span><strong>HOME</strong></div>
        ${panelField('EYEBROW', 'editSiteEyebrow', site.heroEyebrow || 'DIGITAL WORK / SELECTED ARCHIVE')}
        ${panelField('HEADLINE', 'editSiteHeroTitle', site.heroTitle || 'Choose a disc.')}
        <label class="site-editor-field"><span>INTRO</span><textarea id="editSiteHeroSubtitle" rows="4">${escapeHtml(site.heroSubtitle || '')}</textarea></label>
        ${panelField('FOOTER LEFT', 'editSiteFooterLeft', site.footerLeft || 'LUX ART ARCHIVE')}
        ${panelField('FOOTER CENTER', 'editSiteFooterRight', site.footerRight || 'LUX INTERACTIVE ARCHIVE')}
      </section>
      <section class="site-editor-group">
        <div class="site-editor-group__title"><span>03</span><strong>BACKUP / PUBLISH</strong></div>
        <button class="site-editor-primary" id="editSiteExportData" type="button">EXPORT DATA.JS FOR GITHUB</button>
        <div class="site-editor-row-actions">
          <button type="button" id="editSiteExportBackup">BACKUP JSON</button>
          <button type="button" id="editSiteImportBackup">RESTORE JSON</button>
        </div>
        <button class="site-editor-danger" id="editSiteClearLocal" type="button">CLEAR LOCAL EDITS</button>
        <p class="site-editor-hint">The public GitHub Pages site cannot write directly to your repository. Export DATA.JS when you are ready to publish your visual-editor changes.</p>
      </section>`;

    const refresh = () => { window.LUX_APP.refreshSiteSettings?.(); scheduleSave(); };
    bindText('editSiteOwner', value => { site.owner = value; refresh(); });
    bindText('editSiteYear', value => { site.year = value; refresh(); });
    bindText('editSiteTitle', value => { site.title = value; refresh(); });
    bindText('editSiteDescription', value => { site.description = value; refresh(); });
    bindText('editSiteEyebrow', value => { site.heroEyebrow = value; refresh(); });
    bindText('editSiteHeroTitle', value => { site.heroTitle = value; refresh(); });
    bindText('editSiteHeroSubtitle', value => { site.heroSubtitle = value; refresh(); });
    bindText('editSiteFooterLeft', value => { site.footerLeft = value; refresh(); });
    bindText('editSiteFooterRight', value => { site.footerRight = value; refresh(); });
    $('#editSiteExportData').addEventListener('click', exportDataJs);
    $('#editSiteExportBackup').addEventListener('click', exportBackupJson);
    $('#editSiteImportBackup').addEventListener('click', () => $('#siteEditorBackupFile').click());
    $('#editSiteClearLocal').addEventListener('click', () => {
      if (!confirm('Clear all locally saved visual-editor changes and reload the repository version?')) return;
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    });
  }

  function openPanelForSelection() {
    if (!selection) return;
    const panel = $('#siteEditorPanel');
    panel.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    if (selection.kind === 'disc') renderDiscPanel(selection.collection);
    else renderArtworkPanel(selection.collection, selection.index);
  }

  function closePanel() {
    const panel = $('#siteEditorPanel');
    if (!panel) return;
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
  }

  function panelField(label, id, value, type = 'text', extra = '') {
    return `<label class="site-editor-field"><span>${label}</span><input id="${id}" type="${type}" value="${escapeHtml(value)}" ${extra}></label>`;
  }

  function rangeField(label, id, value, min, max, suffix = '') {
    return `<label class="site-editor-range"><span>${label}<output id="${id}Out">${escapeHtml(value)}${suffix}</output></span><input id="${id}" type="range" min="${min}" max="${max}" value="${escapeHtml(value)}"></label>`;
  }

  function renderDiscPanel(collection) {
    $('#siteEditorPanelKicker').textContent = `DISC ${collection.disc} / COLLECTION`;
    $('#siteEditorPanelTitle').textContent = collection.shortTitle || collection.title || 'DISC';
    $('#siteEditorPanelBody').innerHTML = `
      <section class="site-editor-group">
        <div class="site-editor-group__title"><span>01</span><strong>COLLECTION</strong></div>
        ${panelField('TITLE', 'editDiscTitle', collection.title || '')}
        ${panelField('SHORT TITLE', 'editDiscShort', collection.shortTitle || '')}
        ${panelField('EYEBROW', 'editDiscEyebrow', collection.eyebrow || '')}
        <label class="site-editor-field"><span>DESCRIPTION</span><textarea id="editDiscDescription" rows="4">${escapeHtml(collection.description || '')}</textarea></label>
      </section>

      <section class="site-editor-group">
        <div class="site-editor-group__title"><span>02</span><strong>DISC</strong></div>
        <div class="site-editor-two">
          <label class="site-editor-field"><span>MATERIAL</span><select id="editDiscStyle">
            ${['silver','white','smoke','clear','black'].map(v => `<option value="${v}" ${collection.discStyle === v ? 'selected' : ''}>${v.toUpperCase()}</option>`).join('')}
          </select></label>
          ${panelField('ACCENT', 'editDiscAccent', collection.accent || '#b9b6ff', 'color')}
        </div>
        <label class="site-editor-upload" for="editDiscCover"><input id="editDiscCover" type="file" accept="image/*"><span>＋</span><strong>${collection.coverImage ? 'REPLACE DISC ART' : 'UPLOAD DISC ART'}</strong><small>PNG / JPG / WEBP</small></label>
        ${collection.coverImage ? '<button class="site-editor-secondary" id="editDiscRemoveCover" type="button">REMOVE CUSTOM DISC ART</button>' : ''}
        <label class="site-editor-field"><span>IMAGE FIT</span><select id="editDiscFit"><option value="cover" ${collection.coverFit !== 'contain' ? 'selected' : ''}>COVER</option><option value="contain" ${collection.coverFit === 'contain' ? 'selected' : ''}>CONTAIN</option></select></label>
        ${rangeField('SCALE', 'editDiscScale', Number(collection.coverScale ?? 100), 40, 220, '%')}
        ${rangeField('ROTATION', 'editDiscRotation', Number(collection.coverRotation ?? 0), -180, 180, '°')}
        ${rangeField('HORIZONTAL', 'editDiscX', Number(collection.coverX ?? 0), -60, 60, '%')}
        ${rangeField('VERTICAL', 'editDiscY', Number(collection.coverY ?? 0), -60, 60, '%')}
        ${rangeField('OPACITY', 'editDiscOpacity', Number(collection.coverOpacity ?? 100), 0, 100, '%')}
      </section>

      <section class="site-editor-group">
        <div class="site-editor-group__title"><span>03</span><strong>CONTENT</strong></div>
        <button class="site-editor-primary" id="editDiscAddImage" type="button">＋ ADD IMAGE TO THIS DISC</button>
        <button class="site-editor-secondary" id="editDiscOpen" type="button">OPEN COLLECTION</button>
        <button class="site-editor-secondary" id="editDiscLab" type="button">ADVANCED DISC LAB</button>
      </section>
    `;

    bindText('editDiscTitle', value => { collection.title = value; refreshDisc(collection.id); });
    bindText('editDiscShort', value => { collection.shortTitle = value; refreshDisc(collection.id); });
    bindText('editDiscEyebrow', value => { collection.eyebrow = value; refreshDisc(collection.id); });
    bindText('editDiscDescription', value => { collection.description = value; refreshDisc(collection.id); });
    bindChange('editDiscStyle', value => { collection.discStyle = value; refreshDisc(collection.id); });
    bindInput('editDiscAccent', value => { collection.accent = value; refreshDisc(collection.id); });
    bindChange('editDiscFit', value => { collection.coverFit = value; refreshDisc(collection.id); });
    bindRange('editDiscScale', value => { collection.coverScale = value; refreshDisc(collection.id); }, '%');
    bindRange('editDiscRotation', value => { collection.coverRotation = value; refreshDisc(collection.id); }, '°');
    bindRange('editDiscX', value => { collection.coverX = value; refreshDisc(collection.id); }, '%');
    bindRange('editDiscY', value => { collection.coverY = value; refreshDisc(collection.id); }, '%');
    bindRange('editDiscOpacity', value => { collection.coverOpacity = value; refreshDisc(collection.id); }, '%');

    $('#editDiscCover').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      collection.coverImage = await fileToPortableDataUrl(file);
      collection.coverScale ??= 100;
      collection.coverOpacity ??= 100;
      collection.coverFit ??= 'cover';
      refreshDisc(collection.id);
      renderDiscPanel(collection);
      toast('DISC ART UPDATED');
    });
    $('#editDiscRemoveCover')?.addEventListener('click', () => {
      delete collection.coverImage;
      refreshDisc(collection.id);
      renderDiscPanel(collection);
    });
    $('#editDiscAddImage').addEventListener('click', () => addArtwork(collection));
    $('#editDiscOpen').addEventListener('click', () => {
      window.LUX_APP.openCollection(collection, true);
      closePanel();
      selection = null;
      hideOutline();
    });
    $('#editDiscLab').addEventListener('click', () => {
      if (window.LUX_STUDIO?.open) window.LUX_STUDIO.open();
      else location.hash = '#studio';
    });
  }

  function renderArtworkPanel(collection, index) {
    const art = collection.artworks[index];
    if (!art) return closePanel();
    $('#siteEditorPanelKicker').textContent = `DISC ${collection.disc} / TRACK ${String(index + 1).padStart(2, '0')}`;
    $('#siteEditorPanelTitle').textContent = art.title || 'ARTWORK';
    const layout = art.layout || (index % 5 === 0 ? 'wide' : 'compact');
    $('#siteEditorPanelBody').innerHTML = `
      <section class="site-editor-group">
        <div class="site-editor-group__title"><span>01</span><strong>ARTWORK</strong></div>
        ${panelField('TITLE', 'editArtTitle', art.title || '')}
        ${panelField('META', 'editArtMeta', art.meta || '')}
        <label class="site-editor-upload" for="editArtFile"><input id="editArtFile" type="file" accept="image/*"><span>↻</span><strong>REPLACE IMAGE</strong><small>PNG / JPG / WEBP</small></label>
      </section>

      <section class="site-editor-group">
        <div class="site-editor-group__title"><span>02</span><strong>LAYOUT</strong></div>
        <label class="site-editor-field"><span>CARD SIZE</span><select id="editArtLayout">
          ${[['compact','COMPACT'],['standard','STANDARD'],['wide','WIDE'],['hero','HERO']].map(([v,n]) => `<option value="${v}" ${layout === v ? 'selected' : ''}>${n}</option>`).join('')}
        </select></label>
        <label class="site-editor-field"><span>IMAGE FIT</span><select id="editArtFit"><option value="cover" ${art.fit !== 'contain' ? 'selected' : ''}>COVER</option><option value="contain" ${art.fit === 'contain' ? 'selected' : ''}>CONTAIN</option></select></label>
        ${rangeField('POSITION X', 'editArtX', Number(art.positionX ?? 50), 0, 100, '%')}
        ${rangeField('POSITION Y', 'editArtY', Number(art.positionY ?? 50), 0, 100, '%')}
        ${rangeField('SCALE', 'editArtScale', Number(art.scale ?? 100), 70, 180, '%')}
        ${rangeField('ROTATION', 'editArtRotation', Number(art.rotation ?? 0), -30, 30, '°')}
        <p class="site-editor-hint">TIP: while Edit Mode is active, drag directly on a selected image to reposition its crop.</p>
      </section>

      <section class="site-editor-group">
        <div class="site-editor-group__title"><span>03</span><strong>ORDER</strong></div>
        <div class="site-editor-row-actions">
          <button type="button" id="editArtPrev">← MOVE LEFT</button>
          <button type="button" id="editArtNext">MOVE RIGHT →</button>
        </div>
        <button class="site-editor-danger" id="editArtDelete" type="button">DELETE ARTWORK</button>
      </section>
    `;

    bindText('editArtTitle', value => { art.title = value; refreshArt(index); });
    bindText('editArtMeta', value => { art.meta = value; refreshArt(index); });
    bindChange('editArtLayout', value => { art.layout = value; refreshArt(index); });
    bindChange('editArtFit', value => { art.fit = value; refreshArt(index); });
    bindRange('editArtX', value => { art.positionX = value; refreshArt(index); }, '%');
    bindRange('editArtY', value => { art.positionY = value; refreshArt(index); }, '%');
    bindRange('editArtScale', value => { art.scale = value; refreshArt(index); }, '%');
    bindRange('editArtRotation', value => { art.rotation = value; refreshArt(index); }, '°');

    $('#editArtFile').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      art.image = await fileToPortableDataUrl(file);
      refreshArt(index);
      toast('IMAGE REPLACED');
    });
    $('#editArtPrev').addEventListener('click', () => moveArtwork(index, -1));
    $('#editArtNext').addEventListener('click', () => moveArtwork(index, 1));
    $('#editArtDelete').addEventListener('click', () => deleteArtwork(index));
  }

  function bindText(id, callback) {
    const el = $(`#${id}`);
    el?.addEventListener('input', () => { callback(el.value); scheduleSave(); });
  }
  function bindInput(id, callback) {
    const el = $(`#${id}`);
    el?.addEventListener('input', () => { callback(el.value); scheduleSave(); });
  }
  function bindChange(id, callback) {
    const el = $(`#${id}`);
    el?.addEventListener('change', () => { callback(el.value); scheduleSave(); });
  }
  function bindRange(id, callback, suffix = '') {
    const el = $(`#${id}`), out = $(`#${id}Out`);
    el?.addEventListener('input', () => {
      const value = Number(el.value);
      if (out) out.value = `${value}${suffix}`;
      callback(value);
      scheduleSave();
    });
  }

  function refreshDisc(id) {
    window.LUX_APP.rebuildDiscs();
    if (currentCollection()?.id === id) window.LUX_APP.refreshCurrentGallery();
    if (selection?.kind === 'disc' && selection.collection.id === id) {
      selection.target = $(`.disc-card[data-collection="${CSS.escape(id)}"]`);
      $('#siteEditOutline')._target = selection.target;
    }
    scheduleOutline();
    scheduleSave();
  }

  function refreshArt(index) {
    const top = $('#gallery').scrollTop;
    window.LUX_APP.refreshCurrentGallery();
    $('#gallery').scrollTop = top;
    if (selection?.kind === 'art') {
      selection.index = index;
      selection.art = currentCollection()?.artworks[index];
      selection.target = $(`.art-card[data-art-index="${index}"]`, $('#galleryGrid'));
      $('#siteEditOutline')._target = selection.target;
    }
    scheduleOutline();
    scheduleSave();
  }

  function renumberDiscs() {
    archive().collections.forEach((collection, index) => collection.disc = String(index + 1).padStart(2, '0'));
  }

  function addDisc() {
    const a = archive();
    const index = a.collections.length;
    const id = `custom-${Date.now().toString(36)}`;
    const collection = {
      id,
      disc: String(index + 1).padStart(2, '0'),
      title: 'NEW COLLECTION',
      shortTitle: 'NEW DISC',
      eyebrow: 'CUSTOM / LUX EDITOR',
      description: 'A new collection created in Edit Mode.',
      discStyle: 'silver',
      accent: '#b9b6ff',
      artworks: []
    };
    a.collections.push(collection);
    window.LUX_APP.rebuildDiscs();
    saveLocal();
    setTimeout(() => {
      const target = $(`.disc-card[data-collection="${CSS.escape(id)}"]`);
      if (target) {
        selectTarget(target);
        openPanelForSelection();
      }
    }, 30);
    toast('NEW DISC ADDED');
  }

  function moveDisc(index, direction) {
    const a = archive();
    const next = clamp(index + direction, 0, a.collections.length - 1);
    if (next === index) return;
    [a.collections[index], a.collections[next]] = [a.collections[next], a.collections[index]];
    renumberDiscs();
    window.LUX_APP.rebuildDiscs();
    saveLocal();
    selection = null;
    hideOutline();
    setTimeout(() => {
      const target = $(`.disc-card[data-collection="${CSS.escape(a.collections[next].id)}"]`);
      if (target) selectTarget(target);
    }, 30);
    toast('DISC MOVED');
  }

  function duplicateDisc(index) {
    const a = archive();
    const source = a.collections[index];
    if (!source) return;
    const copy = clone(source);
    copy.id = `${source.id}-copy-${Date.now().toString(36)}`;
    copy.title = `${source.title} COPY`;
    a.collections.splice(index + 1, 0, copy);
    renumberDiscs();
    window.LUX_APP.rebuildDiscs();
    saveLocal();
    selection = null;
    hideOutline();
    toast('DISC DUPLICATED');
  }

  function deleteDisc(index) {
    const a = archive();
    const item = a.collections[index];
    if (!item) return;
    if (!confirm(`Delete ${item.title}?`)) return;
    if (currentCollection()?.id === item.id) window.LUX_APP.closeCollection(true);
    a.collections.splice(index, 1);
    renumberDiscs();
    window.LUX_APP.rebuildDiscs();
    saveLocal();
    selection = null;
    hideOutline();
    closePanel();
    toast('DISC DELETED');
  }

  function addArtwork(collection = currentCollection()) {
    if (!collection) return toast('OPEN OR EDIT A DISC FIRST');
    chooseFile(async data => {
      const art = {
        title: `Artwork ${String(collection.artworks.length + 1).padStart(2, '0')}`,
        meta: `DIGITAL / ${archive().site?.year || '2026'}`,
        image: data,
        layout: 'compact',
        fit: 'cover',
        positionX: 50,
        positionY: 50,
        scale: 100,
        rotation: 0
      };
      collection.artworks.push(art);
      saveLocal();
      if (currentCollection()?.id !== collection.id) {
        window.LUX_APP.openCollection(collection, true);
      } else {
        window.LUX_APP.refreshCurrentGallery();
      }
      const index = collection.artworks.length - 1;
      setTimeout(() => {
        const target = $(`.art-card[data-art-index="${index}"]`, $('#galleryGrid'));
        if (target) {
          selectTarget(target);
          openPanelForSelection();
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 60);
      toast('IMAGE ADDED');
    });
  }

  function replaceArtwork(index) {
    const collection = currentCollection();
    const art = collection?.artworks[index];
    if (!art) return;
    chooseFile(data => {
      art.image = data;
      refreshArt(index);
      saveLocal();
      toast('IMAGE REPLACED');
    });
  }

  function moveArtwork(index, direction) {
    const collection = currentCollection();
    if (!collection) return;
    const next = clamp(index + direction, 0, collection.artworks.length - 1);
    if (next === index) return;
    [collection.artworks[index], collection.artworks[next]] = [collection.artworks[next], collection.artworks[index]];
    window.LUX_APP.refreshCurrentGallery();
    saveLocal();
    selection = null;
    setTimeout(() => {
      const target = $(`.art-card[data-art-index="${next}"]`, $('#galleryGrid'));
      if (target) selectTarget(target);
    }, 30);
    if ($('#siteEditorPanel').classList.contains('is-open')) {
      selection = { kind:'art', index: next, collection, art: collection.artworks[next], target: null };
      renderArtworkPanel(collection, next);
    }
  }

  function deleteArtwork(index) {
    const collection = currentCollection();
    const art = collection?.artworks[index];
    if (!art || !confirm(`Delete ${art.title}?`)) return;
    collection.artworks.splice(index, 1);
    window.LUX_APP.refreshCurrentGallery();
    saveLocal();
    selection = null;
    hideOutline();
    closePanel();
    toast('ARTWORK DELETED');
  }

  function chooseFile(callback) {
    fileCallback = callback;
    $('#siteEditorFile').click();
  }

  function bindDirectImageDrag() {
    document.addEventListener('pointerdown', (event) => {
      if (!active || !selection || selection.kind !== 'art') return;
      if (!selection.target?.contains(event.target)) return;
      if (!event.target.closest('.art-card__image-wrap')) return;
      if (event.target.closest('.site-edit-tools')) return;
      const art = selection.art;
      const rect = selection.target.querySelector('.art-card__image-wrap').getBoundingClientRect();
      dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        baseX: Number(art.positionX ?? 50),
        baseY: Number(art.positionY ?? 50),
        rect,
        art,
        image: selection.target.querySelector('img')
      };
      selection.target.setPointerCapture?.(event.pointerId);
      selection.target.classList.add('is-editor-dragging');
      event.preventDefault();
    }, true);

    document.addEventListener('pointermove', (event) => {
      if (!dragState || event.pointerId !== dragState.pointerId) return;
      const dx = (event.clientX - dragState.startX) / Math.max(1, dragState.rect.width) * 100;
      const dy = (event.clientY - dragState.startY) / Math.max(1, dragState.rect.height) * 100;
      dragState.art.positionX = clamp(Math.round(dragState.baseX + dx), 0, 100);
      dragState.art.positionY = clamp(Math.round(dragState.baseY + dy), 0, 100);
      if (dragState.image) {
        dragState.image.style.objectPosition = `${dragState.art.positionX}% ${dragState.art.positionY}%`;
      }
      const x = $('#editArtX'), y = $('#editArtY');
      if (x) x.value = dragState.art.positionX;
      if (y) y.value = dragState.art.positionY;
      if ($('#editArtXOut')) $('#editArtXOut').value = `${dragState.art.positionX}%`;
      if ($('#editArtYOut')) $('#editArtYOut').value = `${dragState.art.positionY}%`;
      event.preventDefault();
    }, true);

    const finish = (event) => {
      if (!dragState || (event.pointerId != null && event.pointerId !== dragState.pointerId)) return;
      selection?.target?.classList.remove('is-editor-dragging');
      dragState = null;
      scheduleSave();
    };
    document.addEventListener('pointerup', finish, true);
    document.addEventListener('pointercancel', finish, true);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    const state = $('#siteEditorState');
    if (state) state.textContent = 'UNSAVED';
    saveTimer = setTimeout(() => saveLocal(false), 500);
  }

  function saveLocal(showToast = false) {
    clearTimeout(saveTimer);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(archive()));
      const state = $('#siteEditorState');
      if (state) state.textContent = 'SAVED LOCAL';
      if (showToast) toast('CHANGES SAVED ON THIS DEVICE');
    } catch (_) {
      const state = $('#siteEditorState');
      if (state) state.textContent = 'STORAGE FULL';
      toast('BROWSER STORAGE FULL — EXPORT DATA.JS');
    }
  }

  function exportBackupJson() {
    saveLocal(false);
    const payload = {
      format: 'lux-art-archive-backup',
      version: 1,
      exportedAt: new Date().toISOString(),
      archive: archive()
    };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), 'lux-art-archive-backup.json');
    toast('BACKUP EXPORTED');
  }

  function exportDataJs() {
    saveLocal(false);
    const payload = `/* LUX ART ARCHIVE — exported from the hidden live editor.\n   Replace your repository data.js with this file, then commit/push. */\n\nwindow.LUX_ARCHIVE = ${JSON.stringify(archive(), null, 2)};\n`;
    downloadBlob(new Blob([payload], { type: 'text/javascript' }), 'data.js');
    toast('DATA.JS EXPORTED');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  async function fileToPortableDataUrl(file) {
    const raw = await readAsDataUrl(file);
    if (file.type === 'image/gif' || file.type === 'image/svg+xml') return raw;
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const max = 1600;
          const ratio = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
          const width = Math.max(1, Math.round(img.naturalWidth * ratio));
          const height = Math.max(1, Math.round(img.naturalHeight * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/webp', .88));
        } catch (_) { resolve(raw); }
      };
      img.onerror = () => resolve(raw);
      img.src = raw;
    });
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function updateEditorBar() {
    const addImage = $('#siteEditorAddImage');
    if (!addImage) return;
    const hasCollection = Boolean(currentCollection() && $('#gallery').classList.contains('is-open'));
    addImage.disabled = !hasCollection;
    addImage.title = hasCollection ? 'Add image to this collection' : 'Open a collection to add an image';
  }

  function toast(message) {
    const el = $('#siteEditorToast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('is-visible'), 1900);
  }

  window.LUX_LIVE_EDITOR = {
    enable: () => setEditMode(true),
    disable: () => setEditMode(false),
    toggle: () => setEditMode(!active),
    exportData: exportDataJs
  };

  if (window.LUX_APP) init();
  else window.addEventListener('lux:app-ready', init, { once: true });
})();
