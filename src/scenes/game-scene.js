import Phaser from 'phaser';
import { getPlayerVisual, getWorldState, initializeWorld, resetProgress, setDirectionDown, toggleHitboxes, updateWorld } from './game-world.js';
import { SCENE_KEYS } from './scene-keys.js';
import { TASKS } from '../common/tasks.js';

const DEPTH_UI = 10000;
const HUD_TEXT = { color: '#3a2112', fontFamily: '"Courier New", monospace', fontStyle: 'bold' };
const TASK_BUTTON = { x: 14, y: 12, w: 150, h: 46 };
const TASK_PANEL = { x: 14, y: 66, w: 320, rowH: 46, rowGap: 8, header: 52, pad: 14 };
const FOUNTAIN_FRAME_MS = 180;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.GAME });
    this.textureIds = 0;
  }

  create(data) {
    if (!data.assets) throw new Error('Game assets were not provided by the preload scene.');
    initializeWorld(data.assets);
    this.world = getWorldState();
    this.imageTextures = new WeakMap();
    this.frameTextures = new WeakMap();
    this.areaLayers = new Map();
    this.coinLayers = new Map();
    this.createAreas();
    this.createPlayer();
    this.createHud();
    this.createTaskPanel();
    this.createRestartButton();
    this.createInput();
    this.createTransitionOverlay();
    this.setActiveArea(this.world.scene);
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
    this.add.image(width - 162, 37, this.getFrameTexture(this.world.frames.sun))
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

  drawHudPanel(graphics, x, y, w, h) {
    graphics.fillStyle(0x3a2112, 1).fillRoundedRect(x, y, w, h, 8);
    graphics.fillStyle(0xa8672c, 1).fillRoundedRect(x + 2, y + 2, w - 4, h - 4, 6);
    graphics.fillStyle(0xf3dba2, 1).fillRoundedRect(x + 5, y + 5, w - 10, h - 10, 4);
  }

  createTaskPanel() {
    const b = TASK_BUTTON;
    const p = TASK_PANEL;
    const panelH = p.header + TASKS.length * p.rowH + (TASKS.length - 1) * p.rowGap + p.pad;

    this.taskOpen = false;

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
    const background = this.add.graphics();
    this.drawHudPanel(background, p.x, p.y, p.w, panelH);
    dropdown.add(background);
    dropdown.add(this.add.text(p.x + p.w / 2, p.y + 28, "Today's Tasks", { ...HUD_TEXT, fontSize: '19px' })
      .setOrigin(0.5));

    this.taskRows = TASKS.map((task, index) => {
      const x = p.x + 12;
      const y = p.y + p.header + index * (p.rowH + p.rowGap);
      const w = p.w - 24;
      background.fillStyle(0xfff3d1, 1).fillRoundedRect(x, y, w, p.rowH, 8);
      background.lineStyle(2, 0xd9b36b, 1).strokeRoundedRect(x, y, w, p.rowH, 8);
      const hasBar = task.goal > 1;
      const label = this.add.text(x + 46, y + (hasBar ? 6 : p.rowH / 2), task.label, { ...HUD_TEXT, fontSize: '15px' })
        .setOrigin(0, hasBar ? 0 : 0.5);
      const count = this.add.text(x + w - 12, y + p.rowH / 2, '', { ...HUD_TEXT, fontSize: '15px' })
        .setOrigin(1, 0.5);
      dropdown.add([label, count]);
      return { task, x, y, w, label, count };
    });
    this.taskProgress = this.add.graphics();
    dropdown.add(this.taskProgress);
    this.taskDropdown = dropdown;

    this.add.zone(b.x, b.y, b.w, b.h)
      .setOrigin(0)
      .setDepth(DEPTH_UI)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.taskOpen = !this.taskOpen;
        this.taskDropdown.setVisible(this.taskOpen);
      });
  }

  updateTaskPanel() {
    const b = TASK_BUTTON;
    const cx = b.x + b.w - 20;
    const cy = b.y + b.h / 2;
    this.taskArrow.clear().fillStyle(0x3a2112, 1);
    if (this.taskOpen) this.taskArrow.fillTriangle(cx - 6, cy + 3, cx + 6, cy + 3, cx, cy - 4);
    else this.taskArrow.fillTriangle(cx - 6, cy - 3, cx + 6, cy - 3, cx, cy + 4);

    if (!this.taskOpen) return;
    const { tasks } = this.world.game;
    const g = this.taskProgress.clear();
    for (const row of this.taskRows) {
      const value = tasks[row.task.id];
      const done = value >= row.task.goal;
      row.count.setText(row.task.goal > 1 ? `${value}/${row.task.goal} +${row.task.reward}` : `+${row.task.reward}`);
      row.label.setColor(done ? '#2f6b2f' : HUD_TEXT.color);

      const boxX = row.x + 12;
      const boxY = row.y + (TASK_PANEL.rowH - 20) / 2;
      g.fillStyle(done ? 0x6fbf4a : 0xfff3d1, 1).fillRoundedRect(boxX, boxY, 20, 20, 4);
      g.lineStyle(2, 0x3a2112, 1).strokeRoundedRect(boxX, boxY, 20, 20, 4);
      if (done) {
        g.lineStyle(3, 0x1f4d1f, 1).beginPath()
          .moveTo(boxX + 4, boxY + 10)
          .lineTo(boxX + 9, boxY + 15)
          .lineTo(boxX + 16, boxY + 5)
          .strokePath();
      }

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
    setDirectionDown('up', this.keys.up.isDown || this.keys.upArrow.isDown);
    setDirectionDown('down', this.keys.down.isDown || this.keys.downArrow.isDown);
    setDirectionDown('left', this.keys.left.isDown || this.keys.leftArrow.isDown);
    setDirectionDown('right', this.keys.right.isDown || this.keys.rightArrow.isDown);
    if (Phaser.Input.Keyboard.JustDown(this.hitboxKey)) toggleHitboxes();

    updateWorld(Math.min(delta / 1000, 0.05));
    this.world = getWorldState();
    this.syncCoinLayers();
    this.setActiveArea(this.world.scene);
    this.updateCoins(time);
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
