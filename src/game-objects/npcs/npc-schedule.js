const minute = (hour, minutes = 0) => hour * 60 + minutes;
const park = (x, y) => ({ area: 'park', x, y });
const shop = (x, y) => ({ area: 'shop', x, y });
const cafe = (x, y) => ({ area: 'cafe', x, y });
const library = (x, y) => ({ area: 'library', x, y });
const standing = (facing = 'down') => ({ type: 'stand', facing });
const cafeWander = () => ({ type: 'wander', pauseMin: 1.5, pauseMax: 4 });

export const NPC_PHASES = {
  FLOWER_SHOP: 'flowerShop',
  LIBRARY: 'library',
  OVERNIGHT: 'overnight',
};

function scheduleEvent(at, route, activity = standing(), options = {}) {
  const destination = route.at(-1) || options.spawn;
  return {
    at,
    route,
    activity,
    spawn: options.spawn,
    exits: options.exits || false,
    requiresArea: options.requiresArea,
    requiresPresence: options.requiresPresence,
    settled: {
      ...destination,
      present: !options.exits,
      activity,
    },
  };
}

const RIGHT_PARK_TO_SHOP = [
  park(465, 20),
  cafe(465, 700),
  cafe(1270, 610),
  shop(20, 610),
  shop(640, 480),
  shop(640, 420),
  shop(650, 350),
];

const SHOP_TO_CAFE = [
  shop(20, 610),
  cafe(1270, 610),
  cafe(1120, 500),
  cafe(1120, 400),
  cafe(900, 400),
  cafe(700, 500),
];

const CAFE_TO_SHOP = [
  cafe(1270, 610),
  shop(20, 610),
  shop(640, 480),
  shop(640, 420),
  shop(800, 350),
];

const SHOP_TO_LIBRARY = [
  shop(20, 610),
  cafe(1270, 610),
  cafe(645, 190),
  library(645, 620),
  library(450, 300),
];

const SHOP_TO_LIBRARY_FOR_STEPHEN = [
  shop(20, 610),
  cafe(1270, 610),
  cafe(645, 190),
  library(645, 620),
  library(700, 300),
];

const LIBRARY_TO_PARK_RIGHT = (exitY) => [
  library(645, 700),
  cafe(645, 200),
  cafe(465, 700),
  park(465, 150),
  park(1228, exitY),
];

const CAFE_TO_PARK_LEFT = (exitY) => [
  cafe(465, 710),
  park(465, 150),
  park(52, exitY),
];

const LIBRARY_TO_CAFE = [
  library(645, 700),
  cafe(1075, 70),
  cafe(1075, 550),
  cafe(960, 400),
  cafe(850, 400),
  cafe(600, 350),
];

const LIBRARY_TO_CAFE_FOR_STEPHEN = [
  library(645, 700),
  cafe(1075, 70),
  cafe(1075, 550),
  cafe(960, 400),
  cafe(850, 400),
  cafe(780, 500),
];

const PARK_TO_CAFE_FROM_RIGHT = [
  park(465, 20),
  cafe(465, 700),
  cafe(620, 500),
];

const PARK_TO_LIBRARY_FROM_LEFT = [
  park(465, 20),
  cafe(465, 700),
  cafe(645, 190),
  library(645, 620),
  library(850, 300),
];

const CAFE_TO_PARK_RIGHT = (exitY) => [
  cafe(465, 710),
  park(465, 150),
  park(1228, exitY),
];

const SHELBY_SHOP_ROUTE = [
  shop(640, 480),
  shop(640, 430),
  shop(640, 350),
  shop(470, 345),
];

const FRANK_SHOP_PATROL = [
  shop(550, 250),
  shop(720, 250),
  shop(720, 350),
  shop(550, 350),
];

const FRANK_SHOP_ROUTE = [
  shop(780, 610),
  shop(640, 480),
  shop(640, 430),
  shop(640, 350),
  shop(550, 250),
];

const SHELBY_TO_LIBRARY = [
  shop(640, 350),
  shop(640, 430),
  shop(640, 500),
  shop(250, 610),
  cafe(1270, 610),
  cafe(645, 190),
  library(645, 620),
  library(450, 300),
];

const FRANK_TO_LIBRARY = [
  shop(720, 250),
  shop(720, 350),
  shop(640, 430),
  shop(640, 500),
  shop(250, 610),
  cafe(1270, 610),
  cafe(645, 190),
  library(645, 620),
  library(850, 300),
];

const SHELBY_RETURN_TO_SHOP = [
  library(610, 700),
  cafe(610, 200),
  cafe(1270, 560),
  shop(20, 560),
  shop(1225, 500),
];

const FRANK_RETURN_TO_SHOP = [
  library(680, 700),
  cafe(680, 200),
  cafe(1270, 640),
  shop(20, 640),
  shop(1225, 580),
];

export const NPC_DEFINITIONS = [
  {
    id: 'shelby',
    name: 'Shelby',
    displayHeight: 68,
    collisionWidth: 48,
    collisionHeight: 72,
    initialPosition: shop(1225, 500),
    schedule: [
      scheduleEvent(minute(6), SHELBY_SHOP_ROUTE, standing('down'), { spawn: shop(1225, 500) }),
      scheduleEvent(minute(20), SHELBY_TO_LIBRARY),
      scheduleEvent(minute(24), SHELBY_RETURN_TO_SHOP, standing('right'), { exits: true }),
    ],
  },
  {
    id: 'frank',
    name: 'Frank',
    displayHeight: 68,
    collisionWidth: 48,
    collisionHeight: 72,
    initialPosition: shop(1225, 580),
    schedule: [
      scheduleEvent(minute(6), FRANK_SHOP_ROUTE, { type: 'patrol', waypoints: FRANK_SHOP_PATROL }, {
        spawn: shop(1225, 580),
      }),
      scheduleEvent(minute(20), FRANK_TO_LIBRARY),
      scheduleEvent(minute(24), FRANK_RETURN_TO_SHOP, standing('right'), { exits: true }),
    ],
  },
  {
    id: 'carl',
    name: 'Carl',
    displayHeight: 68,
    collisionWidth: 48,
    collisionHeight: 72,
    initialPosition: park(1228, 350),
    schedule: [
      scheduleEvent(minute(7), RIGHT_PARK_TO_SHOP, standing(), { spawn: park(1228, 350) }),
      scheduleEvent(minute(9), SHOP_TO_CAFE, cafeWander()),
      scheduleEvent(minute(15), CAFE_TO_PARK_RIGHT(350), standing('right'), { exits: true }),
    ],
  },
  {
    id: 'jennifer',
    name: 'Jennifer',
    displayHeight: 68,
    collisionWidth: 48,
    collisionHeight: 72,
    initialPosition: park(1228, 390),
    schedule: [
      scheduleEvent(minute(5), PARK_TO_CAFE_FROM_RIGHT, cafeWander(), { spawn: park(1228, 390) }),
      scheduleEvent(minute(12), CAFE_TO_SHOP),
      scheduleEvent(minute(14), SHOP_TO_LIBRARY),
      scheduleEvent(minute(18), LIBRARY_TO_PARK_RIGHT(550), standing('right'), { exits: true }),
    ],
  },
  {
    id: 'remo',
    name: 'Remo',
    displayHeight: 68,
    collisionWidth: 48,
    collisionHeight: 72,
    initialPosition: park(52, 350),
    schedule: [
      scheduleEvent(minute(10), PARK_TO_LIBRARY_FROM_LEFT, standing(), { spawn: park(52, 350) }),
      scheduleEvent(minute(16), LIBRARY_TO_CAFE, cafeWander()),
      scheduleEvent(minute(20), CAFE_TO_PARK_LEFT(350), standing('left'), { exits: true }),
    ],
  },
  {
    id: 'stephen',
    name: 'Stephen',
    displayHeight: 68,
    collisionWidth: 48,
    collisionHeight: 72,
    initialPosition: park(52, 390),
    schedule: [
      scheduleEvent(minute(6), CAFE_TO_PARK_LEFT(470), standing('left'), {
        exits: true,
        requiresArea: 'cafe',
        requiresPresence: true,
      }),
      scheduleEvent(minute(12), [park(550, 460)], standing(), { spawn: park(52, 390) }),
      scheduleEvent(minute(15), [
        park(465, 20),
        cafe(465, 700),
        cafe(1270, 610),
        shop(20, 610),
        shop(640, 480),
        shop(650, 350),
      ]),
      scheduleEvent(minute(17), SHOP_TO_LIBRARY_FOR_STEPHEN),
      scheduleEvent(minute(19), LIBRARY_TO_CAFE_FOR_STEPHEN, cafeWander()),
    ],
  },
];
