import Phaser from 'phaser';
import { GAME_CONFIG } from './common/config.js';
import { GameScene } from './scenes/game-scene.js';
import { PreloadScene } from './scenes/preload-scene.js';
import { SCENE_KEYS } from './scenes/scene-keys.js';

const gameConfig = {
  ...GAME_CONFIG,
  type: Phaser.AUTO,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(gameConfig);
game.scene.add(SCENE_KEYS.PRELOAD, PreloadScene);
game.scene.add(SCENE_KEYS.GAME, GameScene);
game.scene.start(SCENE_KEYS.PRELOAD);
