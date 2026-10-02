const $ = (id) => document.getElementById(id);
const els = {
  fSearch: $('fSearch'),
  fLanguage: $('fLanguage'),
  fGender: $('fGender'),
  fFav: $('fFav'),
  favCount: $('favCount'),
  selFav: $('selFav'),
  presetChips: $('presetChips'),
  roleChips: $('roleChips'),
  voiceList: $('voiceList'),
  voiceCount: $('voiceCount'),
  moreBtn: $('moreBtn'),
  selAvatar: $('selAvatar'),
  selName: $('selName'),
  selMeta: $('selMeta'),
  selPlay: $('selPlay'),
  text: $('text'),
  charCount: $('charCount'),
  wordCount: $('wordCount'),
  duration: $('duration'),
  generate: $('generate'),
  cardGenerate: $('card-generate'),
  cardProgress: $('card-progress'),
  cardResult: $('card-result'),
  cardError: $('card-error'),
  progressStatus: $('progressStatus'),
  progressBar: $('progressBar'),
  progressPct: $('progressPct'),
  logArea: $('logArea'),
  audioPlayer: $('audioPlayer'),
  downloadBtn: $('downloadBtn'),
  newBtn: $('newBtn'),
  errorMessage: $('errorMessage'),
  retryBtn: $('retryBtn'),
};

const STUDIO = '__studio__';
const STORAGE_KEY = 'audio-gemini:ui';
const FAVORITES_KEY = 'audio-gemini:favorites';
const PAGE_SIZE = 60;
const WORDS_PER_MINUTE = 150;

const GENDER_LABEL = { male: 'masculino', female: 'feminino', neutral: 'neutro' };
const PITCH_LABEL = { low: 'grave', medium: 'médio', high: 'agudo' };

const ICON_PLAY = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
const ICON_STOP = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 7h10v10H7z"/></svg>';
const ICON_STAR = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 17.3 6.2 21l1.6-6.6L2.6 10l6.8-.6L12 3l2.6 6.4 6.8.6-5.2 4.4 1.6 6.6z"/></svg>';
const ICON_STAR_OUTLINE = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="m12 7.1-1.2 3-3.3.3 2.5 2.2-.8 3.2 2.8-1.7 2.8 1.7-.8-3.2 2.5-2.2-3.3-.3zM12 3l2.6 6.4 6.8.6-5.2 4.4 1.6 6.6L12 17.3 6.2 21l1.6-6.6L2.6 10l6.8-.6z"/></svg>';
const ICON_LOADING ='<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M12 4a8 8 0 0 1 8 8h-2a6 6 0 0 0-6-6z"/></svg>';

const state = {
  voices: [],
  defaultId: null,
  selectedId: null,
  language: STUDIO,
  gender: '',
  preset: '',
  role: '',
  search: '',
  onlyFavorites: false,
  favorites: new Set(),
  limit: PAGE_SIZE,
};

let currentJobId = null;
let currentEventSource = null;

// ---------- utilidades ----------

let langNames = null;
try { langNames = new Intl.DisplayNames(['pt-BR'], { type: 'language' }); } catch {}
function langLabel(code) {
  try {
    const name = langNames ? langNames.of(code) : '';
    return name && name !== code ? `${name[0].toUpperCase()}${name.slice(1)} — ${code}` : code;
  } catch { return code; }
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c != null) node.append(c);
  return node;
}

function countBy(list, fn) {
  const m = new Map();
  for (const v of list) for (const k of [].concat(fn(v))) if (k) m.set(k, (m.get(k) || 0) + 1);
  return m;
}

function saveState() {
  try {
    const { language, gender, preset, role, search, selectedId, onlyFavorites } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ language, gender, preset, role, search, selectedId, onlyFavorites }));
  } catch {}
}

function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
}

function loadFavorites() {
  try {
    const ids = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    return new Set(Array.isArray(ids) ? ids : []);
  } catch { return new Set(); }
}

function saveFavorites() {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...state.favorites])); } catch {}
}

const isFavorite = (id) => state.favorites.has(id);

function toggleFavorite(id) {
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);
  saveFavorites();
  // Na visão de favoritas, desfavoritar remove o card; nas outras só atualiza a estrela
  if (state.onlyFavorites) update({ resetLimit: false });
  else { renderFavToggle(); syncFavButtons(); }
  renderSelected();
}

function syncFavButtons() {
  for (const b of document.querySelectorAll('[data-fav]')) {
    const on = isFavorite(b.dataset.fav);
    b.classList.toggle('on', on);
    b.innerHTML = on ? ICON_STAR : ICON_STAR_OUTLINE;
    b.title = on ? 'Remover das favoritas' : 'Favoritar';
    b.setAttribute('aria-pressed', String(on));
  }
}

function renderFavToggle() {
  const count = state.voices.filter(v => isFavorite(v.id)).length;
  els.favCount.textContent = String(count);
  els.fFav.setAttribute('aria-pressed', String(state.onlyFavorites));
  els.fLanguage.closest('.toolbar').classList.toggle('fav-mode', state.onlyFavorites);
  els.fLanguage.title = state.onlyFavorites ? 'Favoritas mostram todos os idiomas' : '';
}

const voiceById = (id) => state.voices.find(v => v.id === id);
const initials = (v) => v.name.replace(/[^\p{L}\d ]/gu, '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
const roleOf = (v) => v.roles[0] || v.presets[0] || '';

// ---------- filtros ----------

// `skip` ignora um filtro, para contar as opções disponíveis daquele filtro
function matches(v, skip) {
  // Favoritas valem para qualquer idioma
  if (state.onlyFavorites) {
    if (!isFavorite(v.id)) return false;
  } else if (skip !== 'language' && state.language) {
    if (state.language === STUDIO ? !v.studio : v.languageCode !== state.language) return false;
  }
  if (skip !== 'gender' && state.gender && v.gender !== state.gender) return false;
  if (skip !== 'preset' && state.preset && !v.presets.includes(state.preset)) return false;
  if (skip !== 'role' && state.role && !v.roles.includes(state.role)) return false;
  if (state.search) {
    const hay = [v.name, v.id, v.description, v.accent, ...v.presets, ...v.roles].join(' ').toLowerCase();
    if (!state.search.toLowerCase().split(/\s+/).every(t => hay.includes(t))) return false;
  }
  return true;
}

function renderLanguages() {
  const studioCount = state.voices.filter(v => v.studio).length;
  const langs = [...countBy(state.voices.filter(v => !v.studio), v => v.languageCode)]
    .map(([k, n]) => [k, `${langLabel(k)} (${n})`])
    .sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  const opts = [
    ...(studioCount ? [[STUDIO, `Estúdio, multilíngues (${studioCount})`]] : []),
    ['', `Todos os idiomas (${state.voices.length})`],
    ...langs,
  ];
  els.fLanguage.innerHTML = '';
  for (const [value, label] of opts) els.fLanguage.append(el('option', { value, text: label }));
  if (!opts.some(([v]) => v === state.language)) state.language = opts[0][0];
  els.fLanguage.value = state.language;
}

function renderGender() {
  for (const b of els.fGender.querySelectorAll('button')) {
    const active = b.dataset.value === state.gender;
    b.classList.toggle('active', active);
    b.setAttribute('aria-checked', String(active));
  }
}

function renderChips(container, counts, current, onPick) {
  container.innerHTML = '';
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const items = [['', 'Todos', null], ...[...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => [k, k, n])];
  for (const [value, label, n] of items) {
    if (value && !n) continue;
    const chip = el('button', { type: 'button', class: `chip${value === current ? ' active' : ''}`, role: 'radio', 'aria-checked': String(value === current) },
      [label, n != null ? el('span', { class: 'n', text: String(n) }) : null]);
    chip.addEventListener('click', () => onPick(value === current ? '' : value));
    container.append(chip);
  }
  return total;
}

function renderFacets() {
  const presetCounts = countBy(state.voices.filter(v => matches(v, 'preset')), v => v.presets);
  if (state.preset && !presetCounts.has(state.preset)) state.preset = '';
  renderChips(els.presetChips, presetCounts, state.preset, (p) => { state.preset = p; state.role = ''; update(); });

  // Papéis só aparecem dentro de um preset
  if (state.preset) {
    const roleCounts = countBy(state.voices.filter(v => matches(v, 'role')), v => v.roles);
    if (state.role && !roleCounts.has(state.role)) state.role = '';
    els.roleChips.classList.toggle('hidden', roleCounts.size === 0);
    renderChips(els.roleChips, roleCounts, state.role, (r) => { state.role = r; update(); });
  } else {
    state.role = '';
    els.roleChips.classList.add('hidden');
  }
}

// ---------- lista de vozes ----------

function voiceCard(v) {
  const selected = v.id === state.selectedId;
  const tags = [
    v.studio ? 'multilíngue' : v.languageCode,
    GENDER_LABEL[v.gender],
    PITCH_LABEL[v.pitch] && `tom ${PITCH_LABEL[v.pitch]}`,
  ].filter(Boolean);

  const play = el('button', { type: 'button', class: 'icon-btn', title: 'Ouvir amostra', 'aria-label': `Ouvir amostra de ${v.name}`, html: ICON_PLAY });
  play.dataset.preview = v.id;
  play.addEventListener('click', (e) => { e.stopPropagation(); togglePreview(v.id); });

  const fav = el('button', { type: 'button', class: 'icon-btn star', 'aria-label': `Favoritar ${v.name}` });
  fav.dataset.fav = v.id;
  fav.addEventListener('click', (e) => { e.stopPropagation(); toggleFavorite(v.id); });

  const card = el('div', { class: `voice${selected ? ' selected' : ''}`, role: 'option', tabindex: '0', 'aria-selected': String(selected), title: v.description }, [
    el('div', { class: `avatar ${v.gender}`, text: initials(v) }),
    el('div', { class: 'voice-body' }, [
      el('div', { class: 'voice-name', text: v.name }),
      roleOf(v) && !v.name.includes(roleOf(v)) ? el('div', { class: 'voice-role', text: roleOf(v) }) : null,
      v.description ? el('div', { class: 'voice-desc', text: v.description }) : null,
      el('div', { class: 'tags' }, tags.map(t => el('span', { class: 'tag', text: t }))),
    ]),
    el('div', { class: 'voice-actions' }, [play, fav]),
  ]);
  const pick = () => selectVoice(v.id);
  card.addEventListener('click', pick);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  return card;
}

function renderVoices() {
  const list = state.voices.filter(v => matches(v));
  // Ordem: selecionada, depois favoritas, depois o resto (sort é estável)
  const rank = (v) => (v.id === state.selectedId ? 0 : isFavorite(v.id) ? 1 : 2);
  const ordered = [...list].sort((a, b) => rank(a) - rank(b));

  els.voiceList.innerHTML = '';
  if (!ordered.length) {
    const msg = state.onlyFavorites && state.favorites.size === 0
      ? 'Nenhuma favorita ainda. Clique na ★ de uma voz para favoritar.'
      : 'Nenhuma voz com esses filtros.';
    els.voiceList.append(el('div', { class: 'empty', text: msg }));
  }
  for (const v of ordered.slice(0, state.limit)) els.voiceList.append(voiceCard(v));
  els.moreBtn.classList.toggle('hidden', ordered.length <= state.limit);
  els.moreBtn.textContent = `Mostrar mais (${ordered.length - state.limit} restantes)`;
  els.voiceCount.textContent = `${list.length} de ${state.voices.length} vozes`;
  syncPreviewButtons();
  syncFavButtons();
}

function renderSelected() {
  const v = voiceById(state.selectedId);
  els.selPlay.disabled = !v;
  els.selFav.disabled = !v;
  if (v) els.selFav.dataset.fav = v.id;
  syncFavButtons();
  if (!v) {
    els.selAvatar.textContent = '?';
    els.selAvatar.className = 'avatar';
    els.selName.textContent = 'Escolha uma voz';
    els.selMeta.textContent = '';
    return;
  }
  els.selAvatar.textContent = initials(v);
  els.selAvatar.className = `avatar ${v.gender}`;
  els.selName.textContent = v.name + (roleOf(v) && !v.name.includes(roleOf(v)) ? ` · ${roleOf(v)}` : '');
  els.selMeta.textContent = [
    v.studio ? 'Estúdio, multilíngue' : (v.accent || langLabel(v.languageCode)),
    GENDER_LABEL[v.gender],
    PITCH_LABEL[v.pitch] && `tom ${PITCH_LABEL[v.pitch]}`,
  ].filter(Boolean).join(' · ');
  els.selPlay.dataset.preview = v.id;
  syncPreviewButtons();
}

function selectVoice(id) {
  state.selectedId = id;
  saveState();
  for (const card of els.voiceList.querySelectorAll('.voice')) {
    const isSel = card.querySelector('[data-preview]')?.dataset.preview === id;
    card.classList.toggle('selected', isSel);
    card.setAttribute('aria-selected', String(isSel));
  }
  renderSelected();
  updateCount();
}

function update({ resetLimit = true } = {}) {
  if (resetLimit) state.limit = PAGE_SIZE;
  renderGender();
  renderFavToggle();
  renderFacets();
  renderVoices();
  saveState();
}

// ---------- amostras ----------

const previewAudio = new Audio();
let previewId = null;
let previewLoading = null;

function syncPreviewButtons() {
  for (const b of document.querySelectorAll('[data-preview]')) {
    const id = b.dataset.preview;
    const loading = previewLoading === id;
    const playing = previewId === id && !previewAudio.paused;
    b.classList.toggle('loading', loading);
    b.classList.toggle('playing', playing);
    b.innerHTML = loading ? ICON_LOADING : playing ? ICON_STOP : ICON_PLAY;
    if (!b.classList.contains('failed')) {
      b.title = loading ? 'Gerando amostra (pode levar até ~30s)... clique para cancelar' : playing ? 'Parar' : 'Ouvir amostra';
    }
  }
}

const previewUrls = new Map(); // id -> object URL já baixado

async function togglePreview(id) {
  if (previewId === id && (previewLoading === id || !previewAudio.paused)) {
    previewAudio.pause();
    previewId = null;
    previewLoading = null;
    syncPreviewButtons();
    return;
  }
  previewAudio.pause();
  previewId = id;
  previewLoading = id;
  syncPreviewButtons();
  try {
    // fetch + blob: o <audio> carregando a URL direto travava em respostas lentas
    let url = previewUrls.get(id);
    if (!url) {
      const res = await fetch(`/api/voices/${encodeURIComponent(id)}/preview`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      url = URL.createObjectURL(await res.blob());
      previewUrls.set(id, url);
    }
    if (previewId !== id) return; // usuário trocou de amostra enquanto carregava
    previewLoading = null;
    previewAudio.src = url;
    await previewAudio.play();
  } catch (e) {
    console.warn('Falha na amostra', e);
    if (previewId === id) {
      previewId = null;
      flashButtons(id, 'Não foi possível gerar a amostra');
    }
  } finally {
    if (previewLoading === id) previewLoading = null;
    syncPreviewButtons();
  }
}

function flashButtons(id, message) {
  for (const b of document.querySelectorAll(`[data-preview="${CSS.escape(id)}"]`)) {
    b.classList.add('failed');
    b.title = message;
    setTimeout(() => b.classList.remove('failed'), 2000);
  }
}

previewAudio.addEventListener('playing', syncPreviewButtons);
previewAudio.addEventListener('ended', syncPreviewButtons);
previewAudio.addEventListener('pause', syncPreviewButtons);

// ---------- texto / geração ----------

function updateCount() {
  const text = els.text.value;
  const words = (text.match(/\S+/g) || []).length;
  const secs = Math.round(words / WORDS_PER_MINUTE * 60);
  els.charCount.textContent = text.length.toLocaleString('pt-BR');
  els.wordCount.textContent = words.toLocaleString('pt-BR');
  els.duration.textContent = secs >= 3600
    ? `${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
    : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  els.generate.disabled = !text.trim() || !state.selectedId || currentJobId !== null;
}

function appendLog(level, message) {
  const line = el('div', { class: `log-line ${level}`, text: `[${new Date().toLocaleTimeString()}] ${message}` });
  els.logArea.append(line);
  els.logArea.scrollTop = els.logArea.scrollHeight;
}

function setProgress(pct, status) {
  els.progressBar.style.width = `${pct}%`;
  els.progressPct.textContent = `${pct}%`;
  if (status) els.progressStatus.textContent = status;
}

function show(card) {
  for (const c of [els.cardProgress, els.cardResult, els.cardError]) c.classList.toggle('hidden', c !== card);
}

function showError(msg) {
  currentJobId = null;
  show(els.cardError);
  els.errorMessage.textContent = msg;
  updateCount();
}

function reset() {
  currentJobId = null;
  if (currentEventSource) { currentEventSource.close(); currentEventSource = null; }
  show(null);
  setProgress(0, 'Iniciando...');
  els.logArea.innerHTML = '';
  updateCount();
}

async function generate() {
  if (els.generate.disabled) return;
  const text = els.text.value;
  const voiceName = state.selectedId;
  els.logArea.innerHTML = '';
  setProgress(0, 'Iniciando...');
  show(els.cardProgress);
  els.generate.disabled = true;
  els.cardProgress.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voiceName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Erro desconhecido' }));
      throw new Error(err.message || `HTTP ${res.status}`);
    }
    const { jobId } = await res.json();
    currentJobId = jobId;

    currentEventSource = new EventSource(`/api/jobs/${jobId}/events`);
    currentEventSource.onmessage = (ev) => {
      const data = JSON.parse(ev.data);
      if (data.status === 'log') {
        appendLog(data.level || 'info', data.message || '');
      } else if (data.status === 'running') {
        const { processed = 0, total = 0 } = data;
        const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
        setProgress(pct, total > 0 ? `Trecho ${processed} de ${total}` : 'Preparando...');
      } else if (data.status === 'done') {
        currentEventSource.close();
        currentEventSource = null;
        currentJobId = null;
        const audioUrl = `/api/jobs/${jobId}/audio`;
        els.audioPlayer.src = audioUrl;
        els.downloadBtn.href = audioUrl;
        els.downloadBtn.setAttribute('download', `audio_${jobId}.mp3`);
        show(els.cardResult);
        updateCount();
      } else if (data.status === 'error') {
        currentEventSource.close();
        currentEventSource = null;
        showError(data.message || 'Erro durante geração');
      }
    };
    currentEventSource.onerror = () => {
      if (currentEventSource) { currentEventSource.close(); currentEventSource = null; }
      showError('Conexão perdida — recarregue a página');
    };
  } catch (e) {
    showError(e.message || String(e));
  }
}

// ---------- eventos ----------

let searchTimer = null;
els.fSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { state.search = els.fSearch.value.trim(); update(); }, 150);
});
els.fLanguage.addEventListener('change', () => { state.language = els.fLanguage.value; update(); });
els.fGender.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.gender = b.dataset.value;
  update();
});
els.fFav.addEventListener('click', () => {
  state.onlyFavorites = !state.onlyFavorites;
  // Ao abrir as favoritas, mostra todas; os filtros podem ser reaplicados depois
  if (state.onlyFavorites) Object.assign(state, { gender: '', preset: '', role: '' });
  update();
});
els.selFav.addEventListener('click', () => state.selectedId && toggleFavorite(state.selectedId));
els.moreBtn.addEventListener('click', () => { state.limit += PAGE_SIZE; renderVoices(); });
els.selPlay.addEventListener('click', () => state.selectedId && togglePreview(state.selectedId));

els.text.addEventListener('input', updateCount);
els.text.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate(); });
els.generate.addEventListener('click', generate);
els.newBtn.addEventListener('click', () => { els.text.value = ''; reset(); els.text.focus(); });
els.retryBtn.addEventListener('click', reset);

// ---------- início ----------

async function init() {
  try {
    const res = await fetch('/api/voices');
    const data = await res.json();
    state.voices = data.voices || [];
    state.defaultId = data.default;
  } catch (e) {
    els.voiceList.append(el('div', { class: 'empty', text: 'Falha ao carregar vozes. Recarregue a página.' }));
    return;
  }

  const saved = loadState();
  if (saved) Object.assign(state, {
    language: saved.language ?? state.language,
    gender: saved.gender || '',
    preset: saved.preset || '',
    role: saved.role || '',
    search: saved.search || '',
    onlyFavorites: !!saved.onlyFavorites,
  });
  state.favorites = loadFavorites();
  els.fSearch.value = state.search;
  state.selectedId = voiceById(saved?.selectedId)?.id || voiceById(state.defaultId)?.id || state.voices[0]?.id || null;

  renderLanguages();
  update();
  renderSelected();
  updateCount();
}

init();
