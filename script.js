const fileInput = document.getElementById('fileInput');
const pool = document.getElementById('pool');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const boardTitle = document.getElementById('boardTitle');
const board = document.getElementById('board');
const tierLabels = [...document.querySelectorAll('.tier-label')];

const FONT = '"Ubuntu Mono", monospace';
const LONG_PRESS_MS = 180; // удержание пальца перед началом перетаскивания

/* ---------- Добавление карточек ---------- */
fileInput.addEventListener('change', () => {
  for (const file of fileInput.files) {
    if (file.type.startsWith('image/')) addCard(file);
  }
  fileInput.value = ''; // можно выбрать те же файлы ещё раз
});

function addCard(file) {
  const url = URL.createObjectURL(file);

  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.url = url;

  const img = document.createElement('img');
  img.src = url;
  img.alt = file.name;

  const del = document.createElement('button');
  del.className = 'del';
  del.type = 'button';
  del.textContent = '×';
  del.title = 'Удалить карточку';
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    removeCard(card);
  });

  card.append(img, del);

  card.addEventListener('pointerdown', onPointerDown);
  card.addEventListener('contextmenu', (e) => e.preventDefault());

  pool.appendChild(card);
}

function removeCard(card) {
  URL.revokeObjectURL(card.dataset.url);
  card.remove();
}

/* ---------- Перетаскивание (Pointer Events: мышь + палец) ---------- */
let drag = null;

// Находит карточку, перед которой нужно вставить перетаскиваемую
function getInsertBefore(zone, x, y) {
  const cards = [...zone.querySelectorAll('.card:not(.dragging)')];
  for (const c of cards) {
    const r = c.getBoundingClientRect();
    if (y < r.top || (y <= r.bottom && x < r.left + r.width / 2)) return c;
  }
  return null;
}

function onPointerDown(e) {
  if (e.target.closest('.del')) return;                    // крестик не начинает drag
  if (e.pointerType === 'mouse' && e.button !== 0) return; // только левая кнопка
  if (drag) return;

  const card = e.currentTarget;
  const rect = card.getBoundingClientRect();

  drag = {
    card,
    id: e.pointerId,
    type: e.pointerType,
    sx: e.clientX, sy: e.clientY, // точка нажатия
    x: e.clientX,  y: e.clientY,  // текущая точка
    offX: e.clientX - rect.left,
    offY: e.clientY - rect.top,
    w: rect.width,
    h: rect.height,
    started: false,
    ghost: null,
    timer: null,
    raf: 0
  };

  if (e.pointerType === 'mouse') {
    e.preventDefault();
  } else {
    // На сенсорных экранах drag начинается после короткого удержания,
    // чтобы обычная прокрутка страницы не ломалась
    drag.timer = setTimeout(startDrag, LONG_PRESS_MS);
  }

  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', finishDrag);
  document.addEventListener('pointercancel', finishDrag);
}

function onPointerMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  drag.x = e.clientX;
  drag.y = e.clientY;

  if (!drag.started) {
    const dist = Math.hypot(drag.x - drag.sx, drag.y - drag.sy);
    if (drag.type === 'mouse') {
      if (dist > 5) startDrag();
    } else if (dist > 10) {
      finishDrag(); // палец сдвинулся до долгого нажатия: это прокрутка
      return;
    }
    if (!drag || !drag.started) return;
  }

  moveGhost();
  updateTarget();
}

function startDrag() {
  if (!drag || drag.started) return;
  drag.started = true;

  const ghost = drag.card.cloneNode(true);
  ghost.classList.add('ghost');
  ghost.style.width = drag.w + 'px';
  ghost.style.height = drag.h + 'px';
  document.body.appendChild(ghost);
  drag.ghost = ghost;

  drag.card.classList.add('dragging');
  document.body.classList.add('is-dragging');
  if (navigator.vibrate) navigator.vibrate(15);

  moveGhost();
  updateTarget();
  drag.raf = requestAnimationFrame(autoScroll);
}

function moveGhost() {
  drag.ghost.style.transform =
    `translate3d(${drag.x - drag.offX}px, ${drag.y - drag.offY}px, 0)`;
}

// Определяет зону под пальцем и переставляет карточку-«заглушку»
function updateTarget() {
  document.querySelectorAll('.dropzone.over').forEach(z => z.classList.remove('over'));

  const el = document.elementFromPoint(drag.x, drag.y);
  if (!el) return;

  const row = el.closest('.tier-row');
  const zone = el.closest('.dropzone') || (row && row.querySelector('.dropzone'));
  if (!zone) return;

  zone.classList.add('over');

  const card = drag.card;
  const before = getInsertBefore(zone, drag.x, drag.y);
  if (before) {
    if (card.nextSibling !== before || card.parentNode !== zone) zone.insertBefore(card, before);
  } else if (card.parentNode !== zone || card.nextSibling) {
    zone.appendChild(card);
  }
}

// Автопрокрутка страницы, когда карточку подносят к краю экрана
function autoScroll() {
  if (!drag || !drag.started) return;
  const edge = 70;
  let dy = 0;
  if (drag.y < edge) dy = -Math.ceil((edge - drag.y) / 6);
  else if (drag.y > window.innerHeight - edge) dy = Math.ceil((drag.y - (window.innerHeight - edge)) / 6);

  if (dy) {
    window.scrollBy(0, dy);
    updateTarget();
  }
  drag.raf = requestAnimationFrame(autoScroll);
}

function finishDrag() {
  if (!drag) return;
  clearTimeout(drag.timer);
  cancelAnimationFrame(drag.raf);
  if (drag.ghost) drag.ghost.remove();
  drag.card.classList.remove('dragging');
  document.body.classList.remove('is-dragging');
  document.querySelectorAll('.dropzone.over').forEach(z => z.classList.remove('over'));

  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', finishDrag);
  document.removeEventListener('pointercancel', finishDrag);
  drag = null;
}

// Когда drag активен, блокируем прокрутку страницы пальцем
document.addEventListener('touchmove', (e) => {
  if (drag && drag.started) e.preventDefault();
}, { passive: false });

/* ---------- Названия уровней ---------- */
function syncTierLabelWidth() {
  const firstLabel = tierLabels[0];
  if (!firstLabel) return;

  const style = getComputedStyle(firstLabel);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

  const rootStyle = getComputedStyle(document.documentElement);
  const minWidth = parseFloat(rootStyle.getPropertyValue('--label-min-w')) || 0;
  const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
  const widestText = Math.max(...tierLabels.map(label =>
    ctx.measureText(label.textContent.trim() || '?').width
  ));

  board.style.setProperty('--label-w', `${Math.ceil(Math.max(minWidth, widestText + padding + 2))}px`);
}

tierLabels.forEach(label => {
  label.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      label.blur();
    }
  });
  label.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text').replace(/\s+/g, ' ');
    document.execCommand('insertText', false, text);
  });
  label.addEventListener('blur', () => {
    if (!label.textContent.trim()) label.textContent = '?';
    label.textContent = label.textContent.replace(/\s+/g, ' ').trim();
    syncTierLabelWidth();
  });
  label.addEventListener('input', syncTierLabelWidth);
});

syncTierLabelWidth();
window.addEventListener('resize', syncTierLabelWidth);
document.fonts?.ready.then(syncTierLabelWidth);

/* Название тир-листа: Enter снимает фокус */
boardTitle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') boardTitle.blur();
});

/* ---------- Сброс ---------- */
resetBtn.addEventListener('click', () => {
  document.querySelectorAll('.tier-drop .card').forEach(card => pool.appendChild(card));
});

/* ---------- Экспорт в PNG ---------- */
exportBtn.addEventListener('click', exportBoard);

function drawLabel(ctx, text, x, y, w, h) {
  const size = 36;
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.fillStyle = '#000';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text || '?', x + w / 2, y + h / 2);
}

function drawCover(ctx, img, x, y, size) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  if (!iw || !ih) return;
  const s = Math.max(size / iw, size / ih);
  const sw = size / s, sh = size / s;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, size, size);
}

async function exportBoard() {
  const title = boardTitle.value.trim();
  const labelTexts = [...document.querySelectorAll('.tier-label')]
    .map(l => l.textContent.trim()).join(' ');

  // Убеждаемся, что шрифт загружен (включая кириллицу), прежде чем рисовать
  try {
    await document.fonts.load(`bold 30px ${FONT}`, title + labelTexts + 'АаЯя');
  } catch (e) { /* если шрифт недоступен, используется запасной моноширинный */ }

  // Левая колонка и весь холст растут под самую длинную подпись без переноса.
  const SIZE = 110, GAP = 6, MIN_H = 120, BORDER = 2;
  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = `bold 36px ${FONT}`;
  const labelWidth = Math.max(...tierLabels.map(label =>
    measureCtx.measureText(label.textContent.trim() || '?').width
  ));
  const LABEL_W = Math.max(140, Math.ceil(labelWidth + 40));
  const W = Math.max(1000, LABEL_W + 860);
  const cols = Math.floor((W - LABEL_W - GAP) / (SIZE + GAP));
  const TITLE_H = title ? 80 : 0;

  const rows = [...document.querySelectorAll('.tier-row')].map(row => {
    const label = row.querySelector('.tier-label');
    return {
      text: label.textContent.trim(),
      color: getComputedStyle(label).backgroundColor,
      imgs: [...row.querySelectorAll('.card img')]
    };
  });

  const heights = rows.map(r => {
    const lineCount = Math.max(1, Math.ceil(r.imgs.length / cols));
    return Math.max(MIN_H, lineCount * (SIZE + GAP) + GAP);
  });
  const boardH = heights.reduce((a, b) => a + b, 0) + BORDER * (rows.length + 1);
  const H = TITLE_H + boardH;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Общий фон
  ctx.fillStyle = '#121212';
  ctx.fillRect(0, 0, W, H);

  // Название
  if (title) {
    let size = 48;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    for (; size >= 16; size -= 2) {
      ctx.font = `bold ${size}px ${FONT}`;
      if (ctx.measureText(title).width <= W - 60) break;
    }
    ctx.fillText(title, W / 2, TITLE_H / 2);
  }

  // Таблица
  ctx.fillStyle = '#000';
  ctx.fillRect(0, TITLE_H, W, boardH);

  let y = TITLE_H + BORDER;
  rows.forEach((r, i) => {
    const h = heights[i];

    ctx.fillStyle = r.color;
    ctx.fillRect(BORDER, y, LABEL_W - BORDER, h);
    drawLabel(ctx, r.text, BORDER, y, LABEL_W - BORDER, h);

    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(LABEL_W, y, W - LABEL_W - BORDER, h);

    r.imgs.forEach((img, k) => {
      const cx = LABEL_W + GAP + (k % cols) * (SIZE + GAP);
      const cy = y + GAP + Math.floor(k / cols) * (SIZE + GAP);
      drawCover(ctx, img, cx, cy, SIZE);
    });

    y += h + BORDER;
  });

  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (title ? title.replace(/[\\/:*?"<>|]/g, '_') : 'tier-list') + '.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }, 'image/png');
}

