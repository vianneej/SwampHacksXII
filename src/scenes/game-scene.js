import Phaser from 'phaser';
import { getPlayerVisual, getWorldState, initializeWorld, setDirectionDown, toggleHitboxes, updateWorld } from './game-world.js';
import { createNpcManager, updateNpcManager } from '../game-objects/npcs/npc-manager.js';
import { SCENE_KEYS } from './scene-keys.js';

const DEPTH_UI = 10000;
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
    this.createNpcs(data.assets.npcFrames);
    this.createPlayer();
    this.createHud();
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

  createNpcs(spriteFrames) {
    this.npcManager = createNpcManager(spriteFrames, this.world.game.minutes, this.world.areas);
    this.npcSprites = new Map();
    for (const npc of this.npcManager.npcs) {
      const frame = npc.frames[npc.facing][0];
      const width = Math.min(npc.collisionWidth, npc.displayHeight * (frame.width / frame.height));
      const sprite = this.add.image(npc.x, npc.y, this.getNpcTexture(frame))
        .setOrigin(0.5, 1)
        .setDisplaySize(width, npc.displayHeight)
        .setDepth(npc.y);
      this.npcSprites.set(npc.id, sprite);
    }
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
    this.hudWeatherIcon = this.add.image(width - 162, 92, this.getFrameTexture(this.world.frames.coin))
      .setDisplaySize(34, 34)
      .setDepth(DEPTH_UI);
    this.hudWeatherIcon.setVisible(false);
    this.hudCoinIcon = this.add.image(width - 158, 92, this.getFrameTexture(this.world.frames.coin))
      .setDisplaySize(34, 34)
      .setDepth(DEPTH_UI);
    this.popTexts = [];
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
    setDirectionDown('up', this.keys.up.isDown || this.keys.upArrow.isDown);
    setDirectionDown('down', this.keys.down.isDown || this.keys.downArrow.isDown);
    setDirectionDown('left', this.keys.left.isDown || this.keys.leftArrow.isDown);
    setDirectionDown('right', this.keys.right.isDown || this.keys.rightArrow.isDown);
    if (Phaser.Input.Keyboard.JustDown(this.hitboxKey)) toggleHitboxes();

    updateWorld(Math.min(delta / 1000, 0.05));
    this.world = getWorldState();
    updateNpcManager(this.npcManager, this.world.game.minutes, Math.min(delta / 1000, 0.05));
    this.syncCoinLayers();
    this.setActiveArea(this.world.scene);
    this.updateCoins(time);
    this.updateNpcs(time);
    this.updateAnimatedItems(time);
    this.updatePlayer();
    this.updateHud();
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

  updateNpcs(time) {
    for (const npc of this.npcManager.npcs) {
      const sprite = this.npcSprites.get(npc.id);
      const visible = npc.area === this.world.sceneName;
      sprite.setVisible(visible);
      if (!visible) continue;

      const frameIndex = npc.moving ? Math.floor(time / 150) % 3 : 0;
      const frame = npc.frames[npc.facing][frameIndex];
      sprite.setTexture(this.getNpcTexture(frame))
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
    const isDay = game.minutes >= 6 * 60 && game.minutes < 19 * 60;

    this.dayText.setText(dayText);
    this.timeText.setText(timeText);
    this.coinCountText.setText(String(game.coins));
    this.hudWeatherIcon.setTexture(this.getFrameTexture(isDay ? this.world.frames.sun : this.world.frames.moon));
    this.hudWeatherIcon.setVisible(true);
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
      text.setText('+10')
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
