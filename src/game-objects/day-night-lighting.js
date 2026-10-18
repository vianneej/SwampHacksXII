const DAYLIGHT_START = 6 * 60;
const SUNRISE_START = 5 * 60;
const SUNSET_START = 19 * 60;
const NIGHT_START = 20 * 60;

export const AREA_LIGHTING = {
  cafe: {
    outdoorRegions: [
      { x: 928, y: 0, width: 352, height: 720 },
      { x: 0, y: 640, width: 928, height: 80 },
    ],
    entrances: [
      { x: 928, y: 405, direction: 'right', width: 130, reach: 220, feather: 80 },
      { x: 465, y: 640, direction: 'down', width: 150, reach: 180, feather: 80 },
    ],
  },
  library: {
    outdoorRegions: [{ x: 0, y: 636, width: 1280, height: 84 }],
    entrances: [{ x: 645, y: 636, direction: 'down', width: 150, reach: 180, feather: 80 }],
  },
  shop: {
    outdoorRegions: [
      { x: 0, y: 0, width: 300, height: 720 },
      { x: 980, y: 0, width: 300, height: 720 },
      { x: 300, y: 440, width: 680, height: 280 },
      { x: 300, y: 0, width: 26, height: 390 },
      { x: 954, y: 0, width: 26, height: 390 },
      { x: 300, y: 390, width: 265, height: 50 },
      { x: 715, y: 390, width: 265, height: 50 },
    ],
    entrances: [{ x: 640, y: 440, direction: 'down', width: 150, reach: 180, feather: 80 }],
  },
  park: {
    outdoorRegions: [{ x: 0, y: 0, width: 1280, height: 720 }],
    entrances: [{ x: 465, y: 0, direction: 'down', width: 150, reach: 180, feather: 80 }],
  },
};

export function getNightIntensity(gameMinutes) {
  if (gameMinutes >= SUNRISE_START && gameMinutes < DAYLIGHT_START) {
    return 1 - (gameMinutes - SUNRISE_START) / (DAYLIGHT_START - SUNRISE_START);
  }
  if (gameMinutes >= SUNSET_START && gameMinutes < NIGHT_START) {
    return (gameMinutes - SUNSET_START) / (NIGHT_START - SUNSET_START);
  }
  if (gameMinutes >= DAYLIGHT_START && gameMinutes < SUNSET_START) return 0;
  return 1;
}

// These masks are built once, then faded with the clock in GameScene.
// The dark blue overlay only covers outdoors; clear pixels preserve indoor light.
export const MAX_OUTDOOR_DARKNESS = 0.72;

function smoothstep(value) {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

export function getOutdoorDarkness(config, x, y) {
  const outdoors = config.outdoorRegions.some((region) => (
    x >= region.x && x < region.x + region.width
    && y >= region.y && y < region.y + region.height
  ));
  if (!outdoors) return 0;

  let darkness = 1;
  for (const entrance of config.entrances) {
    const horizontal = entrance.direction === 'right' || entrance.direction === 'left';
    const sign = entrance.direction === 'left' || entrance.direction === 'up' ? -1 : 1;
    const outward = sign * (horizontal ? x - entrance.x : y - entrance.y);
    if (outward < 0) continue;
    const across = Math.abs(horizontal ? y - entrance.y : x - entrance.x);
    const beyondDoor = Math.max(0, across - entrance.width / 2);
    // A doorway is a line segment, not a bright point. The full opening starts
    // at indoor brightness, with smooth, rounded feathering around its edges.
    const normalizedDistance = Math.hypot(
      outward / entrance.reach,
      beyondDoor / entrance.feather,
    );
    darkness = Math.min(darkness, smoothstep(normalizedDistance));
  }
  return darkness;
}

export function createNightOverlay(config, width = 1280, height = 720) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      pixels.data[index] = 8;
      pixels.data[index + 1] = 17;
      pixels.data[index + 2] = 46;
      pixels.data[index + 3] = Math.round(255 * getOutdoorDarkness(config, x, y));
    }
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}
