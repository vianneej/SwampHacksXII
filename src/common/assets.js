import standingUrl from '../../assets/standing.png';
import moveUpUrl from '../../assets/moveup.png';
import moveDownUrl from '../../assets/movedown.png';
import walkLeftUrl from '../../assets/leftwalking.png';
import doorUrl from '../../assets/door.png';
import treeUrl from '../../assets/tree.png';
import bushUrl from '../../assets/bush.png';
import brickUrl from '../../assets/brick.png';
import brickVerticalUrl from '../../assets/brickvertical.png';
import grassUrl from '../../assets/grass.png';
import countertopUrl from '../../assets/countertop.png';
import wallUpperUrl from '../../assets/walls/wall_upper.png';
import wallWainscotUrl from '../../assets/walls/wall_wainscot.png';
import frameLeftUrl from '../../assets/walls/frame_left.png';
import frameRightUrl from '../../assets/walls/frame_right.png';
import postUrl from '../../assets/walls/post.png';
import windowUrl from '../../assets/window.png';
import bookshelfLowUrl from '../../assets/bookshelf.png';
import bookshelfShortUrl from '../../assets/shortbookshelf.png';
import bookshelfTallUrl from '../../assets/tallbookshelf.png';
import flowerShelfUrl from '../../assets/flowershelf.png';
import cashRegisterUrl from '../../assets/cashregister.png';
import flowerPotsUrl from '../../assets/flowerpots.png';
import longerFlowerUrl from '../../assets/longerflower.png';
import flowerPostUrl from '../../assets/flowerpost.png';
import flowerTentUrl from '../../assets/flowertent.png';
import fountainFrame0Url from '../../assets/fountainframe0.png';
import fountainFrame1Url from '../../assets/fountainframe1.png';
import fountainFrame2Url from '../../assets/fountainframe2.png';
import fountainFrame3Url from '../../assets/fountainframe3.png';
import slideUrl from '../../assets/slide.png';
import wildflowersUrl from '../../assets/wildflowers.png';
import librarySignUrl from '../../assets/librarysign.png';
import coinUrl from '../../assets/coin.png';
import sunUrl from '../../assets/sun.png';
import moonUrl from '../../assets/Moon.png';
import table2Url from '../../assets/table2.png';

const PLAYER_HEIGHT = 72;
const WALK_CELLS = 3;

export const SPRITE_NAMES = [
  'bar', 'espresso', 'grinder', 'pastry_case', 'sink', 'crate', 'cups',
  'jar_a', 'jar_b', 'jar_c', 'pitcher', 'plant_small_counter', 'menu_board',
  'cafe_sign', 'lounge', 'plant_large', 'plant_medium', 'plant_hanging',
  'plant_flower', 'painting', 'round_table_cups', 'table_chairs_side',
  'table_chair_back', 'table_chairs_three', 'table_chairs_cup', 'bench', 'rug',
];

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
  longerFlower: longerFlowerUrl,
  flowerPost: flowerPostUrl,
  flowerTent: flowerTentUrl,
  slide: slideUrl,
  wildflowers: wildflowersUrl,
  librarySign: librarySignUrl,
  coin: coinUrl,
  sun: sunUrl,
  moon: moonUrl,
};

const FOUNTAIN_FRAME_URLS = [fountainFrame0Url, fountainFrame1Url, fountainFrame2Url, fountainFrame3Url];

const WALK_SHEETS = {
  left: { url: walkLeftUrl, mirror: false },
  right: { url: walkLeftUrl, mirror: true },
};

const spriteUrls = import.meta.glob('../../assets/sprites/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

function loadImage(url, label) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${label}`));
    img.src = url;
  });
}

function cropFrame(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) throw new Error('Image frame has no visible pixels');
  return { img, sx: minX, sy: minY, sw: maxX - minX + 1, sh: maxY - minY + 1 };
}

// Fits the trimmed table2 art to the flower table's footprint, bottom-aligned.
function buildPlainTable(frame, ref) {
  const canvas = document.createElement('canvas');
  canvas.width = ref.width;
  canvas.height = ref.height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  const h = Math.round(ref.width * (frame.sh / frame.sw));
  ctx.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, 0, ref.height - h, ref.width, h);
  return canvas;
}

async function loadWalkSheet({ url, mirror }) {
  const img = await loadImage(url, `walk sheet: ${url}`);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const colHasInk = new Array(canvas.width).fill(false);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      if (data[(y * canvas.width + x) * 4 + 3] > 16) colHasInk[x] = true;
    }
  }
  const runs = [];
  let start = -1;
  let lastInk = -1;
  for (let x = 0; x < canvas.width; x++) {
    if (!colHasInk[x]) continue;
    if (start === -1) start = x;
    else if (x - lastInk > 30) {
      runs.push([start, lastInk]);
      start = x;
    }
    lastInk = x;
  }
  if (start !== -1) runs.push([start, lastInk]);
  if (runs.length !== WALK_CELLS) {
    throw new Error(`Expected ${WALK_CELLS} walk frames in ${url}, found ${runs.length}`);
  }

  const boxes = runs.map(([x0, x1]) => {
    let minY = canvas.height;
    let maxY = -1;
    let sumX = 0;
    let pixels = 0;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = x0; x <= x1; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] <= 16) continue;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        sumX += x;
        pixels++;
      }
    }
    return { x0, x1, minY, maxY, mx: sumX / pixels };
  });
  const halfW = Math.ceil(Math.max(...boxes.map((box) => Math.max(box.mx - box.x0, box.x1 - box.mx))) + 1);
  const scale = PLAYER_HEIGHT / Math.max(...boxes.map((box) => box.maxY - box.minY + 1));

  return boxes.map((box) => ({
    img: canvas,
    sx: Math.round(box.mx) - halfW,
    sy: box.minY,
    sw: halfW * 2,
    sh: box.maxY - box.minY + 1,
    scale,
  }));
}

export async function loadAssets() {
  const images = {};
  const frames = {};
  const walkSheets = {};

  await Promise.all(SPRITE_NAMES.map(async (name) => {
    const url = spriteUrls[`../../assets/sprites/${name}.png`];
    if (!url) throw new Error(`Missing sprite asset: ${name}`);
    images[name] = await loadImage(url, `sprite: ${name}`);
  }));

  images.table_plain = buildPlainTable(
    cropFrame(await loadImage(table2Url, 'table2')),
    images.table_chairs_side,
  );

  const [grassImage] = await Promise.all([
    loadImage(grassUrl, 'grass'),
    ...Object.entries(WALK_SHEETS).map(async ([direction, sheet]) => {
      walkSheets[direction] = await loadWalkSheet(sheet);
    }),
    ...Object.entries(PLAYER_URLS).map(async ([name, url]) => {
      frames[name] = cropFrame(await loadImage(url, `player frame: ${url}`));
    }),
  ]);

  const fountainFrames = await Promise.all(FOUNTAIN_FRAME_URLS.map(async (url, i) => (
    cropFrame(await loadImage(url, `fountain frame ${i}`))
  )));
  const minX = Math.min(...fountainFrames.map((f) => f.sx));
  const minY = Math.min(...fountainFrames.map((f) => f.sy));
  const maxX = Math.max(...fountainFrames.map((f) => f.sx + f.sw));
  const maxY = Math.max(...fountainFrames.map((f) => f.sy + f.sh));
  fountainFrames.forEach((f, i) => {
    frames[`fountain${i}`] = { img: f.img, sx: minX, sy: minY, sw: maxX - minX, sh: maxY - minY };
  });

  return { images, frames, walkSheets, grassImage };
}
