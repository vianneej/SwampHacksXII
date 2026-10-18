const minute = (hour, minutes = 0) => hour * 60 + minutes;
const shop = (x, y) => ({ area: 'shop', x, y });
const cafe = (x, y) => ({ area: 'cafe', x, y });
const library = (x, y) => ({ area: 'library', x, y });

export const NPC_PHASES = {
  FLOWER_SHOP: 'flowerShop',
  LIBRARY: 'library',
  OVERNIGHT: 'overnight',
};

export const NPC_SCHEDULE = [
  { phase: NPC_PHASES.FLOWER_SHOP, startsAt: minute(6), label: 'Work at the flower shop' },
  { phase: NPC_PHASES.LIBRARY, startsAt: minute(20), label: 'Visit the library' },
  { phase: NPC_PHASES.OVERNIGHT, startsAt: minute(24), label: 'Wait on the road beside the flower shop' },
];

const FRANK_SHOP_PATROL = [
  shop(550, 250),
  shop(720, 250),
  shop(720, 350),
  shop(550, 350),
];

export const NPC_DEFINITIONS = [
  {
    id: 'shelby',
    name: 'Shelby',
    displayHeight: 68,
    collisionWidth: 48,
    collisionHeight: 72,
    initialPositions: {
      [NPC_PHASES.FLOWER_SHOP]: shop(470, 345),
      [NPC_PHASES.LIBRARY]: library(450, 300),
      [NPC_PHASES.OVERNIGHT]: shop(1225, 500),
    },
    activities: {
      [NPC_PHASES.FLOWER_SHOP]: { type: 'stand', facing: 'down' },
      [NPC_PHASES.LIBRARY]: { type: 'stand', facing: 'down' },
      [NPC_PHASES.OVERNIGHT]: { type: 'stand', facing: 'down' },
    },
    routes: {
      [NPC_PHASES.FLOWER_SHOP]: [
        shop(640, 480),
        shop(640, 430),
        shop(640, 350),
        shop(470, 345),
      ],
      [NPC_PHASES.LIBRARY]: [
        shop(640, 350),
        shop(640, 430),
        shop(640, 500),
        shop(250, 610),
        shop(20, 610),
        cafe(1270, 610),
        cafe(1050, 550),
        cafe(1050, 20),
        library(700, 620),
        library(600, 300),
        library(450, 300),
      ],
      [NPC_PHASES.OVERNIGHT]: [
        library(645, 700),
        cafe(1075, 70),
        cafe(1075, 550),
        cafe(1200, 550),
        cafe(1270, 550),
        shop(40, 550),
        shop(1225, 500),
      ],
    },
  },
  {
    id: 'frank',
    name: 'Frank',
    displayHeight: 68,
    collisionWidth: 48,
    collisionHeight: 72,
    initialPositions: {
      [NPC_PHASES.FLOWER_SHOP]: FRANK_SHOP_PATROL[0],
      [NPC_PHASES.LIBRARY]: library(850, 300),
      [NPC_PHASES.OVERNIGHT]: shop(1225, 580),
    },
    activities: {
      [NPC_PHASES.FLOWER_SHOP]: { type: 'patrol', waypoints: FRANK_SHOP_PATROL },
      [NPC_PHASES.LIBRARY]: { type: 'stand', facing: 'down' },
      [NPC_PHASES.OVERNIGHT]: { type: 'stand', facing: 'down' },
    },
    startDelays: {
      [NPC_PHASES.FLOWER_SHOP]: 12,
      [NPC_PHASES.LIBRARY]: 8,
      [NPC_PHASES.OVERNIGHT]: 8,
    },
    routes: {
      [NPC_PHASES.FLOWER_SHOP]: [
        shop(780, 610),
        shop(640, 480),
        shop(640, 430),
        shop(640, 350),
        shop(550, 250),
      ],
      [NPC_PHASES.LIBRARY]: [
        shop(720, 250),
        shop(720, 350),
        shop(640, 430),
        shop(640, 500),
        shop(250, 610),
        shop(20, 610),
        cafe(1270, 610),
        cafe(1120, 640),
        cafe(1120, 20),
        library(760, 620),
        library(690, 300),
        library(850, 300),
      ],
      [NPC_PHASES.OVERNIGHT]: [
        library(645, 700),
        cafe(1125, 70),
        cafe(1125, 640),
        cafe(1270, 640),
        shop(40, 640),
        shop(1225, 580),
      ],
    },
  },
];
