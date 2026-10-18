import { emptyTaskProgress, sanitizeTaskProgress } from './tasks.js';

const GAME_SAVE_KEY = 'moonlightCafeSave';

export function loadGame() {
  const game = { coins: 0, day: 1, minutes: 9 * 60 + 30, coinBump: 0, tasks: emptyTaskProgress() };
  try {
    const saved = JSON.parse(localStorage.getItem(GAME_SAVE_KEY));
    if (saved) {
      game.coins = saved.coins | 0;
      game.day = Math.max(1, saved.day | 0);
      game.minutes = Math.min(Math.max(saved.minutes || 6 * 60, 6 * 60), 26 * 60 - 1);
      game.tasks = sanitizeTaskProgress(saved.tasks);
    }
  } catch {
    // Ignore invalid or unavailable saved game data.
  }
  return game;
}

export function saveGame(game) {
  try {
    localStorage.setItem(GAME_SAVE_KEY, JSON.stringify({
      coins: game.coins,
      day: game.day,
      minutes: Math.floor(game.minutes),
      tasks: game.tasks,
    }));
  } catch {
    // Saving is optional when browser storage is unavailable.
  }
}
