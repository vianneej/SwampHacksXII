import Phaser from 'phaser';
import { COUNTER, getPlayerVisual, getWorldState, initializeWorld, resetProgress, setDirectionDown, toggleHitboxes, updateWorld, addTaskProgress } from './game-world.js';
import { createNpcManager, updateNpcManager } from '../game-objects/npcs/npc-manager.js';
import { getNpcDialogue, hasCoffeeOrder } from '../game-objects/npcs/npc-dialogue.js';
import { SCENE_KEYS } from './scene-keys.js';
import { COFFEE_ITEMS, drawCoffeeCup } from '../game-objects/coffee-menu.js';
import { startBackgroundMusic, isMusicMuted, toggleMusicMuted } from '../common/music.js';
import { TASKS } from '../common/tasks.js';
import { AREA_LIGHTING, getNightIntensity, createNightOverlay, MAX_OUTDOOR_DARKNESS} from '../game-objects/day-night-lighting.js';

const DEPTH_UI = 10000;
const DEPTH_DAY_NIGHT = DEPTH_UI - 2;
const ENTRANCE_GLOW_ALPHA = 0.46;
const DIALOG_CHOICES = [
  { id: 'chat', label: 'Chat', icon: 'heart' },
  { id: 'busy', label: 'What are you up to?', icon: 'clock' },
  { id: 'order', label: 'Coffee order?', icon: 'cup' },
  { id: 'about', label: 'About {name}', icon: 'bubble' },
  { id: 'leave', label: 'Leave', icon: 'door' },
];
const HUD_TEXT = { color: '#3a2112', fontFamily: '"Courier New", monospace', fontStyle: 'bold' };
const TASK_BUTTON = { x: 14, y: 12, w: 150, h: 46 };
const TASK_PANEL = { x: 14, y: 66, w: 380, rowH: 46, rowGap: 8, header: 52, pad: 14, maxVisible: 5, scrollbarW: 8 };
const FOUNTAIN_FRAME_MS = 180;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.GAME });
    this.textureIds = 0;
  }

  create(data) {
    if (!data.assets) throw new Error('Game assets were not provided by the preload scene.');
    startBackgroundMusic();
    initializeWorld(data.assets);
    this.world = getWorldState();
    this.imageTextures = new WeakMap();
    this.frameTextures = new WeakMap();
    this.areaLayers = new Map();
    this.coinLayers = new Map();
    this.dayNightLayers = new Map();
    this.createAreas();
    this.createCoffeeMachine();
    this.createNpcs(data.assets.npcFrames);
    this.createPlayer();
    this.createDayNightLayers();
    this.createHud();
    this.createTaskPanel();
    this.createRestartButton();
    this.createVolumeButton();
    this.createInput();
    this.createTransitionOverlay();
    this.setActiveArea(this.world.scene);
    this.updateDayNight();
  }

  createAreas() {
    for (const [name, area] of Object.entries(this.world.areas)) {
      const background = this.add.image(0, 0, this.addCanvasTexture(area.bg)).setOrigin(0);
      const itemLayers = area.items.map((item) => {
        const shadow = item.ground
          ? this.add.ellipse(item.x + item.w / 2, item.y + item.h - 3, item.w * 0.84, 14, 0x1e0e04, 0.28)
            .setDepth(item.y + item.h - 0.01)
          : null;
        const image = this.add.image(item.x, item.y, this.getImageTexture(item.img))
          .setOrigin(0)
          .setDisplaySize(item.w, item.h)
          .setDepth(item.y + item.h);
        return { shadow, image, anim: item.anim && item.anim.map((source) => this.getImageTexture(source)) };
      });

      const coins = this.createCoins(area);
      this.areaLayers.set(name, { background, items: itemLayers });
      this.coinLayers.set(name, coins);
    }
  }

  createDayNightLayers() {
  for (const [name, config] of Object.entries(AREA_LIGHTING)) {
    const area = this.world.areas[name];
    if (!area) continue;

    const canvas = createNightOverlay(
      config,
      area.bg.width,
      area.bg.height
    );

    const overlay = this.add
      .image(0, 0, this.addCanvasTexture(canvas))
      .setOrigin(0)
      .setDepth(DEPTH_DAY_NIGHT)
      .setAlpha(0);

    this.dayNightLayers.set(name, {
      darkness: [overlay],
      glow: [],
    });
  }
 }

  createEntranceGlow(config) {
    const canvas = document.createElement('canvas');
    canvas.width = this.scale.width;
    canvas.height = this.scale.height;
    const context = canvas.getContext('2d');
    context.beginPath();
    for (const region of config.outdoorRegions) {
      context.rect(region.x, region.y, region.width, region.height);
    }
    context.clip();
    for (const entrance of config.entrances) {
      const gradient = context.createRadialGradient(
        entrance.x,
        entrance.y,
        0,
        entrance.x,
        entrance.y,
        entrance.radius,
      );
      gradient.addColorStop(0, `rgba(255, 205, 145, ${ENTRANCE_GLOW_ALPHA})`);
      gradient.addColorStop(0.55, 'rgba(255, 205, 145, 0.18)');
      gradient.addColorStop(1, 'rgba(255, 205, 145, 0)');
      context.fillStyle = gradient;
      context.fillRect(
        entrance.x - entrance.radius,
        entrance.y - entrance.radius,
        entrance.radius * 2,
        entrance.radius * 2,
      );
    }
    return canvas;
  }

  createCoins(area) {
    return area.coins.map((coin) => ({
      data: coin,
      shadow: this.add.ellipse(coin.x, coin.y, 18, 6, 0x000000, 0.22),
      image: this.add.image(coin.x, coin.y, this.getFrameTexture(this.world.frames.coin))
        .setDisplaySize(24, 24),
    }));
  }

  createPlayer() {
    const visual = getPlayerVisual();
    this.playerShadow = this.add.ellipse(visual.x, visual.y - 2, 34, 12, 0x1e0e04, 0.3);
    this.playerImage = this.add.image(visual.x, visual.y, this.getFrameTexture(visual.frame))
      .setOrigin(0.5, 1)
      .setDisplaySize(visual.width, visual.height);
    this.playerShadow.setDepth(visual.y - 1);
    this.playerImage.setDepth(visual.y);
    this.debugGraphics = this.add.graphics().setDepth(DEPTH_UI - 1);
  }

  createNpcs(spriteFrames) {
    this.npcManager = createNpcManager(spriteFrames, this.world.game.minutes, this.world.areas, this.world.game.day);
    this.npcSprites = new Map();
    for (const npc of this.npcManager.npcs) {
      const frame = npc.frames.down[1];
      const width = Math.min(npc.collisionWidth, npc.displayHeight * (frame.width / frame.height));
      const visible = npc.present && npc.area === this.world.sceneName;
      const sprite = this.add.image(npc.x, npc.y, this.getNpcTexture(frame))
        .setOrigin(0.5, 1)
        .setDisplaySize(width, npc.displayHeight)
        .setDepth(npc.y)
        .setVisible(visible)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.openDialog(npc));
      if (!visible) sprite.disableInteractive();
      this.npcSprites.set(npc.id, sprite);
    }
  }

  openDialog(npc) {
    if (this.dialog) return;
    this.dialog = { npc, container: null };
    npc.paused = true;
    npc.moving = false;
    const { player } = this.world;
    const dx = player.x - npc.x;
    const dy = player.y - npc.y;
    npc.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : (dy < 0 ? 'up' : 'down');
    this.showDialogMenu();
  }

  closeDialog() {
    if (!this.dialog) return;
    this.dialog.container.destroy(true);
    this.dialog.npc.paused = false;
    this.dialog = null;
  }

  resetDialogContainer() {
    if (this.dialog.container) this.dialog.container.destroy(true);
    this.dialog.container = this.add.container(0, 0).setDepth(DEPTH_UI + 2);
    return this.dialog.container;
  }

  showDialogMenu() {
    const { npc } = this.dialog;
    const container = this.resetDialogContainer();
    const w = 270;
    const rowH = 34;
    const gap = 6;
    const pad = 12;
    const choices = DIALOG_CHOICES.filter((choice) => choice.id !== 'order' || hasCoffeeOrder(npc));
    const h = pad * 2 + choices.length * rowH + (choices.length - 1) * gap;
    const x = Phaser.Math.Clamp(npc.x + 24, 8, this.scale.width - w - 8);
    const y = Phaser.Math.Clamp(npc.y - 30, 44, this.scale.height - h - 8);

    const background = this.add.graphics();
    this.drawHudPanel(background, x + 8, y - 34, 120, 40);
    this.drawHudPanel(background, x, y, w, h);
    container.add(background);
    container.add(this.add.text(x + 68, y - 18, npc.name, { ...HUD_TEXT, fontSize: '17px' }).setOrigin(0.5));

    choices.forEach((choice, index) => {
      const rowX = x + pad;
      const rowY = y + pad + index * (rowH + gap);
      const rowW = w - pad * 2;
      const row = this.add.graphics();
      const arrow = this.add.graphics().setVisible(false);
      arrow.fillStyle(0x3a2112, 1).fillTriangle(rowX - 6, rowY + 10, rowX - 6, rowY + 24, rowX + 4, rowY + 17);
      const drawRow = (hover) => {
        row.clear();
        row.fillStyle(hover ? 0xf6c64f : 0xfff3d1, 1).fillRoundedRect(rowX, rowY, rowW, rowH, 6);
        row.lineStyle(2, hover ? 0xa8672c : 0xd9b36b, 1).strokeRoundedRect(rowX, rowY, rowW, rowH, 6);
        arrow.setVisible(hover);
      };
      drawRow(false);
      const icon = this.add.graphics();
      this.drawDialogIcon(icon, choice.icon, rowX + 20, rowY + rowH / 2);
      const label = this.add.text(rowX + 40, rowY + rowH / 2, choice.label.replace('{name}', npc.name), { ...HUD_TEXT, fontSize: '15px' })
        .setOrigin(0, 0.5);
      const hit = this.add.rectangle(rowX, rowY, rowW, rowH, 0xffffff, 0.001)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => drawRow(true))
        .on('pointerout', () => drawRow(false))
        .on('pointerdown', () => this.chooseDialog(choice.id));
      container.add([row, arrow, icon, label, hit]);
    });
  }

  drawDialogIcon(g, kind, cx, cy) {
    const dark = 0x3a2112;
    if (kind === 'heart') {
      g.fillStyle(0xd9475a, 1).fillCircle(cx - 4, cy - 3, 5).fillCircle(cx + 4, cy - 3, 5)
        .fillTriangle(cx - 9, cy - 1, cx + 9, cy - 1, cx, cy + 9);
    } else if (kind === 'clock') {
      g.fillStyle(0xfff3d1, 1).fillCircle(cx, cy, 9).lineStyle(2, dark, 1).strokeCircle(cx, cy, 9);
      g.lineStyle(2, dark, 1).beginPath().moveTo(cx, cy - 6).lineTo(cx, cy).lineTo(cx + 5, cy + 2).strokePath();
    } else if (kind === 'bubble') {
      g.fillStyle(0xfff3d1, 1).fillRoundedRect(cx - 10, cy - 8, 20, 14, 4)
        .fillTriangle(cx - 6, cy + 5, cx - 2, cy + 5, cx - 6, cy + 10)
        .lineStyle(2, dark, 1).strokeRoundedRect(cx - 10, cy - 8, 20, 14, 4);
      g.fillStyle(dark, 1).fillCircle(cx - 5, cy - 1, 1.5).fillCircle(cx, cy - 1, 1.5).fillCircle(cx + 5, cy - 1, 1.5);
    } else if (kind === 'cup') {
      g.fillStyle(0xfff3d1, 1).fillRoundedRect(cx - 8, cy - 6, 14, 14, 3)
        .lineStyle(2, dark, 1).strokeRoundedRect(cx - 8, cy - 6, 14, 14, 3)
        .strokeCircle(cx + 7, cy + 1, 4);
      g.fillStyle(0x7a4a24, 1).fillRect(cx - 6, cy - 4, 10, 4);
    } else {
      g.fillStyle(0x9b3a2a, 1).fillRoundedRect(cx - 7, cy - 10, 14, 20, 2)
        .lineStyle(2, dark, 1).strokeRoundedRect(cx - 7, cy - 10, 14, 20, 2);
      g.fillStyle(0xf6c64f, 1).fillCircle(cx + 3, cy, 1.5);
    }
  }

  chooseDialog(choiceId) {
    if (choiceId === 'leave') {
      this.closeDialog();
      return;
    }
    const { npc } = this.dialog;
    if (choiceId === 'order' || choiceId === 'chat') addTaskProgress(`${choiceId}-${npc.id}`);
    this.showDialogLine(getNpcDialogue(npc, choiceId, this.npcManager.phase));
  }

  showDialogLine(text) {
    const { npc } = this.dialog;
    const container = this.resetDialogContainer();
    const { width, height } = this.scale;
    const w = Math.min(width - 80, 760);
    const h = 120;
    const x = (width - w) / 2;
    const y = height - h - 24;

    container.add(this.add.rectangle(0, 0, width, height, 0x000000, 0.001)
      .setOrigin(0)
      .setInteractive()
      .on('pointerdown', () => this.showDialogMenu()));
    const background = this.add.graphics();
    this.drawHudPanel(background, x + 12, y - 34, 120, 40);
    this.drawHudPanel(background, x, y, w, h);
    container.add(background);
    container.add(this.add.text(x + 72, y - 18, npc.name, { ...HUD_TEXT, fontSize: '17px' }).setOrigin(0.5));
    container.add(this.add.text(x + 24, y + 22, text, { ...HUD_TEXT, fontSize: '17px', wordWrap: { width: w - 48 } }));
    container.add(this.add.text(x + w - 20, y + h - 18, 'Click to continue', { ...HUD_TEXT, fontSize: '12px', color: '#8a5a2b' })
      .setOrigin(1, 1));
  }

  createHud() {
    const width = this.scale.width;
    this.hudPanel = this.add.graphics().setDepth(DEPTH_UI);
    this.hudPanel.fillStyle(0x3a2112, 1).fillRoundedRect(width - 282, 12, 268, 50, 8);
    this.hudPanel.fillStyle(0xa8672c, 1).fillRoundedRect(width - 280, 14, 264, 46, 6);
    this.hudPanel.fillStyle(0xf3dba2, 1).fillRoundedRect(width - 277, 17, 258, 40, 4);
    this.hudPanel.fillStyle(0x3a2112, 1).fillRoundedRect(width - 190, 68, 176, 48, 8);
    this.hudPanel.fillStyle(0xa8672c, 1).fillRoundedRect(width - 188, 70, 172, 44, 6);
    this.hudPanel.fillStyle(0xf3dba2, 1).fillRoundedRect(width - 185, 73, 166, 38, 4);

    const style = { color: '#3a2112', fontFamily: '"Courier New", monospace', fontSize: '19px', fontStyle: 'bold' };
    this.dayText = this.add.text(width - 264, 26, '', style).setDepth(DEPTH_UI);
    this.timeText = this.add.text(width - 30, 26, '', style).setOrigin(1, 0).setDepth(DEPTH_UI);
    this.coinCountText = this.add.text(width - 32, 81, '', style).setOrigin(1, 0).setDepth(DEPTH_UI);
    this.hudSunIcon = this.add.image(width - 162, 37, this.getFrameTexture(this.world.frames.sun))
      .setDisplaySize(40, 40)
      .setDepth(DEPTH_UI);
    this.hudMoonIcon = this.add.image(width - 162, 37, this.getFrameTexture(this.world.frames.moon))
      .setDisplaySize(40, 40)
      .setDepth(DEPTH_UI);
    this.hudCoinIcon = this.add.image(width - 158, 92, this.getFrameTexture(this.world.frames.coin))
      .setDisplaySize(34, 34)
      .setDepth(DEPTH_UI);
    this.popTexts = [];
  }

  createRestartButton() {
    const width = this.scale.width;
    const x = width - 190 - 8 - 48;
    const y = 68;
    const graphics = this.add.graphics().setDepth(DEPTH_UI);
    this.drawHudPanel(graphics, x, y, 48, 48);

    // circular restart arrow
    const cx = x + 24;
    const cy = y + 24;
    graphics.lineStyle(4, 0x3a2112, 1).beginPath()
      .arc(cx, cy, 11, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(250), false)
      .strokePath();
    const tip = Phaser.Math.DegToRad(-60);
    const tx = cx + Math.cos(tip) * 11;
    const ty = cy + Math.sin(tip) * 11;
    graphics.fillStyle(0x3a2112, 1).fillTriangle(tx - 2, ty - 8, tx + 10, ty + 1, tx - 8, ty + 4);

    this.add.zone(x, y, 48, 48)
      .setOrigin(0)
      .setDepth(DEPTH_UI)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => resetProgress());
  }

  createCoffeeMachine() {
    // Machine bounds in the original countertop.png (2173x724), mapped onto the drawn counter.
    const f = this.world.frames.counter;
    const counterH = Math.round(COUNTER.w * (f.sh / f.sw));
    const toWorldX = (px) => COUNTER.x + ((px - f.sx) / f.sw) * COUNTER.w;
    const toWorldY = (py) => COUNTER.bottom - counterH + ((py - f.sy) / f.sh) * counterH;
    const x = toWorldX(603);
    const y = toWorldY(43);
    this.coffeeZone = this.add.zone(x, y, toWorldX(913) - x, toWorldY(413) - y)
      .setOrigin(0)
      .setDepth(1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openCoffeeMenu());
  }

  openCoffeeMenu() {
    if (this.coffeeMenu || this.dialog) return;
    const { width, height } = this.scale;
    const cardW = 104;
    const cardH = 112;
    const gap = 10;
    const cols = 5;
    const pad = 18;
    const header = 54;
    const w = pad * 2 + cols * cardW + (cols - 1) * gap;
    const h = header + 2 * cardH + gap + pad;
    const x = (width - w) / 2;
    const y = (height - h) / 2;
    const container = this.add.container(0, 0).setDepth(DEPTH_UI + 2);
    this.coffeeMenu = container;

    container.add(this.add.rectangle(0, 0, width, height, 0x000000, 0.35)
      .setOrigin(0)
      .setInteractive()
      .on('pointerdown', () => this.closeCoffeeMenu()));
    const background = this.add.graphics();
    this.drawHudPanel(background, x, y, w, h);
    container.add(background);
    container.add(this.add.zone(x, y, w, h).setOrigin(0).setInteractive());
    container.add(this.add.text(x + w / 2, y + 28, 'Coffee Menu', { ...HUD_TEXT, fontSize: '24px' }).setOrigin(0.5));

    const closeSize = 30;
    const closeX = x + w - closeSize - 8;
    const closeY = y + 8;
    const closeButton = this.add.graphics();
    closeButton.fillStyle(0x3a2112, 1).fillRoundedRect(closeX, closeY, closeSize, closeSize, 6);
    closeButton.fillStyle(0xa8672c, 1).fillRoundedRect(closeX + 2, closeY + 2, closeSize - 4, closeSize - 4, 5);
    closeButton.lineStyle(3, 0xf3dba2, 1).beginPath()
      .moveTo(closeX + 9, closeY + 9).lineTo(closeX + closeSize - 9, closeY + closeSize - 9)
      .moveTo(closeX + closeSize - 9, closeY + 9).lineTo(closeX + 9, closeY + closeSize - 9)
      .strokePath();
    container.add(closeButton);
    container.add(this.add.zone(closeX, closeY, closeSize, closeSize)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.closeCoffeeMenu()));

    COFFEE_ITEMS.forEach((item, index) => {
      const cardX = x + pad + (index % cols) * (cardW + gap);
      const cardY = y + header + Math.floor(index / cols) * (cardH + gap);
      const card = this.add.graphics();
      const drawCard = (hover) => {
        card.clear();
        card.fillStyle(hover ? 0xf6c64f : 0xfff3d1, 1).fillRoundedRect(cardX, cardY, cardW, cardH, 8);
        card.lineStyle(2, hover ? 0xa8672c : 0xd9b36b, 1).strokeRoundedRect(cardX, cardY, cardW, cardH, 8);
      };
      drawCard(false);
      const icon = this.add.graphics();
      drawCoffeeCup(icon, item, cardX + cardW / 2, cardY + 44);
      const label = this.add.text(cardX + cardW / 2, cardY + cardH - 30, item.name, {
        ...HUD_TEXT,
        fontSize: '13px',
        align: 'center',
        wordWrap: { width: cardW - 10 },
      }).setOrigin(0.5, 0);
      const hit = this.add.rectangle(cardX, cardY, cardW, cardH, 0xffffff, 0.001)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => drawCard(true))
        .on('pointerout', () => drawCard(false))
        .on('pointerdown', () => this.orderCoffee(item));
      container.add([card, icon, label, hit]);
    });
  }

  closeCoffeeMenu() {
    if (!this.coffeeMenu) return;
    this.coffeeMenu.destroy(true);
    this.coffeeMenu = null;
  }

  orderCoffee(item) {
    this.closeCoffeeMenu();
    const toast = this.add.text(this.scale.width / 2, this.scale.height - 90, `Ordered: ${item.name}`, {
      ...HUD_TEXT,
      fontSize: '20px',
      backgroundColor: '#f3dba2',
      padding: { x: 16, y: 10 },
    }).setOrigin(0.5).setDepth(DEPTH_UI + 3);
    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: toast.y - 20,
      delay: 1200,
      duration: 500,
      onComplete: () => toast.destroy(),
    });
  }

  createVolumeButton() {
    const x = this.scale.width - 190 - 8 - 48 - 8 - 48;
    const y = 68;
    const graphics = this.add.graphics().setDepth(DEPTH_UI);
    const draw = (muted) => {
      graphics.clear();
      this.drawHudPanel(graphics, x, y, 48, 48);
      const cx = x + 20;
      const cy = y + 24;
      graphics.fillStyle(0x3a2112, 1)
        .fillRect(cx - 9, cy - 4, 6, 8)
        .fillTriangle(cx - 4, cy - 4, cx - 4, cy + 4, cx + 4, cy + 11)
        .fillTriangle(cx - 4, cy - 4, cx + 4, cy - 11, cx + 4, cy + 11);
      if (muted) {
        graphics.lineStyle(3, 0x9b3a2a, 1).beginPath()
          .moveTo(cx + 9, cy - 6).lineTo(cx + 19, cy + 6)
          .moveTo(cx + 19, cy - 6).lineTo(cx + 9, cy + 6)
          .strokePath();
      } else {
        graphics.lineStyle(3, 0x3a2112, 1);
        graphics.beginPath().arc(cx + 5, cy, 7, Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(50), false).strokePath();
        graphics.beginPath().arc(cx + 5, cy, 13, Phaser.Math.DegToRad(-50), Phaser.Math.DegToRad(50), false).strokePath();
      }
    };
    draw(isMusicMuted());

    this.add.zone(x, y, 48, 48)
      .setOrigin(0)
      .setDepth(DEPTH_UI)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => draw(toggleMusicMuted()));
  }

  drawHudPanel(graphics, x, y, w, h) {
    graphics.fillStyle(0x3a2112, 1).fillRoundedRect(x, y, w, h, 8);
    graphics.fillStyle(0xa8672c, 1).fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 6);
    graphics.fillStyle(0xf3dba2, 1).fillRoundedRect(x + 5, y + 5, w - 10, h - 10, 4);
  }

  createTaskPanel() {
    const b = TASK_BUTTON;
    const p = TASK_PANEL;

    this.taskOpen = false;
    this.taskScroll = 0;
    this.taskMaxScroll = 0;
    this.taskVisibleKey = null;
    this.taskView = { x: p.x + 12, y: p.y + p.header, w: p.w - 24, h: 0 };

    const button = this.add.graphics().setDepth(DEPTH_UI);
    this.drawHudPanel(button, b.x, b.y, b.w, b.h);
    // clipboard icon
    button.fillStyle(0x3a2112, 1).fillRoundedRect(b.x + 14, b.y + 9, 22, 28, 3);
    button.fillStyle(0xfff3d1, 1).fillRect(b.x + 17, b.y + 14, 16, 20);
    button.fillStyle(0xa8672c, 1).fillRect(b.x + 20, b.y + 6, 10, 6);
    button.fillStyle(0x3a2112, 1);
    for (const lineY of [18, 24, 30]) button.fillRect(b.x + 19, b.y + lineY, 12, 2);
    this.add.text(b.x + 46, b.y + b.h / 2, 'Tasks', { ...HUD_TEXT, fontSize: '19px' })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH_UI);
    this.taskArrow = this.add.graphics().setDepth(DEPTH_UI);

    const dropdown = this.add.container(0, 0).setDepth(DEPTH_UI).setVisible(false);
    this.taskPanelBg = this.add.graphics();
    dropdown.add(this.taskPanelBg);
    dropdown.add(this.add.text(p.x + p.w / 2, p.y + 28, "Today's Tasks", { ...HUD_TEXT, fontSize: '19px' })
      .setOrigin(0.5));
    this.taskEmptyText = this.add.text(p.x + p.w / 2, p.y + p.header + 6, 'All tasks done!', { ...HUD_TEXT, fontSize: '16px', color: '#2f6b2f' })
      .setOrigin(0.5, 0)
      .setVisible(false);
    dropdown.add(this.taskEmptyText);

    // Rows live in a clipped container that is shifted up as the list scrolls.
    const content = this.add.container(0, 0);
    this.taskRowBg = this.add.graphics();
    content.add(this.taskRowBg);
    this.taskRows = TASKS.map((task) => {
      const label = this.add.text(0, 0, task.label, { ...HUD_TEXT, fontSize: task.goal > 1 ? '15px' : '14px' });
      const count = this.add.text(0, 0, '', { ...HUD_TEXT, fontSize: '15px' }).setOrigin(1, 0.5);
      content.add([label, count]);
      return { task, x: 0, y: 0, w: 0, label, count };
    });
    this.taskProgress = this.add.graphics();
    content.add(this.taskProgress);
    this.taskMaskShape = this.make.graphics({ x: 0, y: 0, add: false });
    content.setMask(this.taskMaskShape.createGeometryMask());
    dropdown.add(content);
    this.taskContent = content;

    this.taskScrollbar = this.add.graphics();
    dropdown.add(this.taskScrollbar);
    this.taskDropdown = dropdown;

    this.add.zone(b.x, b.y, b.w, b.h)
      .setOrigin(0)
      .setDepth(DEPTH_UI)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.taskOpen = !this.taskOpen;
        this.taskDropdown.setVisible(this.taskOpen);
        this.syncTaskZones();
      });

    // Drag or mouse-wheel over the panel to scroll.
    this.taskListZone = this.add.zone(p.x, p.y, p.w, 1)
      .setOrigin(0)
      .setDepth(DEPTH_UI)
      .setInteractive();
    this.taskListZone.on('pointerdown', (pointer) => {
      this.taskDrag = { startY: pointer.y, startScroll: this.taskScroll };
    });
    // Scrollbar: click the track to jump, drag the thumb to scroll.
    this.taskBarZone = this.add.zone(this.getTaskBarX() - 6, this.taskView.y, p.scrollbarW + 12, 1)
      .setOrigin(0)
      .setDepth(DEPTH_UI)
      .setInteractive({ useHandCursor: true });
    this.taskBarZone.on('pointerdown', (pointer) => {
      this.taskBarDrag = true;
      this.scrollTaskBarTo(pointer.y);
    });
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      if (this.taskBarDrag) this.scrollTaskBarTo(pointer.y);
      else if (this.taskDrag) this.setTaskScroll(this.taskDrag.startScroll - (pointer.y - this.taskDrag.startY));
    });
    this.input.on('pointerup', () => {
      this.taskDrag = null;
      this.taskBarDrag = false;
    });
    this.input.on('wheel', (pointer, over, dx, dy) => {
      if (this.taskOpen && this.taskListZone.getBounds().contains(pointer.x, pointer.y)) {
        this.setTaskScroll(this.taskScroll + dy * 0.5);
      }
    });

    this.syncTaskLayout();
  }

  syncTaskZones() {
    this.taskListZone.input.enabled = this.taskOpen;
    this.taskBarZone.input.enabled = this.taskOpen && this.taskMaxScroll > 0;
  }

  getTaskBarX() {
    return TASK_PANEL.x + TASK_PANEL.w - 12 - TASK_PANEL.scrollbarW - 6;
  }

  getTaskThumbH() {
    const v = this.taskView;
    return Math.max(24, v.h * (v.h / (v.h + this.taskMaxScroll)));
  }

  scrollTaskBarTo(pointerY) {
    const v = this.taskView;
    const thumbH = this.getTaskThumbH();
    const ratio = (pointerY - v.y - thumbH / 2) / (v.h - thumbH);
    this.setTaskScroll(ratio * this.taskMaxScroll);
  }

  setTaskScroll(value) {
    this.taskScroll = Phaser.Math.Clamp(value, 0, this.taskMaxScroll);
    this.taskContent.y = -this.taskScroll;
  }

  // Completed tasks are hidden, so rows are re-laid out whenever the set of open tasks changes.
  syncTaskLayout() {
    const { tasks } = this.world.game;
    const open = this.taskRows.filter((row) => tasks[row.task.id] < row.task.goal);
    const key = open.map((row) => row.task.id).join(',');
    if (key === this.taskVisibleKey) return;
    this.taskVisibleKey = key;

    const p = TASK_PANEL;
    const count = open.length;
    const contentH = count ? count * p.rowH + (count - 1) * p.rowGap : 0;
    const viewH = Math.min(contentH, p.maxVisible * p.rowH + (p.maxVisible - 1) * p.rowGap);
    const panelH = p.header + (count ? viewH : 36) + p.pad;
    const v = this.taskView;
    v.h = viewH;
    this.taskMaxScroll = contentH - viewH;
    const rowW = v.w - (this.taskMaxScroll > 0 ? p.scrollbarW + 8 : 0);

    this.taskPanelBg.clear();
    this.drawHudPanel(this.taskPanelBg, p.x, p.y, p.w, panelH);
    this.taskMaskShape.clear().fillStyle(0xffffff, 1).fillRect(v.x - 2, v.y, v.w + 4, viewH);
    this.taskEmptyText.setVisible(count === 0);
    this.taskListZone.setSize(p.w, panelH);
    this.taskBarZone.setSize(p.scrollbarW + 12, viewH);

    this.taskRowBg.clear();
    for (const row of this.taskRows) {
      row.label.setVisible(false);
      row.count.setVisible(false);
    }
    open.forEach((row, index) => {
      row.x = v.x;
      row.y = v.y + index * (p.rowH + p.rowGap);
      row.w = rowW;
      this.taskRowBg.fillStyle(0xfff3d1, 1).fillRoundedRect(row.x, row.y, rowW, p.rowH, 8);
      this.taskRowBg.lineStyle(2, 0xd9b36b, 1).strokeRoundedRect(row.x, row.y, rowW, p.rowH, 8);
      const hasBar = row.task.goal > 1;
      row.label.setVisible(true).setWordWrapWidth(rowW - 46 - 52)
        .setOrigin(0, hasBar ? 0 : 0.5)
        .setPosition(row.x + 46, row.y + (hasBar ? 6 : p.rowH / 2));
      row.count.setVisible(true).setPosition(row.x + rowW - 12, row.y + p.rowH / 2);
    });
    this.openTaskRows = open;
    this.setTaskScroll(this.taskScroll);
    this.syncTaskZones();
  }

  updateTaskPanel() {
    const b = TASK_BUTTON;
    const cx = b.x + b.w - 20;
    const cy = b.y + b.h / 2;
    this.taskArrow.clear().fillStyle(0x3a2112, 1);
    if (this.taskOpen) this.taskArrow.fillTriangle(cx - 6, cy + 3, cx + 6, cy + 3, cx, cy - 4);
    else this.taskArrow.fillTriangle(cx - 6, cy - 3, cx + 6, cy - 3, cx, cy + 4);

    this.syncTaskLayout();
    if (!this.taskOpen) return;

    this.taskScrollbar.clear();
    if (this.taskMaxScroll > 0) {
      const v = this.taskView;
      const trackX = this.getTaskBarX();
      const thumbH = this.getTaskThumbH();
      const thumbY = v.y + (v.h - thumbH) * (this.taskScroll / this.taskMaxScroll);
      this.taskScrollbar
        .fillStyle(0xd9b36b, 1).fillRoundedRect(trackX, v.y, TASK_PANEL.scrollbarW, v.h, 4)
        .fillStyle(0x8a5a2b, 1).fillRoundedRect(trackX, thumbY, TASK_PANEL.scrollbarW, thumbH, 4);
    }

    const { tasks } = this.world.game;
    const g = this.taskProgress.clear();
    for (const row of this.openTaskRows) {
      const value = tasks[row.task.id];
      row.count.setText(row.task.goal > 1 ? `${value}/${row.task.goal} +${row.task.reward}` : `+${row.task.reward}`);

      const boxX = row.x + 12;
      const boxY = row.y + (TASK_PANEL.rowH - 20) / 2;
      g.fillStyle(0xfff3d1, 1).fillRoundedRect(boxX, boxY, 20, 20, 4);
      g.lineStyle(2, 0x3a2112, 1).strokeRoundedRect(boxX, boxY, 20, 20, 4);

      if (row.task.goal > 1) {
        const barX = row.x + 46;
        const barY = row.y + 29;
        const barW = 150;
        g.fillStyle(0xc9c2b0, 1).fillRoundedRect(barX, barY, barW, 9, 4);
        if (value > 0) g.fillStyle(0x5fbf4a, 1).fillRoundedRect(barX, barY, Math.max(8, barW * (value / row.task.goal)), 9, 4);
        g.lineStyle(1, 0x3a2112, 0.6).strokeRoundedRect(barX, barY, barW, 9, 4);
      }
    }
  }

  createInput() {
    this.keys = this.input.keyboard.addKeys({
      up: 'W',
      upArrow: 'UP',
      down: 'S',
      downArrow: 'DOWN',
      left: 'A',
      leftArrow: 'LEFT',
      right: 'D',
      rightArrow: 'RIGHT',
    });
    this.hitboxKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this.escapeKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  createTransitionOverlay() {
    this.fadeOverlay = this.add.rectangle(
      this.scale.width / 2,
      this.scale.height / 2,
      this.scale.width,
      this.scale.height,
      0x000000,
      0,
    ).setDepth(DEPTH_UI + 1);
  }

  setActiveArea(activeArea) {
    for (const [name, layer] of this.areaLayers) {
      const active = this.world.areas[name] === activeArea;
      layer.background.setVisible(active);
      for (const item of layer.items) {
        item.image.setVisible(active);
        if (item.shadow) item.shadow.setVisible(active);
      }
      for (const coin of this.coinLayers.get(name)) {
        const visible = active && !coin.data.got;
        coin.image.setVisible(visible);
        coin.shadow.setVisible(visible);
      }
      const lighting = this.dayNightLayers.get(name);
      for (const shade of lighting.darkness) shade.setVisible(active);
    }
  }

  updateDayNight() {
    const intensity = getNightIntensity(this.world.game.minutes);

    this.hudSunIcon.setAlpha(1 - intensity);
    this.hudMoonIcon.setAlpha(intensity);

    for (const { darkness } of this.dayNightLayers.values()) {
      for (const overlay of darkness) {
        overlay.setAlpha(intensity * MAX_OUTDOOR_DARKNESS);
      }
    }
  }

  addCanvasTexture(source) {
    const key = `world-texture-${this.textureIds++}`;
    this.textures.addCanvas(key, source);
    return key;
  }

  getImageTexture(source) {
    let key = this.imageTextures.get(source);
    if (key) return key;

    key = `world-image-${this.textureIds++}`;
    if (source instanceof HTMLCanvasElement) this.textures.addCanvas(key, source);
    else this.textures.addImage(key, source);
    this.imageTextures.set(source, key);
    return key;
  }

  getFrameTexture(frame) {
    let key = this.frameTextures.get(frame);
    if (key) return key;

    const canvas = document.createElement('canvas');
    canvas.width = frame.sw;
    canvas.height = frame.sh;
    const context = canvas.getContext('2d');
    context.drawImage(frame.img, frame.sx, frame.sy, frame.sw, frame.sh, 0, 0, frame.sw, frame.sh);
    key = this.addCanvasTexture(canvas);
    this.frameTextures.set(frame, key);
    return key;
  }

  getNpcTexture(frame) {
    let key = this.frameTextures.get(frame);
    if (key) return key;

    key = `npc-frame-${this.textureIds++}`;
    this.textures.addImage(key, frame);
    this.frameTextures.set(frame, key);
    return key;
  }

  syncCoinLayers() {
    for (const [name, area] of Object.entries(this.world.areas)) {
      const coins = this.coinLayers.get(name);
      const changed = coins.length !== area.coins.length
        || coins.some((coin, index) => coin.data !== area.coins[index]);
      if (!changed) continue;
      for (const coin of coins) {
        coin.image.destroy();
        coin.shadow.destroy();
      }
      this.coinLayers.set(name, this.createCoins(area));
    }
  }

  update(time, delta) {
    const frozen = Boolean(this.dialog || this.coffeeMenu);
    setDirectionDown('up', !frozen && (this.keys.up.isDown || this.keys.upArrow.isDown));
    setDirectionDown('down', !frozen && (this.keys.down.isDown || this.keys.downArrow.isDown));
    setDirectionDown('left', !frozen && (this.keys.left.isDown || this.keys.leftArrow.isDown));
    setDirectionDown('right', !frozen && (this.keys.right.isDown || this.keys.rightArrow.isDown));
    if (Phaser.Input.Keyboard.JustDown(this.escapeKey)) {
      if (this.coffeeMenu) this.closeCoffeeMenu();
      else if (frozen) this.closeDialog();
    }
    this.coffeeZone.input.enabled = this.world.sceneName === 'cafe' && !frozen;
    if (Phaser.Input.Keyboard.JustDown(this.hitboxKey)) toggleHitboxes();

    updateWorld(Math.min(delta / 1000, 0.05));
    this.world = getWorldState();
    updateNpcManager(this.npcManager, this.world.game.minutes, Math.min(delta / 1000, 0.05), this.world.game.day);
    this.updateDayNight();
    this.syncCoinLayers();
    this.setActiveArea(this.world.scene);
    this.updateCoins(time);
    this.updateNpcs();
    this.updateAnimatedItems(time);
    this.updatePlayer();
    this.updateHud();
    this.updateTaskPanel();
    this.updatePopups();
    this.updateTransition();
    this.updateDebugGraphics();
  }

  updateAnimatedItems(time) {
    for (const layer of this.areaLayers.values()) {
      for (const item of layer.items) {
        if (!item.anim) continue;
        item.image.setTexture(item.anim[Math.floor(time / FOUNTAIN_FRAME_MS) % item.anim.length]);
      }
    }
  }

  updateCoins(time) {
    for (const coins of this.coinLayers.values()) {
      for (const coin of coins) {
        const bob = Math.sin(time / 1000 * 3 + coin.data.phase) * 3;
        const spin = Math.max(0.2, Math.abs(Math.cos(time / 1000 * 3.2 + coin.data.phase)));
        coin.image
          .setPosition(coin.data.x, coin.data.y - 20 + bob)
          .setDisplaySize(24 * spin, 24);
      }
    }
  }

  updateNpcs() {
  for (const npc of this.npcManager.npcs) {
    const sprite = this.npcSprites.get(npc.id);
    const visible = npc.present && npc.area === this.world.sceneName;

    sprite.setVisible(visible);

    if (!visible) {
      if (sprite.input?.enabled) sprite.disableInteractive();
      continue;
    }

    if (!sprite.input?.enabled) {
      sprite.setInteractive({ useHandCursor: true });
    }

    const direction = npc.facing;
    const walkCycle = [0, 1, 2, 1];

    const frameIndex = npc.moving
      ? walkCycle[
          Math.floor(npc.walkAnimationTime / 0.15) % walkCycle.length
        ]
      : 1;

    const frame = npc.frames[direction][frameIndex];

    sprite
      .setTexture(this.getNpcTexture(frame))
      .setPosition(npc.x, npc.y)
      .setDepth(npc.y);
  }
}

  updatePlayer() {
    const visual = getPlayerVisual();
    const texture = this.getFrameTexture(visual.frame);
    this.playerImage
      .setTexture(texture)
      .setPosition(visual.x, visual.y + visual.bob)
      .setDisplaySize(visual.width, visual.height)
      .setFlipX(visual.flip)
      .setDepth(visual.y);
    this.playerShadow.setPosition(visual.x, visual.y - 2).setDepth(visual.y - 1);
  }

  updateHud() {
    const { game } = this.world;
    const minutes = Math.floor(game.minutes / 10) * 10;
    const hour = Math.floor(minutes / 60) % 24;
    const minuteText = String(minutes % 60).padStart(2, '0');
    const timeText = `${hour % 12 || 12}:${minuteText} ${hour < 12 ? 'AM' : 'PM'}`;
    const dayText = `${WEEKDAYS[(game.day - 1) % 7]} ${((game.day - 1) % 28) + 1}`;

    this.dayText.setText(dayText);
    this.timeText.setText(timeText);
    this.coinCountText.setText(String(game.coins));
    this.hudCoinIcon.setY(92 - Math.round(game.coinBump * 3));
    this.coinCountText.setY(81 - Math.round(game.coinBump * 3));
  }

  updatePopups() {
    while (this.popTexts.length < this.world.pops.length) {
      this.popTexts.push(this.add.text(0, 0, '', {
        color: '#ffd23f',
        fontFamily: '"Courier New", monospace',
        fontSize: '16px',
        fontStyle: 'bold',
        stroke: '#3a2112',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(DEPTH_UI - 2));
    }

    this.popTexts.forEach((text, index) => {
      const pop = this.world.pops[index];
      if (!pop) {
        text.setVisible(false);
        return;
      }
      const progress = pop.t / 0.9;
      text.setText(pop.text)
        .setPosition(pop.x, pop.y - progress * 26)
        .setAlpha(1 - progress * progress)
        .setVisible(true);
    });
  }

  updateTransition() {
    const { transition } = this.world;
    if (transition.phase === 'none') {
      this.fadeOverlay.setAlpha(0);
      return;
    }
    const progress = Math.min(transition.t / 0.25, 1);
    this.fadeOverlay.setAlpha(transition.phase === 'out' ? progress : 1 - progress);
  }

  updateDebugGraphics() {
    this.debugGraphics.clear();
    if (!this.world.debugHitboxes) return;

    this.debugGraphics.lineStyle(1, 0x00c850, 0.8);
    for (const rect of this.world.scene.walkable) {
      this.debugGraphics.strokeRect(rect.x0, rect.y0, rect.x1 - rect.x0, rect.y1 - rect.y0);
    }
    this.debugGraphics.fillStyle(0xff0000, 0.2);
    this.debugGraphics.lineStyle(1, 0xff0000, 0.9);
    for (const collider of this.world.scene.colliders) {
      this.debugGraphics.fillRect(collider.x, collider.y, collider.w, collider.h);
      this.debugGraphics.strokeRect(collider.x, collider.y, collider.w, collider.h);
    }
    const { player } = this.world;
    this.debugGraphics.lineStyle(1, 0x0078ff, 0.9);
    this.debugGraphics.strokeRect(player.x - 12, player.y - 8, 24, 8);
  }
}
