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
      { x: 930, y: 405, radius: 160 },
      { x: 465, y: 648, radius: 125 },
    ],
  },
  library: {
    outdoorRegions: [{ x: 0, y: 636, width: 1280, height: 84 }],
    entrances: [{ x: 645, y: 645, radius: 145 }],
  },
  shop: {
    outdoorRegions: [
      { x: 0, y: 0, width: 300, height: 720 },
      { x: 980, y: 0, width: 300, height: 720 },
      { x: 300, y: 440, width: 680, height: 280 },
    ],
    entrances: [{ x: 640, y: 445, radius: 150 }],
  },
  park: {
    outdoorRegions: [{ x: 0, y: 0, width: 1280, height: 720 }],
    entrances: [],
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
