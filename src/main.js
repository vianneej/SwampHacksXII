const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

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

const COUNTER = { x: 480, w: 392, topY: 150 };

const ON_COUNTER = [
  { s: 'espresso', x: 496 },
  { s: 'grinder', x: 596 },
  { s: 'pastry_case', x: 640 },
  { s: 'sink', x: 756 },
  { s: 'crate', x: 822 },
];

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

function drawGrass() {
  rect(0, 0, W, H, '#4c8a37');
  for (let y = 0; y < H; y += PX) {
    for (let x = 0; x < W; x += PX) {
      const r = hash(x, y);
      if (r > 0.93) rect(x, y, PX, PX, '#3f7a2e');
      else if (r < 0.04) rect(x, y, PX, PX, '#5f9f45');
    }
  }
}

function drawPath() {
  const pathX = 1010;
  const pathW = 130;
  const dirt = (x, y, w, h) => {
    for (let yy = y; yy < y + h; yy += PX) {
      for (let xx = x; xx < x + w; xx += PX) {
        const r = hash(xx + 7, yy + 3);
        rect(xx, yy, PX, PX, r > 0.9 ? '#c4902f' : r < 0.08 ? '#e6b852' : '#d8a53c');
      }
    }
  };
  dirt(pathX, 0, pathW, H);
  dirt(ROOM.x + ROOM.w, OPENING.y + 10, pathX - ROOM.x - ROOM.w + 8, OPENING.h - 20);

  for (let i = 0; i < 26; i++) {
    const sx = pathX + 20 + Math.floor(hash(i, 1) * (pathW - 60));
    const sy = 20 + Math.floor(hash(i, 2) * (H - 40));
    const sw = 12 + Math.floor(hash(i, 3) * 3) * PX;
    rect(sx, sy, sw, PX * 2, '#a9a49a');
    rect(sx, sy, sw, PX, '#c9c5ba');
  }
}

function drawBush(cx, cy, r) {
  for (let y = -r; y <= r; y += PX) {
    for (let x = -r; x <= r; x += PX) {
      const d = Math.hypot(x, y * 1.15);
      if (d > r) continue;
      const light = d < r * 0.5 && y < 0;
      const n = hash(cx + x, cy + y);
      rect(cx + x, cy + y, PX, PX, light ? '#4fa64a' : n > 0.8 ? '#2f6a2c' : '#357a33');
    }
  }
}

function drawTree(cx, cy) {
  rect(cx - 14, cy + 40, 28, 90, '#5a3a1c');
  rect(cx - 14, cy + 40, 8, 90, '#7a5028');
  for (let i = 0; i < 4; i++) drawBush(cx + (i - 1.5) * 38, cy + (i % 2) * 24, 52);
  drawBush(cx, cy - 20, 60);
}

function drawOutdoors() {
  drawGrass();
  drawPath();

  for (let x = 40; x < 380; x += 70) drawBush(x, 692, 34);
  for (let x = 570; x < 900; x += 70) drawBush(x, 692, 34);
  drawBush(960, 600, 40);
  drawBush(1170, 640, 46);
  drawBush(1240, 520, 40);
  drawTree(1210, 80);
  drawTree(1180, 290);

  // stone steps below the door
  for (let row = 0; row < 3; row++) {
    const y = ROOM.y + ROOM.h + row * 20;
    for (let x = DOOR.x; x < DOOR.x + DOOR.w; x += 30) {
      const off = row % 2 ? 15 : 0;
      rect(x - off, y, 28, 18, hash(x, y) > 0.5 ? '#b89868' : '#c9ab7a');
    }
  }
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

function drawWalls() {
  const { x, y, w, h } = ROOM;
  const frame = '#4a2a14';
  const frameLight = '#6b4122';

  // back wall
  rect(x, y, w, FLOOR_Y - y, '#ecd9ad');
  for (let sx = x; sx < x + w; sx += 24) rect(sx, y, 2, 100, '#e2cb9a');
  rect(x, 118, w, FLOOR_Y - 118, '#8a5a2e');
  rect(x, 118, w, 6, '#5a3318');
  rect(x, 124, w, 3, '#b07a42');
  for (let sx = x; sx < x + w; sx += 40) rect(sx, 127, 2, FLOOR_Y - 127, '#6b4122');

  // outer frame
  rect(0, 0, W, 0, frame);
  rect(x - 24, y - 24, w + 48, 24, frame);
  rect(x - 24, y - 24, 24, h + 48, frame);
  rect(x + w, y - 24, 24, OPENING.y - y + 24, frame);
  rect(x + w, OPENING.y + OPENING.h, 24, y + h - OPENING.y - OPENING.h + 24, frame);
  rect(x - 24, y + h - 24, DOOR.x - x + 24, 48, frame);
  rect(DOOR.x + DOOR.w, y + h - 24, x + w - DOOR.x - DOOR.w + 24, 48, frame);
  rect(x - 24, y - 24, w + 48, 4, frameLight);
  rect(x, y, 4, h - 24, '#5a3318');
  rect(x + w - 8, y, 8, OPENING.y - y, '#5a3318');
  rect(x + w - 8, OPENING.y + OPENING.h, 8, y + h - OPENING.y - OPENING.h - 24, '#5a3318');

  // bottom wall face (wood wainscot)
  rect(x, y + h - 24, DOOR.x - x, 24, '#7d4a24');
  rect(DOOR.x + DOOR.w, y + h - 24, x + w - DOOR.x - DOOR.w, 24, '#7d4a24');
  rect(x, y + h - 24, DOOR.x - x, 4, '#a86f38');
  rect(DOOR.x + DOOR.w, y + h - 24, x + w - DOOR.x - DOOR.w, 4, '#a86f38');
  for (let sx = x; sx < x + w; sx += 40) {
    if (sx >= DOOR.x - 20 && sx < DOOR.x + DOOR.w) continue;
    rect(sx, y + h - 20, 2, 20, '#5a3318');
  }

  // door frame posts
  rect(DOOR.x - 8, y + h - 28, 8, 36, '#5a3318');
  rect(DOOR.x + DOOR.w, y + h - 28, 8, 36, '#5a3318');

  // back door
  rect(60, 52, 64, 98, '#5a3318');
  rect(66, 58, 52, 92, '#7d4a24');
  rect(72, 66, 40, 30, '#8f5a2e');
  rect(72, 102, 40, 40, '#8f5a2e');
  rect(106, 112, 6, 6, '#e6b852');

  // windows
  for (const wx of [150, 560]) {
    rect(wx, 54, 52, 52, '#5a3318');
    rect(wx + 5, 59, 42, 42, '#9fd0e8');
    rect(wx + 5, 59, 42, 12, '#c4e4f2');
    rect(wx + 24, 59, 4, 42, '#5a3318');
    rect(wx + 5, 78, 42, 4, '#5a3318');
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
  const { x, w, topY } = COUNTER;
  rect(x, topY + 20, w, 56, '#7d4a24');
  rect(x, topY + 20, w, 6, '#5a3318');
  for (let cx = x + 8; cx < x + w - 40; cx += 72) {
    rect(cx, topY + 34, 60, 34, '#8f5a2e');
    rect(cx, topY + 34, 60, 3, '#a86f38');
    rect(cx + 26, topY + 48, 8, 4, '#e6b852');
  }
  rect(x - 4, topY + 14, w + 8, 12, '#b07a42');
  rect(x - 4, topY + 14, w + 8, 3, '#cf9560');

  for (const item of ON_COUNTER) {
    const { h } = spriteSize(item.s);
    drawSprite(item.s, item.x, topY + 22 - h);
  }
}

function drawLayer(list) {
  const items = list
    .map((item) => ({ ...item, ...spriteSize(item.s) }))
    .sort((a, b) => a.y + a.h - (b.y + b.h));
  for (const it of items) {
    if (it.ground) drawShadow(it.x, it.y, it.w, it.h);
    drawSprite(it.s, it.x, it.y);
  }
}

function render() {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  drawOutdoors();
  drawFloor();
  drawWalls();
  for (const d of WALL_DECOR) drawSprite(d.s, d.x, d.y);
  drawShelf();
  drawBackCounter();
  for (const f of FLAT) drawSprite(f.s, f.x, f.y);
  drawLayer(FURNITURE);
}

loadImages().then(render).catch((err) => {
  console.error(err);
  ctx.fillStyle = '#fff';
  ctx.fillText(err.message, 20, 30);
});
