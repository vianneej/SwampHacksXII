const BOTTOM_BAND = [[0.05, 0.6, 0.9, 0.4]];
const ITEM_HITS = {
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

function createItem(spec, { images, spriteSize }) {
  const size = spec.s ? spriteSize(spec.s) : spec;
  const hits = spec.hits || (NO_HIT.has(spec.s) ? [] : ITEM_HITS[spec.s] || BOTTOM_BAND);

  return {
    img: spec.img || images[spec.s],
    x: spec.x,
    y: spec.y,
    w: size.w,
    h: size.h,
    ground: spec.ground,
    hits,
  };
}

function itemColliders(items) {
  return items.flatMap((item) => item.hits.map(([fx, fy, fw, fh]) => ({
    x: item.x + fx * item.w,
    y: item.y + fy * item.h,
    w: fw * item.w,
    h: fh * item.h,
  })));
}

function inWalkable(rects, x, y) {
  return rects.some((rect) => x >= rect.x0 && x <= rect.x1 && y >= rect.y0 && y <= rect.y1);
}

export function isBlocked(area, x, y, feetHalfW, feetH) {
  const left = x - feetHalfW;
  const right = x + feetHalfW;
  const top = y - feetH;
  const feet = [
    [left, top],
    [right, top],
    [left, y],
    [right, y],
  ];

  if (!feet.every(([footX, footY]) => inWalkable(area.walkable, footX, footY))) return true;
  return area.colliders.some((collider) => (
    left < collider.x + collider.w
    && right > collider.x
    && top < collider.y + collider.h
    && y > collider.y
  ));
}

export function createBuildingGenerator(config) {
  const { width, assets, layout, backgrounds, spriteSize, frameSprite } = config;
  const createItemOptions = { images: assets.images, spriteSize };
  const makeItem = (spec) => createItem(spec, createItemOptions);
  const scenes = {};
  const cafeItems = layout.cafe.items.map(makeItem);
  const libraryItems = layout.library.items.map((spec) => makeItem(spec.frame
    ? { ...spec, ...frameSprite(spec.frame, spec.h), hits: spec.hits || [[0.03, 0.55, 0.94, 0.45]] }
    : spec));
  const shopItems = layout.shop.items.map((spec) => makeItem(spec.frame
    ? { ...spec, ...frameSprite(spec.frame, spec.h) }
    : spec));
  const parkItems = layout.park.items.map((spec) => {
    if (spec.frame) {
      const sprite = frameSprite(spec.frame, spec.h);
      return makeItem({ ...spec, ...sprite, x: spec.cx !== undefined ? spec.cx - sprite.w / 2 : spec.x });
    }
    if (!spec.tree) return makeItem(spec);
    const sprite = frameSprite('tree', spec.h);
    return makeItem({
      ...sprite,
      x: spec.cx - sprite.w / 2,
      y: spec.bottom - sprite.h,
      hits: layout.park.treeHits,
    });
  });

  scenes.cafe = {
    bg: backgrounds.cafe,
    items: cafeItems,
    walkable: layout.cafe.walkable,
    colliders: [
      layout.cafe.counterCollider,
      ...itemColliders(cafeItems),
    ],
    exits: [
      { test: (player) => player.y < 40, to: 'library', spawn: { x: 645, y: 628, facing: 'up' } },
      { test: (player) => player.y > 696, to: 'park', spawn: { ...layout.exits.parkFromCafe, facing: 'down' } },
      { test: (player) => player.x > width - 12, to: 'shop', spawn: { x: 40, y: layout.exits.shopY, facing: 'right' } },
    ],
  };

  scenes.library = {
    bg: backgrounds.library,
    items: libraryItems,
    walkable: layout.library.walkable,
    colliders: [
      ...layout.library.shelves.map((shelf) => ({
        x: shelf.x,
        y: layout.shelfColliderTop,
        w: shelf.w,
        h: layout.library.shelfColliderHeight,
      })),
      ...itemColliders(libraryItems),
    ],
    exits: [{ test: (player) => player.y > 696, to: 'cafe', spawn: { x: 1075, y: 70, facing: 'down' } }],
  };

  scenes.shop = {
    bg: backgrounds.shop,
    items: shopItems,
    walkable: layout.shop.walkable,
    colliders: [
      ...layout.shop.shelves.map((shelf) => ({
        x: shelf.x,
        y: layout.shelfColliderTop,
        w: shelf.w,
        h: layout.shop.shelfColliderHeight,
      })),
      ...itemColliders(shopItems),
    ],
    exits: [{ test: (player) => player.x < 12, to: 'cafe', spawn: { x: width - 40, y: layout.exits.shopY, facing: 'left' } }],
  };

  scenes.park = {
    bg: backgrounds.park,
    items: parkItems,
    walkable: layout.park.walkable,
    colliders: itemColliders(parkItems),
    exits: [{ test: (player) => player.y < 20, to: 'cafe', spawn: { ...layout.exits.parkFromCafe, y: 670, facing: 'up' } }],
  };

  return scenes;
}
