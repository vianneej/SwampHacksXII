import standingUrl from '../assets/standing.png';
import moveUpUrl from '../assets/moveup.png';
import moveDownUrl from '../assets/movedown.png';
import moveLeftUrl from '../assets/moveleft.png';
import moveRightUrl from '../assets/moveright.png';
import doorUrl from '../assets/door.png';
import treeUrl from '../assets/tree.png';
import bushUrl from '../assets/bush.png';
import brickUrl from '../assets/brick.png';
import grassUrl from '../assets/grass.png';
import countertopUrl from '../assets/countertop.png';
import wallUpperUrl from '../assets/walls/wall_upper.png';
import wallWainscotUrl from '../assets/walls/wall_wainscot.png';
import frameLeftUrl from '../assets/walls/frame_left.png';
import frameRightUrl from '../assets/walls/frame_right.png';
import postUrl from '../assets/walls/post.png';
import windowUrl from '../assets/window.png';

const canvas = document.getElementById('game');
const screen = canvas.getContext('2d');
let ctx = screen;
const W = canvas.width;
const H = canvas.height;
const background = document.createElement('canvas');
background.width = W;
background.height = H;

const SCALE = 0.55;
const PX = 4;

// Cafe interior bounds
const ROOM = { x: 24, y: 24, w: 880, h: 640 };
const FLOOR_Y = 170;
const DOOR = { x: 390, w: 150 };
const OPENING = { y: 340, h: 130 };

const SPRITE_NAMES = [
  'bar', 'espresso', 'grinder', 'pastry_case', 'sink', 'crate', 'cups',
  'jar_a', 'jar_b', 'jar_c', 'pitcher', 'plant_small_counter', 'menu_board',
  'cafe_sign', 'lounge', 'plant_large', 'plant_medium', 'plant_hanging',
  'plant_flower', 'painting', 'round_table_cups', 'table_chairs_side',
  'table_chair_back', 'table_chairs_three', 'table_chairs_cup', 'bench', 'rug',
];

// x, y are top-left in world pixels. ground: true adds a floor shadow.
const FLAT = [
  { s: 'rug', x: 372, y: 566 },
];

const WALL_DECOR = [
  { s: 'menu_board', x: 250, y: 56 },
  { s: 'plant_hanging', x: 440, y: 28 },
  { s: 'painting', x: 775, y: 44 },
];

const COUNTER = { x: 470, w: 420, bottom: 226, hitH: 56 };

const SHELF = { x: 310, y: 112, w: 120 };
const ON_SHELF = [
  { s: 'jar_a', x: 316 },
  { s: 'jar_b', x: 344 },
  { s: 'jar_c', x: 372 },
  { s: 'pitcher', x: 400 },
];

const FURNITURE = [
  { s: 'bar', x: 130, y: 195, ground: true },
  { s: 'table_chairs_side', x: 200, y: 400, ground: true },
  { s: 'table_chair_back', x: 540, y: 250, ground: true },
  { s: 'table_chairs_cup', x: 700, y: 290, ground: true },
  { s: 'round_table_cups', x: 740, y: 450, ground: true },
  { s: 'table_chairs_three', x: 400, y: 440, ground: true },
  { s: 'lounge', x: 40, y: 520, ground: true },
  { s: 'plant_large', x: 38, y: 200, ground: true },
  { s: 'plant_medium', x: 38, y: 430, ground: true },
  { s: 'plant_large', x: 818, y: 530, ground: true },
  { s: 'plant_flower', x: 850, y: 596, ground: true },
  { s: 'cafe_sign', x: 925, y: 235, ground: true },
  { s: 'bench', x: 1150, y: 430, ground: true },
];

const images = {};
const spriteUrls = import.meta.glob('../assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

function loadImages() {
  return Promise.all(SPRITE_NAMES.map((name) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { images[name] = img; resolve(); };
    img.onerror = () => reject(new Error(`Failed to load sprite: ${name}`));
    img.src = spriteUrls[`../assets/sprites/${name}.png`];
  })));
}

function hash(x, y) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function spriteSize(name) {
  const img = images[name];
  return { w: Math.round(img.width * SCALE), h: Math.round(img.height * SCALE) };
}

function drawSprite(name, x, y) {
  const { w, h } = spriteSize(name);
  ctx.drawImage(images[name], Math.round(x), Math.round(y), w, h);
}

function drawShadow(x, y, w, h) {
  ctx.fillStyle = 'rgba(30, 14, 4, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h - 3, w * 0.42, 7, 0, 0, Math.PI * 2);
  ctx.fill();
}

const GRASS_CROP = { sx: 128, sy: 128, size: 998 };
const GRASS_TILE = 128;
const BRICK_TILE = 160;
let grassPattern = null;
let brickPattern = null;
let wallUpperTile = null;
let wallWainscotTile = null;
const WALL_UPPER_H = 120;
const WALL_WAINSCOT_H = 50;
const FRAME_T = 26;

function makeTile(src, sx, sy, sw, sh, size, mirror) {
  const n = mirror ? 2 : 1;
  const c = document.createElement('canvas');
  c.width = size * n;
  c.height = size * n;
  const t = c.getContext('2d');
  t.imageSmoothingEnabled = true;
  t.imageSmoothingQuality = 'high';
  t.drawImage(src, sx, sy, sw, sh, 0, 0, size, size);
  if (mirror) {
    t.save(); t.scale(-1, 1); t.drawImage(src, sx, sy, sw, sh, -2 * size, 0, size, size); t.restore();
    t.save(); t.scale(1, -1); t.drawImage(src, sx, sy, sw, sh, 0, -2 * size, size, size); t.restore();
    t.save(); t.scale(-1, -1); t.drawImage(src, sx, sy, sw, sh, -2 * size, -2 * size, size, size); t.restore();
  }
  return c;
}

function buildPatterns() {
  const g = GRASS_CROP;
  grassPattern = ctx.createPattern(makeTile(grassImage, g.sx, g.sy, g.size, g.size, GRASS_TILE, true), 'repeat');
  const b = frames.brick;
  brickPattern = ctx.createPattern(makeTile(b.img, b.sx, b.sy, b.sw, b.sh, BRICK_TILE, false), 'repeat');
  wallUpperTile = scaledTile(frames.wallUpper, 28, WALL_UPPER_H);
  wallWainscotTile = scaledTile(frames.wallWainscot, 32, WALL_WAINSCOT_H);
}

function scaledTile(f, w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const t = c.getContext('2d');
  t.imageSmoothingEnabled = true;
  t.imageSmoothingQuality = 'high';
  t.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, 0, 0, w, h);
  return ctx.createPattern(c, 'repeat');
}

function fillPattern(pattern, x, y, w, h) {
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, w, h);
}

function drawPath() {
  fillPattern(brickPattern, 1010, 0, 130, H);
  fillPattern(brickPattern, ROOM.x + ROOM.w - 4, OPENING.y, 1018 - ROOM.x - ROOM.w + 4, OPENING.h);
}

function drawBush(cx, bottom, w) {
  const f = frames.bush;
  const h = w * (f.sh / f.sw);
  ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, Math.round(cx - w / 2), Math.round(bottom - h), w, h);
}

function drawTree(cx, bottom, h) {
  const f = frames.tree;
  const w = h * (f.sw / f.sh);
  ctx.fillStyle = 'rgba(20, 50, 15, 0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, bottom - 4, w * 0.28, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, Math.round(cx - w / 2), Math.round(bottom - h), w, h);
}

function drawOutdoors() {
  fillPattern(grassPattern, 0, 0, W, H);
  drawPath();

  drawBush(960, 640, 70);
  drawBush(1180, H - 8, 90);
  drawBush(1250, 580, 80);
  drawTree(1205, 230, 210);
  drawTree(1205, 480, 210);

  fillPattern(brickPattern, DOOR.x, ROOM.y + ROOM.h - 24, DOOR.w, H - ROOM.y - ROOM.h + 24);
}

function drawHedge() {
  for (let x = 40; x < 380; x += 56) drawBush(x, H - 8, 64);
  for (let x = 580; x < 900; x += 56) drawBush(x, H - 8, 64);
}

function drawFloor() {
  const x0 = ROOM.x;
  const x1 = ROOM.x + ROOM.w;
  const y1 = ROOM.y + ROOM.h - 24;
  const rowH = 24;
  const boardW = 120;
  const tones = ['#b97a3e', '#c4844a', '#ad6f36', '#bb7c40'];

  for (let row = 0, y = FLOOR_Y; y < y1; row++, y += rowH) {
    const offset = (row * 47) % boardW;
    for (let x = x0 - offset; x < x1; x += boardW) {
      const bx = Math.max(x, x0);
      const bw = Math.min(x + boardW, x1) - bx;
      const bh = Math.min(rowH, y1 - y);
      if (bw <= 0) continue;
      rect(bx, y, bw, bh, tones[Math.floor(hash(x, y) * tones.length)]);
      rect(bx, y, bw, PX / 2, '#cf9560');
      rect(bx, y + bh - PX, bw, PX, '#8a5126');
      rect(bx, y + bh - PX, PX / 2, PX, '#6b3d1a');
      if (x >= x0) rect(x, y, PX / 2, bh, '#6b3d1a');
      for (let g = 0; g < 3; g++) {
        const gx = bx + Math.floor(hash(x + g, y) * (bw - 12));
        rect(gx, y + 6 + g * 5, 10, 2, '#a8682f');
      }
    }
  }
}

function fillAt(pattern, x, y, w, h) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawFrame(f, x, y, w, h) {
  ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, x, y, w, h);
}

function drawWalls() {
  const { x, y, w, h } = ROOM;
  const right = x + w;
  const outerR = right + 24;
  const bottomY = y + h - 24;

  // back wall: beam, cream planks and wainscot in one strip
  fillAt(wallUpperTile, 0, 0, outerR, WALL_UPPER_H);
  fillAt(wallWainscotTile, 0, WALL_UPPER_H, outerR, WALL_WAINSCOT_H);

  // front wall, split around the door
  for (const [x0, x1] of [[0, DOOR.x], [DOOR.x + DOOR.w, outerR]]) {
    fillAt(wallWainscotTile, x0, bottomY, x1 - x0, WALL_WAINSCOT_H);
    rect(x0, bottomY, x1 - x0, 3, '#a86f38');
  }

  // side walls, split around the opening on the right
  drawFrame(frames.frameLeft, 0, 0, FRAME_T, bottomY + WALL_WAINSCOT_H);
  drawFrame(frames.frameRight, outerR - FRAME_T, 0, FRAME_T, OPENING.y);
  drawFrame(frames.frameRight, outerR - FRAME_T, OPENING.y + OPENING.h, FRAME_T, bottomY + WALL_WAINSCOT_H - OPENING.y - OPENING.h);

  // posts at the ends of the wall openings
  const post = (px, py, pw, ph) => drawFrame(frames.post, px, py, pw, ph);
  post(outerR - FRAME_T, OPENING.y - 28, FRAME_T, 28);
  post(outerR - FRAME_T, OPENING.y + OPENING.h, FRAME_T, 28);
  post(DOOR.x - 26, bottomY, 26, WALL_WAINSCOT_H);
  post(DOOR.x + DOOR.w, bottomY, 26, WALL_WAINSCOT_H);

  // back door
  const door = frames.door;
  const doorH = 114;
  const doorW = Math.round(door.sw * (doorH / door.sh));
  ctx.drawImage(door.img, door.sx, door.sy, door.sw, door.sh, 92 - Math.round(doorW / 2), FLOOR_Y - doorH - 2, doorW, doorH);

  // windows
  const win = frames.window;
  const winW = 70;
  const winH = Math.round(winW * (win.sh / win.sw));
  for (const cx of [176, 586]) {
    ctx.drawImage(win.img, win.sx, win.sy, win.sw, win.sh, cx - winW / 2, 36, winW, winH);
  }
}

function drawShelf() {
  rect(SHELF.x, SHELF.y, SHELF.w, 8, '#5a3318');
  rect(SHELF.x, SHELF.y, SHELF.w, 3, '#8f5a2e');
  for (const item of ON_SHELF) {
    const { h } = spriteSize(item.s);
    drawSprite(item.s, item.x, SHELF.y - h + 2);
  }
  const small = spriteSize('plant_small_counter');
  drawSprite('plant_small_counter', SHELF.x + SHELF.w - small.w - 2, SHELF.y - small.h + 2);
}

function drawBackCounter() {
  const f = frames.counter;
  const { x, w, bottom } = COUNTER;
  const h = Math.round(w * (f.sh / f.sw));
  ctx.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, x, bottom - h, w, h);
}

// ---- Player ----

const PLAYER_HEIGHT = 72;
const PLAYER_SPEED = 170;
const FEET_HALF_W = 12;
const FEET_H = 8;
const WALK_BOUNDS = {
  minX: ROOM.x + 14,
  maxX: ROOM.x + ROOM.w - 14,
  minY: FLOOR_Y + 6,
  maxY: ROOM.y + ROOM.h - 28,
};

const PLAYER_URLS = {
  standing: standingUrl,
  up: moveUpUrl,
  down: moveDownUrl,
  left: moveLeftUrl,
  right: moveRightUrl,
  door: doorUrl,
  tree: treeUrl,
  bush: bushUrl,
  brick: brickUrl,
  counter: countertopUrl,
  wallUpper: wallUpperUrl,
  wallWainscot: wallWainscotUrl,
  frameLeft: frameLeftUrl,
  frameRight: frameRightUrl,
  post: postUrl,
  window: windowUrl,
};
let grassImage = null;
const frames = {};

const player = { x: 465, y: 600, facing: 'down', moving: false, t: 0 };

const DIRECTIONS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};
const held = [];
let showHitboxes = false;

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyH' && !e.repeat) showHitboxes = !showHitboxes;
  const dir = DIRECTIONS[e.code];
  if (!dir) return;
  e.preventDefault();
  if (!held.includes(dir)) held.push(dir);
});
window.addEventListener('keyup', (e) => {
  const dir = DIRECTIONS[e.code];
  if (!dir) return;
  const i = held.indexOf(dir);
  if (i !== -1) held.splice(i, 1);
});
window.addEventListener('blur', () => { held.length = 0; });

function loadFrame(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const cx = c.getContext('2d');
      cx.drawImage(img, 0, 0);
      const data = cx.getImageData(0, 0, c.width, c.height).data;
      let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (data[(y * c.width + x) * 4 + 3] > 16) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      resolve({ img, sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 });
    };
    img.onerror = () => reject(new Error(`Failed to load player frame: ${url}`));
    img.src = url;
  });
}

async function loadPlayerFrames() {
  grassImage = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load grass'));
    img.src = grassUrl;
  });
  await Promise.all(Object.entries(PLAYER_URLS).map(async ([name, url]) => {
    frames[name] = await loadFrame(url);
  }));
}

// ---- Collision ----

// hit boxes are fractions of the sprite box: [x, y, w, h]
const BOTTOM_BAND = [[0.05, 0.6, 0.9, 0.4]];
const HITS = {
  bar: [[0, 0.41, 1, 0.59], [0, 0, 0.1, 0.41], [0.9, 0, 0.1, 0.41]],
  lounge: [[0.01, 0.05, 0.31, 0.85], [0.42, 0.35, 0.39, 0.48]],
  table_chair_back: [[0.05, 0.5, 0.9, 0.5]],
  table_chairs_three: [[0.05, 0.5, 0.9, 0.5]],
  round_table_cups: [[0.1, 0.45, 0.8, 0.55]],
  plant_large: [[0.25, 0.75, 0.5, 0.25]],
  plant_medium: [[0.25, 0.75, 0.5, 0.25]],
  plant_flower: [[0.2, 0.7, 0.6, 0.3]],
};
const NO_HIT = new Set(['cafe_sign', 'bench']);

let colliders = [];

function buildColliders() {
  colliders = [{ x: COUNTER.x, y: COUNTER.bottom - COUNTER.hitH, w: COUNTER.w, h: COUNTER.hitH }];
  for (const f of FURNITURE) {
    if (NO_HIT.has(f.s)) continue;
    const { w, h } = spriteSize(f.s);
    for (const [fx, fy, fw, fh] of HITS[f.s] || BOTTOM_BAND) {
      colliders.push({ x: f.x + fx * w, y: f.y + fy * h, w: fw * w, h: fh * h });
    }
  }
}

function blocked(x, y) {
  const l = x - FEET_HALF_W;
  const r = x + FEET_HALF_W;
  const t = y - FEET_H;
  if (l < WALK_BOUNDS.minX || r > WALK_BOUNDS.maxX) return true;
  if (y < WALK_BOUNDS.minY || y > WALK_BOUNDS.maxY) return true;
  return colliders.some((c) => l < c.x + c.w && r > c.x && t < c.y + c.h && y > c.y);
}

function updatePlayer(dt) {
  let dx = 0;
  let dy = 0;
  if (held.includes('left')) dx -= 1;
  if (held.includes('right')) dx += 1;
  if (held.includes('up')) dy -= 1;
  if (held.includes('down')) dy += 1;

  player.moving = dx !== 0 || dy !== 0;
  if (held.length) player.facing = held[held.length - 1];
  if (!player.moving) { player.t = 0; return; }

  const len = Math.hypot(dx, dy);
  const step = PLAYER_SPEED * dt;
  const nx = player.x + (dx / len) * step;
  const ny = player.y + (dy / len) * step;
  if (!blocked(nx, player.y)) player.x = nx;
  if (!blocked(player.x, ny)) player.y = ny;
  player.t += dt;
}

function drawPlayer() {
  let frame = frames.standing;
  let flip = false;
  let bob = 0;

  if (player.moving) {
    frame = frames[player.facing];
    bob = -Math.abs(Math.sin(player.t * 11)) * 3;
    if (player.facing === 'up' || player.facing === 'down') {
      flip = Math.floor(player.t * 5) % 2 === 1;
    }
  } else if (player.facing === 'up') {
    frame = frames.up;
  }

  const scale = PLAYER_HEIGHT / frames.standing.sh;
  const dw = frame.sw * scale;
  const dh = frame.sh * scale;
  const px = Math.round(player.x);
  const py = Math.round(player.y);

  ctx.fillStyle = 'rgba(30, 14, 4, 0.3)';
  ctx.beginPath();
  ctx.ellipse(px, py - 2, 17, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(px, py + bob);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, -dw / 2, -dh, dw, dh);
  ctx.restore();
}

function drawHitboxes() {
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
  ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
  for (const c of colliders) {
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeRect(c.x, c.y, c.w, c.h);
  }
  ctx.strokeStyle = 'rgba(0, 120, 255, 0.9)';
  ctx.strokeRect(player.x - FEET_HALF_W, player.y - FEET_H, FEET_HALF_W * 2, FEET_H);
}

// ---- Rendering ----

function buildBackground() {
  ctx = background.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  buildPatterns();
  drawOutdoors();
  drawFloor();
  drawWalls();
  drawHedge();
  for (const d of WALL_DECOR) drawSprite(d.s, d.x, d.y);
  drawShelf();
  drawBackCounter();
  for (const f of FLAT) drawSprite(f.s, f.x, f.y);
  ctx = screen;
}

function render() {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(background, 0, 0);

  const drawables = FURNITURE.map((f) => {
    const { w, h } = spriteSize(f.s);
    return {
      bottom: f.y + h,
      draw: () => {
        if (f.ground) drawShadow(f.x, f.y, w, h);
        drawSprite(f.s, f.x, f.y);
      },
    };
  });
  drawables.push({ bottom: player.y, draw: drawPlayer });
  drawables.sort((a, b) => a.bottom - b.bottom);
  for (const d of drawables) d.draw();

  if (showHitboxes) drawHitboxes();
}

let lastTime = 0;
function frame(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);
  lastTime = time;
  updatePlayer(dt);
  render();
  requestAnimationFrame(frame);
}

Promise.all([loadImages(), loadPlayerFrames()]).then(() => {
  buildBackground();
  buildColliders();
  requestAnimationFrame((t) => { lastTime = t; requestAnimationFrame(frame); });
}).catch((err) => {
  console.error(err);
  ctx.fillStyle = '#fff';
  ctx.fillText(err.message, 20, 30);
});
