(() => {
  const studio = document.querySelector('#studio');
  const canvas = document.querySelector('#studioCanvas');
  if (!studio || !canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  const $ = (selector) => studio.querySelector(selector);
  const $$ = (selector) => [...studio.querySelectorAll(selector)];
  const brand = document.querySelector('.brand');

  const fields = {
    title: $('#studioTitle'), subtitle: $('#studioSubtitle'), serial: $('#studioSerial'),
    accent: $('#studioAccent'), background: $('#studioBackground'), material: $('#studioMaterial'),
    graphic: $('#studioGraphic'), artworkInput: $('#studioArtworkInput'), scale: $('#studioScale'),
    rotation: $('#studioRotation'), opacity: $('#studioOpacity'), x: $('#studioX'), y: $('#studioY'),
    holo: $('#studioHolo'), detail: $('#studioDetail'), transparent: $('#studioTransparent'), guides: $('#studioGuides')
  };

  const defaults = {
    mode: 'disc', title: 'UNTITLED', subtitle: 'LUX / DIGITAL ARCHIVE', serial: 'LUX-001 / 2026',
    accent: '#b9b6ff', background: '#0b0b0d', material: 'silver', graphic: 'rings',
    scale: 100, rotation: 0, opacity: 100, x: 0, y: 0, holo: 35, detail: 65,
    transparent: true, guides: false, artworkData: ''
  };

  let state = { ...defaults };
  let artworkImage = null;
  let drag = null;
  let drawQueued = false;

  const rangeOutputs = {
    scale: $('#studioScaleValue'), rotation: $('#studioRotationValue'), opacity: $('#studioOpacityValue'),
    x: $('#studioXValue'), y: $('#studioYValue'), holo: $('#studioHoloValue'), detail: $('#studioDetailValue')
  };

  function safeName(value) {
    return String(value || 'lux-object').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'lux-object';
  }

  function hexToRgb(hex) {
    const value = hex.replace('#', '');
    const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value;
    const n = Number.parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgba(hex, alpha) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${alpha})`;
  }

  function mix(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    const c = {
      r: Math.round(a.r + (b.r - a.r) * t),
      g: Math.round(a.g + (b.g - a.g) * t),
      b: Math.round(a.b + (b.b - a.b) * t)
    };
    return `rgb(${c.r},${c.g},${c.b})`;
  }

  function fitText(text, maxWidth, startSize, minSize = 18) {
    let size = startSize;
    ctx.font = `700 ${size}px Inter, Arial, sans-serif`;
    while (size > minSize && ctx.measureText(text).width > maxWidth) {
      size -= 2;
      ctx.font = `700 ${size}px Inter, Arial, sans-serif`;
    }
    return size;
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function drawArtwork(clipPath = null, coverMode = false) {
    if (!artworkImage) return;
    ctx.save();
    if (clipPath) ctx.clip(clipPath);
    ctx.globalAlpha = state.opacity / 100;
    const base = coverMode ? 930 : 760;
    const ratio = artworkImage.width / artworkImage.height || 1;
    let w, h;
    if (ratio >= 1) { w = base * (state.scale / 100); h = w / ratio; }
    else { h = base * (state.scale / 100); w = h * ratio; }
    const cx = 500 + Number(state.x);
    const cy = 500 + Number(state.y);
    ctx.translate(cx, cy);
    ctx.rotate(Number(state.rotation) * Math.PI / 180);
    ctx.drawImage(artworkImage, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function drawGraphicSystem(radius = 455, coverMode = false) {
    const accent = state.accent;
    const detail = state.detail / 100;
    ctx.save();
    ctx.strokeStyle = rgba(accent, .55 * detail);
    ctx.fillStyle = rgba(accent, .28 * detail);
    ctx.lineWidth = coverMode ? 3 : 2;

    if (state.graphic === 'rings') {
      [0.58, 0.72].forEach((scale, i) => {
        ctx.beginPath();
        ctx.arc(500, 500, radius * scale, (-0.2 + i * .7) * Math.PI, (1.1 + i * .55) * Math.PI);
        ctx.stroke();
      });
      ctx.beginPath();
      ctx.arc(500, 500, radius * .82, .2 * Math.PI, .35 * Math.PI);
      ctx.stroke();
    } else if (state.graphic === 'slash') {
      ctx.save();
      ctx.translate(500, 500);
      ctx.rotate(-Math.PI / 4.5);
      roundRect(-radius * .55, -radius * .055, radius * 1.1, radius * .11, 999);
      ctx.fill();
      ctx.restore();
    } else if (state.graphic === 'barcode') {
      const x0 = coverMode ? 105 : 285;
      const y0 = coverMode ? 120 : 310;
      const h = coverMode ? 220 : 185;
      const widths = [6,2,10,4,3,8,2,12,4,7,2,3,11,5,2,8,4,3,9,2,6,12,3,5];
      let x = x0;
      widths.forEach((w, i) => {
        ctx.globalAlpha = .2 + ((i % 4) / 5) * detail;
        ctx.fillRect(x, y0, w, h);
        x += w + 6;
      });
      ctx.globalAlpha = 1;
    } else if (state.graphic === 'grid') {
      ctx.globalAlpha = .35 * detail;
      const step = coverMode ? 72 : 60;
      for (let i = -6; i <= 6; i++) {
        ctx.beginPath(); ctx.moveTo(500 + i * step, 160); ctx.lineTo(500 + i * step, 840); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(160, 500 + i * step); ctx.lineTo(840, 500 + i * step); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawHolographic(clipCircle = true) {
    if (state.holo <= 0) return;
    const alpha = state.holo / 100 * .30;
    ctx.save();
    if (clipCircle) {
      ctx.beginPath(); ctx.arc(500, 500, 455, 0, Math.PI * 2); ctx.clip();
    }
    let g;
    if (ctx.createConicGradient) {
      g = ctx.createConicGradient(-Math.PI / 3, 500, 500);
      g.addColorStop(0, `rgba(120,190,255,${alpha})`);
      g.addColorStop(.16, `rgba(255,130,215,${alpha * .75})`);
      g.addColorStop(.34, `rgba(165,255,225,${alpha * .65})`);
      g.addColorStop(.55, `rgba(255,225,150,${alpha * .6})`);
      g.addColorStop(.74, `rgba(170,150,255,${alpha * .7})`);
      g.addColorStop(1, `rgba(120,190,255,${alpha})`);
    } else {
      g = ctx.createLinearGradient(100, 100, 900, 900);
      g.addColorStop(0, `rgba(120,190,255,${alpha})`);
      g.addColorStop(.5, `rgba(255,130,215,${alpha})`);
      g.addColorStop(1, `rgba(165,255,225,${alpha})`);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.restore();
  }

  function drawDisc() {
    ctx.clearRect(0, 0, 1000, 1000);
    if (!state.transparent) {
      ctx.fillStyle = state.background;
      ctx.fillRect(0, 0, 1000, 1000);
    }

    const radius = 455;
    ctx.save();
    ctx.beginPath(); ctx.arc(500, 500, radius, 0, Math.PI * 2); ctx.clip();

    const materialStops = {
      silver: ['#e2e3e7', '#8b9099', '#272a30'],
      white: ['#ffffff', '#e1e3e7', '#aeb3bc'],
      smoke: ['#777b84', '#373b43', '#101217'],
      clear: ['rgba(245,246,250,.82)', 'rgba(167,173,185,.42)', 'rgba(55,60,70,.68)'],
      black: ['#555860', '#17191e', '#050506']
    };
    const colors = materialStops[state.material] || materialStops.silver;
    const g = ctx.createRadialGradient(400, 340, 40, 500, 500, 600);
    g.addColorStop(0, colors[0]); g.addColorStop(.56, colors[1]); g.addColorStop(1, colors[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1000, 1000);

    drawArtwork(null, false);

    const sheen = ctx.createLinearGradient(170, 120, 850, 880);
    sheen.addColorStop(0, 'rgba(255,255,255,.34)');
    sheen.addColorStop(.35, 'rgba(255,255,255,.02)');
    sheen.addColorStop(.62, rgba(state.accent, .10));
    sheen.addColorStop(1, 'rgba(255,255,255,.03)');
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, 1000, 1000);
    ctx.restore();

    drawHolographic(true);

    ctx.save();
    ctx.beginPath(); ctx.arc(500, 500, radius, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = .18 * (state.detail / 100);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    for (let r = 120; r < 445; r += 18) { ctx.beginPath(); ctx.arc(500, 500, r, 0, Math.PI * 2); ctx.stroke(); }
    ctx.globalAlpha = 1;
    drawGraphicSystem(radius, false);

    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    const titleSize = fitText(state.title, 500, 42, 18);
    ctx.font = `700 ${titleSize}px Inter, Arial, sans-serif`;
    ctx.letterSpacing = '4px';
    ctx.fillText(state.title.toUpperCase(), 500, 735);
    ctx.font = '500 16px Inter, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.52)';
    ctx.fillText(state.subtitle.toUpperCase(), 500, 766);
    ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = 'rgba(255,255,255,.42)';
    ctx.fillText(state.serial.toUpperCase(), 500, 192);

    ctx.strokeStyle = rgba(state.accent, .48); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(500, 500, 360, -.72, .6); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(500, 500, 67, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(500, 500, 82, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.42)'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(500, 500, radius - 2, 0, Math.PI * 2); ctx.stroke();

    if (state.guides) drawGuides(true);
  }

  function drawCover() {
    ctx.clearRect(0, 0, 1000, 1000);
    const g = ctx.createRadialGradient(720, 180, 20, 500, 500, 760);
    g.addColorStop(0, mix(state.background, state.accent, .22));
    g.addColorStop(.42, state.background);
    g.addColorStop(1, mix(state.background, '#000000', .55));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1000, 1000);

    drawArtwork(null, true);
    ctx.fillStyle = `rgba(0,0,0,${0.18 + (1 - state.detail / 100) * .25})`;
    ctx.fillRect(0, 0, 1000, 1000);
    drawHolographic(false);
    drawGraphicSystem(430, true);

    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2;
    ctx.strokeRect(52, 52, 896, 896);
    ctx.strokeStyle = rgba(state.accent, .85); ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(52, 52); ctx.lineTo(290, 52); ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    const titleSize = fitText(state.title, 760, 98, 38);
    ctx.font = `700 ${titleSize}px Inter, Arial, sans-serif`;
    ctx.fillText(state.title.toUpperCase(), 90, 800);
    ctx.font = '500 22px Inter, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,.62)';
    ctx.fillText(state.subtitle.toUpperCase(), 94, 842);
    ctx.font = '500 15px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = 'rgba(255,255,255,.48)';
    ctx.fillText(state.serial.toUpperCase(), 94, 112);

    ctx.textAlign = 'right';
    ctx.fillStyle = rgba(state.accent, .92);
    ctx.font = '700 18px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText('LUX / ARCHIVE OBJECT', 905, 112);

    if (state.guides) drawGuides(false);
  }

  function drawGuides(discMode) {
    ctx.save();
    ctx.setLineDash([12, 10]);
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2;
    if (discMode) {
      ctx.beginPath(); ctx.arc(500, 500, 390, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(500, 500, 105, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.strokeRect(80, 80, 840, 840);
    }
    ctx.restore();
  }

  function render() {
    drawQueued = false;
    if (state.mode === 'cover') drawCover(); else drawDisc();
  }

  function queueRender() {
    if (!drawQueued) {
      drawQueued = true;
      requestAnimationFrame(render);
    }
    $('#studioSaveState').textContent = 'UNSAVED';
  }

  function updateOutput(key) {
    if (!rangeOutputs[key]) return;
    const value = Number(state[key]);
    if (['scale', 'opacity', 'holo', 'detail'].includes(key)) rangeOutputs[key].value = `${value}%`;
    else if (key === 'rotation') rangeOutputs[key].value = `${value}°`;
    else rangeOutputs[key].value = String(value);
  }

  function syncForm() {
    fields.title.value = state.title;
    fields.subtitle.value = state.subtitle;
    fields.serial.value = state.serial;
    fields.accent.value = state.accent;
    fields.background.value = state.background;
    fields.material.value = state.material;
    fields.graphic.value = state.graphic;
    fields.scale.value = state.scale;
    fields.rotation.value = state.rotation;
    fields.opacity.value = state.opacity;
    fields.x.value = state.x;
    fields.y.value = state.y;
    fields.holo.value = state.holo;
    fields.detail.value = state.detail;
    fields.transparent.checked = state.transparent;
    fields.guides.checked = state.guides;
    Object.keys(rangeOutputs).forEach(updateOutput);
    $$('.studio-tab').forEach(tab => tab.classList.toggle('is-active', tab.dataset.studioMode === state.mode));
    $('#studioMaterialField').classList.toggle('is-dimmed', state.mode === 'cover');
    $('#studioPreviewLabel').textContent = state.mode === 'disc' ? 'DISC PREVIEW' : 'COVER PREVIEW';
  }

  function applyArtworkData(data) {
    state.artworkData = data || '';
    artworkImage = null;
    if (!data) { queueRender(); return; }
    const img = new Image();
    img.onload = () => { artworkImage = img; queueRender(); };
    img.src = data;
  }

  function openStudio(push = false) {
    studio.classList.add('is-open');
    studio.setAttribute('aria-hidden', 'false');
    document.body.classList.add('studio-open');
    if (push && location.hash !== '#studio') history.pushState({}, '', '#studio');
    render();
  }

  function closeStudio(push = true) {
    studio.classList.remove('is-open');
    studio.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('studio-open');
    if (push && location.hash === '#studio') history.pushState({}, '', location.pathname + location.search);
  }

  function syncRoute() {
    if (location.hash === '#studio') openStudio(false);
    else if (studio.classList.contains('is-open')) closeStudio(false);
  }

  function toast(message) {
    const el = $('#studioToast');
    el.textContent = message;
    el.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('is-visible'), 1800);
  }

  function getPresetPayload() {
    return { ...state, artworkData: state.artworkData || '' };
  }

  function refreshPresets() {
    const select = $('#studioPresetSelect');
    const saved = JSON.parse(localStorage.getItem('lux-disc-lab-presets') || '{}');
    const current = select.value;
    select.innerHTML = '<option value="">SAVED PRESETS</option>' + Object.keys(saved).sort().map(name => `<option value="${name.replaceAll('"', '&quot;')}">${name}</option>`).join('');
    if (saved[current]) select.value = current;
  }

  function savePreset() {
    const suggested = state.title && state.title !== 'UNTITLED' ? state.title : `LUX ${state.mode.toUpperCase()} ${new Date().toLocaleDateString()}`;
    const name = prompt('Preset name', suggested);
    if (!name) return;
    const saved = JSON.parse(localStorage.getItem('lux-disc-lab-presets') || '{}');
    saved[name] = getPresetPayload();
    try {
      localStorage.setItem('lux-disc-lab-presets', JSON.stringify(saved));
    } catch (_) {
      saved[name] = { ...getPresetPayload(), artworkData: '' };
      try {
        localStorage.setItem('lux-disc-lab-presets', JSON.stringify(saved));
        toast('SAVED WITHOUT LARGE ARTWORK');
      } catch (_) {
        return toast('LOCAL STORAGE FULL — EXPORT JSON');
      }
    }
    refreshPresets();
    $('#studioPresetSelect').value = name;
    $('#studioSaveState').textContent = 'SAVED LOCAL';
    if (state.artworkData && !saved[name].artworkData) return;
    toast('PRESET SAVED');
  }

  function loadPreset() {
    const name = $('#studioPresetSelect').value;
    if (!name) return toast('SELECT A PRESET');
    const saved = JSON.parse(localStorage.getItem('lux-disc-lab-presets') || '{}');
    if (!saved[name]) return;
    state = { ...defaults, ...saved[name] };
    syncForm();
    applyArtworkData(state.artworkData);
    $('#studioSaveState').textContent = 'LOADED';
    toast('PRESET LOADED');
  }

  function deletePreset() {
    const name = $('#studioPresetSelect').value;
    if (!name) return toast('SELECT A PRESET');
    const saved = JSON.parse(localStorage.getItem('lux-disc-lab-presets') || '{}');
    delete saved[name];
    localStorage.setItem('lux-disc-lab-presets', JSON.stringify(saved));
    refreshPresets();
    toast('PRESET DELETED');
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  function exportPng() {
    render();
    canvas.toBlob(blob => {
      if (!blob) return toast('EXPORT FAILED');
      downloadBlob(blob, `${safeName(state.title)}-${state.mode}.png`);
      toast('PNG EXPORTED');
    }, 'image/png');
  }

  function exportJson() {
    const json = JSON.stringify({ format: 'LUX_DISC_LAB_V1', created: new Date().toISOString(), preset: getPresetPayload() }, null, 2);
    downloadBlob(new Blob([json], { type: 'application/json' }), `${safeName(state.title)}-lux-preset.json`);
    toast('PRESET EXPORTED');
  }

  async function copySiteEntry() {
    const slug = safeName(state.title);
    const entry = `{
  id: "${slug}",
  disc: "05",
  title: "${state.title.replaceAll('"', '\\"').toUpperCase()}",
  shortTitle: "${state.title.replaceAll('"', '\\"').toUpperCase()}",
  eyebrow: "CUSTOM / LUX DISC LAB",
  description: "Custom collection created with LUX Disc Lab.",
  discStyle: "${state.material}",
  accent: "${state.accent}",
  artworks: [
    { title: "Artwork 01", meta: "DIGITAL / 2026", image: "assets/art/${slug}-01.png" }
  ]
}`;
    try {
      await navigator.clipboard.writeText(entry);
      toast('DATA.JS ENTRY COPIED');
    } catch (_) {
      prompt('Copy this into data.js:', entry);
    }
  }

  Object.entries(fields).forEach(([key, input]) => {
    if (!input || key === 'artworkInput') return;
    const eventName = input.type === 'range' || input.type === 'color' || input.type === 'text' ? 'input' : 'change';
    input.addEventListener(eventName, () => {
      state[key] = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
      updateOutput(key);
      queueRender();
    });
  });

  fields.artworkInput.addEventListener('change', () => {
    const file = fields.artworkInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => applyArtworkData(String(reader.result || ''));
    reader.readAsDataURL(file);
  });

  $$('.studio-tab').forEach(tab => tab.addEventListener('click', () => {
    state.mode = tab.dataset.studioMode;
    syncForm(); queueRender();
  }));

  canvas.addEventListener('pointerdown', (event) => {
    if (!artworkImage) return;
    const rect = canvas.getBoundingClientRect();
    drag = { startX: event.clientX, startY: event.clientY, baseX: Number(state.x), baseY: Number(state.y), scaleX: 1000 / rect.width, scaleY: 1000 / rect.height };
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag) return;
    state.x = Math.max(-300, Math.min(300, Math.round(drag.baseX + (event.clientX - drag.startX) * drag.scaleX)));
    state.y = Math.max(-300, Math.min(300, Math.round(drag.baseY + (event.clientY - drag.startY) * drag.scaleY)));
    fields.x.value = state.x; fields.y.value = state.y; updateOutput('x'); updateOutput('y'); queueRender();
  });
  const endDrag = () => { drag = null; canvas.classList.remove('is-dragging'); };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

  $('#closeStudio').addEventListener('click', () => closeStudio(true));
  $('#studioSavePreset').addEventListener('click', savePreset);
  $('#studioLoadPreset').addEventListener('click', loadPreset);
  $('#studioDeletePreset').addEventListener('click', deletePreset);
  $('#studioReset').addEventListener('click', () => { state = { ...defaults }; artworkImage = null; fields.artworkInput.value = ''; syncForm(); queueRender(); toast('RESET COMPLETE'); });
  $('#studioExportPng').addEventListener('click', exportPng);
  $('#studioExportJson').addEventListener('click', exportJson);
  $('#studioCopyEntry').addEventListener('click', copySiteEntry);

  window.LUX_STUDIO = { open: () => openStudio(true), close: () => closeStudio(true) };


  document.addEventListener('keydown', (event) => {
    if (event.shiftKey && event.altKey && event.key.toLowerCase() === 'l') openStudio(true);
    if (event.key === 'Escape' && studio.classList.contains('is-open')) closeStudio(true);
  });

  window.addEventListener('hashchange', syncRoute);
  window.addEventListener('popstate', syncRoute);

  syncForm(); refreshPresets(); syncRoute(); render();
})();
