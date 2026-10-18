import Phaser from 'phaser';
import { loadAssets } from '../common/assets.js';
import { SCENE_KEYS } from './scene-keys.js';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.PRELOAD });
  }

  create() {
    this.add.text(this.scale.width / 2, this.scale.height / 2, 'Loading...', {
      color: '#f3dba2',
      fontFamily: 'monospace',
      fontSize: '24px',
    }).setOrigin(0.5);

    loadAssets()
      .then((assets) => this.scene.start(SCENE_KEYS.GAME, { assets }))
      .catch((error) => {
        console.error('Unable to load game assets.', error);
        this.add.text(24, 48, `Unable to load game assets: ${error.message}`, {
          color: '#ffffff',
          fontFamily: 'monospace',
          fontSize: '16px',
          wordWrap: { width: this.scale.width - 48 },
        });
      });
  }
}
