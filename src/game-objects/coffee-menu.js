const DARK = 0x3a2112;
const CREAM = 0xfff3d1;

export const COFFEE_ITEMS = [
  { id: 'black-coffee', name: 'Black Coffee', cup: 'cup', liquid: 0x24130a },
  { id: 'americano', name: 'Americano', cup: 'cup', liquid: 0x3d2412 },
  { id: 'latte', name: 'Latte', cup: 'cup', liquid: 0xc8a070, art: 'heart' },
  { id: 'cappuccino', name: 'Cappuccino', cup: 'cup', liquid: 0xdcb98e, dust: true },
  { id: 'caramel-latte', name: 'Caramel Latte', cup: 'glass', layers: [0xb5651d, 0xe0a458], cream: true },
  { id: 'espresso', name: 'Espresso', cup: 'small', liquid: 0x1c0e06 },
  { id: 'mocha', name: 'Mocha', cup: 'mug', liquid: 0x5a2f1b, cream: true },
  { id: 'matcha-latte', name: 'Matcha Latte', cup: 'cup', liquid: 0x8fbf6a, art: 'leaf', cupColor: 0xdfeacb },
  { id: 'tea', name: 'Tea', cup: 'cup', liquid: 0xc77a2b, tag: true },
  { id: 'herbal-tea', name: 'Herbal Tea', cup: 'glass', layers: [0xc9455a], leaf: true },
];

function drawGlass(g, item, cx, cy) {
  const w = 24;
  const h = 32;
  const x = cx - w / 2;
  const y = cy - h / 2 - 2;
  g.fillStyle(0xe8f1f2, 0.8).fillRoundedRect(x, y, w, h, { tl: 2, tr: 2, bl: 6, br: 6 });
  const layerH = (h - 8) / item.layers.length;
  item.layers.forEach((color, index) => {
    g.fillStyle(color, 1).fillRect(x + 2, y + h - 3 - layerH * (index + 1), w - 4, layerH);
  });
  if (item.cream) g.fillStyle(CREAM, 1).fillEllipse(cx, y + 5, w - 2, 9);
  if (item.leaf) {
    g.fillStyle(0x4f9a3a, 1).fillTriangle(cx + 2, y + 6, cx + 12, y - 4, cx + 8, y + 8);
  }
  g.lineStyle(2, DARK, 1).strokeRoundedRect(x, y, w, h, { tl: 2, tr: 2, bl: 6, br: 6 });
}

function drawCup(g, item, cx, cy) {
  const scale = item.cup === 'small' ? 0.75 : 1;
  const tall = item.cup === 'mug' ? 26 : 22;
  const w = 30 * scale;
  const h = tall * scale;
  const top = cy - h / 2 - 2;
  const cupColor = item.cupColor || CREAM;

  g.fillStyle(item.cup === 'small' ? 0x6b5a4a : 0xe6dcc4, 1).fillEllipse(cx, top + h + 1, 44 * scale, 11);
  g.lineStyle(2, DARK, 1).strokeEllipse(cx, top + h + 1, 44 * scale, 11);

  g.lineStyle(3, DARK, 1).strokeCircle(cx + w / 2 + 3, top + h / 2, 6 * scale);
  g.fillStyle(cupColor, 1).fillRoundedRect(cx - w / 2, top, w, h, { tl: 0, tr: 0, bl: 10 * scale, br: 10 * scale });
  g.lineStyle(2, DARK, 1).strokeRoundedRect(cx - w / 2, top, w, h, { tl: 0, tr: 0, bl: 10 * scale, br: 10 * scale });

  g.fillStyle(item.liquid, 1).fillEllipse(cx, top, w, 10 * scale + 2);
  g.lineStyle(2, DARK, 1).strokeEllipse(cx, top, w, 10 * scale + 2);

  if (item.art === 'heart') {
    g.fillStyle(CREAM, 1).fillCircle(cx - 3, top - 1, 2.5).fillCircle(cx + 3, top - 1, 2.5)
      .fillTriangle(cx - 5.5, top, cx + 5.5, top, cx, top + 5);
  } else if (item.art === 'leaf') {
    g.fillStyle(0xdfeacb, 1).fillEllipse(cx, top, 10, 4);
  }
  if (item.dust) g.fillStyle(0x7a4a24, 1).fillEllipse(cx, top, 12, 4);
  if (item.cream) {
    g.fillStyle(CREAM, 1).fillCircle(cx - 5, top - 3, 5).fillCircle(cx + 5, top - 3, 5).fillCircle(cx, top - 7, 5);
    g.lineStyle(1, DARK, 1).strokeCircle(cx, top - 7, 5);
  }
  if (item.tag) {
    g.lineStyle(1, DARK, 1).beginPath().moveTo(cx - 4, top).lineTo(cx - 12, top - 6).strokePath();
    g.fillStyle(0xf6e7b0, 1).fillRect(cx - 17, top - 12, 8, 7);
    g.lineStyle(1, DARK, 1).strokeRect(cx - 17, top - 12, 8, 7);
  }
}

// cx, cy: center of the icon.
export function drawCoffeeCup(g, item, cx, cy) {
  if (item.cup === 'glass') drawGlass(g, item, cx, cy);
  else drawCup(g, item, cx, cy);
}
