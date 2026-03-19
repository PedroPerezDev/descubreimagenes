'use strict';

/* ── Estado global ── */
const state = {
  imageObjectURL: null,
  tileCount: 20,
  rows: 0,
  cols: 0,
  tilesRemoved: 0,
  totalTiles: 0,
  numbers: [],   // array barajado de [1..totalTiles]
};

/* ── Utilidades ── */

/**
 * Fisher-Yates shuffle (in-place). Devuelve el mismo array.
 */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Sube N hasta el siguiente número compuesto (no primo).
 * Evita rejillas con filas=1 o cols=1 cuando N es primo.
 */
function nextComposite(n) {
  if (n <= 3) return 4;
  while (isPrime(n)) n++;
  return n;
}

function isPrime(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

/**
 * Calcula (rows, cols) tal que rows*cols === n y
 * la proporción cols/rows se acerca al aspect ratio w/h de la imagen.
 *
 * Si n es primo, lo sube al siguiente compuesto.
 * Devuelve { rows, cols, total } donde total puede diferir de n inicial.
 */
function computeGrid(n, w, h) {
  n = nextComposite(n);
  const targetRatio = w / h; // >1 = landscape, <1 = portrait
  let bestRows = 1, bestCols = n, bestDiff = Infinity;

  for (let r = 1; r <= n; r++) {
    if (n % r !== 0) continue;
    const c = n / r;
    const ratio = c / r;
    const diff = Math.abs(ratio - targetRatio);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestRows = r;
      bestCols = c;
    }
  }

  return { rows: bestRows, cols: bestCols, total: n };
}

/* ── Manejo de imagen ── */

function handleFileSelect(file) {
  if (!file || !file.type.startsWith('image/')) return;

  // Revocar URL anterior si existe
  if (state.imageObjectURL) {
    URL.revokeObjectURL(state.imageObjectURL);
  }

  state.imageObjectURL = URL.createObjectURL(file);

  const fileNameEl = document.getElementById('file-name');
  fileNameEl.textContent = file.name;

  document.getElementById('start-btn').disabled = false;
}

/* ── Inicio de juego ── */

function startGame() {
  const img = document.getElementById('game-image');
  img.onload = () => {
    const { naturalWidth: w, naturalHeight: h } = img;
    const { rows, cols, total } = computeGrid(state.tileCount, w, h);

    state.rows = rows;
    state.cols = cols;
    state.totalTiles = total;
    state.tilesRemoved = 0;

    // Números barajados
    state.numbers = shuffle(Array.from({ length: total }, (_, i) => i + 1));

    buildTileGrid();
    updateProgress();

    document.getElementById('upload-screen').hidden = true;
    document.getElementById('game-screen').hidden = false;
    document.getElementById('victory-overlay').hidden = true;
  };
  img.src = state.imageObjectURL;
}

/* ── Construcción de la rejilla ── */

function buildTileGrid() {
  const grid = document.getElementById('tile-grid');
  grid.innerHTML = '';

  grid.style.gridTemplateColumns = `repeat(${state.cols}, 1fr)`;
  grid.style.gridTemplateRows    = `repeat(${state.rows}, 1fr)`;

  state.numbers.forEach((num) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.textContent = num;
    tile.setAttribute('tabindex', '0');
    tile.setAttribute('role', 'button');
    tile.setAttribute('aria-label', `Ficha ${num}`);

    tile.addEventListener('click', onTileClick);
    tile.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onTileClick({ currentTarget: tile });
      }
    });

    grid.appendChild(tile);
  });
}

/* ── Clic en ficha ── */

function onTileClick(e) {
  const tile = e.currentTarget;
  if (tile.classList.contains('removing')) return;

  tile.classList.add('removing');
  tile.addEventListener('transitionend', () => {
    tile.remove();
    state.tilesRemoved++;
    updateProgress();

    if (state.tilesRemoved === state.totalTiles) {
      showVictory();
    }
  }, { once: true });
}

/* ── Progreso ── */

function updateProgress() {
  const pct = state.totalTiles > 0
    ? Math.round((state.tilesRemoved / state.totalTiles) * 100)
    : 0;

  document.getElementById('progress-label').textContent =
    `${state.tilesRemoved} / ${state.totalTiles} fichas retiradas`;

  const fill = document.getElementById('progress-fill');
  fill.style.width = `${pct}%`;

  const bar = fill.parentElement;
  bar.setAttribute('aria-valuenow', pct);
}

/* ── Victoria ── */

function showVictory() {
  document.getElementById('victory-overlay').hidden = false;
}

/* ── Replay: misma imagen, fichas reconstruidas ── */

function replayGame() {
  document.getElementById('victory-overlay').hidden = true;
  state.tilesRemoved = 0;

  // Re-barajar
  state.numbers = shuffle(Array.from({ length: state.totalTiles }, (_, i) => i + 1));

  buildTileGrid();
  updateProgress();
}

/* ── Nueva partida: volver a pantalla de carga ── */

function resetGame() {
  if (state.imageObjectURL) {
    URL.revokeObjectURL(state.imageObjectURL);
    state.imageObjectURL = null;
  }

  document.getElementById('tile-grid').innerHTML = '';
  document.getElementById('victory-overlay').hidden = true;
  document.getElementById('game-screen').hidden = true;
  document.getElementById('upload-screen').hidden = false;

  // Limpiar UI de carga
  document.getElementById('file-name').textContent = '';
  document.getElementById('file-input').value = '';
  document.getElementById('start-btn').disabled = true;
  document.getElementById('game-image').src = '';
}

/* ── Drag & Drop ── */

function setupDragDrop() {
  const zone = document.getElementById('drop-zone');

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('drag-over');
  });

  zone.addEventListener('dragleave', (e) => {
    if (!zone.contains(e.relatedTarget)) {
      zone.classList.remove('drag-over');
    }
  });

  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  });

  // Accesibilidad: tecla Enter/Space abre el selector
  zone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      document.getElementById('file-input').click();
    }
  });
}

/* ── Inicialización ── */

function init() {
  // Slider de fichas
  const slider = document.getElementById('tile-slider');
  const label  = document.getElementById('tile-count-label');

  slider.addEventListener('input', () => {
    state.tileCount = parseInt(slider.value, 10);
    label.textContent = state.tileCount;
  });
  state.tileCount = parseInt(slider.value, 10);

  // Selector de archivo
  document.getElementById('file-input').addEventListener('change', (e) => {
    handleFileSelect(e.target.files[0]);
  });

  // Drag & drop
  setupDragDrop();

  // Botón empezar
  document.getElementById('start-btn').addEventListener('click', startGame);

  // Botón nueva partida (header del juego)
  document.getElementById('new-game-btn').addEventListener('click', resetGame);

  // Botones de victoria
  document.getElementById('replay-btn').addEventListener('click', replayGame);
  document.getElementById('victory-new-btn').addEventListener('click', resetGame);
}

document.addEventListener('DOMContentLoaded', init);
