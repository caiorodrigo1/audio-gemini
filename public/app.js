const $ = (id) => document.getElementById(id);
const els = {
  voice: $('voice'),
  text: $('text'),
  charCount: $('charCount'),
  generate: $('generate'),
  cardProgress: $('card-progress'),
  cardResult: $('card-result'),
  cardError: $('card-error'),
  cardGenerate: $('card-generate'),
  progressStatus: $('progressStatus'),
  progressBar: $('progressBar'),
  progressPct: $('progressPct'),
  audioPlayer: $('audioPlayer'),
  downloadBtn: $('downloadBtn'),
  newBtn: $('newBtn'),
  errorMessage: $('errorMessage'),
  retryBtn: $('retryBtn'),
  logArea: $('logArea'),
};

function appendLog(level, message) {
  const line = document.createElement('div');
  line.className = `log-line ${level}`;
  const ts = new Date().toLocaleTimeString();
  line.textContent = `[${ts}] ${message}`;
  els.logArea.appendChild(line);
  els.logArea.scrollTop = els.logArea.scrollHeight;
}

let currentJobId = null;
let currentEventSource = null;

async function loadVoices() {
  const res = await fetch('/api/voices');
  const data = await res.json();
  els.voice.innerHTML = '';
  const groups = [
    { label: 'Masculinas', items: data.male },
    { label: 'Femininas', items: data.female },
  ];
  for (const g of groups) {
    const og = document.createElement('optgroup');
    og.label = g.label;
    for (const v of g.items) {
      const opt = document.createElement('option');
      opt.value = v.id;
      opt.textContent = `${v.name} — ${v.description}`;
      og.appendChild(opt);
    }
    els.voice.appendChild(og);
  }
  els.voice.value = data.default;
}

function updateCount() {
  els.charCount.textContent = els.text.value.length;
  els.generate.disabled = els.text.value.trim().length === 0 || currentJobId !== null;
}

function showProgress() {
  els.cardGenerate.classList.add('hidden');
  els.cardProgress.classList.remove('hidden');
  els.cardResult.classList.add('hidden');
  els.cardError.classList.add('hidden');
}

function showResult() {
  els.cardProgress.classList.add('hidden');
  els.cardResult.classList.remove('hidden');
}

function showError(msg) {
  els.cardProgress.classList.add('hidden');
  els.cardError.classList.remove('hidden');
  els.errorMessage.textContent = msg;
}

function reset() {
  currentJobId = null;
  if (currentEventSource) {
    currentEventSource.close();
    currentEventSource = null;
  }
  els.cardGenerate.classList.remove('hidden');
  els.cardProgress.classList.add('hidden');
  els.cardResult.classList.add('hidden');
  els.cardError.classList.add('hidden');
  els.progressBar.value = 0;
  els.progressPct.textContent = '0%';
  els.progressStatus.textContent = 'Iniciando...';
  els.logArea.innerHTML = '';
  updateCount();
}

async function generate() {
  const text = els.text.value;
  const voiceName = els.voice.value;
  els.logArea.innerHTML = '';
  showProgress();
  els.generate.disabled = true;
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
        return;
      }
      if (data.status === 'running') {
        const { processed = 0, total = 0 } = data;
        const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
        els.progressBar.value = pct;
        els.progressPct.textContent = `${pct}%`;
        els.progressStatus.textContent = total > 0
          ? `Processando chunk ${processed} de ${total}...`
          : 'Preparando...';
      } else if (data.status === 'done') {
        currentEventSource.close();
        currentEventSource = null;
        const audioUrl = `/api/jobs/${jobId}/audio`;
        els.audioPlayer.src = audioUrl;
        els.downloadBtn.href = audioUrl;
        els.downloadBtn.setAttribute('download', `audio_${jobId}.wav`);
        showResult();
      } else if (data.status === 'error') {
        currentEventSource.close();
        currentEventSource = null;
        showError(data.message || 'Erro durante geração');
      }
    };
    currentEventSource.onerror = () => {
      if (currentEventSource) {
        currentEventSource.close();
        currentEventSource = null;
      }
      showError('Conexão perdida — recarregue a página');
    };
  } catch (e) {
    showError(e.message || String(e));
  }
}

els.text.addEventListener('input', updateCount);
els.generate.addEventListener('click', generate);
els.newBtn.addEventListener('click', () => { els.text.value = ''; reset(); });
els.retryBtn.addEventListener('click', reset);

loadVoices().then(updateCount);
