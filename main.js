// --- Config ---
const CONFIG = {
  cols: 10,
  rowsVisible: 16,
  startGaps: 6,      // easier: more gaps
  minGaps: 2,        // always at least 2
  spawnEvery: 1,
  startDelay: 800,   // slower start
  minDelay: 200,
  levelEvery: 10,
  colors: ["#7aa2f7","#f6bd60","#84dcc6","#f28482","#c3a6ff"],
};

// --- Game State ---
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const ovTitle = document.getElementById('ovTitle');
const ovSubtitle = document.getElementById('ovSubtitle');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const levelEl = document.getElementById('level');
const resetBest = document.getElementById('resetBest');

let gridSize, cellW, cellH;
let timer = 0;
let delay = CONFIG.startDelay;
let running = false;
let paused = false;
let score = 0;
let level = 1;
let best = parseInt(localStorage.getItem('gap_best') || '0', 10);
bestEl.textContent = best;

// Player state
let playerX = Math.floor(CONFIG.cols/2);
const playerRow = CONFIG.rowsVisible - 2; // row index on canvas
let rows = [];

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * (window.devicePixelRatio || 1));
  canvas.height = Math.floor(canvas.width * 16 / 10);
  gridSize = { cols: CONFIG.cols, rows: CONFIG.rowsVisible };
  cellW = canvas.width / gridSize.cols;
  cellH = canvas.height / gridSize.rows;
  draw();
}
window.addEventListener('resize', resizeCanvas);

// --- Utilities ---
function makeRow(gaps) {
  const arr = new Array(CONFIG.cols).fill(true); // true = block, false = gap
  const idxs = [...Array(CONFIG.cols).keys()];
  shuffle(idxs);
  for (let i=0; i<gaps; i++) arr[idxs[i]] = false;
  return arr;
}

function shuffle(a) {
  for (let i=a.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function currentGaps() {
  return Math.max(CONFIG.minGaps, CONFIG.startGaps - Math.floor((level-1)/2));
}

function currentDelay() {
  return Math.max(CONFIG.minDelay, CONFIG.startDelay - (level-1) * 40);
}

function setPaused(p) {
  paused = p;
  pauseBtn.textContent = paused ? 'Resume (Space)' : 'Pause (Space)';
  toggleOverlay(paused && running, paused ? 'Paused' : '', paused ? 'Press Space or Resume' : '');
}

function toggleOverlay(show, title, subtitle) {
  overlay.hidden = !show;
  if (title !== undefined) ovTitle.textContent = title;
  if (subtitle !== undefined) ovSubtitle.textContent = subtitle;
  startBtn.style.display = running ? 'none' : 'inline-block';
  pauseBtn.style.display = running ? 'inline-block' : 'none';
}

// --- Game Loop ---
let lastTime = 0;
function loop(ts) {
  if (!running) return;
  if (!lastTime) lastTime = ts;
  const dt = Math.min(50, ts - lastTime);
  lastTime = ts;
  if (!paused) {
    timer += dt;
    if (timer >= delay) {
      step();
      timer = 0;
    }
  }
  draw();
  requestAnimationFrame(loop);
}

function step() {
  rows.unshift(makeRow(currentGaps()));
  if (rows.length > CONFIG.rowsVisible) rows.pop();

  // Collision row == the row drawn at player's y → index is (playerRow - 1)
  const collideIdx = Math.max(0, Math.min(rows.length - 1, playerRow - 1));
  const row = rows[collideIdx];

  if (row && row[playerX]) {
    gameOver();
  } else if (row) {
    score += 1;
    if (score % CONFIG.levelEvery === 0) {
      level += 1;
      delay = currentDelay();
    }
    scoreEl.textContent = score;
    levelEl.textContent = level;
  }
}

function gameOver() {
  running = false;
  paused = false;
  best = Math.max(best, score);
  localStorage.setItem('gap_best', String(best));
  bestEl.textContent = best;
  toggleOverlay(true, 'Game Over', `Score ${score} · Best ${best}`);

  // make overlay more transparent after 2s
  setTimeout(() => {
    const card = document.querySelector('.card');
    if (card) card.style.background = 'rgba(16,20,45,0.7)';
  }, 2000);
}

function resetGame() {
  rows = [];
  for (let i = 0; i < CONFIG.rowsVisible - 1; i++) {
    rows.push(makeRow(currentGaps()));
  }

  // Force the cell the player stands on to be a gap.
  // On-screen player y = playerRow → in rows[] that is index (playerRow - 1)
  const center = Math.floor(CONFIG.cols / 2);
  const startIdx = Math.max(0, Math.min(rows.length - 1, playerRow - 1));
  if (!rows[startIdx]) rows[startIdx] = makeRow(currentGaps());
  rows[startIdx][center] = false; // <-- guaranteed empty start cell
  playerX = center;

  score = 0;
  level = 1;
  delay = currentDelay();
  timer = 0;
  lastTime = 0;
  paused = false;
  scoreEl.textContent = score;
  levelEl.textContent = level;
  toggleOverlay(false);
}

function start() {
  resetGame();
  running = true;
  requestAnimationFrame(loop);
}

// --- Rendering ---
function drawGrid() {
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#ffffff';
  for (let c=1;c<gridSize.cols;c++) {
    const x = c*cellW+.5;
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
  }
  for (let r=1;r<gridSize.rows;r++) {
    const y = r*cellH+.5;
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
  }
  ctx.restore();
}

function drawBlocks() {
  // y-row on canvas is (1 + r)
  for (let r=0;r<rows.length;r++) {
    const row = rows[r];
    if (!row) continue;
    const y = (1 + r) * cellH;
    for (let c=0;c<row.length;c++) {
      if (!row[c]) continue;
      const x = c*cellW;
      const color = CONFIG.colors[(r+c)%CONFIG.colors.length];
      roundedRect(x+3, y+3, cellW-6, cellH-6, 6, color);
    }
  }
}

function roundedRect(x,y,w,h,r,fill) {
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = '#fff';
  ctx.fillRect(x+2,y+2,w-4,Math.max(1,h*0.18));
  ctx.restore();
}

function drawPlayer() {
  const x = playerX*cellW;
  const y = playerRow*cellH; // player visually on row playerRow
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = 'rgba(124,244,196,0.9)';
  ctx.lineWidth = 3;
  ctx.setLineDash([8,6]);
  const pad = 4;
  ctx.strokeRect(x+pad, y+pad, cellW-2*pad, cellH-2*pad);
  ctx.setLineDash([]);
  ctx.globalAlpha = 0.06;
  ctx.fillStyle = '#7cf4c4';
  ctx.fillRect(x+2, y+2, cellW-4, cellH-4);
  ctx.restore();
}

function drawHint() {
  ctx.save();
  ctx.font = `${Math.floor(cellH * 0.5)}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'center';
  ctx.fillText("Stay on the gaps! Avoid landing on blocks.", canvas.width / 2, cellH * 1.2);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawGrid();
  drawBlocks();
  drawPlayer();
  drawHint();  // small permanent hint
}

// --- Input ---
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1, e.shiftKey); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); move(1, e.shiftKey); }
  else if (e.code === 'Space') { e.preventDefault(); if (!running) start(); else setPaused(!paused); }
});

function move(dx, fast = false) {
  if (paused) return;
  const step = fast ? 2 : 1; // hold Shift to move 2 cells
  playerX = Math.max(0, Math.min(CONFIG.cols-1, playerX + dx*step));
}

// Touch / swipe
let touchStartX = null;
canvas.addEventListener('touchstart', (e) => {
  if (!running) start();
  touchStartX = e.changedTouches[0].clientX;
}, { passive: true });
canvas.addEventListener('touchend', (e) => {
  if (touchStartX == null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const threshold = 24;
  if (Math.abs(dx) > threshold) move(dx > 0 ? 1 : -1);
  touchStartX = null;
});

// Buttons
startBtn.addEventListener('click', () => { if (!running) start(); });
pauseBtn.addEventListener('click', () => { if (running) setPaused(!paused); });
resetBest.addEventListener('click', (e) => {
  e.preventDefault();
  localStorage.removeItem('gap_best');
  best = 0;
  bestEl.textContent = '0';
});

// Initial state
resizeCanvas();
toggleOverlay(true, 'Flip the Script',
  "Move left/right to stay in the gaps. Each new row, make sure you're standing on a gap — if a block lands on you, it's game over!");

// --- Export API ---
window.__GAP_GAME__ = {
  setSpeed(ms) { delay = Math.max(CONFIG.minDelay, ms); },
  setCols(c) { CONFIG.cols = Math.max(4, Math.min(16, c|0)); resizeCanvas(); },
  setGaps(n) { CONFIG.startGaps = Math.max(1, Math.min(CONFIG.cols-1, n|0)); },
  pause() { if (running) setPaused(true); },
  resume() { if (running) setPaused(false); },
};
