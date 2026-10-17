import standingUrl from '../assets/standing.png';
import moveUpUrl from '../assets/moveup.png';
import moveDownUrl from '../assets/movedown.png';
import walkLeftUrl from '../assets/leftwalking.png';
import doorUrl from '../assets/door.png';
import treeUrl from '../assets/tree.png';
import bushUrl from '../assets/bush.png';
import brickUrl from '../assets/brick.png';
import brickVerticalUrl from '../assets/brickvertical.png';
import grassUrl from '../assets/grass.png';
import countertopUrl from '../assets/countertop.png';
import wallUpperUrl from '../assets/walls/wall_upper.png';
import wallWainscotUrl from '../assets/walls/wall_wainscot.png';
import frameLeftUrl from '../assets/walls/frame_left.png';
import frameRightUrl from '../assets/walls/frame_right.png';
import postUrl from '../assets/walls/post.png';
import windowUrl from '../assets/window.png';
import bookshelfLowUrl from '../assets/bookshelf.png';
import bookshelfShortUrl from '../assets/shortbookshelf.png';
import bookshelfTallUrl from '../assets/tallbookshelf.png';
import flowerShelfUrl from '../assets/flowershelf.png';
import cashRegisterUrl from '../assets/cashregister.png';
import flowerPotsUrl from '../assets/flowerpots.png';
import flowerPostUrl from '../assets/flowerpost.png';
import flowerTentUrl from '../assets/flowertent.png';
import fountainUrl from '../assets/fountain.png';
import slideUrl from '../assets/slide.png';
import wildflowersUrl from '../assets/wildflowers.png';
import librarySignUrl from '../assets/librarysign.png';

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
let brickVPattern = null;
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
  const bv = frames.brickV;
  brickVPattern = ctx.createPattern(makeTile(bv.img, bv.sx, bv.sy, bv.sw, bv.sh, BRICK_TILE, false), 'repeat');
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

const TURN = { y: 530, h: 130 };

function drawPath() {
  fillPattern(brickPattern, ROOM.x + ROOM.w - 4, OPENING.y, 1018 - ROOM.x - ROOM.w + 4, OPENING.h);
  fillPattern(brickVPattern, 1010, 0, 130, TURN.y);
  fillPattern(brickPattern, 1010, TURN.y, W - 1010, TURN.h);
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
  drawBush(1150, H - 6, 70);
  drawTree(1205, 230, 210);
  drawTree(1205, 480, 210);

  fillPattern(brickVPattern, DOOR.x, ROOM.y + ROOM.h - 24, DOOR.w, H - ROOM.y - ROOM.h + 24);
}

function drawHedge() {
  for (let x = 40; x < 380; x += 56) drawBush(x, H - 8, 64);
  for (let x = 580; x < 900; x += 56) drawBush(x, H - 8, 64);
}

function drawFloor(x0 = ROOM.x, x1 = ROOM.x + ROOM.w, y1 = ROOM.y + ROOM.h - 24) {
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

// ---- Library ----

const LIB_BOTTOM = ROOM.y + ROOM.h - 24;
const LIB_DOOR = { x: 570, w: 150 };
const LIB_SHELF_BOTTOM = 206;
const LIB_WALL_SHELF_SPECS = [
  { frame: 'bookshelfTall', x: 40, h: 170 },
  { frame: 'bookshelfShort', x: 165, h: 125 },
  { frame: 'bookshelfTall', x: 345, h: 170 },
  { frame: 'bookshelfTall', x: 815, h: 170 },
  { frame: 'bookshelfShort', x: 940, h: 125 },
  { frame: 'bookshelfTall', x: 1120, h: 170 },
];
let libWallShelves = [];

const LIBRARY_ITEMS = [
  { frame: 'bookshelfLow', x: 130, y: 300, h: 100 },
  { frame: 'bookshelfShort', x: 545, y: 290, h: 125 },
  { frame: 'bookshelfLow', x: 960, y: 300, h: 100 },
  { s: 'bench', x: 570, y: 160, ground: true, hits: [[0.02, 0.4, 0.96, 0.6]] },
  { s: 'plant_large', x: 485, y: 120, ground: true },
  { s: 'plant_large', x: 745, y: 120, ground: true },
  { s: 'table_chairs_cup', x: 90, y: 480, ground: true },
  { s: 'table_chairs_side', x: 290, y: 500, ground: true },
  { s: 'table_chairs_three', x: 520, y: 470, ground: true },
  { s: 'round_table_cups', x: 760, y: 490, ground: true },
  { s: 'table_chair_back', x: 870, y: 460, ground: true },
  { s: 'lounge', x: 1000, y: 500, ground: true },
  { s: 'plant_large', x: 40, y: 330, ground: true },
  { s: 'plant_large', x: 1185, y: 330, ground: true },
  { s: 'plant_medium', x: 40, y: 560, ground: true },
  { s: 'plant_flower', x: 850, y: 596, ground: true },
  { frame: 'librarySign', x: 738, y: 585, h: 132, hits: [] },
];

function frameSprite(name, h) {
  const f = frames[name];
  const w = Math.round(h * (f.sw / f.sh));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(f.img, f.sx, f.sy, f.sw, f.sh, 0, 0, w, h);
  return { img: c, w, h };
}

function drawLibraryWalls() {
  fillAt(wallUpperTile, 0, 0, W, WALL_UPPER_H);
  fillAt(wallWainscotTile, 0, WALL_UPPER_H, W, WALL_WAINSCOT_H);
  for (const [x0, x1] of [[0, LIB_DOOR.x], [LIB_DOOR.x + LIB_DOOR.w, W]]) {
    fillAt(wallWainscotTile, x0, LIB_BOTTOM, x1 - x0, WALL_WAINSCOT_H);
    rect(x0, LIB_BOTTOM, x1 - x0, 3, '#a86f38');
  }
  drawFrame(frames.frameLeft, 0, 0, FRAME_T, LIB_BOTTOM + WALL_WAINSCOT_H);
  drawFrame(frames.frameRight, W - FRAME_T, 0, FRAME_T, LIB_BOTTOM + WALL_WAINSCOT_H);
  drawFrame(frames.post, LIB_DOOR.x - 26, LIB_BOTTOM, 26, WALL_WAINSCOT_H);
  drawFrame(frames.post, LIB_DOOR.x + LIB_DOOR.w, LIB_BOTTOM, 26, WALL_WAINSCOT_H);
}

function drawLibraryBackground() {
  fillPattern(grassPattern, 0, 0, W, H);
  drawFloor(24, W, LIB_BOTTOM);
  fillPattern(brickVPattern, LIB_DOOR.x, LIB_BOTTOM, LIB_DOOR.w, H - LIB_BOTTOM);
  drawLibraryWalls();

  for (let x = LIB_DOOR.x - 32; x > 20; x -= 56) drawBush(x, H - 8, 64);
  for (let x = LIB_DOOR.x + LIB_DOOR.w + 32; x < W - 20; x += 56) drawBush(x, H - 8, 64);

  drawSprite('rug', 490, 515);

  for (const sh of libWallShelves) ctx.drawImage(sh.img, sh.x, sh.y);

  drawSprite('painting', 603, 62);
}

// ---- Flower shop ----

const SHOP = { x: 300, w: 680, bottom: 390, door: { x: 565, w: 150 } };
const SHOP_PLAZA_Y = 440;
const SHOP_SHELF_BOTTOM = 206;
const SHOP_WALL_SHELF_SPECS = [
  { frame: 'flowerShelf', x: 330, h: 150 },
  { frame: 'flowerShelf', x: 466, h: 150 },
  { frame: 'flowerShelf', x: 674, h: 150 },
  { frame: 'flowerShelf', x: 810, h: 150 },
];
let shopWallShelves = [];

const SHOP_WALKABLE = [
  { x0: -60, y0: TURN.y + 8, x1: 260, y1: TURN.y + TURN.h - 2 },
  { x0: 250, y0: SHOP_PLAZA_Y + 6, x1: W - 16, y1: TURN.y + TURN.h - 4 },
  { x0: SHOP.x + 30, y0: FLOOR_Y - 2, x1: SHOP.x + SHOP.w - 30, y1: SHOP.bottom - 4 },
  { x0: SHOP.door.x + 8, y0: SHOP.bottom - 20, x1: SHOP.door.x + SHOP.door.w - 8, y1: SHOP_PLAZA_Y + 10 },
];

const SHOP_ITEMS = [
  // inside
  { frame: 'cashRegister', x: 345, y: 235, h: 100, hits: [[0.02, 0.5, 0.96, 0.5]] },
  { frame: 'flowerPots', x: 820, y: 225, h: 120, hits: [[0.05, 0.55, 0.9, 0.45]] },
  { s: 'plant_large', x: 335, y: 320, ground: true },
  { s: 'plant_large', x: 915, y: 320, ground: true },
  { s: 'plant_flower', x: 790, y: 330, ground: true },
  // outside: tent, sign, pots, seating
  { frame: 'flowerTent', x: 800, y: 365, h: 210, hits: [[0.03, 0.5, 0.94, 0.5]] },
  { frame: 'flowerPost', x: SHOP.x - 62, y: 230, h: 90, hits: [] },
  { frame: 'flowerPots', x: 440, y: 455, h: 100, hits: [[0.05, 0.55, 0.9, 0.45]] },
  { frame: 'flowerPots', x: 1090, y: 455, h: 100, hits: [[0.05, 0.55, 0.9, 0.45]] },
  { s: 'table_chairs_cup', x: 290, y: 470, ground: true },
  { s: 'round_table_cups', x: 285, y: 572, ground: true },
  { s: 'table_chairs_side', x: 395, y: 570, ground: true },
  { s: 'bench', x: 1060, y: 610, ground: true, hits: [[0.02, 0.4, 0.96, 0.6]] },
  { s: 'bench', x: 910, y: 610, ground: true, hits: [[0.02, 0.4, 0.96, 0.6]] },
  { s: 'plant_flower', x: 1200, y: 560, ground: true },
];

function drawShopBackground() {
  const right = SHOP.x + SHOP.w;
  const door = SHOP.door;
  fillPattern(grassPattern, 0, 0, W, H);

  // road from the left, plaza in front of the building
  fillPattern(brickPattern, 0, TURN.y, 270, TURN.h);
  fillPattern(brickPattern, 250, SHOP_PLAZA_Y, W - 250, TURN.y + TURN.h - SHOP_PLAZA_Y);
  fillPattern(brickVPattern, door.x, SHOP.bottom, door.w, SHOP_PLAZA_Y - SHOP.bottom + 6);

  drawTree(60, 290, 210);
  drawTree(1170, 330, 210);
  drawTree(1235, 200, 210);

  // building: floor, back wall, front wall with a doorway, side frames
  drawFloor(SHOP.x, right, SHOP.bottom);
  fillAt(wallUpperTile, SHOP.x, 0, SHOP.w, WALL_UPPER_H);
  fillAt(wallWainscotTile, SHOP.x, WALL_UPPER_H, SHOP.w, WALL_WAINSCOT_H);
  for (const [x0, x1] of [[SHOP.x, door.x], [door.x + door.w, right]]) {
    fillAt(wallWainscotTile, x0, SHOP.bottom, x1 - x0, WALL_WAINSCOT_H);
    rect(x0, SHOP.bottom, x1 - x0, 3, '#a86f38');
  }
  drawFrame(frames.frameLeft, SHOP.x, 0, FRAME_T, SHOP.bottom + WALL_WAINSCOT_H);
  drawFrame(frames.frameRight, right - FRAME_T, 0, FRAME_T, SHOP.bottom + WALL_WAINSCOT_H);
  drawFrame(frames.post, door.x - 26, SHOP.bottom, 26, WALL_WAINSCOT_H);
  drawFrame(frames.post, door.x + door.w, SHOP.bottom, 26, WALL_WAINSCOT_H);

  const win = frames.window;
  const winW = 60;
  const winH = Math.round(winW * (win.sh / win.sw));
  ctx.drawImage(win.img, win.sx, win.sy, win.sw, win.sh, 640 - winW / 2, 36, winW, winH);

  for (const sh of shopWallShelves) ctx.drawImage(sh.img, sh.x, sh.y);

  for (let x = 40; x < W; x += 80) drawBush(x, H - 2, 62);
}

// ---- Park ----

const PARK_PATH_Y = { y: 310, h: 100 };
const PARK_WALKABLE = [
  { x0: DOOR.x + 8, y0: -60, x1: DOOR.x + DOOR.w - 8, y1: 160 },
  { x0: 40, y0: 140, x1: W - 40, y1: H - 70 },
];
const PARK_TREE_HITS = [[0.4, 0.85, 0.2, 0.15]];
const BENCH_HITS = [[0.02, 0.4, 0.96, 0.6]];
const WILD_HITS = [[0.15, 0.6, 0.7, 0.4]];
const PARK_ITEMS = [
  // top row of trees
  { tree: true, cx: 90, bottom: 230, h: 220 },
  { tree: true, cx: 270, bottom: 215, h: 200 },
  { tree: true, cx: 700, bottom: 225, h: 220 },
  { tree: true, cx: 940, bottom: 210, h: 200 },
  { tree: true, cx: 1170, bottom: 230, h: 220 },
  // bottom trees
  { tree: true, cx: 70, bottom: 600, h: 210 },
  { tree: true, cx: 215, bottom: 690, h: 190 },
  { tree: true, cx: 715, bottom: 695, h: 190 },
  { tree: true, cx: 1200, bottom: 650, h: 200 },
  // fountain plaza and slide
  { frame: 'fountain', cx: 465, y: 440, h: 210, hits: [[0.05, 0.3, 0.9, 0.7]] },
  { frame: 'slide', x: 880, y: 520, h: 150, hits: [[0.05, 0.55, 0.9, 0.45]] },
  // benches
  { s: 'bench', x: 160, y: 250, ground: true, hits: BENCH_HITS },
  { s: 'bench', x: 770, y: 250, ground: true, hits: BENCH_HITS },
  { s: 'bench', x: 1020, y: 250, ground: true, hits: BENCH_HITS },
  { s: 'bench', x: 130, y: 435, ground: true, hits: BENCH_HITS },
  { s: 'bench', x: 780, y: 440, ground: true, hits: BENCH_HITS },
  { s: 'bench', x: 1010, y: 440, ground: true, hits: BENCH_HITS },
  // wildflowers
  { frame: 'wildflowers', x: 320, y: 255, h: 58, hits: WILD_HITS },
  { frame: 'wildflowers', x: 585, y: 255, h: 58, hits: WILD_HITS },
  { frame: 'wildflowers', x: 255, y: 520, h: 62, hits: WILD_HITS },
  { frame: 'wildflowers', x: 625, y: 520, h: 62, hits: WILD_HITS },
  { frame: 'wildflowers', x: 285, y: 600, h: 55, hits: WILD_HITS },
  { frame: 'wildflowers', x: 625, y: 610, h: 55, hits: WILD_HITS },
  { frame: 'wildflowers', x: 1110, y: 590, h: 60, hits: WILD_HITS },
  { frame: 'wildflowers', x: 60, y: 480, h: 58, hits: WILD_HITS },
  { frame: 'wildflowers', x: 1200, y: 360, h: 58, hits: WILD_HITS },
  { s: 'plant_flower', x: 930, y: 450, ground: true },
];

function drawParkBackground() {
  fillPattern(grassPattern, 0, 0, W, H);
  fillPattern(brickPattern, 0, PARK_PATH_Y.y, W, PARK_PATH_Y.h);
  fillPattern(brickPattern, 310, PARK_PATH_Y.y - 20, 310, 675 - PARK_PATH_Y.y + 20);
  fillPattern(brickVPattern, DOOR.x, 0, DOOR.w, PARK_PATH_Y.y);

  for (let y = 80; y <= 290; y += 52) {
    drawBush(DOOR.x - 14, y, 46);
    drawBush(DOOR.x + DOOR.w + 14, y, 46);
  }
  for (let y = 470; y <= 680; y += 52) {
    drawBush(298, y, 50);
    drawBush(632, y, 50);
  }
  for (let x = 40; x < DOOR.x - 30; x += 56) drawBush(x, 125, 64);
  for (let x = 40; x < W; x += 64) drawBush(x, H - 2, 64);
}

// ---- Player ----

const PLAYER_HEIGHT = 72;
const PLAYER_SPEED = 170;
const FEET_HALF_W = 12;
const FEET_H = 8;

const WALK_SHEETS = { left: { url: walkLeftUrl, mirror: false }, right: { url: walkLeftUrl, mirror: true } };
const WALK_CELLS = 3;
const WALK_CYCLE = [0, 1, 2, 1];
const WALK_FPS = 9;
const walkSheets = {};

const PLAYER_URLS = {
  standing: standingUrl,
  up: moveUpUrl,
  down: moveDownUrl,
  door: doorUrl,
  tree: treeUrl,
  bush: bushUrl,
  brick: brickUrl,
  brickV: brickVerticalUrl,
  counter: countertopUrl,
  wallUpper: wallUpperUrl,
  wallWainscot: wallWainscotUrl,
  frameLeft: frameLeftUrl,
  frameRight: frameRightUrl,
  post: postUrl,
  window: windowUrl,
  bookshelfLow: bookshelfLowUrl,
  bookshelfShort: bookshelfShortUrl,
  bookshelfTall: bookshelfTallUrl,
  flowerShelf: flowerShelfUrl,
  cashRegister: cashRegisterUrl,
  flowerPots: flowerPotsUrl,
  flowerPost: flowerPostUrl,
  flowerTent: flowerTentUrl,
  fountain: fountainUrl,
  slide: slideUrl,
  wildflowers: wildflowersUrl,
  librarySign: librarySignUrl,
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

function loadWalkSheet({ url, mirror }) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const cx = c.getContext('2d');
      if (mirror) { cx.translate(c.width, 0); cx.scale(-1, 1); }
      cx.drawImage(img, 0, 0);
      const data = cx.getImageData(0, 0, c.width, c.height).data;

      // find each figure as a run of non-empty columns separated by a wide gap
      const colHasInk = new Array(c.width).fill(false);
      for (let y = 0; y < c.height; y++) {
        for (let x = 0; x < c.width; x++) {
          if (data[(y * c.width + x) * 4 + 3] > 16) colHasInk[x] = true;
        }
      }
      const runs = [];
      let start = -1;
      let lastInk = -1;
      for (let x = 0; x < c.width; x++) {
        if (!colHasInk[x]) continue;
        if (start === -1) start = x;
        else if (x - lastInk > 30) { runs.push([start, lastInk]); start = x; }
        lastInk = x;
      }
      if (start !== -1) runs.push([start, lastInk]);
      if (runs.length !== WALK_CELLS) { reject(new Error(`Expected ${WALK_CELLS} walk frames in ${url}, found ${runs.length}`)); return; }

      const boxes = runs.map(([x0, x1]) => {
        let minY = c.height, maxY = -1, sumX = 0, n = 0;
        for (let y = 0; y < c.height; y++) {
          for (let x = x0; x <= x1; x++) {
            if (data[(y * c.width + x) * 4 + 3] <= 16) continue;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            sumX += x;
            n++;
          }
        }
        return { x0, x1, minY, maxY, mx: sumX / n };
      });
      const halfW = Math.ceil(Math.max(...boxes.map((b) => Math.max(b.mx - b.x0, b.x1 - b.mx))) + 1);
      const scale = PLAYER_HEIGHT / Math.max(...boxes.map((b) => b.maxY - b.minY + 1));
      resolve(boxes.map((b) => ({
        img: c,
        sx: Math.round(b.mx) - halfW,
        sy: b.minY,
        sw: halfW * 2,
        sh: b.maxY - b.minY + 1,
        scale,
      })));
    };
    img.onerror = () => reject(new Error(`Failed to load walk sheet: ${url}`));
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
  await Promise.all(Object.entries(WALK_SHEETS).map(async ([dir, sheet]) => {
    walkSheets[dir] = await loadWalkSheet(sheet);
  }));
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

// walkable areas are in feet-box corner space; the feet box may only sit inside their union
const CAFE_WALKABLE = [
  { x0: ROOM.x + 14, y0: FLOOR_Y - 2, x1: ROOM.x + ROOM.w - 14, y1: ROOM.y + ROOM.h - 28 },
  { x0: ROOM.x + ROOM.w - 24, y0: OPENING.y + 8, x1: 1140, y1: OPENING.y + OPENING.h - 2 },
  { x0: 1010, y0: -60, x1: 1140, y1: TURN.y + 30 },
  { x0: 1010, y0: TURN.y + 8, x1: W + 40, y1: TURN.y + TURN.h - 2 },
  { x0: DOOR.x + 10, y0: ROOM.y + ROOM.h - 44, x1: DOOR.x + DOOR.w - 10, y1: H - 8 },
];
const LIBRARY_WALKABLE = [
  { x0: 38, y0: FLOOR_Y - 2, x1: W - 38, y1: LIB_BOTTOM - 4 },
  { x0: LIB_DOOR.x + 8, y0: LIB_BOTTOM - 20, x1: LIB_DOOR.x + LIB_DOOR.w - 8, y1: H - 8 },
];

const scenes = {};
let scene = null;

function makeItem(spec) {
  const size = spec.s ? spriteSize(spec.s) : spec;
  const hits = spec.hits || (NO_HIT.has(spec.s) ? [] : HITS[spec.s] || BOTTOM_BAND);
  return { img: spec.img || images[spec.s], x: spec.x, y: spec.y, w: size.w, h: size.h, ground: spec.ground, hits };
}

function itemColliders(items) {
  return items.flatMap((it) => it.hits.map(([fx, fy, fw, fh]) => (
    { x: it.x + fx * it.w, y: it.y + fy * it.h, w: fw * it.w, h: fh * it.h }
  )));
}

function inWalkable(rects, x, y) {
  return rects.some((r) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
}

function blocked(x, y) {
  const l = x - FEET_HALF_W;
  const r = x + FEET_HALF_W;
  const t = y - FEET_H;
  const area = scene.walkable;
  if (!(inWalkable(area, l, t) && inWalkable(area, r, t) && inWalkable(area, l, y) && inWalkable(area, r, y))) return true;
  return scene.colliders.some((c) => l < c.x + c.w && r > c.x && t < c.y + c.h && y > c.y);
}

// ---- Scene changes ----

const FADE = 0.25;
const transition = { phase: 'none', t: 0, exit: null };

function checkExits() {
  if (transition.phase !== 'none') return;
  const exit = scene.exits.find((e) => e.test(player));
  if (exit) { transition.phase = 'out'; transition.t = 0; transition.exit = exit; }
}

function updateTransition(dt) {
  if (transition.phase === 'none') return;
  transition.t += dt;
  if (transition.t < FADE) return;
  if (transition.phase === 'out') {
    const { to, spawn } = transition.exit;
    scene = scenes[to];
    Object.assign(player, spawn, { moving: false, t: 0 });
    transition.phase = 'in';
    transition.t = 0;
  } else {
    transition.phase = 'none';
  }
}

function drawFade() {
  if (transition.phase === 'none') return;
  const k = Math.min(transition.t / FADE, 1);
  ctx.fillStyle = `rgba(0, 0, 0, ${transition.phase === 'out' ? k : 1 - k})`;
  ctx.fillRect(0, 0, W, H);
}

function updatePlayer(dt) {
  updateTransition(dt);
  if (transition.phase !== 'none') { player.moving = false; return; }

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
  checkExits();
}

function drawPlayer() {
  let frame = frames.standing;
  let flip = false;
  let bob = 0;
  const side = player.facing === 'left' || player.facing === 'right';

  if (side) {
    const cells = walkSheets[player.facing];
    frame = player.moving ? cells[WALK_CYCLE[Math.floor(player.t * WALK_FPS) % WALK_CYCLE.length]] : cells[1];
  } else if (player.moving) {
    frame = frames[player.facing];
    bob = -Math.abs(Math.sin(player.t * 11)) * 3;
    flip = Math.floor(player.t * 5) % 2 === 1;
  } else if (player.facing === 'up') {
    frame = frames.up;
  }

  const scale = frame.scale ?? PLAYER_HEIGHT / frame.sh;
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
  ctx.strokeStyle = 'rgba(0, 200, 80, 0.8)';
  for (const r of scene.walkable) ctx.strokeRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0);
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
  ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
  for (const c of scene.colliders) {
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeRect(c.x, c.y, c.w, c.h);
  }
  ctx.strokeStyle = 'rgba(0, 120, 255, 0.9)';
  ctx.strokeRect(player.x - FEET_HALF_W, player.y - FEET_H, FEET_HALF_W * 2, FEET_H);
}

// ---- Rendering ----

function paintOnto(canvas, draw) {
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  draw();
  ctx = screen;
}

function buildScenes() {
  paintOnto(background, () => {
    buildPatterns();
    drawOutdoors();
    drawFloor();
    drawWalls();
    drawHedge();
    for (const d of WALL_DECOR) drawSprite(d.s, d.x, d.y);
    drawShelf();
    drawBackCounter();
    for (const f of FLAT) drawSprite(f.s, f.x, f.y);
  });
  libWallShelves = LIB_WALL_SHELF_SPECS.map((sp) => {
    const sh = frameSprite(sp.frame, sp.h);
    return { ...sh, x: sp.x, y: LIB_SHELF_BOTTOM - sp.h };
  });
  const libraryBg = document.createElement('canvas');
  libraryBg.width = W;
  libraryBg.height = H;
  paintOnto(libraryBg, drawLibraryBackground);

  const cafeItems = FURNITURE.map(makeItem);
  scenes.cafe = {
    bg: background,
    items: cafeItems,
    walkable: CAFE_WALKABLE,
    colliders: [
      { x: COUNTER.x, y: COUNTER.bottom - COUNTER.hitH, w: COUNTER.w, h: COUNTER.hitH },
      ...itemColliders(cafeItems),
    ],
    exits: [
      { test: (p) => p.y < 40, to: 'library', spawn: { x: 645, y: 628, facing: 'up' } },
      { test: (p) => p.y > 696, to: 'park', spawn: { x: DOOR.x + DOOR.w / 2, y: 40, facing: 'down' } },
      { test: (p) => p.x > W - 12, to: 'shop', spawn: { x: 40, y: TURN.y + 70, facing: 'right' } },
    ],
  };

  const libItems = LIBRARY_ITEMS.map((spec) => makeItem(spec.frame
    ? { ...spec, ...frameSprite(spec.frame, spec.h), hits: spec.hits || [[0.03, 0.55, 0.94, 0.45]] }
    : spec));
  scenes.library = {
    bg: libraryBg,
    items: libItems,
    walkable: LIBRARY_WALKABLE,
    colliders: [
      ...libWallShelves.map((sh) => ({ x: sh.x, y: FLOOR_Y, w: sh.w, h: LIB_SHELF_BOTTOM - FLOOR_Y })),
      ...itemColliders(libItems),
    ],
    exits: [{ test: (p) => p.y > 696, to: 'cafe', spawn: { x: 1075, y: 70, facing: 'down' } }],
  };

  shopWallShelves = SHOP_WALL_SHELF_SPECS.map((sp) => ({ ...frameSprite(sp.frame, sp.h), x: sp.x, y: SHOP_SHELF_BOTTOM - sp.h }));
  const shopBg = document.createElement('canvas');
  shopBg.width = W;
  shopBg.height = H;
  paintOnto(shopBg, drawShopBackground);
  const shopItems = SHOP_ITEMS.map((spec) => makeItem(spec.frame ? { ...spec, ...frameSprite(spec.frame, spec.h) } : spec));
  scenes.shop = {
    bg: shopBg,
    items: shopItems,
    walkable: SHOP_WALKABLE,
    colliders: [
      ...shopWallShelves.map((sh) => ({ x: sh.x, y: FLOOR_Y, w: sh.w, h: SHOP_SHELF_BOTTOM - FLOOR_Y })),
      ...itemColliders(shopItems),
    ],
    exits: [{ test: (p) => p.x < 12, to: 'cafe', spawn: { x: W - 40, y: TURN.y + 70, facing: 'left' } }],
  };

  const parkBg = document.createElement('canvas');
  parkBg.width = W;
  parkBg.height = H;
  paintOnto(parkBg, drawParkBackground);
  const parkItems = PARK_ITEMS.map((spec) => {
    if (spec.frame) {
      const sp = frameSprite(spec.frame, spec.h);
      return makeItem({ ...spec, ...sp, x: spec.cx !== undefined ? spec.cx - sp.w / 2 : spec.x });
    }
    if (!spec.tree) return makeItem(spec);
    const sp = frameSprite('tree', spec.h);
    return makeItem({ ...sp, x: spec.cx - sp.w / 2, y: spec.bottom - sp.h, hits: PARK_TREE_HITS });
  });
  scenes.park = {
    bg: parkBg,
    items: parkItems,
    walkable: PARK_WALKABLE,
    colliders: itemColliders(parkItems),
    exits: [{ test: (p) => p.y < 20, to: 'cafe', spawn: { x: DOOR.x + DOOR.w / 2, y: 670, facing: 'up' } }],
  };

  scene = scenes.cafe;
}

function render() {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(scene.bg, 0, 0);

  const drawables = scene.items.map((it) => ({
    bottom: it.y + it.h,
    draw: () => {
      if (it.ground) drawShadow(it.x, it.y, it.w, it.h);
      ctx.drawImage(it.img, Math.round(it.x), Math.round(it.y), it.w, it.h);
    },
  }));
  drawables.push({ bottom: player.y, draw: drawPlayer });
  drawables.sort((a, b) => a.bottom - b.bottom);
  for (const d of drawables) d.draw();

  if (showHitboxes) drawHitboxes();
  drawFade();
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
  buildScenes();
  requestAnimationFrame((t) => { lastTime = t; requestAnimationFrame(frame); });
}).catch((err) => {
  console.error(err);
  ctx.fillStyle = '#fff';
  ctx.fillText(err.message, 20, 30);
});
